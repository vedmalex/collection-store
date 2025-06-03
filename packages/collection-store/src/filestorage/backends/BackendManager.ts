/**
 * Backend Manager Implementation
 * Phase 4: File Storage System - Backend Management
 *
 * Manages multiple storage backends including:
 * - Backend registration and lifecycle
 * - Health monitoring and failover
 * - Load balancing and backend selection
 * - Configuration management
 */

import { EventEmitter } from 'events'
import { IStorageBackend, BackendConfig, BackendManager } from './IStorageBackend'
import { BackendHealth } from '../interfaces/types'
import { StorageBackendError, BackendUnavailableError } from '../interfaces/errors'
import { LocalFileStorage } from './LocalFileStorage'

export interface BackendManagerConfig {
  defaultBackend: string
  healthCheckInterval: number
  failoverEnabled: boolean
  loadBalancing: {
    strategy: 'round_robin' | 'least_loaded' | 'size_based' | 'random'
    weights?: Record<string, number>
  }
  retryPolicy: {
    maxRetries: number
    backoffMultiplier: number
    maxBackoffTime: number
  }
}

export class FileStorageBackendManager extends EventEmitter implements BackendManager {
  private backends = new Map<string, IStorageBackend>()
  private backendConfigs = new Map<string, BackendConfig>()
  private backendHealth = new Map<string, BackendHealth>()
  private defaultBackendName: string
  private healthCheckTimer?: NodeJS.Timeout
  private roundRobinIndex = 0
  private initialized = false

  constructor(private config: BackendManagerConfig) {
    super()
    this.defaultBackendName = config.defaultBackend
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Start health monitoring
    this.startHealthMonitoring()

    this.initialized = true
    this.emit('initialized')
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }

    // Shutdown all backends
    for (const backend of this.backends.values()) {
      try {
        await backend.shutdown()
      } catch (error) {
        console.warn(`Failed to shutdown backend ${backend.name}:`, error)
      }
    }

    this.backends.clear()
    this.backendConfigs.clear()
    this.backendHealth.clear()
    this.initialized = false
    this.emit('shutdown')
  }

  // Backend management

  registerBackend(name: string, backend: IStorageBackend): void {
    if (this.backends.has(name)) {
      throw new StorageBackendError(name, 'register', new Error('Backend already registered'))
    }

    this.backends.set(name, backend)
    this.emit('backend_registered', { name, backend })
  }

  unregisterBackend(name: string): void {
    const backend = this.backends.get(name)
    if (!backend) {
      return
    }

    this.backends.delete(name)
    this.backendConfigs.delete(name)
    this.backendHealth.delete(name)

    // Shutdown the backend
    backend.shutdown().catch(error => {
      console.warn(`Failed to shutdown backend ${name} during unregistration:`, error)
    })

    this.emit('backend_unregistered', { name })
  }

  getBackend(name: string): IStorageBackend | null {
    return this.backends.get(name) || null
  }

  getDefaultBackend(): IStorageBackend {
    const backend = this.backends.get(this.defaultBackendName)
    if (!backend) {
      throw new BackendUnavailableError(this.defaultBackendName, 'Default backend not available')
    }
    return backend
  }

  setDefaultBackend(name: string): void {
    if (!this.backends.has(name)) {
      throw new StorageBackendError(name, 'setDefault', new Error('Backend not found'))
    }
    this.defaultBackendName = name
    this.emit('default_backend_changed', { name })
  }

  // Health monitoring

  async checkAllBackends(): Promise<Record<string, BackendHealth>> {
    const healthResults: Record<string, BackendHealth> = {}

    const healthChecks = Array.from(this.backends.entries()).map(async ([name, backend]) => {
      try {
        const health = await backend.getHealth()
        this.backendHealth.set(name, health)
        healthResults[name] = health
        return { name, health }
      } catch (error) {
        const unhealthyStatus: BackendHealth = {
          status: 'unhealthy',
          latency: Infinity,
          errorRate: 1,
          lastChecked: new Date(),
          details: { error: (error as Error).message }
        }
        this.backendHealth.set(name, unhealthyStatus)
        healthResults[name] = unhealthyStatus
        return { name, health: unhealthyStatus }
      }
    })

    await Promise.all(healthChecks)

    this.emit('health_check_completed', { results: healthResults })
    return healthResults
  }

  async getHealthyBackends(): Promise<string[]> {
    await this.checkAllBackends()
    return Array.from(this.backendHealth.entries())
      .filter(([_, health]) => health.status === 'healthy')
      .map(([name, _]) => name)
  }

  async getUnhealthyBackends(): Promise<string[]> {
    await this.checkAllBackends()
    return Array.from(this.backendHealth.entries())
      .filter(([_, health]) => health.status === 'unhealthy')
      .map(([name, _]) => name)
  }

  // Load balancing

  async selectBackendForUpload(fileSize: number, mimeType: string): Promise<string> {
    const healthyBackends = await this.getHealthyBackends()

    if (healthyBackends.length === 0) {
      throw new BackendUnavailableError('all', 'No healthy backends available')
    }

    switch (this.config.loadBalancing.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(healthyBackends)

      case 'least_loaded':
        return this.selectLeastLoaded(healthyBackends)

      case 'size_based':
        return this.selectSizeBased(healthyBackends, fileSize)

      case 'random':
        return this.selectRandom(healthyBackends)

      default:
        return healthyBackends[0]
    }
  }

  async selectBackendForDownload(fileId: string): Promise<string> {
    // For downloads, we need to find which backend has the file
    // This would typically be stored in metadata
    // For now, return the default backend
    return this.defaultBackendName
  }

  // Configuration

  async updateBackendConfig(name: string, config: Partial<BackendConfig>): Promise<void> {
    const existingConfig = this.backendConfigs.get(name)
    if (!existingConfig) {
      throw new StorageBackendError(name, 'updateConfig', new Error('Backend config not found'))
    }

    const updatedConfig = { ...existingConfig, ...config }
    this.backendConfigs.set(name, updatedConfig)

    // Reinitialize the backend with new config
    const backend = this.backends.get(name)
    if (backend) {
      try {
        await backend.initialize(updatedConfig)
        this.emit('backend_config_updated', { name, config: updatedConfig })
      } catch (error) {
        this.emit('backend_config_update_failed', { name, error })
        throw new StorageBackendError(name, 'updateConfig', error as Error)
      }
    }
  }

  getBackendConfig(name: string): BackendConfig | null {
    return this.backendConfigs.get(name) || null
  }

  // Backend factory methods

  async createBackend(name: string, config: BackendConfig): Promise<IStorageBackend> {
    let backend: IStorageBackend

    switch (config.type) {
      case 'local':
        backend = new LocalFileStorage(name)
        break

      case 's3':
        // TODO: Implement S3Storage
        throw new StorageBackendError(name, 'create', new Error('S3 backend not implemented yet'))

      case 'azure':
        // TODO: Implement AzureStorage
        throw new StorageBackendError(name, 'create', new Error('Azure backend not implemented yet'))

      case 'gcs':
        // TODO: Implement GCSStorage
        throw new StorageBackendError(name, 'create', new Error('GCS backend not implemented yet'))

      default:
        throw new StorageBackendError(name, 'create', new Error(`Unsupported backend type: ${config.type}`))
    }

    // Initialize the backend
    await backend.initialize(config)

    // Register the backend
    this.registerBackend(name, backend)
    this.backendConfigs.set(name, config)

    return backend
  }

  async validateBackendConfig(config: BackendConfig): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Basic validation
    if (!config.name) {
      errors.push('Backend name is required')
    }

    if (!config.type) {
      errors.push('Backend type is required')
    }

    // Type-specific validation
    switch (config.type) {
      case 'local':
        if (!config.basePath) {
          errors.push('basePath is required for local backend')
        }
        break

      case 's3':
        if (!config.bucket) {
          errors.push('bucket is required for S3 backend')
        }
        if (!config.region) {
          errors.push('region is required for S3 backend')
        }
        break

      case 'azure':
        if (!config.containerName) {
          errors.push('containerName is required for Azure backend')
        }
        if (!config.connectionString && !config.accountName) {
          errors.push('connectionString or accountName is required for Azure backend')
        }
        break

      case 'gcs':
        if (!config.bucketName) {
          errors.push('bucketName is required for GCS backend')
        }
        if (!config.projectId) {
          errors.push('projectId is required for GCS backend')
        }
        break
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Utility methods

  getAvailableBackends(): string[] {
    return Array.from(this.backends.keys())
  }

  getBackendTypes(): string[] {
    return Array.from(this.backends.values()).map(backend => backend.type)
  }

  async getAggregatedHealth(): Promise<BackendHealth> {
    const healthResults = await this.checkAllBackends()
    const healthValues = Object.values(healthResults)

    if (healthValues.length === 0) {
      return {
        status: 'unhealthy',
        latency: Infinity,
        errorRate: 1,
        lastChecked: new Date(),
        details: { reason: 'No backends available' }
      }
    }

    const healthyCount = healthValues.filter(h => h.status === 'healthy').length
    const degradedCount = healthValues.filter(h => h.status === 'degraded').length
    const unhealthyCount = healthValues.filter(h => h.status === 'unhealthy').length

    const avgLatency = healthValues.reduce((sum, h) => sum + h.latency, 0) / healthValues.length
    const errorRate = unhealthyCount / healthValues.length

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount === 0) {
      status = 'healthy'
    } else if (healthyCount > 0) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return {
      status,
      latency: avgLatency,
      errorRate,
      lastChecked: new Date(),
      details: {
        totalBackends: healthValues.length,
        healthyBackends: healthyCount,
        degradedBackends: degradedCount,
        unhealthyBackends: unhealthyCount,
        backends: healthResults
      }
    }
  }

  // Private helper methods

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkAllBackends()
      } catch (error) {
        this.emit('health_check_error', { error })
      }
    }, this.config.healthCheckInterval)
  }

  private selectRoundRobin(backends: string[]): string {
    const selected = backends[this.roundRobinIndex % backends.length]
    this.roundRobinIndex++
    return selected
  }

  private selectLeastLoaded(backends: string[]): string {
    // Select backend with lowest latency as a proxy for load
    let bestBackend = backends[0]
    let bestLatency = Infinity

    for (const backendName of backends) {
      const health = this.backendHealth.get(backendName)
      if (health && health.latency < bestLatency) {
        bestLatency = health.latency
        bestBackend = backendName
      }
    }

    return bestBackend
  }

  private selectSizeBased(backends: string[], fileSize: number): string {
    // For large files, prefer backends with better capabilities
    // For now, just return the first backend
    // In a real implementation, this would consider backend-specific size limits
    return backends[0]
  }

  private selectRandom(backends: string[]): string {
    const randomIndex = Math.floor(Math.random() * backends.length)
    return backends[randomIndex]
  }
}