/**
 * File Storage Performance Monitor
 * Week 3 Day 17-18: Performance Optimization
 *
 * Monitors and tracks performance metrics for file storage operations
 */

import { EventEmitter } from 'events';

export interface PerformanceMetric {
  duration: number;
  memoryDelta: number;
  success: boolean;
  error?: string;
  timestamp: number;
  operationSize?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  averageMemoryUsage: number;
  throughput: number; // operations per second
  errorRate: number;
  lastUpdated: Date;
}

export interface PerformanceThresholds {
  maxDuration: number;
  maxMemoryUsage: number;
  minSuccessRate: number;
  maxErrorRate: number;
}

export interface PerformanceMonitorConfig {
  enableMetrics: boolean;
  maxMetricsHistory: number;
  aggregationInterval: number;
  alertThresholds: PerformanceThresholds;
  enableAlerts: boolean;
}

export class FileStoragePerformanceMonitor extends EventEmitter {
  private metrics = new Map<string, PerformanceMetric[]>();
  private config: PerformanceMonitorConfig;
  private aggregationTimer?: NodeJS.Timeout;
  private running = false;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();

    this.config = {
      enableMetrics: true,
      maxMetricsHistory: 1000,
      aggregationInterval: 60000, // 1 minute
      alertThresholds: {
        maxDuration: 5000, // 5 seconds
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        minSuccessRate: 0.95, // 95%
        maxErrorRate: 0.05 // 5%
      },
      enableAlerts: true,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;

    if (this.config.aggregationInterval > 0) {
      this.aggregationTimer = setInterval(() => {
        this.aggregateMetrics();
      }, this.config.aggregationInterval);
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    this.emit('stopped');
  }

  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.config.enableMetrics) {
      return await fn();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const timestamp = Date.now();

    try {
      const result = await fn();

      const metric: PerformanceMetric = {
        duration: performance.now() - startTime,
        memoryDelta: process.memoryUsage().heapUsed - startMemory.heapUsed,
        success: true,
        timestamp,
        metadata
      };

      this.recordMetric(operation, metric);
      return result;
    } catch (error) {
      const metric: PerformanceMetric = {
        duration: performance.now() - startTime,
        memoryDelta: process.memoryUsage().heapUsed - startMemory.heapUsed,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        metadata
      };

      this.recordMetric(operation, metric);
      throw error;
    }
  }

  recordMetric(operation: string, metric: PerformanceMetric): void {
    if (!this.config.enableMetrics) return;

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Limit history size
    if (operationMetrics.length > this.config.maxMetricsHistory) {
      operationMetrics.shift();
    }

    // Check thresholds and emit alerts
    if (this.config.enableAlerts) {
      this.checkThresholds(operation, metric);
    }

    this.emit('metricRecorded', { operation, metric });
  }

  getMetrics(operation: string): PerformanceStats | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration);
    const memoryUsages = metrics.map(m => m.memoryDelta);
    const successfulOps = metrics.filter(m => m.success);
    const failedOps = metrics.filter(m => !m.success);

    // Calculate time range for throughput
    const timeRange = (Math.max(...metrics.map(m => m.timestamp)) -
                      Math.min(...metrics.map(m => m.timestamp))) / 1000; // seconds

    return {
      totalOperations: metrics.length,
      successRate: successfulOps.length / metrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
      averageMemoryUsage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
      throughput: timeRange > 0 ? metrics.length / timeRange : 0,
      errorRate: failedOps.length / metrics.length,
      lastUpdated: new Date()
    };
  }

  getAllMetrics(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();

    for (const operation of this.metrics.keys()) {
      const stats = this.getMetrics(operation);
      if (stats) {
        allStats.set(operation, stats);
      }
    }

    return allStats;
  }

  getOperationSummary(): {
    totalOperations: number;
    totalOperationTypes: number;
    overallSuccessRate: number;
    overallErrorRate: number;
    averageThroughput: number;
  } {
    const allStats = this.getAllMetrics();
    const statsArray = Array.from(allStats.values());

    if (statsArray.length === 0) {
      return {
        totalOperations: 0,
        totalOperationTypes: 0,
        overallSuccessRate: 0,
        overallErrorRate: 0,
        averageThroughput: 0
      };
    }

    const totalOps = statsArray.reduce((sum, stats) => sum + stats.totalOperations, 0);
    const totalSuccessful = statsArray.reduce((sum, stats) => sum + (stats.totalOperations * stats.successRate), 0);
    const totalFailed = statsArray.reduce((sum, stats) => sum + (stats.totalOperations * stats.errorRate), 0);
    const avgThroughput = statsArray.reduce((sum, stats) => sum + stats.throughput, 0) / statsArray.length;

    return {
      totalOperations: totalOps,
      totalOperationTypes: allStats.size,
      overallSuccessRate: totalOps > 0 ? totalSuccessful / totalOps : 0,
      overallErrorRate: totalOps > 0 ? totalFailed / totalOps : 0,
      averageThroughput: avgThroughput
    };
  }

  clearMetrics(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
    } else {
      this.metrics.clear();
    }

    this.emit('metricsCleared', { operation });
  }

  updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private checkThresholds(operation: string, metric: PerformanceMetric): void {
    const thresholds = this.config.alertThresholds;

    // Check duration threshold
    if (metric.duration > thresholds.maxDuration) {
      this.emit('alert', {
        type: 'duration',
        operation,
        value: metric.duration,
        threshold: thresholds.maxDuration,
        message: `Operation ${operation} exceeded duration threshold: ${metric.duration}ms > ${thresholds.maxDuration}ms`
      });
    }

    // Check memory threshold
    if (metric.memoryDelta > thresholds.maxMemoryUsage) {
      this.emit('alert', {
        type: 'memory',
        operation,
        value: metric.memoryDelta,
        threshold: thresholds.maxMemoryUsage,
        message: `Operation ${operation} exceeded memory threshold: ${metric.memoryDelta} bytes > ${thresholds.maxMemoryUsage} bytes`
      });
    }

    // Check success rate (requires recent metrics)
    const stats = this.getMetrics(operation);
    if (stats) {
      if (stats.successRate < thresholds.minSuccessRate) {
        this.emit('alert', {
          type: 'successRate',
          operation,
          value: stats.successRate,
          threshold: thresholds.minSuccessRate,
          message: `Operation ${operation} success rate below threshold: ${(stats.successRate * 100).toFixed(2)}% < ${(thresholds.minSuccessRate * 100).toFixed(2)}%`
        });
      }

      if (stats.errorRate > thresholds.maxErrorRate) {
        this.emit('alert', {
          type: 'errorRate',
          operation,
          value: stats.errorRate,
          threshold: thresholds.maxErrorRate,
          message: `Operation ${operation} error rate above threshold: ${(stats.errorRate * 100).toFixed(2)}% > ${(thresholds.maxErrorRate * 100).toFixed(2)}%`
        });
      }
    }
  }

  private aggregateMetrics(): void {
    const summary = this.getOperationSummary();

    this.emit('metricsAggregated', {
      timestamp: new Date(),
      summary,
      operations: this.getAllMetrics()
    });
  }

  // Utility methods for common file storage operations
  async measureFileUpload<T>(fn: () => Promise<T>, fileSize?: number): Promise<T> {
    return this.measureOperation('file_upload', fn, { fileSize });
  }

  async measureFileDownload<T>(fn: () => Promise<T>, fileSize?: number): Promise<T> {
    return this.measureOperation('file_download', fn, { fileSize });
  }

  async measureFileDelete<T>(fn: () => Promise<T>): Promise<T> {
    return this.measureOperation('file_delete', fn);
  }

  async measureMetadataOperation<T>(fn: () => Promise<T>, operationType: string): Promise<T> {
    return this.measureOperation(`metadata_${operationType}`, fn);
  }

  async measureCompressionOperation<T>(fn: () => Promise<T>, algorithm?: string): Promise<T> {
    return this.measureOperation('compression', fn, { algorithm });
  }

  async measureReplicationOperation<T>(fn: () => Promise<T>, targetNodes?: string[]): Promise<T> {
    return this.measureOperation('replication', fn, { targetNodes: targetNodes?.length });
  }

  async measureThumbnailGeneration<T>(fn: () => Promise<T>, thumbnailCount?: number): Promise<T> {
    return this.measureOperation('thumbnail_generation', fn, { thumbnailCount });
  }
}