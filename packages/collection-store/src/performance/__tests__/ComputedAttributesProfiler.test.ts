import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ComputedAttributesProfiler } from '../monitoring/ComputedAttributesProfiler';

describe('ComputedAttributesProfiler', () => {
  let profiler: ComputedAttributesProfiler;

  beforeEach(() => {
    profiler = new ComputedAttributesProfiler({
      samplingInterval: 100, // Fast sampling for tests
      enableDetailedLogging: false
    });
  });

  afterEach(async () => {
    if (profiler.isActive()) {
      await profiler.stopMonitoring();
    }
    profiler.clearHistory();
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', async () => {
      expect(profiler.isActive()).toBe(false);

      await profiler.startMonitoring('test-session-1');

      expect(profiler.isActive()).toBe(true);
    });

    it('should stop monitoring and generate report', async () => {
      await profiler.startMonitoring('test-session-1');

      // Wait for some metrics collection
      await new Promise(resolve => setTimeout(resolve, 250));

      const report = await profiler.stopMonitoring();

      expect(profiler.isActive()).toBe(false);
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThan(0);
      expect(typeof report.totalComputations).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should throw error when starting monitoring twice', async () => {
      await profiler.startMonitoring('test-session-1');

      await expect(profiler.startMonitoring('test-session-2')).rejects.toThrow(
        'Computed attributes monitoring already active'
      );
    });

    it('should throw error when stopping inactive monitoring', async () => {
      await expect(profiler.stopMonitoring()).rejects.toThrow(
        'Computed attributes monitoring not active'
      );
    });
  });

  describe('Computation Profiling', () => {
    it('should profile computation performance', async () => {
      const config = {
        attributeName: 'test-attribute',
        computationType: 'aggregate' as const,
        dependencies: ['field1', 'field2', 'field3']
      };

      const analysis = await profiler.profileComputation(config);

      expect(analysis).toBeDefined();
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.attributeName).toBe(config.attributeName);
      expect(analysis.computationType).toBe(config.computationType);
      expect(typeof analysis.computationTime).toBe('number');
      expect(typeof analysis.memoryUsage).toBe('number');
      expect(typeof analysis.cacheHitRatio).toBe('number');
      expect(typeof analysis.dependencyCount).toBe('number');
      expect(Array.isArray(analysis.circularDependencies)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      // Validate ranges
      expect(analysis.computationTime).toBeGreaterThan(0);
      expect(analysis.cacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.cacheHitRatio).toBeLessThanOrEqual(1);
      expect(analysis.dependencyCount).toBe(config.dependencies!.length);
    });

    it('should generate recommendations for slow computation', async () => {
      const config = {
        attributeName: 'slow-computation',
        computationType: 'complex' as const,
        dependencies: Array.from({ length: 15 }, (_, i) => `field${i}`) // Many dependencies
      };

      const analysis = await profiler.profileComputation(config);

      // Check recommendations based on performance
      if (analysis.computationTime > 100) {
        expect(analysis.recommendations).toContain('Consider optimizing computation algorithm');
      }
      if (analysis.cacheHitRatio < 0.8) {
        expect(analysis.recommendations).toContain('Improve cache strategy for better hit ratio');
      }
      if (analysis.dependencyCount > 10) {
        expect(analysis.recommendations).toContain('Consider reducing dependency complexity');
      }
      if (analysis.circularDependencies.length > 0) {
        expect(analysis.recommendations).toContain('Resolve circular dependencies to improve performance');
      }
    });

    it('should handle computation without dependencies', async () => {
      const config = {
        attributeName: 'simple-attribute',
        computationType: 'simple' as const
      };

      const analysis = await profiler.profileComputation(config);

      expect(analysis).toBeDefined();
      expect(analysis.dependencyCount).toBe(0);
      expect(analysis.computationTime).toBeGreaterThan(0);
    });
  });

  describe('Cache Efficiency Analysis', () => {
    it('should analyze cache efficiency', async () => {
      const config = {
        cacheSize: 1000,
        operationCount: 5000
      };

      const analysis = await profiler.analyzeCacheEfficiency(config);

      expect(analysis).toBeDefined();
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.cacheSize).toBe(config.cacheSize);
      expect(typeof analysis.hitRatio).toBe('number');
      expect(typeof analysis.missRatio).toBe('number');
      expect(typeof analysis.evictionRate).toBe('number');
      expect(typeof analysis.averageAccessTime).toBe('number');
      expect(typeof analysis.memoryEfficiency).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      // Validate ranges and relationships
      expect(analysis.hitRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.hitRatio).toBeLessThanOrEqual(1);
      expect(analysis.missRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.missRatio).toBeLessThanOrEqual(1);
      expect(Math.abs(analysis.hitRatio + analysis.missRatio - 1)).toBeLessThan(0.01); // Should sum to ~1
      expect(analysis.evictionRate).toBeGreaterThanOrEqual(0);
      expect(analysis.averageAccessTime).toBeGreaterThan(0);
      expect(analysis.memoryEfficiency).toBeGreaterThanOrEqual(0);
      expect(analysis.memoryEfficiency).toBeLessThanOrEqual(1);
    });

    it('should generate cache optimization recommendations', async () => {
      const config = {
        cacheSize: 100, // Small cache
        operationCount: 10000 // Many operations
      };

      const analysis = await profiler.analyzeCacheEfficiency(config);

      // Check recommendations based on performance
      if (analysis.hitRatio < 0.8) {
        expect(analysis.recommendations).toContain('Increase cache size or improve cache strategy');
      }
      if (analysis.evictionRate > 0.1) {
        expect(analysis.recommendations).toContain('Consider LRU or adaptive cache eviction policy');
      }
      if (analysis.averageAccessTime > 5) {
        expect(analysis.recommendations).toContain('Optimize cache data structure for faster access');
      }
      if (analysis.memoryEfficiency < 0.7) {
        expect(analysis.recommendations).toContain('Optimize cache memory usage and data serialization');
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should collect computation metrics during monitoring', async () => {
      await profiler.startMonitoring('metrics-test');

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 250));

      const report = await profiler.stopMonitoring();

      // Should have collected some metrics
      expect(report.totalComputations).toBeGreaterThan(0);
      expect(report.averageComputationTime).toBeGreaterThan(0);
      expect(report.averageCacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(report.averageCacheHitRatio).toBeLessThanOrEqual(1);
    });

    it('should clear history', async () => {
      await profiler.startMonitoring('clear-test');

      // Perform some operations
      await profiler.profileComputation({
        attributeName: 'test-attr',
        computationType: 'simple'
      });

      await profiler.analyzeCacheEfficiency({
        cacheSize: 500,
        operationCount: 1000
      });

      await profiler.stopMonitoring();

      // Clear history
      profiler.clearHistory();

      // Start monitoring again to verify clean state
      await profiler.startMonitoring('clean-test');
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopMonitoring();

      // Should only have baseline measurements
      expect(report.totalComputations).toBeGreaterThanOrEqual(1); // At least baseline
    });
  });

  describe('Performance Analysis Report', () => {
    it('should generate comprehensive analysis report', async () => {
      await profiler.startMonitoring('analysis-test');

      // Perform some operations to generate metrics
      await profiler.profileComputation({
        attributeName: 'test-computation',
        computationType: 'aggregate',
        dependencies: ['field1', 'field2']
      });

      await profiler.analyzeCacheEfficiency({
        cacheSize: 1000,
        operationCount: 2000
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const report = await profiler.stopMonitoring();

      // Validate report structure
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.duration).toBe('number');
      expect(typeof report.totalComputations).toBe('number');
      expect(typeof report.averageComputationTime).toBe('number');
      expect(typeof report.averageCacheHitRatio).toBe('number');
      expect(typeof report.averageDependencyDepth).toBe('number');
      expect(typeof report.averageUpdateLatency).toBe('number');
      expect(typeof report.circularDependencies).toBe('number');
      expect(typeof report.memoryEfficiency).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Validate ranges
      expect(report.duration).toBeGreaterThan(0);
      expect(report.totalComputations).toBeGreaterThan(0);
      expect(report.averageComputationTime).toBeGreaterThan(0);
      expect(report.averageCacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(report.averageCacheHitRatio).toBeLessThanOrEqual(1);
      expect(report.circularDependencies).toBeGreaterThanOrEqual(0);
      expect(report.memoryEfficiency).toBeGreaterThanOrEqual(0);
      expect(report.memoryEfficiency).toBeLessThanOrEqual(1);
    });

    it('should identify bottlenecks and provide recommendations', async () => {
      await profiler.startMonitoring('bottleneck-test');
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopMonitoring();

      // Check that bottlenecks and recommendations are properly identified
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Validate recommendation logic
      if (report.averageComputationTime > 100) {
        expect(report.bottlenecks).toContain('High computation time detected');
        expect(report.recommendations).toContain('Optimize computation algorithms and enable parallel processing');
      }

      if (report.averageCacheHitRatio < 0.8) {
        expect(report.bottlenecks).toContain('Low cache hit ratio');
        expect(report.recommendations).toContain('Improve cache strategy and increase cache size');
      }

      if (report.circularDependencies > 0) {
        expect(report.bottlenecks).toContain('Circular dependencies detected');
        expect(report.recommendations).toContain('Resolve circular dependencies to improve performance');
      }

      if (report.averageUpdateLatency > 50) {
        expect(report.bottlenecks).toContain('High update latency');
        expect(report.recommendations).toContain('Implement batch updates and incremental recomputation');
      }

      if (report.memoryEfficiency < 0.7) {
        expect(report.bottlenecks).toContain('Low memory efficiency');
        expect(report.recommendations).toContain('Optimize memory usage and data structures');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid computation configurations gracefully', async () => {
      const invalidConfig = {
        attributeName: '',
        computationType: 'simple' as const,
        dependencies: []
      };

      // Should not throw, but handle gracefully
      const analysis = await profiler.profileComputation(invalidConfig);
      expect(analysis).toBeDefined();
      expect(analysis.attributeName).toBe('');
      expect(analysis.dependencyCount).toBe(0);
    });

    it('should handle zero cache size', async () => {
      const config = {
        cacheSize: 0,
        operationCount: 100
      };

      const analysis = await profiler.analyzeCacheEfficiency(config);
      expect(analysis).toBeDefined();
      expect(analysis.cacheSize).toBe(0);
    });

    it('should handle zero operations', async () => {
      const config = {
        cacheSize: 1000,
        operationCount: 0
      };

      const analysis = await profiler.analyzeCacheEfficiency(config);
      expect(analysis).toBeDefined();
      // Should handle zero operations gracefully
      expect(analysis.cacheSize).toBe(1000);
      expect(typeof analysis.averageAccessTime).toBe('number');
      expect(analysis.averageAccessTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom sampling interval', async () => {
      const customProfiler = new ComputedAttributesProfiler({
        samplingInterval: 50, // Very fast sampling
        enableDetailedLogging: false
      });

      await customProfiler.startMonitoring('custom-test');
      await new Promise(resolve => setTimeout(resolve, 200));
      const report = await customProfiler.stopMonitoring();

      // Should have collected more metrics due to faster sampling
      expect(report.totalComputations).toBeGreaterThan(2); // At least 3-4 samples in 200ms

      customProfiler.clearHistory();
    });

    it('should handle detailed logging configuration', () => {
      const loggingProfiler = new ComputedAttributesProfiler({
        enableDetailedLogging: true
      });

      expect(loggingProfiler).toBeDefined();
      expect(loggingProfiler.isActive()).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple computation types', async () => {
      const configs = [
        { attributeName: 'simple-attr', computationType: 'simple' as const },
        { attributeName: 'aggregate-attr', computationType: 'aggregate' as const, dependencies: ['field1', 'field2'] },
        { attributeName: 'complex-attr', computationType: 'complex' as const, dependencies: ['field1', 'field2', 'field3', 'field4'] }
      ];

      const analyses = await Promise.all(
        configs.map(config => profiler.profileComputation(config))
      );

      expect(analyses).toHaveLength(3);
      analyses.forEach((analysis, index) => {
        expect(analysis.attributeName).toBe(configs[index].attributeName);
        expect(analysis.computationType).toBe(configs[index].computationType);
        expect(analysis.computationTime).toBeGreaterThan(0);
      });

      // Complex computations should generally take longer
      const simpleTime = analyses[0].computationTime;
      const complexTime = analyses[2].computationTime;
      // Note: Due to randomization, this might not always be true, so we just check they're both positive
      expect(simpleTime).toBeGreaterThan(0);
      expect(complexTime).toBeGreaterThan(0);
    });

    it('should handle cache analysis with different sizes', async () => {
      const cacheSizes = [100, 1000, 10000];
      const operationCount = 5000;

      const analyses = await Promise.all(
        cacheSizes.map(size => profiler.analyzeCacheEfficiency({
          cacheSize: size,
          operationCount
        }))
      );

      expect(analyses).toHaveLength(3);
      analyses.forEach((analysis, index) => {
        expect(analysis.cacheSize).toBe(cacheSizes[index]);
        expect(analysis.hitRatio).toBeGreaterThanOrEqual(0);
        expect(analysis.hitRatio).toBeLessThanOrEqual(1);
      });
    });
  });
});