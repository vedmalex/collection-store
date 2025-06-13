// src/browser-sdk/performance/UserInteractionCollector.ts

import { IPerformanceCollector, PerformanceMetric, PerformanceMetricType } from './types';

/**
 * Collects user interaction metrics (e.g., clicks, key presses) using event listeners.
 */
export class UserInteractionCollector implements IPerformanceCollector {
  private collectedMetrics: PerformanceMetric[] = [];
  private metricHandlers: ((metric: PerformanceMetric) => void)[] = [];

  /**
   * Starts observing user interaction events.
   */
  start(): void {
    // Listen for common interaction events on the document body
    document.body.addEventListener('click', this.handleEvent as EventListener);
    document.body.addEventListener('keydown', this.handleEvent as EventListener);
    // Add more event types as needed, e.g., 'mousedown', 'touchstart', 'scroll'

    console.log('UserInteractionCollector started.');
  }

  /**
   * Stops observing user interaction events.
   */
  stop(): void {
    document.body.removeEventListener('click', this.handleEvent as EventListener);
    document.body.removeEventListener('keydown', this.handleEvent as EventListener);
    console.log('UserInteractionCollector stopped.');
  }

  /**
   * Returns the currently collected user interaction metrics.
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

  private handleEvent = (event: Event): void => {
    const metric: PerformanceMetric = {
      type: PerformanceMetricType.UserInteraction,
      name: event.type,
      value: 1, // Each interaction counts as one event
      unit: 'events',
      timestamp: Date.now(),
      metadata: {
        targetId: (event.target as HTMLElement)?.id || 'n/a',
        targetClass: (event.target as HTMLElement)?.className || 'n/a',
        // Add more event-specific metadata if needed
      },
    };
    this.collectedMetrics.push(metric);
    this.emitMetric(metric);
  };

  private emitMetric(metric: PerformanceMetric): void {
    this.metricHandlers.forEach(handler => handler(metric));
  }
}