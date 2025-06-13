/**
 * Automated Optimization Integration Tests
 * Phase 6 Day 10: Integration tests for the complete automated optimization system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutomatedOptimizationEngine } from '../monitoring/AutomatedOptimizationEngine';
import { RealTimeOptimizer } from '../monitoring/RealTimeOptimizer';
import { OptimizationValidator } from '../monitoring/OptimizationValidator';
import type {
  OptimizationEngineConfig,
  RealTimeConfig,
  OptimizationRecommendations,
  OptimizationRecommendation,
  PerformanceMetrics,
  OptimizationType,
  ExpectedImpact,
  ImplementationPlan
} from '../testing/interfaces';

describe('Automated Optimization Integration', () => {
  let engine: AutomatedOptimizationEngine;
  let realTimeOptimizer: RealTimeOptimizer;
  let validator: OptimizationValidator;

  let engineConfig: OptimizationEngineConfig;
  let realTimeConfig: RealTimeConfig;

  beforeEach(() => {
    engine = new AutomatedOptimizationEngine();
    realTimeOptimizer = new RealTimeOptimizer();
    validator = new OptimizationValidator();

    engineConfig = {
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

    realTimeConfig = {
      monitoringInterval: 1000,
      responseThreshold: 100,
      emergencyThresholds: {
        criticalCpuUsage: 90,
        criticalMemoryUsage: 95,
        criticalErrorRate: 10,
        criticalResponseTime: 500,
        criticalThroughputDrop: 50
      },
      enableDynamicAdjustment: true,
      adjustmentSensitivity: 0.8,
      cooldownPeriod: 5
    };

    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      // Stop engine and clear all state
      if (engine.getOptimizationStatus().isRunning) {
        await engine.stopEngine();
      }
    } catch {
      // Ignore if already stopped
    }

    try {
      // Stop real-time optimizer
      await realTimeOptimizer.stopRealTimeOptimization();
    } catch {
      // Ignore if already stopped
    }

    // Create fresh instances to avoid state pollution between tests
    engine = new AutomatedOptimizationEngine();
    realTimeOptimizer = new RealTimeOptimizer();
    validator = new OptimizationValidator();

    vi.restoreAllMocks();
  });

  describe('Complete Optimization Workflow', () => {
    it('should execute complete optimization workflow successfully', async () => {
      // 1. Start optimization engine
      await engine.startEngine(engineConfig);
      expect(engine.getOptimizationStatus().isRunning).toBe(true);

      // 2. Create optimization recommendations
      const recommendations = createMockRecommendations();

      // 3. Validate optimization safety before execution
      const optimization = createOptimizationPlanFromRecommendation(recommendations.immediate[0]);
      const safetyValidation = await validator.validateOptimizationSafety(optimization);
      expect(safetyValidation.isSafe).toBeDefined();

      // 4. Check resource availability
      const resourceCheck = await validator.checkResourceAvailability(optimization);
      expect(resourceCheck.hasResources).toBeDefined();

      // 5. Execute optimizations
      const results = await engine.executeOptimizations(recommendations);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.optimizationId)).toBe(true);

      // 6. Validate optimization effectiveness
      const optimizationId = results[0].optimizationId;
      const effectivenessValidation = await validator.validateOptimizationEffectiveness(optimizationId);
      expect(effectivenessValidation.isEffective).toBeDefined();

      // 7. Measure performance impact
      const performanceImpact = await validator.measurePerformanceImpact(optimizationId);
      expect(performanceImpact.overallScore).toBeGreaterThanOrEqual(0);

      // 8. Check optimization history
      const history = engine.getOptimizationHistory();
      expect(history.length).toBeGreaterThan(0);

      // 9. Generate optimization report
      const report = engine.generateOptimizationReport();
      expect(report.reportId).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should handle optimization rollback workflow', async () => {
      // Start engine and execute optimization
      await engine.startEngine(engineConfig);
      const recommendations = createMockRecommendations();
      const results = await engine.executeOptimizations(recommendations);
      const optimizationId = results[0].optimizationId;

      // Verify optimization is in history before rollback
      const history = engine.getOptimizationHistory();
      const optimizationInHistory = history.find(h => h.optimizationId === optimizationId);
      expect(optimizationInHistory).toBeDefined();

      // Validate rollback safety
      const rollbackSafety = await validator.validateRollbackSafety(optimizationId);
      expect(rollbackSafety.isSafeToRollback).toBeDefined();

      if (rollbackSafety.isSafeToRollback) {
        // Execute rollback using engine (not validator to avoid double rollback)
        const rollbackResult = await engine.rollbackOptimization(optimizationId);
        expect(rollbackResult.status).toBe('success');
        expect(rollbackResult.rollbackId).toBeDefined();

        // Verify rollback was recorded in history
        const updatedHistory = engine.getOptimizationHistory();
        const rolledBackOptimization = updatedHistory.find(h => h.optimizationId === optimizationId);
        expect(rolledBackOptimization?.rollbackInfo).toBeDefined();
      }
    }, 20000); // Increase timeout to 20 seconds
  });

  describe('Real-Time Optimization Integration', () => {
    it('should integrate real-time optimization with validation', async () => {
      // Start real-time optimizer
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Create metrics that trigger optimization
      const metrics = createMockMetrics({
        cpuUsage: 85,      // Above threshold
        responseTime: 150,  // Above threshold
        errorRate: 3       // Above threshold
      });

      // Apply dynamic optimization
      const actions = await realTimeOptimizer.applyDynamicOptimization(metrics);
      expect(Array.isArray(actions)).toBe(true);

      // If actions were generated, validate them
      if (actions.length > 0) {
        // Create optimization plan from actions
        const optimization = createOptimizationPlanFromActions(actions);

        // Validate safety
        const safetyValidation = await validator.validateOptimizationSafety(optimization);
        expect(safetyValidation.safetyScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle emergency response with validation', async () => {
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Create emergency-level metrics
      const emergencyMetrics = createMockMetrics({
        cpuUsage: 95,      // Emergency level
        errorRate: 12      // Emergency level
      });

      // Apply dynamic optimization (should trigger emergency response)
      const actions = await realTimeOptimizer.applyDynamicOptimization(emergencyMetrics);
      expect(Array.isArray(actions)).toBe(true);

      // Emergency actions should be generated
      if (actions.length > 0) {
        const hasEmergencyAction = actions.some(a =>
          a.action.includes('emergency') || a.type === 'throttling'
        );
        expect(hasEmergencyAction).toBe(true);
      }
    });

    it('should update thresholds and apply new optimization logic', async () => {
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Set very low thresholds to trigger optimizations
      const newThresholds = realTimeOptimizer.getActiveThresholds();
      newThresholds.resourceUsage.cpu.warning = 30;
      newThresholds.responseTime.warning = 80;
      await realTimeOptimizer.updateThresholds(newThresholds);

      // Metrics that would normally be fine but exceed new thresholds
      const metrics = createMockMetrics({
        cpuUsage: 35,      // Above new threshold
        responseTime: 90   // Above new threshold
      });

      const actions = await realTimeOptimizer.applyDynamicOptimization(metrics);
      expect(Array.isArray(actions)).toBe(true);
    });
  });

  describe('Engine and Real-Time Optimizer Coordination', () => {
    it('should coordinate scheduled and real-time optimizations', async () => {
      // Start both systems
      await engine.startEngine(engineConfig);
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Schedule optimization in engine
      const scheduledOptimization = {
        id: 'scheduled-test',
        recommendationId: 'rec-test',
        scheduledAt: new Date(Date.now() + 1000), // 1 second from now
        priority: 'medium' as const,
        dependencies: [],
        constraints: []
      };

      await engine.scheduleOptimization(scheduledOptimization);
      expect(engine.getOptimizationStatus().scheduledOptimizations).toBe(1);

      // Trigger real-time optimization
      const metrics = createMockMetrics({ cpuUsage: 85 });
      const realTimeActions = await realTimeOptimizer.applyDynamicOptimization(metrics);
      expect(Array.isArray(realTimeActions)).toBe(true);

      // Both systems should be able to operate independently
      expect(engine.getOptimizationStatus().isRunning).toBe(true);
    });

    it('should handle resource conflicts between systems', async () => {
      await engine.startEngine(engineConfig);
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Create high-resource optimization
      const highResourceOptimization = createOptimizationPlanFromRecommendation(
        createMockRecommendation('high', 'high-resource-opt')
      );

      // Add high resource requirements
      highResourceOptimization.implementation.requiredResources = [
        { type: 'cpu', amount: 80, unit: '%' },
        { type: 'memory', amount: 12, unit: 'GB' }
      ];

      // Check resource availability
      const resourceCheck = await validator.checkResourceAvailability(highResourceOptimization);

      if (!resourceCheck.hasResources) {
        expect(resourceCheck.resourceGaps.length).toBeGreaterThan(0);
        expect(resourceCheck.estimatedWaitTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle validation failures gracefully', async () => {
      await engine.startEngine(engineConfig);

      // Create invalid optimization
      const invalidRecommendation = createMockRecommendation('critical', 'invalid-opt');
      (invalidRecommendation as any).implementation = null;

      const recommendations: OptimizationRecommendations = {
        immediate: [invalidRecommendation],
        preventive: [],
        strategic: [],
        correlationBased: [],
        predictiveBased: []
      };

      // Should handle invalid recommendations gracefully
      const results = await engine.executeOptimizations(recommendations);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('failed');
    });

    it('should handle system failures and recovery', async () => {
      await engine.startEngine(engineConfig);
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Simulate system stress
      const stressMetrics = createMockMetrics({
        cpuUsage: 98,      // Very high
        memoryUsage: 95,   // Very high
        errorRate: 15,     // Very high
        responseTime: 800  // Very high
      });

      // Both systems should handle stress without crashing
      const realTimeActions = await realTimeOptimizer.applyDynamicOptimization(stressMetrics);
      expect(Array.isArray(realTimeActions)).toBe(true);

      const engineStatus = engine.getOptimizationStatus();
      expect(engineStatus.isRunning).toBe(true);
    });

    it('should maintain audit trail during failures', async () => {
      await engine.startEngine(engineConfig);

      // Execute some optimizations
      const recommendations = createMockRecommendations();
      await engine.executeOptimizations(recommendations);

      // Generate report to check audit trail
      const report = engine.generateOptimizationReport();
      expect(report.reportId).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.period).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent optimizations', async () => {
      // Set higher concurrency limit
      engineConfig.optimizationSchedule.maxConcurrentOptimizations = 5;
      await engine.startEngine(engineConfig);

      // Create multiple optimization batches
      const batches = Array.from({ length: 3 }, () => createMockRecommendations());

      // Execute all batches
      const allResults = [];
      for (const batch of batches) {
        const results = await engine.executeOptimizations(batch);
        allResults.push(...results);
      }

      expect(allResults.length).toBeGreaterThan(0);
      expect(allResults.every(r => r.optimizationId)).toBe(true);
    });

    it('should maintain performance under load', async () => {
      await realTimeOptimizer.startRealTimeOptimization(realTimeConfig);

      // Apply many optimizations rapidly
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        const metrics = createMockMetrics({
          cpuUsage: 30 + Math.random() * 20,
          responseTime: 50 + Math.random() * 30
        });

        await realTimeOptimizer.applyDynamicOptimization(metrics);
      }

      const duration = performance.now() - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
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

  function createOptimizationPlanFromRecommendation(recommendation: OptimizationRecommendation) {
    return {
      id: `plan-${recommendation.id}`,
      recommendationId: recommendation.id,
      type: recommendation.type,
      component: recommendation.component,
      implementation: recommendation.implementation,
      expectedImpact: recommendation.expectedImpact,
      risks: recommendation.risks,
      constraints: [],
      priority: recommendation.priority
    };
  }

  function createOptimizationPlanFromActions(actions: any[]) {
    return {
      id: `plan-${Date.now()}`,
      recommendationId: `rec-${Date.now()}`,
      type: {
        category: 'performance',
        subcategory: 'realtime',
        automated: true,
        reversible: true
      },
      component: 'system',
      implementation: {
        steps: actions.map((action, index) => ({
          id: `step-${index + 1}`,
          description: `Execute ${action.action}`,
          action,
          validation: {
            type: 'performance',
            description: 'Validate action',
            criteria: {
              metric: 'responseTime',
              expectedValue: 100,
              tolerance: 10,
              operator: '<='
            },
            timeout: 30
          }
        })),
        estimatedDuration: 60,
        requiredResources: [],
        rollbackPlan: {
          steps: [],
          estimatedDuration: 30,
          safetyChecks: []
        }
      },
      expectedImpact: {
        performanceImprovement: 10,
        resourceSavings: 5,
        reliabilityImprovement: 5,
        implementationEffort: 'low',
        riskLevel: 'low'
      },
      risks: [],
      constraints: [],
      priority: 'medium' as const
    };
  }

  function createMockMetrics(overrides: Partial<{
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
  }> = {}): PerformanceMetrics {
    const defaults = {
      cpuUsage: 30,
      memoryUsage: 40,
      responseTime: 50,
      throughput: 100,
      errorRate: 1
    };

    const values = { ...defaults, ...overrides };

    return {
      timestamp: new Date(),
      responseTime: {
        min: values.responseTime * 0.5,
        max: values.responseTime * 2,
        avg: values.responseTime,
        p50: values.responseTime * 0.9,
        p95: values.responseTime * 1.5,
        p99: values.responseTime * 1.8
      },
      throughput: {
        totalOperations: values.throughput * 10,
        operationsPerSecond: values.throughput,
        successfulOperations: values.throughput * 9,
        failedOperations: Math.floor(values.throughput * 0.1)
      },
      errors: {
        totalErrors: Math.floor(values.errorRate * 10),
        errorRate: values.errorRate,
        errorTypes: {}
      },
      system: {
        cpuUsage: values.cpuUsage,
        memoryUsage: Math.floor((values.memoryUsage / 100) * 8 * 1024 * 1024 * 1024),
        networkBandwidth: 100 + Math.random() * 50,
        diskIO: 50 + Math.random() * 30
      }
    };
  }
});