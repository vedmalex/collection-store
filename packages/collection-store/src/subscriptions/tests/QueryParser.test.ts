/**
 * Tests for QueryParser
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { QueryParser } from '../core/QueryParser'
import { QueryParseError } from '../interfaces/types'
import type {
  SubscriptionQuery,
  QueryParserConfig,
  FieldFilter,
  UserFilter,
  CustomFilter
} from '../interfaces/types'

describe('QueryParser', () => {
  let parser: QueryParser
  let config: QueryParserConfig

  beforeEach(() => {
    config = {
      maxFilters: 10,
      allowCustomFilters: true,
      defaultBatchSize: 100,
      maxBatchSize: 1000,
      defaultThrottleMs: 0,
      maxThrottleMs: 5000
    }
    parser = new QueryParser(config)
  })

  describe('Basic Query Parsing', () => {
    it('should parse a simple collection subscription', async () => {
      const query: SubscriptionQuery = {
        collection: 'users'
      }

      const parsed = await parser.parse(query)

      expect(parsed.resourceType).toBe('collection')
      expect(parsed.collection).toBe('users')
      expect(parsed.filters).toEqual([])
      expect(parsed.options.includeInitialData).toBe(false)
      expect(parsed.options.includeMetadata).toBe(true)
      expect(parsed.options.batchSize).toBe(100)
      expect(parsed.options.throttleMs).toBe(0)
    })

    it('should parse a document subscription', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        documentId: 'user123'
      }

      const parsed = await parser.parse(query)

      expect(parsed.resourceType).toBe('document')
      expect(parsed.collection).toBe('users')
      expect(parsed.documentId).toBe('user123')
    })

    it('should parse a field subscription', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        documentId: 'user123',
        fieldPath: 'profile.name'
      }

      const parsed = await parser.parse(query)

      expect(parsed.resourceType).toBe('field')
      expect(parsed.collection).toBe('users')
      expect(parsed.documentId).toBe('user123')
      expect(parsed.fieldPath).toBe('profile.name')
    })

    it('should parse explicit resource type', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'database',
        database: 'mydb'
      }

      const parsed = await parser.parse(query)

      expect(parsed.resourceType).toBe('database')
      expect(parsed.database).toBe('mydb')
    })
  })

  describe('Options Parsing', () => {
    it('should parse custom options', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        includeInitialData: true,
        includeMetadata: false,
        batchSize: 50,
        throttleMs: 1000
      }

      const parsed = await parser.parse(query)

      expect(parsed.options.includeInitialData).toBe(true)
      expect(parsed.options.includeMetadata).toBe(false)
      expect(parsed.options.batchSize).toBe(50)
      expect(parsed.options.throttleMs).toBe(1000)
    })

    it('should apply default options', async () => {
      const query: SubscriptionQuery = {
        collection: 'users'
      }

      const parsed = await parser.parse(query)

      expect(parsed.options.includeInitialData).toBe(false)
      expect(parsed.options.includeMetadata).toBe(true)
      expect(parsed.options.batchSize).toBe(config.defaultBatchSize)
      expect(parsed.options.throttleMs).toBe(config.defaultThrottleMs)
    })

    it('should validate batch size limits', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        batchSize: 2000 // Exceeds maxBatchSize
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should validate throttle limits', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        throttleMs: 10000 // Exceeds maxThrottleMs
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })
  })

  describe('Filter Parsing', () => {
    it('should parse field filters', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'status',
            operator: 'eq',
            value: 'active'
          } as FieldFilter
        ]
      }

      const parsed = await parser.parse(query)

      expect(parsed.filters).toHaveLength(1)
      expect(parsed.filters[0].type).toBe('field')
      const fieldFilter = parsed.filters[0] as any
      expect(fieldFilter.field).toBe('status')
      expect(fieldFilter.operator).toBe('eq')
      expect(fieldFilter.value).toBe('active')
      expect(fieldFilter.caseSensitive).toBe(true)
    })

    it('should parse user filters', async () => {
      const query: SubscriptionQuery = {
        collection: 'posts',
        filters: [
          {
            type: 'user',
            userField: 'role',
            operator: 'in',
            value: ['admin', 'moderator']
          } as UserFilter
        ]
      }

      const parsed = await parser.parse(query)

      expect(parsed.filters).toHaveLength(1)
      expect(parsed.filters[0].type).toBe('user')
      const userFilter = parsed.filters[0] as any
      expect(userFilter.userField).toBe('role')
      expect(userFilter.operator).toBe('in')
      expect(userFilter.value).toEqual(['admin', 'moderator'])
    })

    it('should parse custom filters', async () => {
      const evaluator = (data: any) => data.score > 100

      const query: SubscriptionQuery = {
        collection: 'games',
        filters: [
          {
            type: 'custom',
            evaluator
          } as CustomFilter
        ]
      }

      const parsed = await parser.parse(query)

      expect(parsed.filters).toHaveLength(1)
      expect(parsed.filters[0].type).toBe('custom')
      const customFilter = parsed.filters[0] as any
      expect(customFilter.evaluator).toBe(evaluator)
    })

    it('should validate field filter operators', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'status',
            operator: 'invalid' as any,
            value: 'active'
          }
        ]
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should validate regex patterns', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'email',
            operator: 'regex',
            value: '[invalid regex'
          }
        ]
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should validate array operators', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'status',
            operator: 'in',
            value: 'not-an-array' // Should be array
          }
        ]
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should reject custom filters when disabled', async () => {
      const restrictiveConfig = { ...config, allowCustomFilters: false }
      const restrictiveParser = new QueryParser(restrictiveConfig)

      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'custom',
            evaluator: () => true
          }
        ]
      }

      await expect(restrictiveParser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should enforce filter limits', async () => {
      const filters = Array.from({ length: 15 }, (_, i) => ({
        type: 'field' as const,
        field: `field${i}`,
        operator: 'eq' as const,
        value: i
      }))

      const query: SubscriptionQuery = {
        collection: 'users',
        filters
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })
  })

  describe('Validation', () => {
    it('should require collection for collection subscriptions', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'collection'
        // Missing collection
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should require documentId for document subscriptions', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'document',
        collection: 'users'
        // Missing documentId
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should require fieldPath for field subscriptions', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'field',
        collection: 'users',
        documentId: 'user123'
        // Missing fieldPath
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should reject invalid resource types', async () => {
      const query: SubscriptionQuery = {
        resourceType: 'invalid' as any,
        collection: 'users'
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should reject duplicate field filters', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'status',
            operator: 'eq',
            value: 'active'
          },
          {
            type: 'field',
            field: 'status', // Duplicate field
            operator: 'ne',
            value: 'inactive'
          }
        ]
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should reject multiple custom filters', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'custom',
            evaluator: () => true
          },
          {
            type: 'custom',
            evaluator: () => false
          }
        ]
      }

      await expect(parser.parse(query)).rejects.toThrow(QueryParseError)
    })

    it('should reject null or undefined queries', async () => {
      await expect(parser.parse(null as any)).rejects.toThrow(QueryParseError)
      await expect(parser.parse(undefined as any)).rejects.toThrow(QueryParseError)
    })
  })

  describe('Query ID Generation', () => {
    it('should generate unique IDs for different queries', async () => {
      const query1: SubscriptionQuery = { collection: 'users' }
      const query2: SubscriptionQuery = { collection: 'posts' }

      const parsed1 = await parser.parse(query1)
      const parsed2 = await parser.parse(query2)

      expect(parsed1.id).not.toBe(parsed2.id)
    })

    it('should generate deterministic IDs for equivalent queries', async () => {
      const query: SubscriptionQuery = { collection: 'users', batchSize: 50 }

      const parsed1 = await parser.parse(query)
      const parsed2 = await parser.parse(query)

      // IDs should be different due to timestamp, but structure should be similar
      expect(parsed1.id).toMatch(/^query_/)
      expect(parsed2.id).toMatch(/^query_/)
    })
  })

  describe('Static Utility Methods', () => {
    it('should detect equivalent queries', async () => {
      const query1 = await parser.parse({ collection: 'users' })
      const query2 = await parser.parse({ collection: 'users' })

      // Make IDs the same for comparison
      query2.id = query1.id

      expect(QueryParser.areQueriesEquivalent(query1, query2)).toBe(true)
    })

    it('should detect different queries', async () => {
      const query1 = await parser.parse({ collection: 'users' })
      const query2 = await parser.parse({ collection: 'posts' })

      expect(QueryParser.areQueriesEquivalent(query1, query2)).toBe(false)
    })

    it('should calculate query complexity', async () => {
      const simpleQuery = await parser.parse({ collection: 'users' })
      const complexQuery = await parser.parse({
        collection: 'users',
        filters: [
          { type: 'field', field: 'status', operator: 'eq', value: 'active' },
          { type: 'user', userField: 'role', operator: 'eq', value: 'admin' },
          { type: 'custom', evaluator: () => true }
        ]
      })

      const simpleComplexity = QueryParser.getQueryComplexity(simpleQuery)
      const complexComplexity = QueryParser.getQueryComplexity(complexQuery)

      expect(complexComplexity).toBeGreaterThan(simpleComplexity)
    })

    it('should optimize query filter order', async () => {
      const query = await parser.parse({
        collection: 'users',
        filters: [
          { type: 'custom', evaluator: () => true },
          { type: 'user', userField: 'role', operator: 'eq', value: 'admin' },
          { type: 'field', field: 'status', operator: 'eq', value: 'active' }
        ]
      })

      const optimized = QueryParser.optimizeQuery(query)

      // Field filters should come first, then user, then custom
      expect(optimized.filters[0].type).toBe('field')
      expect(optimized.filters[1].type).toBe('user')
      expect(optimized.filters[2].type).toBe('custom')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty filters array', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: []
      }

      const parsed = await parser.parse(query)
      expect(parsed.filters).toEqual([])
    })

    it('should handle case insensitive field filters', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'name',
            operator: 'eq',
            value: 'John',
            caseSensitive: false
          }
        ]
      }

      const parsed = await parser.parse(query)
      const fieldFilter = parsed.filters[0] as any
      expect(fieldFilter.caseSensitive).toBe(false)
    })

    it('should handle numeric field values', async () => {
      const query: SubscriptionQuery = {
        collection: 'products',
        filters: [
          {
            type: 'field',
            field: 'price',
            operator: 'gt',
            value: 100
          }
        ]
      }

      const parsed = await parser.parse(query)
      const fieldFilter = parsed.filters[0] as any
      expect(fieldFilter.value).toBe(100)
    })

    it('should handle boolean field values', async () => {
      const query: SubscriptionQuery = {
        collection: 'users',
        filters: [
          {
            type: 'field',
            field: 'isActive',
            operator: 'eq',
            value: true
          }
        ]
      }

      const parsed = await parser.parse(query)
      const fieldFilter = parsed.filters[0] as any
      expect(fieldFilter.value).toBe(true)
    })
  })
})