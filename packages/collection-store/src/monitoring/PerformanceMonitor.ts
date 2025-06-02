/**
 * Performance Monitor for WAL Transaction System
 * Real-time performance monitoring и metrics collection
 */

import { performance } from 'perf_hooks'

export interface PerformanceMetrics {
  // Operation metrics
  operationsPerSecond: number
  averageLatency: number
  totalOperations: number
  errorRate: number

  // Memory metrics
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }

  // WAL metrics
  walMetrics: {
    entriesWritten: number
    entriesRead: number
    averageEntrySize: number
    compressionRatio: number
    flushCount: number
    recoveryCount: number
  }

  // Transaction metrics
  transactionMetrics: {
    activeTransactions: number
    committedTransactions: number
    rolledBackTransactions: number
    averageTransactionDuration: number
  }

  // Timestamp
  timestamp: number
  uptime: number
}

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical'
  metric: string
  value: number
  threshold: number
  message: string
  timestamp: number
}

export interface MonitoringConfig {
  // Sampling intervals
  metricsInterval: number // ms
  alertCheckInterval: number // ms

  // Thresholds
  thresholds: {
    maxLatency: number // ms
    maxErrorRate: number // percentage
    maxMemoryUsage: number // bytes
    minThroughput: number // ops/sec
  }

  // History settings
  historySize: number
  enableAlerts: boolean
  enableLogging: boolean
}

interface OperationRecord {
  startTime: number
  endTime?: number
  success: boolean
  operationType: string
}

export class PerformanceMonitor {
  private config: MonitoringConfig
  private startTime: number
  private operationHistory: OperationRecord[] = []
  private metricsHistory: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private intervalId?: NodeJS.Timeout
  private alertIntervalId?: NodeJS.Timeout

  // Counters
  private counters = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    walEntriesWritten: 0,
    walEntriesRead: 0,
    walFlushCount: 0,
    walRecoveryCount: 0,
    activeTransactions: 0,
    committedTransactions: 0,
    rolledBackTransactions: 0,
    totalWALSize: 0,
    totalCompressedSize: 0
  }

  // Timing data
  private timingData: number[] = []
  private transactionTimings: number[] = []

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      metricsInterval: config.metricsInterval || 5000, // 5 seconds
      alertCheckInterval: config.alertCheckInterval || 1000, // 1 second
      thresholds: {
        maxLatency: config.thresholds?.maxLatency || 100, // 100ms
        maxErrorRate: config.thresholds?.maxErrorRate || 5, // 5%
        maxMemoryUsage: config.thresholds?.maxMemoryUsage || 500 * 1024 * 1024, // 500MB
        minThroughput: config.thresholds?.minThroughput || 100, // 100 ops/sec
        ...config.thresholds
      },
      historySize: config.historySize || 100,
      enableAlerts: config.enableAlerts !== false,
      enableLogging: config.enableLogging !== false
    }

    this.startTime = performance.now()
    this.startMonitoring()
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Metrics collection interval
    this.intervalId = setInterval(() => {
      this.collectMetrics()
    }, this.config.metricsInterval)

    // Alert checking interval
    if (this.config.enableAlerts) {
      this.alertIntervalId = setInterval(() => {
        this.checkAlerts()
      }, this.config.alertCheckInterval)
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    if (this.alertIntervalId) {
      clearInterval(this.alertIntervalId)
      this.alertIntervalId = undefined
    }
  }

  /**
   * Record operation start
   */
  recordOperationStart(operationType: string): string {
    const operationId = `${operationType}-${Date.now()}-${Math.random()}`
    const record: OperationRecord = {
      startTime: performance.now(),
      success: false,
      operationType
    }

    this.operationHistory.push(record)
    this.counters.totalOperations++

    // Cleanup old records
    if (this.operationHistory.length > this.config.historySize * 2) {
      this.operationHistory = this.operationHistory.slice(-this.config.historySize)
    }

    return operationId
  }

  /**
   * Record operation end
   */
  recordOperationEnd(operationId: string, success: boolean = true): void {
    // For simplicity, just find the most recent unfinished operation of the same type
    const operationType = operationId.split('-')[0]
    const record = this.operationHistory
      .slice()
      .reverse()
      .find(r => r.operationType === operationType && !r.endTime)

    if (record) {
      record.endTime = performance.now()
      record.success = success

      const duration = record.endTime - record.startTime
      this.timingData.push(duration)

      if (success) {
        this.counters.successfulOperations++
      } else {
        this.counters.failedOperations++
      }

      // Keep timing data bounded
      if (this.timingData.length > this.config.historySize) {
        this.timingData = this.timingData.slice(-this.config.historySize)
      }
    }
  }

  /**
   * Record WAL operation
   */
  recordWALOperation(type: 'write' | 'read' | 'flush' | 'recovery', size?: number): void {
    // Count as operation
    this.counters.totalOperations++
    this.counters.successfulOperations++

    switch (type) {
      case 'write':
        this.counters.walEntriesWritten++
        if (size) this.counters.totalWALSize += size
        break
      case 'read':
        this.counters.walEntriesRead++
        break
      case 'flush':
        this.counters.walFlushCount++
        break
      case 'recovery':
        this.counters.walRecoveryCount++
        break
    }
  }

  /**
   * Record compression operation
   */
  recordCompression(originalSize: number, compressedSize: number): void {
    // Count as operation
    this.counters.totalOperations++
    this.counters.successfulOperations++

    this.counters.totalCompressedSize += compressedSize
  }

  /**
   * Record transaction operation
   */
  recordTransaction(type: 'begin' | 'commit' | 'rollback', duration?: number): void {
    // Count as operation for commit and rollback
    if (type !== 'begin') {
      this.counters.totalOperations++
      this.counters.successfulOperations++
    }

    switch (type) {
      case 'begin':
        this.counters.activeTransactions++
        break
      case 'commit':
        this.counters.activeTransactions--
        this.counters.committedTransactions++
        if (duration) this.transactionTimings.push(duration)
        break
      case 'rollback':
        this.counters.activeTransactions--
        this.counters.rolledBackTransactions++
        if (duration) this.transactionTimings.push(duration)
        break
    }

    // Keep transaction timings bounded
    if (this.transactionTimings.length > this.config.historySize) {
      this.transactionTimings = this.transactionTimings.slice(-this.config.historySize)
    }
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const now = performance.now()
    const uptime = now - this.startTime
    const memoryUsage = process.memoryUsage()

    // Calculate rates and averages
    const operationsPerSecond = this.counters.totalOperations > 0 && uptime > 0 ?
      (this.counters.totalOperations / (uptime / 1000)) : 0

    const averageLatency = this.timingData.length > 0 ?
      this.timingData.reduce((sum, time) => sum + time, 0) / this.timingData.length : 0

    const errorRate = this.counters.totalOperations > 0 ?
      (this.counters.failedOperations / this.counters.totalOperations) * 100 : 0

    const averageEntrySize = this.counters.walEntriesWritten > 0 ?
      this.counters.totalWALSize / this.counters.walEntriesWritten : 0

    const compressionRatio = this.counters.totalCompressedSize > 0 ?
      this.counters.totalWALSize / this.counters.totalCompressedSize : 1

    const averageTransactionDuration = this.transactionTimings.length > 0 ?
      this.transactionTimings.reduce((sum, time) => sum + time, 0) / this.transactionTimings.length : 0

    const metrics: PerformanceMetrics = {
      operationsPerSecond,
      averageLatency,
      totalOperations: this.counters.totalOperations,
      errorRate,

      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },

      walMetrics: {
        entriesWritten: this.counters.walEntriesWritten,
        entriesRead: this.counters.walEntriesRead,
        averageEntrySize,
        compressionRatio,
        flushCount: this.counters.walFlushCount,
        recoveryCount: this.counters.walRecoveryCount
      },

      transactionMetrics: {
        activeTransactions: this.counters.activeTransactions,
        committedTransactions: this.counters.committedTransactions,
        rolledBackTransactions: this.counters.rolledBackTransactions,
        averageTransactionDuration
      },

      timestamp: Date.now(),
      uptime
    }

    this.metricsHistory.push(metrics)

    // Keep history bounded
    if (this.metricsHistory.length > this.config.historySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.historySize)
    }

    if (this.config.enableLogging) {
      this.logMetrics(metrics)
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    if (!this.config.enableAlerts || this.metricsHistory.length === 0) {
      return
    }

    const latest = this.metricsHistory[this.metricsHistory.length - 1]
    const alerts: PerformanceAlert[] = []

    // Check latency threshold (only if we have timing data)
    if (this.timingData.length > 0 && latest.averageLatency > this.config.thresholds.maxLatency) {
      alerts.push({
        type: 'warning',
        metric: 'averageLatency',
        value: latest.averageLatency,
        threshold: this.config.thresholds.maxLatency,
        message: `Average latency (${latest.averageLatency.toFixed(2)}ms) exceeds threshold (${this.config.thresholds.maxLatency}ms)`,
        timestamp: Date.now()
      })
    }

    // Check error rate threshold (only if we have operations)
    if (this.counters.totalOperations > 0 && latest.errorRate > this.config.thresholds.maxErrorRate) {
      alerts.push({
        type: 'error',
        metric: 'errorRate',
        value: latest.errorRate,
        threshold: this.config.thresholds.maxErrorRate,
        message: `Error rate (${latest.errorRate.toFixed(2)}%) exceeds threshold (${this.config.thresholds.maxErrorRate}%)`,
        timestamp: Date.now()
      })
    }

    // Check memory usage threshold
    if (latest.memoryUsage.heapUsed > this.config.thresholds.maxMemoryUsage) {
      alerts.push({
        type: 'critical',
        metric: 'memoryUsage',
        value: latest.memoryUsage.heapUsed,
        threshold: this.config.thresholds.maxMemoryUsage,
        message: `Memory usage (${(latest.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB) exceeds threshold (${(this.config.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB)`,
        timestamp: Date.now()
      })
    }

    // Check throughput threshold (only if we have enough operations)
    if (this.counters.totalOperations > 10 && latest.operationsPerSecond < this.config.thresholds.minThroughput) {
      alerts.push({
        type: 'warning',
        metric: 'operationsPerSecond',
        value: latest.operationsPerSecond,
        threshold: this.config.thresholds.minThroughput,
        message: `Throughput (${latest.operationsPerSecond.toFixed(2)} ops/sec) below threshold (${this.config.thresholds.minThroughput} ops/sec)`,
        timestamp: Date.now()
      })
    }

    // Add new alerts
    this.alerts.push(...alerts)

    // Keep alerts bounded
    if (this.alerts.length > this.config.historySize) {
      this.alerts = this.alerts.slice(-this.config.historySize)
    }

    // Log alerts
    if (alerts.length > 0 && this.config.enableLogging) {
      alerts.forEach(alert => {
        console.warn(`🚨 Performance Alert [${alert.type.toUpperCase()}]: ${alert.message}`)
      })
    }
  }

  /**
   * Log metrics
   */
  private logMetrics(metrics: PerformanceMetrics): void {
    console.log(`📊 Performance Metrics:`)
    console.log(`  Operations/sec: ${metrics.operationsPerSecond.toFixed(2)}`)
    console.log(`  Avg Latency: ${metrics.averageLatency.toFixed(2)}ms`)
    console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`)
    console.log(`  Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Active Transactions: ${metrics.transactionMetrics.activeTransactions}`)
    console.log(`  WAL Entries: ${metrics.walMetrics.entriesWritten} written, ${metrics.walMetrics.entriesRead} read`)
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ?
      this.metricsHistory[this.metricsHistory.length - 1] : null
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  /**
   * Get recent alerts
   */
  getAlerts(since?: number): PerformanceAlert[] {
    if (since) {
      return this.alerts.filter(alert => alert.timestamp >= since)
    }
    return [...this.alerts]
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = []
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      thresholds: {
        ...this.config.thresholds,
        ...config.thresholds
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.operationHistory = []
    this.metricsHistory = []
    this.alerts = []
    this.timingData = []
    this.transactionTimings = []

    // Reset counters
    Object.keys(this.counters).forEach(key => {
      (this.counters as any)[key] = 0
    })

    this.startTime = performance.now()
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    uptime: number
    totalOperations: number
    averageThroughput: number
    averageLatency: number
    errorRate: number
    peakMemoryUsage: number
    totalAlerts: number
  } {
    const now = performance.now()
    const uptime = now - this.startTime

    const averageThroughput = this.metricsHistory.length > 0 ?
      this.metricsHistory.reduce((sum, m) => sum + m.operationsPerSecond, 0) / this.metricsHistory.length : 0

    const averageLatency = this.timingData.length > 0 ?
      this.timingData.reduce((sum, time) => sum + time, 0) / this.timingData.length : 0

    const errorRate = this.counters.totalOperations > 0 ?
      (this.counters.failedOperations / this.counters.totalOperations) * 100 : 0

    const peakMemoryUsage = this.metricsHistory.length > 0 ?
      Math.max(...this.metricsHistory.map(m => m.memoryUsage.heapUsed)) : 0

    return {
      uptime,
      totalOperations: this.counters.totalOperations,
      averageThroughput,
      averageLatency,
      errorRate,
      peakMemoryUsage,
      totalAlerts: this.alerts.length
    }
  }
}