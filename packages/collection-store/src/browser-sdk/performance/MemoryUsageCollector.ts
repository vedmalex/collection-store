// src/browser-sdk/performance/MemoryUsageCollector.ts

import { IPerformanceCollector, PerformanceMetric, PerformanceMetricType } from './types';

/**
 * Collects memory usage metrics using window.performance.memory (non-standard) or other available APIs.
 * Note: window.performance.memory is a non-standard API and may not be available in all browsers.
 */
export class MemoryUsageCollector implements IPerformanceCollector {
  private intervalId: number | null = null;
  private collectedMetrics: PerformanceMetric[] = [];
  private metricHandlers: ((metric: PerformanceMetric) => void)[] = [];
  private collectionIntervalMs: number = 1000; // Collect every 1 second by default

  constructor(collectionIntervalMs?: number) {
    if (collectionIntervalMs) {
      this.collectionIntervalMs = collectionIntervalMs;
    }
  }

  /**
   * Starts collecting memory usage metrics at a specified interval.
   */
  start(): void {
    if (typeof window === 'undefined' || !window.performance || !('memory' in window.performance)) {
      console.warn('window.performance.memory API not available. Memory usage will not be collected.');
      return;
    }

    this.intervalId = window.setInterval(() => {
      const memory = (window.performance as any).memory; // Type assertion due to non-standard API
      if (memory) {
        const metric: PerformanceMetric = {
          type: PerformanceMetricType.MemoryUsage,
          name: 'totalJSHeapSize',
          value: memory.totalJSHeapSize,
          unit: 'bytes',
          timestamp: Date.now(),
          metadata: {
            usedJSHeapSize: memory.usedJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        };
        this.collectedMetrics.push(metric);
        this.emitMetric(metric);
      }
    }, this.collectionIntervalMs);
    console.log(`MemoryUsageCollector started with interval: ${this.collectionIntervalMs}ms.`);
  }

  /**
   * Stops collecting memory usage metrics.
   */
  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('MemoryUsageCollector stopped.');
    }
  }

  /**
   * Returns the currently collected memory usage metrics.
   * Note: This clears the internal buffer after collection.
   * @returns A promise that resolves with an array of PerformanceMetric.
   */
  async collect(): Promise<PerformanceMetric[]> {
    const metrics = [...this.collectedMetrics];
    this.collectedMetrics = []; // Clear buffer after collection
    return metrics;
  }

  /**
   * Registers a handler to be called when a new metric is collected.
   * @param handler The callback function.
   */
  onMetric(handler: (metric: PerformanceMetric) => void): void {
    this.metricHandlers.push(handler);
  }

  /**
   * Unregisters a metric handler.
   * @param handler The handler to remove.
   */
  offMetric(handler: (metric: PerformanceMetric) => void): void {
    this.metricHandlers = this.metricHandlers.filter(h => h !== handler);
  }

  private emitMetric(metric: PerformanceMetric): void {
    this.metricHandlers.forEach(handler => handler(metric));
  }
}