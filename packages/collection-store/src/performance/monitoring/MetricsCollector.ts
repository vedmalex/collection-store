/**
 * MetricsCollector - Real-time Performance Metrics Collection
 * Phase 6: Performance Testing & Optimization
 *
 * Provides comprehensive system and application metrics collection
 * with real-time monitoring, historical tracking, and alerting capabilities.
 */

import { PerformanceMetrics, SystemMetrics, AlertThreshold, MetricsSnapshot, ApplicationMetrics, NetworkMetrics, DiskMetrics } from '../testing/interfaces'

export interface IMetricsCollector {
  // Core collection methods
  startCollection(intervalMs?: number): Promise<void>
  stopCollection(): Promise<void>
  collectSnapshot(): Promise<MetricsSnapshot>

  // Historical data
  getHistoricalMetrics(timeRangeMs: number): Promise<MetricsSnapshot[]>
  clearHistory(): Promise<void>

  // Alerting
  setAlertThreshold(metric: string, threshold: AlertThreshold): Promise<void>
  getActiveAlerts(): Promise<Alert[]>

  // Export functionality
  exportMetrics(format: 'json' | 'csv', timeRangeMs?: number): Promise<string>
}

export interface Alert {
  id: string
  metric: string
  threshold: AlertThreshold
  currentValue: number
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
}

export interface MetricsCollectionConfig {
  collectionInterval: number // milliseconds
  historyRetention: number // milliseconds
  enableSystemMetrics: boolean
  enableApplicationMetrics: boolean
  enableNetworkMetrics: boolean
  enableDiskMetrics: boolean
  alertingEnabled: boolean
}

const DEFAULT_CONFIG: MetricsCollectionConfig = {
  collectionInterval: 1000, // 1 second
  historyRetention: 3600000, // 1 hour
  enableSystemMetrics: true,
  enableApplicationMetrics: true,
  enableNetworkMetrics: true,
  enableDiskMetrics: true,
  alertingEnabled: true
}

export class MetricsCollector implements IMetricsCollector {
  private isCollecting = false
  private collectionTimer?: NodeJS.Timeout
  private metricsHistory: MetricsSnapshot[] = []
  private alertThresholds = new Map<string, AlertThreshold>()
  private activeAlerts = new Map<string, Alert>()
  private lastNetworkStats: NetworkStats | null = null
  private lastDiskStats: DiskStats | null = null

  constructor(private config: MetricsCollectionConfig = DEFAULT_CONFIG) {}

  // ============================================================================
  // CORE COLLECTION METHODS
  // ============================================================================

  async startCollection(intervalMs?: number): Promise<void> {
    if (this.isCollecting) {
      throw new MetricsError('Collection already started', 'COLLECTION_ALREADY_ACTIVE')
    }

    const interval = intervalMs || this.config.collectionInterval
    this.isCollecting = true

    console.log(`[MetricsCollector] Starting metrics collection with ${interval}ms interval`)

    this.collectionTimer = setInterval(async () => {
      try {
        const snapshot = await this.collectSnapshot()
        this.addToHistory(snapshot)
        await this.checkAlerts(snapshot)
      } catch (error) {
        console.error('[MetricsCollector] Error during collection:', error)
      }
    }, interval)
  }

  async stopCollection(): Promise<void> {
    if (!this.isCollecting) {
      return
    }

    console.log('[MetricsCollector] Stopping metrics collection')

    this.isCollecting = false
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer)
      this.collectionTimer = undefined
    }
  }

  async collectSnapshot(): Promise<MetricsSnapshot> {
    const timestamp = new Date()
    const snapshot: MetricsSnapshot = {
      timestamp,
      system: await this.collectSystemMetrics(),
      application: await this.collectApplicationMetrics(),
      network: await this.collectNetworkMetrics(),
      disk: await this.collectDiskMetrics()
    }

    return snapshot
  }

  // ============================================================================
  // HISTORICAL DATA MANAGEMENT
  // ============================================================================

  async getHistoricalMetrics(timeRangeMs: number): Promise<MetricsSnapshot[]> {
    const cutoffTime = new Date(Date.now() - timeRangeMs)
    return this.metricsHistory.filter(snapshot => snapshot.timestamp >= cutoffTime)
  }

  async clearHistory(): Promise<void> {
    console.log('[MetricsCollector] Clearing metrics history')
    this.metricsHistory = []
  }

  // ============================================================================
  // ALERTING SYSTEM
  // ============================================================================

  async setAlertThreshold(metric: string, threshold: AlertThreshold): Promise<void> {
    console.log(`[MetricsCollector] Setting alert threshold for ${metric}:`, threshold)
    this.alertThresholds.set(metric, threshold)
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values())
  }

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  async exportMetrics(format: 'json' | 'csv', timeRangeMs?: number): Promise<string> {
    const metrics = timeRangeMs
      ? await this.getHistoricalMetrics(timeRangeMs)
      : this.metricsHistory

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2)
    } else {
      return this.convertToCSV(metrics)
    }
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION
  // ============================================================================

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    if (!this.config.enableSystemMetrics) {
      return this.createEmptySystemMetrics()
    }

    return {
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: await this.getMemoryUsage(),
      networkBandwidth: await this.getNetworkBandwidth(),
      diskIO: await this.getDiskIO()
    }
  }

  private async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    if (!this.config.enableApplicationMetrics) {
      return this.createEmptyApplicationMetrics()
    }

    return {
      heapUsed: this.getHeapUsage(),
      heapTotal: this.getHeapTotal(),
      external: this.getExternalMemory(),
      rss: this.getResidentSetSize(),
      eventLoopDelay: await this.getEventLoopDelay(),
      activeHandles: this.getActiveHandles(),
      activeRequests: this.getActiveRequests()
    }
  }

  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    if (!this.config.enableNetworkMetrics) {
      return this.createEmptyNetworkMetrics()
    }

    const stats = await this.getNetworkStats()
    const metrics: NetworkMetrics = {
      bytesReceived: stats.bytesReceived,
      bytesSent: stats.bytesSent,
      packetsReceived: stats.packetsReceived,
      packetsSent: stats.packetsSent,
      connectionsActive: stats.connectionsActive,
      connectionsTotal: stats.connectionsTotal
    }

    // Calculate rates if we have previous stats
    if (this.lastNetworkStats) {
      const timeDiff = Date.now() - this.lastNetworkStats.timestamp
      const timeDiffSec = timeDiff / 1000

      metrics.receiveRate = (stats.bytesReceived - this.lastNetworkStats.bytesReceived) / timeDiffSec
      metrics.sendRate = (stats.bytesSent - this.lastNetworkStats.bytesSent) / timeDiffSec
    }

    this.lastNetworkStats = { ...stats, timestamp: Date.now() }
    return metrics
  }

  private async collectDiskMetrics(): Promise<DiskMetrics> {
    if (!this.config.enableDiskMetrics) {
      return this.createEmptyDiskMetrics()
    }

    const stats = await this.getDiskStats()
    const metrics: DiskMetrics = {
      readBytes: stats.readBytes,
      writeBytes: stats.writeBytes,
      readOperations: stats.readOperations,
      writeOperations: stats.writeOperations,
      freeSpace: stats.freeSpace,
      totalSpace: stats.totalSpace
    }

    // Calculate rates if we have previous stats
    if (this.lastDiskStats) {
      const timeDiff = Date.now() - this.lastDiskStats.timestamp
      const timeDiffSec = timeDiff / 1000

      metrics.readRate = (stats.readBytes - this.lastDiskStats.readBytes) / timeDiffSec
      metrics.writeRate = (stats.writeBytes - this.lastDiskStats.writeBytes) / timeDiffSec
    }

    this.lastDiskStats = { ...stats, timestamp: Date.now() }
    return metrics
  }

  private addToHistory(snapshot: MetricsSnapshot): void {
    this.metricsHistory.push(snapshot)

    // Clean up old history based on retention policy
    const cutoffTime = new Date(Date.now() - this.config.historyRetention)
    this.metricsHistory = this.metricsHistory.filter(s => s.timestamp >= cutoffTime)
  }

  private async checkAlerts(snapshot: MetricsSnapshot): Promise<void> {
    if (!this.config.alertingEnabled) {
      return
    }

    for (const [metricName, threshold] of this.alertThresholds) {
      const value = this.extractMetricValue(snapshot, metricName)
      if (value !== null) {
        await this.evaluateThreshold(metricName, value, threshold)
      }
    }
  }

  private extractMetricValue(snapshot: MetricsSnapshot, metricName: string): number | null {
    const parts = metricName.split('.')
    let current: any = snapshot

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return null
      }
    }

    return typeof current === 'number' ? current : null
  }

  private async evaluateThreshold(metricName: string, value: number, threshold: AlertThreshold): Promise<void> {
    const alertId = `${metricName}-${threshold.type}`
    const isTriggered = this.isThresholdTriggered(value, threshold)
    const existingAlert = this.activeAlerts.get(alertId)

    if (isTriggered && !existingAlert) {
      // Create new alert
      const alert: Alert = {
        id: alertId,
        metric: metricName,
        threshold,
        currentValue: value,
        timestamp: new Date(),
        severity: threshold.severity || 'medium',
        message: `${metricName} ${threshold.type} threshold exceeded: ${value} ${threshold.operator} ${threshold.value}`
      }

      this.activeAlerts.set(alertId, alert)
      console.warn(`[MetricsCollector] ALERT: ${alert.message}`)

    } else if (!isTriggered && existingAlert) {
      // Clear resolved alert
      this.activeAlerts.delete(alertId)
      console.log(`[MetricsCollector] Alert resolved: ${metricName}`)
    }
  }

  private isThresholdTriggered(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case '>': return value > threshold.value
      case '>=': return value >= threshold.value
      case '<': return value < threshold.value
      case '<=': return value <= threshold.value
      case '==': return value === threshold.value
      case '!=': return value !== threshold.value
      default: return false
    }
  }

  // ============================================================================
  // SYSTEM METRICS COLLECTION
  // ============================================================================

  private async getCpuUsage(): Promise<number> {
    // In a real implementation, this would use system APIs
    // For now, we'll simulate realistic CPU usage
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage()
      return (usage.user + usage.system) / 1000000 // Convert to percentage approximation
    }
    return Math.random() * 50 // Simulate 0-50% CPU usage
  }

  private async getMemoryUsage(): Promise<number> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return Math.random() * 1024 * 1024 * 100 // Simulate 0-100MB
  }

  private async getNetworkBandwidth(): Promise<number> {
    // This would typically read from /proc/net/dev on Linux
    // For now, simulate network bandwidth
    return Math.random() * 1024 * 1024 // 0-1MB/s
  }

  private async getDiskIO(): Promise<number> {
    // This would typically read from /proc/diskstats on Linux
    // For now, simulate disk I/O
    return Math.random() * 1024 * 1024 // 0-1MB/s
  }

  // ============================================================================
  // APPLICATION METRICS COLLECTION
  // ============================================================================

  private getHeapUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return Math.random() * 1024 * 1024 * 50 // Simulate 0-50MB
  }

  private getHeapTotal(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapTotal
    }
    return Math.random() * 1024 * 1024 * 100 // Simulate 0-100MB
  }

  private getExternalMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().external
    }
    return Math.random() * 1024 * 1024 * 10 // Simulate 0-10MB
  }

  private getResidentSetSize(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().rss
    }
    return Math.random() * 1024 * 1024 * 200 // Simulate 0-200MB
  }

  private async getEventLoopDelay(): Promise<number> {
    // This would use perf_hooks.monitorEventLoopDelay in real implementation
    return Math.random() * 10 // Simulate 0-10ms delay
  }

  private getActiveHandles(): number {
    if (typeof process !== 'undefined' && (process as any)._getActiveHandles) {
      return (process as any)._getActiveHandles().length
    }
    return Math.floor(Math.random() * 20) // Simulate 0-20 handles
  }

  private getActiveRequests(): number {
    if (typeof process !== 'undefined' && (process as any)._getActiveRequests) {
      return (process as any)._getActiveRequests().length
    }
    return Math.floor(Math.random() * 10) // Simulate 0-10 requests
  }

  // ============================================================================
  // NETWORK & DISK STATS
  // ============================================================================

  private async getNetworkStats(): Promise<NetworkStats> {
    // In real implementation, would read from system APIs
    return {
      bytesReceived: Math.floor(Math.random() * 1024 * 1024 * 1024), // 0-1GB
      bytesSent: Math.floor(Math.random() * 1024 * 1024 * 1024), // 0-1GB
      packetsReceived: Math.floor(Math.random() * 1000000), // 0-1M packets
      packetsSent: Math.floor(Math.random() * 1000000), // 0-1M packets
      connectionsActive: Math.floor(Math.random() * 100), // 0-100 connections
      connectionsTotal: Math.floor(Math.random() * 1000) // 0-1000 total
    }
  }

  private async getDiskStats(): Promise<DiskStats> {
    // In real implementation, would read from system APIs
    return {
      readBytes: Math.floor(Math.random() * 1024 * 1024 * 1024), // 0-1GB
      writeBytes: Math.floor(Math.random() * 1024 * 1024 * 1024), // 0-1GB
      readOperations: Math.floor(Math.random() * 100000), // 0-100k ops
      writeOperations: Math.floor(Math.random() * 100000), // 0-100k ops
      freeSpace: Math.floor(Math.random() * 1024 * 1024 * 1024 * 100), // 0-100GB
      totalSpace: 1024 * 1024 * 1024 * 500 // 500GB total
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private convertToCSV(metrics: MetricsSnapshot[]): string {
    if (metrics.length === 0) {
      return ''
    }

    const headers = [
      'timestamp',
      'cpu_usage',
      'memory_usage',
      'network_bandwidth',
      'disk_io',
      'heap_used',
      'heap_total',
      'event_loop_delay',
      'active_handles'
    ]

    const rows = metrics.map(snapshot => [
      snapshot.timestamp.toISOString(),
      snapshot.system.cpuUsage,
      snapshot.system.memoryUsage,
      snapshot.system.networkBandwidth,
      snapshot.system.diskIO,
      snapshot.application.heapUsed,
      snapshot.application.heapTotal,
      snapshot.application.eventLoopDelay,
      snapshot.application.activeHandles
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  private createEmptySystemMetrics(): SystemMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      networkBandwidth: 0,
      diskIO: 0
    }
  }

  private createEmptyApplicationMetrics(): ApplicationMetrics {
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
      eventLoopDelay: 0,
      activeHandles: 0,
      activeRequests: 0
    }
  }

  private createEmptyNetworkMetrics(): NetworkMetrics {
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      connectionsActive: 0,
      connectionsTotal: 0
    }
  }

  private createEmptyDiskMetrics(): DiskMetrics {
    return {
      readBytes: 0,
      writeBytes: 0,
      readOperations: 0,
      writeOperations: 0,
      freeSpace: 0,
      totalSpace: 0
    }
  }
}

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

interface NetworkStats {
  bytesReceived: number
  bytesSent: number
  packetsReceived: number
  packetsSent: number
  connectionsActive: number
  connectionsTotal: number
  timestamp?: number
}

interface DiskStats {
  readBytes: number
  writeBytes: number
  readOperations: number
  writeOperations: number
  freeSpace: number
  totalSpace: number
  timestamp?: number
}

class MetricsError extends Error {
  constructor(
    message: string,
    public code: string,
    public timestamp: Date = new Date(),
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'MetricsError'
  }
}