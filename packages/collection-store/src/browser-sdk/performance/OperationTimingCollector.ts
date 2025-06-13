// src/browser-sdk/performance/OperationTimingCollector.ts

import { IPerformanceCollector, PerformanceMetric, PerformanceMetricType } from './types';

/**
 * Collects operation timing metrics using the Performance Observer API.
 */
export class OperationTimingCollector implements IPerformanceCollector {
  private observer: PerformanceObserver | null = null;
  private collectedMetrics: PerformanceMetric[] = [];
  private metricHandlers: ((metric: PerformanceMetric) => void)[] = [];

  /**
   * Starts observing performance entries for operation timing.
   */
  start(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported in this environment. Operation timing will not be collected.');
      return;
    }

    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.entryType === 'measure' || entry.entryType === 'mark') {
          const metric: PerformanceMetric = {
            type: PerformanceMetricType.OperationTiming,
            name: entry.name,
            value: entry.duration || 0, // duration is for measures, marks have 0 duration
            unit: 'ms',
            timestamp: entry.startTime + performance.timeOrigin,
            metadata: {
              entryType: entry.entryType,
            },
          };
          this.collectedMetrics.push(metric);
          this.emitMetric(metric);
        }
      });
    });

    // Observe 'measure' entries (from performance.measure calls)
    // 'mark' entries can also be observed if needed for finer-grained control
    this.observer.observe({ entryTypes: ['measure'] });
    console.log('OperationTimingCollector started.');
  }

  /**
   * Stops observing performance entries.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('OperationTimingCollector stopped.');
    }
  }

  /**
   * Returns the currently collected operation timing metrics.
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