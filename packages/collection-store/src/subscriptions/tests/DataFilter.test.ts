/**
 * Tests for DataFilter
 * Phase 3: Real-time Subscriptions & Notifications
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { DataFilter } from '../core/DataFilter'
import type { User } from '../../auth/interfaces/types'
import type {
  DataChange,
  ParsedSubscriptionQuery,
  DataFilterConfig,
  ParsedFieldFilter,
  ParsedUserFilter,
  ParsedCustomFilter
} from '../interfaces/types'

// Mock AuthorizationEngine
class MockAuthorizationEngine {
  async checkPermission(user: User, resource: any, action: string, context?: any) {
    // Allow all permissions for testing
    return { allowed: true, reason: 'test' }
  }
}

describe('DataFilter', () => {
  let filter: DataFilter
  let config: DataFilterConfig
  let mockAuthEngine: MockAuthorizationEngine

  beforeEach(() => {
    config = {
      enableCaching: true,
      cacheTTL: 300,
      maxCacheSize: 1000
    }
    mockAuthEngine = new MockAuthorizationEngine()
    filter = new DataFilter(config, mockAuthEngine as any)
  })

  describe('Scope Matching', () => {
         it('should match collection-level changes', async () => {
       const change: DataChange = {
         id: 'change1',
         operation: 'insert',
         resourceType: 'collection',
         database: 'testdb',
         collection: 'users',
         documentId: 'user123',
         data: { name: 'John', email: 'john@example.com' },
         timestamp: Date.now()
       }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
      expect(result?.collection).toBe('users')
    })

    it('should match document-level changes', async () => {
      const change: DataChange = {
        operation: 'update',
        collection: 'users',
        documentId: 'user123',
        data: { name: 'John Updated' },
        previousData: { name: 'John' },
        timestamp: Date.now()
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'document',
        collection: 'users',
        documentId: 'user123',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
      expect(result?.documentId).toBe('user123')
    })

    it('should match field-level changes', async () => {
      const change: DataChange = {
        operation: 'update',
        collection: 'users',
        documentId: 'user123',
        data: { profile: { name: 'John Updated' } },
        affectedFields: ['profile.name'],
        timestamp: Date.now()
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'field',
        collection: 'users',
        documentId: 'user123',
        fieldPath: 'profile.name',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
      expect(result?.affectedFields).toContain('profile.name')
    })

    it('should not match different collections', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'posts',
        documentId: 'post123',
        data: { title: 'Test Post' },
        timestamp: Date.now()
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })

    it('should not match different documents', async () => {
      const change: DataChange = {
        operation: 'update',
        collection: 'users',
        documentId: 'user456',
        data: { name: 'Jane' },
        timestamp: Date.now()
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'document',
        collection: 'users',
        documentId: 'user123',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })

    it('should not match different fields', async () => {
      const change: DataChange = {
        operation: 'update',
        collection: 'users',
        documentId: 'user123',
        data: { email: 'newemail@example.com' },
        affectedFields: ['email'],
        timestamp: Date.now()
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'field',
        collection: 'users',
        documentId: 'user123',
        fieldPath: 'profile.name',
        filters: [],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })
  })

  describe('Field Filters', () => {
    it('should apply equality field filter', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { status: 'active', name: 'John' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'status',
        operator: 'eq',
        value: 'active',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should reject non-matching field filter', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { status: 'inactive', name: 'John' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'status',
        operator: 'eq',
        value: 'active',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })

    it('should apply numeric comparison filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'products',
        documentId: 'product123',
        data: { price: 150, name: 'Product A' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'price',
        operator: 'gt',
        value: 100,
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'products',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should apply array inclusion filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { role: 'admin', name: 'John' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'role',
        operator: 'in',
        value: ['admin', 'moderator'],
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should apply regex filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { email: 'john@example.com', name: 'John' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'email',
        operator: 'regex',
        value: '.*@example\\.com$',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should handle case insensitive filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { name: 'JOHN', status: 'active' },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'name',
        operator: 'eq',
        value: 'john',
        caseSensitive: false
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should handle nested field paths', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: {
          profile: {
            personal: {
              name: 'John'
            }
          }
        },
        timestamp: Date.now()
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'profile.personal.name',
        operator: 'eq',
        value: 'John',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })
  })

  describe('User Filters', () => {
    it('should apply user field filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'posts',
        documentId: 'post123',
        data: { title: 'Test Post', content: 'Content' },
        timestamp: Date.now()
      }

      const userFilter: ParsedUserFilter = {
        type: 'user',
        userField: 'roles',
        operator: 'in',
        value: ['user']
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'posts',
        filters: [userFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })
  })

  describe('Custom Filters', () => {
    it('should apply custom filters', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'games',
        documentId: 'game123',
        data: { score: 150, player: 'John' },
        timestamp: Date.now()
      }

      const customFilter: ParsedCustomFilter = {
        type: 'custom',
        evaluator: (data: any) => data.score > 100
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'games',
        filters: [customFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should reject data not passing custom filter', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'games',
        documentId: 'game123',
        data: { score: 50, player: 'John' },
        timestamp: Date.now()
      }

      const customFilter: ParsedCustomFilter = {
        type: 'custom',
        evaluator: (data: any) => data.score > 100
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'games',
        filters: [customFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })
  })

  describe('Multiple Filters', () => {
    it('should apply multiple filters (AND logic)', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { status: 'active', age: 25, name: 'John' },
        timestamp: Date.now()
      }

      const filters = [
        {
          type: 'field' as const,
          field: 'status',
          operator: 'eq' as const,
          value: 'active',
          caseSensitive: true
        },
        {
          type: 'field' as const,
          field: 'age',
          operator: 'gte' as const,
          value: 18,
          caseSensitive: true
        }
      ]

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters,
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).not.toBeNull()
    })

    it('should reject if any filter fails', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { status: 'inactive', age: 25, name: 'John' },
        timestamp: Date.now()
      }

      const filters = [
        {
          type: 'field' as const,
          field: 'status',
          operator: 'eq' as const,
          value: 'active',
          caseSensitive: true
        },
        {
          type: 'field' as const,
          field: 'age',
          operator: 'gte' as const,
          value: 18,
          caseSensitive: true
        }
      ]

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters,
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })
  })

  describe('Batch Filtering', () => {
    it('should filter multiple changes', async () => {
      const changes: DataChange[] = [
        {
          operation: 'create',
          collection: 'users',
          documentId: 'user1',
          data: { status: 'active', name: 'John' },
          timestamp: Date.now()
        },
        {
          operation: 'create',
          collection: 'users',
          documentId: 'user2',
          data: { status: 'inactive', name: 'Jane' },
          timestamp: Date.now()
        },
        {
          operation: 'create',
          collection: 'users',
          documentId: 'user3',
          data: { status: 'active', name: 'Bob' },
          timestamp: Date.now()
        }
      ]

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'status',
        operator: 'eq',
        value: 'active',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const results = await filter.filterChanges(changes, query, 'user1')
      expect(results).toHaveLength(2) // Only active users
      expect(results[0].documentId).toBe('user1')
      expect(results[1].documentId).toBe('user3')
    })
  })

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = filter.getCacheStats()
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('missRate')
      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('memoryUsage')
    })

    it('should clear cache', () => {
      filter.clearCache()
      const stats = filter.getCacheStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing data gracefully', async () => {
      const change: DataChange = {
        operation: 'delete',
        collection: 'users',
        documentId: 'user123',
        timestamp: Date.now()
        // No data field
      }

      const fieldFilter: ParsedFieldFilter = {
        type: 'field',
        field: 'status',
        operator: 'eq',
        value: 'active',
        caseSensitive: true
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [fieldFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })

    it('should handle filter errors gracefully', async () => {
      const change: DataChange = {
        operation: 'create',
        collection: 'users',
        documentId: 'user123',
        data: { name: 'John' },
        timestamp: Date.now()
      }

      const customFilter: ParsedCustomFilter = {
        type: 'custom',
        evaluator: () => {
          throw new Error('Filter error')
        }
      }

      const query: ParsedSubscriptionQuery = {
        id: 'query1',
        resourceType: 'collection',
        collection: 'users',
        filters: [customFilter],
        options: {
          includeInitialData: false,
          includeMetadata: true,
          batchSize: 100,
          throttleMs: 0
        }
      }

      const result = await filter.filterChange(change, query, 'user1')
      expect(result).toBeNull()
    })
  })
})