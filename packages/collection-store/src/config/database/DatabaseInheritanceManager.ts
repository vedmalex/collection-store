import { BaseConfigurationComponent } from "../registry/BaseConfigurationComponent";
import {
  IDatabaseInheritanceManager,
  DatabaseConfig,
  CollectionConfigOverride,
  ResolvedConfig,
  InheritanceStep,
  InheritanceRule,
  InheritanceContext,
  InheritanceValidationResult,
  DatabaseInheritanceStats,
  ConfigurationChangeEvent,
  ConfigurationChangeCallback,
  DatabaseInheritanceManagerConfig,
  InheritancePriority,
  ConfigurationScope
} from './interfaces/IDatabaseInheritanceManager';
import { ComponentHealth, ComponentStatus } from '../registry/interfaces/IConfigurationComponent';

/**
 * Database Inheritance Manager
 *
 * Manages hierarchical configuration inheritance for databases and collections.
 * Supports system -> database -> collection -> runtime inheritance chain.
 */
export class DatabaseInheritanceManager extends BaseConfigurationComponent implements IDatabaseInheritanceManager {
  private databaseConfigs: Map<string, DatabaseConfig> = new Map();
  private collectionOverrides: Map<string, Map<string, CollectionConfigOverride>> = new Map();
  private inheritanceRules: Map<string, InheritanceRule> = new Map();
  private resolutionCache: Map<string, ResolvedConfig> = new Map();
  private changeCallbacks: Set<ConfigurationChangeCallback> = new Set();
  private inheritanceConfig: DatabaseInheritanceManagerConfig;

  // System-wide default configuration
  private systemDefaults: Partial<DatabaseConfig> = {
    performance: {
      maxConnections: 100,
      connectionTimeout: 30000,
      queryTimeout: 60000,
      batchSize: 1000,
      cacheSize: 10485760 // 10MB
    },
    security: {
      encryption: false,
      accessControl: true,
      auditLogging: false,
      dataClassification: 'internal'
    },
    validation: {
      strictMode: false,
      schemaValidation: true,
      dataTypeValidation: true,
      customValidators: []
    },
    replication: {
      enabled: false,
      strategy: 'master-slave',
      syncInterval: 60000,
      conflictResolution: 'last-write-wins'
    },
    caching: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      strategy: 'lru'
    },
    monitoring: {
      enabled: true,
      metricsCollection: true,
      alerting: false,
      logLevel: 'info'
    },
    backup: {
      enabled: false,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: 30,
      compression: true
    },
    indexing: {
      autoIndexing: true,
      indexStrategy: 'btree',
      rebuildThreshold: 0.3
    }
  };

  constructor(config?: Partial<DatabaseInheritanceManagerConfig>) {
    super(
      'database-inheritance-manager',
      'DatabaseInheritanceManager',
      'Database Inheritance Manager',
      '1.0.0',
      'Manages hierarchical configuration inheritance for databases and collections'
    );

    this.inheritanceConfig = {
      enableInheritance: true,
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      enableEvents: true,
      enableValidation: true,
      defaultInheritanceRules: [],
      resolutionTimeout: 5000,
      ...config
    };

    this.initializeDefaultRules();
  }

  /**
   * Initialize default inheritance rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: InheritanceRule[] = [
      {
        name: 'performance-inheritance',
        description: 'Inherit performance settings with collection overrides',
        scope: 'performance',
        condition: () => true,
        priority: 1,
        enabled: true
      },
      {
        name: 'security-strict-inheritance',
        description: 'Security settings can only be made more strict',
        scope: 'security',
        condition: () => true,
        transformer: (value: any, context: InheritanceContext) => {
          if (context.parentValue && context.currentValue) {
            return {
              encryption: context.currentValue.encryption || context.parentValue.encryption,
              accessControl: context.currentValue.accessControl !== false ? context.parentValue.accessControl : false,
              auditLogging: context.currentValue.auditLogging || context.parentValue.auditLogging,
              dataClassification: this.getStricterClassification(
                context.currentValue.dataClassification,
                context.parentValue.dataClassification
              )
            };
          }
          return value;
        },
        priority: 2,
        enabled: true
      },
      {
        name: 'validation-inheritance',
        description: 'Validation settings with additive custom validators',
        scope: 'validation',
        condition: () => true,
        transformer: (value: any, context: InheritanceContext) => {
          if (context.parentValue && context.currentValue) {
            return {
              ...context.parentValue,
              ...context.currentValue,
              customValidators: [
                ...(context.parentValue.customValidators || []),
                ...(context.currentValue.customValidators || [])
              ]
            };
          }
          return value;
        },
        priority: 1,
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.inheritanceRules.set(rule.name, rule));
  }

  /**
   * Get stricter data classification
   */
  private getStricterClassification(current?: string, parent?: string): string {
    const hierarchy = ['public', 'internal', 'confidential', 'restricted'];
    const currentIndex = current ? hierarchy.indexOf(current) : 0;
    const parentIndex = parent ? hierarchy.indexOf(parent) : 0;
    return hierarchy[Math.max(currentIndex, parentIndex)] || 'internal';
  }

  /**
   * Set database-level configuration
   */
  async setDatabaseConfig(databaseId: string, config: Partial<DatabaseConfig>): Promise<void> {
    const existingConfig = this.databaseConfigs.get(databaseId);
    const now = new Date();

    const fullConfig: DatabaseConfig = {
      databaseId,
      name: config.name || databaseId,
      description: config.description,
      ...config,
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now
    };

    // Validate configuration if enabled
    if (this.inheritanceConfig.enableValidation) {
      const validation = await this.validateConfiguration(fullConfig);
      if (!validation.valid) {
        throw new Error(`Invalid database configuration: ${validation.errors.join(', ')}`);
      }
    }

    const oldConfig = this.databaseConfigs.get(databaseId);
    this.databaseConfigs.set(databaseId, fullConfig);

    // Clear related cache entries
    this.clearCacheForDatabase(databaseId);

    // Emit change event
    if (this.inheritanceConfig.enableEvents) {
      this.emitConfigurationChange({
        type: 'DATABASE_CONFIG_UPDATED',
        databaseId,
        changes: this.getConfigChanges(oldConfig, fullConfig),
        timestamp: now,
        source: 'DatabaseInheritanceManager'
      });
    }
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(databaseId: string): DatabaseConfig | null {
    return this.databaseConfigs.get(databaseId) || null;
  }

  /**
   * Get all database configurations
   */
  getAllDatabaseConfigs(): Map<string, DatabaseConfig> {
    return new Map(this.databaseConfigs);
  }

  /**
   * Add collection-level configuration override
   */
  async addCollectionOverride(
    databaseId: string,
    collectionId: string,
    overrides: Partial<DatabaseConfig>,
    priority: InheritancePriority = InheritancePriority.COLLECTION,
    reason?: string
  ): Promise<void> {
    if (!this.databaseConfigs.has(databaseId)) {
      throw new Error(`Database ${databaseId} not found`);
    }

    const now = new Date();
    const override: CollectionConfigOverride = {
      collectionId,
      databaseId,
      overrides,
      priority,
      reason,
      createdAt: now,
      updatedAt: now
    };

    // Validate override if enabled
    if (this.inheritanceConfig.enableValidation) {
      const validation = await this.validateOverride(override);
      if (!validation.valid) {
        throw new Error(`Invalid collection override: ${validation.errors.join(', ')}`);
      }
    }

    if (!this.collectionOverrides.has(databaseId)) {
      this.collectionOverrides.set(databaseId, new Map());
    }

    this.collectionOverrides.get(databaseId)!.set(collectionId, override);

    // Clear related cache entries
    this.clearCacheForCollection(databaseId, collectionId);

    // Emit change event
    if (this.inheritanceConfig.enableEvents) {
      this.emitConfigurationChange({
        type: 'COLLECTION_OVERRIDE_ADDED',
        databaseId,
        collectionId,
        changes: { override: { oldValue: null, newValue: override } },
        timestamp: now,
        source: 'DatabaseInheritanceManager'
      });
    }
  }

  /**
   * Remove collection-level configuration override
   */
  async removeCollectionOverride(databaseId: string, collectionId: string): Promise<void> {
    const databaseOverrides = this.collectionOverrides.get(databaseId);
    if (!databaseOverrides) {
      return;
    }

    const oldOverride = databaseOverrides.get(collectionId);
    if (!oldOverride) {
      return;
    }

    databaseOverrides.delete(collectionId);
    if (databaseOverrides.size === 0) {
      this.collectionOverrides.delete(databaseId);
    }

    // Clear related cache entries
    this.clearCacheForCollection(databaseId, collectionId);

    // Emit change event
    if (this.inheritanceConfig.enableEvents) {
      this.emitConfigurationChange({
        type: 'COLLECTION_OVERRIDE_REMOVED',
        databaseId,
        collectionId,
        changes: { override: { oldValue: oldOverride, newValue: null } },
        timestamp: new Date(),
        source: 'DatabaseInheritanceManager'
      });
    }
  }

  /**
   * Get collection override
   */
  getCollectionOverride(databaseId: string, collectionId: string): CollectionConfigOverride | null {
    return this.collectionOverrides.get(databaseId)?.get(collectionId) || null;
  }

  /**
   * Get all collection overrides for a database
   */
  getCollectionOverrides(databaseId: string): Map<string, CollectionConfigOverride> {
    return new Map(this.collectionOverrides.get(databaseId) || new Map());
  }

  /**
   * Resolve effective configuration for a collection
   */
  async resolveEffectiveConfig(databaseId: string, collectionId?: string): Promise<ResolvedConfig> {
    const cacheKey = `${databaseId}:${collectionId || 'database'}`;

    // Check cache if enabled
    if (this.inheritanceConfig.enableCaching) {
      const cached = this.resolutionCache.get(cacheKey);
      if (cached && (Date.now() - cached.resolutionTimestamp.getTime()) < this.inheritanceConfig.cacheTimeout) {
        return cached;
      }
    }

    const inheritanceChain: InheritanceStep[] = [];
    let resolvedConfig: DatabaseConfig = { ...this.systemDefaults } as DatabaseConfig;

    // Step 1: Apply system defaults
    this.addInheritanceSteps(inheritanceChain, 'SYSTEM', InheritancePriority.SYSTEM, this.systemDefaults);

    // Step 2: Apply database configuration
    const databaseConfig = this.databaseConfigs.get(databaseId);
    if (databaseConfig) {
      resolvedConfig = this.mergeConfigurations(resolvedConfig, databaseConfig, inheritanceChain, 'DATABASE');
    }

    // Step 3: Apply collection overrides if specified
    if (collectionId) {
      const collectionOverride = this.collectionOverrides.get(databaseId)?.get(collectionId);
      if (collectionOverride) {
        resolvedConfig = this.mergeConfigurations(
          resolvedConfig,
          collectionOverride.overrides,
          inheritanceChain,
          'COLLECTION'
        );
      }
    }

    // Apply inheritance rules
    if (this.inheritanceConfig.enableInheritance) {
      resolvedConfig = await this.applyInheritanceRules(resolvedConfig, databaseId, collectionId);
    }

    const result: ResolvedConfig = {
      databaseId,
      collectionId,
      finalConfig: resolvedConfig,
      inheritanceChain,
      resolutionTimestamp: new Date()
    };

    // Cache result if enabled
    if (this.inheritanceConfig.enableCaching) {
      this.resolutionCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Get configuration value with inheritance
   */
  async getConfigValue<T>(
    databaseId: string,
    configPath: string,
    collectionId?: string
  ): Promise<T | undefined> {
    const resolved = await this.resolveEffectiveConfig(databaseId, collectionId);
    return this.getNestedValue(resolved.finalConfig, configPath);
  }

  /**
   * Validate configuration inheritance
   */
  async validateInheritance(databaseId: string, collectionId?: string): Promise<InheritanceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const resolved = await this.resolveEffectiveConfig(databaseId, collectionId);

      // Validate resolved configuration
      const configValidation = await this.validateConfiguration(resolved.finalConfig);
      errors.push(...configValidation.errors);
      warnings.push(...configValidation.warnings);
      suggestions.push(...configValidation.suggestions);

      // Check for inheritance conflicts
      const conflicts = this.detectInheritanceConflicts(resolved.inheritanceChain);
      warnings.push(...conflicts);

    } catch (error) {
      errors.push(`Inheritance resolution failed: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Add inheritance rule
   */
  addInheritanceRule(rule: InheritanceRule): void {
    this.inheritanceRules.set(rule.name, rule);
    this.clearResolutionCache(); // Clear cache as rules changed

    if (this.inheritanceConfig.enableEvents) {
      this.emitConfigurationChange({
        type: 'INHERITANCE_RULE_CHANGED',
        databaseId: 'system',
        changes: { rule: { oldValue: null, newValue: rule } },
        timestamp: new Date(),
        source: 'DatabaseInheritanceManager'
      });
    }
  }

  /**
   * Remove inheritance rule
   */
  removeInheritanceRule(ruleName: string): void {
    const oldRule = this.inheritanceRules.get(ruleName);
    if (this.inheritanceRules.delete(ruleName)) {
      this.clearResolutionCache(); // Clear cache as rules changed

      if (this.inheritanceConfig.enableEvents && oldRule) {
        this.emitConfigurationChange({
          type: 'INHERITANCE_RULE_CHANGED',
          databaseId: 'system',
          changes: { rule: { oldValue: oldRule, newValue: null } },
          timestamp: new Date(),
          source: 'DatabaseInheritanceManager'
        });
      }
    }
  }

  /**
   * Get all inheritance rules
   */
  getInheritanceRules(): InheritanceRule[] {
    return Array.from(this.inheritanceRules.values());
  }

  /**
   * Clear resolution cache
   */
  clearResolutionCache(): void {
    this.resolutionCache.clear();
  }

  /**
   * Get inheritance statistics
   */
  getStats(): DatabaseInheritanceStats {
    const collectionsWithOverrides = Array.from(this.collectionOverrides.values())
      .reduce((total, overrides) => total + overrides.size, 0);

    const lastResolution = Array.from(this.resolutionCache.values())
      .sort((a, b) => b.resolutionTimestamp.getTime() - a.resolutionTimestamp.getTime())[0];

    return {
      totalDatabases: this.databaseConfigs.size,
      configuredDatabases: this.databaseConfigs.size,
      totalCollections: collectionsWithOverrides,
      collectionsWithOverrides,
      inheritanceRulesCount: this.inheritanceRules.size,
      resolutionCacheSize: this.resolutionCache.size,
      lastResolutionTime: lastResolution?.resolutionTimestamp,
      averageResolutionTime: 0 // Would need to track timing
    };
  }

  /**
   * Subscribe to configuration change events
   */
  onConfigurationChange(callback: ConfigurationChangeCallback): void {
    this.changeCallbacks.add(callback);
  }

  /**
   * Unsubscribe from configuration change events
   */
  offConfigurationChange(callback: ConfigurationChangeCallback): void {
    this.changeCallbacks.delete(callback);
  }

  /**
   * Export database configurations
   */
  exportConfigurations(): {
    databases: Record<string, DatabaseConfig>;
    overrides: Record<string, Record<string, CollectionConfigOverride>>;
  } {
    const databases: Record<string, DatabaseConfig> = {};
    this.databaseConfigs.forEach((config, id) => {
      databases[id] = config;
    });

    const overrides: Record<string, Record<string, CollectionConfigOverride>> = {};
    this.collectionOverrides.forEach((collectionMap, databaseId) => {
      overrides[databaseId] = {};
      collectionMap.forEach((override, collectionId) => {
        overrides[databaseId][collectionId] = override;
      });
    });

    return { databases, overrides };
  }

  /**
   * Import database configurations
   */
  async importConfigurations(data: {
    databases: Record<string, DatabaseConfig>;
    overrides: Record<string, Record<string, CollectionConfigOverride>>;
  }, merge: boolean = false): Promise<void> {
    if (!merge) {
      this.databaseConfigs.clear();
      this.collectionOverrides.clear();
      this.clearResolutionCache();
    }

    // Import databases
    for (const [databaseId, config] of Object.entries(data.databases)) {
      await this.setDatabaseConfig(databaseId, config);
    }

    // Import overrides
    for (const [databaseId, overrides] of Object.entries(data.overrides)) {
      for (const [collectionId, override] of Object.entries(overrides)) {
        await this.addCollectionOverride(
          databaseId,
          collectionId,
          override.overrides,
          override.priority,
          override.reason
        );
      }
    }
  }

  /**
   * Bulk update database configurations
   */
  async bulkUpdateDatabaseConfigs(
    updates: Map<string, Partial<DatabaseConfig>>
  ): Promise<void> {
    for (const [databaseId, config] of updates) {
      await this.setDatabaseConfig(databaseId, config);
    }
  }

  /**
   * Bulk update collection overrides
   */
  async bulkUpdateCollectionOverrides(
    updates: Map<string, Map<string, Partial<DatabaseConfig>>>
  ): Promise<void> {
    for (const [databaseId, collections] of updates) {
      for (const [collectionId, overrides] of collections) {
        await this.addCollectionOverride(databaseId, collectionId, overrides);
      }
    }
  }

  /**
   * Get configuration hierarchy for debugging
   */
  async getConfigurationHierarchy(databaseId: string, collectionId?: string): Promise<{
    system: any;
    database: DatabaseConfig | null;
    collection: CollectionConfigOverride | null;
    resolved: ResolvedConfig;
  }> {
    return {
      system: this.systemDefaults,
      database: this.getDatabaseConfig(databaseId),
      collection: collectionId ? this.getCollectionOverride(databaseId, collectionId) : null,
      resolved: await this.resolveEffectiveConfig(databaseId, collectionId)
    };
  }

  /**
   * Force refresh of all configurations
   */
  async refreshAllConfigurations(): Promise<void> {
    this.clearResolutionCache();

    // Re-validate all configurations
    if (this.inheritanceConfig.enableValidation) {
      for (const [databaseId, config] of this.databaseConfigs) {
        const validation = await this.validateConfiguration(config);
        if (!validation.valid) {
          console.warn(`Database ${databaseId} configuration validation failed:`, validation.errors);
        }
      }
    }
  }

  // Protected methods for BaseConfigurationComponent

    protected async doInitialize(config: any): Promise<void> {
    console.log('Initializing DatabaseInheritanceManager');

    // Initialize with default system configuration
    this.initializeDefaultRules();

    console.log('DatabaseInheritanceManager initialized successfully');
  }

  protected async doStart(): Promise<void> {
    console.log('Starting DatabaseInheritanceManager');
    // No specific start logic needed
  }

  protected async doStop(): Promise<void> {
    console.log('Stopping DatabaseInheritanceManager');
    this.clearResolutionCache();
    this.changeCallbacks.clear();
  }

  protected async doGetHealth(): Promise<Partial<ComponentHealth>> {
    const stats = this.getStats();
    const cacheHitRate = this.resolutionCache.size > 0 ? 0.85 : 0; // Simulated cache hit rate

    let status = ComponentStatus.HEALTHY;
    const details: Record<string, any> = {
      databases: stats.totalDatabases,
      collections: stats.totalCollections,
      rules: stats.inheritanceRulesCount,
      cacheSize: stats.resolutionCacheSize,
      cacheHitRate
    };

    if (stats.totalDatabases === 0) {
      status = ComponentStatus.WARNING;
      details.warning = 'No databases configured';
    }

    if (cacheHitRate < 0.5 && this.inheritanceConfig.enableCaching) {
      status = ComponentStatus.WARNING;
      details.warning = 'Low cache hit rate';
    }

    return {
      status,
      details
    };
  }

  protected async doUpdateConfig(newConfig: any, oldConfig: any): Promise<void> {
    if (newConfig.inheritanceConfig) {
      this.inheritanceConfig = { ...this.inheritanceConfig, ...newConfig.inheritanceConfig };
      this.clearResolutionCache(); // Clear cache as configuration changed
    }
  }

  protected async doCleanup(): Promise<void> {
    console.log('Cleaning up DatabaseInheritanceManager');
    this.clearResolutionCache();
    this.changeCallbacks.clear();
    this.databaseConfigs.clear();
    this.collectionOverrides.clear();
    this.inheritanceRules.clear();
  }

  // Private helper methods

  private addInheritanceSteps(
    chain: InheritanceStep[],
    source: 'SYSTEM' | 'DATABASE' | 'COLLECTION' | 'RUNTIME',
    priority: InheritancePriority,
    config: any
  ): void {
    const scopes: ConfigurationScope[] = [
      'performance', 'security', 'validation', 'replication',
      'caching', 'monitoring', 'backup', 'indexing'
    ];

    scopes.forEach(scope => {
      if (config[scope]) {
        chain.push({
          source,
          priority,
          configSection: scope,
          value: config[scope],
          overridden: false
        });
      }
    });
  }

  private mergeConfigurations(
    base: DatabaseConfig,
    override: Partial<DatabaseConfig>,
    chain: InheritanceStep[],
    source: 'DATABASE' | 'COLLECTION'
  ): DatabaseConfig {
    const result = { ...base };

    Object.keys(override).forEach(key => {
      if (key in base && override[key] !== undefined) {
        result[key] = { ...base[key], ...override[key] };

        // Mark previous steps as overridden
        chain.forEach(step => {
          if (step.configSection === key) {
            step.overridden = true;
          }
        });

        // Add new step
        chain.push({
          source,
          priority: source === 'DATABASE' ? InheritancePriority.DATABASE : InheritancePriority.COLLECTION,
          configSection: key as ConfigurationScope,
          value: override[key],
          overridden: false
        });
      }
    });

    return result;
  }

  private async applyInheritanceRules(
    config: DatabaseConfig,
    databaseId: string,
    collectionId?: string
  ): Promise<DatabaseConfig> {
    let result = { ...config };

    const sortedRules = Array.from(this.inheritanceRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const context: InheritanceContext = {
        databaseId,
        collectionId,
        configScope: rule.scope,
        currentValue: result[rule.scope],
        parentValue: this.systemDefaults[rule.scope]
      };

      if (rule.condition(context)) {
        if (rule.transformer) {
          result[rule.scope] = rule.transformer(result[rule.scope], context);
        }
      }
    }

    return result;
  }

  private async validateConfiguration(config: DatabaseConfig): Promise<InheritanceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!config.databaseId) {
      errors.push('Database ID is required');
    }

    if (!config.name) {
      errors.push('Database name is required');
    }

    // Performance validation
    if (config.performance) {
      if (config.performance.maxConnections && config.performance.maxConnections < 1) {
        errors.push('Max connections must be at least 1');
      }
      if (config.performance.connectionTimeout && config.performance.connectionTimeout < 1000) {
        warnings.push('Connection timeout less than 1 second may cause issues');
      }
    }

    // Security validation
    if (config.security) {
      if (config.security.encryption === false && config.security.dataClassification === 'restricted') {
        warnings.push('Restricted data should use encryption');
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private async validateOverride(override: CollectionConfigOverride): Promise<InheritanceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!override.collectionId) {
      errors.push('Collection ID is required');
    }

    if (!override.databaseId) {
      errors.push('Database ID is required');
    }

    if (!override.overrides || Object.keys(override.overrides).length === 0) {
      warnings.push('Override contains no configuration changes');
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private detectInheritanceConflicts(chain: InheritanceStep[]): string[] {
    const conflicts: string[] = [];
    const sectionCounts = new Map<ConfigurationScope, number>();

    chain.forEach(step => {
      sectionCounts.set(step.configSection, (sectionCounts.get(step.configSection) || 0) + 1);
    });

    sectionCounts.forEach((count, section) => {
      if (count > 3) { // System, Database, Collection
        conflicts.push(`Configuration section '${section}' has ${count} inheritance levels`);
      }
    });

    return conflicts;
  }

  private clearCacheForDatabase(databaseId: string): void {
    const keysToDelete = Array.from(this.resolutionCache.keys())
      .filter(key => key.startsWith(`${databaseId}:`));

    keysToDelete.forEach(key => this.resolutionCache.delete(key));
  }

  private clearCacheForCollection(databaseId: string, collectionId: string): void {
    this.resolutionCache.delete(`${databaseId}:${collectionId}`);
  }

  private getConfigChanges(oldConfig: any, newConfig: any): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    Object.keys(newConfig).forEach(key => {
      if (JSON.stringify(oldConfig?.[key]) !== JSON.stringify(newConfig[key])) {
        changes[key] = {
          oldValue: oldConfig?.[key],
          newValue: newConfig[key]
        };
      }
    });

    return changes;
  }

  private emitConfigurationChange(event: ConfigurationChangeEvent): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in configuration change callback:', error);
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
