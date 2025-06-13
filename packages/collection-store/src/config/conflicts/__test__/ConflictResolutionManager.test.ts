/**
 * ConflictResolutionManager Tests
 * Tests for configuration conflict detection and resolution functionality
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { ConflictResolutionManager } from '../ConflictResolutionManager';
import {
  ConflictResolutionStrategy,
  ConflictType,
  ConflictSeverity,
  type ConfigurationSource,
  type ConflictResolutionManagerConfig
} from '../interfaces/IConflictResolutionManager';

describe('ConflictResolutionManager', () => {
  let manager: ConflictResolutionManager;
  let mockConfig: ConflictResolutionManagerConfig;
  let testSources: ConfigurationSource[];

  beforeEach(async () => {
    mockConfig = {
      detection: {
        enabled: true,
        deepScan: true,
        checkInterval: 1000,
        maxDepth: 5,
        ignorePatterns: ['*.test'],
        customDetectors: []
      },
      resolution: {
        defaultStrategy: ConflictResolutionStrategy.MERGE,
        autoResolve: false,
        maxAutoResolutionTime: 1000,
        batchSize: 5,
        parallelResolution: false,
        retryAttempts: 2,
        retryDelay: 100
      },
      rules: [],
      notifications: {
        enabled: false,
        severityThreshold: ConflictSeverity.MEDIUM,
        channels: [],
        templates: {}
      },
      logging: {
        enabled: false,
        level: 'error',
        includeValues: false,
        maxLogSize: 1024
      },
      performance: {
        enableCaching: false,
        cacheTTL: 1000,
        enableMetrics: false
      }
    };

    testSources = [
      {
        id: 'source1',
        name: 'Test Source 1',
        priority: 100,
        type: 'default',
        lastModified: new Date(),
        metadata: { version: '1.0.0' }
      },
      {
        id: 'source2',
        name: 'Test Source 2',
        priority: 200,
        type: 'file',
        lastModified: new Date(),
        metadata: { version: '1.0.0' }
      }
    ];

    manager = new ConflictResolutionManager(mockConfig);
    await manager.initialize();
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  describe('Lifecycle Management', () => {
    test('should initialize with default configuration', async () => {
      const defaultManager = new ConflictResolutionManager();
      await defaultManager.initialize();

      const config = defaultManager.getConfig();
      expect(config.detection.enabled).toBe(true);
      expect(config.resolution.defaultStrategy).toBe(ConflictResolutionStrategy.MERGE);

      await defaultManager.stop();
    });

    test('should start and stop successfully', async () => {
      await manager.start();
      expect(manager.getState()).toBe('running');

      await manager.stop();
      expect(manager.getState()).toBe('stopped');
    });

    test('should report healthy status with no conflicts', async () => {
      const health = await manager.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.activeConflicts).toBe(0);
      expect(health.details.rulesCount).toBeGreaterThan(0);
      expect(health.issues).toHaveLength(0);
    });

    test('should update configuration', async () => {
      const newConfig = {
        detection: {
          enabled: false,
          checkInterval: 5000
        }
      };

      await manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.detection.enabled).toBe(false);
      expect(config.detection.checkInterval).toBe(5000);
    });
  });

  describe('Conflict Detection', () => {
    test('should detect value conflicts between configurations', async () => {
      const configurations = {
        source1: { database: { host: 'localhost', port: 5432 } },
        source2: { database: { host: 'remote', port: 5432 } }
      };

      const conflicts = await manager.detectConflicts(configurations, testSources);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.VALUE_MISMATCH);
      expect(conflicts[0].path).toBe('database.host');
      expect(conflicts[0].sources).toHaveLength(2);
    });

    test('should detect type conflicts between configurations', async () => {
      const configurations = {
        source1: { setting: 'string_value' },
        source2: { setting: 42 }
      };

      const conflicts = await manager.detectConflicts(configurations, testSources);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.TYPE_MISMATCH);
      expect(conflicts[0].severity).toBe(ConflictSeverity.HIGH);
    });

    test('should detect conflicts in specific path', async () => {
      const configurations = {
        source1: { api: { timeout: 5000, retries: 3 } },
        source2: { api: { timeout: 10000, retries: 3 } }
      };

      const conflicts = await manager.detectConflictsInPath('api.timeout', configurations, testSources);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].path).toBe('api.timeout');
    });

    test('should validate configuration against existing conflicts', async () => {
      const configurations = {
        source1: { value: 'test1' },
        source2: { value: 'test2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const validation = await manager.validateConfiguration({ value: 'test3' }, testSources[0]);

      expect(validation.valid).toBe(false);
      expect(validation.conflicts).toHaveLength(1);
    });

    test('should scan for existing conflicts', async () => {
      const configurations = {
        source1: { setting1: 'value1', setting2: 'value2' },
        source2: { setting1: 'different', setting2: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const scannedConflicts = await manager.scanForConflicts();

      expect(scannedConflicts).toHaveLength(1);
    });
  });

  describe('Conflict Management', () => {
    let conflictId: string;

    beforeEach(async () => {
      const configurations = {
        source1: { test: 'value1' },
        source2: { test: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);
      conflictId = conflicts[0].id;
    });

    test('should get conflict by ID', () => {
      const conflict = manager.getConflict(conflictId);

      expect(conflict).toBeDefined();
      expect(conflict!.id).toBe(conflictId);
    });

    test('should get all conflicts', () => {
      const conflicts = manager.getAllConflicts();

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe(conflictId);
    });

    test('should get conflicts by type', () => {
      const conflicts = manager.getConflictsByType(ConflictType.VALUE_MISMATCH);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.VALUE_MISMATCH);
    });

    test('should get conflicts by severity', () => {
      const conflicts = manager.getConflictsBySeverity(ConflictSeverity.MEDIUM);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe(ConflictSeverity.MEDIUM);
    });

    test('should remove specific conflict', async () => {
      await manager.removeConflict(conflictId);

      const conflict = manager.getConflict(conflictId);
      expect(conflict).toBeUndefined();
    });

    test('should clear all conflicts', async () => {
      await manager.clearAllConflicts();

      const conflicts = manager.getAllConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Resolution Rules Management', () => {
    test('should add resolution rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test rule description',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.OVERRIDE,
        priority: 150,
        enabled: true
      };

      const ruleId = await manager.addResolutionRule(rule);

      expect(ruleId).toBeDefined();
      expect(typeof ruleId).toBe('string');

      const retrievedRule = manager.getResolutionRule(ruleId);
      expect(retrievedRule).toBeDefined();
      expect(retrievedRule!.name).toBe(rule.name);
    });

    test('should update resolution rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Original description',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: true
      };

      const ruleId = await manager.addResolutionRule(rule);

      await manager.updateResolutionRule(ruleId, {
        description: 'Updated description',
        priority: 200
      });

      const updatedRule = manager.getResolutionRule(ruleId);
      expect(updatedRule!.description).toBe('Updated description');
      expect(updatedRule!.priority).toBe(200);
    });

    test('should remove resolution rule', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test rule',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: true
      };

      const ruleId = await manager.addResolutionRule(rule);
      await manager.removeResolutionRule(ruleId);

      const retrievedRule = manager.getResolutionRule(ruleId);
      expect(retrievedRule).toBeUndefined();
    });

    test('should get all resolution rules', () => {
      const rules = manager.getAllResolutionRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('name');
    });

    test('should enable and disable resolution rules', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test rule',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: false
      };

      const ruleId = await manager.addResolutionRule(rule);

      await manager.enableResolutionRule(ruleId);
      let retrievedRule = manager.getResolutionRule(ruleId);
      expect(retrievedRule!.enabled).toBe(true);

      await manager.disableResolutionRule(ruleId);
      retrievedRule = manager.getResolutionRule(ruleId);
      expect(retrievedRule!.enabled).toBe(false);
    });

    test('should validate resolution rule', async () => {
      const validRule = {
        name: 'Valid Rule',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100
      };

      const validation = await manager.validateResolutionRule(validRule);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      const invalidRule = {
        name: '',
        pattern: '',
        priority: 'invalid' as any
      };

      const invalidValidation = await manager.validateResolutionRule(invalidRule);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Conflict Resolution', () => {
    let conflictId: string;

    beforeEach(async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);
      conflictId = conflicts[0].id;
    });

    test('should resolve conflict with merge strategy', async () => {
      const result = await manager.resolveConflict(conflictId, ConflictResolutionStrategy.MERGE);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.MERGE);
      expect(result.conflictId).toBe(conflictId);
      expect(result.executionTime).toBeGreaterThan(0);

      const conflict = manager.getConflict(conflictId);
      expect(conflict).toBeUndefined();
    });

    test('should resolve conflict with override strategy', async () => {
      const result = await manager.resolveConflict(conflictId, ConflictResolutionStrategy.OVERRIDE);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.OVERRIDE);
      expect(result.resolvedValue).toBe('value2');
    });

    test('should resolve multiple conflicts', async () => {
      const configurations = {
        source1: { setting1: 'value1', setting2: 'value1' },
        source2: { setting1: 'value2', setting2: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const allConflicts = manager.getAllConflicts();
      const conflictIds = allConflicts.map(c => c.id);

      const batchResult = await manager.resolveConflicts(conflictIds, ConflictResolutionStrategy.MERGE);

      expect(batchResult.totalConflicts).toBe(conflictIds.length);
      expect(batchResult.resolvedConflicts).toBe(conflictIds.length);
      expect(batchResult.failedConflicts).toBe(0);
    });

    test('should resolve all conflicts', async () => {
      const configurations = {
        source1: { setting1: 'value1', setting2: 'value1' },
        source2: { setting1: 'value2', setting2: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const batchResult = await manager.resolveAllConflicts(ConflictResolutionStrategy.OVERRIDE);

      expect(batchResult.resolvedConflicts).toBeGreaterThan(0);
      expect(manager.getAllConflicts()).toHaveLength(0);
    });

    test('should auto-resolve conflicts', async () => {
      const batchResult = await manager.autoResolveConflicts();

      expect(batchResult.totalConflicts).toBeGreaterThan(0);
      expect(batchResult.resolvedConflicts).toBeGreaterThan(0);
    });
  });

  describe('Resolution Strategies', () => {
    test('should merge configurations deeply', async () => {
      const configurations = [
        { database: { host: 'localhost', port: 5432 }, api: { timeout: 5000 } },
        { database: { user: 'admin', password: 'secret' }, api: { retries: 3 } }
      ];

      const result = await manager.mergeConfigurations(configurations, testSources, 'deep');

      expect(result.database.host).toBe('localhost');
      expect(result.database.user).toBe('admin');
      expect(result.api.timeout).toBe(5000);
      expect(result.api.retries).toBe(3);
    });

    test('should merge configurations shallowly', async () => {
      const configurations = [
        { database: { host: 'localhost' }, setting: 'value1' },
        { database: { user: 'admin' }, setting: 'value2' }
      ];

      const result = await manager.mergeConfigurations(configurations, testSources, 'shallow');

      expect(result.database.user).toBe('admin');
      expect(result.database.host).toBeUndefined();
      expect(result.setting).toBe('value2');
    });

    test('should select configuration by priority', async () => {
      const configurations = [
        { setting: 'low_priority' },
        { setting: 'high_priority' }
      ];

      const result = await manager.selectConfiguration(configurations, testSources);

      expect(result.setting).toBe('high_priority');
    });

    test('should prompt user for resolution', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);

      const result = await manager.promptUserForResolution(conflicts[0]);

      expect(result).toBe('value1');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track statistics', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);
      await manager.resolveConflict(conflicts[0].id, ConflictResolutionStrategy.MERGE);

      const stats = manager.getStatistics();

      expect(stats.totalConflictsDetected).toBe(1);
      expect(stats.totalConflictsResolved).toBe(1);
      expect(stats.conflictsByType[ConflictType.VALUE_MISMATCH]).toBe(1);
      expect(stats.resolutionsByStrategy[ConflictResolutionStrategy.MERGE]).toBe(1);
    });

    test('should reset statistics', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      await manager.resetStatistics();
      const stats = manager.getStatistics();

      expect(stats.totalConflictsDetected).toBe(0);
      expect(stats.totalConflictsResolved).toBe(0);
    });

    test('should export statistics', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const exportedStats = await manager.exportStatistics();
      const parsedStats = JSON.parse(exportedStats);

      expect(parsedStats.totalConflictsDetected).toBe(1);
      expect(typeof parsedStats.lastReset).toBe('string');
    });
  });

  describe('Event System', () => {
    test('should emit conflict detected event', async () => {
      let eventReceived = false;
      let eventData: any;

      manager.on('conflict_detected', (event) => {
        eventReceived = true;
        eventData = event;
      });

      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      expect(eventReceived).toBe(true);
      expect(eventData.data.conflict).toBeDefined();
    });

    test('should emit conflict resolved event', async () => {
      let eventReceived = false;

      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);

      manager.on('conflict_resolved', () => {
        eventReceived = true;
      });

      await manager.resolveConflict(conflicts[0].id, ConflictResolutionStrategy.MERGE);

      expect(eventReceived).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('should compare configurations', async () => {
      const config1 = { database: { host: 'localhost', port: 5432 } };
      const config2 = { database: { host: 'remote', port: 5432 } };

      const conflicts = await manager.compareConfigurations(config1, config2, testSources[0], testSources[1]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].path).toBe('database.host');
    });

    test('should generate conflict report', async () => {
      const configurations = {
        source1: { setting1: 'value1', setting2: 'value1' },
        source2: { setting1: 'value2', setting2: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const report = await manager.generateConflictReport();
      const parsedReport = JSON.parse(report);

      expect(parsedReport.summary.totalConflicts).toBeGreaterThan(0);
      expect(parsedReport.conflicts).toBeInstanceOf(Array);
      expect(parsedReport.conflicts[0]).toHaveProperty('id');
      expect(parsedReport.conflicts[0]).toHaveProperty('type');
    });

    test('should simulate resolution', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      const conflicts = await manager.detectConflicts(configurations, testSources);

      const simulation = await manager.simulateResolution(conflicts[0].id, ConflictResolutionStrategy.MERGE);

      expect(simulation.success).toBe(true);
      expect(simulation.result).toBeDefined();
      expect(simulation.estimatedTime).toBeGreaterThan(0);
    });
  });

  describe('Bulk Operations', () => {
    test('should add multiple resolution rules', async () => {
      const rules = [
        {
          name: 'Rule 1',
          description: 'First rule',
          pattern: '.*\\.rule1\\..*',
          strategy: ConflictResolutionStrategy.MERGE,
          priority: 100,
          enabled: true
        },
        {
          name: 'Rule 2',
          description: 'Second rule',
          pattern: '.*\\.rule2\\..*',
          strategy: ConflictResolutionStrategy.OVERRIDE,
          priority: 200,
          enabled: true
        }
      ];

      const ruleIds = await manager.addMultipleResolutionRules(rules);

      expect(ruleIds).toHaveLength(2);
      expect(ruleIds.every(id => typeof id === 'string')).toBe(true);
    });

    test('should update multiple resolution rules', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Original',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: true
      };

      const ruleId = await manager.addResolutionRule(rule);

      await manager.updateMultipleResolutionRules([
        {
          ruleId,
          updates: { description: 'Updated', priority: 150 }
        }
      ]);

      const updatedRule = manager.getResolutionRule(ruleId);
      expect(updatedRule!.description).toBe('Updated');
      expect(updatedRule!.priority).toBe(150);
    });

    test('should remove multiple resolution rules', async () => {
      const rules = [
        {
          name: 'Rule 1',
          description: 'First rule',
          pattern: '.*\\.rule1\\..*',
          strategy: ConflictResolutionStrategy.MERGE,
          priority: 100,
          enabled: true
        },
        {
          name: 'Rule 2',
          description: 'Second rule',
          pattern: '.*\\.rule2\\..*',
          strategy: ConflictResolutionStrategy.OVERRIDE,
          priority: 200,
          enabled: true
        }
      ];

      const ruleIds = await manager.addMultipleResolutionRules(rules);
      await manager.removeMultipleResolutionRules(ruleIds);

      ruleIds.forEach(id => {
        const rule = manager.getResolutionRule(id);
        expect(rule).toBeUndefined();
      });
    });
  });

  describe('Import/Export', () => {
    test('should export configuration', async () => {
      const rule = {
        name: 'Test Rule',
        description: 'Test rule',
        pattern: '.*\\.test\\..*',
        strategy: ConflictResolutionStrategy.MERGE,
        priority: 100,
        enabled: true
      };
      await manager.addResolutionRule(rule);

      const exportedConfig = await manager.exportConfiguration();
      const parsedConfig = JSON.parse(exportedConfig);

      expect(parsedConfig.rules).toBeInstanceOf(Array);
      expect(parsedConfig.config).toBeDefined();
      expect(parsedConfig.stats).toBeDefined();
    });

    test('should import configuration', async () => {
      const configData = {
        rules: [
          {
            id: 'imported_rule',
            name: 'Imported Rule',
            description: 'Imported rule',
            pattern: '.*\\.imported\\..*',
            strategy: ConflictResolutionStrategy.OVERRIDE,
            priority: 300,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        config: {
          detection: { enabled: false }
        }
      };

      await manager.importConfiguration(JSON.stringify(configData));

      const importedRule = manager.getResolutionRule('imported_rule');
      expect(importedRule).toBeDefined();
      expect(importedRule!.name).toBe('Imported Rule');

      const config = manager.getConfig();
      expect(config.detection.enabled).toBe(false);
    });

    test('should export conflict history', async () => {
      const configurations = {
        source1: { setting: 'value1' },
        source2: { setting: 'value2' }
      };
      await manager.detectConflicts(configurations, testSources);

      const exportedHistory = await manager.exportConflictHistory();
      const parsedHistory = JSON.parse(exportedHistory);

      expect(parsedHistory.conflicts).toBeInstanceOf(Array);
      expect(parsedHistory.conflicts.length).toBeGreaterThan(0);
      expect(parsedHistory.stats).toBeDefined();
      expect(parsedHistory.exportedAt).toBeDefined();
    });

    test('should import conflict history', async () => {
      const historyData = {
        conflicts: [
          {
            id: 'imported_conflict',
            type: ConflictType.VALUE_MISMATCH,
            severity: ConflictSeverity.MEDIUM,
            path: 'imported.setting',
            description: 'Imported conflict',
            sources: testSources,
            values: [
              { source: testSources[0], value: 'value1', path: 'imported.setting' },
              { source: testSources[1], value: 'value2', path: 'imported.setting' }
            ],
            detectedAt: new Date(),
            autoResolvable: true,
            suggestedStrategy: ConflictResolutionStrategy.MERGE
          }
        ]
      };

      await manager.importConflictHistory(JSON.stringify(historyData));

      const importedConflict = manager.getConflict('imported_conflict');
      expect(importedConflict).toBeDefined();
      expect(importedConflict!.path).toBe('imported.setting');
    });
  });
});