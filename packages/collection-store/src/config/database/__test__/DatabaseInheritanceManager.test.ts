import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseInheritanceManager } from '../DatabaseInheritanceManager';
import {
  DatabaseConfig,
  InheritancePriority,
  InheritanceRule
} from '../interfaces/IDatabaseInheritanceManager';
import { ComponentStatus } from '../../registry/interfaces/IConfigurationComponent';

describe('DatabaseInheritanceManager', () => {
  let manager: DatabaseInheritanceManager;

  beforeEach(async () => {
    manager = new DatabaseInheritanceManager({
      enableInheritance: true,
      enableCaching: true,
      enableEvents: true,
      enableValidation: true
    });
    await manager.initialize({});
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const newManager = new DatabaseInheritanceManager();
      await newManager.initialize({});

      expect(newManager.getState()).toBe('initialized');
      expect(newManager.getInheritanceRules().length).toBeGreaterThan(0);

      await newManager.cleanup();
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        enableInheritance: false,
        enableCaching: false,
        cacheTimeout: 60000
      };

      const newManager = new DatabaseInheritanceManager(customConfig);
      await newManager.initialize({});

      expect(newManager.getState()).toBe('initialized');

      await newManager.cleanup();
    });
  });

  describe('Database Configuration Management', () => {
    it('should set and get database configuration', async () => {
      const databaseConfig: Partial<DatabaseConfig> = {
        name: 'test-database',
        description: 'Test database configuration',
        performance: {
          maxConnections: 200,
          connectionTimeout: 45000
        },
        security: {
          encryption: true,
          accessControl: true
        }
      };

      await manager.setDatabaseConfig('test-db', databaseConfig);
      const retrieved = manager.getDatabaseConfig('test-db');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe('test-database');
      expect(retrieved?.performance?.maxConnections).toBe(200);
      expect(retrieved?.security?.encryption).toBe(true);
    });

    it('should return null for non-existent database', () => {
      const result = manager.getDatabaseConfig('non-existent');
      expect(result).toBeNull();
    });

    it('should get all database configurations', async () => {
      await manager.setDatabaseConfig('db1', { name: 'Database 1' });
      await manager.setDatabaseConfig('db2', { name: 'Database 2' });

      const allConfigs = manager.getAllDatabaseConfigs();
      expect(allConfigs.size).toBe(2);
      expect(allConfigs.has('db1')).toBe(true);
      expect(allConfigs.has('db2')).toBe(true);
    });

    it('should validate database configuration', async () => {
      const invalidConfig: Partial<DatabaseConfig> = {
        performance: {
          maxConnections: -1 // Invalid value
        }
      };

      await expect(manager.setDatabaseConfig('invalid-db', invalidConfig))
        .rejects.toThrow('Invalid database configuration');
    });
  });

  describe('Collection Override Management', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('test-db', {
        name: 'Test Database',
        performance: { maxConnections: 100 }
      });
    });

    it('should add collection override', async () => {
      const override = {
        performance: { maxConnections: 150 }
      };

      await manager.addCollectionOverride('test-db', 'test-collection', override);
      const retrieved = manager.getCollectionOverride('test-db', 'test-collection');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.overrides.performance?.maxConnections).toBe(150);
    });

    it('should remove collection override', async () => {
      const override = {
        performance: { maxConnections: 150 }
      };

      await manager.addCollectionOverride('test-db', 'test-collection', override);
      expect(manager.getCollectionOverride('test-db', 'test-collection')).toBeTruthy();

      await manager.removeCollectionOverride('test-db', 'test-collection');
      expect(manager.getCollectionOverride('test-db', 'test-collection')).toBeNull();
    });

    it('should get all collection overrides for database', async () => {
      await manager.addCollectionOverride('test-db', 'collection1', {
        performance: { maxConnections: 150 }
      });
      await manager.addCollectionOverride('test-db', 'collection2', {
        performance: { maxConnections: 200 }
      });

      const overrides = manager.getCollectionOverrides('test-db');
      expect(overrides.size).toBe(2);
      expect(overrides.has('collection1')).toBe(true);
      expect(overrides.has('collection2')).toBe(true);
    });

    it('should reject override for non-existent database', async () => {
      await expect(manager.addCollectionOverride('non-existent', 'collection', {}))
        .rejects.toThrow('Database non-existent not found');
    });
  });

  describe('Configuration Resolution', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('test-db', {
        name: 'Test Database',
        performance: {
          maxConnections: 100,
          connectionTimeout: 30000
        },
        security: {
          encryption: false,
          accessControl: true
        }
      });
    });

    it('should resolve database-level configuration', async () => {
      const resolved = await manager.resolveEffectiveConfig('test-db');

      expect(resolved.databaseId).toBe('test-db');
      expect(resolved.finalConfig.performance?.maxConnections).toBe(100);
      expect(resolved.inheritanceChain.length).toBeGreaterThan(0);
    });

    it('should resolve collection-level configuration with overrides', async () => {
      await manager.addCollectionOverride('test-db', 'test-collection', {
        performance: { maxConnections: 200 }
      });

      const resolved = await manager.resolveEffectiveConfig('test-db', 'test-collection');

      expect(resolved.collectionId).toBe('test-collection');
      expect(resolved.finalConfig.performance?.maxConnections).toBe(200);
      expect(resolved.inheritanceChain.some(step => step.source === 'COLLECTION')).toBe(true);
    });

    it('should get specific configuration value', async () => {
      const maxConnections = await manager.getConfigValue<number>(
        'test-db',
        'performance.maxConnections'
      );

      expect(maxConnections).toBe(100);
    });

    it('should return undefined for non-existent config path', async () => {
      const value = await manager.getConfigValue('test-db', 'non.existent.path');
      expect(value).toBeUndefined();
    });
  });

  describe('Inheritance Rules', () => {
    it('should add custom inheritance rule', () => {
      const customRule: InheritanceRule = {
        name: 'custom-rule',
        description: 'Custom inheritance rule',
        scope: 'performance',
        condition: () => true,
        priority: 5,
        enabled: true
      };

      manager.addInheritanceRule(customRule);
      const rules = manager.getInheritanceRules();

      expect(rules.some(rule => rule.name === 'custom-rule')).toBe(true);
    });

    it('should remove inheritance rule', () => {
      const customRule: InheritanceRule = {
        name: 'removable-rule',
        description: 'Rule to be removed',
        scope: 'performance',
        condition: () => true,
        priority: 1,
        enabled: true
      };

      manager.addInheritanceRule(customRule);
      expect(manager.getInheritanceRules().some(rule => rule.name === 'removable-rule')).toBe(true);

      manager.removeInheritanceRule('removable-rule');
      expect(manager.getInheritanceRules().some(rule => rule.name === 'removable-rule')).toBe(false);
    });

    it('should apply inheritance rules during resolution', async () => {
      await manager.setDatabaseConfig('test-db', {
        name: 'Test Database',
        validation: {
          customValidators: ['validator1']
        }
      });

      await manager.addCollectionOverride('test-db', 'test-collection', {
        validation: {
          customValidators: ['validator2']
        }
      });

      const resolved = await manager.resolveEffectiveConfig('test-db', 'test-collection');

      // The validation-inheritance rule should merge custom validators
      expect(resolved.finalConfig.validation?.customValidators).toContain('validator1');
      expect(resolved.finalConfig.validation?.customValidators).toContain('validator2');
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('test-db', {
        name: 'Test Database',
        performance: { maxConnections: 100 }
      });
    });

    it('should validate inheritance successfully', async () => {
      const validation = await manager.validateInheritance('test-db');

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect validation errors', async () => {
      // Create an invalid configuration by directly manipulating the internal state
      const invalidConfig: DatabaseConfig = {
        databaseId: '',
        name: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Temporarily disable validation to set invalid config
      const originalConfig = (manager as any).inheritanceConfig;
      (manager as any).inheritanceConfig = { ...originalConfig, enableValidation: false };

      await manager.setDatabaseConfig('invalid-db', invalidConfig);

      // Re-enable validation
      (manager as any).inheritanceConfig = originalConfig;

      const validation = await manager.validateInheritance('invalid-db');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', async () => {
      await manager.setDatabaseConfig('db1', { name: 'Database 1' });
      await manager.setDatabaseConfig('db2', { name: 'Database 2' });
      await manager.addCollectionOverride('db1', 'collection1', {});

      const stats = manager.getStats();

      expect(stats.totalDatabases).toBe(2);
      expect(stats.collectionsWithOverrides).toBe(1);
      expect(stats.inheritanceRulesCount).toBeGreaterThan(0);
    });

    it('should track cache usage', async () => {
      await manager.setDatabaseConfig('test-db', { name: 'Test Database' });

      // First resolution should populate cache
      await manager.resolveEffectiveConfig('test-db');

      const stats = manager.getStats();
      expect(stats.resolutionCacheSize).toBe(1);
    });
  });

  describe('Event System', () => {
    it('should emit events for configuration changes', async () => {
      let eventReceived = false;
      let eventData: any = null;

      manager.onConfigurationChange((event) => {
        eventReceived = true;
        eventData = event;
      });

      await manager.setDatabaseConfig('test-db', { name: 'Test Database' });

      expect(eventReceived).toBe(true);
      expect(eventData?.type).toBe('DATABASE_CONFIG_UPDATED');
      expect(eventData?.databaseId).toBe('test-db');
    });

    it('should allow unsubscribing from events', async () => {
      let eventCount = 0;
      const callback = () => { eventCount++; };

      manager.onConfigurationChange(callback);
      await manager.setDatabaseConfig('test-db1', { name: 'Test Database 1' });

      manager.offConfigurationChange(callback);
      await manager.setDatabaseConfig('test-db2', { name: 'Test Database 2' });

      expect(eventCount).toBe(1);
    });
  });

  describe('Import/Export', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('db1', {
        name: 'Database 1',
        performance: { maxConnections: 100 }
      });
      await manager.addCollectionOverride('db1', 'collection1', {
        performance: { maxConnections: 150 }
      });
    });

    it('should export configurations', () => {
      const exported = manager.exportConfigurations();

      expect(exported.databases['db1']).toBeTruthy();
      expect(exported.databases['db1'].name).toBe('Database 1');
      expect(exported.overrides['db1']['collection1']).toBeTruthy();
    });

    it('should import configurations', async () => {
      const exportData = manager.exportConfigurations();

      const newManager = new DatabaseInheritanceManager();
      await newManager.initialize({});

      await newManager.importConfigurations(exportData);

      const imported = newManager.getDatabaseConfig('db1');
      expect(imported?.name).toBe('Database 1');

      const override = newManager.getCollectionOverride('db1', 'collection1');
      expect(override?.overrides.performance?.maxConnections).toBe(150);

      await newManager.cleanup();
    });

    it('should merge configurations during import', async () => {
      const newManager = new DatabaseInheritanceManager();
      await newManager.initialize({});

      await newManager.setDatabaseConfig('existing-db', { name: 'Existing Database' });

      const exportData = manager.exportConfigurations();
      await newManager.importConfigurations(exportData, true); // merge = true

      expect(newManager.getDatabaseConfig('existing-db')).toBeTruthy();
      expect(newManager.getDatabaseConfig('db1')).toBeTruthy();

      await newManager.cleanup();
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk update database configurations', async () => {
      const updates = new Map([
        ['db1', { name: 'Database 1', performance: { maxConnections: 100 } }],
        ['db2', { name: 'Database 2', performance: { maxConnections: 200 } }]
      ]);

      await manager.bulkUpdateDatabaseConfigs(updates);

      expect(manager.getDatabaseConfig('db1')?.name).toBe('Database 1');
      expect(manager.getDatabaseConfig('db2')?.name).toBe('Database 2');
    });

    it('should bulk update collection overrides', async () => {
      await manager.setDatabaseConfig('db1', { name: 'Database 1' });

      const updates = new Map([
        ['db1', new Map([
          ['collection1', { performance: { maxConnections: 150 } }],
          ['collection2', { performance: { maxConnections: 250 } }]
        ])]
      ]);

      await manager.bulkUpdateCollectionOverrides(updates);

      expect(manager.getCollectionOverride('db1', 'collection1')?.overrides.performance?.maxConnections).toBe(150);
      expect(manager.getCollectionOverride('db1', 'collection2')?.overrides.performance?.maxConnections).toBe(250);
    });
  });

  describe('Configuration Hierarchy', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('test-db', {
        name: 'Test Database',
        performance: { maxConnections: 100 }
      });
      await manager.addCollectionOverride('test-db', 'test-collection', {
        performance: { maxConnections: 200 }
      });
    });

    it('should provide configuration hierarchy for debugging', async () => {
      const hierarchy = await manager.getConfigurationHierarchy('test-db', 'test-collection');

      expect(hierarchy.system).toBeTruthy();
      expect(hierarchy.database?.name).toBe('Test Database');
      expect(hierarchy.collection?.overrides.performance?.maxConnections).toBe(200);
      expect(hierarchy.resolved.finalConfig.performance?.maxConnections).toBe(200);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await manager.setDatabaseConfig('test-db', { name: 'Test Database' });
    });

    it('should clear resolution cache', async () => {
      // Populate cache
      await manager.resolveEffectiveConfig('test-db');
      expect(manager.getStats().resolutionCacheSize).toBe(1);

      manager.clearResolutionCache();
      expect(manager.getStats().resolutionCacheSize).toBe(0);
    });

    it('should refresh all configurations', async () => {
      await manager.refreshAllConfigurations();
      // Should complete without errors
      expect(manager.getStats().resolutionCacheSize).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status with databases configured', async () => {
      await manager.setDatabaseConfig('test-db', { name: 'Test Database' });
      await manager.start();

      const health = await manager.getHealth();
      expect(health.status).toBe(ComponentStatus.HEALTHY);
      expect(health.details?.databases).toBe(1);

      await manager.stop();
    });

    it('should report warning status with no databases', async () => {
      await manager.start();

      const health = await manager.getHealth();
      expect(health.status).toBe(ComponentStatus.WARNING);
      expect(health.details?.warning).toContain('No databases configured');

      await manager.stop();
    });
  });
});