/**
 * Monitoring and metrics types for computed attributes system
 * Provides comprehensive performance tracking and health monitoring
 */

/**
 * Performance metrics for computed attributes
 */
export interface ComputedAttributeMetrics {
  // Computation metrics
  totalComputations: number
  successfulComputations: number
  failedComputations: number
  averageComputeTime: number
  medianComputeTime: number
  p95ComputeTime: number
  p99ComputeTime: number

  // Cache metrics
  cacheHitRate: number
  cacheMissRate: number
  cacheSize: number
  cacheMemoryUsage: number
  averageCacheRetrievalTime: number

  // Dependency metrics
  averageDependencyDepth: number
  circularDependencies: number
  dependencyResolutionTime: number

  // Error metrics
  errorRate: number
  timeoutRate: number
  recoveryRate: number

  // Resource usage
  memoryUsage: number
  cpuUsage: number
  networkRequests: number

  // Timing
  lastUpdated: Date
  measurementPeriod: number // seconds
}

/**
 * Real-time performance monitoring
 */
export interface PerformanceMonitor {
  // Current state
  activeComputations: number
  queuedComputations: number
  systemLoad: number // 0-1

  // Recent performance
  recentComputeTime: number[]
  recentErrorRate: number
  recentThroughput: number // computations per second

  // Alerts
  activeAlerts: PerformanceAlert[]
  alertHistory: PerformanceAlert[]

  // Health status
  healthScore: number // 0-100
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  lastHealthCheck: Date
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string
  type: AlertType
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string

  // Trigger information
  triggeredAt: Date
  triggeredBy: string // metric name
  threshold: number
  actualValue: number

  // Resolution
  resolved: boolean
  resolvedAt?: Date
  resolutionAction?: string

  // Context
  affectedAttributes?: string[]
  systemContext?: {
    memoryUsage: number
    cpuUsage: number
    activeComputations: number
  }
}

/**
 * Alert types
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_COMPUTE_TIME = 'high_compute_time',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  CACHE_PERFORMANCE_DEGRADED = 'cache_performance_degraded',
  CIRCULAR_DEPENDENCY_DETECTED = 'circular_dependency_detected',
  EXTERNAL_SERVICE_FAILURE = 'external_service_failure',
  SYSTEM_OVERLOAD = 'system_overload',
  SECURITY_VIOLATION = 'security_violation'
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  // Metrics collection
  enableMetrics: boolean
  metricsInterval: number // seconds
  metricsRetention: number // seconds

  // Performance monitoring
  enablePerformanceMonitoring: boolean
  performanceCheckInterval: number // seconds

  // Alerting
  enableAlerting: boolean
  alertThresholds: AlertThresholds
  alertCooldown: number // seconds

  // Health checks
  enableHealthChecks: boolean
  healthCheckInterval: number // seconds
  healthCheckTimeout: number // seconds

  // Detailed monitoring
  enableDetailedMetrics: boolean
  enableTracing: boolean
  tracingSampleRate: number // 0-1
}

/**
 * Alert thresholds configuration
 */
export interface AlertThresholds {
  errorRate: number // percentage
  computeTime: number // milliseconds
  memoryUsage: number // bytes
  cacheHitRate: number // percentage (minimum)
  systemLoad: number // 0-1
  queueSize: number // number of queued computations
  timeoutRate: number // percentage
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean
  score: number // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'

  // Component health
  components: {
    engine: ComponentHealth
    cache: ComponentHealth
    dependencies: ComponentHealth
    external: ComponentHealth
    database: ComponentHealth
  }

  // Issues and recommendations
  issues: HealthIssue[]
  recommendations: string[]

  // Metadata
  timestamp: Date
  checkDuration: number
  nodeId: string
}

/**
 * Component health status
 */
export interface ComponentHealth {
  healthy: boolean
  score: number // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  lastCheck: Date
  responseTime?: number
  errorRate?: number
  issues: string[]
}

/**
 * Health issue
 */
export interface HealthIssue {
  component: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  code: string
  detectedAt: Date
  recommendation?: string
}

/**
 * Tracing information for detailed monitoring
 */
export interface ComputationTrace {
  traceId: string
  attributeId: string
  targetId: string

  // Timing
  startTime: Date
  endTime?: Date
  duration?: number

  // Steps
  steps: TraceStep[]

  // Context
  context: {
    userId?: string
    sessionId?: string
    requestId?: string
    nodeId: string
  }

  // Result
  success: boolean
  result?: any
  error?: Error

  // Performance
  memoryUsage: number
  cpuTime: number
  networkCalls: number
}

/**
 * Individual trace step
 */
export interface TraceStep {
  name: string
  startTime: Date
  endTime?: Date
  duration?: number

  // Step details
  type: 'dependency_resolution' | 'computation' | 'cache_lookup' | 'cache_store' | 'validation' | 'external_call'
  details?: any

  // Result
  success: boolean
  error?: Error

  // Performance
  memoryDelta?: number
  cpuTime?: number
}

/**
 * Monitoring event
 */
export interface MonitoringEvent {
  type: 'metric_collected' | 'alert_triggered' | 'alert_resolved' | 'health_check' | 'trace_completed'
  timestamp: Date
  data: any

  // Context
  nodeId: string
  attributeId?: string
  targetId?: string

  // Metadata
  severity?: 'low' | 'medium' | 'high' | 'critical'
  tags?: Record<string, string>
}

/**
 * Monitoring interface
 */
export interface IMonitoringService {
  /**
   * Start monitoring
   */
  start(): Promise<void>

  /**
   * Stop monitoring
   */
  stop(): Promise<void>

  /**
   * Get current metrics
   */
  getMetrics(): Promise<ComputedAttributeMetrics>

  /**
   * Get performance monitor
   */
  getPerformanceMonitor(): Promise<PerformanceMonitor>

  /**
   * Perform health check
   */
  performHealthCheck(): Promise<HealthCheckResult>

  /**
   * Get active alerts
   */
  getActiveAlerts(): Promise<PerformanceAlert[]>

  /**
   * Start tracing for a computation
   */
  startTrace(attributeId: string, targetId: string): ComputationTrace

  /**
   * End tracing for a computation
   */
  endTrace(traceId: string, result?: any, error?: Error): void

  /**
   * Subscribe to monitoring events
   */
  onEvent(handler: (event: MonitoringEvent) => void): void

  /**
   * Configure monitoring
   */
  configure(config: Partial<MonitoringConfig>): Promise<void>
}

/**
 * Metrics aggregation
 */
export interface MetricsAggregation {
  period: 'minute' | 'hour' | 'day' | 'week' | 'month'
  startTime: Date
  endTime: Date

  // Aggregated metrics
  totalComputations: number
  averageComputeTime: number
  errorRate: number
  cacheHitRate: number

  // Trends
  computationTrend: 'increasing' | 'decreasing' | 'stable'
  performanceTrend: 'improving' | 'degrading' | 'stable'

  // Peak usage
  peakComputations: number
  peakComputeTime: number
  peakMemoryUsage: number

  // Breakdown by attribute
  attributeMetrics: Map<string, {
    computations: number
    averageTime: number
    errorRate: number
  }>
}

/**
 * Monitoring dashboard data
 */
export interface MonitoringDashboard {
  // Overview
  overview: {
    totalAttributes: number
    activeComputations: number
    systemHealth: number
    alertCount: number
  }

  // Real-time metrics
  realTimeMetrics: ComputedAttributeMetrics
  performanceMonitor: PerformanceMonitor

  // Historical data
  historicalMetrics: MetricsAggregation[]

  // Top performers and issues
  topPerformingAttributes: Array<{
    attributeId: string
    averageTime: number
    successRate: number
  }>

  problematicAttributes: Array<{
    attributeId: string
    errorRate: number
    averageTime: number
    issues: string[]
  }>

  // System status
  systemStatus: {
    uptime: number
    version: string
    nodeId: string
    lastRestart: Date
  }
}