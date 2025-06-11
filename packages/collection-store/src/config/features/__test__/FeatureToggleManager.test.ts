import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FeatureToggleManager } from '../FeatureToggleManager';
import {
  FeatureConfig,
  FeatureEvaluationContext,
  FeatureChangeEvent
} from '../interfaces/IFeatureToggleManager';
import { ComponentStatus } from '../../registry/interfaces/IConfigurationComponent';

describe('FeatureToggleManager', () => {
  let manager: FeatureToggleManager;

  beforeEach(async () => {
    manager = new FeatureToggleManager();
    await manager.initialize({});
    await manager.start();
  });

  afterEach(async () => {
    await manager.stop();
    await manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const newManager = new FeatureToggleManager();
      await newManager.initialize({});

      expect(newManager.id).toBe('feature-toggle-manager');
      expect(newManager.type).toBe('feature-manager');

      const stats = newManager.getStats();
      expect(stats.totalFeatures).toBe(0);
      expect(stats.enabledFeatures).toBe(0);
      expect(stats.disabledFeatures).toBe(0);

      await newManager.cleanup();
    });

    it('should load features from configuration', async () => {
      const config = {
        features: {
          toggles: [
            {
              name: 'test-feature',
              enabled: true,
              description: 'Test feature'
            }
          ]
        }
      };

      const newManager = new FeatureToggleManager();
      await newManager.initialize(config);

      expect(newManager.hasFeature('test-feature')).toBe(true);
      expect(newManager.isEnabled('test-feature')).toBe(true);

      await newManager.cleanup();
    });
  });

  describe('Feature Management', () => {
    it('should create and manage features', async () => {
      const config: FeatureConfig = {
        enabled: true,
        description: 'Test feature'
      };

      await manager.createFeature('test-feature', config);

      expect(manager.hasFeature('test-feature')).toBe(true);
      expect(manager.isEnabled('test-feature')).toBe(true);

      const retrievedConfig = manager.getFeatureConfig('test-feature');
      expect(retrievedConfig?.enabled).toBe(true);
      expect(retrievedConfig?.description).toBe('Test feature');
    });

    it('should prevent duplicate feature creation', async () => {
      const config: FeatureConfig = { enabled: true };

      await manager.createFeature('test-feature', config);

      await expect(manager.createFeature('test-feature', config))
        .rejects.toThrow('Feature test-feature already exists');
    });

    it('should enable and disable features', async () => {
      await manager.createFeature('test-feature', { enabled: false });

      expect(manager.isEnabled('test-feature')).toBe(false);

      await manager.enable('test-feature');
      expect(manager.isEnabled('test-feature')).toBe(true);

      await manager.disable('test-feature');
      expect(manager.isEnabled('test-feature')).toBe(false);
    });

    it('should toggle feature state', async () => {
      await manager.createFeature('test-feature', { enabled: false });

      expect(manager.isEnabled('test-feature')).toBe(false);

      await manager.toggle('test-feature');
      expect(manager.isEnabled('test-feature')).toBe(true);

      await manager.toggle('test-feature');
      expect(manager.isEnabled('test-feature')).toBe(false);
    });

    it('should remove features', async () => {
      await manager.createFeature('test-feature', { enabled: true });

      expect(manager.hasFeature('test-feature')).toBe(true);

      await manager.removeFeature('test-feature');

      expect(manager.hasFeature('test-feature')).toBe(false);
      expect(manager.isEnabled('test-feature')).toBe(false);
    });

    it('should handle bulk operations', async () => {
      const features = ['feature1', 'feature2', 'feature3'];

      // Create features
      for (const feature of features) {
        await manager.createFeature(feature, { enabled: false });
      }

      // Enable multiple
      await manager.enableMultiple(features);

      for (const feature of features) {
        expect(manager.isEnabled(feature)).toBe(true);
      }

      // Disable multiple
      await manager.disableMultiple(features);

      for (const feature of features) {
        expect(manager.isEnabled(feature)).toBe(false);
      }
    });
  });

  describe('Feature Conditions', () => {
    it('should evaluate percentage rollout', async () => {
      const config: FeatureConfig = {
        enabled: true,
        conditions: {
          percentage: 50
        }
      };

      await manager.createFeature('percentage-feature', config);

      // Test multiple times to check randomness
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(manager.isEnabled('percentage-feature'));
      }

      // Should have some true and some false results
      const trueCount = results.filter(r => r).length;
      expect(trueCount).toBeGreaterThan(20);
      expect(trueCount).toBeLessThan(80);
    });

    it('should evaluate user groups', async () => {
      const config: FeatureConfig = {
        enabled: true,
        conditions: {
          userGroups: ['beta', 'premium']
        }
      };

      await manager.createFeature('group-feature', config);

      // User in beta group
      const betaContext: FeatureEvaluationContext = {
        userGroups: ['beta']
      };
      expect(manager.isEnabled('group-feature', betaContext)).toBe(true);

      // User in premium group
      const premiumContext: FeatureEvaluationContext = {
        userGroups: ['premium']
      };
      expect(manager.isEnabled('group-feature', premiumContext)).toBe(true);

      // User not in target groups
      const regularContext: FeatureEvaluationContext = {
        userGroups: ['regular']
      };
      expect(manager.isEnabled('group-feature', regularContext)).toBe(false);

      // No context
      expect(manager.isEnabled('group-feature')).toBe(false);
    });

    it('should evaluate time windows', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      const future = new Date(now.getTime() + 60000); // 1 minute from now

      const config: FeatureConfig = {
        enabled: true,
        conditions: {
          timeWindow: {
            start: past,
            end: future
          }
        }
      };

      await manager.createFeature('time-feature', config);

      // Current time should be within window
      expect(manager.isEnabled('time-feature')).toBe(true);

      // Test with context timestamp in the past
      const pastContext: FeatureEvaluationContext = {
        timestamp: new Date(past.getTime() - 60000)
      };
      expect(manager.isEnabled('time-feature', pastContext)).toBe(false);

      // Test with context timestamp in the future
      const futureContext: FeatureEvaluationContext = {
        timestamp: new Date(future.getTime() + 60000)
      };
      expect(manager.isEnabled('time-feature', futureContext)).toBe(false);
    });

    it('should evaluate environment restrictions', async () => {
      const config: FeatureConfig = {
        enabled: true,
        conditions: {
          environments: ['production', 'staging']
        }
      };

      await manager.createFeature('env-feature', config);

      // Production environment
      const prodContext: FeatureEvaluationContext = {
        environment: 'production'
      };
      expect(manager.isEnabled('env-feature', prodContext)).toBe(true);

      // Development environment (not allowed)
      const devContext: FeatureEvaluationContext = {
        environment: 'development'
      };
      expect(manager.isEnabled('env-feature', devContext)).toBe(false);
    });

    it('should evaluate feature dependencies', async () => {
      // Create dependency feature
      await manager.createFeature('dependency-feature', { enabled: true });

      // Create feature with dependency
      const config: FeatureConfig = {
        enabled: true,
        conditions: {
          dependencies: ['dependency-feature']
        }
      };

      await manager.createFeature('dependent-feature', config);

      // Should be enabled when dependency is enabled
      expect(manager.isEnabled('dependent-feature')).toBe(true);

      // Disable dependency
      await manager.disable('dependency-feature');

      // Should be disabled when dependency is disabled
      expect(manager.isEnabled('dependent-feature')).toBe(false);
    });
  });

  describe('Feature Evaluation', () => {
    it('should provide detailed evaluation results', async () => {
      await manager.createFeature('test-feature', { enabled: true });

      const evaluation = manager.evaluateFeature('test-feature');

      expect(evaluation.enabled).toBe(true);
      expect(evaluation.reason).toBe('No conditions');
      expect(evaluation.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should handle non-existent features', async () => {
      const evaluation = manager.evaluateFeature('non-existent');

      expect(evaluation.enabled).toBe(false); // default is false
      expect(evaluation.reason).toBe('Feature not found, using default');
    });
  });

  describe('Statistics', () => {
    it('should track feature statistics', async () => {
      await manager.createFeature('enabled-feature', { enabled: true });
      await manager.createFeature('disabled-feature', { enabled: false });

      const stats = manager.getStats();

      expect(stats.totalFeatures).toBe(2);
      expect(stats.enabledFeatures).toBe(1);
      expect(stats.disabledFeatures).toBe(1);
    });

    it('should track evaluation count', async () => {
      await manager.createFeature('test-feature', { enabled: true });

      const initialStats = manager.getStats();
      const initialCount = initialStats.evaluationCount;

      // Perform evaluations
      manager.isEnabled('test-feature');
      manager.isEnabled('test-feature');
      manager.isEnabled('test-feature');

      const finalStats = manager.getStats();
      expect(finalStats.evaluationCount).toBe(initialCount + 3);
    });
  });

  describe('Event System', () => {
    it('should emit feature change events', async () => {
      const events: FeatureChangeEvent[] = [];

      manager.onFeatureChange((event) => {
        events.push(event);
      });

      await manager.createFeature('test-feature', { enabled: false });
      await manager.enable('test-feature');
      await manager.disable('test-feature');

      expect(events).toHaveLength(2); // enable and disable events

      expect(events[0].feature).toBe('test-feature');
      expect(events[0].previousState).toBe(false);
      expect(events[0].newState).toBe(true);

      expect(events[1].feature).toBe('test-feature');
      expect(events[1].previousState).toBe(true);
      expect(events[1].newState).toBe(false);
    });

    it('should allow unsubscribing from events', async () => {
      const events: FeatureChangeEvent[] = [];

      const callback = (event: FeatureChangeEvent) => {
        events.push(event);
      };

      manager.onFeatureChange(callback);

      await manager.createFeature('test-feature', { enabled: false });
      await manager.enable('test-feature');

      expect(events).toHaveLength(1);

      manager.offFeatureChange(callback);

      await manager.disable('test-feature');

      // Should still be 1 (no new events after unsubscribe)
      expect(events).toHaveLength(1);
    });
  });

  describe('Configuration Management', () => {
    it('should export and import configuration', async () => {
      // Create some features
      await manager.createFeature('feature1', {
        enabled: true,
        description: 'Feature 1'
      });
      await manager.createFeature('feature2', {
        enabled: false,
        description: 'Feature 2',
        conditions: { percentage: 50 }
      });

      // Export configuration
      const exported = manager.exportConfig();

      expect(exported).toHaveProperty('feature1');
      expect(exported).toHaveProperty('feature2');
      expect(exported.feature1.enabled).toBe(true);
      expect(exported.feature2.enabled).toBe(false);

      // Create new manager and import
      const newManager = new FeatureToggleManager();
      await newManager.initialize({});
      await newManager.importConfig(exported);

      expect(newManager.hasFeature('feature1')).toBe(true);
      expect(newManager.hasFeature('feature2')).toBe(true);
      expect(newManager.isEnabled('feature1')).toBe(true);
      expect(newManager.isEnabled('feature2')).toBe(false);

      await newManager.cleanup();
    });

    it('should handle bulk updates', async () => {
      const updates = new Map([
        ['feature1', { enabled: true, description: 'Feature 1' }],
        ['feature2', { enabled: false, description: 'Feature 2' }],
        ['feature3', { enabled: true, description: 'Feature 3' }]
      ]);

      await manager.bulkUpdate(updates);

      expect(manager.hasFeature('feature1')).toBe(true);
      expect(manager.hasFeature('feature2')).toBe(true);
      expect(manager.hasFeature('feature3')).toBe(true);

      expect(manager.isEnabled('feature1')).toBe(true);
      expect(manager.isEnabled('feature2')).toBe(false);
      expect(manager.isEnabled('feature3')).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status with features', async () => {
      await manager.createFeature('test-feature', { enabled: true });

      const health = await manager.getHealth();

      expect(health.status).toBe(ComponentStatus.HEALTHY);
      expect(health.details?.metrics?.totalFeatures).toBe(1);
    });

    it('should report warning status with no features', async () => {
      const health = await manager.getHealth();

      expect(health.status).toBe(ComponentStatus.WARNING);
      expect(health.details?.warning).toBe('No features configured');
    });
  });

  describe('Cache Management', () => {
    it('should cache evaluation results', async () => {
      await manager.createFeature('test-feature', { enabled: true });

      // First evaluation
      const start = Date.now();
      manager.isEnabled('test-feature');
      const firstTime = Date.now() - start;

      // Second evaluation (should be cached)
      const start2 = Date.now();
      manager.isEnabled('test-feature');
      const secondTime = Date.now() - start2;

      // Cache should make second evaluation faster
      expect(secondTime).toBeLessThanOrEqual(firstTime);
    });

    it('should clear cache for specific features', async () => {
      await manager.createFeature('feature1', { enabled: true });
      await manager.createFeature('feature2', { enabled: true });

      // Evaluate both features to populate cache
      manager.isEnabled('feature1');
      manager.isEnabled('feature2');

      // Clear cache for feature1 only
      manager.clearCache('feature1');

      // This should work without errors
      expect(manager.isEnabled('feature1')).toBe(true);
      expect(manager.isEnabled('feature2')).toBe(true);
    });

    it('should clear all cache', async () => {
      await manager.createFeature('feature1', { enabled: true });
      await manager.createFeature('feature2', { enabled: true });

      // Evaluate features to populate cache
      manager.isEnabled('feature1');
      manager.isEnabled('feature2');

      // Clear all cache
      manager.clearCache();

      // This should work without errors
      expect(manager.isEnabled('feature1')).toBe(true);
      expect(manager.isEnabled('feature2')).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    it('should handle configuration updates', async () => {
      const initialConfig = {
        features: {
          defaultEnabled: false,
          enableCaching: true,
          toggles: [
            { name: 'initial-feature', enabled: true }
          ]
        }
      };

      await manager.updateConfig(initialConfig);

      expect(manager.hasFeature('initial-feature')).toBe(true);
      expect(manager.isEnabled('initial-feature')).toBe(true);

      const updatedConfig = {
        features: {
          defaultEnabled: true,
          enableCaching: false,
          toggles: [
            { name: 'initial-feature', enabled: false },
            { name: 'new-feature', enabled: true }
          ]
        }
      };

      await manager.updateConfig(updatedConfig);

      expect(manager.hasFeature('initial-feature')).toBe(true);
      expect(manager.hasFeature('new-feature')).toBe(true);
      expect(manager.isEnabled('initial-feature')).toBe(false);
      expect(manager.isEnabled('new-feature')).toBe(true);
    });
  });
});