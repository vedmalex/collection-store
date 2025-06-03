/**
 * Cache-related types for computed attributes system
 */

/**
 * Statistics about computed attribute cache performance
 */
export interface ComputedAttributeCacheStats {
  totalAttributes: number
  cachedAttributes: number
  hitRate: number
  missRate: number
  averageComputeTime: number
  memoryUsage: number

  // Cache operations
  totalHits: number
  totalMisses: number
  totalEvictions: number
  totalInvalidations: number

  // Performance metrics
  averageHitTime: number
  averageMissTime: number
  averageInvalidationTime: number

  // Memory metrics
  cacheSize: number
  maxCacheSize: number
  memoryPressure: number // 0-1 scale
}

/**
 * Cached attribute value with metadata
 */
export interface CachedAttribute {
  value: any
  computedAt: Date
  expiresAt: Date
  dependencies: string[]
  computeTime: number
  accessCount: number
  lastAccessAt: Date
}

/**
 * Cache key structure for computed attributes
 */
export interface CacheKey {
  attributeId: string
  targetId: string
  targetType: 'user' | 'document' | 'collection' | 'database'
  contextHash?: string // hash of relevant context data
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  type: 'dependency_change' | 'ttl_expired' | 'manual' | 'memory_pressure'
  attributeId: string
  targetId?: string
  affectedKeys: string[]
  timestamp: Date
  reason?: string
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  enabled: boolean
  maxSize: number // maximum number of cached items
  defaultTTL: number // default TTL in seconds
  maxMemoryUsage: number // maximum memory usage in bytes

  // Eviction policy
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random'

  // Performance tuning
  cleanupInterval: number // seconds
  compressionEnabled: boolean

  // Monitoring
  enableMetrics: boolean
  metricsRetention: number // seconds
}

/**
 * Cache operation result
 */
export interface CacheOperationResult {
  success: boolean
  operation: 'get' | 'set' | 'delete' | 'invalidate' | 'clear'
  key: string
  hit?: boolean
  executionTime: number
  error?: string
}

/**
 * Cache health status
 */
export interface CacheHealthStatus {
  healthy: boolean
  memoryUsage: number
  hitRate: number
  errorRate: number
  lastCleanup: Date
  issues: string[]
  recommendations: string[]
}