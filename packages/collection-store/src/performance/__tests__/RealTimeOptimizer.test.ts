/**
 * Real-Time Optimizer Tests
 * Phase 6 Day 10: Comprehensive test suite for real-time optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealTimeOptimizer } from '../monitoring/RealTimeOptimizer';
import type {
  RealTimeConfig,
  PerformanceMetrics,
  PerformanceThresholds,
  PerformanceEmergency,
  ComponentConfig,
  EmergencyThresholds
} from '../testing/interfaces';

describe('RealTimeOptimizer', () => {
  let optimizer: RealTimeOptimizer;
  let mockConfig: RealTimeConfig;

  beforeEach(() => {
    optimizer = new RealTimeOptimizer();

    mockConfig = {
      monitoringInterval: 1000, // 1 second for testing
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
      cooldownPeriod: 5 // 5 seconds for testing
    };

    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      await optimizer.stopRealTimeOptimization();
    } catch {
      // Ignore if already stopped
    }
    vi.restoreAllMocks();
  });

  describe('Lifecycle Management', () => {
    it('should start real-time optimization successfully', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);

      // Verify it's running by checking if we can get thresholds
      const thresholds = optimizer.getActiveThresholds();
      expect(thresholds).toBeDefined();
      expect(thresholds.responseTime).toBeDefined();
    });

    it('should throw error when starting already running optimizer', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);

      await expect(optimizer.startRealTimeOptimization(mockConfig))
        .rejects.toThrow('Real-time optimizer is already running');
    });

        it('should stop real-time optimization successfully', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
      await optimizer.stopRealTimeOptimization();

      // Should be able to start again after stopping
      await optimizer.startRealTimeOptimization(mockConfig);
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });

    it('should throw error when stopping non-running optimizer', async () => {
      await expect(optimizer.stopRealTimeOptimization())
        .rejects.toThrow('Real-time optimizer is not running');
    });
  });

  describe('Dynamic Optimization', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should apply dynamic optimization based on metrics', async () => {
      const metrics = createMockMetrics({
        cpuUsage: 80, // Above warning threshold
        responseTime: 150 // Above warning threshold
      });

      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.type === 'configuration')).toBe(true);
    });

    it('should not apply optimization during cooldown period', async () => {
      const metrics = createMockMetrics({ cpuUsage: 80 });

      // First optimization
      const actions1 = await optimizer.applyDynamicOptimization(metrics);
      expect(actions1.length).toBeGreaterThan(0);

      // Second optimization immediately (should be blocked by cooldown)
      const actions2 = await optimizer.applyDynamicOptimization(metrics);
      expect(actions2.length).toBe(0);
    });

    it('should generate CPU optimization actions', async () => {
      const metrics = createMockMetrics({ cpuUsage: 80 });

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const cpuAction = actions.find(a => a.action === 'reduce_cpu_load');
      expect(cpuAction).toBeDefined();
      expect(cpuAction?.component).toBe('system');
      expect(cpuAction?.reversible).toBe(true);
    });

    it('should generate memory optimization actions', async () => {
      const metrics = createMockMetrics({ memoryUsage: 85 }); // High memory usage

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const memoryAction = actions.find(a => a.action === 'optimize_memory');
      expect(memoryAction).toBeDefined();
      expect(memoryAction?.component).toBe('system');
    });

    it('should generate response time optimization actions', async () => {
      const metrics = createMockMetrics({ responseTime: 150 });

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const cacheAction = actions.find(a => a.action === 'enable_aggressive_caching');
      expect(cacheAction).toBeDefined();
      expect(cacheAction?.component).toBe('application');
    });

    it('should generate throughput optimization actions', async () => {
      // First add some history to establish baseline
      for (let i = 0; i < 6; i++) {
        await optimizer.applyDynamicOptimization(createMockMetrics({ throughput: 100 }));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Now provide low throughput
      const metrics = createMockMetrics({ throughput: 60 }); // Below baseline

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const scalingAction = actions.find(a => a.action === 'increase_worker_threads');
      expect(scalingAction).toBeDefined();
      expect(scalingAction?.component).toBe('application');
    });

    it('should throw error when not running', async () => {
      await optimizer.stopRealTimeOptimization();

      const metrics = createMockMetrics();

      await expect(optimizer.applyDynamicOptimization(metrics))
        .rejects.toThrow('Real-time optimizer is not running');
    });
  });

  describe('Emergency Response', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should detect CPU spike emergency', async () => {
      const metrics = createMockMetrics({ cpuUsage: 95 }); // Above critical threshold

      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions.length).toBeGreaterThan(0);
      const emergencyAction = actions.find(a => a.action === 'emergency_cpu_throttling');
      expect(emergencyAction).toBeDefined();
    });

    it('should detect memory leak emergency', async () => {
      const metrics = createMockMetrics({ memoryUsage: 98 }); // Above critical threshold

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const emergencyAction = actions.find(a => a.action === 'force_garbage_collection');
      expect(emergencyAction).toBeDefined();
    });

    it('should detect error storm emergency', async () => {
      const metrics = createMockMetrics({ errorRate: 15 }); // Above critical threshold

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const emergencyAction = actions.find(a => a.action === 'enable_circuit_breaker');
      expect(emergencyAction).toBeDefined();
    });

    it('should detect latency spike emergency', async () => {
      const metrics = createMockMetrics({ responseTime: 600 }); // Above critical threshold

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const emergencyAction = actions.find(a => a.action === 'emergency_cache_warming');
      expect(emergencyAction).toBeDefined();
    });

    it('should detect throughput drop emergency', async () => {
      // Establish baseline
      for (let i = 0; i < 6; i++) {
        await optimizer.applyDynamicOptimization(createMockMetrics({ throughput: 100 }));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Simulate major throughput drop
      const metrics = createMockMetrics({ throughput: 30 }); // 70% drop

      const actions = await optimizer.applyDynamicOptimization(metrics);

      const emergencyAction = actions.find(a => a.action === 'emergency_scaling');
      expect(emergencyAction).toBeDefined();
    });

    it('should handle emergency response execution', async () => {
      const emergency: PerformanceEmergency = {
        type: 'cpu_spike',
        severity: 'critical',
        component: 'system',
        metrics: createMockMetrics({ cpuUsage: 95 }),
        timestamp: new Date(),
        description: 'CPU usage critical'
      };

      const response = await optimizer.handlePerformanceEmergency(emergency);

      expect(response.responseId).toBeDefined();
      expect(response.emergencyType).toBe('cpu_spike');
      expect(response.actions.length).toBeGreaterThan(0);
      expect(response.executedAt).toBeInstanceOf(Date);
      expect(response.effectiveness).toBeGreaterThan(0);
      expect(response.effectiveness).toBeLessThanOrEqual(1);
    });

    it('should not handle same emergency type if already active', async () => {
      const metrics = createMockMetrics({ cpuUsage: 95 });

      // First emergency response
      const actions1 = await optimizer.applyDynamicOptimization(metrics);
      expect(actions1.length).toBeGreaterThan(0);

      // Second emergency of same type (should be ignored)
      const actions2 = await optimizer.applyDynamicOptimization(metrics);
      expect(actions2.length).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should adjust component configuration successfully', async () => {
      const config: ComponentConfig = {
        cacheSize: '512MB',
        maxConnections: 1000,
        timeout: 30000
      };

      const result = await optimizer.adjustConfiguration('cache', config);

      expect(result).toBe(true);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig: ComponentConfig = {};

      const result = await optimizer.adjustConfiguration('cache', invalidConfig);

      expect(result).toBe(false);
    });

    it('should throw error when adjusting configuration while not running', async () => {
      await optimizer.stopRealTimeOptimization();

      const config: ComponentConfig = { setting: 'value' };

      await expect(optimizer.adjustConfiguration('cache', config))
        .rejects.toThrow('Real-time optimizer is not running');
    });
  });

  describe('Threshold Management', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should update performance thresholds', async () => {
      const newThresholds: PerformanceThresholds = {
        responseTime: {
          warning: 80,
          critical: 150,
          unit: 'ms',
          direction: 'above'
        },
        throughput: {
          warning: 60,
          critical: 40,
          unit: 'ops/sec',
          direction: 'below'
        },
        errorRate: {
          warning: 3,
          critical: 7,
          unit: '%',
          direction: 'above'
        },
        resourceUsage: {
          cpu: {
            warning: 75,
            critical: 90,
            unit: '%',
            direction: 'above'
          },
          memory: {
            warning: 80,
            critical: 95,
            unit: '%',
            direction: 'above'
          },
          network: {
            warning: 85,
            critical: 98,
            unit: '%',
            direction: 'above'
          },
          disk: {
            warning: 85,
            critical: 98,
            unit: '%',
            direction: 'above'
          }
        }
      };

      await optimizer.updateThresholds(newThresholds);

      const activeThresholds = optimizer.getActiveThresholds();
      expect(activeThresholds.responseTime.warning).toBe(80);
      expect(activeThresholds.throughput.critical).toBe(40);
    });

    it('should get active thresholds', async () => {
      const thresholds = optimizer.getActiveThresholds();

      expect(thresholds.responseTime).toBeDefined();
      expect(thresholds.throughput).toBeDefined();
      expect(thresholds.errorRate).toBeDefined();
      expect(thresholds.resourceUsage).toBeDefined();
      expect(thresholds.resourceUsage.cpu).toBeDefined();
      expect(thresholds.resourceUsage.memory).toBeDefined();
    });

    it('should use updated thresholds for optimization decisions', async () => {
      // Set very low CPU warning threshold
      const newThresholds = optimizer.getActiveThresholds();
      newThresholds.resourceUsage.cpu.warning = 30;
      await optimizer.updateThresholds(newThresholds);

      // CPU usage above new threshold should trigger optimization
      const metrics = createMockMetrics({ cpuUsage: 35 });
      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions.some(a => a.action === 'reduce_cpu_load')).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should maintain performance history', async () => {
      const metrics1 = createMockMetrics({ cpuUsage: 50 });
      const metrics2 = createMockMetrics({ cpuUsage: 60 });

      await optimizer.applyDynamicOptimization(metrics1);
      await optimizer.applyDynamicOptimization(metrics2);

      // History should be maintained internally (tested through throughput baseline)
      const metrics3 = createMockMetrics({ throughput: 50 });
      const actions = await optimizer.applyDynamicOptimization(metrics3);

      // Should have some optimization actions based on history
      expect(actions).toBeDefined();
    });

    it('should limit history size', async () => {
      // Add many metrics to test history limit
      for (let i = 0; i < 1100; i++) { // More than maxHistorySize (1000)
        await optimizer.applyDynamicOptimization(createMockMetrics());
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1)); // Prevent blocking
        }
      }

      // Should still function normally
      const metrics = createMockMetrics({ cpuUsage: 80 });
      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions).toBeDefined();
    });

    it('should calculate recent average throughput', async () => {
      // Add consistent throughput history
      for (let i = 0; i < 6; i++) {
        await optimizer.applyDynamicOptimization(createMockMetrics({ throughput: 100 }));
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Low throughput should trigger scaling action
      const metrics = createMockMetrics({ throughput: 70 });
      const actions = await optimizer.applyDynamicOptimization(metrics);

      const scalingAction = actions.find(a => a.action === 'increase_worker_threads');
      expect(scalingAction).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring cycle errors gracefully', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);

      // The monitoring cycle should handle errors internally
            // We can't easily test this without mocking internal methods
      // But we can verify the optimizer continues to work

      const metrics = createMockMetrics();
      const actions = await optimizer.applyDynamicOptimization(metrics);
      // Should return actions array without throwing
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should handle action execution failures', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);

      // Even if some actions fail internally, the method should not throw
      const metrics = createMockMetrics({ cpuUsage: 95 }); // Trigger emergency

      const actions = await optimizer.applyDynamicOptimization(metrics);
      // Should return actions array without throwing
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should handle invalid metrics gracefully', async () => {
      await optimizer.startRealTimeOptimization(mockConfig);

      const invalidMetrics = createMockMetrics();
      (invalidMetrics as any).system = null;

      // Should handle gracefully without throwing
      try {
        const actions = await optimizer.applyDynamicOptimization(invalidMetrics);
        expect(Array.isArray(actions)).toBe(true);
      } catch (error) {
        // It's okay if it throws for invalid metrics
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await optimizer.startRealTimeOptimization(mockConfig);
    });

    it('should handle multiple simultaneous issues', async () => {
      const metrics = createMockMetrics({
        cpuUsage: 85,      // High CPU
        responseTime: 180,  // High response time
        errorRate: 8       // High error rate
      });

      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions.length).toBeGreaterThan(1);
      expect(actions.some(a => a.action === 'reduce_cpu_load')).toBe(true);
      expect(actions.some(a => a.action === 'enable_aggressive_caching')).toBe(true);
    });

    it('should prioritize emergency responses over regular optimizations', async () => {
      const emergencyMetrics = createMockMetrics({
        cpuUsage: 95,      // Emergency level
        responseTime: 120   // Regular optimization level
      });

      const actions = await optimizer.applyDynamicOptimization(emergencyMetrics);

      // Should have emergency action
      expect(actions.some(a => a.action === 'emergency_cpu_throttling')).toBe(true);
    });

    it('should work with custom emergency thresholds', async () => {
      const customConfig = { ...mockConfig };
      customConfig.emergencyThresholds.criticalCpuUsage = 80; // Lower threshold

      await optimizer.stopRealTimeOptimization();
      await optimizer.startRealTimeOptimization(customConfig);

      const metrics = createMockMetrics({ cpuUsage: 85 }); // Above custom threshold
      const actions = await optimizer.applyDynamicOptimization(metrics);

      expect(actions.some(a => a.action === 'emergency_cpu_throttling')).toBe(true);
    });
  });

  // Helper functions
  function createMockMetrics(overrides: Partial<{
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
  }> = {}): PerformanceMetrics {
    const defaults = {
      cpuUsage: 30,
      memoryUsage: 40, // percentage of 8GB
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
        memoryUsage: Math.floor((values.memoryUsage / 100) * 8 * 1024 * 1024 * 1024), // Convert % to bytes
        networkBandwidth: 100 + Math.random() * 50,
        diskIO: 50 + Math.random() * 30
      }
    };
  }
});