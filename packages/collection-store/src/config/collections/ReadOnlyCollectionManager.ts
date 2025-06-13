import { BaseConfigurationComponent } from '../registry/BaseConfigurationComponent';
import { ComponentHealth, ComponentStatus } from '../registry/interfaces/IConfigurationComponent';
import {
  IReadOnlyCollectionManager,
  ReadOnlyCollectionConfig,
  WriteOperation,
  WriteValidationResult,
  AutoDetectionRule,
  ReadOnlyCollectionStats,
  WriteOperationEvent,
  WriteOperationCallback,
  ReadOnlyCollectionManagerConfig,
  ProtectionLevel,
  WriteOperationType
} from './interfaces/IReadOnlyCollectionManager';

/**
 * Manager for read-only collections with write protection and auto-detection
 */
export class ReadOnlyCollectionManager extends BaseConfigurationComponent implements IReadOnlyCollectionManager {
  private readOnlyCollections: Map<string, ReadOnlyCollectionConfig> = new Map();
  private detectionRules: Map<string, AutoDetectionRule> = new Map();
  private writeOperationCallbacks: Set<WriteOperationCallback> = new Set();
  private stats: ReadOnlyCollectionStats = {
    totalCollections: 0,
    readOnlyCollections: 0,
    protectedCollections: 0,
    autoDetectedCollections: 0,
    blockedOperations: 0,
    warningOperations: 0
  };

  private managerConfig: ReadOnlyCollectionManagerConfig = {
    defaultProtectionLevel: ProtectionLevel.STRICT,
    enableAutoDetection: true,
    enableEvents: true,
    enableLogging: true,
    autoDetectionInterval: 300000, // 5 minutes
    detectionRules: []
  };

  private autoDetectionTimer?: NodeJS.Timeout;
  protected logger = console;

  constructor() {
    super(
      'readonly-collection-manager',
      'ReadOnlyCollectionManager',
      'Read-Only Collection Manager',
      '1.0.0',
      'Manages read-only collections with write protection and auto-detection',
      [],
      ['read-only-protection', 'write-validation', 'auto-detection']
    );

    this.initializeDefaultDetectionRules();
  }

  // BaseConfigurationComponent implementation

  protected async doInitialize(config: any): Promise<void> {
    if (config?.readOnlyCollections) {
      this.managerConfig = {
        ...this.managerConfig,
        ...config.readOnlyCollections
      };
    }

    // Load existing read-only configurations
    if (config?.readOnlyCollections?.collections) {
      await this.loadReadOnlyCollections(config.readOnlyCollections.collections);
    }

    // Load detection rules
    if (config?.readOnlyCollections?.detectionRules) {
      this.loadDetectionRules(config.readOnlyCollections.detectionRules);
    }

    this.updateStats();
    this.logger.info(`ReadOnlyCollectionManager initialized with ${this.readOnlyCollections.size} read-only collections`);
  }

  protected async doUpdateConfig(newConfig: any): Promise<void> {
    const oldConfig = this.managerConfig;

    if (newConfig?.readOnlyCollections) {
      this.managerConfig = {
        ...this.managerConfig,
        ...newConfig.readOnlyCollections
      };
    }

    // Update auto-detection if interval changed
    if (oldConfig.autoDetectionInterval !== this.managerConfig.autoDetectionInterval) {
      this.restartAutoDetection();
    }

    // Update detection rules
    if (newConfig?.readOnlyCollections?.detectionRules) {
      this.loadDetectionRules(newConfig.readOnlyCollections.detectionRules);
    }

    this.logger.info('ReadOnlyCollectionManager configuration updated successfully');
  }

  protected async doStart(): Promise<void> {
    if (this.managerConfig.enableAutoDetection) {
      this.startAutoDetection();
    }

    this.logger.info('ReadOnlyCollectionManager started successfully');
  }

  protected async doStop(): Promise<void> {
    this.stopAutoDetection();
    this.logger.info('ReadOnlyCollectionManager stopped successfully');
  }

  protected async doGetHealth(): Promise<Partial<ComponentHealth>> {
    const health: Partial<ComponentHealth> = {
      status: ComponentStatus.HEALTHY,
      details: {
        metrics: {
          totalCollections: this.stats.totalCollections,
          readOnlyCollections: this.stats.readOnlyCollections,
          protectedCollections: this.stats.protectedCollections,
          autoDetectedCollections: this.stats.autoDetectedCollections,
          blockedOperations: this.stats.blockedOperations,
          detectionRulesCount: this.detectionRules.size
        }
      }
    };

    // Check for potential issues
    if (this.stats.blockedOperations > 100) {
      health.status = ComponentStatus.WARNING;
      health.details = {
        ...health.details,
        warning: 'High number of blocked operations detected'
      };
    }

    return health;
  }

  protected async doCleanup(): Promise<void> {
    this.stopAutoDetection();
    this.readOnlyCollections.clear();
    this.detectionRules.clear();
    this.writeOperationCallbacks.clear();
  }

  // IReadOnlyCollectionManager implementation

  public async markAsReadOnly(
    collectionId: string,
    protectionLevel: ProtectionLevel = this.managerConfig.defaultProtectionLevel,
    reason?: string
  ): Promise<void> {
    const config: ReadOnlyCollectionConfig = {
      collectionId,
      protectionLevel,
      autoDetected: false,
      reason: reason || 'Manually marked as read-only',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.readOnlyCollections.set(collectionId, config);
    this.updateStats();

    this.logger.info(`Collection ${collectionId} marked as read-only with ${protectionLevel} protection`);
  }

  public async markAsWritable(collectionId: string): Promise<void> {
    const removed = this.readOnlyCollections.delete(collectionId);

    if (removed) {
      this.updateStats();
      this.logger.info(`Collection ${collectionId} marked as writable`);
    }
  }

  public isReadOnly(collectionId: string): boolean {
    return this.readOnlyCollections.has(collectionId);
  }

  public getReadOnlyConfig(collectionId: string): ReadOnlyCollectionConfig | null {
    return this.readOnlyCollections.get(collectionId) || null;
  }

  public getAllReadOnlyCollections(): Map<string, ReadOnlyCollectionConfig> {
    return new Map(this.readOnlyCollections);
  }

  public async validateWriteOperation(
    collectionId: string,
    operation: WriteOperation
  ): Promise<WriteValidationResult> {
    const config = this.readOnlyCollections.get(collectionId);

    if (!config) {
      return {
        allowed: true,
        reason: 'Collection is not read-only',
        protectionLevel: ProtectionLevel.DISABLED
      };
    }

    const result = this.evaluateWriteOperation(config, operation);

    // Emit event if enabled
    if (this.managerConfig.enableEvents) {
      this.emitWriteOperationEvent({
        operation,
        result,
        timestamp: new Date(),
        collectionConfig: config
      });
    }

    // Update statistics
    if (result.allowed) {
      if (config.protectionLevel === ProtectionLevel.WARNING) {
        this.stats.warningOperations++;
      }
    } else {
      this.stats.blockedOperations++;
      this.stats.lastBlockedOperation = new Date();
    }

    return result;
  }

  public async autoDetectReadOnlyCollections(): Promise<string[]> {
    const detectedCollections: string[] = [];

    if (!this.managerConfig.enableAutoDetection) {
      return detectedCollections;
    }

    // Get all available collections (this would need integration with Collection Store)
    const availableCollections = await this.getAvailableCollections();

    for (const collectionId of availableCollections) {
      if (!this.readOnlyCollections.has(collectionId)) {
        const detectionResult = this.runDetectionRules(collectionId);

        if (detectionResult) {
          await this.markAsReadOnly(
            collectionId,
            detectionResult.protectionLevel,
            `Auto-detected by rule: ${detectionResult.ruleName}`
          );

          // Mark as auto-detected
          const config = this.readOnlyCollections.get(collectionId)!;
          config.autoDetected = true;
          config.reason = `Auto-detected by rule: ${detectionResult.ruleName}`;

          detectedCollections.push(collectionId);
        }
      }
    }

    if (detectedCollections.length > 0) {
      this.stats.autoDetectedCollections += detectedCollections.length;
      this.stats.lastAutoDetection = new Date();
      this.updateStats();

      this.logger.info(`Auto-detected ${detectedCollections.length} read-only collections: ${detectedCollections.join(', ')}`);
    }

    return detectedCollections;
  }

  public addDetectionRule(rule: AutoDetectionRule): void {
    this.detectionRules.set(rule.name, rule);
    this.logger.info(`Detection rule '${rule.name}' added`);
  }

  public removeDetectionRule(ruleName: string): void {
    const removed = this.detectionRules.delete(ruleName);

    if (removed) {
      this.logger.info(`Detection rule '${ruleName}' removed`);
    }
  }

  public getDetectionRules(): AutoDetectionRule[] {
    return Array.from(this.detectionRules.values());
  }

  public async updateProtectionLevel(
    collectionId: string,
    protectionLevel: ProtectionLevel
  ): Promise<void> {
    const config = this.readOnlyCollections.get(collectionId);

    if (!config) {
      throw new Error(`Collection ${collectionId} is not read-only`);
    }

    config.protectionLevel = protectionLevel;
    config.updatedAt = new Date();

    this.logger.info(`Protection level for ${collectionId} updated to ${protectionLevel}`);
  }

  public async bulkUpdateConfigurations(
    updates: Map<string, Partial<ReadOnlyCollectionConfig>>
  ): Promise<void> {
    let updatedCount = 0;

    for (const [collectionId, update] of updates) {
      const config = this.readOnlyCollections.get(collectionId);

      if (config) {
        Object.assign(config, update, { updatedAt: new Date() });
        updatedCount++;
      }
    }

    this.updateStats();
    this.logger.info(`Bulk updated ${updatedCount} read-only collection configurations`);
  }

  public getStats(): ReadOnlyCollectionStats {
    return { ...this.stats };
  }

  public onWriteOperation(callback: WriteOperationCallback): void {
    this.writeOperationCallbacks.add(callback);
  }

  public offWriteOperation(callback: WriteOperationCallback): void {
    this.writeOperationCallbacks.delete(callback);
  }

  public exportConfigurations(): Record<string, ReadOnlyCollectionConfig> {
    const exported: Record<string, ReadOnlyCollectionConfig> = {};

    for (const [collectionId, config] of this.readOnlyCollections) {
      exported[collectionId] = { ...config };
    }

    return exported;
  }

  public async importConfigurations(
    configurations: Record<string, ReadOnlyCollectionConfig>,
    merge = true
  ): Promise<void> {
    if (!merge) {
      this.readOnlyCollections.clear();
    }

    let importedCount = 0;

    for (const [collectionId, config] of Object.entries(configurations)) {
      this.readOnlyCollections.set(collectionId, {
        ...config,
        updatedAt: new Date()
      });
      importedCount++;
    }

    this.updateStats();
    this.logger.info(`Imported ${importedCount} read-only collection configurations (merge: ${merge})`);
  }

  public async clearAllConfigurations(): Promise<void> {
    const count = this.readOnlyCollections.size;
    this.readOnlyCollections.clear();
    this.updateStats();

    this.logger.info(`Cleared ${count} read-only collection configurations`);
  }

  public async forceAutoDetection(): Promise<string[]> {
    this.logger.info('Forcing auto-detection of read-only collections');
    return await this.autoDetectReadOnlyCollections();
  }

  // Private helper methods

  private initializeDefaultDetectionRules(): void {
    // Rule for external adapter collections
    this.addDetectionRule({
      name: 'external-adapter-rule',
      description: 'Detect collections from external adapters (MongoDB, Google Sheets, etc.)',
      condition: (collectionId: string) => {
        return collectionId.includes('external-') ||
               collectionId.includes('mongodb-') ||
               collectionId.includes('sheets-') ||
               collectionId.includes('markdown-');
      },
      protectionLevel: ProtectionLevel.STRICT,
      priority: 100,
      enabled: true
    });

    // Rule for backup collections
    this.addDetectionRule({
      name: 'backup-collection-rule',
      description: 'Detect backup collections',
      condition: (collectionId: string) => {
        return collectionId.includes('backup') ||
               collectionId.includes('archive') ||
               collectionId.endsWith('_bak');
      },
      protectionLevel: ProtectionLevel.STRICT,
      priority: 90,
      enabled: true
    });

    // Rule for read-only suffix
    this.addDetectionRule({
      name: 'readonly-suffix-rule',
      description: 'Detect collections with read-only suffix',
      condition: (collectionId: string) => {
        return collectionId.endsWith('_readonly') ||
               collectionId.endsWith('_ro') ||
               collectionId.startsWith('readonly_');
      },
      protectionLevel: ProtectionLevel.STRICT,
      priority: 80,
      enabled: true
    });
  }

  private evaluateWriteOperation(
    config: ReadOnlyCollectionConfig,
    operation: WriteOperation
  ): WriteValidationResult {
    switch (config.protectionLevel) {
      case ProtectionLevel.DISABLED:
        return {
          allowed: true,
          reason: 'Protection disabled',
          protectionLevel: config.protectionLevel
        };

      case ProtectionLevel.WARNING:
        return {
          allowed: true,
          reason: 'Operation allowed with warning',
          protectionLevel: config.protectionLevel,
          suggestedAction: 'Consider if this write operation is necessary'
        };

      case ProtectionLevel.STRICT:
        return {
          allowed: false,
          reason: 'Collection is strictly read-only',
          protectionLevel: config.protectionLevel,
          suggestedAction: 'Use a writable collection or remove read-only protection'
        };

      case ProtectionLevel.CUSTOM:
        return this.evaluateCustomRules(config, operation);

      default:
        return {
          allowed: false,
          reason: 'Unknown protection level',
          protectionLevel: config.protectionLevel
        };
    }
  }

  private evaluateCustomRules(
    config: ReadOnlyCollectionConfig,
    operation: WriteOperation
  ): WriteValidationResult {
    // Check allowed operations
    if (config.allowedOperations && config.allowedOperations.includes(operation.type)) {
      return {
        allowed: true,
        reason: `Operation ${operation.type} is explicitly allowed`,
        protectionLevel: config.protectionLevel
      };
    }

    // Check blocked operations
    if (config.blockedOperations && config.blockedOperations.includes(operation.type)) {
      return {
        allowed: false,
        reason: `Operation ${operation.type} is explicitly blocked`,
        protectionLevel: config.protectionLevel
      };
    }

    // Default to strict if no custom rules match
    return {
      allowed: false,
      reason: 'No custom rules matched, defaulting to strict protection',
      protectionLevel: config.protectionLevel
    };
  }

  private runDetectionRules(collectionId: string): { ruleName: string; protectionLevel: ProtectionLevel } | null {
    const enabledRules = Array.from(this.detectionRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      try {
        if (rule.condition(collectionId)) {
          return {
            ruleName: rule.name,
            protectionLevel: rule.protectionLevel
          };
        }
      } catch (error) {
        this.logger.error(`Error in detection rule '${rule.name}':`, error);
      }
    }

    return null;
  }

  private async getAvailableCollections(): Promise<string[]> {
    // This would need integration with Collection Store to get actual collections
    // For now, return empty array - this would be implemented when integrating with the main system
    return [];
  }

  private startAutoDetection(): void {
    if (this.autoDetectionTimer) {
      return;
    }

    this.autoDetectionTimer = setInterval(async () => {
      try {
        await this.autoDetectReadOnlyCollections();
      } catch (error) {
        this.logger.error('Error during auto-detection:', error);
      }
    }, this.managerConfig.autoDetectionInterval);

    this.logger.info(`Auto-detection started with ${this.managerConfig.autoDetectionInterval}ms interval`);
  }

  private stopAutoDetection(): void {
    if (this.autoDetectionTimer) {
      clearInterval(this.autoDetectionTimer);
      this.autoDetectionTimer = undefined;
      this.logger.info('Auto-detection stopped');
    }
  }

  private restartAutoDetection(): void {
    this.stopAutoDetection();
    if (this.managerConfig.enableAutoDetection) {
      this.startAutoDetection();
    }
  }

  private emitWriteOperationEvent(event: WriteOperationEvent): void {
    for (const callback of this.writeOperationCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in write operation callback:', error);
      }
    }
  }

  private updateStats(): void {
    this.stats.totalCollections = this.readOnlyCollections.size;
    this.stats.readOnlyCollections = this.readOnlyCollections.size;
    this.stats.protectedCollections = Array.from(this.readOnlyCollections.values())
      .filter(config => config.protectionLevel !== ProtectionLevel.DISABLED).length;
  }

  private loadReadOnlyCollections(collections: any[]): void {
    for (const collection of collections) {
      if (collection.collectionId) {
        const config: ReadOnlyCollectionConfig = {
          collectionId: collection.collectionId,
          protectionLevel: collection.protectionLevel || this.managerConfig.defaultProtectionLevel,
          allowedOperations: collection.allowedOperations,
          blockedOperations: collection.blockedOperations,
          autoDetected: collection.autoDetected || false,
          reason: collection.reason,
          metadata: collection.metadata,
          createdAt: new Date(collection.createdAt || Date.now()),
          updatedAt: new Date(collection.updatedAt || Date.now())
        };

        this.readOnlyCollections.set(collection.collectionId, config);
      }
    }
  }

  private loadDetectionRules(rules: any[]): void {
    this.detectionRules.clear();
    this.initializeDefaultDetectionRules();

    for (const rule of rules) {
      if (rule.name && rule.condition) {
        this.addDetectionRule({
          name: rule.name,
          description: rule.description || '',
          condition: rule.condition,
          protectionLevel: rule.protectionLevel || ProtectionLevel.STRICT,
          priority: rule.priority || 50,
          enabled: rule.enabled !== false
        });
      }
    }
  }
}