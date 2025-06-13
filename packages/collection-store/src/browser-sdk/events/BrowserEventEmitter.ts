// src/browser-sdk/events/BrowserEventEmitter.ts

import { BrowserEvent, EventListener, EventPerformanceMetrics } from './types';

/**
 * A browser-optimized event emitter for managing custom events and their listeners.
 * Includes basic performance monitoring for event dispatching.
 */
export class BrowserEventEmitter {
  private listeners: Map<string, Set<EventListener>>; // eventType -> Set<EventListener>
  private performanceMetrics: Map<string, EventPerformanceMetrics>; // eventType -> metrics

  constructor() {
    this.listeners = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Registers an event listener for a specific event type.
   * @param eventType The type of event to listen for.
   * @param listener The callback function to execute when the event is dispatched.
   */
  on<T = any>(eventType: string, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  /**
   * Removes an event listener for a specific event type.
   * @param eventType The type of event to remove the listener from.
   * @param listener The callback function to remove.
   */
  off<T = any>(eventType: string, listener: EventListener<T>): void {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.delete(listener);
      if (this.listeners.get(eventType)!.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Dispatches an event to all registered listeners for that event type.
   * Includes performance measurement for dispatch time.
   * @param event The event object to dispatch.
   */
  emit<T = any>(event: BrowserEvent<T>): void {
    const startTime = performance.now();
    const listeners = this.listeners.get(event.type);

    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error(`Error in event listener for ${event.type}:`, e);
        }
      });
    }

    const dispatchTime = performance.now() - startTime;
    const listenerCount = listeners ? listeners.size : 0;
    this.updatePerformanceMetrics(event.type, listenerCount, dispatchTime);
  }

  /**
   * Dispatches an event once, and then removes the listener.
   * @param eventType The type of event to listen for.
   * @param listener The callback function to execute when the event is dispatched.
   */
  once<T = any>(eventType: string, listener: EventListener<T>): void {
    const onceListener: EventListener<T> = (event) => {
      this.off(eventType, onceListener);
      listener(event);
    };
    this.on(eventType, onceListener);
  }

  private updatePerformanceMetrics(eventType: string, listenerCount: number, dispatchTime: number): void {
    const currentMetrics = this.performanceMetrics.get(eventType) || {
      eventType,
      listenerCount: 0,
      dispatchTime: 0,
      memoryUsage: 0
    };

    // Simple average for demonstration. A more robust implementation would use a moving average or histogram.
    currentMetrics.listenerCount = listenerCount;
    currentMetrics.dispatchTime = (currentMetrics.dispatchTime + dispatchTime) / 2; // Simple average

    // Basic memory usage estimation (conceptual, not accurate for real memory)
    // This would require a more sophisticated mechanism or browser APIs if available.
    currentMetrics.memoryUsage = (this.listeners.size * 50) + (listenerCount * 10); // Dummy estimation

    this.performanceMetrics.set(eventType, currentMetrics);
  }

  /**
   * Retrieves performance metrics for a specific event type.
   * @param eventType The type of event to retrieve metrics for.
   * @returns EventPerformanceMetrics for the event type, or null if not found.
   */
  getPerformanceMetrics(eventType: string): EventPerformanceMetrics | null {
    return this.performanceMetrics.get(eventType) || null;
  }

  /**
   * Resets performance metrics for a specific event type, or all metrics if no type is provided.
   * @param eventType Optional. The type of event to reset metrics for.
   */
  resetPerformanceMetrics(eventType?: string): void {
    if (eventType) {
      this.performanceMetrics.delete(eventType);
    } else {
      this.performanceMetrics.clear();
    }
  }
}