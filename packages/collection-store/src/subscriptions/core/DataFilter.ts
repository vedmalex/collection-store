/**
 * Data Filter for Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 */

import type { User } from '../../auth/interfaces/types'
import type {
  DataChange,
  ParsedSubscriptionQuery,
  ParsedFilter,
  ParsedFieldFilter,
  ParsedUserFilter,
  ParsedCustomFilter,
  FilterContext,
  DataFilterConfig,
  CacheStats
} from '../interfaces/types'

// Temporary auth stub
interface AuthorizationEngine {
  checkPermission(user: User, resource: any, action: string, context?: any): Promise<{ allowed: boolean; reason: string }>
}

export class DataFilter {
  private cache = new Map<string, { result: any; timestamp: number; ttl: number }>()
  private cacheStats: CacheStats = {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    cacheSize: 0,
    memoryUsage: 0
  }

  constructor(
    private config: DataFilterConfig,
    private authorizationEngine: AuthorizationEngine
  ) {
    // Start cache cleanup interval
    if (this.config.enableCaching) {
      setInterval(() => this.cleanupCache(), 60000) // Every minute
    }
  }

  /**
   * Filter a data change according to subscription query and user permissions
   */
  async filterChange(
    change: DataChange,
    query: ParsedSubscriptionQuery,
    userId: string
  ): Promise<DataChange | null> {
    try {
      // 1. Check if change matches subscription scope
      if (!this.matchesSubscriptionScope(change, query)) {
        return null
      }

      // 2. Apply subscription filters
      const passesFilters = await this.applyFilters(change, query.filters, userId)
      if (!passesFilters) {
        return null
      }

      // 3. Check user permissions for this specific data
      const hasPermission = await this.checkDataPermission(change, query, userId)
      if (!hasPermission) {
        return null
      }

      // 4. Filter sensitive fields based on user permissions
      const filteredChange = await this.filterSensitiveFields(change, query, userId)

      return filteredChange
    } catch (error) {
      console.error('Error filtering data change:', error)
      return null
    }
  }

  /**
   * Check if data change matches subscription scope
   */
  private matchesSubscriptionScope(change: DataChange, query: ParsedSubscriptionQuery): boolean {
    // Database level matching
    if (query.database && change.database !== query.database) {
      return false
    }

    // Collection level matching
    if (query.collection && change.collection !== query.collection) {
      return false
    }

    // Document level matching
    if (query.documentId && change.documentId !== query.documentId) {
      return false
    }

    // Field level matching
    if (query.fieldPath) {
      if (!change.affectedFields || !change.affectedFields.includes(query.fieldPath)) {
        return false
      }
    }

    // Resource type matching
    switch (query.resourceType) {
      case 'database':
        return true // Already checked database above
      case 'collection':
        return change.collection === query.collection
      case 'document':
        return change.collection === query.collection && change.documentId === query.documentId
      case 'field':
        return (
          change.collection === query.collection &&
          change.documentId === query.documentId &&
          change.affectedFields?.includes(query.fieldPath!)
        )
      default:
        return false
    }
  }

  /**
   * Apply subscription filters to data change
   */
  private async applyFilters(
    change: DataChange,
    filters: ParsedFilter[],
    userId: string
  ): Promise<boolean> {
    for (const filter of filters) {
      const passes = await this.applyFilter(change, filter, userId)
      if (!passes) {
        return false
      }
    }
    return true
  }

  /**
   * Apply individual filter
   */
  private async applyFilter(
    change: DataChange,
    filter: ParsedFilter,
    userId: string
  ): Promise<boolean> {
    switch (filter.type) {
      case 'field':
        return this.applyFieldFilter(change, filter as ParsedFieldFilter)
      case 'user':
        return this.applyUserFilter(change, filter as ParsedUserFilter, userId)
      case 'custom':
        return this.applyCustomFilter(change, filter as ParsedCustomFilter, userId)
      default:
        return true
    }
  }

  /**
   * Apply field filter
   */
  private applyFieldFilter(change: DataChange, filter: ParsedFieldFilter): boolean {
    if (!change.data) {
      return false
    }

    const fieldValue = this.getFieldValue(change.data, filter.field)
    if (fieldValue === undefined) {
      return false
    }

    return this.evaluateFieldCondition(fieldValue, filter.operator, filter.value, filter.caseSensitive)
  }

  /**
   * Apply user filter
   */
  private async applyUserFilter(
    change: DataChange,
    filter: ParsedUserFilter,
    userId: string
  ): Promise<boolean> {
    // Get user data (this would typically come from a user service)
    const userData = await this.getUserData(userId)
    if (!userData) {
      return false
    }

    const userValue = this.getFieldValue(userData, filter.userField)
    if (userValue === undefined) {
      return false
    }

    // For array fields like roles, handle specially
    if (Array.isArray(userValue) && ['in', 'nin'].includes(filter.operator)) {
      // Check if any value in userValue array matches any value in filter.value array
      if (filter.operator === 'in') {
        return Array.isArray(filter.value) &&
               userValue.some(val => filter.value.includes(val))
      } else if (filter.operator === 'nin') {
        return Array.isArray(filter.value) &&
               !userValue.some(val => filter.value.includes(val))
      }
    }

    return this.evaluateFieldCondition(userValue, filter.operator, filter.value, true)
  }

  /**
   * Apply custom filter
   */
  private async applyCustomFilter(
    change: DataChange,
    filter: ParsedCustomFilter,
    userId: string
  ): Promise<boolean> {
    try {
      const context: FilterContext = {
        user: await this.getUserData(userId),
        subscription: null as any, // Would be passed from subscription engine
        timestamp: Date.now()
      }

      const result = await filter.evaluator(change.data, context)
      return Boolean(result)
    } catch (error) {
      console.error('Error in custom filter:', error)
      return false
    }
  }

  /**
   * Evaluate field condition
   */
  private evaluateFieldCondition(
    fieldValue: any,
    operator: string,
    filterValue: any,
    caseSensitive: boolean
  ): boolean {
    // Handle case sensitivity for string comparisons
    if (typeof fieldValue === 'string' && typeof filterValue === 'string' && !caseSensitive) {
      fieldValue = fieldValue.toLowerCase()
      filterValue = filterValue.toLowerCase()
    }

    switch (operator) {
      case 'eq':
        return fieldValue === filterValue
      case 'ne':
        return fieldValue !== filterValue
      case 'gt':
        return fieldValue > filterValue
      case 'gte':
        return fieldValue >= filterValue
      case 'lt':
        return fieldValue < filterValue
      case 'lte':
        return fieldValue <= filterValue
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(fieldValue)
      case 'nin':
        return Array.isArray(filterValue) && !filterValue.includes(fieldValue)
      case 'regex':
        if (typeof fieldValue !== 'string') {
          return false
        }
        const flags = caseSensitive ? 'g' : 'gi'
        const regex = new RegExp(filterValue, flags)
        return regex.test(fieldValue)
      default:
        return false
    }
  }

  /**
   * Get field value from object using dot notation
   */
  private getFieldValue(obj: any, fieldPath: string): any {
    if (!obj || typeof obj !== 'object') {
      return undefined
    }

    const parts = fieldPath.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      current = current[part]
    }

    return current
  }

  /**
   * Check user permissions for specific data
   */
  private async checkDataPermission(
    change: DataChange,
    query: ParsedSubscriptionQuery,
    userId: string
  ): Promise<boolean> {
    const cacheKey = `perm_${userId}_${change.collection}_${change.documentId}_${change.operation}`

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    try {
      // Get user data
      const userData = await this.getUserData(userId)
      if (!userData) {
        return false
      }

      // Check permission through authorization engine
      const resource = {
        type: query.resourceType,
        database: change.database,
        collection: change.collection,
        documentId: change.documentId,
        data: change.data
      }

      const result = await this.authorizationEngine.checkPermission(
        userData,
        resource,
        'read',
        { operation: change.operation }
      )

      // Cache result
      if (this.config.enableCaching) {
        this.setCachedResult(cacheKey, result.allowed, this.config.cacheTTL)
      }

      return result.allowed
    } catch (error) {
      console.error('Error checking data permission:', error)
      return false
    }
  }

  /**
   * Filter sensitive fields based on user permissions
   */
  private async filterSensitiveFields(
    change: DataChange,
    query: ParsedSubscriptionQuery,
    userId: string
  ): Promise<DataChange> {
    if (!change.data) {
      return change
    }

    // For now, return the change as-is
    // In a real implementation, this would filter out fields the user doesn't have access to
    return {
      ...change,
      data: await this.filterObjectFields(change.data, userId)
    }
  }

  /**
   * Filter object fields based on user permissions
   */
  private async filterObjectFields(obj: any, userId: string): Promise<any> {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    // For now, return object as-is
    // In a real implementation, this would check field-level permissions
    return obj
  }

  /**
   * Get user data (stub implementation)
   */
  private async getUserData(userId: string): Promise<User | null> {
    // This would typically fetch from a user service or cache
    // For now, return a basic user object
    return {
      id: userId,
      email: `user${userId}@example.com`,
      passwordHash: 'hash',
      roles: ['user'],
      attributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  }

  /**
   * Cache management
   */
  private getCachedResult(key: string): boolean | null {
    if (!this.config.enableCaching) {
      return null
    }

    const cached = this.cache.get(key)
    if (!cached) {
      this.cacheStats.totalRequests++
      this.cacheStats.missRate = (this.cacheStats.missRate * (this.cacheStats.totalRequests - 1) + 1) / this.cacheStats.totalRequests
      return null
    }

    // Check if expired
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.cache.delete(key)
      this.cacheStats.totalRequests++
      this.cacheStats.missRate = (this.cacheStats.missRate * (this.cacheStats.totalRequests - 1) + 1) / this.cacheStats.totalRequests
      return null
    }

    this.cacheStats.totalRequests++
    this.cacheStats.hitRate = (this.cacheStats.hitRate * (this.cacheStats.totalRequests - 1) + 1) / this.cacheStats.totalRequests
    return cached.result
  }

  private setCachedResult(key: string, result: boolean, ttl: number): void {
    if (!this.config.enableCaching) {
      return
    }

    // Check cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries (simple LRU)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl
    })

    this.updateCacheStats()
  }

  private cleanupCache(): void {
    if (!this.config.enableCaching) {
      return
    }

    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.timestamp + cached.ttl) {
        this.cache.delete(key)
      }
    }

    this.updateCacheStats()
  }

  private updateCacheStats(): void {
    this.cacheStats.cacheSize = this.cache.size
    this.cacheStats.memoryUsage = this.cache.size * 100 // Rough estimate
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    this.updateCacheStats()
  }

  /**
   * Batch filter multiple changes
   */
  async filterChanges(
    changes: DataChange[],
    query: ParsedSubscriptionQuery,
    userId: string
  ): Promise<DataChange[]> {
    const filteredChanges: DataChange[] = []

    for (const change of changes) {
      const filtered = await this.filterChange(change, query, userId)
      if (filtered) {
        filteredChanges.push(filtered)
      }
    }

    return filteredChanges
  }
}