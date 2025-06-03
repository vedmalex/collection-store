import { EventEmitter } from 'events'
import type { CSDatabase } from '../../..'
import type { IComputedAttributeCache } from '../interfaces/IComputedAttributeCache'
import type { DependencyTracker } from '../core/DependencyTracker'
import {
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed
} from '../types/ErrorTypes'

/**
 * Configuration for CacheInvalidator
 */
export interface CacheInvalidatorConfig {
  enableBatchInvalidation: boolean
  batchSize: number
  batchTimeout: number // milliseconds
  enableDatabaseIntegration: boolean
  enableDependencyTracking: boolean
  maxInvalidationDepth: number
  invalidationTimeout: number
  enableMetrics: boolean
}

/**
 * Default configuration
 */
export const DEFAULT_CACHE_INVALIDATOR_CONFIG: CacheInvalidatorConfig = {
  enableBatchInvalidation: true,
  batchSize: 100,
  batchTimeout: 1000, // 1 second
  enableDatabaseIntegration: true,
  enableDependencyTracking: true,
  maxInvalidationDepth: 10,
  invalidationTimeout: 5000, // 5 seconds
  enableMetrics: true
}

/**
 * Invalidation request
 */
export interface InvalidationRequest {
  id: string
  type: 'attribute' | 'dependency' | 'target' | 'collection' | 'database'
  attributeId?: string
  targetId?: string
  targetType?: 'user' | 'document' | 'collection' | 'database'
  dependency?: string
  collectionName?: string
  databaseName?: string
  reason: string
  timestamp: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  cascading: boolean
}

/**
 * Invalidation result
 */
export interface InvalidationResult {
  requestId: string
  success: boolean
  invalidatedCount: number
  affectedAttributes: string[]
  executionTime: number
  error?: string
  cascadingInvalidations: number
}

/**
 * Batch invalidation result
 */
export interface BatchInvalidationResult {
  batchId: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalInvalidated: number
  executionTime: number
  results: InvalidationResult[]
}

/**
 * Database change event
 */
export interface DatabaseChangeEvent {
  type: 'insert' | 'update' | 'delete' | 'collection_created' | 'collection_dropped'
  collectionName: string
  documentId?: string
  changes?: Record<string, any>
  timestamp: number
  nodeId?: string
}

/**
 * Invalidation metrics
 */
export interface InvalidationMetrics {
  totalInvalidations: number
  successfulInvalidations: number
  failedInvalidations: number
  averageExecutionTime: number
  batchInvalidations: number
  cascadingInvalidations: number
  databaseTriggeredInvalidations: number
  dependencyTriggeredInvalidations: number
  lastInvalidation: Date | null
  invalidationsByType: Record<string, number>
  invalidationsByPriority: Record<string, number>
}

/**
 * CacheInvalidator manages cache invalidation based on dependencies and database changes
 */
export class CacheInvalidator extends EventEmitter {
  private config: CacheInvalidatorConfig
  private cache?: IComputedAttributeCache
  private dependencyTracker?: DependencyTracker
  private database?: CSDatabase
  private isInitialized = false

  // Batch processing
  private pendingInvalidations: InvalidationRequest[] = []
  private batchTimer?: NodeJS.Timeout
  private batchCounter = 0

  // Metrics
  private metrics: InvalidationMetrics = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    failedInvalidations: 0,
    averageExecutionTime: 0,
    batchInvalidations: 0,
    cascadingInvalidations: 0,
    databaseTriggeredInvalidations: 0,
    dependencyTriggeredInvalidations: 0,
    lastInvalidation: null,
    invalidationsByType: {},
    invalidationsByPriority: {}
  }

  // Database change listeners
  private databaseListeners = new Map<string, (event: DatabaseChangeEvent) => void>()

  constructor(config: Partial<CacheInvalidatorConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CACHE_INVALIDATOR_CONFIG, ...config }
  }

  /**
   * Initialize the cache invalidator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'CacheInvalidator already initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR,
        'configuration'
      )
    }

    this.isInitialized = true
    this.emit('initialized', { timestamp: Date.now() })
  }

  /**
   * Shutdown the cache invalidator
   */
  async shutdown(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    // Process any pending invalidations
    if (this.pendingInvalidations.length > 0) {
      await this.processBatch()
    }

    // Remove database listeners
    this.removeDatabaseListeners()

    this.isInitialized = false
    this.emit('shutdown', { timestamp: Date.now() })
  }

  /**
   * Set cache instance
   */
  setCache(cache: IComputedAttributeCache): void {
    this.cache = cache
  }

  /**
   * Set dependency tracker
   */
  setDependencyTracker(tracker: DependencyTracker): void {
    this.dependencyTracker = tracker
  }

  /**
   * Set database instance and setup change listeners
   */
  setDatabase(database: CSDatabase): void {
    this.database = database
    if (this.config.enableDatabaseIntegration) {
      this.setupDatabaseListeners()
    }
  }

  /**
   * Invalidate cache by attribute ID
   */
  async invalidateByAttribute(
    attributeId: string,
    targetId?: string,
    reason: string = 'Manual invalidation',
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<InvalidationResult> {
    const request: InvalidationRequest = {
      id: this.generateRequestId(),
      type: 'attribute',
      attributeId,
      targetId,
      reason,
      timestamp: Date.now(),
      priority,
      cascading: true
    }

    return this.processInvalidationRequest(request)
  }

  /**
   * Invalidate cache by dependency
   */
  async invalidateByDependency(
    dependency: string,
    reason: string = 'Dependency changed',
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<InvalidationResult> {
    const request: InvalidationRequest = {
      id: this.generateRequestId(),
      type: 'dependency',
      dependency,
      reason,
      timestamp: Date.now(),
      priority,
      cascading: true
    }

    return this.processInvalidationRequest(request)
  }

  /**
   * Invalidate cache by target
   */
  async invalidateByTarget(
    targetType: 'user' | 'document' | 'collection' | 'database',
    targetId: string,
    reason: string = 'Target changed',
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<InvalidationResult> {
    const request: InvalidationRequest = {
      id: this.generateRequestId(),
      type: 'target',
      targetType,
      targetId,
      reason,
      timestamp: Date.now(),
      priority,
      cascading: true
    }

    return this.processInvalidationRequest(request)
  }

  /**
   * Invalidate cache by collection
   */
  async invalidateByCollection(
    collectionName: string,
    reason: string = 'Collection changed',
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<InvalidationResult> {
    const request: InvalidationRequest = {
      id: this.generateRequestId(),
      type: 'collection',
      collectionName,
      reason,
      timestamp: Date.now(),
      priority,
      cascading: true
    }

    return this.processInvalidationRequest(request)
  }

  /**
   * Batch invalidate multiple requests
   */
  async batchInvalidate(requests: Omit<InvalidationRequest, 'id' | 'timestamp'>[]): Promise<BatchInvalidationResult> {
    const batchId = this.generateBatchId()
    const startTime = Date.now()

    const invalidationRequests: InvalidationRequest[] = requests.map(req => ({
      ...req,
      id: this.generateRequestId(),
      timestamp: Date.now()
    }))

    const results: InvalidationResult[] = []
    let successfulRequests = 0
    let totalInvalidated = 0

    for (const request of invalidationRequests) {
      try {
        const result = await this.processInvalidationRequest(request)
        results.push(result)
        if (result.success) {
          successfulRequests++
          totalInvalidated += result.invalidatedCount
        }
      } catch (error) {
        results.push({
          requestId: request.id,
          success: false,
          invalidatedCount: 0,
          affectedAttributes: [],
          executionTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          cascadingInvalidations: 0
        })
      }
    }

    const executionTime = Date.now() - startTime
    this.metrics.batchInvalidations++

    const batchResult: BatchInvalidationResult = {
      batchId,
      totalRequests: invalidationRequests.length,
      successfulRequests,
      failedRequests: invalidationRequests.length - successfulRequests,
      totalInvalidated,
      executionTime,
      results
    }

    this.emit('batchInvalidated', batchResult)
    return batchResult
  }

  /**
   * Add invalidation request to batch queue
   */
  async queueInvalidation(request: Omit<InvalidationRequest, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enableBatchInvalidation) {
      // Process immediately
      const fullRequest: InvalidationRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: Date.now()
      }
      await this.processInvalidationRequest(fullRequest)
      return
    }

    const fullRequest: InvalidationRequest = {
      ...request,
      id: this.generateRequestId(),
      timestamp: Date.now()
    }

    this.pendingInvalidations.push(fullRequest)

    // Process batch if size limit reached
    if (this.pendingInvalidations.length >= this.config.batchSize) {
      await this.processBatch()
    } else {
      // Set timer for batch processing
      this.scheduleBatchProcessing()
    }
  }

  /**
   * Get invalidation metrics
   */
  getMetrics(): InvalidationMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = {
      totalInvalidations: 0,
      successfulInvalidations: 0,
      failedInvalidations: 0,
      averageExecutionTime: 0,
      batchInvalidations: 0,
      cascadingInvalidations: 0,
      databaseTriggeredInvalidations: 0,
      dependencyTriggeredInvalidations: 0,
      lastInvalidation: null,
      invalidationsByType: {},
      invalidationsByPriority: {}
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheInvalidatorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheInvalidatorConfig {
    return { ...this.config }
  }

  // Private methods

  /**
   * Process single invalidation request
   */
  private async processInvalidationRequest(request: InvalidationRequest): Promise<InvalidationResult> {
    const startTime = Date.now()
    let invalidatedCount = 0
    let affectedAttributes: string[] = []
    let cascadingInvalidations = 0

    try {
      if (!this.cache) {
        throw new Error('Cache not set')
      }

      // Process based on request type
      switch (request.type) {
        case 'attribute':
          if (request.attributeId) {
            invalidatedCount = await this.cache.invalidateByAttribute(request.attributeId, request.targetId)
            affectedAttributes = [request.attributeId]
          }
          break

        case 'dependency':
          if (request.dependency) {
            invalidatedCount = await this.cache.invalidateByDependency(request.dependency)
            // Get affected attributes from dependency tracker
            if (this.dependencyTracker && this.config.enableDependencyTracking) {
              affectedAttributes = this.dependencyTracker.getAffectedAttributes(request.dependency)
              cascadingInvalidations = await this.processCascadingInvalidations(affectedAttributes, request.reason)
            }
          }
          break

        case 'target':
          if (request.targetType && request.targetId) {
            invalidatedCount = await this.cache.invalidateByTarget(request.targetType, request.targetId)
          }
          break

        case 'collection':
          if (request.collectionName) {
            // Invalidate all attributes related to this collection
            invalidatedCount = await this.invalidateCollectionAttributes(request.collectionName)
          }
          break

        case 'database':
          if (request.databaseName) {
            // Clear entire cache for database
            await this.cache.clear()
            invalidatedCount = 1 // Symbolic count for full clear
          }
          break
      }

      const executionTime = Date.now() - startTime
      this.updateMetrics(request, true, executionTime, cascadingInvalidations)

      const result: InvalidationResult = {
        requestId: request.id,
        success: true,
        invalidatedCount,
        affectedAttributes,
        executionTime,
        cascadingInvalidations
      }

      this.emit('invalidated', { request, result })
      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.updateMetrics(request, false, executionTime, 0)

      const result: InvalidationResult = {
        requestId: request.id,
        success: false,
        invalidatedCount: 0,
        affectedAttributes: [],
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        cascadingInvalidations: 0
      }

      this.emit('invalidationError', { request, result, error })
      return result
    }
  }

  /**
   * Process cascading invalidations
   */
  private async processCascadingInvalidations(attributeIds: string[], reason: string): Promise<number> {
    if (!this.config.enableDependencyTracking || !this.dependencyTracker) {
      return 0
    }

    let cascadingCount = 0
    const processed = new Set<string>()

    for (const attributeId of attributeIds) {
      if (processed.has(attributeId)) continue
      processed.add(attributeId)

      try {
        const affected = this.dependencyTracker.getAffectedAttributes(attributeId)
        for (const affectedId of affected) {
          if (!processed.has(affectedId)) {
            await this.queueInvalidation({
              type: 'attribute',
              attributeId: affectedId,
              reason: `Cascading from ${reason}`,
              priority: 'low',
              cascading: false // Prevent infinite cascading
            })
            cascadingCount++
          }
        }
      } catch (error) {
        // Log error but continue with other attributes
        this.emit('cascadingError', { attributeId, error })
      }
    }

    return cascadingCount
  }

  /**
   * Invalidate all attributes related to a collection
   */
  private async invalidateCollectionAttributes(collectionName: string): Promise<number> {
    if (!this.cache) return 0

    // This is a simplified implementation
    // In a real implementation, you would track which attributes depend on which collections
    let invalidatedCount = 0

    try {
      // Get all cache keys and filter by collection-related patterns
      const keys = await this.cache.getKeys()
      for (const key of keys) {
        // Simple pattern matching - in real implementation, use proper dependency tracking
        if (key.includes(collectionName)) {
          // Parse key and invalidate
          const parts = key.split(':')
          if (parts.length >= 3) {
            const attributeId = parts[0]
            const targetId = parts[2]
            await this.cache.invalidateByAttribute(attributeId, targetId)
            invalidatedCount++
          }
        }
      }
    } catch (error) {
      this.emit('error', { operation: 'invalidateCollectionAttributes', error })
    }

    return invalidatedCount
  }

  /**
   * Setup database change listeners
   */
  private setupDatabaseListeners(): void {
    if (!this.database) return

    // Listen for document changes
    const documentChangeListener = (event: DatabaseChangeEvent) => {
      this.handleDatabaseChange(event)
    }

    // Listen for collection changes
    const collectionChangeListener = (event: DatabaseChangeEvent) => {
      this.handleDatabaseChange(event)
    }

    this.databaseListeners.set('documentChange', documentChangeListener)
    this.databaseListeners.set('collectionChange', collectionChangeListener)

    // Note: In a real implementation, you would register these listeners with the actual database
    // this.database.on('documentChanged', documentChangeListener)
    // this.database.on('collectionChanged', collectionChangeListener)
  }

  /**
   * Remove database listeners
   */
  private removeDatabaseListeners(): void {
    if (!this.database) return

    for (const [eventName, listener] of this.databaseListeners) {
      // Note: In a real implementation, you would remove these listeners from the actual database
      // this.database.off(eventName, listener)
    }

    this.databaseListeners.clear()
  }

  /**
   * Handle database change events
   */
  private handleDatabaseChange(event: DatabaseChangeEvent): void {
    this.metrics.databaseTriggeredInvalidations++

    // Queue invalidation based on change type
    switch (event.type) {
      case 'insert':
      case 'update':
      case 'delete':
        if (event.documentId) {
          this.queueInvalidation({
            type: 'target',
            targetType: 'document',
            targetId: event.documentId,
            reason: `Database ${event.type} operation`,
            priority: 'medium',
            cascading: true
          })
        }
        break

      case 'collection_created':
      case 'collection_dropped':
        this.queueInvalidation({
          type: 'collection',
          collectionName: event.collectionName,
          reason: `Collection ${event.type}`,
          priority: 'high',
          cascading: true
        })
        break
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.processBatch()
    }, this.config.batchTimeout)
  }

  /**
   * Process pending batch
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    if (this.pendingInvalidations.length === 0) return

    const requests = [...this.pendingInvalidations]
    this.pendingInvalidations = []

    try {
      await this.batchInvalidate(requests)
    } catch (error) {
      this.emit('batchError', { requests, error })
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    request: InvalidationRequest,
    success: boolean,
    executionTime: number,
    cascadingInvalidations: number
  ): void {
    this.metrics.totalInvalidations++

    if (success) {
      this.metrics.successfulInvalidations++
    } else {
      this.metrics.failedInvalidations++
    }

    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalInvalidations - 1) + executionTime
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalInvalidations

    this.metrics.cascadingInvalidations += cascadingInvalidations
    this.metrics.lastInvalidation = new Date()

    // Update type and priority counters
    this.metrics.invalidationsByType[request.type] = (this.metrics.invalidationsByType[request.type] || 0) + 1
    this.metrics.invalidationsByPriority[request.priority] = (this.metrics.invalidationsByPriority[request.priority] || 0) + 1
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${++this.batchCounter}`
  }

  /**
   * Ensure invalidator is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'CacheInvalidator not initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR,
        'configuration'
      )
    }
  }
}