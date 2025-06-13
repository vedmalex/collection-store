/**
 * Defines a generic event interface.
 */
export interface BrowserEvent<T = any> {
  type: string; // The type of event (e.g., 'collection:updated', 'network:online')
  payload?: T; // The data associated with the event
  timestamp: number; // When the event occurred
}

/**
 * Defines a callback function for event listeners.
 */
export type EventListener<T = any> = (event: BrowserEvent<T>) => void;

/**
 * Defines metrics for event performance monitoring.
 */
export interface EventPerformanceMetrics {
  eventType: string;
  listenerCount: number;
  dispatchTime: number; // Time taken to dispatch the event to all listeners (ms)
  memoryUsage?: number; // Estimated memory usage by event listeners/queue
}