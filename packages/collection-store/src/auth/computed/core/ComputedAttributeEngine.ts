/**
 * ComputedAttributeEngine - Core implementation of computed attributes system
 * Handles attribute registration, computation, caching, and dependency management
 */

import type {
  ComputedAttributeDefinition,
  ComputationContext,
  ComputedAttributeCacheStats,
  CacheKey
} from '../types'

import type {
  IComputedAttributeEngine,
  IComputedAttributeCache,
  ComputedAttributeEvent
} from '../interfaces'

import {
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed
} from '../types/ErrorTypes'

import { EventEmitter } from 'events'

/**
 * Configuration for ComputedAttributeEngine
 */
export interface ComputedAttributeEngineConfig {
  // Performance settings
  maxConcurrentComputations?: number
  defaultComputeTimeout?: number

  // Cache settings
  enableCaching?: boolean
  defaultCacheTTL?: number

  // Error handling
  maxRetryAttempts?: number
  retryDelay?: number
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ComputedAttributeEngineConfig> = {
  maxConcurrentComputations: 100,
  defaultComputeTimeout: 30000, // 30 seconds
  enableCaching: true,
  defaultCacheTTL: 300000, // 5 minutes
  maxRetryAttempts: 3,
  retryDelay: 1000 // 1 second
}

/**
 * Main ComputedAttributeEngine implementation
 */
export class ComputedAttributeEngine extends EventEmitter implements IComputedAttributeEngine {
  private readonly config: Required<ComputedAttributeEngineConfig>
  private readonly attributes: Map<string, ComputedAttributeDefinition> = new Map()
  private readonly activeComputations: Map<string, Promise<any>> = new Map()

  // Injected dependencies
  private cache?: IComputedAttributeCache

  // Internal state
  private isInitialized = false
  private computationCount = 0
  private errorCount = 0
  private totalComputeTime = 0
  private startTime = new Date()

  constructor(config: ComputedAttributeEngineConfig = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Set up error handling
    this.on('error', this.handleInternalError.bind(this))
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'Engine is already initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      )
    }

    this.isInitialized = true
    this.emit('initialized')
  }

  /**
   * Register a computed attribute
   */
  async registerAttribute(definition: ComputedAttributeDefinition): Promise<void> {
    this.ensureInitialized()

    try {
      // Validate definition
      await this.validateAttributeDefinition(definition)

      // Store in memory
      this.attributes.set(definition.id, definition)

      this.emit('attributeRegistered', definition)

    } catch (error) {
      if (error instanceof Error && error.name === 'ComputedAttributeError') {
        throw error
      }

      const engineError = ComputedAttributeErrorFactory.create(
        `Failed to register attribute: ${definition.id}`,
        ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION,
        'validation',
        {
          attributeId: definition.id,
          originalError: error as Error
        }
      )
      this.emit('error', engineError)
      throw engineError
    }
  }

  /**
   * Unregister a computed attribute
   */
  async unregisterAttribute(attributeId: string): Promise<void> {
    this.ensureInitialized()

    if (!this.attributes.has(attributeId)) {
      throw ComputedAttributeErrorFactory.create(
        `Attribute not found: ${attributeId}`,
        ComputedAttributeErrorCodeDetailed.ATTRIBUTE_NOT_FOUND,
        'validation',
        { attributeId }
      )
    }

    try {
      // Remove from memory
      const definition = this.attributes.get(attributeId)!
      this.attributes.delete(attributeId)

      // Clear cache for this attribute
      if (this.cache) {
        await this.cache.invalidateByAttribute(attributeId)
      }

      this.emit('attributeUnregistered', definition)

    } catch (error) {
      const engineError = ComputedAttributeErrorFactory.create(
        `Failed to unregister attribute: ${attributeId}`,
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR,
        'configuration',
        {
          attributeId,
          originalError: error as Error
        }
      )
      this.emit('error', engineError)
      throw engineError
    }
  }

  /**
   * Get attribute definition by ID
   */
  async getAttributeDefinition(attributeId: string): Promise<ComputedAttributeDefinition | undefined> {
    this.ensureInitialized()
    return this.attributes.get(attributeId)
  }

  /**
   * List all registered attributes
   */
  async listAttributes(targetType?: 'user' | 'document' | 'collection' | 'database'): Promise<ComputedAttributeDefinition[]> {
    this.ensureInitialized()

    const allAttributes = Array.from(this.attributes.values())

    if (!targetType) {
      return allAttributes
    }

    // Filter by target type if specified
    return allAttributes.filter(attr =>
      attr.targetType === targetType ||
      (Array.isArray(attr.targetType) && attr.targetType.includes(targetType))
    )
  }

  /**
   * Compute a single attribute
   */
  async computeAttribute(attributeId: string, context: ComputationContext): Promise<any> {
    this.ensureInitialized()

    const startTime = Date.now()

    try {
      // Get attribute definition
      const definition = this.attributes.get(attributeId)
      if (!definition) {
        throw ComputedAttributeErrorFactory.create(
          `Attribute not found: ${attributeId}`,
          ComputedAttributeErrorCodeDetailed.ATTRIBUTE_NOT_FOUND,
          'validation',
          { attributeId }
        )
      }

      // Check cache first
      if (this.cache) {
        const cacheKey = this.buildCacheKey(attributeId, context.targetId, context.targetType)
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          this.emitEvent('cache-hit', attributeId, context.targetId, { value: cached.value })
          return cached.value
        } else {
          this.emitEvent('cache-miss', attributeId, context.targetId)
        }
      }

      // Prevent concurrent computations for the same target
      const concurrencyKey = `${attributeId}:${context.targetId}`
      if (this.activeComputations.has(concurrencyKey)) {
        const result = await this.activeComputations.get(concurrencyKey)!
        return result
      }

      // Start computation
      const computationPromise = this.performComputation(definition, context)
      this.activeComputations.set(concurrencyKey, computationPromise)

      try {
        const result = await computationPromise

        // Cache result if caching is enabled
        if (this.cache) {
          const cacheKey = this.buildCacheKey(attributeId, context.targetId, context.targetType)
          await this.cache.set(cacheKey, result)
        }

        const computeTime = Date.now() - startTime
        this.computationCount++
        this.totalComputeTime += computeTime

        this.emitEvent('computed', attributeId, context.targetId, {
          value: result,
          computeTime
        })

        return result

      } finally {
        this.activeComputations.delete(concurrencyKey)
      }

    } catch (error) {
      const computeTime = Date.now() - startTime
      this.errorCount++

      if (error instanceof Error && error.name === 'ComputedAttributeError') {
        this.emitEvent('error', attributeId, context.targetId, { error, computeTime })
        throw error
      }

      const engineError = ComputedAttributeErrorFactory.create(
        `Computation failed for attribute: ${attributeId}`,
        ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
        'computation',
        {
          attributeId,
          originalError: error as Error
        }
      )

      this.emitEvent('error', attributeId, context.targetId, { error: engineError, computeTime })
      throw engineError
    }
  }

  /**
   * Compute all attributes for a target
   */
  async computeAllAttributes(
    target: 'user' | 'document' | 'collection' | 'database',
    targetId: string,
    context: ComputationContext
  ): Promise<Record<string, any>> {
    this.ensureInitialized()

    // Get all attributes for this target type
    const attributes = await this.listAttributes(target)
    const attributeIds = attributes.map(attr => attr.id)

    return this.computeAttributes(attributeIds, context)
  }

  /**
   * Compute multiple specific attributes
   */
  async computeAttributes(attributeIds: string[], context: ComputationContext): Promise<Record<string, any>> {
    this.ensureInitialized()

    const results: Record<string, any> = {}

    // Compute attributes sequentially for now
    for (const attributeId of attributeIds) {
      try {
        const result = await this.computeAttribute(attributeId, context)
        results[attributeId] = result
      } catch (error) {
        // Continue with other attributes unless it's a critical error
        this.emit('attributeComputationError', { attributeId, error })
      }
    }

    return results
  }

  /**
   * Invalidate cache for a specific attribute
   */
  async invalidateCache(attributeId: string, targetId?: string): Promise<void> {
    this.ensureInitialized()

    if (!this.cache) return

    try {
      if (targetId) {
        // For specific target, we need to know the target type
        // For now, invalidate by attribute and target ID
        await this.cache.invalidateByAttribute(attributeId, targetId)
        this.emitEvent('invalidated', attributeId, targetId)
      } else {
        await this.cache.invalidateByAttribute(attributeId)
        this.emitEvent('invalidated', attributeId, 'all')
      }

    } catch (error) {
      const engineError = ComputedAttributeErrorFactory.create(
        'Failed to invalidate cache',
        ComputedAttributeErrorCodeDetailed.CACHE_ERROR,
        'cache',
        {
          attributeId,
          originalError: error as Error
        }
      )
      this.emit('error', engineError)
      throw engineError
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    this.ensureInitialized()

    if (!this.cache) return

    try {
      await this.cache.clear()
      this.emitEvent('invalidated', 'all', 'all')
    } catch (error) {
      const engineError = ComputedAttributeErrorFactory.create(
        'Failed to clear cache',
        ComputedAttributeErrorCodeDetailed.CACHE_ERROR,
        'cache',
        { originalError: error as Error }
      )
      this.emit('error', engineError)
      throw engineError
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<ComputedAttributeCacheStats> {
    this.ensureInitialized()

    if (!this.cache) {
      return {
        totalAttributes: 0,
        cachedAttributes: 0,
        hitRate: 0,
        missRate: 0,
        averageComputeTime: 0,
        memoryUsage: 0,
        totalHits: 0,
        totalMisses: 0,
        totalEvictions: 0,
        totalInvalidations: 0,
        averageHitTime: 0,
        averageMissTime: 0,
        averageInvalidationTime: 0,
        cacheSize: 0,
        maxCacheSize: 0,
        memoryPressure: 0
      }
    }

    return this.cache.getStats()
  }

  /**
   * Validate attribute definition
   */
  async validateDefinition(definition: ComputedAttributeDefinition): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      await this.validateAttributeDefinition(definition)
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message)
      }
    }

    // Add warnings for potential issues
    if (!definition.description) {
      warnings.push('Attribute description is missing')
    }

    if (definition.dependencies && definition.dependencies.length > 5) {
      warnings.push('Attribute has many dependencies, consider optimization')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Check engine health and performance
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    registeredAttributes: number
    cacheSize: number
    averageComputeTime: number
    errorRate: number
  }> {
    const cacheStats = await this.getCacheStats()
    const averageComputeTime = this.computationCount > 0 ?
      this.totalComputeTime / this.computationCount : 0
    const errorRate = this.computationCount > 0 ?
      this.errorCount / this.computationCount : 0

    const healthy = this.isInitialized &&
      this.activeComputations.size < this.config.maxConcurrentComputations * 0.8 &&
      errorRate < 0.1 // Less than 10% error rate

    return {
      healthy,
      registeredAttributes: this.attributes.size,
      cacheSize: cacheStats.memoryUsage,
      averageComputeTime,
      errorRate
    }
  }

  /**
   * Set cache implementation
   */
  setCache(cache: IComputedAttributeCache): void {
    this.cache = cache
  }

  // Event handler methods for interface compatibility
  override on(
    eventType: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated',
    handler: (event: ComputedAttributeEvent) => void
  ): this {
    return super.on(eventType, handler)
  }

  override off(
    eventType: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated',
    handler: (event: ComputedAttributeEvent) => void
  ): this {
    return super.off(eventType, handler)
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw ComputedAttributeErrorFactory.create(
        'Engine is not initialized',
        ComputedAttributeErrorCodeDetailed.CONFIGURATION_ERROR
      )
    }
  }

  private async validateAttributeDefinition(definition: ComputedAttributeDefinition): Promise<void> {
    if (!definition.id || typeof definition.id !== 'string') {
      throw ComputedAttributeErrorFactory.create(
        'Attribute ID is required and must be a string',
        ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION
      )
    }

    if (!definition.name || typeof definition.name !== 'string') {
      throw ComputedAttributeErrorFactory.create(
        'Attribute name is required and must be a string',
        ComputedAttributeErrorCodeDetailed.INVALID_DEFINITION
      )
    }

    if (!definition.computeFunction || typeof definition.computeFunction !== 'function') {
      throw ComputedAttributeErrorFactory.create(
        'Compute function is required and must be a function',
        ComputedAttributeErrorCodeDetailed.INVALID_COMPUTE_FUNCTION
      )
    }

    if (this.attributes.has(definition.id)) {
      throw ComputedAttributeErrorFactory.create(
        `Attribute already exists: ${definition.id}`,
        ComputedAttributeErrorCodeDetailed.ATTRIBUTE_ALREADY_EXISTS
      )
    }
  }

  private async performComputation(
    definition: ComputedAttributeDefinition,
    context: ComputationContext
  ): Promise<any> {
    try {
      // Execute the compute function with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(ComputedAttributeErrorFactory.create(
            `Computation timeout after ${this.config.defaultComputeTimeout}ms`,
            ComputedAttributeErrorCodeDetailed.COMPUTATION_TIMEOUT,
            'computation',
            { attributeId: definition.id }
          ))
        }, this.config.defaultComputeTimeout)
      })

      const computationPromise = definition.computeFunction(context)
      const value = await Promise.race([computationPromise, timeoutPromise])

      return value

    } catch (error) {
      if (error instanceof Error && error.name === 'ComputedAttributeError') {
        throw error
      }

      throw ComputedAttributeErrorFactory.create(
        `Computation failed: ${error}`,
        ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
        'computation',
        {
          attributeId: definition.id,
          originalError: error as Error
        }
      )
    }
  }

  private buildCacheKey(attributeId: string, targetId: string, targetType: 'user' | 'document' | 'collection' | 'database'): CacheKey {
    return {
      attributeId,
      targetId,
      targetType
    }
  }

  private emitEvent(
    type: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated',
    attributeId: string,
    targetId: string,
    data?: any
  ): void {
    const event: ComputedAttributeEvent = {
      type,
      attributeId,
      targetId,
      timestamp: Date.now(),
      data,
      error: data?.error,
      computeTime: data?.computeTime,
      cacheKey: `${attributeId}:${targetId}`
    }

    this.emit(type, event)
  }

  private handleInternalError(error: Error): void {
    // Log internal errors
    console.error('ComputedAttributeEngine internal error:', error)
  }
}