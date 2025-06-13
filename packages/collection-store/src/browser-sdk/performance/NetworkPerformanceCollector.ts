// src/browser-sdk/performance/NetworkPerformanceCollector.ts

import { IPerformanceCollector, PerformanceMetric, PerformanceMetricType } from './types';

/**
 * Collects network performance metrics using the PerformanceObserver API for resource timing.
 */
export class NetworkPerformanceCollector implements IPerformanceCollector {
  private observer: PerformanceObserver | null = null;
  private collectedMetrics: PerformanceMetric[] = [];
  private metricHandlers: ((metric: PerformanceMetric) => void)[] = [];

  /**
   * Starts observing performance entries for resource timing.
   */
  start(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported. Network performance will not be collected.');
      return;
    }

    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.entryType === 'resource') {
          const resourceTiming = entry as PerformanceResourceTiming;
          const metric: PerformanceMetric = {
            type: PerformanceMetricType.NetworkPerformance,
            name: resourceTiming.name, // URL of the resource
            value: resourceTiming.duration, // Total time to fetch resource
            unit: 'ms',
            timestamp: resourceTiming.startTime + performance.timeOrigin,
            metadata: {
              initiatorType: resourceTiming.initiatorType,
              transferSize: resourceTiming.transferSize, // size of the resource actually transferred
              encodedBodySize: resourceTiming.encodedBodySize, // size of the resource's body after encoding
              decodedBodySize: resourceTiming.decodedBodySize, // size of the resource's body after decoding
              // Detailed timing properties
              connectTime: resourceTiming.connectEnd - resourceTiming.connectStart,
              dnsTime: resourceTiming.domainLookupEnd - resourceTiming.domainLookupStart,
              requestTime: resourceTiming.responseStart - resourceTiming.requestStart,
              responseTime: resourceTiming.responseEnd - resourceTiming.responseStart,
              fetchTime: resourceTiming.responseEnd - resourceTiming.fetchStart,
            },
          };
          this.collectedMetrics.push(metric);
          this.emitMetric(metric);
        }
      });
    });

    this.observer.observe({ entryTypes: ['resource'] });
    console.log('NetworkPerformanceCollector started.');
  }

  /**
   * Stops observing performance entries.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('NetworkPerformanceCollector stopped.');
    }
  }

  /**
   * Returns the currently collected network performance metrics.
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