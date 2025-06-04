import { describe, test, expect, beforeEach } from 'bun:test';
import { BottleneckAnalyzer } from '../monitoring/BottleneckAnalyzer';
import type {
  BottleneckReport,
  Bottleneck,
  PerformanceMetrics,
  OptimizationConfig,
  AuthOptimizations,
  DatabaseOptimizations
} from '../testing/interfaces';

describe('Phase 6: BottleneckAnalyzer', () => {
  let analyzer: BottleneckAnalyzer;

  beforeEach(() => {
    analyzer = new BottleneckAnalyzer({
      enableAuthOptimization: true,
      enableDatabaseOptimization: true,
      enableRealtimeOptimization: true,
      enableFileOptimization: true,
      enableSystemOptimization: true
    });
  });

  describe('Optimization Plan Generation', () => {
    test('should generate optimization plan from bottleneck report', async () => {
      const mockReport: BottleneckReport = {
        sessionId: 'test-session',
        timestamp: new Date(),
        duration: 5000,
        components: ['authentication', 'database'],
        bottlenecks: [
          {
            component: 'authentication',
            issue: 'Slow login response',
            severity: 'warning',
            metric: 'loginTime',
            value: 25,
            threshold: 20,
            impact: 'User experience degradation',
            recommendation: 'Implement token caching'
          },
          {
            component: 'database',
            issue: 'Slow query execution',
            severity: 'critical',
            metric: 'executionTime',
            value: 250,
            threshold: 100,
            impact: 'Application performance degradation',
            recommendation: 'Add database indexes'
          }
        ],
        recommendations: [],
        summary: {
          criticalIssues: 1,
          warningIssues: 1,
          optimizationOpportunities: 0,
          overallScore: 75
        }
      };

      const plan = await analyzer.analyzeBottlenecks(mockReport);

      expect(plan).toBeTruthy();
      expect(plan.sessionId).toBe('test-session');
      expect(plan.overallScore).toBe(75);
      expect(plan.criticalIssues).toBe(1);
      expect(plan.priority).toBe('critical'); // Has critical issues
      expect(plan.optimizations.length).toBeGreaterThan(0);
      expect(plan.implementationPlan.length).toBeGreaterThan(0);
      expect(Object.keys(plan.expectedImprovements).length).toBeGreaterThan(0);
    });

    test('should prioritize optimizations by impact', async () => {
      const mockReport: BottleneckReport = {
        sessionId: 'priority-test',
        timestamp: new Date(),
        duration: 3000,
        components: ['authentication', 'database', 'system'],
        bottlenecks: [
          {
            component: 'authentication',
            issue: 'Minor delay',
            severity: 'info',
            metric: 'loginTime',
            value: 12,
            threshold: 10,
            impact: 'Minor impact',
            recommendation: 'Minor optimization'
          },
          {
            component: 'database',
            issue: 'Critical performance issue',
            severity: 'critical',
            metric: 'executionTime',
            value: 500,
            threshold: 100,
            impact: 'Major impact',
            recommendation: 'Critical optimization'
          },
          {
            component: 'system',
            issue: 'Moderate CPU usage',
            severity: 'warning',
            metric: 'cpuUsage',
            value: 85,
            threshold: 80,
            impact: 'Moderate impact',
            recommendation: 'Moderate optimization'
          }
        ],
        recommendations: [],
        summary: {
          criticalIssues: 1,
          warningIssues: 1,
          optimizationOpportunities: 1,
          overallScore: 60
        }
      };

      const plan = await analyzer.analyzeBottlenecks(mockReport);

      // Should be sorted by impact (high -> medium -> low)
      expect(plan.optimizations[0].expectedImpact).toBe('high'); // Database (critical)
      expect(plan.optimizations[1].expectedImpact).toBe('medium'); // System (warning)
      expect(plan.optimizations[2].expectedImpact).toBe('low'); // Auth (info)
    });
  });

  describe('Component-Specific Optimizations', () => {
    test('should generate authentication optimizations', () => {
      const bottlenecks: Bottleneck[] = [
        {
          component: 'authentication',
          issue: 'Slow login',
          severity: 'warning',
          metric: 'loginTime',
          value: 25,
          threshold: 15,
          impact: 'User experience',
          recommendation: 'Cache tokens'
        },
        {
          component: 'authentication',
          issue: 'Low throughput',
          severity: 'warning',
          metric: 'throughput',
          value: 100,
          threshold: 150,
          impact: 'System capacity',
          recommendation: 'Pool connections'
        }
      ];

      const optimizations = analyzer.generateAuthOptimizations(bottlenecks);

      expect(optimizations.tokenCache.enabled).toBe(true);
      expect(optimizations.tokenCache.ttl).toBe(300); // 5 minutes for slow login
      expect(optimizations.connectionPool.enabled).toBe(true);
      expect(optimizations.connectionPool.maxConnections).toBe(200); // Higher for low throughput
      expect(optimizations.batchValidation.enabled).toBe(true);
    });

    test('should generate database optimizations', () => {
      const bottlenecks: Bottleneck[] = [
        {
          component: 'database',
          issue: 'Slow queries',
          severity: 'critical',
          metric: 'executionTime',
          value: 200,
          threshold: 50,
          impact: 'Application performance',
          recommendation: 'Add indexes'
        },
        {
          component: 'database',
          issue: 'Low throughput',
          severity: 'warning',
          metric: 'throughput',
          value: 250,
          threshold: 300,
          impact: 'System capacity',
          recommendation: 'Optimize queries'
        }
      ];

      const optimizations = analyzer.generateDatabaseOptimizations(bottlenecks);

      expect(optimizations.indexes.autoCreateIndexes).toBe(true);
      expect(optimizations.indexes.analyzeQueryPatterns).toBe(true);
      expect(optimizations.queryCache.enabled).toBe(true);
      expect(optimizations.queryCache.ttl).toBe(300); // Shorter TTL for slow queries
      expect(optimizations.connections.poolSize).toBe(100); // Higher for low throughput
    });

    test('should handle empty bottlenecks gracefully', () => {
      const emptyBottlenecks: Bottleneck[] = [];

      const authOpts = analyzer.generateAuthOptimizations(emptyBottlenecks);
      const dbOpts = analyzer.generateDatabaseOptimizations(emptyBottlenecks);

      // Should provide conservative defaults
      expect(authOpts.tokenCache.enabled).toBe(false);
      expect(authOpts.connectionPool.enabled).toBe(false);
      expect(dbOpts.indexes.autoCreateIndexes).toBe(false);
      expect(dbOpts.queryCache.enabled).toBe(false);
    });
  });

  describe('Performance Target Validation', () => {
    test('should validate performance metrics against targets', () => {
      const mockMetrics: PerformanceMetrics = {
        timestamp: new Date(),
        responseTime: {
          avg: 15, // Above 10ms target
          min: 5,
          max: 30,
          p50: 12,
          p95: 25,
          p99: 30
        },
        throughput: {
          totalOperations: 9000,
          operationsPerSecond: 150, // Below 200 ops/sec target
          successfulOperations: 8985,
          failedOperations: 15
        },
        system: {
          cpuUsage: 85, // Above 70% target
          memoryUsage: 6 * 1024 * 1024 * 1024, // 6GB - within 8GB target
          networkBandwidth: 100 * 1024 * 1024, // 100MB/s
          diskIO: 1000 // ops/sec
        },
        errors: {
          errorRate: 0.001, // 0.1% - within target
          totalErrors: 10,
          errorTypes: {
            'timeout': 5,
            'connection': 3,
            'validation': 2
          }
        }
      };

      const result = analyzer.validatePerformanceTargets(mockMetrics);

      expect(result.overallStatus).toBe('critical'); // Has critical throughput issue
      expect(result.failedTargets.length).toBe(3); // responseTime, throughput, cpuUsage

      // Check specific failures
      const authFailure = result.failedTargets.find(t => t.component === 'authentication');
      const throughputFailure = result.failedTargets.find(t => t.metric === 'throughput');
      const cpuFailure = result.failedTargets.find(t => t.metric === 'cpuUsage');

      expect(authFailure?.severity).toBe('warning');
      expect(throughputFailure?.severity).toBe('critical');
      expect(cpuFailure?.severity).toBe('warning');

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should pass validation when all targets are met', () => {
      const goodMetrics: PerformanceMetrics = {
        timestamp: new Date(),
        responseTime: {
          avg: 8, // Under 10ms target
          min: 3,
          max: 15,
          p50: 7,
          p95: 12,
          p99: 15
        },
        throughput: {
          totalOperations: 15000,
          operationsPerSecond: 250, // Above 200 ops/sec target
          successfulOperations: 14995,
          failedOperations: 5
        },
        system: {
          cpuUsage: 60, // Under 70% target
          memoryUsage: 5 * 1024 * 1024 * 1024, // 5GB - under 8GB target
          networkBandwidth: 200 * 1024 * 1024, // 200MB/s
          diskIO: 1500 // ops/sec
        },
        errors: {
          errorRate: 0.0005, // 0.05% - under 0.1% target
          totalErrors: 5,
          errorTypes: {
            'timeout': 2,
            'connection': 2,
            'validation': 1
          }
        }
      };

      const result = analyzer.validatePerformanceTargets(goodMetrics);

      expect(result.overallStatus).toBe('pass');
      expect(result.failedTargets.length).toBe(0);
      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('Configuration & Edge Cases', () => {
    test('should handle empty bottleneck report', async () => {
      const emptyReport: BottleneckReport = {
        sessionId: 'empty-test',
        timestamp: new Date(),
        duration: 1000,
        components: [],
        bottlenecks: [],
        recommendations: [],
        summary: { criticalIssues: 0, warningIssues: 0, optimizationOpportunities: 0, overallScore: 100 }
      };

      const plan = await analyzer.analyzeBottlenecks(emptyReport);

      expect(plan.optimizations.length).toBe(0);
      expect(plan.implementationPlan.length).toBe(0);
      expect(plan.priority).toBe('low');
      expect(plan.estimatedEffort).toBe('low');
      expect(Object.keys(plan.expectedImprovements).length).toBe(0);
    });

    test('should use default configuration when none provided', () => {
      const defaultAnalyzer = new BottleneckAnalyzer();
      expect(defaultAnalyzer).toBeTruthy();

      // Should have all optimizations enabled by default
      const authOpts = defaultAnalyzer.generateAuthOptimizations([]);
      const dbOpts = defaultAnalyzer.generateDatabaseOptimizations([]);

      expect(authOpts).toBeTruthy();
      expect(dbOpts).toBeTruthy();
    });
  });
});
