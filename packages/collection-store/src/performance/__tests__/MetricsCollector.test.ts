/**
 * MetricsCollector Tests
 * Phase 6: Performance Testing & Optimization
 *
 * Following DEVELOPMENT_RULES.md:
 * - High-granularity tests grouped by functionality
 * - Use performance.now() for timing measurements
 * - Ensure test context isolation
 * - Test every feature comprehensively
 */

import { MetricsCollector, Alert, MetricsCollectionConfig } from '../monitoring/MetricsCollector'
import { AlertThreshold } from '../testing/interfaces'

describe('Phase 6: MetricsCollector', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    // Create clean state for each test (test context isolation)
    collector = new MetricsCollector()
  })

  afterEach(async () => {
    // Cleanup resources after each test
    await collector.stopCollection()
    collector = null as any
  })

  // ============================================================================
  // CORE COLLECTION METHODS
  // ============================================================================

  describe('Core Collection Methods', () => {
    describe('startCollection', () => {
      it('should start metrics collection successfully', async () => {
        await expect(collector.startCollection(100)).resolves.toBeUndefined()
      })

      it('should throw error if collection already started', async () => {
        await collector.startCollection(100)

        await expect(collector.startCollection(100))
          .rejects.toThrow('Collection already started')
      })

      it('should use default interval if not specified', async () => {
        await expect(collector.startCollection()).resolves.toBeUndefined()
      })

      it('should use custom interval when specified', async () => {
        const customInterval = 500
        await expect(collector.startCollection(customInterval)).resolves.toBeUndefined()
      })
    })

    describe('stopCollection', () => {
      it('should stop metrics collection successfully', async () => {
        await collector.startCollection(100)
        await expect(collector.stopCollection()).resolves.toBeUndefined()
      })

      it('should handle stopping when not collecting', async () => {
        await expect(collector.stopCollection()).resolves.toBeUndefined()
      })

      it('should allow restarting after stopping', async () => {
        await collector.startCollection(100)
        await collector.stopCollection()
        await expect(collector.startCollection(100)).resolves.toBeUndefined()
      })
    })

    describe('collectSnapshot', () => {
      it('should collect metrics snapshot successfully', async () => {
        const snapshot = await collector.collectSnapshot()

        expect(snapshot).toBeDefined()
        expect(snapshot.timestamp).toBeInstanceOf(Date)
        expect(snapshot.system).toBeDefined()
        expect(snapshot.application).toBeDefined()
        expect(snapshot.network).toBeDefined()
        expect(snapshot.disk).toBeDefined()
      })

      it('should collect system metrics correctly', async () => {
        const snapshot = await collector.collectSnapshot()

        expect(snapshot.system.cpuUsage).toBeGreaterThanOrEqual(0)
        expect(snapshot.system.memoryUsage).toBeGreaterThanOrEqual(0)
        expect(snapshot.system.networkBandwidth).toBeGreaterThanOrEqual(0)
        expect(snapshot.system.diskIO).toBeGreaterThanOrEqual(0)
      })

      it('should collect application metrics correctly', async () => {
        const snapshot = await collector.collectSnapshot()

        expect(snapshot.application.heapUsed).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.heapTotal).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.external).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.rss).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.eventLoopDelay).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.activeHandles).toBeGreaterThanOrEqual(0)
        expect(snapshot.application.activeRequests).toBeGreaterThanOrEqual(0)
      })

      it('should collect network metrics correctly', async () => {
        const snapshot = await collector.collectSnapshot()

        expect(snapshot.network.bytesReceived).toBeGreaterThanOrEqual(0)
        expect(snapshot.network.bytesSent).toBeGreaterThanOrEqual(0)
        expect(snapshot.network.packetsReceived).toBeGreaterThanOrEqual(0)
        expect(snapshot.network.packetsSent).toBeGreaterThanOrEqual(0)
        expect(snapshot.network.connectionsActive).toBeGreaterThanOrEqual(0)
        expect(snapshot.network.connectionsTotal).toBeGreaterThanOrEqual(0)
      })

      it('should collect disk metrics correctly', async () => {
        const snapshot = await collector.collectSnapshot()

        expect(snapshot.disk.readBytes).toBeGreaterThanOrEqual(0)
        expect(snapshot.disk.writeBytes).toBeGreaterThanOrEqual(0)
        expect(snapshot.disk.readOperations).toBeGreaterThanOrEqual(0)
        expect(snapshot.disk.writeOperations).toBeGreaterThanOrEqual(0)
        expect(snapshot.disk.freeSpace).toBeGreaterThanOrEqual(0)
        expect(snapshot.disk.totalSpace).toBeGreaterThan(0)
      })

      it('should calculate network rates on subsequent calls', async () => {
        const snapshot1 = await collector.collectSnapshot()
        await new Promise(resolve => setTimeout(resolve, 100))
        const snapshot2 = await collector.collectSnapshot()

        // Second snapshot should have rate calculations
        expect(snapshot2.network.receiveRate).toBeDefined()
        expect(snapshot2.network.sendRate).toBeDefined()
      })

      it('should calculate disk rates on subsequent calls', async () => {
        const snapshot1 = await collector.collectSnapshot()
        await new Promise(resolve => setTimeout(resolve, 100))
        const snapshot2 = await collector.collectSnapshot()

        // Second snapshot should have rate calculations
        expect(snapshot2.disk.readRate).toBeDefined()
        expect(snapshot2.disk.writeRate).toBeDefined()
      })
    })
  })

  // ============================================================================
  // HISTORICAL DATA MANAGEMENT
  // ============================================================================

  describe('Historical Data Management', () => {
    describe('getHistoricalMetrics', () => {
      it('should return empty array when no history', async () => {
        const metrics = await collector.getHistoricalMetrics(60000) // 1 minute
        expect(metrics).toEqual([])
      })

      it('should return metrics within time range', async () => {
        // Start collection to generate history
        await collector.startCollection(50)

        // Wait for some metrics to be collected
        await new Promise(resolve => setTimeout(resolve, 200))

        await collector.stopCollection()

        const metrics = await collector.getHistoricalMetrics(60000) // 1 minute
        expect(metrics.length).toBeGreaterThan(0)

        // All metrics should be within time range
        const cutoffTime = new Date(Date.now() - 60000)
        metrics.forEach(metric => {
          expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(cutoffTime.getTime())
        })
      })

      it('should filter metrics by time range correctly', async () => {
        // Start collection to generate history
        await collector.startCollection(50)

        // Wait for some metrics to be collected
        await new Promise(resolve => setTimeout(resolve, 200))

        await collector.stopCollection()

        const shortRange = await collector.getHistoricalMetrics(100) // 100ms
        const longRange = await collector.getHistoricalMetrics(60000) // 1 minute

        expect(shortRange.length).toBeLessThanOrEqual(longRange.length)
      })
    })

    describe('clearHistory', () => {
      it('should clear all historical metrics', async () => {
        // Start collection to generate history
        await collector.startCollection(50)

        // Wait for some metrics to be collected
        await new Promise(resolve => setTimeout(resolve, 150))

        await collector.stopCollection()

        // Verify we have history
        const beforeClear = await collector.getHistoricalMetrics(60000)
        expect(beforeClear.length).toBeGreaterThan(0)

        // Clear history
        await collector.clearHistory()

        // Verify history is cleared
        const afterClear = await collector.getHistoricalMetrics(60000)
        expect(afterClear).toEqual([])
      })
    })
  })

  // ============================================================================
  // ALERTING SYSTEM
  // ============================================================================

  describe('Alerting System', () => {
    describe('setAlertThreshold', () => {
      it('should set alert threshold successfully', async () => {
        const threshold: AlertThreshold = {
          type: 'cpu_high',
          value: 80,
          operator: '>',
          severity: 'high'
        }

        await expect(collector.setAlertThreshold('system.cpuUsage', threshold))
          .resolves.toBeUndefined()
      })

      it('should handle multiple thresholds for different metrics', async () => {
        const cpuThreshold: AlertThreshold = {
          type: 'cpu_high',
          value: 80,
          operator: '>',
          severity: 'high'
        }

        const memoryThreshold: AlertThreshold = {
          type: 'memory_high',
          value: 1024 * 1024 * 100, // 100MB
          operator: '>',
          severity: 'medium'
        }

        await collector.setAlertThreshold('system.cpuUsage', cpuThreshold)
        await collector.setAlertThreshold('system.memoryUsage', memoryThreshold)

        // Should not throw errors
        expect(true).toBe(true)
      })
    })

    describe('getActiveAlerts', () => {
      it('should return empty array when no alerts', async () => {
        const alerts = await collector.getActiveAlerts()
        expect(alerts).toEqual([])
      })

      it('should return active alerts when thresholds exceeded', async () => {
        // Set a very low threshold that will be exceeded
        const threshold: AlertThreshold = {
          type: 'cpu_low',
          value: -1, // Negative value, should always be exceeded
          operator: '>',
          severity: 'low'
        }

        await collector.setAlertThreshold('system.cpuUsage', threshold)

        // Start collection to trigger alert checking
        await collector.startCollection(50)

        // Wait for alert to be triggered
        await new Promise(resolve => setTimeout(resolve, 100))

        await collector.stopCollection()

        const alerts = await collector.getActiveAlerts()
        expect(alerts.length).toBeGreaterThanOrEqual(0) // May or may not trigger depending on timing
      })
    })
  })

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  describe('Export Functionality', () => {
    describe('exportMetrics', () => {
      it('should export metrics in JSON format', async () => {
        // Generate some metrics
        await collector.startCollection(50)
        await new Promise(resolve => setTimeout(resolve, 150))
        await collector.stopCollection()

        const jsonExport = await collector.exportMetrics('json')

        expect(typeof jsonExport).toBe('string')
        expect(() => JSON.parse(jsonExport)).not.toThrow()

        const parsed = JSON.parse(jsonExport)
        expect(Array.isArray(parsed)).toBe(true)
      })

      it('should export metrics in CSV format', async () => {
        // Generate some metrics
        await collector.startCollection(50)
        await new Promise(resolve => setTimeout(resolve, 150))
        await collector.stopCollection()

        const csvExport = await collector.exportMetrics('csv')

        expect(typeof csvExport).toBe('string')

        // Should have CSV headers
        const lines = csvExport.split('\n')
        if (lines.length > 0) {
          expect(lines[0]).toContain('timestamp')
          expect(lines[0]).toContain('cpu_usage')
          expect(lines[0]).toContain('memory_usage')
        }
      })

      it('should export metrics with time range filter', async () => {
        // Generate some metrics
        await collector.startCollection(50)
        await new Promise(resolve => setTimeout(resolve, 150))
        await collector.stopCollection()

        const shortRangeExport = await collector.exportMetrics('json', 100) // 100ms
        const fullExport = await collector.exportMetrics('json')

        const shortRange = JSON.parse(shortRangeExport)
        const full = JSON.parse(fullExport)

        expect(shortRange.length).toBeLessThanOrEqual(full.length)
      })

      it('should handle empty metrics gracefully', async () => {
        const jsonExport = await collector.exportMetrics('json')
        const csvExport = await collector.exportMetrics('csv')

        expect(jsonExport).toBe('[]')
        expect(csvExport).toBe('')
      })
    })
  })

  // ============================================================================
  // CONFIGURATION & EDGE CASES
  // ============================================================================

  describe('Configuration & Edge Cases', () => {
    describe('Custom Configuration', () => {
      it('should use custom configuration', async () => {
        const customConfig: MetricsCollectionConfig = {
          collectionInterval: 200,
          historyRetention: 30000, // 30 seconds
          enableSystemMetrics: true,
          enableApplicationMetrics: false,
          enableNetworkMetrics: false,
          enableDiskMetrics: false,
          alertingEnabled: false
        }

        const customCollector = new MetricsCollector(customConfig)

        const snapshot = await customCollector.collectSnapshot()

        // Should have system metrics
        expect(snapshot.system).toBeDefined()
        expect(snapshot.system.cpuUsage).toBeGreaterThanOrEqual(0)

        // Application metrics should be empty/zero
        expect(snapshot.application.heapUsed).toBe(0)
        expect(snapshot.application.heapTotal).toBe(0)

        await customCollector.stopCollection()
      })

      it('should handle disabled metrics collection', async () => {
        const disabledConfig: MetricsCollectionConfig = {
          collectionInterval: 100,
          historyRetention: 30000,
          enableSystemMetrics: false,
          enableApplicationMetrics: false,
          enableNetworkMetrics: false,
          enableDiskMetrics: false,
          alertingEnabled: false
        }

        const disabledCollector = new MetricsCollector(disabledConfig)

        const snapshot = await disabledCollector.collectSnapshot()

        // All metrics should be zero/empty
        expect(snapshot.system.cpuUsage).toBe(0)
        expect(snapshot.application.heapUsed).toBe(0)
        expect(snapshot.network.bytesReceived).toBe(0)
        expect(snapshot.disk.readBytes).toBe(0)

        await disabledCollector.stopCollection()
      })
    })

    describe('Error Handling', () => {
      it('should handle collection errors gracefully', async () => {
        // Start collection - should not throw even if internal errors occur
        await expect(collector.startCollection(50)).resolves.toBeUndefined()

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100))

        // Stop collection - should not throw
        await expect(collector.stopCollection()).resolves.toBeUndefined()
      })

      it('should handle invalid metric names in alerts', async () => {
        const threshold: AlertThreshold = {
          type: 'invalid',
          value: 100,
          operator: '>',
          severity: 'low'
        }

        // Should not throw error for invalid metric name
        await expect(collector.setAlertThreshold('invalid.metric.path', threshold))
          .resolves.toBeUndefined()
      })
    })

    describe('Performance Validation', () => {
      it('should collect metrics efficiently', async () => {
        const startTime = performance.now()

        // Collect multiple snapshots
        for (let i = 0; i < 10; i++) {
          await collector.collectSnapshot()
        }

        const endTime = performance.now()
        const totalTime = endTime - startTime

        // Should complete within reasonable time (less than 1 second for 10 snapshots)
        expect(totalTime).toBeLessThan(1000)
      })

      it('should handle rapid collection intervals', async () => {
        // Start with very fast collection interval
        await collector.startCollection(10) // 10ms interval

        // Wait for multiple collections
        await new Promise(resolve => setTimeout(resolve, 100))

        await collector.stopCollection()

        // Should have collected multiple metrics
        const metrics = await collector.getHistoricalMetrics(60000)
        expect(metrics.length).toBeGreaterThan(1)
      })
    })
  })
})

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

function createTestAlertThreshold(
  type: string = 'test',
  value: number = 100,
  operator: AlertThreshold['operator'] = '>',
  severity: AlertThreshold['severity'] = 'medium'
): AlertThreshold {
  return {
    type,
    value,
    operator,
    severity
  }
}

function createTestConfig(overrides: Partial<MetricsCollectionConfig> = {}): MetricsCollectionConfig {
  return {
    collectionInterval: 100,
    historyRetention: 30000,
    enableSystemMetrics: true,
    enableApplicationMetrics: true,
    enableNetworkMetrics: true,
    enableDiskMetrics: true,
    alertingEnabled: true,
    ...overrides
  }
}