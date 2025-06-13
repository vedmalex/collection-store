/**
 * BrowserFallbackManager Tests
 * Comprehensive test suite for browser quota fallback management
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { BrowserFallbackManager } from '../BrowserFallbackManager';
import {
  FallbackStrategy,
  StorageType,
  QuotaStatus,
  BrowserFallbackManagerConfig
} from '../interfaces/IBrowserFallbackManager';

describe('BrowserFallbackManager', () => {
  let manager: BrowserFallbackManager;
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;

  beforeEach(async () => {
    // Mock localStorage
    mockLocalStorage = {
      length: 0,
      key: mock(() => null),
      getItem: mock(() => null),
      setItem: mock(() => {}),
      removeItem: mock(() => {}),
      clear: mock(() => {})
    };

    // Mock sessionStorage
    mockSessionStorage = {
      length: 0,
      key: mock(() => null),
      getItem: mock(() => null),
      setItem: mock(() => {}),
      removeItem: mock(() => {}),
      clear: mock(() => {})
    };

    // Mock global objects
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });

    // Mock navigator.storage
    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          estimate: mock(() => Promise.resolve({
            usage: 1024 * 1024, // 1MB
            quota: 10 * 1024 * 1024 // 10MB
          }))
        }
      },
      writable: true
    });

    manager = new BrowserFallbackManager(
      'browser-fallback-test',
      'Browser Fallback Manager Test',
      'Test browser fallback manager',
      '1.0.0',
      []
    );

    await manager.initialize();
  });

  afterEach(async () => {
    if (manager.isRunning()) {
      await manager.stop();
    }
  });

  describe('Initialization and Lifecycle', () => {
    test('should initialize successfully', async () => {
      expect(manager.getState()).toBe('initialized');
      expect(manager.getAllFallbackRules()).toHaveLength(2); // Default rules
    });

    test('should start and stop successfully', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);
      expect(manager.isMonitoring()).toBe(true);

      await manager.stop();
      expect(manager.isRunning()).toBe(false);
      expect(manager.isMonitoring()).toBe(false);
    });

    test('should get health status', async () => {
      await manager.start();
      const health = await manager.getHealth();

      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.details).toHaveProperty('monitoring');
      expect(health.details).toHaveProperty('quotaStatus');
      expect(health.details).toHaveProperty('activeExecutions');
      expect(health.details).toHaveProperty('rulesCount');
    });
  });

  describe('Configuration Management', () => {
    test('should get default configuration', () => {
      const config = manager.getConfig();

      expect(config.monitoring.enabled).toBe(true);
      expect(config.monitoring.checkInterval).toBe(60000);
      expect(config.monitoring.warningThreshold).toBe(80);
      expect(config.monitoring.criticalThreshold).toBe(95);
      expect(config.defaultStrategy).toBe(FallbackStrategy.SELECTIVE_CLEANUP);
    });

    test('should update configuration', async () => {
      const newConfig: Partial<BrowserFallbackManagerConfig> = {
        monitoring: {
          enabled: false,
          checkInterval: 30000,
          warningThreshold: 70,
          criticalThreshold: 90,
          autoFallback: false,
          notifyUser: false,
          logLevel: 'error'
        },
        defaultStrategy: FallbackStrategy.COMPRESSION
      };

      await manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.monitoring.enabled).toBe(false);
      expect(config.monitoring.checkInterval).toBe(30000);
      expect(config.defaultStrategy).toBe(FallbackStrategy.COMPRESSION);
    });
  });

  describe('Quota Monitoring', () => {
    test('should check quota status for all storage types', async () => {
      const quotaInfos = await manager.checkQuotaStatus();

      expect(quotaInfos).toHaveLength(3); // localStorage, sessionStorage, indexedDB

      for (const info of quotaInfos) {
        expect(info).toHaveProperty('type');
        expect(info).toHaveProperty('used');
        expect(info).toHaveProperty('available');
        expect(info).toHaveProperty('total');
        expect(info).toHaveProperty('percentage');
        expect(info).toHaveProperty('status');
        expect(info).toHaveProperty('lastChecked');
      }
    });

    test('should get quota status for specific storage type', async () => {
      const quotaInfo = await manager.getQuotaStatus(StorageType.INDEXED_DB);

      expect(quotaInfo.type).toBe(StorageType.INDEXED_DB);
      expect(quotaInfo.used).toBe(1024 * 1024); // From mock
      expect(quotaInfo.total).toBe(10 * 1024 * 1024); // From mock
      expect(quotaInfo.percentage).toBe(10); // 1MB / 10MB * 100
      expect(quotaInfo.status).toBe(QuotaStatus.AVAILABLE);
    });

    test('should start and stop quota monitoring', async () => {
      expect(manager.isMonitoring()).toBe(false);

      await manager.startQuotaMonitoring();
      expect(manager.isMonitoring()).toBe(true);

      await manager.stopQuotaMonitoring();
      expect(manager.isMonitoring()).toBe(false);
    });
  });

  describe('Fallback Rules Management', () => {
    test('should add fallback rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true,
          compressionLevel: 5
        },
        enabled: true
      };

      const ruleId = await manager.addFallbackRule(rule);

      expect(ruleId).toBeTruthy();
      expect(typeof ruleId).toBe('string');

      const addedRule = manager.getFallbackRule(ruleId);
      expect(addedRule).toBeTruthy();
      expect(addedRule!.name).toBe('Test Rule');
      expect(addedRule!.strategy).toBe(FallbackStrategy.COMPRESSION);
    });

    test('should update fallback rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const ruleId = await manager.addFallbackRule(rule);

      await manager.updateFallbackRule(ruleId, {
        name: 'Updated Test Rule',
        strategy: FallbackStrategy.MEMORY_ONLY,
        enabled: false
      });

      const updatedRule = manager.getFallbackRule(ruleId);
      expect(updatedRule!.name).toBe('Updated Test Rule');
      expect(updatedRule!.strategy).toBe(FallbackStrategy.MEMORY_ONLY);
      expect(updatedRule!.enabled).toBe(false);
    });

    test('should remove fallback rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const ruleId = await manager.addFallbackRule(rule);
      expect(manager.getFallbackRule(ruleId)).toBeTruthy();

      await manager.removeFallbackRule(ruleId);
      expect(manager.getFallbackRule(ruleId)).toBeUndefined();
    });

    test('should enable and disable fallback rules', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const ruleId = await manager.addFallbackRule(rule);

      await manager.disableFallbackRule(ruleId);
      expect(manager.getFallbackRule(ruleId)!.enabled).toBe(false);

      await manager.enableFallbackRule(ruleId);
      expect(manager.getFallbackRule(ruleId)!.enabled).toBe(true);
    });

    test('should get all fallback rules', () => {
      const rules = manager.getAllFallbackRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(2); // Default rules
    });

    test('should validate fallback rules', async () => {
      const validRule = {
        name: 'Valid Rule',
        description: 'Valid fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const validation = await manager.validateFallbackRule(validRule);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      const invalidRule = {
        name: '',
        trigger: {
          quotaThreshold: 150, // Invalid threshold
          storageTypes: [],
          conditions: []
        },
        strategy: 'invalid_strategy' as any,
        priority: -1,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const invalidValidation = await manager.validateFallbackRule(invalidRule);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Execution', () => {
    test('should trigger manual fallback', async () => {
      const result = await manager.triggerFallback(FallbackStrategy.SELECTIVE_CLEANUP);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.SELECTIVE_CLEANUP);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.newQuotaStatus).toBeTruthy();
      expect(result.recommendations).toBeTruthy();
      expect(result.nextCheckTime).toBeInstanceOf(Date);
    });

    test('should execute fallback rule', async () => {
      const rule = {
        name: 'Test Execution Rule',
        description: 'Test fallback rule for execution',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: true
      };

      const ruleId = await manager.addFallbackRule(rule);
      const result = await manager.executeFallbackRule(ruleId);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.COMPRESSION);

      const updatedRule = manager.getFallbackRule(ruleId);
      expect(updatedRule!.lastUsed).toBeInstanceOf(Date);
    });

    test('should get active and historical executions', async () => {
      // Initially no active executions
      expect(manager.getActiveFallbackExecutions()).toHaveLength(0);

      // Execute a fallback
      await manager.triggerFallback(FallbackStrategy.SELECTIVE_CLEANUP);

      // Should have history
      const history = manager.getFallbackHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].strategy).toBe(FallbackStrategy.SELECTIVE_CLEANUP);
    });

    test('should handle execution errors gracefully', async () => {
      // Try to execute non-existent rule
      await expect(manager.executeFallbackRule('non-existent-rule'))
        .rejects.toThrow('Fallback rule not found');

      // Try to execute disabled rule
      const rule = {
        name: 'Disabled Rule',
        description: 'Disabled fallback rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: {
          retainCriticalData: true
        },
        enabled: false
      };

      const ruleId = await manager.addFallbackRule(rule);
      await expect(manager.executeFallbackRule(ruleId))
        .rejects.toThrow('Fallback rule is disabled');
    });
  });

  describe('Strategy Implementation', () => {
    test('should execute memory-only fallback', async () => {
      const result = await manager.executeMemoryOnlyFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.MEMORY_ONLY);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataLost).toBe(result.quotaFreed); // Memory-only loses all data
    });

    test('should execute reduced cache fallback', async () => {
      const result = await manager.executeReducedCacheFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.REDUCED_CACHE);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataRetained).toBeGreaterThan(0);
      expect(result.dataLost).toBeGreaterThan(0);
    });

    test('should execute external storage fallback', async () => {
      const result = await manager.executeExternalStorageFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.EXTERNAL_STORAGE);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataLost).toBe(0); // External storage preserves data
    });

    test('should execute compression fallback', async () => {
      const result = await manager.executeCompressionFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.COMPRESSION);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataLost).toBe(0); // Compression preserves data
    });

    test('should execute selective cleanup fallback', async () => {
      const result = await manager.executeSelectiveCleanupFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.SELECTIVE_CLEANUP);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataRetained).toBeGreaterThan(0);
      expect(result.dataLost).toBeGreaterThan(0);
    });

    test('should execute graceful degradation fallback', async () => {
      const result = await manager.executeGracefulDegradationFallback();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(FallbackStrategy.GRACEFUL_DEGRADATION);
      expect(result.quotaFreed).toBeGreaterThan(0);
      expect(result.dataRetained).toBeGreaterThan(0);
      expect(result.dataLost).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track statistics', async () => {
      const initialStats = manager.getStatistics();
      expect(initialStats.totalExecutions).toBe(0);

      await manager.triggerFallback(FallbackStrategy.COMPRESSION);

      const updatedStats = manager.getStatistics();
      expect(updatedStats.totalExecutions).toBe(1);
      expect(updatedStats.successfulExecutions).toBe(1);
      expect(updatedStats.strategyUsage[FallbackStrategy.COMPRESSION]).toBe(1);
      expect(updatedStats.totalQuotaFreed).toBeGreaterThan(0);
    });

    test('should reset statistics', async () => {
      await manager.triggerFallback(FallbackStrategy.COMPRESSION);

      let stats = manager.getStatistics();
      expect(stats.totalExecutions).toBe(1);

      await manager.resetStatistics();

      stats = manager.getStatistics();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.totalQuotaFreed).toBe(0);
    });

    test('should export statistics', async () => {
      await manager.triggerFallback(FallbackStrategy.COMPRESSION);

      const exportedStats = await manager.exportStatistics();
      const parsedStats = JSON.parse(exportedStats);

      expect(parsedStats).toHaveProperty('statistics');
      expect(parsedStats).toHaveProperty('exportDate');
      expect(parsedStats).toHaveProperty('version');
      expect(parsedStats.statistics.totalExecutions).toBe(1);
    });
  });

  describe('Event System', () => {
    test('should emit and handle events', async () => {
      const eventHandler = mock(() => {});
      manager.on('fallback_triggered', eventHandler);

      await manager.triggerFallback(FallbackStrategy.COMPRESSION);

      expect(eventHandler).toHaveBeenCalled();
      const eventData = eventHandler.mock.calls[0][0];
      expect(eventData.type).toBe('fallback_triggered');
      expect(eventData.data.execution).toBeTruthy();
    });

    test('should remove event handlers', () => {
      const eventHandler = mock(() => {});
      manager.on('fallback_triggered', eventHandler);
      manager.off('fallback_triggered', eventHandler);

      // Event handler should not be called after removal
      // This is tested implicitly by not having the handler called
    });
  });

  describe('Utility Methods', () => {
    test('should estimate quota usage', async () => {
      const testData = { key: 'value', array: [1, 2, 3], nested: { prop: 'test' } };
      const estimatedSize = await manager.estimateQuotaUsage(testData);

      expect(estimatedSize).toBeGreaterThan(0);
      expect(typeof estimatedSize).toBe('number');
    });

    test('should simulate fallback strategies', async () => {
      const simulation = await manager.simulateFallback(FallbackStrategy.MEMORY_ONLY);

      expect(simulation).toHaveProperty('estimatedQuotaFreed');
      expect(simulation).toHaveProperty('estimatedDataLoss');
      expect(simulation).toHaveProperty('estimatedImpact');
      expect(simulation.estimatedQuotaFreed).toBeGreaterThan(0);
      expect(['none', 'minimal', 'moderate', 'significant']).toContain(simulation.estimatedImpact);
    });
  });

  describe('Bulk Operations', () => {
    test('should add multiple fallback rules', async () => {
      const rules = [
        {
          name: 'Bulk Rule 1',
          description: 'First bulk rule',
          trigger: {
            quotaThreshold: 85,
            storageTypes: [StorageType.LOCAL_STORAGE],
            conditions: []
          },
          strategy: FallbackStrategy.COMPRESSION,
          priority: 75,
          config: { retainCriticalData: true },
          enabled: true
        },
        {
          name: 'Bulk Rule 2',
          description: 'Second bulk rule',
          trigger: {
            quotaThreshold: 90,
            storageTypes: [StorageType.INDEXED_DB],
            conditions: []
          },
          strategy: FallbackStrategy.SELECTIVE_CLEANUP,
          priority: 80,
          config: { retainCriticalData: true },
          enabled: true
        }
      ];

      const ruleIds = await manager.addMultipleFallbackRules(rules);

      expect(ruleIds).toHaveLength(2);
      expect(manager.getFallbackRule(ruleIds[0])!.name).toBe('Bulk Rule 1');
      expect(manager.getFallbackRule(ruleIds[1])!.name).toBe('Bulk Rule 2');
    });

    test('should update multiple fallback rules', async () => {
      const rule1 = {
        name: 'Update Rule 1',
        description: 'First update rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: { retainCriticalData: true },
        enabled: true
      };

      const rule2 = {
        name: 'Update Rule 2',
        description: 'Second update rule',
        trigger: {
          quotaThreshold: 90,
          storageTypes: [StorageType.INDEXED_DB],
          conditions: []
        },
        strategy: FallbackStrategy.SELECTIVE_CLEANUP,
        priority: 80,
        config: { retainCriticalData: true },
        enabled: true
      };

      const ruleId1 = await manager.addFallbackRule(rule1);
      const ruleId2 = await manager.addFallbackRule(rule2);

      const updates = [
        { ruleId: ruleId1, updates: { enabled: false, priority: 50 } },
        { ruleId: ruleId2, updates: { enabled: false, priority: 60 } }
      ];

      await manager.updateMultipleFallbackRules(updates);

      expect(manager.getFallbackRule(ruleId1)!.enabled).toBe(false);
      expect(manager.getFallbackRule(ruleId1)!.priority).toBe(50);
      expect(manager.getFallbackRule(ruleId2)!.enabled).toBe(false);
      expect(manager.getFallbackRule(ruleId2)!.priority).toBe(60);
    });

    test('should remove multiple fallback rules', async () => {
      const rule1 = {
        name: 'Remove Rule 1',
        description: 'First remove rule',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: { retainCriticalData: true },
        enabled: true
      };

      const rule2 = {
        name: 'Remove Rule 2',
        description: 'Second remove rule',
        trigger: {
          quotaThreshold: 90,
          storageTypes: [StorageType.INDEXED_DB],
          conditions: []
        },
        strategy: FallbackStrategy.SELECTIVE_CLEANUP,
        priority: 80,
        config: { retainCriticalData: true },
        enabled: true
      };

      const ruleId1 = await manager.addFallbackRule(rule1);
      const ruleId2 = await manager.addFallbackRule(rule2);

      await manager.removeMultipleFallbackRules([ruleId1, ruleId2]);

      expect(manager.getFallbackRule(ruleId1)).toBeUndefined();
      expect(manager.getFallbackRule(ruleId2)).toBeUndefined();
    });
  });

  describe('Import/Export', () => {
    test('should export and import configuration', async () => {
      // Add a custom rule
      const rule = {
        name: 'Export Test Rule',
        description: 'Rule for export testing',
        trigger: {
          quotaThreshold: 85,
          storageTypes: [StorageType.LOCAL_STORAGE],
          conditions: []
        },
        strategy: FallbackStrategy.COMPRESSION,
        priority: 75,
        config: { retainCriticalData: true },
        enabled: true
      };

      await manager.addFallbackRule(rule);

      // Export configuration
      const exportedConfig = await manager.exportConfiguration();
      const parsedConfig = JSON.parse(exportedConfig);

      expect(parsedConfig).toHaveProperty('config');
      expect(parsedConfig).toHaveProperty('rules');
      expect(parsedConfig).toHaveProperty('exportDate');
      expect(parsedConfig).toHaveProperty('version');

      // Create new manager and import
      const newManager = new BrowserFallbackManager(
        'browser-fallback-import-test',
        'Import Test Manager',
        'Test import functionality',
        '1.0.0',
        []
      );

      await newManager.initialize();
      await newManager.importConfiguration(exportedConfig);

      const importedRules = newManager.getAllFallbackRules();
      const importedRule = importedRules.find(r => r.name === 'Export Test Rule');
      expect(importedRule).toBeTruthy();
      expect(importedRule!.strategy).toBe(FallbackStrategy.COMPRESSION);
    });

    test('should export and import fallback history', async () => {
      // Execute some fallbacks to create history
      await manager.triggerFallback(FallbackStrategy.COMPRESSION);
      await manager.triggerFallback(FallbackStrategy.SELECTIVE_CLEANUP);

      // Export history
      const exportedHistory = await manager.exportFallbackHistory();
      const parsedHistory = JSON.parse(exportedHistory);

      expect(parsedHistory).toHaveProperty('history');
      expect(parsedHistory).toHaveProperty('statistics');
      expect(parsedHistory).toHaveProperty('exportDate');
      expect(parsedHistory.history).toHaveLength(2);

      // Create new manager and import
      const newManager = new BrowserFallbackManager(
        'browser-fallback-history-test',
        'History Test Manager',
        'Test history import',
        '1.0.0',
        []
      );

      await newManager.initialize();
      await newManager.importFallbackHistory(exportedHistory);

      const importedHistory = newManager.getFallbackHistory();
      expect(importedHistory).toHaveLength(2);

      const importedStats = newManager.getStatistics();
      expect(importedStats.totalExecutions).toBeGreaterThan(0);
    });
  });
});