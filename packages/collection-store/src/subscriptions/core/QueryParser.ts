/**
 * Query Parser for Subscription System
 * Phase 3: Real-time Subscriptions & Notifications
 */

import type {
  SubscriptionQuery,
  ParsedSubscriptionQuery,
  SubscriptionFilter,
  ParsedFilter,
  ParsedFieldFilter,
  ParsedUserFilter,
  ParsedCustomFilter,
  FieldFilter,
  UserFilter,
  CustomFilter,
  QueryParserConfig
} from '../interfaces/types'
import { QueryParseError } from '../interfaces/types'

export class QueryParser {
  constructor(private config: QueryParserConfig) {}

  /**
   * Parse and validate a subscription query
   */
  async parse(query: SubscriptionQuery): Promise<ParsedSubscriptionQuery> {
    try {
      // 1. Validate basic query structure
      this.validateBasicQuery(query)

      // 2. Parse resource type and path
      const resourceType = this.parseResourceType(query)
      const resourcePath = this.parseResourcePath(query, resourceType)

      // 3. Parse and validate filters
      const filters = await this.parseFilters(query.filters || [])

      // 4. Parse options with defaults
      const options = this.parseOptions(query)

      // 5. Generate query ID for caching/tracking
      const queryId = this.generateQueryId(query)

      const parsedQuery: ParsedSubscriptionQuery = {
        id: queryId,
        resourceType,
        ...resourcePath,
        filters,
        options
      }

      // 6. Validate final parsed query
      this.validateParsedQuery(parsedQuery)

      return parsedQuery
    } catch (error) {
      if (error instanceof QueryParseError) {
        throw error
      }
      throw new QueryParseError(`Failed to parse subscription query: ${error.message}`, query)
    }
  }

  /**
   * Validate basic query structure
   */
  private validateBasicQuery(query: SubscriptionQuery): void {
    if (!query || typeof query !== 'object') {
      throw new QueryParseError('Query must be a valid object')
    }

    // Resource type validation
    if (query.resourceType && !['database', 'collection', 'document', 'field'].includes(query.resourceType)) {
      throw new QueryParseError(`Invalid resource type: ${query.resourceType}`)
    }

    // Collection name validation
    if (query.collection && typeof query.collection !== 'string') {
      throw new QueryParseError('Collection name must be a string')
    }

    // Document ID validation
    if (query.documentId && typeof query.documentId !== 'string') {
      throw new QueryParseError('Document ID must be a string')
    }

    // Field path validation
    if (query.fieldPath && typeof query.fieldPath !== 'string') {
      throw new QueryParseError('Field path must be a string')
    }

    // Filters validation
    if (query.filters && !Array.isArray(query.filters)) {
      throw new QueryParseError('Filters must be an array')
    }

    if (query.filters && query.filters.length > this.config.maxFilters) {
      throw new QueryParseError(`Too many filters. Maximum allowed: ${this.config.maxFilters}`)
    }
  }

  /**
   * Parse resource type with intelligent defaults
   */
  private parseResourceType(query: SubscriptionQuery): 'database' | 'collection' | 'document' | 'field' {
    if (query.resourceType) {
      return query.resourceType
    }

    // Intelligent resource type detection
    if (query.fieldPath) {
      return 'field'
    }
    if (query.documentId) {
      return 'document'
    }
    if (query.collection) {
      return 'collection'
    }
    if (query.database) {
      return 'database'
    }

    // Default to collection level
    return 'collection'
  }

  /**
   * Parse resource path components
   */
  private parseResourcePath(
    query: SubscriptionQuery,
    resourceType: string
  ): {
    database?: string
    collection?: string
    documentId?: string
    fieldPath?: string
  } {
    const result: any = {}

    // Database is optional, defaults to current database
    if (query.database) {
      result.database = query.database
    }

    // Collection is required for collection, document, and field subscriptions
    if (['collection', 'document', 'field'].includes(resourceType)) {
      if (!query.collection) {
        throw new QueryParseError(`Collection is required for ${resourceType} subscriptions`)
      }
      result.collection = query.collection
    }

    // Document ID is required for document and field subscriptions
    if (['document', 'field'].includes(resourceType)) {
      if (!query.documentId) {
        throw new QueryParseError(`Document ID is required for ${resourceType} subscriptions`)
      }
      result.documentId = query.documentId
    }

    // Field path is required for field subscriptions
    if (resourceType === 'field') {
      if (!query.fieldPath) {
        throw new QueryParseError('Field path is required for field subscriptions')
      }
      result.fieldPath = query.fieldPath
    }

    return result
  }

  /**
   * Parse and validate filters
   */
  private async parseFilters(filters: SubscriptionFilter[]): Promise<ParsedFilter[]> {
    const parsedFilters: ParsedFilter[] = []

    for (const filter of filters) {
      const parsedFilter = await this.parseFilter(filter)
      parsedFilters.push(parsedFilter)
    }

    return parsedFilters
  }

  /**
   * Parse individual filter
   */
  private async parseFilter(filter: SubscriptionFilter): Promise<ParsedFilter> {
    if (!filter || typeof filter !== 'object' || !filter.type) {
      throw new QueryParseError('Filter must have a valid type')
    }

    switch (filter.type) {
      case 'field':
        return this.parseFieldFilter(filter as FieldFilter)
      case 'user':
        return this.parseUserFilter(filter as UserFilter)
      case 'custom':
        return this.parseCustomFilter(filter as CustomFilter)
      default:
        throw new QueryParseError(`Unknown filter type: ${filter.type}`)
    }
  }

  /**
   * Parse field filter
   */
  private parseFieldFilter(filter: FieldFilter): ParsedFieldFilter {
    if (!filter.field || typeof filter.field !== 'string') {
      throw new QueryParseError('Field filter must have a valid field name')
    }

    if (!filter.operator) {
      throw new QueryParseError('Field filter must have an operator')
    }

    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex']
    if (!validOperators.includes(filter.operator)) {
      throw new QueryParseError(`Invalid field filter operator: ${filter.operator}`)
    }

    if (filter.value === undefined) {
      throw new QueryParseError('Field filter must have a value')
    }

    // Validate array operators
    if (['in', 'nin'].includes(filter.operator) && !Array.isArray(filter.value)) {
      throw new QueryParseError(`Operator ${filter.operator} requires an array value`)
    }

    // Validate regex operator
    if (filter.operator === 'regex') {
      if (typeof filter.value !== 'string') {
        throw new QueryParseError('Regex operator requires a string value')
      }
      try {
        new RegExp(filter.value)
      } catch (error) {
        throw new QueryParseError(`Invalid regex pattern: ${filter.value}`)
      }
    }

    return {
      type: 'field',
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
      caseSensitive: filter.caseSensitive !== false // Default to true
    }
  }

  /**
   * Parse user filter
   */
  private parseUserFilter(filter: UserFilter): ParsedUserFilter {
    if (!filter.userField || typeof filter.userField !== 'string') {
      throw new QueryParseError('User filter must have a valid user field name')
    }

    if (!filter.operator) {
      throw new QueryParseError('User filter must have an operator')
    }

    const validOperators = ['eq', 'ne', 'in', 'nin']
    if (!validOperators.includes(filter.operator)) {
      throw new QueryParseError(`Invalid user filter operator: ${filter.operator}`)
    }

    if (filter.value === undefined) {
      throw new QueryParseError('User filter must have a value')
    }

    // Validate array operators
    if (['in', 'nin'].includes(filter.operator) && !Array.isArray(filter.value)) {
      throw new QueryParseError(`Operator ${filter.operator} requires an array value`)
    }

    return {
      type: 'user',
      userField: filter.userField,
      operator: filter.operator,
      value: filter.value
    }
  }

  /**
   * Parse custom filter
   */
  private parseCustomFilter(filter: CustomFilter): ParsedCustomFilter {
    if (!this.config.allowCustomFilters) {
      throw new QueryParseError('Custom filters are not allowed')
    }

    if (!filter.evaluator || typeof filter.evaluator !== 'function') {
      throw new QueryParseError('Custom filter must have a valid evaluator function')
    }

    return {
      type: 'custom',
      evaluator: filter.evaluator
    }
  }

  /**
   * Parse options with defaults
   */
  private parseOptions(query: SubscriptionQuery) {
    const batchSize = query.batchSize || this.config.defaultBatchSize
    const throttleMs = query.throttleMs || this.config.defaultThrottleMs

    // Validate batch size
    if (batchSize < 1 || batchSize > this.config.maxBatchSize) {
      throw new QueryParseError(
        `Batch size must be between 1 and ${this.config.maxBatchSize}, got: ${batchSize}`
      )
    }

    // Validate throttle
    if (throttleMs < 0 || throttleMs > this.config.maxThrottleMs) {
      throw new QueryParseError(
        `Throttle must be between 0 and ${this.config.maxThrottleMs}ms, got: ${throttleMs}`
      )
    }

    return {
      includeInitialData: query.includeInitialData || false,
      includeMetadata: query.includeMetadata !== false, // Default to true
      batchSize,
      throttleMs
    }
  }

  /**
   * Generate unique query ID for caching and tracking
   */
  private generateQueryId(query: SubscriptionQuery): string {
    // Create a deterministic hash of the query for caching
    const queryString = JSON.stringify({
      resourceType: query.resourceType,
      database: query.database,
      collection: query.collection,
      documentId: query.documentId,
      fieldPath: query.fieldPath,
      filters: query.filters,
      batchSize: query.batchSize,
      throttleMs: query.throttleMs
    })

    // Simple hash function (in production, use a proper hash library)
    let hash = 0
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return `query_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`
  }

  /**
   * Validate final parsed query
   */
  private validateParsedQuery(query: ParsedSubscriptionQuery): void {
    // Ensure we have a valid resource hierarchy
    if (query.resourceType === 'field' && (!query.collection || !query.documentId || !query.fieldPath)) {
      throw new QueryParseError('Field subscription requires collection, documentId, and fieldPath')
    }

    if (query.resourceType === 'document' && (!query.collection || !query.documentId)) {
      throw new QueryParseError('Document subscription requires collection and documentId')
    }

    if (query.resourceType === 'collection' && !query.collection) {
      throw new QueryParseError('Collection subscription requires collection name')
    }

    // Validate filter combinations
    const fieldFilters = query.filters.filter(f => f.type === 'field')
    const userFilters = query.filters.filter(f => f.type === 'user')
    const customFilters = query.filters.filter(f => f.type === 'custom')

    // Check for conflicting field filters
    const fieldNames = new Set()
    for (const filter of fieldFilters) {
      const fieldFilter = filter as ParsedFieldFilter
      if (fieldNames.has(fieldFilter.field)) {
        throw new QueryParseError(`Duplicate field filter for field: ${fieldFilter.field}`)
      }
      fieldNames.add(fieldFilter.field)
    }

    // Validate custom filter count
    if (customFilters.length > 1) {
      throw new QueryParseError('Only one custom filter is allowed per subscription')
    }
  }

  /**
   * Check if two queries are equivalent (for deduplication)
   */
  static areQueriesEquivalent(query1: ParsedSubscriptionQuery, query2: ParsedSubscriptionQuery): boolean {
    return (
      query1.resourceType === query2.resourceType &&
      query1.database === query2.database &&
      query1.collection === query2.collection &&
      query1.documentId === query2.documentId &&
      query1.fieldPath === query2.fieldPath &&
      JSON.stringify(query1.filters) === JSON.stringify(query2.filters) &&
      JSON.stringify(query1.options) === JSON.stringify(query2.options)
    )
  }

  /**
   * Get query complexity score (for optimization)
   */
  static getQueryComplexity(query: ParsedSubscriptionQuery): number {
    let complexity = 0

    // Base complexity by resource type
    switch (query.resourceType) {
      case 'database': complexity += 1; break
      case 'collection': complexity += 2; break
      case 'document': complexity += 3; break
      case 'field': complexity += 4; break
    }

    // Add complexity for filters
    complexity += query.filters.length * 2

    // Add complexity for custom filters
    const customFilters = query.filters.filter(f => f.type === 'custom')
    complexity += customFilters.length * 5

    return complexity
  }

  /**
   * Optimize query for better performance
   */
  static optimizeQuery(query: ParsedSubscriptionQuery): ParsedSubscriptionQuery {
    // Sort filters by efficiency (field filters first, then user, then custom)
    const sortedFilters = [...query.filters].sort((a, b) => {
      const order = { field: 0, user: 1, custom: 2 }
      return order[a.type] - order[b.type]
    })

    return {
      ...query,
      filters: sortedFilters
    }
  }
}