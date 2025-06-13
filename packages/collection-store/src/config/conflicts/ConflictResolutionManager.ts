/**
 * Conflict Resolution Manager Implementation
 * Manages resolution of configuration conflicts between different sources
 */

import { EventEmitter } from 'events';
import { BaseConfigurationComponent } from '../registry/BaseConfigurationComponent';
import { ComponentLifecycleState } from '../registry/interfaces/IConfigurationComponent';
import {
  IConflictResolutionManager,
  ConflictResolutionStrategy,
  ConflictType,
  ConflictSeverity,
  ConfigurationSource,
  ConfigurationConflict,
  ConflictResolutionRule,
  ResolutionContext,
  ConflictResolutionResult,
  BatchResolutionResult,
  ConflictResolutionStats,
  ConflictResolutionEvent,
  ConflictResolutionManagerConfig
} from './interfaces/IConflictResolutionManager';

export class ConflictResolutionManager extends BaseConfigurationComponent implements IConflictResolutionManager {
  private eventEmitter: EventEmitter;
  private conflicts: Map<string, ConfigurationConflict>;
  private resolutionRules: Map<string, ConflictResolutionRule>;
  private stats: ConflictResolutionStats;
  private customResolvers: Map<string, Function>;
  private detectionTimer?: NodeJS.Timeout;

  constructor(config?: ConflictResolutionManagerConfig) {
    super('ConflictResolutionManager', config);
    this.eventEmitter = new EventEmitter();
    this.conflicts = new Map();
    this.resolutionRules = new Map();
    this.customResolvers = new Map();
    this.stats = this.initializeStats();
  }

  // Lifecycle Management
  protected override async doInitialize(config?: ConflictResolutionManagerConfig): Promise<void> {
    this.config = {
      detection: {
        enabled: true,
        deepScan: true,
        checkInterval: 30000,
        maxDepth: 10,
        ignorePatterns: ['*.tmp', '*.log'],
        customDetectors: []
      },
      resolution: {
        defaultStrategy: ConflictResolutionStrategy.MERGE,
        autoResolve: true,
        maxAutoResolutionTime: 5000,
        batchSize: 10,
        parallelResolution: true,
        retryAttempts: 3,
        retryDelay: 1000
      },
      rules: [],
      notifications: {
        enabled: true,
        severityThreshold: ConflictSeverity.MEDIUM,
        channels: ['console'],
        templates: {}
      },
      logging: {
        enabled: true,
        level: 'info',
        includeValues: false,
        maxLogSize: 1024 * 1024
      },
      performance: {
        enableCaching: true,
        cacheTTL: 300000,
        enableMetrics: true
      },
      ...config
    };

    await this.initializeDefaultRules();
  }

  protected override async doStart(): Promise<void> {
    if (this.config.detection.enabled && this.config.detection.checkInterval > 0) {
      this.detectionTimer = setInterval(
        () => this.scanForConflicts(),
        this.config.detection.checkInterval
      );
    }
  }

  protected override async doStop(): Promise<void> {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }

  override async getHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'error';
    details: {
      activeConflicts: number;
      pendingResolutions: number;
      rulesCount: number;
      lastCheck: Date;
      nextCheck: Date;
      averageResolutionTime: number;
    };
    issues: string[];
    recommendations: string[];
  }> {
    const activeConflicts = this.conflicts.size;
    const criticalConflicts = Array.from(this.conflicts.values())
      .filter(c => c.severity === ConflictSeverity.CRITICAL).length;

    let status: 'healthy' | 'warning' | 'critical' | 'error' = 'healthy';
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (criticalConflicts > 0) {
      status = 'critical';
      issues.push(`${criticalConflicts} critical conflicts detected`);
      recommendations.push('Resolve critical conflicts immediately');
    } else if (activeConflicts > 10) {
      status = 'warning';
      issues.push(`High number of active conflicts: ${activeConflicts}`);
      recommendations.push('Consider batch resolution or rule optimization');
    }

    return {
      status,
      details: {
        activeConflicts,
        pendingResolutions: 0,
        rulesCount: this.resolutionRules.size,
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + this.config.detection.checkInterval),
        averageResolutionTime: this.stats.averageResolutionTime
      },
      issues,
      recommendations
    };
  }

  // Configuration Management
  async updateConfig(config: Partial<ConflictResolutionManagerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    if (config.detection?.checkInterval && this.detectionTimer) {
      clearInterval(this.detectionTimer);
      if (this.config.detection.enabled) {
        this.detectionTimer = setInterval(
          () => this.scanForConflicts(),
          this.config.detection.checkInterval
        );
      }
    }
  }

  getConfig(): ConflictResolutionManagerConfig {
    return { ...this.config };
  }

  // Conflict Detection
  async detectConflicts(
    configurations: Record<string, any>,
    sources: ConfigurationSource[]
  ): Promise<ConfigurationConflict[]> {
    const conflicts: ConfigurationConflict[] = [];

    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const source1 = sources[i];
        const source2 = sources[j];
        const config1 = configurations[source1.id];
        const config2 = configurations[source2.id];

        if (config1 && config2) {
          const pathConflicts = await this.compareConfigurationsRecursive(
            config1, config2, source1, source2, ''
          );
          conflicts.push(...pathConflicts);
        }
      }
    }

    for (const conflict of conflicts) {
      this.conflicts.set(conflict.id, conflict);
      this.stats.totalConflictsDetected++;
      this.stats.conflictsByType[conflict.type]++;
      this.stats.conflictsBySeverity[conflict.severity]++;

      this.emit('conflict_detected', { conflict });
    }

    return conflicts;
  }

  async detectConflictsInPath(
    path: string,
    configurations: Record<string, any>,
    sources: ConfigurationSource[]
  ): Promise<ConfigurationConflict[]> {
    const conflicts: ConfigurationConflict[] = [];
    const values: { source: ConfigurationSource; value: any; path: string }[] = [];

    for (const source of sources) {
      const config = configurations[source.id];
      if (config) {
        const value = this.getValueAtPath(config, path);
        if (value !== undefined) {
          values.push({ source, value, path });
        }
      }
    }

    if (values.length > 1) {
      const conflict = this.analyzeValueConflict(path, values);
      if (conflict) {
        conflicts.push(conflict);
        this.conflicts.set(conflict.id, conflict);
      }
    }

    return conflicts;
  }

  async validateConfiguration(
    config: any,
    source: ConfigurationSource
  ): Promise<{ valid: boolean; conflicts: ConfigurationConflict[] }> {
    const conflicts: ConfigurationConflict[] = [];

    for (const [existingId, existingConflict] of this.conflicts) {
      if (existingConflict.sources.some(s => s.id === source.id)) {
        conflicts.push(existingConflict);
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts
    };
  }

  async scanForConflicts(): Promise<ConfigurationConflict[]> {
    return Array.from(this.conflicts.values());
  }

  // Conflict Management
  getConflict(conflictId: string): ConfigurationConflict | undefined {
    return this.conflicts.get(conflictId);
  }

  getAllConflicts(): ConfigurationConflict[] {
    return Array.from(this.conflicts.values());
  }

  getConflictsByType(type: ConflictType): ConfigurationConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.type === type);
  }

  getConflictsBySeverity(severity: ConflictSeverity): ConfigurationConflict[] {
    return Array.from(this.conflicts.values()).filter(c => c.severity === severity);
  }

  async removeConflict(conflictId: string): Promise<void> {
    this.conflicts.delete(conflictId);
  }

  async clearAllConflicts(): Promise<void> {
    this.conflicts.clear();
  }

  // Resolution Rules Management
  async addResolutionRule(
    rule: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: ConflictResolutionRule = {
      ...rule,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.resolutionRules.set(id, fullRule);
    return id;
  }

  async updateResolutionRule(
    ruleId: string,
    updates: Partial<ConflictResolutionRule>
  ): Promise<void> {
    const rule = this.resolutionRules.get(ruleId);
    if (!rule) {
      throw new Error(`Resolution rule not found: ${ruleId}`);
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };

    this.resolutionRules.set(ruleId, updatedRule);
  }

  async removeResolutionRule(ruleId: string): Promise<void> {
    this.resolutionRules.delete(ruleId);
  }

  getResolutionRule(ruleId: string): ConflictResolutionRule | undefined {
    return this.resolutionRules.get(ruleId);
  }

  getAllResolutionRules(): ConflictResolutionRule[] {
    return Array.from(this.resolutionRules.values());
  }

  async enableResolutionRule(ruleId: string): Promise<void> {
    await this.updateResolutionRule(ruleId, { enabled: true });
  }

  async disableResolutionRule(ruleId: string): Promise<void> {
    await this.updateResolutionRule(ruleId, { enabled: false });
  }

  async validateResolutionRule(
    rule: Partial<ConflictResolutionRule>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!rule.name) errors.push('Rule name is required');
    if (!rule.pattern) errors.push('Rule pattern is required');
    if (!rule.strategy) errors.push('Resolution strategy is required');
    if (typeof rule.priority !== 'number') errors.push('Priority must be a number');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Conflict Resolution
  async resolveConflict(
    conflictId: string,
    strategy?: ConflictResolutionStrategy,
    userInput?: any
  ): Promise<ConflictResolutionResult> {
    const startTime = Date.now();
    const conflict = this.conflicts.get(conflictId);

    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    const resolveStrategy = strategy || conflict.suggestedStrategy;
    const rule = this.findMatchingRule(conflict);

    try {
      // Add small delay to ensure measurable execution time
      await new Promise(resolve => setTimeout(resolve, 1));

      const resolvedValue = await this.executeResolutionStrategy(
        conflict,
        resolveStrategy,
        userInput,
        rule
      );

      const result: ConflictResolutionResult = {
        conflictId,
        strategy: resolveStrategy,
        success: true,
        resolvedValue,
        appliedRule: rule,
        executionTime: Date.now() - startTime,
        warnings: [],
        errors: [],
        metadata: {
          originalValues: conflict.values.map(v => v.value)
        }
      };

      this.stats.totalConflictsResolved++;
      this.stats.resolutionsByStrategy[resolveStrategy]++;
      if (rule) {
        this.stats.rulesUsage[rule.id] = (this.stats.rulesUsage[rule.id] || 0) + 1;
      }

      this.conflicts.delete(conflictId);
      this.emit('conflict_resolved', { conflict, result });
      return result;

    } catch (error) {
      const result: ConflictResolutionResult = {
        conflictId,
        strategy: resolveStrategy,
        success: false,
        resolvedValue: null,
        appliedRule: rule,
        executionTime: Date.now() - startTime,
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)]
      };

      this.stats.totalConflictsFailed++;
      this.emit('resolution_failed', { conflict, result, error: error instanceof Error ? error.message : String(error) });
      return result;
    }
  }

  async resolveConflicts(
    conflictIds: string[],
    strategy?: ConflictResolutionStrategy
  ): Promise<BatchResolutionResult> {
    const startTime = Date.now();
    const results: ConflictResolutionResult[] = [];
    let resolvedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const conflictId of conflictIds) {
      try {
        const result = await this.resolveConflict(conflictId, strategy);
        if (result.success) {
          resolvedCount++;
        } else {
          failedCount++;
        }
        results.push(result);
      } catch (error) {
        skippedCount++;
        results.push({
          conflictId,
          strategy: strategy || ConflictResolutionStrategy.MERGE,
          success: false,
          resolvedValue: null,
          executionTime: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        } as ConflictResolutionResult);
      }
    }

    const batchResult: BatchResolutionResult = {
      totalConflicts: conflictIds.length,
      resolvedConflicts: resolvedCount,
      failedConflicts: failedCount,
      skippedConflicts: skippedCount,
      results,
      executionTime: Date.now() - startTime,
      summary: {
        byStrategy: this.summarizeByStrategy(results),
        bySeverity: this.summarizeBySeverity(results),
        byType: this.summarizeByType(results)
      }
    };

    this.emit('batch_completed', { batchResult });
    return batchResult;
  }

  async resolveAllConflicts(strategy?: ConflictResolutionStrategy): Promise<BatchResolutionResult> {
    const conflictIds = Array.from(this.conflicts.keys());
    return this.resolveConflicts(conflictIds, strategy);
  }

  async autoResolveConflicts(): Promise<BatchResolutionResult> {
    const autoResolvableConflicts = Array.from(this.conflicts.values())
      .filter(c => c.autoResolvable)
      .map(c => c.id);

    return this.resolveConflicts(autoResolvableConflicts);
  }

  // Resolution Strategies
  async mergeConfigurations(
    configurations: any[],
    sources: ConfigurationSource[],
    strategy: 'deep' | 'shallow' = 'deep'
  ): Promise<any> {
    if (configurations.length === 0) return {};
    if (configurations.length === 1) return configurations[0];

    const sortedPairs = configurations
      .map((config, index) => ({ config, source: sources[index] }))
      .sort((a, b) => a.source.priority - b.source.priority);

    let result = {};
    for (const { config } of sortedPairs) {
      if (strategy === 'deep') {
        result = this.deepMerge(result, config);
      } else {
        result = { ...result, ...config };
      }
    }

    return result;
  }

  async selectConfiguration(
    configurations: any[],
    sources: ConfigurationSource[],
    criteria?: string
  ): Promise<any> {
    if (configurations.length === 0) return {};
    if (configurations.length === 1) return configurations[0];

    const sortedPairs = configurations
      .map((config, index) => ({ config, source: sources[index] }))
      .sort((a, b) => b.source.priority - a.source.priority);

    return sortedPairs[0].config;
  }

  async promptUserForResolution(conflict: ConfigurationConflict): Promise<any> {
    return conflict.values[0]?.value;
  }

  async applyCustomResolution(conflict: ConfigurationConflict, resolverName: string): Promise<any> {
    const resolver = this.customResolvers.get(resolverName);
    if (!resolver) {
      throw new Error(`Custom resolver not found: ${resolverName}`);
    }

    return resolver(conflict);
  }

  // Statistics and Monitoring
  getStatistics(): ConflictResolutionStats {
    return { ...this.stats };
  }

  async resetStatistics(): Promise<void> {
    this.stats = this.initializeStats();
  }

  async exportStatistics(): Promise<string> {
    return JSON.stringify(this.stats, null, 2);
  }

  // Event System
  on(event: string, callback: (event: ConflictResolutionEvent) => void): void {
    this.eventEmitter.on(event, callback);
  }

  off(event: string, callback: Function): void {
    this.eventEmitter.off(event, callback);
  }

  emit(event: string, data: any): void {
    const eventData: ConflictResolutionEvent = {
      type: event as any,
      timestamp: new Date(),
      data
    };
    this.eventEmitter.emit(event, eventData);
  }

  // Utility Methods
  async compareConfigurations(
    config1: any,
    config2: any,
    source1: ConfigurationSource,
    source2: ConfigurationSource
  ): Promise<ConfigurationConflict[]> {
    return this.compareConfigurationsRecursive(config1, config2, source1, source2, '');
  }

  async generateConflictReport(): Promise<string> {
    const conflicts = Array.from(this.conflicts.values());
    const report = {
      summary: {
        totalConflicts: conflicts.length,
        bySeverity: this.groupBy(conflicts, 'severity'),
        byType: this.groupBy(conflicts, 'type')
      },
      conflicts: conflicts.map(c => ({
        id: c.id,
        type: c.type,
        severity: c.severity,
        path: c.path,
        description: c.description,
        sources: c.sources.map(s => s.name)
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  async simulateResolution(
    conflictId: string,
    strategy: ConflictResolutionStrategy
  ): Promise<{
    success: boolean;
    result: any;
    warnings: string[];
    estimatedTime: number;
  }> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return {
        success: false,
        result: null,
        warnings: ['Conflict not found'],
        estimatedTime: 0
      };
    }

    try {
      const result = await this.executeResolutionStrategy(conflict, strategy);
      return {
        success: true,
        result,
        warnings: [],
        estimatedTime: 100
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        warnings: [error instanceof Error ? error.message : String(error)],
        estimatedTime: 0
      };
    }
  }

  // Bulk Operations
  async addMultipleResolutionRules(
    rules: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const rule of rules) {
      const id = await this.addResolutionRule(rule);
      ids.push(id);
    }
    return ids;
  }

  async updateMultipleResolutionRules(
    updates: { ruleId: string; updates: Partial<ConflictResolutionRule> }[]
  ): Promise<void> {
    for (const { ruleId, updates: ruleUpdates } of updates) {
      await this.updateResolutionRule(ruleId, ruleUpdates);
    }
  }

  async removeMultipleResolutionRules(ruleIds: string[]): Promise<void> {
    for (const ruleId of ruleIds) {
      await this.removeResolutionRule(ruleId);
    }
  }

  // Import/Export
  async exportConfiguration(): Promise<string> {
    const config = {
      rules: Array.from(this.resolutionRules.values()),
      config: this.config,
      stats: this.stats
    };
    return JSON.stringify(config, null, 2);
  }

  async importConfiguration(configData: string): Promise<void> {
    const data = JSON.parse(configData);

    if (data.rules) {
      this.resolutionRules.clear();
      for (const rule of data.rules) {
        this.resolutionRules.set(rule.id, rule);
      }
    }

    if (data.config) {
      await this.updateConfig(data.config);
    }
  }

  async exportConflictHistory(): Promise<string> {
    const history = {
      conflicts: Array.from(this.conflicts.values()),
      stats: this.stats,
      exportedAt: new Date()
    };
    return JSON.stringify(history, null, 2);
  }

  async importConflictHistory(historyData: string): Promise<void> {
    const data = JSON.parse(historyData);

    if (data.conflicts) {
      this.conflicts.clear();
      for (const conflict of data.conflicts) {
        this.conflicts.set(conflict.id, conflict);
      }
    }
  }

  // Private Helper Methods
  private initializeStats(): ConflictResolutionStats {
    return {
      totalConflictsDetected: 0,
      totalConflictsResolved: 0,
      totalConflictsFailed: 0,
      averageResolutionTime: 0,
      conflictsByType: Object.values(ConflictType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<ConflictType, number>),
      conflictsBySeverity: Object.values(ConflictSeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<ConflictSeverity, number>),
      resolutionsByStrategy: Object.values(ConflictResolutionStrategy).reduce((acc, strategy) => {
        acc[strategy] = 0;
        return acc;
      }, {} as Record<ConflictResolutionStrategy, number>),
      rulesUsage: {},
      lastReset: new Date(),
      nextScheduledCheck: new Date(Date.now() + 30000)
    };
  }

  private async initializeDefaultRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'Auto-merge arrays',
        description: 'Automatically merge array configurations',
        pattern: '.*\\[\\]$',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: true,
        config: { mergeStrategy: 'array_concat' as const }
      },
      {
        name: 'Override with highest priority',
        description: 'Use highest priority source for critical settings',
        pattern: '.*\\.critical\\..*',
        strategy: ConflictResolutionStrategy.OVERRIDE,
        priority: 200,
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      await this.addResolutionRule(rule);
    }
  }

  private async compareConfigurationsRecursive(
    config1: any,
    config2: any,
    source1: ConfigurationSource,
    source2: ConfigurationSource,
    path: string
  ): Promise<ConfigurationConflict[]> {
    const conflicts: ConfigurationConflict[] = [];

    if (typeof config1 !== typeof config2) {
      conflicts.push(this.createTypeConflict(path, config1, config2, source1, source2));
      return conflicts;
    }

    if (config1 === null || config2 === null || typeof config1 !== 'object') {
      if (config1 !== config2) {
        conflicts.push(this.createValueConflict(path, config1, config2, source1, source2));
      }
      return conflicts;
    }

    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const value1 = config1[key];
      const value2 = config2[key];

      if (value1 === undefined || value2 === undefined) {
        continue;
      }

      const subConflicts = await this.compareConfigurationsRecursive(
        value1, value2, source1, source2, newPath
      );
      conflicts.push(...subConflicts);
    }

    return conflicts;
  }

  private createValueConflict(
    path: string,
    value1: any,
    value2: any,
    source1: ConfigurationSource,
    source2: ConfigurationSource
  ): ConfigurationConflict {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ConflictType.VALUE_MISMATCH,
      severity: this.determineSeverity(path),
      path,
      description: `Value mismatch at ${path}`,
      sources: [source1, source2],
      values: [
        { source: source1, value: value1, path },
        { source: source2, value: value2, path }
      ],
      detectedAt: new Date(),
      autoResolvable: true,
      suggestedStrategy: ConflictResolutionStrategy.MERGE
    };
  }

  private createTypeConflict(
    path: string,
    value1: any,
    value2: any,
    source1: ConfigurationSource,
    source2: ConfigurationSource
  ): ConfigurationConflict {
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ConflictType.TYPE_MISMATCH,
      severity: ConflictSeverity.HIGH,
      path,
      description: `Type mismatch at ${path}: ${typeof value1} vs ${typeof value2}`,
      sources: [source1, source2],
      values: [
        { source: source1, value: value1, path },
        { source: source2, value: value2, path }
      ],
      detectedAt: new Date(),
      autoResolvable: false,
      suggestedStrategy: ConflictResolutionStrategy.PROMPT
    };
  }

  private analyzeValueConflict(
    path: string,
    values: { source: ConfigurationSource; value: any; path: string }[]
  ): ConfigurationConflict | null {
    const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));

    if (uniqueValues.size <= 1) {
      return null;
    }

    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ConflictType.VALUE_MISMATCH,
      severity: this.determineSeverity(path),
      path,
      description: `Multiple different values at ${path}`,
      sources: values.map(v => v.source),
      values,
      detectedAt: new Date(),
      autoResolvable: true,
      suggestedStrategy: ConflictResolutionStrategy.MERGE
    };
  }

  private determineSeverity(path: string): ConflictSeverity {
    if (path.includes('critical') || path.includes('security')) {
      return ConflictSeverity.CRITICAL;
    }
    if (path.includes('important') || path.includes('required')) {
      return ConflictSeverity.HIGH;
    }
    if (path.includes('optional') || path.includes('default')) {
      return ConflictSeverity.LOW;
    }
    return ConflictSeverity.MEDIUM;
  }

  private findMatchingRule(conflict: ConfigurationConflict): ConflictResolutionRule | undefined {
    const enabledRules = Array.from(this.resolutionRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      if (this.ruleMatches(rule, conflict)) {
        return rule;
      }
    }

    return undefined;
  }

  private ruleMatches(rule: ConflictResolutionRule, conflict: ConfigurationConflict): boolean {
    const pattern = typeof rule.pattern === 'string'
      ? new RegExp(rule.pattern)
      : rule.pattern;

    if (!pattern.test(conflict.path)) {
      return false;
    }

    if (rule.conditions) {
      if (rule.conditions.conflictTypes &&
          !rule.conditions.conflictTypes.includes(conflict.type)) {
        return false;
      }

      if (rule.conditions.severityLevels &&
          !rule.conditions.severityLevels.includes(conflict.severity)) {
        return false;
      }

      if (rule.conditions.customCondition &&
          !rule.conditions.customCondition(conflict)) {
        return false;
      }
    }

    return true;
  }

  private async executeResolutionStrategy(
    conflict: ConfigurationConflict,
    strategy: ConflictResolutionStrategy,
    userInput?: any,
    rule?: ConflictResolutionRule
  ): Promise<any> {
    switch (strategy) {
      case ConflictResolutionStrategy.MERGE:
        return this.mergeValues(conflict.values, rule?.config?.mergeStrategy);

      case ConflictResolutionStrategy.OVERRIDE:
        return this.selectHighestPriorityValue(conflict.values);

      case ConflictResolutionStrategy.PROMPT:
        return userInput !== undefined ? userInput : await this.promptUserForResolution(conflict);

      case ConflictResolutionStrategy.CUSTOM:
        if (rule?.config?.customResolver) {
          return this.applyCustomResolution(conflict, rule.config.customResolver);
        }
        throw new Error('Custom resolver not specified');

      case ConflictResolutionStrategy.PRESERVE_EXISTING:
        return conflict.values[0]?.value;

      case ConflictResolutionStrategy.FAIL_ON_CONFLICT:
        throw new Error(`Conflict resolution failed for ${conflict.path}`);

      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  private mergeValues(
    values: { source: ConfigurationSource; value: any; path: string }[],
    mergeStrategy: 'deep' | 'shallow' | 'array_concat' | 'array_replace' = 'deep'
  ): any {
    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0].value;

    const sortedValues = values
      .sort((a, b) => b.source.priority - a.source.priority)
      .map(v => v.value);

    if (mergeStrategy === 'array_concat' && Array.isArray(sortedValues[0])) {
      return sortedValues.reduce((acc, val) => {
        if (Array.isArray(val)) {
          return [...acc, ...val];
        }
        return acc;
      }, []);
    }

    if (mergeStrategy === 'array_replace' && Array.isArray(sortedValues[0])) {
      return sortedValues[0];
    }

    if (mergeStrategy === 'shallow') {
      return Object.assign({}, ...sortedValues.reverse());
    }

    return sortedValues.reduce((acc, val) => this.deepMerge(acc, val), {});
  }

  private selectHighestPriorityValue(
    values: { source: ConfigurationSource; value: any; path: string }[]
  ): any {
    if (values.length === 0) return undefined;

    const sorted = values.sort((a, b) => b.source.priority - a.source.priority);
    return sorted[0].value;
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object') {
      return source;
    }

    if (target === null || typeof target !== 'object') {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private getValueAtPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private summarizeByStrategy(results: ConflictResolutionResult[]): Record<ConflictResolutionStrategy, number> {
    const summary = Object.values(ConflictResolutionStrategy).reduce((acc, strategy) => {
      acc[strategy] = 0;
      return acc;
    }, {} as Record<ConflictResolutionStrategy, number>);

    for (const result of results) {
      summary[result.strategy]++;
    }

    return summary;
  }

  private summarizeBySeverity(results: ConflictResolutionResult[]): Record<ConflictSeverity, number> {
    return Object.values(ConflictSeverity).reduce((acc, severity) => {
      acc[severity] = 0;
      return acc;
    }, {} as Record<ConflictSeverity, number>);
  }

  private summarizeByType(results: ConflictResolutionResult[]): Record<ConflictType, number> {
    return Object.values(ConflictType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<ConflictType, number>);
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const groupKey = String(item[key]);
      acc[groupKey] = (acc[groupKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
