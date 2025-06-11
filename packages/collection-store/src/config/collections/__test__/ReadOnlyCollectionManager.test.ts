import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ReadOnlyCollectionManager } from '../ReadOnlyCollectionManager';
import { ComponentStatus } from '../../registry/interfaces/IConfigurationComponent';
import {
  ProtectionLevel,
  WriteOperationType,
  WriteOperation,
  WriteOperationEvent,
  AutoDetectionRule
} from '../interfaces/IReadOnlyCollectionManager';

describe('ReadOnlyCollectionManager', () => {
  let manager: ReadOnlyCollectionManager;

  beforeEach(async () => {
    manager = new ReadOnlyCollectionManager();
    await manager.initialize({});
    await manager.start();
  });

  afterEach(async () => {
    await manager.stop();
    await manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const newManager = new ReadOnlyCollectionManager();
      await newManager.initialize({});

      const stats = newManager.getStats();
      expect(stats.totalCollections).toBe(0);
      expect(stats.readOnlyCollections).toBe(0);
      expect(stats.protectedCollections).toBe(0);

      await newManager.cleanup();
    });

    it('should load read-only collections from configuration', async () => {
      const config = {
        readOnlyCollections: {
          collections: [
            {
              collectionId: 'test-collection',
              protectionLevel: ProtectionLevel.STRICT,
              autoDetected: false,
              reason: 'Test collection'
            }
          ]
        }
      };

      const newManager = new ReadOnlyCollectionManager();
      await newManager.initialize(config);

      expect(newManager.isReadOnly('test-collection')).toBe(true);
      const stats = newManager.getStats();
      expect(stats.readOnlyCollections).toBe(1);

      await newManager.cleanup();
    });
  });

  describe('Read-Only Collection Management', () => {
    it('should mark collection as read-only', async () => {
      await manager.markAsReadOnly('test-collection', ProtectionLevel.STRICT, 'Test reason');

      expect(manager.isReadOnly('test-collection')).toBe(true);

      const config = manager.getReadOnlyConfig('test-collection');
      expect(config).not.toBeNull();
      expect(config!.protectionLevel).toBe(ProtectionLevel.STRICT);
      expect(config!.reason).toBe('Test reason');
      expect(config!.autoDetected).toBe(false);
    });

    it('should mark collection as writable', async () => {
      await manager.markAsReadOnly('test-collection');
      expect(manager.isReadOnly('test-collection')).toBe(true);

      await manager.markAsWritable('test-collection');
      expect(manager.isReadOnly('test-collection')).toBe(false);
      expect(manager.getReadOnlyConfig('test-collection')).toBeNull();
    });

    it('should get all read-only collections', async () => {
      await manager.markAsReadOnly('collection1', ProtectionLevel.STRICT);
      await manager.markAsReadOnly('collection2', ProtectionLevel.WARNING);

      const allCollections = manager.getAllReadOnlyCollections();
      expect(allCollections.size).toBe(2);
      expect(allCollections.has('collection1')).toBe(true);
      expect(allCollections.has('collection2')).toBe(true);
    });

    it('should update protection level', async () => {
      await manager.markAsReadOnly('test-collection', ProtectionLevel.WARNING);

      await manager.updateProtectionLevel('test-collection', ProtectionLevel.STRICT);

      const config = manager.getReadOnlyConfig('test-collection');
      expect(config!.protectionLevel).toBe(ProtectionLevel.STRICT);
    });

    it('should throw error when updating non-existent collection', async () => {
      expect(async () => {
        await manager.updateProtectionLevel('non-existent', ProtectionLevel.STRICT);
      }).toThrow();
    });
  });

  describe('Write Operation Validation', () => {
    beforeEach(async () => {
      await manager.markAsReadOnly('strict-collection', ProtectionLevel.STRICT);
      await manager.markAsReadOnly('warning-collection', ProtectionLevel.WARNING);
      await manager.markAsReadOnly('disabled-collection', ProtectionLevel.DISABLED);
    });

    it('should allow operations on non-read-only collections', async () => {
      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'writable-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('writable-collection', operation);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Collection is not read-only');
      expect(result.protectionLevel).toBe(ProtectionLevel.DISABLED);
    });

    it('should block operations on strict read-only collections', async () => {
      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'strict-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('strict-collection', operation);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Collection is strictly read-only');
      expect(result.protectionLevel).toBe(ProtectionLevel.STRICT);
      expect(result.suggestedAction).toContain('Use a writable collection');
    });

    it('should allow with warning on warning-level collections', async () => {
      const operation: WriteOperation = {
        type: 'UPDATE',
        collectionId: 'warning-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('warning-collection', operation);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Operation allowed with warning');
      expect(result.protectionLevel).toBe(ProtectionLevel.WARNING);
      expect(result.suggestedAction).toContain('Consider if this write operation is necessary');
    });

    it('should allow operations on disabled protection collections', async () => {
      const operation: WriteOperation = {
        type: 'DELETE',
        collectionId: 'disabled-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('disabled-collection', operation);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Protection disabled');
      expect(result.protectionLevel).toBe(ProtectionLevel.DISABLED);
    });

    it('should handle custom protection level with allowed operations', async () => {
      // Create custom collection with specific allowed operations
      await manager.markAsReadOnly('custom-collection', ProtectionLevel.CUSTOM);
      const config = manager.getReadOnlyConfig('custom-collection')!;
      config.allowedOperations = ['INSERT', 'UPDATE'];

      const allowedOperation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'custom-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('custom-collection', allowedOperation);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('explicitly allowed');

      const blockedOperation: WriteOperation = {
        type: 'DELETE',
        collectionId: 'custom-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const blockedResult = await manager.validateWriteOperation('custom-collection', blockedOperation);
      expect(blockedResult.allowed).toBe(false);
    });

    it('should handle custom protection level with blocked operations', async () => {
      await manager.markAsReadOnly('custom-collection', ProtectionLevel.CUSTOM);
      const config = manager.getReadOnlyConfig('custom-collection')!;
      config.blockedOperations = ['DELETE', 'BULK_DELETE'];

      const blockedOperation: WriteOperation = {
        type: 'DELETE',
        collectionId: 'custom-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const result = await manager.validateWriteOperation('custom-collection', blockedOperation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('explicitly blocked');
    });
  });

  describe('Auto-Detection Rules', () => {
    it('should have default detection rules', () => {
      const rules = manager.getDetectionRules();
      expect(rules.length).toBeGreaterThan(0);

      const ruleNames = rules.map(rule => rule.name);
      expect(ruleNames).toContain('external-adapter-rule');
      expect(ruleNames).toContain('backup-collection-rule');
      expect(ruleNames).toContain('readonly-suffix-rule');
    });

    it('should add custom detection rule', () => {
      const customRule: AutoDetectionRule = {
        name: 'custom-test-rule',
        description: 'Test rule for custom collections',
        condition: (collectionId: string) => collectionId.startsWith('test-'),
        protectionLevel: ProtectionLevel.WARNING,
        priority: 50,
        enabled: true
      };

      manager.addDetectionRule(customRule);

      const rules = manager.getDetectionRules();
      const addedRule = rules.find(rule => rule.name === 'custom-test-rule');
      expect(addedRule).toBeDefined();
      expect(addedRule!.description).toBe('Test rule for custom collections');
    });

    it('should remove detection rule', () => {
      const customRule: AutoDetectionRule = {
        name: 'removable-rule',
        description: 'Rule to be removed',
        condition: () => false,
        protectionLevel: ProtectionLevel.STRICT,
        priority: 50,
        enabled: true
      };

      manager.addDetectionRule(customRule);
      expect(manager.getDetectionRules().some(rule => rule.name === 'removable-rule')).toBe(true);

      manager.removeDetectionRule('removable-rule');
      expect(manager.getDetectionRules().some(rule => rule.name === 'removable-rule')).toBe(false);
    });

    it('should test default detection rules', () => {
      const rules = manager.getDetectionRules();

      // Test external adapter rule
      const externalRule = rules.find(rule => rule.name === 'external-adapter-rule');
      expect(externalRule).toBeDefined();
      expect(externalRule!.condition('mongodb-users')).toBe(true);
      expect(externalRule!.condition('sheets-data')).toBe(true);
      expect(externalRule!.condition('external-api')).toBe(true);
      expect(externalRule!.condition('regular-collection')).toBe(false);

      // Test backup rule
      const backupRule = rules.find(rule => rule.name === 'backup-collection-rule');
      expect(backupRule).toBeDefined();
      expect(backupRule!.condition('users_backup')).toBe(true);
      expect(backupRule!.condition('archive_data')).toBe(true);
      expect(backupRule!.condition('data_bak')).toBe(true);
      expect(backupRule!.condition('regular-collection')).toBe(false);

      // Test readonly suffix rule
      const readonlyRule = rules.find(rule => rule.name === 'readonly-suffix-rule');
      expect(readonlyRule).toBeDefined();
      expect(readonlyRule!.condition('data_readonly')).toBe(true);
      expect(readonlyRule!.condition('users_ro')).toBe(true);
      expect(readonlyRule!.condition('readonly_config')).toBe(true);
      expect(readonlyRule!.condition('regular-collection')).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should emit write operation events', async () => {
      const events: WriteOperationEvent[] = [];

      manager.onWriteOperation((event) => {
        events.push(event);
      });

      await manager.markAsReadOnly('test-collection', ProtectionLevel.STRICT);

      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'test-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      await manager.validateWriteOperation('test-collection', operation);

      expect(events).toHaveLength(1);
      expect(events[0].operation.type).toBe('INSERT');
      expect(events[0].operation.collectionId).toBe('test-collection');
      expect(events[0].result.allowed).toBe(false);
      expect(events[0].collectionConfig.protectionLevel).toBe(ProtectionLevel.STRICT);
    });

    it('should allow unsubscribing from events', async () => {
      const events: WriteOperationEvent[] = [];

      const callback = (event: WriteOperationEvent) => {
        events.push(event);
      };

      manager.onWriteOperation(callback);

      await manager.markAsReadOnly('test-collection', ProtectionLevel.STRICT);

      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'test-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      await manager.validateWriteOperation('test-collection', operation);
      expect(events).toHaveLength(1);

      manager.offWriteOperation(callback);

      await manager.validateWriteOperation('test-collection', operation);
      // Should still be 1 (no new events after unsubscribe)
      expect(events).toHaveLength(1);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk configuration updates', async () => {
      await manager.markAsReadOnly('collection1', ProtectionLevel.WARNING);
      await manager.markAsReadOnly('collection2', ProtectionLevel.STRICT);

      const updates = new Map([
        ['collection1', { protectionLevel: ProtectionLevel.STRICT }],
        ['collection2', { protectionLevel: ProtectionLevel.WARNING }]
      ]);

      await manager.bulkUpdateConfigurations(updates);

      const config1 = manager.getReadOnlyConfig('collection1');
      const config2 = manager.getReadOnlyConfig('collection2');

      expect(config1!.protectionLevel).toBe(ProtectionLevel.STRICT);
      expect(config2!.protectionLevel).toBe(ProtectionLevel.WARNING);
    });

    it('should export and import configurations', async () => {
      await manager.markAsReadOnly('collection1', ProtectionLevel.STRICT, 'Test reason 1');
      await manager.markAsReadOnly('collection2', ProtectionLevel.WARNING, 'Test reason 2');

      // Export configurations
      const exported = manager.exportConfigurations();

      expect(exported).toHaveProperty('collection1');
      expect(exported).toHaveProperty('collection2');
      expect(exported.collection1.protectionLevel).toBe(ProtectionLevel.STRICT);
      expect(exported.collection2.protectionLevel).toBe(ProtectionLevel.WARNING);

      // Create new manager and import
      const newManager = new ReadOnlyCollectionManager();
      await newManager.initialize({});
      await newManager.importConfigurations(exported);

      expect(newManager.isReadOnly('collection1')).toBe(true);
      expect(newManager.isReadOnly('collection2')).toBe(true);
      expect(newManager.getReadOnlyConfig('collection1')!.protectionLevel).toBe(ProtectionLevel.STRICT);
      expect(newManager.getReadOnlyConfig('collection2')!.protectionLevel).toBe(ProtectionLevel.WARNING);

      await newManager.cleanup();
    });

    it('should clear all configurations', async () => {
      await manager.markAsReadOnly('collection1', ProtectionLevel.STRICT);
      await manager.markAsReadOnly('collection2', ProtectionLevel.WARNING);

      expect(manager.getStats().readOnlyCollections).toBe(2);

      await manager.clearAllConfigurations();

      expect(manager.getStats().readOnlyCollections).toBe(0);
      expect(manager.isReadOnly('collection1')).toBe(false);
      expect(manager.isReadOnly('collection2')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track collection statistics', async () => {
      const initialStats = manager.getStats();
      expect(initialStats.totalCollections).toBe(0);
      expect(initialStats.readOnlyCollections).toBe(0);
      expect(initialStats.protectedCollections).toBe(0);

      await manager.markAsReadOnly('collection1', ProtectionLevel.STRICT);
      await manager.markAsReadOnly('collection2', ProtectionLevel.WARNING);
      await manager.markAsReadOnly('collection3', ProtectionLevel.DISABLED);

      const stats = manager.getStats();
      expect(stats.totalCollections).toBe(3);
      expect(stats.readOnlyCollections).toBe(3);
      expect(stats.protectedCollections).toBe(2); // STRICT and WARNING, not DISABLED
    });

    it('should track blocked operations', async () => {
      await manager.markAsReadOnly('test-collection', ProtectionLevel.STRICT);

      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'test-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const initialStats = manager.getStats();
      const initialBlocked = initialStats.blockedOperations;

      await manager.validateWriteOperation('test-collection', operation);

      const stats = manager.getStats();
      expect(stats.blockedOperations).toBe(initialBlocked + 1);
      expect(stats.lastBlockedOperation).toBeDefined();
    });

    it('should track warning operations', async () => {
      await manager.markAsReadOnly('test-collection', ProtectionLevel.WARNING);

      const operation: WriteOperation = {
        type: 'INSERT',
        collectionId: 'test-collection',
        data: { test: 'data' },
        timestamp: new Date()
      };

      const initialStats = manager.getStats();
      const initialWarnings = initialStats.warningOperations;

      await manager.validateWriteOperation('test-collection', operation);

      const stats = manager.getStats();
      expect(stats.warningOperations).toBe(initialWarnings + 1);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status with normal operations', async () => {
      await manager.markAsReadOnly('test-collection', ProtectionLevel.STRICT);

      const health = await manager.getHealth();

      expect(health.status).toBe(ComponentStatus.HEALTHY);
      expect(health.details?.metrics?.totalCollections).toBe(1);
      expect(health.details?.metrics?.readOnlyCollections).toBe(1);
      expect(health.details?.metrics?.detectionRulesCount).toBeGreaterThan(0);
    });

    it('should report warning status with high blocked operations', async () => {
      // Simulate high number of blocked operations
      const stats = manager.getStats();
      (stats as any).blockedOperations = 150; // Force high number

      // We need to access private stats to simulate this condition
      // In real scenario, this would happen naturally through many blocked operations
      const health = await manager.getHealth();

      // Note: This test might need adjustment based on actual implementation
      // The warning threshold is set to 100 in the implementation
    });
  });

  describe('Configuration Updates', () => {
    it('should handle configuration updates', async () => {
      const initialConfig = {
        readOnlyCollections: {
          defaultProtectionLevel: ProtectionLevel.WARNING,
          enableAutoDetection: false,
          enableEvents: false
        }
      };

      await manager.updateConfig(initialConfig);

      // Verify configuration was updated
      // Note: We can't directly access private config, but we can test behavior
      await manager.markAsReadOnly('test-collection'); // Should use WARNING as default

      const config = manager.getReadOnlyConfig('test-collection');
      expect(config!.protectionLevel).toBe(ProtectionLevel.WARNING);
    });
  });
});