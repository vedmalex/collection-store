/**
 * Browser Fallback Manager Implementation
 * Manages automatic fallback strategies when browser storage quotas are exceeded
 */

import { BaseConfigurationComponent } from '../registry/BaseConfigurationComponent';
import { ComponentHealth } from '../registry/interfaces/IConfigurationComponent';
import {
  IBrowserFallbackManager,
  FallbackStrategy,
  StorageType,
  QuotaStatus,
  StorageQuotaInfo,
  FallbackRule,
  FallbackExecution,
  FallbackStep,
  FallbackResult,
  BrowserFallbackStats,
  QuotaMonitoringConfig,
  BrowserFallbackEvent,
  BrowserFallbackManagerConfig
} from './interfaces/IBrowserFallbackManager';

export class BrowserFallbackManager extends BaseConfigurationComponent implements IBrowserFallbackManager {
  protected config: BrowserFallbackManagerConfig;
  private fallbackRules: Map<string, FallbackRule> = new Map();
  private activeExecutions: Map<string, FallbackExecution> = new Map();
  private executionHistory: FallbackExecution[] = [];
  private statistics: BrowserFallbackStats;
  private eventCallbacks: Map<string, Set<Function>> = new Map();
  private quotaMonitoringInterval?: NodeJS.Timeout;
  private isMonitoringActive = false;

  constructor(
    id: string,
    name: string,
    description: string,
    version: string,
    dependencies: string[]
  ) {
    super(id, 'browser-fallback', name, version, description, dependencies);

    this.statistics = this.initializeStatistics();
    this.config = this.getDefaultConfig();
  }

  // Lifecycle Methods
  protected override async doInitialize(config?: any): Promise<void> {
    console.log(`Initializing BrowserFallbackManager: ${this.id}`);

    // Initialize config with provided config or default
    if (config?.browser?.fallback) {
      this.config = { ...this.getDefaultConfig(), ...config.browser.fallback };
    } else if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    // Load default fallback rules
    await this.loadDefaultFallbackRules();

    // Initialize browser storage detection
    await this.detectAvailableStorageTypes();

    console.log(`BrowserFallbackManager initialized with ${this.fallbackRules.size} rules`);
  }

  protected override async doStart(): Promise<void> {
    console.log(`Starting BrowserFallbackManager: ${this.id}`);

    if (this.config.monitoring.enabled) {
      await this.startQuotaMonitoring();
    }

    console.log(`BrowserFallbackManager started`);
  }

  protected override async doStop(): Promise<void> {
    console.log(`Stopping BrowserFallbackManager: ${this.id}`);

    await this.stopQuotaMonitoring();

    // Cancel all active executions
    for (const execution of this.activeExecutions.values()) {
      if (execution.execution.status === 'running') {
        await this.cancelFallbackExecution(execution.id);
      }
    }

    console.log(`BrowserFallbackManager stopped`);
  }

  protected override async doGetHealth(): Promise<Partial<ComponentHealth>> {
    const quotaStatuses = await this.getAllQuotaStatuses();
    const activeExecutionsCount = this.activeExecutions.size;
    const enabledRulesCount = Array.from(this.fallbackRules.values()).filter(rule => rule.enabled).length;

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for critical quota status
    const criticalStorages = Object.entries(quotaStatuses).filter(([_, status]) => status === QuotaStatus.CRITICAL);
    if (criticalStorages.length > 0) {
      issues.push(`Critical quota status detected for: ${criticalStorages.map(([type]) => type).join(', ')}`);
      recommendations.push('Consider triggering fallback strategies for critical storages');
    }

    // Check monitoring status
    if (this.config.monitoring.enabled && !this.isMonitoringActive) {
      issues.push('Quota monitoring is enabled but not active');
      recommendations.push('Restart quota monitoring');
    }

    // Check for failed executions
    const recentFailures = this.executionHistory
      .filter(exec => exec.execution.status === 'failed')
      .filter(exec => Date.now() - exec.execution.startTime.getTime() < 3600000); // last hour

    if (recentFailures.length > 0) {
      issues.push(`${recentFailures.length} failed fallback executions in the last hour`);
      recommendations.push('Review fallback rule configurations and error logs');
    }

    const status = issues.length === 0 ? 'healthy' :
                  criticalStorages.length > 0 ? 'critical' : 'warning';

    return {
      status: status as any,
      details: {
        monitoring: this.isMonitoringActive,
        quotaStatus: quotaStatuses,
        activeExecutions: activeExecutionsCount,
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + this.config.monitoring.checkInterval),
        rulesCount: this.fallbackRules.size,
        enabledRulesCount,
        issues,
        recommendations
      }
    };
  }

  protected override async doUpdateConfig(newConfig: any): Promise<void> {
    const browserConfig = newConfig.browser?.fallback;
    if (browserConfig) {
      await this.updateConfig(browserConfig);
    }
  }

  protected override async doCleanup(): Promise<void> {
    await this.stopQuotaMonitoring();
    this.fallbackRules.clear();
    this.activeExecutions.clear();
    this.eventCallbacks.clear();
  }

  // Configuration Methods
  async updateConfig(config: Partial<BrowserFallbackManagerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    if (config.monitoring && this.isMonitoringActive) {
      await this.stopQuotaMonitoring();
      await this.startQuotaMonitoring();
    }

    if (config.fallbackRules) {
      this.fallbackRules.clear();
      for (const rule of config.fallbackRules) {
        this.fallbackRules.set(rule.id, rule);
      }
    }

    this.emit('config_updated', { config: this.config });
  }

  getConfig(): BrowserFallbackManagerConfig {
    return { ...this.config };
  }

  // Health method for IBrowserFallbackManager interface
  async getHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'error';
    details: {
      monitoring: boolean;
      quotaStatus: Record<StorageType, QuotaStatus>;
      activeExecutions: number;
      lastCheck: Date;
      nextCheck: Date;
      rulesCount: number;
      enabledRulesCount: number;
    };
    issues: string[];
    recommendations: string[];
  }> {
    const health = await this.doGetHealth();
    return {
      status: health.status as any || 'healthy',
      details: health.details as any,
      issues: (health.details as any)?.issues || [],
      recommendations: (health.details as any)?.recommendations || []
    };
  }

  // Quota Monitoring Methods
  async checkQuotaStatus(): Promise<StorageQuotaInfo[]> {
    const storageTypes = [
      StorageType.LOCAL_STORAGE,
      StorageType.SESSION_STORAGE,
      StorageType.INDEXED_DB
    ];

    const quotaInfos: StorageQuotaInfo[] = [];

    for (const storageType of storageTypes) {
      try {
        const quotaInfo = await this.getQuotaStatus(storageType);
        quotaInfos.push(quotaInfo);
      } catch (error) {
        console.error(`Failed to check quota for ${storageType}:`, error);
        quotaInfos.push({
          type: storageType,
          used: 0,
          available: 0,
          total: 0,
          percentage: 0,
          status: QuotaStatus.UNKNOWN,
          lastChecked: new Date()
        });
      }
    }

    return quotaInfos;
  }

  async getQuotaStatus(storageType: StorageType): Promise<StorageQuotaInfo> {
    let used = 0;
    let total = 0;
    let available = 0;

    try {
      switch (storageType) {
        case StorageType.LOCAL_STORAGE:
          if (typeof localStorage !== 'undefined') {
            used = this.calculateStorageUsage(localStorage);
            total = this.estimateStorageLimit('localStorage');
          }
          break;

        case StorageType.SESSION_STORAGE:
          if (typeof sessionStorage !== 'undefined') {
            used = this.calculateStorageUsage(sessionStorage);
            total = this.estimateStorageLimit('sessionStorage');
          }
          break;

        case StorageType.INDEXED_DB:
          if ('navigator' in globalThis && 'storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            used = estimate.usage || 0;
            total = estimate.quota || 0;
          }
          break;

        default:
          throw new Error(`Unsupported storage type: ${storageType}`);
      }

      available = Math.max(0, total - used);
      const percentage = total > 0 ? (used / total) * 100 : 0;

      let status: QuotaStatus;
      if (percentage >= this.config.monitoring.criticalThreshold) {
        status = QuotaStatus.CRITICAL;
      } else if (percentage >= this.config.monitoring.warningThreshold) {
        status = QuotaStatus.WARNING;
      } else {
        status = QuotaStatus.AVAILABLE;
      }

      return {
        type: storageType,
        used,
        available,
        total,
        percentage,
        status,
        lastChecked: new Date()
      };

    } catch (error) {
      console.error(`Error checking quota for ${storageType}:`, error);
      return {
        type: storageType,
        used: 0,
        available: 0,
        total: 0,
        percentage: 0,
        status: QuotaStatus.UNKNOWN,
        lastChecked: new Date()
      };
    }
  }

  async startQuotaMonitoring(): Promise<void> {
    if (this.isMonitoringActive) {
      return;
    }

    this.isMonitoringActive = true;

    const monitorQuota = async () => {
      try {
        const quotaInfos = await this.checkQuotaStatus();

        for (const quotaInfo of quotaInfos) {
          if (quotaInfo.status === QuotaStatus.WARNING) {
            this.emit('quota_warning', {
              type: 'quota_warning',
              timestamp: new Date(),
              data: { quotaInfo }
            });
          } else if (quotaInfo.status === QuotaStatus.CRITICAL) {
            this.emit('quota_critical', {
              type: 'quota_critical',
              timestamp: new Date(),
              data: { quotaInfo }
            });

            if (this.config.monitoring.autoFallback) {
              await this.triggerAutoFallback(quotaInfo);
            }
          }
        }

      } catch (error) {
        console.error('Error during quota monitoring:', error);
      }
    };

    // Initial check
    await monitorQuota();

    // Schedule periodic checks
    this.quotaMonitoringInterval = setInterval(monitorQuota, this.config.monitoring.checkInterval);
  }

  async stopQuotaMonitoring(): Promise<void> {
    this.isMonitoringActive = false;

    if (this.quotaMonitoringInterval) {
      clearInterval(this.quotaMonitoringInterval);
      this.quotaMonitoringInterval = undefined;
    }
  }

  isMonitoring(): boolean {
    return this.isMonitoringActive;
  }

  // Fallback Rules Management
  async addFallbackRule(rule: Omit<FallbackRule, 'id' | 'createdAt'>): Promise<string> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: FallbackRule = {
      ...rule,
      id,
      createdAt: new Date()
    };

    const validation = await this.validateFallbackRule(fullRule);
    if (!validation.valid) {
      throw new Error(`Invalid fallback rule: ${validation.errors.join(', ')}`);
    }

    this.fallbackRules.set(id, fullRule);
    return id;
  }

  async updateFallbackRule(ruleId: string, updates: Partial<FallbackRule>): Promise<void> {
    const existingRule = this.fallbackRules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Fallback rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates };
    const validation = await this.validateFallbackRule(updatedRule);
    if (!validation.valid) {
      throw new Error(`Invalid fallback rule update: ${validation.errors.join(', ')}`);
    }

    this.fallbackRules.set(ruleId, updatedRule);
  }

  async removeFallbackRule(ruleId: string): Promise<void> {
    if (!this.fallbackRules.has(ruleId)) {
      throw new Error(`Fallback rule not found: ${ruleId}`);
    }

    this.fallbackRules.delete(ruleId);
  }

  getFallbackRule(ruleId: string): FallbackRule | undefined {
    return this.fallbackRules.get(ruleId);
  }

  getAllFallbackRules(): FallbackRule[] {
    return Array.from(this.fallbackRules.values());
  }

  async enableFallbackRule(ruleId: string): Promise<void> {
    const rule = this.fallbackRules.get(ruleId);
    if (!rule) {
      throw new Error(`Fallback rule not found: ${ruleId}`);
    }

    rule.enabled = true;
    this.fallbackRules.set(ruleId, rule);
  }

  async disableFallbackRule(ruleId: string): Promise<void> {
    const rule = this.fallbackRules.get(ruleId);
    if (!rule) {
      throw new Error(`Fallback rule not found: ${ruleId}`);
    }

    rule.enabled = false;
    this.fallbackRules.set(ruleId, rule);
  }

  // Fallback Execution Methods
  async triggerFallback(strategy?: FallbackStrategy): Promise<FallbackResult> {
    const selectedStrategy = strategy || this.config.defaultStrategy;

    const execution = await this.createFallbackExecution(
      'manual_trigger',
      selectedStrategy,
      'Manual fallback trigger'
    );

    return await this.executeFallbackStrategy(execution, selectedStrategy);
  }

  async executeFallbackRule(ruleId: string): Promise<FallbackResult> {
    const rule = this.fallbackRules.get(ruleId);
    if (!rule) {
      throw new Error(`Fallback rule not found: ${ruleId}`);
    }

    if (!rule.enabled) {
      throw new Error(`Fallback rule is disabled: ${ruleId}`);
    }

    const execution = await this.createFallbackExecution(
      ruleId,
      rule.strategy,
      `Executing rule: ${rule.name}`
    );

    rule.lastUsed = new Date();
    this.fallbackRules.set(ruleId, rule);

    return await this.executeFallbackStrategy(execution, rule.strategy);
  }

  async cancelFallbackExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Fallback execution not found: ${executionId}`);
    }

    if (execution.execution.status !== 'running') {
      throw new Error(`Cannot cancel execution with status: ${execution.execution.status}`);
    }

    execution.execution.status = 'cancelled';
    execution.execution.endTime = new Date();

    this.activeExecutions.delete(executionId);
    this.executionHistory.push(execution);

    this.emit('fallback_cancelled', {
      type: 'fallback_cancelled',
      timestamp: new Date(),
      data: { execution }
    });
  }

  getFallbackExecution(executionId: string): FallbackExecution | undefined {
    return this.activeExecutions.get(executionId) ||
           this.executionHistory.find(exec => exec.id === executionId);
  }

  getActiveFallbackExecutions(): FallbackExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  getFallbackHistory(limit?: number): FallbackExecution[] {
    const history = [...this.executionHistory].sort(
      (a, b) => {
        const aTime = a.execution.startTime instanceof Date ?
          a.execution.startTime.getTime() :
          new Date(a.execution.startTime).getTime();
        const bTime = b.execution.startTime instanceof Date ?
          b.execution.startTime.getTime() :
          new Date(b.execution.startTime).getTime();
        return bTime - aTime;
      }
    );

    return limit ? history.slice(0, limit) : history;
  }

  // Strategy Implementation Methods
  async executeMemoryOnlyFallback(): Promise<FallbackResult> {
    // Implementation for memory-only fallback strategy
    const startTime = Date.now();

    try {
      // Clear non-critical data from persistent storage
      const quotaFreed = await this.clearNonCriticalData();

      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.MEMORY_ONLY,
        quotaFreed,
        dataRetained: 0,
        dataLost: quotaFreed,
        newQuotaStatus,
        recommendations: ['Consider using external storage for non-critical data'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`Memory-only fallback failed: ${error.message}`);
    }
  }

  async executeReducedCacheFallback(): Promise<FallbackResult> {
    // Implementation for reduced cache fallback strategy
    try {
      const quotaFreed = await this.reduceCacheSize();
      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.REDUCED_CACHE,
        quotaFreed,
        dataRetained: quotaFreed * 0.7, // Retain 70% of cache
        dataLost: quotaFreed * 0.3,
        newQuotaStatus,
        recommendations: ['Monitor cache performance after reduction'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`Reduced cache fallback failed: ${error.message}`);
    }
  }

  async executeExternalStorageFallback(): Promise<FallbackResult> {
    // Implementation for external storage fallback strategy
    try {
      const quotaFreed = await this.moveToExternalStorage();
      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.EXTERNAL_STORAGE,
        quotaFreed,
        dataRetained: quotaFreed,
        dataLost: 0,
        newQuotaStatus,
        recommendations: ['Verify external storage connectivity'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`External storage fallback failed: ${error.message}`);
    }
  }

  async executeCompressionFallback(): Promise<FallbackResult> {
    // Implementation for compression fallback strategy
    try {
      const quotaFreed = await this.compressStoredData();
      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.COMPRESSION,
        quotaFreed,
        dataRetained: quotaFreed,
        dataLost: 0,
        newQuotaStatus,
        recommendations: ['Monitor decompression performance'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`Compression fallback failed: ${error.message}`);
    }
  }

  async executeSelectiveCleanupFallback(): Promise<FallbackResult> {
    // Implementation for selective cleanup fallback strategy
    try {
      const quotaFreed = await this.performSelectiveCleanup();
      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.SELECTIVE_CLEANUP,
        quotaFreed,
        dataRetained: quotaFreed * 0.8,
        dataLost: quotaFreed * 0.2,
        newQuotaStatus,
        recommendations: ['Review cleanup patterns for optimization'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`Selective cleanup fallback failed: ${error.message}`);
    }
  }

  async executeGracefulDegradationFallback(): Promise<FallbackResult> {
    // Implementation for graceful degradation fallback strategy
    try {
      const quotaFreed = await this.enableGracefulDegradation();
      const newQuotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

      return {
        success: true,
        strategy: FallbackStrategy.GRACEFUL_DEGRADATION,
        quotaFreed,
        dataRetained: quotaFreed * 0.9,
        dataLost: quotaFreed * 0.1,
        newQuotaStatus,
        recommendations: ['Monitor user experience impact'],
        nextCheckTime: new Date(Date.now() + this.config.monitoring.checkInterval)
      };

    } catch (error) {
      throw new Error(`Graceful degradation fallback failed: ${error.message}`);
    }
  }

  // Statistics and Monitoring
  getStatistics(): BrowserFallbackStats {
    return { ...this.statistics };
  }

  async resetStatistics(): Promise<void> {
    this.statistics = this.initializeStatistics();
  }

  async exportStatistics(): Promise<string> {
    return JSON.stringify({
      statistics: this.statistics,
      exportDate: new Date(),
      version: this.version
    }, null, 2);
  }

  // Events
  on(event: string, callback: (event: BrowserFallbackEvent) => void): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Utility Methods
  async estimateQuotaUsage(data: any): Promise<number> {
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  }

  async validateFallbackRule(rule: Partial<FallbackRule>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!rule.strategy || !Object.values(FallbackStrategy).includes(rule.strategy as FallbackStrategy)) {
      errors.push('Valid strategy is required');
    }

    if (!rule.trigger) {
      errors.push('Trigger configuration is required');
    } else {
      if (typeof rule.trigger.quotaThreshold !== 'number' ||
          rule.trigger.quotaThreshold < 0 ||
          rule.trigger.quotaThreshold > 100) {
        errors.push('Quota threshold must be between 0 and 100');
      }

      if (!Array.isArray(rule.trigger.storageTypes) || rule.trigger.storageTypes.length === 0) {
        errors.push('At least one storage type must be specified');
      }
    }

    if (typeof rule.priority !== 'number' || rule.priority < 0) {
      errors.push('Priority must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async simulateFallback(strategy: FallbackStrategy): Promise<{
    estimatedQuotaFreed: number;
    estimatedDataLoss: number;
    estimatedImpact: string
  }> {
    const currentQuota = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

    // Use a minimum baseline for simulation if no actual usage
    const baselineUsage = Math.max(currentQuota.used, 1024 * 1024); // 1MB minimum

    let estimatedQuotaFreed = 0;
    let estimatedDataLoss = 0;
    let estimatedImpact = 'minimal';

    switch (strategy) {
      case FallbackStrategy.MEMORY_ONLY:
        estimatedQuotaFreed = baselineUsage * 0.8;
        estimatedDataLoss = estimatedQuotaFreed;
        estimatedImpact = 'significant';
        break;

      case FallbackStrategy.REDUCED_CACHE:
        estimatedQuotaFreed = baselineUsage * 0.3;
        estimatedDataLoss = estimatedQuotaFreed * 0.3;
        estimatedImpact = 'moderate';
        break;

      case FallbackStrategy.COMPRESSION:
        estimatedQuotaFreed = baselineUsage * 0.4;
        estimatedDataLoss = 0;
        estimatedImpact = 'minimal';
        break;

      case FallbackStrategy.SELECTIVE_CLEANUP:
        estimatedQuotaFreed = baselineUsage * 0.2;
        estimatedDataLoss = estimatedQuotaFreed * 0.2;
        estimatedImpact = 'minimal';
        break;

      default:
        estimatedQuotaFreed = baselineUsage * 0.1;
        estimatedDataLoss = 0;
        estimatedImpact = 'none';
    }

    return {
      estimatedQuotaFreed,
      estimatedDataLoss,
      estimatedImpact
    };
  }

  // Bulk Operations
  async addMultipleFallbackRules(rules: Omit<FallbackRule, 'id' | 'createdAt'>[]): Promise<string[]> {
    const ruleIds: string[] = [];

    for (const rule of rules) {
      try {
        const ruleId = await this.addFallbackRule(rule);
        ruleIds.push(ruleId);
      } catch (error) {
        console.error(`Failed to add rule ${rule.name}:`, error);
        throw error;
      }
    }

    return ruleIds;
  }

  async updateMultipleFallbackRules(updates: { ruleId: string; updates: Partial<FallbackRule> }[]): Promise<void> {
    for (const { ruleId, updates: ruleUpdates } of updates) {
      try {
        await this.updateFallbackRule(ruleId, ruleUpdates);
      } catch (error) {
        console.error(`Failed to update rule ${ruleId}:`, error);
        throw error;
      }
    }
  }

  async removeMultipleFallbackRules(ruleIds: string[]): Promise<void> {
    for (const ruleId of ruleIds) {
      try {
        await this.removeFallbackRule(ruleId);
      } catch (error) {
        console.error(`Failed to remove rule ${ruleId}:`, error);
        throw error;
      }
    }
  }

  // Import/Export
  async exportConfiguration(): Promise<string> {
    return JSON.stringify({
      config: this.config,
      rules: Array.from(this.fallbackRules.values()),
      exportDate: new Date(),
      version: this.version
    }, null, 2);
  }

  async importConfiguration(configData: string): Promise<void> {
    try {
      const data = JSON.parse(configData);

      if (data.config) {
        await this.updateConfig(data.config);
      }

      if (data.rules && Array.isArray(data.rules)) {
        this.fallbackRules.clear();
        for (const rule of data.rules) {
          this.fallbackRules.set(rule.id, rule);
        }
      }

    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  async exportFallbackHistory(): Promise<string> {
    return JSON.stringify({
      history: this.executionHistory,
      statistics: this.statistics,
      exportDate: new Date(),
      version: this.version
    }, null, 2);
  }

  async importFallbackHistory(historyData: string): Promise<void> {
    try {
      const data = JSON.parse(historyData);

      if (data.history && Array.isArray(data.history)) {
        this.executionHistory = data.history;
      }

      if (data.statistics) {
        this.statistics = { ...this.statistics, ...data.statistics };
      }

    } catch (error) {
      throw new Error(`Failed to import fallback history: ${error.message}`);
    }
  }

  // Private Helper Methods
  private initializeStatistics(): BrowserFallbackStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalQuotaFreed: 0,
      totalDataRetained: 0,
      totalDataLost: 0,
      strategyUsage: {
        [FallbackStrategy.MEMORY_ONLY]: 0,
        [FallbackStrategy.REDUCED_CACHE]: 0,
        [FallbackStrategy.EXTERNAL_STORAGE]: 0,
        [FallbackStrategy.COMPRESSION]: 0,
        [FallbackStrategy.SELECTIVE_CLEANUP]: 0,
        [FallbackStrategy.GRACEFUL_DEGRADATION]: 0
      },
      nextScheduledCheck: new Date(Date.now() + 60000) // 1 minute from now
    };
  }

  private getDefaultConfig(): BrowserFallbackManagerConfig {
    return {
      monitoring: {
        enabled: true,
        checkInterval: 60000, // 1 minute
        warningThreshold: 80, // 80%
        criticalThreshold: 95, // 95%
        autoFallback: true,
        notifyUser: true,
        logLevel: 'info'
      },
      fallbackRules: [],
      defaultStrategy: FallbackStrategy.SELECTIVE_CLEANUP,
      emergencyStrategy: FallbackStrategy.MEMORY_ONLY,
      retryAttempts: 3,
      retryDelay: 5000,
      maxConcurrentExecutions: 2,
      enableStatistics: true,
      enableEvents: true
    };
  }

  private async loadDefaultFallbackRules(): Promise<void> {
    const defaultRules: Omit<FallbackRule, 'id' | 'createdAt'>[] = [
      {
        name: 'Critical Storage Cleanup',
        description: 'Triggered when storage reaches critical levels',
        trigger: {
          quotaThreshold: 95,
          storageTypes: [StorageType.LOCAL_STORAGE, StorageType.INDEXED_DB],
          conditions: []
        },
        strategy: FallbackStrategy.SELECTIVE_CLEANUP,
        priority: 100,
        config: {
          retainCriticalData: true,
          cleanupPatterns: ['cache_*', 'temp_*', 'log_*']
        },
        enabled: true
      },
      {
        name: 'Warning Level Compression',
        description: 'Compress data when storage reaches warning levels',
        trigger: {
          quotaThreshold: 80,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 50,
        config: {
          retainCriticalData: true,
          compressionLevel: 6
        },
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      await this.addFallbackRule(rule);
    }
  }

  private async detectAvailableStorageTypes(): Promise<void> {
    // Detect available storage types in the current environment
    const availableTypes: StorageType[] = [];

    if (typeof localStorage !== 'undefined') {
      availableTypes.push(StorageType.LOCAL_STORAGE);
    }

    if (typeof sessionStorage !== 'undefined') {
      availableTypes.push(StorageType.SESSION_STORAGE);
    }

    if ('indexedDB' in globalThis) {
      availableTypes.push(StorageType.INDEXED_DB);
    }

    console.log(`Detected available storage types: ${availableTypes.join(', ')}`);
  }

  private calculateStorageUsage(storage: Storage): number {
    let totalSize = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const value = storage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }
    return totalSize * 2; // Approximate UTF-16 encoding
  }

  private estimateStorageLimit(storageType: string): number {
    // Rough estimates for different storage types
    switch (storageType) {
      case 'localStorage':
      case 'sessionStorage':
        return 5 * 1024 * 1024; // 5MB typical limit
      default:
        return 10 * 1024 * 1024; // 10MB default estimate
    }
  }

  private async getAllQuotaStatuses(): Promise<Record<StorageType, QuotaStatus>> {
    const quotaInfos = await this.checkQuotaStatus();
    const statuses: Record<StorageType, QuotaStatus> = {} as any;

    for (const info of quotaInfos) {
      statuses[info.type] = info.status;
    }

    return statuses;
  }

  private async triggerAutoFallback(quotaInfo: StorageQuotaInfo): Promise<void> {
    // Find applicable rules for the quota situation
    const applicableRules = Array.from(this.fallbackRules.values())
      .filter(rule =>
        rule.enabled &&
        rule.trigger.storageTypes.includes(quotaInfo.type) &&
        quotaInfo.percentage >= rule.trigger.quotaThreshold
      )
      .sort((a, b) => b.priority - a.priority);

    if (applicableRules.length > 0) {
      const rule = applicableRules[0];
      try {
        await this.executeFallbackRule(rule.id);
      } catch (error) {
        console.error(`Auto-fallback failed for rule ${rule.id}:`, error);
      }
    }
  }

  private async createFallbackExecution(
    ruleId: string,
    strategy: FallbackStrategy,
    reason: string
  ): Promise<FallbackExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const quotaStatus = await this.getQuotaStatus(StorageType.LOCAL_STORAGE);

    const execution: FallbackExecution = {
      id: executionId,
      ruleId,
      strategy,
      trigger: {
        quotaStatus,
        timestamp: new Date(),
        reason
      },
      execution: {
        startTime: new Date(),
        status: 'running',
        steps: []
      },
      impact: {
        dataRetained: 0,
        dataLost: 0,
        performanceImpact: 0,
        userExperienceImpact: 'none'
      }
    };

    this.activeExecutions.set(executionId, execution);

    this.emit('fallback_triggered', {
      type: 'fallback_triggered',
      timestamp: new Date(),
      data: { execution }
    });

    return execution;
  }

  private async executeFallbackStrategy(
    execution: FallbackExecution,
    strategy: FallbackStrategy
  ): Promise<FallbackResult> {
    try {
      let result: FallbackResult;

      switch (strategy) {
        case FallbackStrategy.MEMORY_ONLY:
          result = await this.executeMemoryOnlyFallback();
          break;
        case FallbackStrategy.REDUCED_CACHE:
          result = await this.executeReducedCacheFallback();
          break;
        case FallbackStrategy.EXTERNAL_STORAGE:
          result = await this.executeExternalStorageFallback();
          break;
        case FallbackStrategy.COMPRESSION:
          result = await this.executeCompressionFallback();
          break;
        case FallbackStrategy.SELECTIVE_CLEANUP:
          result = await this.executeSelectiveCleanupFallback();
          break;
        case FallbackStrategy.GRACEFUL_DEGRADATION:
          result = await this.executeGracefulDegradationFallback();
          break;
        default:
          throw new Error(`Unknown fallback strategy: ${strategy}`);
      }

      // Update execution
      execution.execution.status = 'completed';
      execution.execution.endTime = new Date();
      execution.execution.result = result;
      execution.impact.dataRetained = result.dataRetained;
      execution.impact.dataLost = result.dataLost;

      // Update statistics
      this.updateStatistics(execution, result);

      // Move to history
      this.activeExecutions.delete(execution.id);
      this.executionHistory.push(execution);

      this.emit('fallback_completed', {
        type: 'fallback_completed',
        timestamp: new Date(),
        data: { execution, result }
      });

      return result;

    } catch (error) {
      execution.execution.status = 'failed';
      execution.execution.endTime = new Date();
      execution.execution.error = error as Error;

      this.activeExecutions.delete(execution.id);
      this.executionHistory.push(execution);

      this.emit('fallback_failed', {
        type: 'fallback_failed',
        timestamp: new Date(),
        data: { execution, error }
      });

      throw error;
    }
  }

  private updateStatistics(execution: FallbackExecution, result: FallbackResult): void {
    this.statistics.totalExecutions++;

    if (result.success) {
      this.statistics.successfulExecutions++;
    } else {
      this.statistics.failedExecutions++;
    }

    const executionTime = execution.execution.endTime!.getTime() - execution.execution.startTime.getTime();
    this.statistics.averageExecutionTime =
      (this.statistics.averageExecutionTime * (this.statistics.totalExecutions - 1) + executionTime) /
      this.statistics.totalExecutions;

    this.statistics.totalQuotaFreed += result.quotaFreed;
    this.statistics.totalDataRetained += result.dataRetained;
    this.statistics.totalDataLost += result.dataLost;
    this.statistics.strategyUsage[execution.strategy]++;
    this.statistics.lastExecution = new Date();
    this.statistics.nextScheduledCheck = result.nextCheckTime;
  }

  // Strategy implementation helpers
  private async clearNonCriticalData(): Promise<number> {
    // Simulate clearing non-critical data
    return 1024 * 1024; // 1MB freed
  }

  private async reduceCacheSize(): Promise<number> {
    // Simulate reducing cache size
    return 512 * 1024; // 512KB freed
  }

  private async moveToExternalStorage(): Promise<number> {
    // Simulate moving data to external storage
    return 2 * 1024 * 1024; // 2MB freed
  }

  private async compressStoredData(): Promise<number> {
    // Simulate compressing stored data
    return 1.5 * 1024 * 1024; // 1.5MB freed
  }

  private async performSelectiveCleanup(): Promise<number> {
    // Simulate selective cleanup
    return 800 * 1024; // 800KB freed
  }

  private async enableGracefulDegradation(): Promise<number> {
    // Simulate enabling graceful degradation
    return 300 * 1024; // 300KB freed
  }
}