import { EventEmitter } from 'events'
import { IComputedAttributeCache, CacheEvent } from '../interfaces/IComputedAttributeCache'
import {
  ComputedAttributeCacheStats,
  CachedAttribute,
  CacheKey,
  CacheConfig,
  CacheOperationResult,
  CacheHealthStatus
} from '../types/CacheTypes'
import { ComputedAttributeErrorFactory, ComputedAttributeErrorCodeDetailed } from '../types/ErrorTypes'

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  value: any
  computedAt: Date
  expiresAt: Date
  dependencies: string[]
  accessCount: number
  lastAccessAt: Date
  size: number
  computeTime: number
}

/**
 * In-memory cache implementation for computed attributes
 * Provides TTL support, statistics, and dependency tracking
 */
export class ComputedAttributeCache extends EventEmitter implements IComputedAttributeCache {
  private cache = new Map<string, CacheEntry>()
  private config: CacheConfig
  private cleanupTimer?: NodeJS.Timeout
  private lastOperationResult: CacheOperationResult | null = null
  private initialized = false

  constructor(config?: Partial<CacheConfig>) {
    super()

    this.config = {
      enabled: true,
      maxSize: 10000,
      defaultTTL: 300, // 5 minutes
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      evictionPolicy: 'lru',
      cleanupInterval: 60, // 1 minute
      compressionEnabled: false,
      enableMetrics: true,
      metricsRetention: 3600, // 1 hour
      ...config
    }
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw ComputedAttributeErrorFactory.create(
        'Cache already initialized',
        ComputedAttributeErrorCodeDetailed.CACHE_ERROR,
        'cache'
      )
    }

    // Start cleanup timer
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup()
      }, this.config.cleanupInterval * 1000)
    }

    this.initialized = true
    this.emit('initialized', { timestamp: Date.now() })
  }

  /**
   * Shutdown the cache system
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    this.cache.clear()
    this.initialized = false
    this.emit('shutdown', { timestamp: Date.now() })
  }

  /**
   * Generate cache key string from CacheKey object
   */
  private generateCacheKeyString(key: CacheKey): string {
    const contextPart = key.contextHash ? `:${key.contextHash}` : ''
    return `${key.attributeId}:${key.targetType}:${key.targetId}${contextPart}`
  }

  /**
   * Calculate size of value for memory tracking
   */
  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0

    if (typeof value === 'string') return value.length * 2
    if (typeof value === 'number') return 8
    if (typeof value === 'boolean') return 4
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2
    }

    return 100 // default estimate
  }

  /**
   * Get cached attribute value
   */
  async get(key: CacheKey): Promise<CachedAttribute | null> {
    const startTime = Date.now()
    const keyString = this.generateCacheKeyString(key)

    try {
      const entry = this.cache.get(keyString)

      if (!entry) {
        this.recordOperation('get', keyString, false, Date.now() - startTime)
        this.emitCacheEvent('miss', key, Date.now() - startTime)
        return null
      }

      // Check if expired
      if (entry.expiresAt < new Date()) {
        this.cache.delete(keyString)
        this.recordOperation('get', keyString, false, Date.now() - startTime)
        this.emitCacheEvent('miss', key, Date.now() - startTime)
        return null
      }

      // Update access metadata
      entry.accessCount++
      entry.lastAccessAt = new Date()

      this.recordOperation('get', keyString, true, Date.now() - startTime)
      this.emitCacheEvent('hit', key, Date.now() - startTime)

      return {
        value: entry.value,
        computedAt: entry.computedAt,
        expiresAt: entry.expiresAt,
        dependencies: entry.dependencies,
        computeTime: entry.computeTime,
        accessCount: entry.accessCount,
        lastAccessAt: entry.lastAccessAt
      }
    } catch (error) {
      this.recordOperation('get', keyString, false, Date.now() - startTime, error.message)
      throw error
    }
  }

  /**
   * Set cached attribute value
   */
  async set(
    key: CacheKey,
    value: any,
    ttl?: number,
    dependencies: string[] = []
  ): Promise<void> {
    const startTime = Date.now()
    const keyString = this.generateCacheKeyString(key)

    try {
      const now = new Date()
      const effectiveTTL = ttl ?? this.config.defaultTTL
      const expiresAt = new Date(now.getTime() + effectiveTTL * 1000)
      const size = this.calculateSize(value)

      // Check cache size limits
      if (this.cache.size >= this.config.maxSize) {
        await this.evictLRU()
      }

      const entry: CacheEntry = {
        value,
        computedAt: now,
        expiresAt,
        dependencies,
        accessCount: 0,
        lastAccessAt: now,
        size,
        computeTime: 0 // Will be set by caller if available
      }

      this.cache.set(keyString, entry)

      this.recordOperation('set', keyString, true, Date.now() - startTime)
      this.emitCacheEvent('set', key, Date.now() - startTime, {
        size,
        ttl: effectiveTTL,
        dependencies
      })

      // Check memory usage
      this.checkMemoryUsage()
    } catch (error) {
      this.recordOperation('set', keyString, false, Date.now() - startTime, error.message)
      throw error
    }
  }

  /**
   * Delete a specific cached value
   */
  async delete(key: CacheKey): Promise<boolean> {
    const startTime = Date.now()
    const keyString = this.generateCacheKeyString(key)

    try {
      const deleted = this.cache.delete(keyString)
      this.recordOperation('delete', keyString, deleted, Date.now() - startTime)

      if (deleted) {
        this.emitCacheEvent('invalidated', key, Date.now() - startTime)
      }

      return deleted
    } catch (error) {
      this.recordOperation('delete', keyString, false, Date.now() - startTime, error.message)
      throw error
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: CacheKey): Promise<boolean> {
    const keyString = this.generateCacheKeyString(key)
    const entry = this.cache.get(keyString)

    if (!entry) return false

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(keyString)
      return false
    }

    return true
  }

  /**
   * Invalidate cache entries by attribute ID
   */
  async invalidateByAttribute(attributeId: string, targetId?: string): Promise<number> {
    const keysToDelete: string[] = []

    for (const [keyString] of this.cache) {
      const parts = keyString.split(':')
      if (parts[0] === attributeId) {
        if (!targetId || parts[2] === targetId) {
          keysToDelete.push(keyString)
        }
      }
    }

    for (const keyString of keysToDelete) {
      this.cache.delete(keyString)
    }

    return keysToDelete.length
  }

  /**
   * Invalidate cache entries by dependency
   */
  async invalidateByDependency(dependency: string): Promise<number> {
    const keysToDelete: string[] = []

    for (const [keyString, entry] of this.cache) {
      if (entry.dependencies.includes(dependency)) {
        keysToDelete.push(keyString)
      }
    }

    for (const keyString of keysToDelete) {
      this.cache.delete(keyString)
    }

    return keysToDelete.length
  }

  /**
   * Invalidate all cache entries for a target
   */
  async invalidateByTarget(
    targetType: 'user' | 'document' | 'collection' | 'database',
    targetId: string
  ): Promise<number> {
    const keysToDelete: string[] = []

    for (const [keyString] of this.cache) {
      const parts = keyString.split(':')
      if (parts[1] === targetType && parts[2] === targetId) {
        keysToDelete.push(keyString)
      }
    }

    for (const keyString of keysToDelete) {
      this.cache.delete(keyString)
    }

    return keysToDelete.length
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    const count = this.cache.size
    this.cache.clear()
    this.recordOperation('clear', 'all', true, 0)
  }

  /**
   * Perform cache cleanup
   */
  async cleanup(): Promise<{
    removedExpired: number
    removedByEviction: number
    totalRemoved: number
  }> {
    const now = new Date()
    const expiredKeys: string[] = []

    // Find expired entries
    for (const [keyString, entry] of this.cache) {
      if (entry.expiresAt < now) {
        expiredKeys.push(keyString)
      }
    }

    // Remove expired entries
    for (const keyString of expiredKeys) {
      this.cache.delete(keyString)
    }

    const removedExpired = expiredKeys.length
    let removedByEviction = 0

    // Check if we need to evict more entries due to size limits
    while (this.cache.size > this.config.maxSize) {
      await this.evictLRU()
      removedByEviction++
    }

    return {
      removedExpired,
      removedByEviction,
      totalRemoved: removedExpired + removedByEviction
    }
  }

  /**
   * Compact cache to reduce memory usage
   */
  async compact(): Promise<{
    beforeSize: number
    afterSize: number
    memoryFreed: number
  }> {
    const beforeSize = this.cache.size
    const beforeMemory = this.calculateTotalMemoryUsage()

    // Perform cleanup first
    await this.cleanup()

    const afterSize = this.cache.size
    const afterMemory = this.calculateTotalMemoryUsage()

    return {
      beforeSize,
      afterSize,
      memoryFreed: beforeMemory - afterMemory
    }
  }

  /**
   * Warm up cache with frequently accessed attributes
   */
  async warmup(attributeIds: string[], targetIds: string[]): Promise<{
    precomputed: number
    errors: number
    totalTime: number
  }> {
    // This is a placeholder implementation
    // In a real implementation, this would pre-compute attributes
    return {
      precomputed: 0,
      errors: 0,
      totalTime: 0
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ComputedAttributeCacheStats> {
    const totalEntries = this.cache.size
    const memoryUsage = this.calculateTotalMemoryUsage()

    // Calculate hit/miss rates from recent operations
    // This is a simplified implementation
    const hitRate = 0.85 // placeholder
    const missRate = 1 - hitRate

    return {
      totalAttributes: totalEntries,
      cachedAttributes: totalEntries,
      hitRate,
      missRate,
      averageComputeTime: 50, // placeholder
      memoryUsage,
      totalHits: 0, // would track in real implementation
      totalMisses: 0,
      totalEvictions: 0,
      totalInvalidations: 0,
      averageHitTime: 1,
      averageMissTime: 50,
      averageInvalidationTime: 5,
      cacheSize: totalEntries,
      maxCacheSize: this.config.maxSize,
      memoryPressure: memoryUsage / this.config.maxMemoryUsage
    }
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<CacheHealthStatus> {
    const stats = await this.getStats()
    const issues: string[] = []
    const recommendations: string[] = []

    if (stats.memoryPressure > 0.8) {
      issues.push('High memory usage')
      recommendations.push('Consider increasing maxMemoryUsage or reducing TTL')
    }

    if (stats.hitRate < 0.5) {
      issues.push('Low hit rate')
      recommendations.push('Consider increasing TTL or cache size')
    }

    return {
      healthy: issues.length === 0,
      memoryUsage: stats.memoryUsage,
      hitRate: stats.hitRate,
      errorRate: 0, // would track in real implementation
      lastCleanup: new Date(),
      issues,
      recommendations
    }
  }

  /**
   * Get operation result for monitoring
   */
  getLastOperationResult(): CacheOperationResult | null {
    return this.lastOperationResult
  }

  /**
   * Update cache configuration
   */
  async configure(config: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }

  /**
   * Get all cache keys
   */
  async getKeys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys())

    if (pattern) {
      const regex = new RegExp(pattern)
      return keys.filter(key => regex.test(key))
    }

    return keys
  }

  /**
   * Get cache entry details for debugging
   */
  async inspect(key: CacheKey): Promise<{
    exists: boolean
    value?: any
    metadata?: CachedAttribute
    size?: number
  }> {
    const keyString = this.generateCacheKeyString(key)
    const entry = this.cache.get(keyString)

    if (!entry) {
      return { exists: false }
    }

    return {
      exists: true,
      value: entry.value,
      metadata: {
        value: entry.value,
        computedAt: entry.computedAt,
        expiresAt: entry.expiresAt,
        dependencies: entry.dependencies,
        computeTime: entry.computeTime,
        accessCount: entry.accessCount,
        lastAccessAt: entry.lastAccessAt
      },
      size: entry.size
    }
  }

  /**
   * Export cache data for backup/migration
   */
  async export(): Promise<{
    version: string
    timestamp: Date
    entries: Array<{
      key: CacheKey
      value: CachedAttribute
    }>
  }> {
    const entries: Array<{ key: CacheKey; value: CachedAttribute }> = []

    for (const [keyString, entry] of this.cache) {
      const parts = keyString.split(':')
      const key: CacheKey = {
        attributeId: parts[0],
        targetType: parts[1] as any,
        targetId: parts[2],
        contextHash: parts[3]
      }

      entries.push({
        key,
        value: {
          value: entry.value,
          computedAt: entry.computedAt,
          expiresAt: entry.expiresAt,
          dependencies: entry.dependencies,
          computeTime: entry.computeTime,
          accessCount: entry.accessCount,
          lastAccessAt: entry.lastAccessAt
        }
      })
    }

    return {
      version: '1.0.0',
      timestamp: new Date(),
      entries
    }
  }

  /**
   * Import cache data from backup
   */
  async import(data: {
    version: string
    timestamp: Date
    entries: Array<{
      key: CacheKey
      value: CachedAttribute
    }>
  }): Promise<{
    imported: number
    skipped: number
    errors: number
  }> {
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const { key, value } of data.entries) {
      try {
        // Check if entry is still valid
        if (value.expiresAt < new Date()) {
          skipped++
          continue
        }

        const keyString = this.generateCacheKeyString(key)
        const entry: CacheEntry = {
          value: value.value,
          computedAt: value.computedAt,
          expiresAt: value.expiresAt,
          dependencies: value.dependencies,
          accessCount: value.accessCount,
          lastAccessAt: value.lastAccessAt,
          size: this.calculateSize(value.value),
          computeTime: value.computeTime
        }

        this.cache.set(keyString, entry)
        imported++
      } catch (error) {
        errors++
      }
    }

    return { imported, skipped, errors }
  }

  // Private helper methods

  private performCleanup(): void {
    this.cleanup().catch(error => {
      this.emit('error', { error, operation: 'cleanup' })
    })
  }

  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null
    let oldestTime = Number.MAX_SAFE_INTEGER

    for (const [keyString, entry] of this.cache) {
      if (entry.lastAccessAt.getTime() < oldestTime) {
        oldestTime = entry.lastAccessAt.getTime()
        oldestKey = keyString
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.emitCacheEvent('evicted', this.parseKeyString(oldestKey), 0, { reason: 'lru' })
    }
  }

  /**
   * Parse key string back to CacheKey object
   */
  private parseKeyString(keyString: string): CacheKey {
    const parts = keyString.split(':')
    return {
      attributeId: parts[0],
      targetType: parts[1] as any,
      targetId: parts[2],
      contextHash: parts[3]
    }
  }

  private calculateTotalMemoryUsage(): number {
    return Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0)
  }

  private checkMemoryUsage(): void {
    const currentUsage = this.calculateTotalMemoryUsage()

    if (currentUsage > this.config.maxMemoryUsage * 0.8) {
      this.emit('memoryWarning', {
        usage: currentUsage,
        maxUsage: this.config.maxMemoryUsage,
        threshold: 0.8
      })
    }
  }

  private recordOperation(
    operation: 'get' | 'set' | 'delete' | 'invalidate' | 'clear',
    key: string,
    success: boolean,
    executionTime: number,
    error?: string
  ): void {
    this.lastOperationResult = {
      success,
      operation,
      key,
      hit: operation === 'get' ? success : undefined,
      executionTime,
      error
    }
  }

  private emitCacheEvent(
    type: 'hit' | 'miss' | 'set' | 'invalidated' | 'evicted' | 'error',
    key: CacheKey,
    executionTime: number,
    metadata?: any
  ): void {
    const event: CacheEvent = {
      type,
      key,
      timestamp: new Date(),
      executionTime,
      metadata
    }

    this.emit(type, event)
  }
}