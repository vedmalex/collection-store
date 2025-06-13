import type {
  ComputedAttributeCacheStats,
  CachedAttribute,
  CacheKey,
  CacheConfig,
  CacheOperationResult,
  CacheHealthStatus
} from '../types/CacheTypes'

/**
 * Interface for computed attributes cache management
 */
export interface IComputedAttributeCache {
  // Cache operations
  /**
   * Get a cached attribute value
   * @param key The cache key
   * @returns The cached attribute or null if not found/expired
   */
  get(key: CacheKey): Promise<CachedAttribute | null>

  /**
   * Set a cached attribute value
   * @param key The cache key
   * @param value The computed value
   * @param ttl Time to live in seconds (optional, uses default if not provided)
   * @param dependencies Array of dependency identifiers
   */
  set(
    key: CacheKey,
    value: any,
    ttl?: number,
    dependencies?: string[]
  ): Promise<void>

  /**
   * Delete a specific cached value
   * @param key The cache key
   */
  delete(key: CacheKey): Promise<boolean>

  /**
   * Check if a key exists in cache
   * @param key The cache key
   */
  has(key: CacheKey): Promise<boolean>

  // Invalidation
  /**
   * Invalidate cache entries by attribute ID
   * @param attributeId The attribute ID
   * @param targetId Optional specific target ID
   */
  invalidateByAttribute(attributeId: string, targetId?: string): Promise<number>

  /**
   * Invalidate cache entries by dependency
   * @param dependency The dependency identifier
   */
  invalidateByDependency(dependency: string): Promise<number>

  /**
   * Invalidate all cache entries for a target
   * @param targetType The target type
   * @param targetId The target ID
   */
  invalidateByTarget(
    targetType: 'user' | 'document' | 'collection' | 'database',
    targetId: string
  ): Promise<number>

  /**
   * Clear all cached values
   */
  clear(): Promise<void>

  // Cache management
  /**
   * Perform cache cleanup (remove expired entries, enforce size limits)
   */
  cleanup(): Promise<{
    removedExpired: number
    removedByEviction: number
    totalRemoved: number
  }>

  /**
   * Compact cache to reduce memory usage
   */
  compact(): Promise<{
    beforeSize: number
    afterSize: number
    memoryFreed: number
  }>

  /**
   * Warm up cache with frequently accessed attributes
   * @param attributeIds Array of attribute IDs to pre-compute
   * @param targetIds Array of target IDs to pre-compute for
   */
  warmup(attributeIds: string[], targetIds: string[]): Promise<{
    precomputed: number
    errors: number
    totalTime: number
  }>

  // Statistics and monitoring
  /**
   * Get cache statistics
   */
  getStats(): Promise<ComputedAttributeCacheStats>

  /**
   * Get cache health status
   */
  getHealth(): Promise<CacheHealthStatus>

  /**
   * Get operation result for monitoring
   */
  getLastOperationResult(): CacheOperationResult | null

  // Configuration
  /**
   * Update cache configuration
   * @param config New configuration options
   */
  configure(config: Partial<CacheConfig>): Promise<void>

  /**
   * Get current cache configuration
   */
  getConfig(): CacheConfig

  // Event handling
  /**
   * Subscribe to cache events
   * @param eventType The type of event to subscribe to
   * @param handler The event handler function
   */
  on(
    eventType: 'hit' | 'miss' | 'set' | 'invalidated' | 'evicted' | 'error',
    handler: (event: CacheEvent) => void
  ): void

  /**
   * Unsubscribe from cache events
   * @param eventType The event type
   * @param handler The handler to remove
   */
  off(
    eventType: 'hit' | 'miss' | 'set' | 'invalidated' | 'evicted' | 'error',
    handler: (event: CacheEvent) => void
  ): void

  // Debugging and introspection
  /**
   * Get all cache keys (for debugging)
   * @param pattern Optional pattern to filter keys
   */
  getKeys(pattern?: string): Promise<string[]>

  /**
   * Get cache entry details for debugging
   * @param key The cache key
   */
  inspect(key: CacheKey): Promise<{
    exists: boolean
    value?: any
    metadata?: CachedAttribute
    size?: number
  }>

  /**
   * Export cache data for backup/migration
   */
  export(): Promise<{
    version: string
    timestamp: Date
    entries: Array<{
      key: CacheKey
      value: CachedAttribute
    }>
  }>

  /**
   * Import cache data from backup
   * @param data The exported cache data
   */
  import(data: {
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
  }>
}

/**
 * Cache event emitted by the cache system
 */
export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'invalidated' | 'evicted' | 'error'
  key: CacheKey
  timestamp: Date
  executionTime?: number
  error?: Error
  metadata?: {
    size?: number
    ttl?: number
    dependencies?: string[]
  }
}