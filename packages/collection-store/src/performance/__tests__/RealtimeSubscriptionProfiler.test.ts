import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RealtimeSubscriptionProfiler } from '../monitoring/RealtimeSubscriptionProfiler';

describe('RealtimeSubscriptionProfiler', () => {
  let profiler: RealtimeSubscriptionProfiler;

  beforeEach(() => {
    profiler = new RealtimeSubscriptionProfiler({
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
      expect(typeof report.totalSubscriptions).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should throw error when starting monitoring twice', async () => {
      await profiler.startMonitoring('test-session-1');

      await expect(profiler.startMonitoring('test-session-2')).rejects.toThrow(
        'Real-time subscription monitoring already active'
      );
    });

    it('should throw error when stopping inactive monitoring', async () => {
      await expect(profiler.stopMonitoring()).rejects.toThrow(
        'Real-time subscription monitoring not active'
      );
    });
  });

  describe('Subscription Lifecycle Profiling', () => {
    it('should profile subscription lifecycle', async () => {
      const config = {
        subscriptionId: 'test-subscription-1',
        channel: 'test-channel',
        messageRate: 10
      };

      const analysis = await profiler.profileSubscriptionLifecycle(config);

      expect(analysis).toBeDefined();
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.subscriptionId).toBe(config.subscriptionId);
      expect(typeof analysis.creationTime).toBe('number');
      expect(typeof analysis.firstMessageLatency).toBe('number');
      expect(typeof analysis.averageMessageLatency).toBe('number');
      expect(typeof analysis.connectionStability).toBe('number');
      expect(typeof analysis.teardownTime).toBe('number');
      expect(typeof analysis.totalMessages).toBe('number');
      expect(typeof analysis.droppedMessages).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      // Validate ranges
      expect(analysis.creationTime).toBeGreaterThan(0);
      expect(analysis.connectionStability).toBeGreaterThanOrEqual(0);
      expect(analysis.connectionStability).toBeLessThanOrEqual(1);
      expect(analysis.totalMessages).toBeGreaterThan(0);
      expect(analysis.droppedMessages).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendations for slow subscription creation', async () => {
      const config = {
        subscriptionId: 'slow-subscription',
        channel: 'test-channel',
        messageRate: 5
      };

      const analysis = await profiler.profileSubscriptionLifecycle(config);

      // Check if recommendations are generated for performance issues
      if (analysis.creationTime > 100) {
        expect(analysis.recommendations).toContain('Optimize subscription creation process');
      }
      if (analysis.firstMessageLatency > 50) {
        expect(analysis.recommendations).toContain('Reduce initial message latency');
      }
      if (analysis.connectionStability < 0.95) {
        expect(analysis.recommendations).toContain('Improve connection stability and error handling');
      }
    });
  });

  describe('Cross-Tab Synchronization Analysis', () => {
    it('should analyze cross-tab synchronization', async () => {
      const config = {
        tabCount: 3,
        channel: 'sync-channel',
        messageRate: 5
      };

      const analysis = await profiler.analyzeCrossTabSync(config);

      expect(analysis).toBeDefined();
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.tabCount).toBe(config.tabCount);
      expect(Array.isArray(analysis.syncLatency)).toBe(true);
      expect(analysis.syncLatency).toHaveLength(config.tabCount);
      expect(typeof analysis.averageSyncLatency).toBe('number');
      expect(typeof analysis.maxSyncLatency).toBe('number');
      expect(typeof analysis.syncReliability).toBe('number');
      expect(typeof analysis.conflictResolutionTime).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      // Validate ranges
      expect(analysis.averageSyncLatency).toBeGreaterThan(0);
      expect(analysis.maxSyncLatency).toBeGreaterThanOrEqual(analysis.averageSyncLatency);
      expect(analysis.syncReliability).toBeGreaterThanOrEqual(0);
      expect(analysis.syncReliability).toBeLessThanOrEqual(1);
    });

    it('should generate recommendations for slow sync', async () => {
      const config = {
        tabCount: 5,
        channel: 'slow-sync-channel',
        messageRate: 10
      };

      const analysis = await profiler.analyzeCrossTabSync(config);

      // Check recommendations based on performance
      if (analysis.averageSyncLatency > 25) {
        expect(analysis.recommendations).toContain('Optimize cross-tab synchronization mechanism');
      }
      if (analysis.maxSyncLatency > 100) {
        expect(analysis.recommendations).toContain('Implement timeout handling for slow tabs');
      }
      if (analysis.syncReliability < 0.98) {
        expect(analysis.recommendations).toContain('Improve synchronization reliability');
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should collect subscription metrics during monitoring', async () => {
      await profiler.startMonitoring('metrics-test');

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 250));

      const subscriptionMetrics = profiler.getSubscriptionMetrics();
      const connectionMetrics = profiler.getConnectionMetrics();

      expect(Array.isArray(subscriptionMetrics)).toBe(true);
      expect(Array.isArray(connectionMetrics)).toBe(true);

      // Should have collected some metrics
      expect(subscriptionMetrics.length).toBeGreaterThan(0);
      expect(connectionMetrics.length).toBeGreaterThan(0);

      // Validate metric structure
      if (subscriptionMetrics.length > 0) {
        const metric = subscriptionMetrics[0];
        expect(metric.timestamp).toBeInstanceOf(Date);
        expect(typeof metric.subscriptionId).toBe('string');
        expect(typeof metric.duration).toBe('number');
        expect(typeof metric.messageCount).toBe('number');
        expect(typeof metric.averageLatency).toBe('number');
        expect(typeof metric.stability).toBe('number');
      }

      if (connectionMetrics.length > 0) {
        const metric = connectionMetrics[0];
        expect(metric.timestamp).toBeInstanceOf(Date);
        expect(typeof metric.activeConnections).toBe('number');
        expect(typeof metric.averageLatency).toBe('number');
        expect(typeof metric.messageRate).toBe('number');
        expect(typeof metric.memoryUsage).toBe('number');
      }
    });

    it('should clear history', async () => {
      await profiler.startMonitoring('clear-test');
      await new Promise(resolve => setTimeout(resolve, 150));
      await profiler.stopMonitoring();

      // Verify metrics exist
      expect(profiler.getSubscriptionMetrics().length).toBeGreaterThan(0);
      expect(profiler.getConnectionMetrics().length).toBeGreaterThan(0);

      // Clear history
      profiler.clearHistory();

      // Verify metrics are cleared
      expect(profiler.getSubscriptionMetrics()).toHaveLength(0);
      expect(profiler.getConnectionMetrics()).toHaveLength(0);
      expect(profiler.getEventMetrics()).toHaveLength(0);
      expect(profiler.getCrossTabMetrics()).toHaveLength(0);
    });
  });

  describe('Performance Analysis Report', () => {
    it('should generate comprehensive analysis report', async () => {
      await profiler.startMonitoring('analysis-test');

      // Perform some operations to generate metrics
      await profiler.profileSubscriptionLifecycle({
        subscriptionId: 'test-sub-1',
        channel: 'test-channel',
        messageRate: 15
      });

      await profiler.analyzeCrossTabSync({
        tabCount: 2,
        channel: 'test-channel',
        messageRate: 10
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const report = await profiler.stopMonitoring();

      // Validate report structure
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.duration).toBe('number');
      expect(typeof report.totalSubscriptions).toBe('number');
      expect(typeof report.averageSubscriptionLatency).toBe('number');
      expect(typeof report.averageMessageLatency).toBe('number');
      expect(typeof report.averageConnectionLatency).toBe('number');
      expect(typeof report.crossTabSyncLatency).toBe('number');
      expect(typeof report.subscriptionCreationLatency).toBe('number');
      expect(typeof report.eventPropagationLatency).toBe('number');
      expect(typeof report.connectionStability).toBe('number');
      expect(typeof report.throughput).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Validate ranges
      expect(report.duration).toBeGreaterThan(0);
      expect(report.connectionStability).toBeGreaterThanOrEqual(0);
      expect(report.connectionStability).toBeLessThanOrEqual(1);
      expect(report.throughput).toBeGreaterThanOrEqual(0);
    });

    it('should identify bottlenecks and provide recommendations', async () => {
      await profiler.startMonitoring('bottleneck-test');
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopMonitoring();

      // Check that bottlenecks and recommendations are properly identified
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Validate recommendation logic
      if (report.averageSubscriptionLatency > 25) {
        expect(report.bottlenecks).toContain('High subscription latency detected');
        expect(report.recommendations).toContain('Optimize subscription processing pipeline');
      }

      if (report.crossTabSyncLatency > 25) {
        expect(report.bottlenecks).toContain('Slow cross-tab synchronization');
        expect(report.recommendations).toContain('Implement optimistic synchronization');
      }

      if (report.connectionStability < 0.95) {
        expect(report.bottlenecks).toContain('Low connection stability');
        expect(report.recommendations).toContain('Improve connection reliability and error handling');
      }

      if (report.throughput < 200) {
        expect(report.bottlenecks).toContain('Low message throughput');
        expect(report.recommendations).toContain('Implement message batching and compression');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations gracefully', async () => {
      // Test with invalid subscription config
      const invalidConfig = {
        subscriptionId: '',
        channel: '',
        messageRate: -1
      };

      // Should not throw, but handle gracefully
      const analysis = await profiler.profileSubscriptionLifecycle(invalidConfig);
      expect(analysis).toBeDefined();
      expect(analysis.subscriptionId).toBe('');
    });

    it('should handle zero tab count in cross-tab sync', async () => {
      const config = {
        tabCount: 0,
        channel: 'test-channel',
        messageRate: 5
      };

      const analysis = await profiler.analyzeCrossTabSync(config);
      expect(analysis).toBeDefined();
      expect(analysis.tabCount).toBe(0);
      expect(analysis.syncLatency).toHaveLength(0);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom sampling interval', async () => {
      const customProfiler = new RealtimeSubscriptionProfiler({
        samplingInterval: 50, // Very fast sampling
        enableDetailedLogging: false
      });

      await customProfiler.startMonitoring('custom-test');
      await new Promise(resolve => setTimeout(resolve, 200));
      const report = await customProfiler.stopMonitoring();

      // Should have collected more metrics due to faster sampling
      const metrics = customProfiler.getConnectionMetrics();
      expect(metrics.length).toBeGreaterThan(2); // At least 3-4 samples in 200ms

      customProfiler.clearHistory();
    });

    it('should handle detailed logging configuration', () => {
      const loggingProfiler = new RealtimeSubscriptionProfiler({
        enableDetailedLogging: true
      });

      expect(loggingProfiler).toBeDefined();
      expect(loggingProfiler.isActive()).toBe(false);
    });
  });
});