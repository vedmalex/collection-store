/**
 * Defines the types of performance metrics that can be collected.
 */
export enum PerformanceMetricType {
  OperationTiming = 'OPERATION_TIMING',
  MemoryUsage = 'MEMORY_USAGE',
  NetworkPerformance = 'NETWORK_PERFORMANCE',
  UserInteraction = 'USER_INTERACTION',
}

/**
 * Represents a single performance metric data point.
 */
export interface PerformanceMetric {
  type: PerformanceMetricType;
  name: string; // e.g., 'queryCollection', 'dataSync'
  value: number; // The measured value (e.g., ms for timing, bytes for memory)
  unit: string; // e.g., 'ms', 'bytes', 'events'
  timestamp: number; // Unix timestamp when the metric was recorded
  metadata?: Record<string, any>; // Additional context, e.g., collectionName, operationType
}

/**
 * Interface for a performance observer or collector.
 */
export interface IPerformanceCollector {
  start(): void;
  stop(): void;
  collect(): Promise<PerformanceMetric[]>;
  onMetric(handler: (metric: PerformanceMetric) => void): void;
  offMetric(handler: (metric: PerformanceMetric) => void): void;
}

/**
 * Configuration options for performance monitoring.
 */
export interface PerformanceMonitoringConfig {
  enabled: boolean;
  collectionIntervalMs: number; // How often to collect metrics
  uploadIntervalMs: number; // How often to upload collected metrics
  metricsToCollect: PerformanceMetricType[];
}

/**
 * Aggregated performance report.
 */
export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetric[];
  aggregationPeriodMs: number;
}