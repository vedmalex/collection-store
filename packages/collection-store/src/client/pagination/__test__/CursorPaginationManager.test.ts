/**
 * Phase 5: Client Integration - CursorPaginationManager Tests
 *
 * Comprehensive tests for cursor-based pagination functionality
 */

import { CursorPaginationManager } from '../../../client/pagination/CursorPaginationManager'
import { SortConfig, PaginationConfig, CursorInfo } from '../../../client/pagination/interfaces/types'

describe('CursorPaginationManager', () => {
  let paginationManager: CursorPaginationManager

  beforeEach(() => {
    paginationManager = new CursorPaginationManager()
  })

  describe('encodeCursor', () => {
    it('should encode cursor in simple_id format', () => {
      const sortValues = ['Alice', 25]
      const documentId = 'doc123'
      const options = { format: 'simple_id' as const }

      const cursor = paginationManager.encodeCursor(sortValues, documentId, options)

      expect(cursor).toBe('doc123')
    })

    it('should encode cursor in base64_json format', () => {
      const sortValues = ['Alice', 25]
      const documentId = 'doc123'
      const options = { format: 'base64_json' as const, includeTimestamp: false }

      const cursor = paginationManager.encodeCursor(sortValues, documentId, options)

      // Decode to verify structure
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
      expect(decoded).toEqual({
        sortValues: ['Alice', 25],
        documentId: 'doc123',
        timestamp: 0
      })
    })

    it('should include timestamp by default in base64_json format', () => {
      const sortValues = ['Alice', 25]
      const documentId = 'doc123'
      const options = { format: 'base64_json' as const }

      const cursor = paginationManager.encodeCursor(sortValues, documentId, options)

      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
      expect(decoded.timestamp).toBeGreaterThan(0)
      expect(decoded.sortValues).toEqual(['Alice', 25])
      expect(decoded.documentId).toBe('doc123')
    })

    it('should default to base64_json format when no options provided', () => {
      const sortValues = ['Alice', 25]
      const documentId = 'doc123'

      const cursor = paginationManager.encodeCursor(sortValues, documentId)

      // Should be base64 encoded
      expect(() => {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
        expect(decoded.sortValues).toEqual(['Alice', 25])
        expect(decoded.documentId).toBe('doc123')
      }).not.toThrow()
    })
  })

  describe('decodeCursor', () => {
    it('should decode simple_id format cursor', () => {
      const cursor = 'doc123'

      const decoded = paginationManager.decodeCursor(cursor)

      expect(decoded).toEqual({
        sortValues: [],
        documentId: 'doc123',
        timestamp: 0
      })
    })

    it('should decode base64_json format cursor', () => {
      const cursorData: CursorInfo = {
        sortValues: ['Alice', 25],
        documentId: 'doc123',
        timestamp: 1234567890
      }
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString('base64')

      const decoded = paginationManager.decodeCursor(cursor)

      expect(decoded).toEqual(cursorData)
    })

    it('should handle invalid base64 as simple_id', () => {
      const cursor = 'not-valid-base64!'

      const decoded = paginationManager.decodeCursor(cursor)

      expect(decoded).toEqual({
        sortValues: [],
        documentId: 'not-valid-base64!',
        timestamp: 0
      })
    })

    it('should handle malformed JSON as simple_id', () => {
      const cursor = Buffer.from('invalid json').toString('base64')

      const decoded = paginationManager.decodeCursor(cursor)

      expect(decoded).toEqual({
        sortValues: [],
        documentId: cursor,
        timestamp: 0
      })
    })

    it('should throw error for empty cursor', () => {
      expect(() => {
        paginationManager.decodeCursor('')
      }).toThrow('Cursor cannot be empty')
    })
  })

  describe('validateCursor', () => {
    it('should validate simple_id cursor', () => {
      const cursor = 'doc123'

      expect(paginationManager.validateCursor(cursor)).toBe(true)
    })

    it('should validate base64_json cursor', () => {
      const cursorData: CursorInfo = {
        sortValues: ['Alice', 25],
        documentId: 'doc123',
        timestamp: 1234567890
      }
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString('base64')

      expect(paginationManager.validateCursor(cursor)).toBe(true)
    })

    it('should reject empty cursor', () => {
      expect(paginationManager.validateCursor('')).toBe(false)
    })

    it('should handle any string as valid (fallback to simple_id)', () => {
      expect(paginationManager.validateCursor('any-string')).toBe(true)
    })
  })

  describe('paginate', () => {
    it('should validate collection name', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      await expect(
        paginationManager.paginate('', query, options)
      ).rejects.toThrow('Collection name is required')
    })

    it('should validate limit bounds', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 0,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      await expect(
        paginationManager.paginate('users', query, options)
      ).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should validate limit upper bound', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 1001,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      await expect(
        paginationManager.paginate('users', query, options)
      ).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should validate sort configuration', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 10,
        sort: [{ field: '', direction: 'asc', type: 'string' }], // invalid
        format: 'base64_json'
      }

      await expect(
        paginationManager.paginate('users', query, options)
      ).rejects.toThrow('Invalid sort configuration')
    })

    it('should handle pagination without cursor', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 2,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      // Mock the executeQuery method to return test data
      const mockData = [
        { _id: 'doc1', name: 'Alice', status: 'active' },
        { _id: 'doc2', name: 'Bob', status: 'active' }
      ]

      // @ts-ignore - accessing private method for testing
      jest.spyOn(paginationManager, 'executeQuery').mockResolvedValue(mockData)

      const result = await paginationManager.paginate('users', query, options)

      expect(result.data).toEqual(mockData)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()
      expect(result.totalCount).toBeUndefined()
    })

    it('should handle pagination with hasMore', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 2,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      // Mock the executeQuery method to return limit + 1 items
      const mockData = [
        { _id: 'doc1', name: 'Alice', status: 'active' },
        { _id: 'doc2', name: 'Bob', status: 'active' },
        { _id: 'doc3', name: 'Charlie', status: 'active' } // extra item
      ]

      // @ts-ignore - accessing private method for testing
      jest.spyOn(paginationManager, 'executeQuery').mockResolvedValue(mockData)

      const result = await paginationManager.paginate('users', query, options)

      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual(mockData[0])
      expect(result.data[1]).toEqual(mockData[1])
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBeDefined()
    })

    it('should handle pagination with cursor', async () => {
      const cursorData: CursorInfo = {
        sortValues: ['Bob'],
        documentId: 'doc2',
        timestamp: Date.now()
      }
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString('base64')

      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 2,
        cursor,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const mockData = [
        { _id: 'doc3', name: 'Charlie', status: 'active' },
        { _id: 'doc4', name: 'David', status: 'active' }
      ]

      // @ts-ignore - accessing private method for testing
      jest.spyOn(paginationManager, 'executeQuery').mockResolvedValue(mockData)

      const result = await paginationManager.paginate('users', query, options)

      expect(result.data).toEqual(mockData)
      expect(result.hasMore).toBe(false)
    })

    it('should apply filters to query', async () => {
      const query = { status: 'active' }
      const options: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        filters: { department: 'engineering' },
        format: 'base64_json'
      }

      const mockData: any[] = []
      const executeQuerySpy = jest.spyOn(paginationManager as any, 'executeQuery').mockResolvedValue(mockData)

      await paginationManager.paginate('users', query, options)

      // Verify that filters were applied to the query
      const calledQuery = executeQuerySpy.mock.calls[0][1] as Record<string, any>
      expect(calledQuery.department).toBe('engineering')
    })
  })

  describe('optimizePaginationQuery', () => {
    it('should apply index hints when enabled', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const optimizationOptions = { useIndexHints: true }

      const optimized = paginationManager.optimizePaginationQuery(query, config, optimizationOptions)

      expect(optimized.$hint).toBeDefined()
      expect(Array.isArray(optimized.$hint)).toBe(true)
    })

    it('should apply maxScanDocuments limit', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const optimizationOptions = { maxScanDocuments: 1000 }

      const optimized = paginationManager.optimizePaginationQuery(query, config, optimizationOptions)

      expect(optimized.$maxScan).toBe(1000)
    })

    it('should apply preferred indexes', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }
      const optimizationOptions = { preferredIndexes: ['name_1', 'status_1'] }

      const optimized = paginationManager.optimizePaginationQuery(query, config, optimizationOptions)

      expect(optimized.$hint).toEqual(['name_1', 'status_1'])
    })

    it('should not modify query when no optimization options provided', () => {
      const query = { status: 'active' }
      const config: PaginationConfig = {
        limit: 10,
        sort: [{ field: 'name', direction: 'asc', type: 'string' }],
        format: 'base64_json'
      }

      const optimized = paginationManager.optimizePaginationQuery(query, config)

      expect(optimized).toEqual(query)
    })
  })

  describe('cursor conditions', () => {
    it('should handle simple_id cursor conditions', () => {
      const query = { status: 'active' }
      const cursorInfo: CursorInfo = {
        sortValues: [],
        documentId: 'doc123',
        timestamp: 0
      }
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' }
      ]

      // @ts-ignore - accessing private method for testing
      const result = paginationManager.applyCursorConditions(query, cursorInfo, sortConfig)

      expect(result).toEqual({
        status: 'active',
        _id: { $gt: 'doc123' }
      })
    })

    it('should handle multi-field cursor conditions', () => {
      const query = { status: 'active' }
      const cursorInfo: CursorInfo = {
        sortValues: ['Bob', 30],
        documentId: 'doc123',
        timestamp: Date.now()
      }
      const sortConfig: SortConfig[] = [
        { field: 'name', direction: 'asc', type: 'string' },
        { field: 'age', direction: 'desc', type: 'number' }
      ]

      // @ts-ignore - accessing private method for testing
      const result = paginationManager.applyCursorConditions(query, cursorInfo, sortConfig)

      expect(result.status).toBe('active')
      expect(result.$or).toBeDefined()
      expect(Array.isArray(result.$or)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle missing document ID extraction', () => {
      const item = { name: 'Alice' } // no _id or id field

      // @ts-ignore - accessing private method for testing
      const documentId = paginationManager.extractDocumentId(item)

      expect(documentId).toBe('[object Object]') // String conversion fallback
    })

    it('should handle nested field extraction', () => {
      const item = {
        user: {
          profile: {
            name: 'Alice'
          }
        }
      }
      const sortConfig: SortConfig[] = [
        { field: 'user.profile.name', direction: 'asc', type: 'string' }
      ]

      // @ts-ignore - accessing private method for testing
      const sortValues = paginationManager.extractSortValues(item, sortConfig)

      expect(sortValues).toEqual(['Alice'])
    })

    it('should handle missing nested fields', () => {
      const item = {
        user: {} // missing profile
      }
      const sortConfig: SortConfig[] = [
        { field: 'user.profile.name', direction: 'asc', type: 'string' }
      ]

      // @ts-ignore - accessing private method for testing
      const sortValues = paginationManager.extractSortValues(item, sortConfig)

      expect(sortValues).toEqual([undefined])
    })
  })
})