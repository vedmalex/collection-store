/**
 * Core interfaces for Performance Testing & Load Testing Framework
 * Phase 6: Performance Testing & Optimization
 */

// ============================================================================
// CORE LOAD TESTING INTERFACES
// ============================================================================

export interface ILoadTestManager {
  // Test scenario management
  createTestScenario(scenario: LoadTestScenario): Promise<string>
  runTestScenario(scenarioId: string): Promise<TestResults>
  stopTestScenario(scenarioId: string): Promise<void>

  // Real-time monitoring
  monitorPerformance(testId: string): Promise<PerformanceMetrics>
  getTestStatus(testId: string): Promise<TestStatus>

  // Results & reporting
  getTestResults(testId: string): Promise<TestResults>
  generateReport(testId: string): Promise<TestReport>
}

export interface LoadTestScenario {
  id: string
  name: string
  description: string

  // Load configuration
  virtualUsers: number
  rampUpTime: number // seconds
  testDuration: number // seconds

  // Test operations
  operations: TestOperation[]

  // Success criteria
  successCriteria: SuccessCriteria
}

export interface TestOperation {
  type: 'auth' | 'query' | 'subscription' | 'file_upload' | 'real_time' | 'computed_attributes' | 'stored_functions'
  weight: number // percentage of operations
  config: OperationConfig
  expectedResponseTime: number // ms
}

export interface OperationConfig {
  operation: string
  [key: string]: any // flexible configuration
}

export interface SuccessCriteria {
  maxResponseTime: number // ms (95th percentile)
  minThroughput: number // ops/sec
  maxErrorRate: number // percentage
  maxMemoryUsage: number // bytes
  maxCpuUsage: number // percentage
}

// ============================================================================
// TEST RESULTS & METRICS
// ============================================================================

export interface TestResults {
  scenarioId: string
  testId: string
  startTime: Date
  endTime: Date
  duration: number // ms

  // Performance metrics
  metrics: PerformanceMetrics

  // Success evaluation
  success: boolean
  failureReasons: string[]

  // Detailed results
  operationResults: OperationResult[]
}

export interface PerformanceMetrics {
  timestamp: Date

  // Response time metrics
  responseTime: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }

  // Throughput metrics
  throughput: {
    totalOperations: number
    operationsPerSecond: number
    successfulOperations: number
    failedOperations: number
  }

  // Error metrics
  errors: {
    totalErrors: number
    errorRate: number // percentage
    errorTypes: Record<string, number>
  }

  // System metrics
  system: {
    cpuUsage: number // percentage
    memoryUsage: number // bytes
    networkBandwidth: number // bytes/sec
    diskIO: number // ops/sec
  }
}

export interface OperationResult {
  operationType: string
  startTime: number // performance.now()
  endTime: number // performance.now()
  duration: number // ms
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

// ============================================================================
// TEST STATUS & MONITORING
// ============================================================================

export interface TestStatus {
  testId: string
  scenarioId: string
  status: 'preparing' | 'running' | 'completed' | 'failed' | 'stopped'
  progress: {
    currentUsers: number
    targetUsers: number
    elapsedTime: number // ms
    remainingTime: number // ms
    completedOperations: number
  }
  currentMetrics: PerformanceMetrics
}

export interface TestReport {
  testId: string
  scenarioId: string
  summary: TestSummary
  detailedMetrics: PerformanceMetrics[]
  recommendations: string[]
  charts: ChartData[]
}

export interface TestSummary {
  totalDuration: number // ms
  totalOperations: number
  successRate: number // percentage
  averageResponseTime: number // ms
  peakThroughput: number // ops/sec
  resourceUtilization: {
    peakCpuUsage: number
    peakMemoryUsage: number
    averageNetworkUsage: number
  }
}

export interface ChartData {
  type: 'line' | 'bar' | 'histogram'
  title: string
  data: Array<{
    timestamp: number
    value: number
    label?: string
  }>
}

// ============================================================================
// METRICS COLLECTION INTERFACES
// ============================================================================

export interface IMetricsCollector {
  // Metrics collection
  startCollection(testId: string): Promise<void>
  stopCollection(testId: string): Promise<void>
  collectMetrics(): Promise<PerformanceMetrics>

  // Real-time monitoring
  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): void

  // Historical data
  getHistoricalMetrics(testId: string, timeRange: TimeRange): Promise<PerformanceMetrics[]>
}

export interface TimeRange {
  start: Date
  end: Date
}

// ============================================================================
// TEST EXECUTION INTERFACES
// ============================================================================

export interface ITestExecutor {
  // Test execution
  executeTest(scenario: LoadTestScenario): Promise<TestResults>

  // Virtual user management
  createVirtualUsers(count: number): Promise<VirtualUser[]>
  destroyVirtualUsers(users: VirtualUser[]): Promise<void>

  // Operation execution
  executeOperation(operation: TestOperation, user: VirtualUser): Promise<OperationResult>
}

export interface VirtualUser {
  id: string
  sessionData: Record<string, any>
  authToken?: string
  isActive: boolean
}

// ============================================================================
// SCENARIO BUILDER INTERFACES
// ============================================================================

export interface ITestScenarioBuilder {
  // Scenario creation
  createScenario(name: string): TestScenarioBuilder

  // Pre-built scenarios
  getAuthenticationScenario(config: AuthScenarioConfig): LoadTestScenario
  getDatabaseScenario(config: DatabaseScenarioConfig): LoadTestScenario
  getRealtimeScenario(config: RealtimeScenarioConfig): LoadTestScenario
}

export interface TestScenarioBuilder {
  setUsers(count: number): TestScenarioBuilder
  setDuration(seconds: number): TestScenarioBuilder
  setRampUp(seconds: number): TestScenarioBuilder
  addOperation(operation: TestOperation): TestScenarioBuilder
  setSuccessCriteria(criteria: SuccessCriteria): TestScenarioBuilder
  build(): LoadTestScenario
}

export interface AuthScenarioConfig {
  userCount: number
  loginWeight: number
  validateWeight: number
  refreshWeight: number
  logoutWeight: number
}

export interface DatabaseScenarioConfig {
  userCount: number
  readWeight: number
  writeWeight: number
  updateWeight: number
  aggregateWeight: number
  collections: string[]
}

export interface RealtimeScenarioConfig {
  userCount: number
  sseWeight: number
  crossTabWeight: number
  notificationWeight: number
  subscriptionTypes: string[]
}

// ============================================================================
// RESOURCE MONITORING INTERFACES
// ============================================================================

export interface IResourceTracker {
  // Resource monitoring
  startTracking(): Promise<void>
  stopTracking(): Promise<void>
  getCurrentUsage(): Promise<ResourceUsage>

  // Alerts
  setThresholds(thresholds: ResourceThresholds): void
  onThresholdExceeded(callback: (alert: ResourceAlert) => void): void
}

export interface ResourceUsage {
  timestamp: Date
  cpu: {
    usage: number // percentage
    cores: number
    loadAverage: number[]
  }
  memory: {
    used: number // bytes
    total: number // bytes
    usage: number // percentage
    heap: {
      used: number
      total: number
    }
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  disk: {
    readOps: number
    writeOps: number
    readBytes: number
    writeBytes: number
  }
}

export interface ResourceThresholds {
  cpuUsage: number // percentage
  memoryUsage: number // percentage
  networkBandwidth: number // bytes/sec
  diskIO: number // ops/sec
}

export interface ResourceAlert {
  type: 'cpu' | 'memory' | 'network' | 'disk'
  threshold: number
  currentValue: number
  timestamp: Date
  severity: 'warning' | 'critical'
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type TestPhase = 'preparation' | 'ramp_up' | 'steady_state' | 'ramp_down' | 'cleanup'

export interface TestConfiguration {
  // Global settings
  maxConcurrentTests: number
  defaultTimeout: number // ms
  metricsCollectionInterval: number // ms

  // Resource limits
  maxMemoryUsage: number // bytes
  maxCpuUsage: number // percentage

  // Storage settings
  metricsRetention: number // days
  resultStorage: 'memory' | 'file' | 'database'
}

export interface LoadTestError extends Error {
  code: string
  testId?: string
  scenarioId?: string
  timestamp: Date
  context?: Record<string, any>
}

// ============================================================================
// METRICS COLLECTOR INTERFACES
// ============================================================================

export interface AlertThreshold {
  type: string
  value: number
  operator: '>' | '>=' | '<' | '<=' | '==' | '!='
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export interface MetricsSnapshot {
  timestamp: Date
  system: SystemMetrics
  application: ApplicationMetrics
  network: NetworkMetrics
  disk: DiskMetrics
}

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  networkBandwidth: number
  diskIO: number
}

export interface ApplicationMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  eventLoopDelay: number
  activeHandles: number
  activeRequests: number
}

export interface NetworkMetrics {
  bytesReceived: number
  bytesSent: number
  packetsReceived: number
  packetsSent: number
  connectionsActive: number
  connectionsTotal: number
  receiveRate?: number
  sendRate?: number
}

export interface DiskMetrics {
  readBytes: number
  writeBytes: number
  readOperations: number
  writeOperations: number
  freeSpace: number
  totalSpace: number
  usage: number
  readRate?: number
  writeRate?: number
}

// ============================================================================
// INTEGRATION INTERFACES
// ============================================================================

export interface BaselineMetrics {
  timestamp: number
  authentication: {
    loginTime: number // ms
    tokenValidationTime: number // ms
    refreshTokenTime: number // ms
    throughput: number // ops/sec
  }
  database: {
    simpleQueryTime: number // ms
    complexQueryTime: number // ms
    insertTime: number // ms
    updateTime: number // ms
    aggregationTime: number // ms
    throughput: number // ops/sec
  }
  realtime: {
    sseConnectionTime: number // ms
    notificationLatency: number // ms
    crossTabSyncTime: number // ms
    concurrentConnections: number
  }
  fileStorage: {
    uploadTime: number // ms
    downloadTime: number // ms
    deleteTime: number // ms
    throughputMBps: number // MB/s
  }
  computedAttributes: {
    computationTime: number // ms
    cacheHitRatio: number // 0-1
    invalidationTime: number // ms
  }
  storedFunctions: {
    executionTime: number // ms
    compilationTime: number // ms
    throughput: number // ops/sec
  }
  system: {
    cpuUsage: number // percentage
    memoryUsage: number // bytes
    diskUsage: number // percentage
    networkLatency: number // ms
  }
}

export interface IntegrationConfig {
  enableMetricsCollection?: boolean
  baselineTestDuration?: number // seconds
  baselineVirtualUsers?: number
  resultStoragePath?: string
  enableDetailedLogging?: boolean
  // Test optimization flags
  testMode?: boolean // Enable test-optimized behavior
  fastBaseline?: boolean // Use fast baseline measurement
  mockScenarios?: boolean // Use mock scenario execution
  parallelBaseline?: boolean // Run baseline measurements in parallel
}

export interface ComparisonReport {
  timestamp: number
  baselineTimestamp: number
  comparisons: Array<{
    scenarioName: string
    metric: string
    baselineValue: number
    currentValue: number
    change: number // percentage
    status: 'improved' | 'degraded' | 'stable'
    significance: 'significant' | 'minor'
  }>
  summary: {
    totalScenarios: number
    improved: number
    degraded: number
    stable: number
    overallStatus: 'improved' | 'degraded' | 'stable'
  }
}

// ============================================================================
// PERFORMANCE PROFILING INTERFACES
// ============================================================================

export interface ProfilerConfig {
  enableCPUProfiling?: boolean
  enableMemoryProfiling?: boolean
  enableNetworkProfiling?: boolean
  enableDatabaseProfiling?: boolean
  samplingInterval?: number // ms
  maxProfileDuration?: number // ms
  retainProfiles?: number // ms
  enableDetailedLogging?: boolean
}

export interface ProfilerSession {
  id: string
  startTime: Date
  endTime: Date | null
  components: string[]
  profiles: ComponentProfile[]
  status: 'active' | 'completed' | 'failed'
}

export interface ComponentProfile {
  sessionId: string
  component: string
  type: 'cpu' | 'memory' | 'database' | 'network' | 'performance'
  timestamp: Date
  data: any // Component-specific data
}

export interface BottleneckReport {
  sessionId: string
  timestamp: Date
  duration: number // ms
  components: string[]
  bottlenecks: Bottleneck[]
  recommendations: string[]
  summary: {
    criticalIssues: number
    warningIssues: number
    optimizationOpportunities: number
    overallScore: number // 0-100
  }
}

export interface Bottleneck {
  component: string
  issue: string
  severity: 'critical' | 'warning' | 'info'
  metric: string
  value: number
  threshold: number
  impact: string
  recommendation: string
}

export interface HotspotAnalysis {
  timestamp: Date
  sessionId: string
  hotspots: CPUHotspot[]
  recommendations: string[]
}

export interface CPUHotspot {
  component: string
  function: string
  usage: number // percentage
  duration: number // ms
  impact: number
  recommendation: string
}

// ============================================================================
// OPTIMIZATION INTERFACES
// ============================================================================

export interface OptimizationConfig {
  enableAuthOptimization?: boolean
  enableDatabaseOptimization?: boolean
  enableRealtimeOptimization?: boolean
  enableFileOptimization?: boolean
  enableSystemOptimization?: boolean
}

export interface AuthOptimizations {
  tokenCache: {
    enabled: boolean
    ttl: number // seconds
    maxSize: number
    strategy: 'lru' | 'lfu' | 'fifo'
  }
  connectionPool: {
    enabled: boolean
    maxConnections: number
    idleTimeout: number // ms
  }
  batchValidation: {
    enabled: boolean
    batchSize: number
    flushInterval: number // ms
  }
}

export interface DatabaseOptimizations {
  indexes: {
    autoCreateIndexes: boolean
    analyzeQueryPatterns: boolean
    suggestOptimalIndexes: boolean
  }
  queryCache: {
    enabled: boolean
    ttl: number // seconds
    maxMemory: number // bytes
  }
  connections: {
    poolSize: number
    maxIdleTime: number // ms
    connectionTimeout: number // ms
  }
}

export interface RealtimeOptimizations {
  messageCompression: {
    enabled: boolean
    algorithm: 'gzip' | 'brotli' | 'lz4'
    threshold: number // bytes
  }
  connectionPooling: {
    enabled: boolean
    maxConnections: number
    keepAlive: boolean
  }
  messageQueuing: {
    enabled: boolean
    maxQueueSize: number
    batchSize: number
  }
}

export interface FileOptimizations {
  compression: {
    enabled: boolean
    algorithm: 'gzip' | 'brotli'
    quality: number // 1-11
  }
  caching: {
    enabled: boolean
    maxSize: number // bytes
    ttl: number // seconds
  }
  parallelProcessing: {
    enabled: boolean
    maxConcurrency: number
    chunkSize: number // bytes
  }
}

export interface SystemOptimizations {
  memoryManagement: {
    enableGC: boolean
    gcInterval: number // ms
    maxHeapSize: number // bytes
  }
  cpuOptimization: {
    enableWorkerThreads: boolean
    maxWorkers: number
    taskQueue: boolean
  }
  networkOptimization: {
    enableKeepAlive: boolean
    maxSockets: number
    timeout: number // ms
  }
}

// ============================================================================
// PERFORMANCE TARGETS
// ============================================================================

export interface PerformanceTargets {
  authentication: {
    responseTime: string
    throughput: string
    errorRate: string
  }
  database: {
    queryTime: string
    throughput: string
    memoryUsage: string
  }
  realtime: {
    latency: string
    connections: string
    crossTabSync: string
  }
  files: {
    uploadThroughput: string
    downloadThroughput: string
    thumbnailGeneration: string
  }
  system: {
    cpuUsage: string
    memoryUsage: string
    networkLatency: string
  }
}

// ============================================================================
// NETWORK PROFILING INTERFACES
// ============================================================================

export interface NetworkOptimizations {
  connectionOptimization: {
    enableKeepAlive: boolean
    maxSockets: number
    timeout: number // ms
  }
  compressionOptimization: {
    enableCompression: boolean
    algorithm: 'gzip' | 'brotli' | 'deflate'
    threshold: number // bytes
  }
  cachingOptimization: {
    enableCaching: boolean
    maxAge: number // seconds
    cacheSize: number // bytes
  }
  protocolOptimization: {
    preferHTTP2: boolean
    enableMultiplexing: boolean
    maxConcurrentStreams: number
  }
}

// ============================================================================
// REALTIME SUBSCRIPTION PROFILING INTERFACES
// ============================================================================

export interface RealtimeOptimizations {
  connectionOptimization: {
    enableConnectionPooling: boolean
    maxConnectionsPerPool: number
    connectionTimeout: number
    enableHeartbeat: boolean
    heartbeatInterval: number
  }
  messageOptimization: {
    enableMessageBatching: boolean
    batchSize: number
    batchTimeout: number
    enableCompression: boolean
    compressionThreshold: number
  }
  subscriptionOptimization: {
    enableSubscriptionCaching: boolean
    cacheSize: number
    enableLazyLoading: boolean
    maxSubscriptionsPerConnection: number
  }
  syncOptimization: {
    enableOptimisticSync: boolean
    conflictResolutionStrategy: 'last-write-wins' | 'operational-transform' | 'merge'
    syncBatchSize: number
    maxSyncLatency: number
  }
}

// ============================================================================
// COMPUTED ATTRIBUTES PROFILING INTERFACES
// ============================================================================

export interface ComputedAttributesOptimizations {
  cacheOptimization: {
    enableCaching: boolean
    cacheSize: number
    cacheExpiry: number
    enableInvalidation: boolean
  }
  computationOptimization: {
    enableParallelComputation: boolean
    maxConcurrentComputations: number
    enableMemoization: boolean
    memoizationSize: number
  }
  dependencyOptimization: {
    enableDependencyTracking: boolean
    maxDependencyDepth: number
    enableCircularDependencyDetection: boolean
  }
  updateOptimization: {
    enableBatchUpdates: boolean
    batchSize: number
    batchTimeout: number
    enableIncrementalUpdates: boolean
  }
}

// ============================================================================
// STORED FUNCTIONS PROFILING INTERFACES
// ============================================================================

export interface StoredFunctionsOptimizations {
  executionOptimization: {
    enableParallelExecution: boolean
    maxConcurrentExecutions: number
    executionTimeout: number
    enableRetry: boolean
    maxRetries: number
  }
  cacheOptimization: {
    enableResultCaching: boolean
    cacheSize: number
    cacheExpiry: number
    enableParameterHashing: boolean
  }
  resourceOptimization: {
    enableResourcePooling: boolean
    poolSize: number
    enableMemoryLimit: boolean
    memoryLimit: number
  }
  compilationOptimization: {
    enablePrecompilation: boolean
    enableCodeOptimization: boolean
    enableJIT: boolean
    optimizationLevel: number
  }
}

// ============================================================================
// DAY 9: CROSS-COMPONENT CORRELATION & PREDICTIVE ANALYSIS INTERFACES
// ============================================================================

export interface CrossComponentOptimizations {
  correlationOptimization: {
    enableCorrelationAnalysis: boolean
    correlationThreshold: number
    analysisWindow: number // minutes
    enableCascadeDetection: boolean
  }
  isolationOptimization: {
    enableComponentIsolation: boolean
    isolationLevel: 'none' | 'partial' | 'full'
    enableCircuitBreakers: boolean
    circuitBreakerThreshold: number
  }
  cachingOptimization: {
    enableCrossComponentCaching: boolean
    cacheSize: number
    cacheExpiry: number
    enableInvalidationChain: boolean
  }
  loadBalancingOptimization: {
    enableAdaptiveLoadBalancing: boolean
    correlationBasedRouting: boolean
    maxCorrelationImpact: number
  }
}

export interface PredictiveOptimizations {
  trendOptimization: {
    enableTrendAnalysis: boolean
    predictionHorizon: number // days
    confidenceThreshold: number
    enableSeasonalAnalysis: boolean
  }
  bottleneckOptimization: {
    enableBottleneckPrediction: boolean
    predictionAccuracy: number
    preventiveScaling: boolean
    scalingLeadTime: number // hours
  }
  anomalyOptimization: {
    enableAnomalyDetection: boolean
    anomalyThreshold: number // standard deviations
    enableAutoResponse: boolean
    responseDelay: number // ms
  }
  capacityOptimization: {
    enableCapacityPlanning: boolean
    planningHorizon: number // days
    growthRateThreshold: number
    enableAutoProvisioning: boolean
  }
}

export interface CorrelationAnalysisConfig {
  analysisWindow: number // minutes
  correlationThreshold: number
  significanceLevel: number
  samplingInterval: number // milliseconds
  enableCascadeAnalysis: boolean
  enableCriticalPathAnalysis: boolean
  enableResourceDependencyAnalysis: boolean
  detailedLogging: boolean
}

export interface PredictiveAnalysisConfig {
  predictionHorizon: number // days
  confidenceThreshold: number
  anomalyThreshold: number // standard deviations
  seasonalityWindow: number // days
  minDataPoints: number
  enableTrendAnalysis: boolean
  enableBottleneckPrediction: boolean
  enableSeasonalAnalysis: boolean
  enableAnomalyDetection: boolean
  detailedLogging: boolean
}

// ============================================================================
// AUTOMATED OPTIMIZATION ENGINE INTERFACES
// ============================================================================

export interface IAutomatedOptimizationEngine {
  // Engine lifecycle
  startEngine(config: OptimizationEngineConfig): Promise<void>
  stopEngine(): Promise<void>

  // Optimization execution
  executeOptimizations(recommendations: OptimizationRecommendations): Promise<OptimizationResult[]>
  scheduleOptimization(optimization: ScheduledOptimization): Promise<string>
  cancelOptimization(optimizationId: string): Promise<boolean>

  // Validation and rollback
  validateOptimization(optimizationId: string): Promise<ValidationResult>
  rollbackOptimization(optimizationId: string): Promise<RollbackResult>

  // Monitoring and reporting
  getOptimizationStatus(): OptimizationEngineStatus
  getOptimizationHistory(): OptimizationHistoryEntry[]
  generateOptimizationReport(): OptimizationEngineReport
}

export interface IRealTimeOptimizer {
  // Real-time monitoring
  startRealTimeOptimization(config: RealTimeConfig): Promise<void>
  stopRealTimeOptimization(): Promise<void>

  // Dynamic optimization
  applyDynamicOptimization(metrics: PerformanceMetrics): Promise<OptimizationAction[]>
  adjustConfiguration(component: string, config: ComponentConfig): Promise<boolean>

  // Threshold management
  updateThresholds(thresholds: PerformanceThresholds): Promise<void>
  getActiveThresholds(): PerformanceThresholds

  // Emergency response
  handlePerformanceEmergency(emergency: PerformanceEmergency): Promise<EmergencyResponse>
}

export interface IOptimizationValidator {
  // Pre-optimization validation
  validateOptimizationSafety(optimization: OptimizationPlan): Promise<SafetyValidation>
  checkResourceAvailability(optimization: OptimizationPlan): Promise<ResourceCheck>

  // Post-optimization validation
  validateOptimizationEffectiveness(optimizationId: string): Promise<EffectivenessValidation>
  measurePerformanceImpact(optimizationId: string): Promise<PerformanceImpact>

  // Rollback validation
  validateRollbackSafety(optimizationId: string): Promise<RollbackSafety>
  executeRollback(optimizationId: string): Promise<RollbackExecution>
}

// ============================================================================
// OPTIMIZATION ENGINE CONFIGURATION
// ============================================================================

export interface OptimizationEngineConfig {
  enableAutomatedOptimization: boolean
  optimizationSchedule: OptimizationSchedule
  safetyThresholds: SafetyThresholds
  rollbackPolicy: RollbackPolicy
  resourceLimits: ResourceLimits
  auditTrail: AuditTrailConfig
  emergencyResponse: EmergencyResponseConfig
}

export interface OptimizationSchedule {
  enableScheduling: boolean
  preferredTimeWindows: TimeWindow[]
  avoidPeakHours: boolean
  maxConcurrentOptimizations: number
  optimizationInterval: number // minutes
  emergencyOptimizationDelay: number // seconds
}

export interface TimeWindow {
  startHour: number // 0-23
  endHour: number // 0-23
  daysOfWeek: number[] // 0-6 (Sunday-Saturday)
  timezone: string
}

export interface SafetyThresholds {
  maxCpuUsage: number // percentage
  maxMemoryUsage: number // percentage
  maxNetworkUsage: number // percentage
  maxDiskUsage: number // percentage
  minAvailableConnections: number
  maxErrorRate: number // percentage
}

export interface RollbackPolicy {
  enableAutoRollback: boolean
  rollbackTriggers: RollbackTrigger[]
  rollbackTimeout: number // seconds
  maxRollbackAttempts: number
  preserveRollbackHistory: boolean
}

export interface RollbackTrigger {
  metric: string
  threshold: number
  operator: '>' | '>=' | '<' | '<=' | '==' | '!='
  duration: number // seconds
  severity: 'warning' | 'critical'
}

export interface ResourceLimits {
  maxCpuUsageForOptimization: number // percentage
  maxMemoryUsageForOptimization: number // percentage
  maxOptimizationDuration: number // seconds
  maxConcurrentValidations: number
  reservedResourcePercentage: number
}

export interface AuditTrailConfig {
  enableAuditTrail: boolean
  logLevel: 'minimal' | 'standard' | 'detailed' | 'verbose'
  retentionPeriod: number // days
  enableMetricsLogging: boolean
  enableConfigurationLogging: boolean
}

export interface EmergencyResponseConfig {
  enableEmergencyResponse: boolean
  emergencyThresholds: EmergencyThreshold[]
  responseActions: EmergencyAction[]
  escalationPolicy: EscalationPolicy
  notificationConfig: NotificationConfig
}

// ============================================================================
// OPTIMIZATION EXECUTION INTERFACES
// ============================================================================

export interface OptimizationRecommendations {
  immediate: OptimizationRecommendation[]
  preventive: OptimizationRecommendation[]
  strategic: OptimizationRecommendation[]
  correlationBased: OptimizationRecommendation[]
  predictiveBased: OptimizationRecommendation[]
}

export interface OptimizationRecommendation {
  id: string
  type: OptimizationType
  component: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  expectedImpact: ExpectedImpact
  implementation: ImplementationPlan
  risks: Risk[]
  dependencies: string[]
}

export interface OptimizationType {
  category: 'performance' | 'resource' | 'configuration' | 'scaling' | 'caching'
  subcategory: string
  automated: boolean
  reversible: boolean
}

export interface ExpectedImpact {
  performanceImprovement: number // percentage
  resourceSavings: number // percentage
  reliabilityImprovement: number // percentage
  implementationEffort: 'low' | 'medium' | 'high'
  riskLevel: 'low' | 'medium' | 'high'
}

export interface ImplementationPlan {
  steps: ImplementationStep[]
  estimatedDuration: number // seconds
  requiredResources: RequiredResource[]
  rollbackPlan: RollbackPlan
}

export interface ImplementationStep {
  id: string
  description: string
  action: OptimizationAction
  validation: ValidationStep
  rollbackAction?: OptimizationAction
}

export interface RequiredResource {
  type: 'cpu' | 'memory' | 'network' | 'disk' | 'connections'
  amount: number
  duration: number // seconds
}

export interface RollbackPlan {
  steps: RollbackStep[]
  estimatedDuration: number // seconds
  safetyChecks: SafetyCheck[]
}

export interface Risk {
  type: 'performance' | 'stability' | 'data' | 'availability'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  mitigation: string
  probability: number // 0-1
}

export interface OptimizationPlan {
  id: string
  recommendationId: string
  type: OptimizationType
  component: string
  implementation: ImplementationPlan
  expectedImpact: ExpectedImpact
  risks: Risk[]
  constraints: OptimizationConstraint[]
  scheduledAt?: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================================
// OPTIMIZATION RESULTS & TRACKING
// ============================================================================

export interface OptimizationResult {
  optimizationId: string
  recommendationId: string
  type: OptimizationType
  status: 'success' | 'failed' | 'rolled_back' | 'partial'
  performanceImpact: PerformanceImpact
  appliedAt: Date
  validatedAt?: Date
  rolledBackAt?: Date
  executionLog: ExecutionLogEntry[]
}

export interface PerformanceImpact {
  beforeMetrics: PerformanceMetrics
  afterMetrics: PerformanceMetrics
  improvement: ImprovementMetrics
  degradation?: DegradationMetrics
  overallScore: number // 0-100
}

export interface ImprovementMetrics {
  responseTimeImprovement: number // percentage
  throughputImprovement: number // percentage
  resourceEfficiencyImprovement: number // percentage
  errorRateReduction: number // percentage
}

export interface DegradationMetrics {
  responseTimeDegradation: number // percentage
  throughputDegradation: number // percentage
  resourceEfficiencyDegradation: number // percentage
  errorRateIncrease: number // percentage
}

export interface ExecutionLogEntry {
  timestamp: Date
  step: string
  status: 'started' | 'completed' | 'failed' | 'skipped'
  duration: number // ms
  details: string
  metrics?: PerformanceMetrics
  error?: string
}

export interface ScheduledOptimization {
  id: string
  recommendationId: string
  scheduledAt: Date
  priority: 'low' | 'medium' | 'high' | 'emergency'
  dependencies: string[]
  constraints: OptimizationConstraint[]
}

export interface OptimizationConstraint {
  type: 'time' | 'resource' | 'dependency' | 'safety'
  condition: string
  value: any
}

// ============================================================================
// REAL-TIME OPTIMIZATION INTERFACES
// ============================================================================

export interface RealTimeConfig {
  monitoringInterval: number // ms
  responseThreshold: number // ms
  emergencyThresholds: EmergencyThresholds
  enableDynamicAdjustment: boolean
  adjustmentSensitivity: number // 0-1
  cooldownPeriod: number // seconds
}

export interface EmergencyThresholds {
  criticalCpuUsage: number // percentage
  criticalMemoryUsage: number // percentage
  criticalErrorRate: number // percentage
  criticalResponseTime: number // ms
  criticalThroughputDrop: number // percentage
}

export interface OptimizationAction {
  type: 'configuration' | 'scaling' | 'caching' | 'routing' | 'throttling'
  component: string
  action: string
  parameters: Record<string, any>
  reversible: boolean
  impact: 'low' | 'medium' | 'high'
}

export interface ComponentConfig {
  [key: string]: any
}

export interface PerformanceThresholds {
  responseTime: ThresholdConfig
  throughput: ThresholdConfig
  errorRate: ThresholdConfig
  resourceUsage: ResourceThresholdConfig
}

export interface ThresholdConfig {
  warning: number
  critical: number
  unit: string
  direction: 'above' | 'below'
}

export interface ResourceThresholdConfig {
  cpu: ThresholdConfig
  memory: ThresholdConfig
  network: ThresholdConfig
  disk: ThresholdConfig
}

export interface PerformanceEmergency {
  type: 'cpu_spike' | 'memory_leak' | 'error_storm' | 'throughput_drop' | 'latency_spike'
  severity: 'warning' | 'critical' | 'emergency'
  component: string
  metrics: PerformanceMetrics
  timestamp: Date
  description: string
}

export interface EmergencyResponse {
  responseId: string
  emergencyType: string
  actions: OptimizationAction[]
  executedAt: Date
  effectiveness: number // 0-1
  duration: number // ms
}

// ============================================================================
// VALIDATION & SAFETY INTERFACES
// ============================================================================

export interface ValidationResult {
  optimizationId: string
  isValid: boolean
  validationScore: number // 0-100
  issues: ValidationIssue[]
  recommendations: string[]
  safetyChecks: SafetyCheckResult[]
}

export interface ValidationIssue {
  type: 'safety' | 'performance' | 'compatibility' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
}

export interface SafetyValidation {
  isSafe: boolean
  safetyScore: number // 0-100
  risks: Risk[]
  mitigations: string[]
  requiredApprovals: string[]
}

export interface ResourceCheck {
  hasResources: boolean
  availableResources: AvailableResource[]
  resourceGaps: ResourceGap[]
  estimatedWaitTime: number // seconds
}

export interface AvailableResource {
  type: string
  available: number
  total: number
  unit: string
}

export interface ResourceGap {
  type: string
  required: number
  available: number
  deficit: number
  unit: string
}

export interface EffectivenessValidation {
  isEffective: boolean
  effectivenessScore: number // 0-100
  actualImpact: PerformanceImpact
  expectedImpact: ExpectedImpact
  variance: number // percentage
}

export interface RollbackSafety {
  isSafeToRollback: boolean
  safetyScore: number // 0-100
  risks: Risk[]
  dependencies: string[]
  estimatedDuration: number // seconds
}

export interface RollbackResult {
  rollbackId: string
  optimizationId: string
  status: 'success' | 'failed' | 'partial'
  executedAt: Date
  duration: number // ms
  restoredMetrics: PerformanceMetrics
  issues: string[]
}

export interface RollbackExecution {
  rollbackId: string
  steps: RollbackStep[]
  status: 'in_progress' | 'completed' | 'failed'
  progress: number // 0-100
  estimatedCompletion: Date
}

export interface RollbackStep {
  id: string
  description: string
  action: OptimizationAction
  status: 'pending' | 'executing' | 'completed' | 'failed'
  duration: number // ms
  error?: string
}

export interface SafetyCheck {
  type: string
  description: string
  required: boolean
  automated: boolean
}

export interface SafetyCheckResult {
  checkType: string
  passed: boolean
  score: number // 0-100
  details: string
  recommendations: string[]
}

export interface ValidationStep {
  type: string
  description: string
  criteria: ValidationCriteria
  timeout: number // seconds
}

export interface ValidationCriteria {
  metric: string
  expectedValue: number
  tolerance: number // percentage
  operator: '>' | '>=' | '<' | '<=' | '==' | '!='
}

// ============================================================================
// ENGINE STATUS & REPORTING
// ============================================================================

export interface OptimizationEngineStatus {
  isRunning: boolean
  startedAt: Date
  uptime: number // seconds
  activeOptimizations: number
  scheduledOptimizations: number
  completedOptimizations: number
  failedOptimizations: number
  rolledBackOptimizations: number
  currentLoad: number // percentage
  resourceUsage: ResourceUsage
  lastOptimization?: Date
  nextScheduledOptimization?: Date
}

export interface OptimizationHistoryEntry {
  optimizationId: string
  recommendationId: string
  type: OptimizationType
  status: string
  startTime: Date
  endTime: Date
  duration: number // ms
  performanceImpact: PerformanceImpact
  rollbackInfo?: RollbackInfo
}

export interface RollbackInfo {
  rollbackId: string
  rollbackReason: string
  rollbackTime: Date
  rollbackDuration: number // ms
  rollbackSuccess: boolean
}

export interface OptimizationEngineReport {
  reportId: string
  generatedAt: Date
  period: ReportPeriod
  summary: OptimizationSummary
  performance: PerformanceAnalysis
  recommendations: RecommendationAnalysis
  trends: TrendAnalysis
  issues: IssueAnalysis
}

export interface ReportPeriod {
  start: Date
  end: Date
  duration: number // ms
}

export interface OptimizationSummary {
  totalOptimizations: number
  successfulOptimizations: number
  failedOptimizations: number
  rolledBackOptimizations: number
  averageExecutionTime: number // ms
  totalPerformanceImprovement: number // percentage
  totalResourceSavings: number // percentage
}

export interface PerformanceAnalysis {
  overallImprovement: number // percentage
  componentImprovements: ComponentImprovement[]
  regressions: PerformanceRegression[]
  stabilityMetrics: StabilityMetrics
}

export interface ComponentImprovement {
  component: string
  metric: string
  improvement: number // percentage
  confidence: number // 0-1
}

export interface PerformanceRegression {
  component: string
  metric: string
  degradation: number // percentage
  cause: string
  mitigation: string
}

export interface StabilityMetrics {
  errorRate: number // percentage
  uptime: number // percentage
  mtbf: number // seconds (mean time between failures)
  mttr: number // seconds (mean time to recovery)
}

export interface RecommendationAnalysis {
  totalRecommendations: number
  implementedRecommendations: number
  pendingRecommendations: number
  rejectedRecommendations: number
  averageImplementationTime: number // seconds
  successRate: number // percentage
}

export interface TrendAnalysis {
  performanceTrends: PerformanceTrend[]
  optimizationTrends: OptimizationTrend[]
  resourceTrends: ResourceTrend[]
  predictions: TrendPrediction[]
}

export interface PerformanceTrend {
  componentName: string
  metricName: string
  trendDirection: 'improving' | 'degrading' | 'stable' | 'volatile'
  trendStrength: number // 0-1
  projectedValue: number
  confidenceInterval: {
    lower: number
    upper: number
    confidence: number // 0-1
  }
  timeHorizon: number // days
  seasonalityDetected: boolean
  anomaliesDetected: number
}

export interface OptimizationTrend {
  metric: string
  trend: 'improving' | 'degrading' | 'stable'
  rate: number // per day
  confidence: number // 0-1
}

export interface ResourceTrend {
  resource: string
  usage: number // percentage
  trend: 'increasing' | 'decreasing' | 'stable'
  projectedExhaustion?: Date
}

export interface TrendPrediction {
  metric: string
  predictedValue: number
  confidence: number // 0-1
  timeHorizon: number // days
  factors: string[]
}

export interface IssueAnalysis {
  criticalIssues: Issue[]
  warningIssues: Issue[]
  resolvedIssues: Issue[]
  recurringIssues: Issue[]
}

export interface Issue {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  component: string
  firstOccurrence: Date
  lastOccurrence: Date
  frequency: number
  impact: string
  resolution?: string
}

// ============================================================================
// EMERGENCY RESPONSE INTERFACES
// ============================================================================

export interface EmergencyThreshold {
  metric: string
  value: number
  operator: '>' | '>=' | '<' | '<='
  duration: number // seconds
  severity: 'warning' | 'critical' | 'emergency'
}

export interface EmergencyAction {
  type: string
  description: string
  automated: boolean
  parameters: Record<string, any>
  rollbackable: boolean
}

export interface EscalationPolicy {
  levels: EscalationLevel[]
  timeouts: number[] // seconds for each level
  enableAutoEscalation: boolean
}

export interface EscalationLevel {
  level: number
  actions: string[]
  approvers: string[]
  notificationChannels: string[]
}

export interface NotificationConfig {
  enableNotifications: boolean
  channels: NotificationChannel[]
  templates: NotificationTemplate[]
  escalationNotifications: boolean
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms'
  config: Record<string, any>
  enabled: boolean
}

export interface NotificationTemplate {
  type: string
  subject: string
  body: string
  variables: string[]
}