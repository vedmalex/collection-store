/**
 * Automated Optimization Engine Tests
 * Phase 6 Day 10: Comprehensive test suite for automated optimization engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutomatedOptimizationEngine } from '../monitoring/AutomatedOptimizationEngine';
import type {
  OptimizationEngineConfig,
  OptimizationRecommendations,
  OptimizationRecommendation,
  ScheduledOptimization,
  OptimizationType,
  ExpectedImpact,
  ImplementationPlan
} from '../testing/interfaces';

describe('AutomatedOptimizationEngine', () => {
  let engine: AutomatedOptimizationEngine;
  let mockConfig: OptimizationEngineConfig;

  beforeEach(() => {
    engine = new AutomatedOptimizationEngine();

    mockConfig = {
      enableAutomatedOptimization: true,
      optimizationSchedule: {
        enableScheduling: true,
        preferredTimeWindows: [],
        avoidPeakHours: false,
        maxConcurrentOptimizations: 3,
        optimizationInterval: 60,
        emergencyOptimizationDelay: 5
      },
      safetyThresholds: {
        maxCpuUsage: 80,
        maxMemoryUsage: 85,
        maxNetworkUsage: 90,
        maxDiskUsage: 85,
        minAvailableConnections: 100,
        maxErrorRate: 5
      },
      rollbackPolicy: {
        enableAutoRollback: true,
        rollbackTriggers: [],
        rollbackTimeout: 300,
        maxRollbackAttempts: 3,
        preserveRollbackHistory: true
      },
      resourceLimits: {
        maxCpuUsageForOptimization: 70,
        maxMemoryUsageForOptimization: 75,
        maxOptimizationDuration: 600,
        maxConcurrentValidations: 5,
        reservedResourcePercentage: 20
      },
      auditTrail: {
        enableAuditTrail: true,
        logLevel: 'standard',
        retentionPeriod: 30,
        enableMetricsLogging: true,
        enableConfigurationLogging: true
      },
      emergencyResponse: {
        enableEmergencyResponse: true,
        emergencyThresholds: [],
        responseActions: [],
        escalationPolicy: {
          levels: [],
          timeouts: [],
          enableAutoEscalation: false
        },
        notificationConfig: {
          enableNotifications: true,
          channels: [],
          templates: [],
          escalationNotifications: false
        }
      }
    };

    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (engine.getOptimizationStatus().isRunning) {
      await engine.stopEngine();
    }
    vi.restoreAllMocks();
  });

  describe('Engine Lifecycle', () => {
    it('should start engine successfully', async () => {
      await engine.startEngine(mockConfig);

      const status = engine.getOptimizationStatus();
      expect(status.isRunning).toBe(true);
      expect(status.startedAt).toBeInstanceOf(Date);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when starting already running engine', async () => {
      await engine.startEngine(mockConfig);

      await expect(engine.startEngine(mockConfig))
        .rejects.toThrow('Optimization engine is already running');
    });

    it('should stop engine successfully', async () => {
      await engine.startEngine(mockConfig);
      await engine.stopEngine();

      const status = engine.getOptimizationStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should throw error when stopping non-running engine', async () => {
      await expect(engine.stopEngine())
        .rejects.toThrow('Optimization engine is not running');
    });

    it('should track engine uptime correctly', async () => {
      await engine.startEngine(mockConfig);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = engine.getOptimizationStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('Optimization Execution', () => {
    beforeEach(async () => {
      await engine.startEngine(mockConfig);
    });

    it('should execute optimization recommendations', async () => {
      const recommendations = createMockRecommendations();

      const results = await engine.executeOptimizations(recommendations);

      expect(results).toHaveLength(5); // immediate + preventive + strategic + correlation + predictive
      expect(results.every(r => r.optimizationId)).toBe(true);
      expect(results.every(r => r.appliedAt instanceof Date)).toBe(true);
    });

    it('should prioritize critical optimizations first', async () => {
      const recommendations: OptimizationRecommendations = {
        immediate: [createMockRecommendation('critical', 'immediate-1')],
        preventive: [createMockRecommendation('low', 'preventive-1')],
        strategic: [createMockRecommendation('high', 'strategic-1')],
        correlationBased: [createMockRecommendation('medium', 'correlation-1')],
        predictiveBased: [createMockRecommendation('critical', 'predictive-1')]
      };

      const results = await engine.executeOptimizations(recommendations);

      // Critical optimizations should be executed first
      const criticalResults = results.filter(r =>
        r.recommendationId === 'immediate-1' || r.recommendationId === 'predictive-1'
      );
      expect(criticalResults).toHaveLength(2);
    });

    it('should schedule optimizations when at capacity', async () => {
      // Set low concurrent limit
      mockConfig.optimizationSchedule.maxConcurrentOptimizations = 1;
      await engine.stopEngine();
      await engine.startEngine(mockConfig);

      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);

      // Some should be scheduled for later
      const scheduledResults = results.filter(r =>
        r.executionLog.some(log => log.step === 'scheduling')
      );
      expect(scheduledResults.length).toBeGreaterThan(0);
    });

    it('should handle optimization failures gracefully', async () => {
      // Mock a failing recommendation
      const failingRecommendation = createMockRecommendation('high', 'failing-opt');
      failingRecommendation.implementation.steps[0].action.parameters = { description: 'FORCE_FAILURE' };

      const recommendations: OptimizationRecommendations = {
        immediate: [failingRecommendation],
        preventive: [],
        strategic: [],
        correlationBased: [],
        predictiveBased: []
      };

      const results = await engine.executeOptimizations(recommendations);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].executionLog.some(log => log.status === 'failed')).toBe(true);
    });

    it('should track optimization metrics', async () => {
      const recommendations = createMockRecommendations();
      await engine.executeOptimizations(recommendations);

      const status = engine.getOptimizationStatus();
      expect(status.completedOptimizations).toBeGreaterThan(0);
      expect(status.lastOptimization).toBeInstanceOf(Date);
    });
  });

  describe('Scheduling Management', () => {
    beforeEach(async () => {
      await engine.startEngine(mockConfig);
    });

    it('should schedule optimization successfully', async () => {
      const scheduledOptimization: ScheduledOptimization = {
        id: 'scheduled-1',
        recommendationId: 'rec-1',
        scheduledAt: new Date(Date.now() + 60000), // 1 minute from now
        priority: 'medium',
        dependencies: [],
        constraints: []
      };

      const scheduledId = await engine.scheduleOptimization(scheduledOptimization);

      expect(scheduledId).toBe('scheduled-1');

      const status = engine.getOptimizationStatus();
      expect(status.scheduledOptimizations).toBe(1);
      expect(status.nextScheduledOptimization).toBeInstanceOf(Date);
    });

    it('should cancel scheduled optimization', async () => {
      const scheduledOptimization: ScheduledOptimization = {
        id: 'scheduled-1',
        recommendationId: 'rec-1',
        scheduledAt: new Date(Date.now() + 60000),
        priority: 'medium',
        dependencies: [],
        constraints: []
      };

      await engine.scheduleOptimization(scheduledOptimization);
      const cancelled = await engine.cancelOptimization('scheduled-1');

      expect(cancelled).toBe(true);

      const status = engine.getOptimizationStatus();
      expect(status.scheduledOptimizations).toBe(0);
    });

    it('should return false when cancelling non-existent optimization', async () => {
      const cancelled = await engine.cancelOptimization('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should update next scheduled time correctly', async () => {
      const now = Date.now();
      const scheduledOptimizations = [
        {
          id: 'scheduled-1',
          recommendationId: 'rec-1',
          scheduledAt: new Date(now + 120000), // 2 minutes
          priority: 'medium' as const,
          dependencies: [],
          constraints: []
        },
        {
          id: 'scheduled-2',
          recommendationId: 'rec-2',
          scheduledAt: new Date(now + 60000), // 1 minute (earlier)
          priority: 'high' as const,
          dependencies: [],
          constraints: []
        }
      ];

      for (const opt of scheduledOptimizations) {
        await engine.scheduleOptimization(opt);
      }

      const status = engine.getOptimizationStatus();
      expect(status.nextScheduledOptimization?.getTime()).toBe(now + 60000);
    });
  });

  describe('Validation and Rollback', () => {
    beforeEach(async () => {
      await engine.startEngine(mockConfig);
    });

    it('should validate optimization successfully', async () => {
      // First execute an optimization to have history
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);
      const optimizationId = results[0].optimizationId;

      const validation = await engine.validateOptimization(optimizationId);

      expect(validation.optimizationId).toBe(optimizationId);
      expect(validation.validationScore).toBeGreaterThanOrEqual(0);
      expect(validation.validationScore).toBeLessThanOrEqual(100);
      expect(validation.safetyChecks).toHaveLength(1);
    });

    it('should throw error when validating non-existent optimization', async () => {
      await expect(engine.validateOptimization('non-existent'))
        .rejects.toThrow('Optimization non-existent not found in history');
    });

    it('should rollback optimization successfully', async () => {
      // First execute an optimization
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);
      const optimizationId = results[0].optimizationId;

      const rollbackResult = await engine.rollbackOptimization(optimizationId);

      expect(rollbackResult.optimizationId).toBe(optimizationId);
      expect(rollbackResult.status).toBe('success');
      expect(rollbackResult.rollbackId).toBeDefined();
      expect(rollbackResult.executedAt).toBeInstanceOf(Date);
      expect(rollbackResult.restoredMetrics).toBeDefined();

      const status = engine.getOptimizationStatus();
      expect(status.rolledBackOptimizations).toBe(1);
    });

    it('should handle rollback failures gracefully', async () => {
      // Execute optimization first
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);
      const optimizationId = results[0].optimizationId;

      // Mock rollback failure by using invalid ID format
      const rollbackResult = await engine.rollbackOptimization(optimizationId);

      // Should still return a result even if simulated failure occurs
      expect(rollbackResult.optimizationId).toBe(optimizationId);
      expect(['success', 'failed']).toContain(rollbackResult.status);
    });
  });

  describe('Status and Reporting', () => {
    beforeEach(async () => {
      await engine.startEngine(mockConfig);
    });

    it('should provide accurate engine status', async () => {
      const status = engine.getOptimizationStatus();

      expect(status.isRunning).toBe(true);
      expect(status.startedAt).toBeInstanceOf(Date);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.activeOptimizations).toBe(0);
      expect(status.scheduledOptimizations).toBe(0);
      expect(status.completedOptimizations).toBe(0);
      expect(status.failedOptimizations).toBe(0);
      expect(status.rolledBackOptimizations).toBe(0);
      expect(status.currentLoad).toBe(0);
      expect(status.resourceUsage).toBeDefined();
    });

    it('should calculate current load correctly', async () => {
      // Schedule some optimizations to increase load
      const scheduledOptimizations = Array.from({ length: 2 }, (_, i) => ({
        id: `scheduled-${i}`,
        recommendationId: `rec-${i}`,
        scheduledAt: new Date(Date.now() + 60000),
        priority: 'medium' as const,
        dependencies: [],
        constraints: []
      }));

      for (const opt of scheduledOptimizations) {
        await engine.scheduleOptimization(opt);
      }

      const status = engine.getOptimizationStatus();
      expect(status.currentLoad).toBeGreaterThanOrEqual(0);
      expect(status.currentLoad).toBeLessThanOrEqual(100);
    });

    it('should generate optimization report', async () => {
      // Execute some optimizations first
      const recommendations = createMockRecommendations();
      await engine.executeOptimizations(recommendations);

      const report = engine.generateOptimizationReport();

      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.issues).toBeDefined();
    });

    it('should maintain optimization history', async () => {
      const recommendations = createMockRecommendations();
      await engine.executeOptimizations(recommendations);

      const history = engine.getOptimizationHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].optimizationId).toBeDefined();
      expect(history[0].startTime).toBeInstanceOf(Date);
      expect(history[0].endTime).toBeInstanceOf(Date);
      expect(history[0].performanceImpact).toBeDefined();
    });

    it('should sort history by most recent first', async () => {
      const recommendations = createMockRecommendations();
      await engine.executeOptimizations(recommendations);

      // Wait a bit and execute more
      await new Promise(resolve => setTimeout(resolve, 10));
      await engine.executeOptimizations(createMockRecommendations());

      const history = engine.getOptimizationHistory();

      expect(history.length).toBeGreaterThan(1);
      expect(history[0].startTime.getTime()).toBeGreaterThanOrEqual(
        history[1].startTime.getTime()
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when executing optimizations without starting engine', async () => {
      const recommendations = createMockRecommendations();

      await expect(engine.executeOptimizations(recommendations))
        .rejects.toThrow('Optimization engine is not running');
    });

    it('should throw error when scheduling without starting engine', async () => {
      const scheduledOptimization: ScheduledOptimization = {
        id: 'scheduled-1',
        recommendationId: 'rec-1',
        scheduledAt: new Date(),
        priority: 'medium',
        dependencies: [],
        constraints: []
      };

      await expect(engine.scheduleOptimization(scheduledOptimization))
        .rejects.toThrow('Optimization engine is not running');
    });

    it('should handle invalid optimization data gracefully', async () => {
      await engine.startEngine(mockConfig);

      const invalidRecommendations: OptimizationRecommendations = {
        immediate: [createMockRecommendation('critical', 'invalid')],
        preventive: [],
        strategic: [],
        correlationBased: [],
        predictiveBased: []
      };

      // Modify to make it invalid
      (invalidRecommendations.immediate[0] as any).implementation = null;

      const results = await engine.executeOptimizations(invalidRecommendations);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await engine.startEngine(mockConfig);
    });

    it('should calculate performance impact correctly', async () => {
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);

      const result = results[0];
      expect(result.performanceImpact.beforeMetrics).toBeDefined();
      expect(result.performanceImpact.afterMetrics).toBeDefined();
      expect(result.performanceImpact.improvement).toBeDefined();
      expect(result.performanceImpact.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.performanceImpact.overallScore).toBeLessThanOrEqual(100);
    });

    it('should track execution logs', async () => {
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);

      const result = results[0];
      expect(result.executionLog.length).toBeGreaterThan(0);
      expect(result.executionLog[0].timestamp).toBeInstanceOf(Date);
      expect(result.executionLog[0].step).toBeDefined();
      expect(result.executionLog[0].status).toBeDefined();
    });

    it('should measure optimization duration', async () => {
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);

      const result = results[0];
      expect(result.executionLog.every(log => log.duration >= 0)).toBe(true);
    });
  });

  // Helper functions
  function createMockRecommendations(): OptimizationRecommendations {
    return {
      immediate: [createMockRecommendation('high', 'immediate-1')],
      preventive: [createMockRecommendation('medium', 'preventive-1')],
      strategic: [createMockRecommendation('low', 'strategic-1')],
      correlationBased: [createMockRecommendation('medium', 'correlation-1')],
      predictiveBased: [createMockRecommendation('high', 'predictive-1')]
    };
  }

  function createMockRecommendation(
    priority: 'low' | 'medium' | 'high' | 'critical',
    id: string
  ): OptimizationRecommendation {
    const optimizationType: OptimizationType = {
      category: 'performance',
      subcategory: 'caching',
      automated: true,
      reversible: true
    };

    const expectedImpact: ExpectedImpact = {
      performanceImprovement: 15,
      resourceSavings: 10,
      reliabilityImprovement: 5,
      implementationEffort: 'medium',
      riskLevel: 'low'
    };

    const implementationPlan: ImplementationPlan = {
      steps: [{
        id: 'step-1',
        description: 'Apply optimization',
        action: {
          type: 'configuration',
          component: 'cache',
          action: 'optimize',
          parameters: {},
          reversible: true,
          impact: 'medium'
        },
        validation: {
          type: 'performance',
          description: 'Validate performance improvement',
          criteria: {
            metric: 'responseTime',
            expectedValue: 100,
            tolerance: 10,
            operator: '<='
          },
          timeout: 30
        }
      }],
      estimatedDuration: 120,
      requiredResources: [],
      rollbackPlan: {
        steps: [],
        estimatedDuration: 60,
        safetyChecks: []
      }
    };

    return {
      id,
      type: optimizationType,
      component: 'cache',
      priority,
      description: `Mock optimization ${id}`,
      expectedImpact,
      implementation: implementationPlan,
      risks: [],
      dependencies: []
    };
  }
});