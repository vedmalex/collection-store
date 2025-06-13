import type { ComputedAttributeDefinition, ComputationContext, ComputedAttributeCacheStats } from '../types'

/**
 * Core interface for the Computed Attributes Engine
 * Manages registration, computation, and caching of computed attributes
 */
export interface IComputedAttributeEngine {
  // Attribute management
  /**
   * Register a new computed attribute definition
   * @param definition The computed attribute definition
   * @throws {ComputedAttributeError} If definition is invalid or already exists
   */
  registerAttribute(definition: ComputedAttributeDefinition): Promise<void>

  /**
   * Unregister a computed attribute
   * @param attributeId The ID of the attribute to unregister
   * @throws {ComputedAttributeError} If attribute doesn't exist
   */
  unregisterAttribute(attributeId: string): Promise<void>

  /**
   * Get a registered attribute definition
   * @param attributeId The ID of the attribute
   * @returns The attribute definition or undefined if not found
   */
  getAttributeDefinition(attributeId: string): Promise<ComputedAttributeDefinition | undefined>

  /**
   * List all registered attributes
   * @param targetType Optional filter by target type
   * @returns Array of attribute definitions
   */
  listAttributes(targetType?: 'user' | 'document' | 'collection' | 'database'): Promise<ComputedAttributeDefinition[]>

  // Computation
  /**
   * Compute a single attribute value
   * @param attributeId The ID of the attribute to compute
   * @param context The computation context
   * @returns The computed value
   * @throws {ComputedAttributeError} If computation fails
   */
  computeAttribute(
    attributeId: string,
    context: ComputationContext
  ): Promise<any>

  /**
   * Compute all attributes for a target
   * @param target The target type
   * @param targetId The target ID
   * @param context The computation context
   * @returns Record of attribute ID to computed value
   */
  computeAllAttributes(
    target: 'user' | 'document' | 'collection' | 'database',
    targetId: string,
    context: ComputationContext
  ): Promise<Record<string, any>>

  /**
   * Compute multiple specific attributes
   * @param attributeIds Array of attribute IDs to compute
   * @param context The computation context
   * @returns Record of attribute ID to computed value
   */
  computeAttributes(
    attributeIds: string[],
    context: ComputationContext
  ): Promise<Record<string, any>>

  // Cache management
  /**
   * Invalidate cache for a specific attribute
   * @param attributeId The attribute ID
   * @param targetId Optional specific target ID
   */
  invalidateCache(attributeId: string, targetId?: string): Promise<void>

  /**
   * Clear all cached values
   */
  clearAllCache(): Promise<void>

  /**
   * Get cache statistics
   * @returns Cache performance statistics
   */
  getCacheStats(): Promise<ComputedAttributeCacheStats>

  // Validation and health
  /**
   * Validate an attribute definition
   * @param definition The definition to validate
   * @returns Validation result with errors if any
   */
  validateDefinition(definition: ComputedAttributeDefinition): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }>

  /**
   * Check engine health and performance
   * @returns Health status and metrics
   */
  getHealthStatus(): Promise<{
    healthy: boolean
    registeredAttributes: number
    cacheSize: number
    averageComputeTime: number
    errorRate: number
  }>

  // Event handling
  /**
   * Subscribe to attribute computation events
   * @param eventType The type of event to subscribe to
   * @param handler The event handler function
   */
  on(
    eventType: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated',
    handler: (event: ComputedAttributeEvent) => void
  ): void

  /**
   * Unsubscribe from events
   * @param eventType The event type
   * @param handler The handler to remove
   */
  off(
    eventType: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated',
    handler: (event: ComputedAttributeEvent) => void
  ): void
}

/**
 * Event emitted by the computed attributes engine
 */
export interface ComputedAttributeEvent {
  type: 'computed' | 'error' | 'cache-hit' | 'cache-miss' | 'invalidated'
  attributeId: string
  targetId: string
  timestamp: number
  data?: any
  error?: Error
  computeTime?: number
  cacheKey?: string
}