import { BaseConfigurationComponent } from '../registry/BaseConfigurationComponent';
import { ComponentHealth, ComponentStatus } from '../registry/interfaces/IConfigurationComponent';
import {
  IFeatureToggleManager,
  FeatureFlag,
  FeatureConfig,
  FeatureConditions,
  FeatureChangeEvent,
  FeatureEvaluationContext,
  FeatureToggleStats,
  FeatureChangeCallback,
  FeatureToggleManagerConfig
} from './interfaces/IFeatureToggleManager';

/**
 * Feature toggle manager implementation
 * Provides dynamic feature flag management with hot reload support
 */
export class FeatureToggleManager extends BaseConfigurationComponent implements IFeatureToggleManager {
  private features: Map<string, FeatureFlag> = new Map();
  private changeCallbacks: Set<FeatureChangeCallback> = new Set();
  private evaluationCache: Map<string, { result: boolean; timestamp: Date; context?: string }> = new Map();
  private stats: FeatureToggleStats = {
    totalFeatures: 0,
    enabledFeatures: 0,
    disabledFeatures: 0,
    conditionalFeatures: 0,
    evaluationCount: 0
  };
  private featureConfig: FeatureToggleManagerConfig = {
    defaultEnabled: false,
    enableCaching: true,
    cacheTtl: 60000, // 1 minute
    enableEvents: true
  };
  protected logger = console;

  constructor() {
    super(
      'feature-toggle-manager',
      'feature-manager',
      'Feature Toggle Manager',
      '1.0.0',
      'Manages dynamic feature flags with hot reload support',
      [],
      ['feature-toggles', 'hot-reload', 'conditions']
    );
  }

  /**
   * Initialize the feature toggle manager
   */
  protected async doInitialize(config: any): Promise<void> {
    this.logger.info('Initializing FeatureToggleManager');

    // Update configuration
    if (config?.features) {
      this.featureConfig = { ...this.featureConfig, ...config.features };
    }

    // Load initial features from configuration
    if (config?.features?.toggles) {
      await this.loadFeaturesFromConfig(config.features.toggles);
    }

    this.logger.info(`FeatureToggleManager initialized with ${this.features.size} features`);
  }

  /**
   * Update configuration
   */
  protected async doUpdateConfig(newConfig: any): Promise<void> {
    this.logger.info('Updating FeatureToggleManager configuration');

    const oldConfig = { ...this.featureConfig };

    try {
      // Update configuration
      if (newConfig?.features) {
        this.featureConfig = { ...this.featureConfig, ...newConfig.features };
      }

      // Reload features if toggles configuration changed
      if (newConfig?.features?.toggles) {
        await this.loadFeaturesFromConfig(newConfig.features.toggles);
      }

      // Clear cache if caching settings changed
      if (oldConfig.enableCaching !== this.featureConfig.enableCaching ||
          oldConfig.cacheTtl !== this.featureConfig.cacheTtl) {
        this.clearCache();
      }

      this.logger.info('FeatureToggleManager configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update FeatureToggleManager configuration:', error);
      // Rollback configuration
      this.featureConfig = oldConfig;
      throw error;
    }
  }

  /**
   * Start the feature toggle manager
   */
  protected async doStart(): Promise<void> {
    this.logger.info('Starting FeatureToggleManager');

    // Start cache cleanup if caching is enabled
    if (this.featureConfig.enableCaching) {
      this.startCacheCleanup();
    }

    this.updateStats();
    this.logger.info('FeatureToggleManager started successfully');
  }

  /**
   * Stop the feature toggle manager
   */
  protected async doStop(): Promise<void> {
    this.logger.info('Stopping FeatureToggleManager');

    // Clear all callbacks
    this.changeCallbacks.clear();

    // Clear cache
    this.clearCache();

    this.logger.info('FeatureToggleManager stopped successfully');
  }

  /**
   * Get component health
   */
  protected async doGetHealth(): Promise<Partial<ComponentHealth>> {
    const health: Partial<ComponentHealth> = {
      status: ComponentStatus.HEALTHY,
      details: {
        metrics: {
          totalFeatures: this.features.size,
          enabledFeatures: this.getEnabledFeatures().length,
          cacheSize: this.evaluationCache.size,
          evaluationCount: this.stats.evaluationCount
        }
      }
    };

    // Check for potential issues
    if (this.features.size === 0) {
      health.status = ComponentStatus.WARNING;
      health.details = {
        ...health.details,
        warning: 'No features configured'
      };
    }

    return health;
  }

  /**
   * Cleanup resources
   */
  protected async doCleanup(): Promise<void> {
    this.features.clear();
    this.changeCallbacks.clear();
    this.clearCache();
  }

  /**
   * Check if a feature is enabled
   */
  public isEnabled(feature: string, context?: FeatureEvaluationContext): boolean {
    const flag = this.features.get(feature);

    // For percentage rollout, don't use cache to ensure randomness
    const hasPercentageCondition = flag?.conditions?.percentage !== undefined;

    const cacheKey = this.getCacheKey(feature, context);

    // Check cache first (but not for percentage rollout)
    if (this.featureConfig.enableCaching && !hasPercentageCondition) {
      const cached = this.evaluationCache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp)) {
        this.stats.evaluationCount++;
        return cached.result;
      }
    }

    // Evaluate feature
    const result = this.evaluateFeatureInternal(feature, context);

    // Cache result (but not for percentage rollout)
    if (this.featureConfig.enableCaching && !hasPercentageCondition) {
      this.evaluationCache.set(cacheKey, {
        result,
        timestamp: new Date(),
        context: context ? JSON.stringify(context) : undefined
      });
    }

    this.stats.evaluationCount++;
    this.stats.lastEvaluation = new Date();

    return result;
  }

  /**
   * Enable a feature
   */
  public async enable(feature: string, reason?: string): Promise<void> {
    await this.updateFeatureState(feature, true, reason);
  }

  /**
   * Disable a feature
   */
  public async disable(feature: string, reason?: string): Promise<void> {
    await this.updateFeatureState(feature, false, reason);
  }

  /**
   * Toggle a feature state
   */
  public async toggle(feature: string, reason?: string): Promise<void> {
    const flag = this.features.get(feature);
    const newState = !flag?.enabled;
    await this.updateFeatureState(feature, newState, reason);
  }

  /**
   * Enable multiple features
   */
  public async enableMultiple(features: string[], reason?: string): Promise<void> {
    for (const feature of features) {
      await this.enable(feature, reason);
    }
  }

  /**
   * Disable multiple features
   */
  public async disableMultiple(features: string[], reason?: string): Promise<void> {
    for (const feature of features) {
      await this.disable(feature, reason);
    }
  }

  /**
   * Update feature configuration
   */
  public async updateFeatureConfig(feature: string, config: FeatureConfig, suppressEvents = false): Promise<void> {
    const existingFlag = this.features.get(feature);
    const previousState = existingFlag?.enabled || false;
    const isNewFeature = !existingFlag;

    const flag: FeatureFlag = {
      name: feature,
      enabled: config.enabled,
      description: config.description,
      conditions: config.conditions,
      metadata: config.metadata,
      createdAt: existingFlag?.createdAt || new Date(),
      updatedAt: new Date()
    };

    this.features.set(feature, flag);

    // Clear cache for this feature
    this.clearCache(feature);

    // Emit change event if state changed and not suppressed
    if (this.featureConfig.enableEvents && !suppressEvents && !isNewFeature && previousState !== config.enabled) {
      this.emitFeatureChange({
        feature,
        previousState,
        newState: config.enabled,
        timestamp: new Date(),
        reason: 'Configuration update'
      });
    }

    this.updateStats();
    this.logger.debug(`Feature ${feature} configuration updated`);
  }

  /**
   * Get feature configuration
   */
  public getFeatureConfig(feature: string): FeatureConfig | null {
    const flag = this.features.get(feature);
    if (!flag) return null;

    return {
      enabled: flag.enabled,
      description: flag.description,
      conditions: flag.conditions,
      metadata: flag.metadata
    };
  }

  /**
   * Get feature flag details
   */
  public getFeatureFlag(feature: string): FeatureFlag | null {
    return this.features.get(feature) || null;
  }

  /**
   * Get all features
   */
  public getAllFeatures(): Map<string, FeatureFlag> {
    return new Map(this.features);
  }

  /**
   * Get enabled features
   */
  public getEnabledFeatures(context?: FeatureEvaluationContext): string[] {
    const enabled: string[] = [];

    for (const [name, flag] of this.features) {
      if (this.isEnabled(name, context)) {
        enabled.push(name);
      }
    }

    return enabled;
  }

  /**
   * Get disabled features
   */
  public getDisabledFeatures(): string[] {
    const disabled: string[] = [];

    for (const [name, flag] of this.features) {
      if (!flag.enabled) {
        disabled.push(name);
      }
    }

    return disabled;
  }

  /**
   * Create a new feature
   */
  public async createFeature(feature: string, config: FeatureConfig): Promise<void> {
    if (this.features.has(feature)) {
      throw new Error(`Feature ${feature} already exists`);
    }

    await this.updateFeatureConfig(feature, config, true); // Suppress events for new features
    this.logger.info(`Feature ${feature} created`);
  }

  /**
   * Remove a feature
   */
  public async removeFeature(feature: string): Promise<void> {
    const flag = this.features.get(feature);
    if (!flag) {
      throw new Error(`Feature ${feature} not found`);
    }

    this.features.delete(feature);
    this.clearCache(feature);

    // Emit change event
    if (this.featureConfig.enableEvents) {
      this.emitFeatureChange({
        feature,
        previousState: flag.enabled,
        newState: false,
        timestamp: new Date(),
        reason: 'Feature removed'
      });
    }

    this.updateStats();
    this.logger.info(`Feature ${feature} removed`);
  }

  /**
   * Check if feature exists
   */
  public hasFeature(feature: string): boolean {
    return this.features.has(feature);
  }

  /**
   * Get feature toggle statistics
   */
  public getStats(): FeatureToggleStats {
    return { ...this.stats };
  }

  /**
   * Clear evaluation cache
   */
  public clearCache(feature?: string): void {
    if (feature) {
      // Clear cache for specific feature
      const keysToDelete: string[] = [];
      for (const key of this.evaluationCache.keys()) {
        if (key.startsWith(`${feature}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.evaluationCache.delete(key));
    } else {
      // Clear all cache
      this.evaluationCache.clear();
    }

    this.logger.debug(`Cache cleared${feature ? ` for feature ${feature}` : ''}`);
  }

  /**
   * Subscribe to feature changes
   */
  public onFeatureChange(callback: FeatureChangeCallback): void {
    this.changeCallbacks.add(callback);
  }

  /**
   * Unsubscribe from feature changes
   */
  public offFeatureChange(callback: FeatureChangeCallback): void {
    this.changeCallbacks.delete(callback);
  }

  /**
   * Evaluate feature with context
   */
  public evaluateFeature(feature: string, context?: FeatureEvaluationContext): {
    enabled: boolean;
    reason: string;
    evaluatedAt: Date;
  } {
    const evaluatedAt = new Date();
    const flag = this.features.get(feature);

    if (!flag) {
      return {
        enabled: this.featureConfig.defaultEnabled,
        reason: 'Feature not found, using default',
        evaluatedAt
      };
    }

    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Feature disabled',
        evaluatedAt
      };
    }

    // Evaluate conditions
    const conditionResult = this.evaluateConditions(flag, context);

    return {
      enabled: conditionResult.enabled,
      reason: conditionResult.reason,
      evaluatedAt
    };
  }

  /**
   * Bulk update features
   */
  public async bulkUpdate(updates: Map<string, FeatureConfig>): Promise<void> {
    const errors: string[] = [];

    for (const [feature, config] of updates) {
      try {
        await this.updateFeatureConfig(feature, config);
      } catch (error) {
        errors.push(`${feature}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Bulk update failed for features: ${errors.join(', ')}`);
    }

    this.logger.info(`Bulk updated ${updates.size} features`);
  }

  /**
   * Export features configuration
   */
  public exportConfig(): Record<string, FeatureConfig> {
    const config: Record<string, FeatureConfig> = {};

    for (const [name, flag] of this.features) {
      config[name] = {
        enabled: flag.enabled,
        description: flag.description,
        conditions: flag.conditions,
        metadata: flag.metadata
      };
    }

    return config;
  }

  /**
   * Import features configuration
   */
  public async importConfig(config: Record<string, FeatureConfig>, merge = true): Promise<void> {
    if (!merge) {
      this.features.clear();
    }

    const updates = new Map<string, FeatureConfig>();
    for (const [feature, featureConfig] of Object.entries(config)) {
      updates.set(feature, featureConfig);
    }

    await this.bulkUpdate(updates);
    this.logger.info(`Imported ${Object.keys(config).length} features (merge: ${merge})`);
  }

  // Private helper methods

  private async updateFeatureState(feature: string, enabled: boolean, reason?: string): Promise<void> {
    const existingFlag = this.features.get(feature);

    if (!existingFlag) {
      // Create new feature
      await this.createFeature(feature, { enabled });
    } else {
      // Update existing feature
      const config: FeatureConfig = {
        enabled,
        description: existingFlag.description,
        conditions: existingFlag.conditions,
        metadata: existingFlag.metadata
      };
      await this.updateFeatureConfig(feature, config, false); // Don't suppress events for state changes
    }

    // Clear cache for dependent features
    this.clearDependentFeaturesCache(feature);
  }

  private clearDependentFeaturesCache(changedFeature: string): void {
    // Find all features that depend on the changed feature
    for (const [featureName, flag] of this.features) {
      if (flag.conditions?.dependencies?.includes(changedFeature)) {
        // Clear cache for this dependent feature
        this.clearCache(featureName);
      }
    }
  }

  private evaluateFeatureInternal(feature: string, context?: FeatureEvaluationContext): boolean {
    const flag = this.features.get(feature);

    if (!flag) {
      return this.featureConfig.defaultEnabled;
    }

    if (!flag.enabled) {
      return false;
    }

    // Evaluate conditions
    return this.evaluateConditions(flag, context).enabled;
  }

  private evaluateConditions(flag: FeatureFlag, context?: FeatureEvaluationContext): {
    enabled: boolean;
    reason: string;
  } {
    if (!flag.conditions) {
      return { enabled: true, reason: 'No conditions' };
    }

    const conditions = flag.conditions;

    // Check percentage rollout
    if (conditions.percentage !== undefined) {
      const random = Math.random() * 100;
      if (random > conditions.percentage) {
        return { enabled: false, reason: `Percentage rollout: ${random.toFixed(2)}% > ${conditions.percentage}%` };
      }
    }

    // Check user groups
    if (conditions.userGroups) {
      if (!context?.userGroups) {
        return { enabled: false, reason: 'User groups required but not provided in context' };
      }

      const hasMatchingGroup = conditions.userGroups.some(group =>
        context.userGroups!.includes(group)
      );
      if (!hasMatchingGroup) {
        return { enabled: false, reason: 'User not in target groups' };
      }
    }

    // Check time window
    if (conditions.timeWindow) {
      const now = context?.timestamp || new Date();
      if (conditions.timeWindow.start && now < conditions.timeWindow.start) {
        return { enabled: false, reason: 'Before time window start' };
      }
      if (conditions.timeWindow.end && now > conditions.timeWindow.end) {
        return { enabled: false, reason: 'After time window end' };
      }
    }

    // Check environment
    if (conditions.environments && context?.environment) {
      if (!conditions.environments.includes(context.environment)) {
        return { enabled: false, reason: 'Environment not in allowed list' };
      }
    }

    // Check dependencies
    if (conditions.dependencies) {
      for (const dependency of conditions.dependencies) {
        if (!this.isEnabled(dependency, context)) {
          return { enabled: false, reason: `Dependency ${dependency} not enabled` };
        }
      }
    }

    return { enabled: true, reason: 'All conditions met' };
  }

  private getCacheKey(feature: string, context?: FeatureEvaluationContext): string {
    if (!context) {
      return `${feature}:default`;
    }

    const contextKey = [
      context.userId || '',
      (context.userGroups || []).sort().join(','),
      context.environment || '',
      context.timestamp?.getTime() || ''
    ].join('|');

    return `${feature}:${contextKey}`;
  }

  private isCacheValid(timestamp: Date): boolean {
    const now = new Date();
    return (now.getTime() - timestamp.getTime()) < this.featureConfig.cacheTtl;
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every minute
    setInterval(() => {
      const now = new Date();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.evaluationCache) {
        if ((now.getTime() - entry.timestamp.getTime()) > this.featureConfig.cacheTtl) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.evaluationCache.delete(key));

      if (keysToDelete.length > 0) {
        this.logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
      }
    }, 60000); // Run every minute
  }

  private emitFeatureChange(event: FeatureChangeEvent): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in feature change callback:', error);
      }
    }
  }

  private updateStats(): void {
    this.stats.totalFeatures = this.features.size;
    this.stats.enabledFeatures = 0;
    this.stats.disabledFeatures = 0;
    this.stats.conditionalFeatures = 0;

    for (const flag of this.features.values()) {
      if (flag.enabled) {
        this.stats.enabledFeatures++;
      } else {
        this.stats.disabledFeatures++;
      }

      if (flag.conditions) {
        this.stats.conditionalFeatures++;
      }
    }
  }

  private async loadFeaturesFromConfig(togglesConfig: any[]): Promise<void> {
    for (const toggle of togglesConfig) {
      if (toggle.name) {
        const config: FeatureConfig = {
          enabled: toggle.enabled || false,
          description: toggle.description,
          conditions: toggle.conditions,
          metadata: toggle.metadata
        };

        await this.updateFeatureConfig(toggle.name, config);
      }
    }
  }
}