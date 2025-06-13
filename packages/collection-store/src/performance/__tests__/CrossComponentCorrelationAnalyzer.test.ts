import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  CrossComponentCorrelationAnalyzer,
  ComponentMetrics,
  CrossComponentCorrelationConfig
} from '../monitoring/CrossComponentCorrelationAnalyzer';

describe('CrossComponentCorrelationAnalyzer', () => {
  let analyzer: CrossComponentCorrelationAnalyzer;
  let config: Partial<CrossComponentCorrelationConfig>;

  beforeEach(() => {
    config = {
      analysisWindow: 5, // 5 minutes for testing
      correlationThreshold: 0.3,
      samplingInterval: 100, // 100ms for faster testing
      detailedLogging: false
    };
    analyzer = new CrossComponentCorrelationAnalyzer(config);
  });

  afterEach(async () => {
    if (analyzer.isMonitoringActive()) {
      await analyzer.stopMonitoring();
    }
    analyzer.clearHistory();
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', async () => {
      await analyzer.startMonitoring('test-session');

      expect(analyzer.isMonitoringActive()).toBe(true);

      // Wait for initial metrics collection
      await new Promise(resolve => setTimeout(resolve, 150));

      const history = analyzer.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should stop monitoring and generate report', async () => {
      await analyzer.startMonitoring('test-session');

      // Wait for some data collection
      await new Promise(resolve => setTimeout(resolve, 200));

      const report = await analyzer.stopMonitoring();

      expect(analyzer.isMonitoringActive()).toBe(false);
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.analysisWindow).toBeDefined();
      expect(Array.isArray(report.correlations)).toBe(true);
      expect(Array.isArray(report.cascadeEffects)).toBe(true);
      expect(Array.isArray(report.criticalPaths)).toBe(true);
      expect(Array.isArray(report.resourceDependencies)).toBe(true);
    });

    it('should throw error when starting monitoring twice', async () => {
      await analyzer.startMonitoring('test-session-1');

      await expect(analyzer.startMonitoring('test-session-2')).rejects.toThrow(
        'Cross-component correlation monitoring is already active'
      );
    });

    it('should throw error when stopping inactive monitoring', async () => {
      await expect(analyzer.stopMonitoring()).rejects.toThrow(
        'Cross-component correlation monitoring is not active'
      );
    });
  });

  describe('Component Metrics Management', () => {
    it('should add component metrics successfully', () => {
      const metrics: ComponentMetrics = {
        componentName: 'test-component',
        timestamp: new Date(),
        responseTime: 100,
        throughput: 500,
        errorRate: 0.01,
        cpuUsage: 50,
        memoryUsage: 60,
        networkLatency: 20,
        diskIO: 80
      };

      analyzer.addComponentMetrics(metrics);

      const history = analyzer.getMetricsHistory();
      expect(history).toHaveLength(1);
      expect(history[0].componentName).toBe('test-component');
      expect(history[0].responseTime).toBe(100);
    });

    it('should limit history size based on analysis window', () => {
      const shortConfig = { ...config, analysisWindow: 1, samplingInterval: 10 };
      const shortAnalyzer = new CrossComponentCorrelationAnalyzer(shortConfig);

      // Add many metrics to exceed the window
      for (let i = 0; i < 100; i++) {
        shortAnalyzer.addComponentMetrics({
          componentName: 'test-component',
          timestamp: new Date(),
          responseTime: 100 + i,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }

      const history = shortAnalyzer.getMetricsHistory();
      const maxExpectedSize = Math.ceil((1 * 60 * 1000) / 10); // 1 minute / 10ms interval
      expect(history.length).toBeLessThanOrEqual(maxExpectedSize);
    });

    it('should clear history successfully', () => {
      // Add some metrics
      for (let i = 0; i < 5; i++) {
        analyzer.addComponentMetrics({
          componentName: `component-${i}`,
          timestamp: new Date(),
          responseTime: 100,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }

      expect(analyzer.getMetricsHistory().length).toBe(5);

      analyzer.clearHistory();

      expect(analyzer.getMetricsHistory().length).toBe(0);
    });
  });

  describe('Correlation Analysis', () => {
    beforeEach(async () => {
      // Add test data with known correlations
      const components = ['auth', 'database', 'realtime'];
      const baseTime = new Date();

      for (let i = 0; i < 20; i++) {
        for (const component of components) {
          const timestamp = new Date(baseTime.getTime() + i * 1000);

          // Create correlated data: auth and database have positive correlation
          let responseTime = 100;
          if (component === 'auth') {
            responseTime = 50 + i * 2; // Linear increase
          } else if (component === 'database') {
            responseTime = 80 + i * 2; // Similar linear increase (positive correlation)
          } else if (component === 'realtime') {
            responseTime = 30 + Math.random() * 10; // Random (no correlation)
          }

          analyzer.addComponentMetrics({
            componentName: component,
            timestamp,
            responseTime,
            throughput: 500 - i,
            errorRate: 0.01,
            cpuUsage: 50 + i,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          });
        }
      }
    });

    it('should analyze correlations between components', async () => {
      const correlations = await analyzer.analyzeCorrelations();

      expect(Array.isArray(correlations)).toBe(true);

      // Should find correlation between auth and database
      const authDbCorrelation = correlations.find(c =>
        (c.component1 === 'auth' && c.component2 === 'database') ||
        (c.component1 === 'database' && c.component2 === 'auth')
      );

      if (authDbCorrelation) {
        expect(authDbCorrelation.correlationCoefficient).toBeGreaterThan(0.5);
        expect(authDbCorrelation.direction).toBe('positive');
        expect(['moderate', 'strong', 'very_strong']).toContain(authDbCorrelation.strength);
      }
    });

    it('should filter correlations by threshold', async () => {
      const highThresholdAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        correlationThreshold: 0.8 // Very high threshold
      });

      // Add the same test data
      const history = analyzer.getMetricsHistory();
      history.forEach(metrics => highThresholdAnalyzer.addComponentMetrics(metrics));

      const correlations = await highThresholdAnalyzer.analyzeCorrelations();

      // Should have fewer or no correlations due to high threshold
      correlations.forEach(correlation => {
        expect(Math.abs(correlation.correlationCoefficient)).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should analyze specific components when provided', async () => {
      const correlations = await analyzer.analyzeCorrelations(['auth', 'database']);

      // Should only analyze correlations between auth and database
      correlations.forEach(correlation => {
        expect(['auth', 'database']).toContain(correlation.component1);
        expect(['auth', 'database']).toContain(correlation.component2);
      });
    });
  });

  describe('Cascade Effects Analysis', () => {
    beforeEach(async () => {
      // Add test data with cascade patterns
      const components = ['trigger', 'affected1', 'affected2', 'independent'];
      const baseTime = new Date();

      for (let i = 0; i < 25; i++) {
        for (const component of components) {
          const timestamp = new Date(baseTime.getTime() + i * 1000);

          let responseTime = 100;
          if (component === 'trigger') {
            responseTime = 50 + i * 3; // Strong trend
          } else if (component === 'affected1') {
            responseTime = 60 + i * 2.5; // Correlated with trigger
          } else if (component === 'affected2') {
            responseTime = 70 + i * 2; // Also correlated with trigger
          } else {
            responseTime = 80 + Math.random() * 10; // Independent
          }

          analyzer.addComponentMetrics({
            componentName: component,
            timestamp,
            responseTime,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          });
        }
      }
    });

    it('should detect cascade effects', async () => {
      const cascadeEffects = await analyzer.analyzeCascadeEffects();

      expect(Array.isArray(cascadeEffects)).toBe(true);

      // Should detect effects from trigger component
      const triggerEffects = cascadeEffects.filter(effect =>
        effect.triggerComponent === 'trigger'
      );

      expect(triggerEffects.length).toBeGreaterThan(0);

      triggerEffects.forEach(effect => {
        expect(effect.triggerComponent).toBe('trigger');
        expect(Array.isArray(effect.affectedComponents)).toBe(true);
        expect(effect.impactMagnitude).toBeGreaterThan(0);
        expect(effect.propagationDelay).toBeGreaterThan(0);
        expect(['performance_degradation', 'resource_contention', 'error_propagation']).toContain(effect.effectType);
        expect(typeof effect.description).toBe('string');
      });
    });

    it('should sort cascade effects by impact magnitude', async () => {
      const cascadeEffects = await analyzer.analyzeCascadeEffects();

      if (cascadeEffects.length > 1) {
        for (let i = 1; i < cascadeEffects.length; i++) {
          expect(cascadeEffects[i].impactMagnitude).toBeLessThanOrEqual(
            cascadeEffects[i - 1].impactMagnitude
          );
        }
      }
    });

    it('should return empty array when cascade analysis is disabled', async () => {
      const noCascadeAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        enableCascadeAnalysis: false
      });

      const cascadeEffects = await noCascadeAnalyzer.analyzeCascadeEffects();
      expect(cascadeEffects).toEqual([]);
    });
  });

  describe('Critical Path Analysis', () => {
    beforeEach(async () => {
      // Add test data for critical path analysis
      const components = ['frontend', 'auth', 'database', 'cache'];
      const baseTime = new Date();

      for (let i = 0; i < 20; i++) {
        for (const component of components) {
          const timestamp = new Date(baseTime.getTime() + i * 1000);

          // Different response times to create critical paths
          const responseTimes = {
            frontend: 50,
            auth: 100,
            database: 200, // Slowest component
            cache: 25
          };

          analyzer.addComponentMetrics({
            componentName: component,
            timestamp,
            responseTime: responseTimes[component as keyof typeof responseTimes] + Math.random() * 20,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          });
        }
      }
    });

    it('should analyze critical paths', async () => {
      const criticalPaths = await analyzer.analyzeCriticalPaths();

      expect(Array.isArray(criticalPaths)).toBe(true);

      criticalPaths.forEach(path => {
        expect(Array.isArray(path.components)).toBe(true);
        expect(path.components.length).toBeGreaterThanOrEqual(2);
        expect(path.totalLatency).toBeGreaterThan(0);
        expect(typeof path.bottleneckComponent).toBe('string');
        expect(path.optimizationPotential).toBeGreaterThan(0);
        expect(Array.isArray(path.recommendations)).toBe(true);
        expect(path.recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should identify bottleneck components correctly', async () => {
      const criticalPaths = await analyzer.analyzeCriticalPaths();

      // Database should often be identified as bottleneck due to highest response time
      const pathsWithDatabase = criticalPaths.filter(path =>
        path.components.includes('database')
      );

      if (pathsWithDatabase.length > 0) {
        const databaseBottlenecks = pathsWithDatabase.filter(path =>
          path.bottleneckComponent === 'database'
        );

        // Most paths containing database should identify it as bottleneck
        expect(databaseBottlenecks.length).toBeGreaterThan(0);
      }
    });

    it('should sort critical paths by total latency', async () => {
      const criticalPaths = await analyzer.analyzeCriticalPaths();

      if (criticalPaths.length > 1) {
        for (let i = 1; i < criticalPaths.length; i++) {
          expect(criticalPaths[i].totalLatency).toBeLessThanOrEqual(
            criticalPaths[i - 1].totalLatency
          );
        }
      }
    });

    it('should return empty array when critical path analysis is disabled', async () => {
      const noCriticalPathAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        enableCriticalPathAnalysis: false
      });

      const criticalPaths = await noCriticalPathAnalyzer.analyzeCriticalPaths();
      expect(criticalPaths).toEqual([]);
    });
  });

  describe('Resource Dependency Analysis', () => {
    beforeEach(async () => {
      // Add test data with resource dependencies
      const components = ['cpu-intensive', 'memory-intensive', 'network-intensive', 'balanced'];
      const baseTime = new Date();

      for (let i = 0; i < 20; i++) {
        for (const component of components) {
          const timestamp = new Date(baseTime.getTime() + i * 1000);

          // Different resource usage patterns
          let cpuUsage = 30;
          let memoryUsage = 40;
          let networkLatency = 20;
          let diskIO = 50;

          if (component === 'cpu-intensive') {
            cpuUsage = 80 + Math.random() * 10; // High CPU usage
          } else if (component === 'memory-intensive') {
            memoryUsage = 85 + Math.random() * 10; // High memory usage
          } else if (component === 'network-intensive') {
            networkLatency = 80 + Math.random() * 20; // High network latency
          }

          analyzer.addComponentMetrics({
            componentName: component,
            timestamp,
            responseTime: 100,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage,
            memoryUsage,
            networkLatency,
            diskIO
          });
        }
      }
    });

    it('should analyze resource dependencies', async () => {
      const dependencies = await analyzer.analyzeResourceDependencies();

      expect(Array.isArray(dependencies)).toBe(true);

      dependencies.forEach(dependency => {
        expect(['cpu', 'memory', 'network', 'disk', 'database']).toContain(dependency.resourceType);
        expect(Array.isArray(dependency.dependentComponents)).toBe(true);
        expect(dependency.contentionLevel).toBeGreaterThanOrEqual(0);
        expect(dependency.utilizationThreshold).toBeGreaterThan(0);
        expect(Array.isArray(dependency.recommendations)).toBe(true);
      });
    });

    it('should identify high resource usage components', async () => {
      const dependencies = await analyzer.analyzeResourceDependencies();

      const cpuDependency = dependencies.find(d => d.resourceType === 'cpu');
      if (cpuDependency) {
        expect(cpuDependency.dependentComponents).toContain('cpu-intensive');
      }

      const memoryDependency = dependencies.find(d => d.resourceType === 'memory');
      if (memoryDependency) {
        expect(memoryDependency.dependentComponents).toContain('memory-intensive');
      }
    });

    it('should sort dependencies by contention level', async () => {
      const dependencies = await analyzer.analyzeResourceDependencies();

      if (dependencies.length > 1) {
        for (let i = 1; i < dependencies.length; i++) {
          expect(dependencies[i].contentionLevel).toBeLessThanOrEqual(
            dependencies[i - 1].contentionLevel
          );
        }
      }
    });

    it('should return empty array when resource dependency analysis is disabled', async () => {
      const noResourceAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        enableResourceDependencyAnalysis: false
      });

      const dependencies = await noResourceAnalyzer.analyzeResourceDependencies();
      expect(dependencies).toEqual([]);
    });
  });

  describe('Optimization Recommendations', () => {
    it('should generate correlation optimizations', () => {
      const mockCorrelations = [
        {
          component1: 'auth',
          component2: 'database',
          correlationCoefficient: 0.9,
          strength: 'very_strong' as const,
          direction: 'positive' as const,
          significance: 0.01,
          sampleSize: 100
        },
        {
          component1: 'cache',
          component2: 'database',
          correlationCoefficient: -0.8,
          strength: 'strong' as const,
          direction: 'negative' as const,
          significance: 0.01,
          sampleSize: 100
        }
      ];

      const optimizations = analyzer.generateCorrelationOptimizations(mockCorrelations);

      expect(optimizations).toHaveProperty('immediate');
      expect(optimizations).toHaveProperty('shortTerm');
      expect(optimizations).toHaveProperty('longTerm');

      expect(Array.isArray(optimizations.immediate)).toBe(true);
      expect(Array.isArray(optimizations.shortTerm)).toBe(true);
      expect(Array.isArray(optimizations.longTerm)).toBe(true);

      // Should have recommendations for negative correlations
      expect(optimizations.immediate.some(rec =>
        rec.includes('negative correlations')
      )).toBe(true);
    });

    it('should provide different recommendations based on correlation patterns', () => {
      const strongPositiveCorrelations = Array.from({ length: 5 }, (_, i) => ({
        component1: `comp${i}`,
        component2: `comp${i + 1}`,
        correlationCoefficient: 0.9,
        strength: 'very_strong' as const,
        direction: 'positive' as const,
        significance: 0.01,
        sampleSize: 100
      }));

      const optimizations = analyzer.generateCorrelationOptimizations(strongPositiveCorrelations);

      // Should recommend monitoring for cascade failures
      expect(optimizations.immediate.some(rec =>
        rec.includes('cascade failures')
      )).toBe(true);
    });

    it('should provide architectural recommendations for many correlations', () => {
      const manyCorrelations = Array.from({ length: 15 }, (_, i) => ({
        component1: `comp${i}`,
        component2: `comp${i + 1}`,
        correlationCoefficient: 0.5,
        strength: 'moderate' as const,
        direction: 'positive' as const,
        significance: 0.01,
        sampleSize: 100
      }));

      const optimizations = analyzer.generateCorrelationOptimizations(manyCorrelations);

      // Should recommend component isolation
      expect(optimizations.shortTerm.some(rec =>
        rec.includes('component isolation')
      )).toBe(true);

      // Should recommend microservices architecture
      expect(optimizations.longTerm.some(rec =>
        rec.includes('microservices')
      )).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom correlation threshold', async () => {
      const strictAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        correlationThreshold: 0.9 // Very strict threshold
      });

      // Add weakly correlated data
      for (let i = 0; i < 20; i++) {
        strictAnalyzer.addComponentMetrics({
          componentName: 'comp1',
          timestamp: new Date(),
          responseTime: 100 + Math.random() * 50,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });

        strictAnalyzer.addComponentMetrics({
          componentName: 'comp2',
          timestamp: new Date(),
          responseTime: 110 + Math.random() * 50,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }

      const correlations = await strictAnalyzer.analyzeCorrelations();

      // Should have few or no correlations due to strict threshold
      correlations.forEach(correlation => {
        expect(Math.abs(correlation.correlationCoefficient)).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should handle detailed logging configuration', () => {
      const loggingAnalyzer = new CrossComponentCorrelationAnalyzer({
        ...config,
        detailedLogging: true
      });

      // Should not throw errors with logging enabled
      expect(() => {
        loggingAnalyzer.addComponentMetrics({
          componentName: 'test',
          timestamp: new Date(),
          responseTime: 100,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      // Add minimal data
      analyzer.addComponentMetrics({
        componentName: 'test',
        timestamp: new Date(),
        responseTime: 100,
        throughput: 500,
        errorRate: 0.01,
        cpuUsage: 50,
        memoryUsage: 60,
        networkLatency: 20,
        diskIO: 80
      });

      const correlations = await analyzer.analyzeCorrelations();

      // Should return empty array for insufficient data
      expect(correlations).toEqual([]);
    });

    it('should handle invalid correlation calculations', async () => {
      // Add data that might cause NaN correlations
      for (let i = 0; i < 15; i++) {
        analyzer.addComponentMetrics({
          componentName: 'constant1',
          timestamp: new Date(),
          responseTime: 100, // Constant value
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });

        analyzer.addComponentMetrics({
          componentName: 'constant2',
          timestamp: new Date(),
          responseTime: 100, // Same constant value
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }

      const correlations = await analyzer.analyzeCorrelations();

      // Should handle constant values gracefully
      correlations.forEach(correlation => {
        expect(isNaN(correlation.correlationCoefficient)).toBe(false);
      });
    });

    it('should handle empty component lists', async () => {
      const correlations = await analyzer.analyzeCorrelations([]);
      expect(correlations).toEqual([]);

      const cascadeEffects = await analyzer.analyzeCascadeEffects();
      expect(Array.isArray(cascadeEffects)).toBe(true);

      const criticalPaths = await analyzer.analyzeCriticalPaths();
      expect(Array.isArray(criticalPaths)).toBe(true);

      const dependencies = await analyzer.analyzeResourceDependencies();
      expect(Array.isArray(dependencies)).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    it('should complete analysis efficiently', async () => {
      const startTime = performance.now();

      // Add substantial amount of test data
      for (let i = 0; i < 50; i++) {
        for (const component of ['auth', 'database', 'realtime', 'files']) {
          analyzer.addComponentMetrics({
            componentName: component,
            timestamp: new Date(),
            responseTime: 100 + Math.random() * 50,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          });
        }
      }

      await analyzer.startMonitoring('perf-test');
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await analyzer.stopMonitoring();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(report).toBeDefined();
    });

    it('should handle concurrent analysis requests', async () => {
      // Add test data
      for (let i = 0; i < 30; i++) {
        analyzer.addComponentMetrics({
          componentName: 'test-component',
          timestamp: new Date(),
          responseTime: 100 + i,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        });
      }

      // Run multiple analyses concurrently
      const promises = [
        analyzer.analyzeCorrelations(),
        analyzer.analyzeCascadeEffects(),
        analyzer.analyzeCriticalPaths(),
        analyzer.analyzeResourceDependencies()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});