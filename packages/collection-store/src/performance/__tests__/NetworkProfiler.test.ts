import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { NetworkProfiler } from '../monitoring/NetworkProfiler';
import type { ProfilerConfig } from '../testing/interfaces';

describe('NetworkProfiler', () => {
  let profiler: NetworkProfiler;
  let testConfig: ProfilerConfig;

  beforeEach(() => {
    testConfig = {
      samplingInterval: 100, // Fast sampling for tests
      maxProfileDuration: 5000, // 5 seconds for tests
      retainProfiles: 60000, // 1 minute for tests
      enableDetailedLogging: false
    };
    profiler = new NetworkProfiler(testConfig);
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
      await profiler.startMonitoring('test-session-2');
      expect(profiler.isActive()).toBe(true);

      const report = await profiler.stopMonitoring();

      expect(profiler.isActive()).toBe(false);
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.duration).toBe('number');
      expect(typeof report.averageBandwidth).toBe('number');
      expect(typeof report.averageLatency).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should throw error when starting monitoring twice', async () => {
      await profiler.startMonitoring('test-session-3');

      await expect(profiler.startMonitoring('test-session-4')).rejects.toThrow(
        'Network monitoring already active'
      );
    });

    it('should throw error when stopping inactive monitoring', async () => {
      await expect(profiler.stopMonitoring()).rejects.toThrow(
        'Network monitoring not active'
      );
    });
  });

  describe('Latency Measurement', () => {
    it('should measure latency for multiple endpoints', async () => {
      const endpoints = ['localhost', 'api.example.com', 'cdn.example.com'];

      const results = await profiler.measureLatency(endpoints);

      expect(results.timestamp).toBeInstanceOf(Date);
      expect(results.measurements).toHaveLength(3);
      expect(typeof results.averageLatency).toBe('number');
      expect(typeof results.minLatency).toBe('number');
      expect(typeof results.maxLatency).toBe('number');
      expect(results.averageLatency).toBeGreaterThan(0);
      expect(results.minLatency).toBeLessThanOrEqual(results.averageLatency);
      expect(results.maxLatency).toBeGreaterThanOrEqual(results.averageLatency);

      // Check individual measurements
      results.measurements.forEach(measurement => {
        expect(endpoints).toContain(measurement.endpoint);
        expect(typeof measurement.latency).toBe('number');
        expect(measurement.latency).toBeGreaterThan(0);
        expect(measurement.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should store latency history', async () => {
      const endpoints = ['localhost'];

      await profiler.measureLatency(endpoints);
      await profiler.measureLatency(endpoints);

      const history = profiler.getLatencyHistory();
      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(typeof history[0].averageLatency).toBe('number');
      expect(Array.isArray(history[0].measurements)).toBe(true);
    });
  });

  describe('Bandwidth Measurement', () => {
    it('should measure bandwidth for different protocols', async () => {
      const protocols = [
        { name: 'HTTP/1.1', port: 80 },
        { name: 'HTTPS', port: 443 },
        { name: 'WebSocket', port: 8080 }
      ];

      const results = await profiler.measureBandwidth(protocols);

      expect(results.timestamp).toBeInstanceOf(Date);
      expect(results.measurements).toHaveLength(3);
      expect(typeof results.totalBandwidth).toBe('number');
      expect(typeof results.averageBandwidth).toBe('number');
      expect(results.totalBandwidth).toBeGreaterThan(0);
      expect(results.averageBandwidth).toBeGreaterThan(0);

      // Check individual measurements
      results.measurements.forEach(measurement => {
        expect(['HTTP/1.1', 'HTTPS', 'WebSocket']).toContain(measurement.protocol);
        expect(typeof measurement.uploadBandwidth).toBe('number');
        expect(typeof measurement.downloadBandwidth).toBe('number');
        expect(measurement.uploadBandwidth).toBeGreaterThan(0);
        expect(measurement.downloadBandwidth).toBeGreaterThan(0);
        expect(measurement.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should store bandwidth history', async () => {
      const protocols = [{ name: 'HTTP/1.1', port: 80 }];

      await profiler.measureBandwidth(protocols);
      await profiler.measureBandwidth(protocols);

      const history = profiler.getBandwidthHistory();
      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(typeof history[0].totalBandwidth).toBe('number');
      expect(Array.isArray(history[0].measurements)).toBe(true);
    });
  });

  describe('WebSocket Analysis', () => {
    it('should analyze WebSocket performance', async () => {
      const config = {
        url: 'ws://localhost:8080',
        protocols: ['chat', 'notifications'],
        maxMessageSize: 1024
      };

      const analysis = await profiler.analyzeWebSocketPerformance(config);

      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(typeof analysis.connectionTime).toBe('number');
      expect(Array.isArray(analysis.messageLatency)).toBe(true);
      expect(typeof analysis.throughput).toBe('number');
      expect(typeof analysis.dropRate).toBe('number');
      expect(typeof analysis.reconnectionRate).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      expect(analysis.connectionTime).toBeGreaterThan(0);
      expect(analysis.messageLatency.length).toBeGreaterThan(0);
      expect(analysis.throughput).toBeGreaterThan(0);
      expect(analysis.dropRate).toBeGreaterThanOrEqual(0);
      expect(analysis.reconnectionRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Network Optimizations', () => {
    it('should generate network optimizations based on analysis report', async () => {
      const mockReport = {
        timestamp: new Date(),
        duration: 60000,
        averageBandwidth: 30 * 1024 * 1024, // 30MB/s (low)
        averageLatency: 150, // High latency
        throughput: 500, // Low throughput
        connectionFailureRate: 0.02, // High failure rate
        protocolAnalysis: [],
        bottlenecks: [],
        recommendations: []
      };

      const optimizations = profiler.generateNetworkOptimizations(mockReport);

      expect(optimizations).toBeDefined();
      expect(typeof optimizations.connectionOptimization).toBe('object');
      expect(typeof optimizations.compressionOptimization).toBe('object');
      expect(typeof optimizations.cachingOptimization).toBe('object');
      expect(typeof optimizations.protocolOptimization).toBe('object');

      // Check that optimizations are enabled based on poor performance
      expect(optimizations.compressionOptimization.enableCompression).toBe(true);
      expect(optimizations.cachingOptimization.enableCaching).toBe(true);
      expect(optimizations.connectionOptimization.enableKeepAlive).toBe(true);
      expect(optimizations.protocolOptimization.preferHTTP2).toBe(true);
      expect(optimizations.protocolOptimization.enableMultiplexing).toBe(true);
    });
  });

  describe('History Management', () => {
    it('should clear all monitoring history', async () => {
      // Generate some history
      await profiler.measureLatency(['localhost']);
      await profiler.measureBandwidth([{ name: 'HTTP/1.1', port: 80 }]);

      expect(profiler.getLatencyHistory().length).toBeGreaterThan(0);
      expect(profiler.getBandwidthHistory().length).toBeGreaterThan(0);

      profiler.clearHistory();

      expect(profiler.getLatencyHistory()).toHaveLength(0);
      expect(profiler.getBandwidthHistory()).toHaveLength(0);
    });
  });
});