/**
 * FileMetadataManager Tests
 * Phase 4: File Storage System - Metadata Management Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../CSDatabase'
import { FileMetadataManager } from '../core/FileMetadataManager'
import { FileMetadata, FileListFilters, FileSearchQuery } from '../interfaces/types'
import { FileNotFoundError, FileValidationError } from '../interfaces/errors'

describe('FileMetadataManager', () => {
  let database: CSDatabase
  let metadataManager: FileMetadataManager
  let testMetadata: FileMetadata

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new CSDatabase(':memory:', 'test-file-metadata')
    await database.connect()

    // Initialize metadata manager
    metadataManager = new FileMetadataManager(database, {
      collectionName: 'test_file_metadata',
      enableIndexing: true,
      enableCaching: true,
      cacheSize: 100,
      ttl: 60000 // 1 minute for testing
    })

    await metadataManager.initialize()

    // Create test metadata
    testMetadata = {
      id: 'test-file-123',
      filename: 'test-file.txt',
      originalName: 'test-file.txt',
      mimeType: 'text/plain',
      size: 1024,
      checksum: 'sha256:abcd1234',
      backend: 'local',
      storagePath: '/files/test-file.txt',
      access: 'private',
      ownerId: 'user1',
      permissions: [],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      thumbnails: [],
      replicationNodes: [],
      replicationStatus: 'completed'
    }
  })

  afterEach(async () => {
    await metadataManager.shutdown()
    await database.close()
  })

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully', async () => {
      const newManager = new FileMetadataManager(database)
      await newManager.initialize()

      expect(newManager).toBeDefined()
      await newManager.shutdown()
    })

    it('should handle multiple initialization calls', async () => {
      await metadataManager.initialize()
      await metadataManager.initialize() // Should not throw

      expect(metadataManager).toBeDefined()
    })

    it('should shutdown gracefully', async () => {
      await metadataManager.shutdown()

      // Should throw error when trying to use after shutdown
      await expect(metadataManager.create(testMetadata))
        .rejects.toThrow('File metadata manager not initialized')
    })
  })

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create file metadata successfully', async () => {
        const result = await metadataManager.create(testMetadata)

        expect(result).toEqual(testMetadata)
        expect(result.id).toBe(testMetadata.id)
        expect(result.filename).toBe(testMetadata.filename)
      })

      it('should reject invalid metadata', async () => {
        const invalidMetadata = { ...testMetadata, id: '' } // Missing required field

        await expect(metadataManager.create(invalidMetadata as FileMetadata))
          .rejects.toThrow(FileValidationError)
      })

      it('should validate required fields', async () => {
        const requiredFields = [
          'id', 'filename', 'originalName', 'mimeType', 'size',
          'checksum', 'backend', 'storagePath', 'access', 'ownerId'
        ]

        for (const field of requiredFields) {
          const invalidMetadata = { ...testMetadata }
          delete (invalidMetadata as any)[field]

          await expect(metadataManager.create(invalidMetadata as FileMetadata))
            .rejects.toThrow(FileValidationError)
        }
      })

      it('should validate access levels', async () => {
        const invalidMetadata = { ...testMetadata, access: 'invalid' as any }

        await expect(metadataManager.create(invalidMetadata))
          .rejects.toThrow(FileValidationError)
      })

      it('should validate file size', async () => {
        const invalidMetadata = { ...testMetadata, size: -1 }

        await expect(metadataManager.create(invalidMetadata))
          .rejects.toThrow(FileValidationError)
      })
    })

    describe('Read', () => {
      beforeEach(async () => {
        await metadataManager.create(testMetadata)
      })

      it('should retrieve file metadata by ID', async () => {
        const result = await metadataManager.get(testMetadata.id)

        expect(result).toEqual(testMetadata)
      })

      it('should return null for non-existent file', async () => {
        const result = await metadataManager.get('non-existent-id')

        expect(result).toBeNull()
      })

      it('should use getRequired for mandatory retrieval', async () => {
        const result = await metadataManager.getRequired(testMetadata.id)

        expect(result).toEqual(testMetadata)
      })

      it('should throw FileNotFoundError for getRequired with non-existent file', async () => {
        await expect(metadataManager.getRequired('non-existent-id'))
          .rejects.toThrow(FileNotFoundError)
      })

      it('should use cache for repeated reads', async () => {
        // First read - from database
        const result1 = await metadataManager.get(testMetadata.id)

        // Second read - should use cache
        const result2 = await metadataManager.get(testMetadata.id)

        expect(result1).toEqual(result2)
      })
    })

    describe('Update', () => {
      beforeEach(async () => {
        await metadataManager.create(testMetadata)
      })

      it('should update file metadata', async () => {
        const updates = {
          filename: 'updated-file.txt',
          size: 2048
        }

        const result = await metadataManager.update(testMetadata.id, updates)

        expect(result.filename).toBe(updates.filename)
        expect(result.size).toBe(updates.size)
        expect(result.id).toBe(testMetadata.id) // ID should not change
        expect(result.updatedAt).toBeInstanceOf(Date)
      })

      it('should prevent ID changes', async () => {
        const updates = { id: 'new-id' }

        const result = await metadataManager.update(testMetadata.id, updates)

        expect(result.id).toBe(testMetadata.id) // Original ID preserved
      })

      it('should validate updated metadata', async () => {
        const invalidUpdates = { access: 'invalid' as any }

        await expect(metadataManager.update(testMetadata.id, invalidUpdates))
          .rejects.toThrow(FileValidationError)
      })

      it('should throw FileNotFoundError for non-existent file', async () => {
        await expect(metadataManager.update('non-existent-id', { filename: 'test' }))
          .rejects.toThrow(FileNotFoundError)
      })

      it('should update cache after update', async () => {
        const updates = { filename: 'cached-update.txt' }

        await metadataManager.update(testMetadata.id, updates)
        const cached = await metadataManager.get(testMetadata.id)

        expect(cached?.filename).toBe(updates.filename)
      })
    })

    describe('Delete', () => {
      beforeEach(async () => {
        await metadataManager.create(testMetadata)
      })

      it('should delete file metadata', async () => {
        await metadataManager.delete(testMetadata.id)

        const result = await metadataManager.get(testMetadata.id)
        expect(result).toBeNull()
      })

      it('should throw FileNotFoundError for non-existent file', async () => {
        await expect(metadataManager.delete('non-existent-id'))
          .rejects.toThrow(FileNotFoundError)
      })

      it('should remove from cache after deletion', async () => {
        // Ensure it's cached
        await metadataManager.get(testMetadata.id)

        await metadataManager.delete(testMetadata.id)

        const result = await metadataManager.get(testMetadata.id)
        expect(result).toBeNull()
      })
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create multiple test files
      const files = [
        { ...testMetadata, id: 'file1', ownerId: 'user1', mimeType: 'text/plain', size: 100 },
        { ...testMetadata, id: 'file2', ownerId: 'user1', mimeType: 'image/jpeg', size: 200 },
        { ...testMetadata, id: 'file3', ownerId: 'user2', mimeType: 'text/plain', size: 300 },
                 { ...testMetadata, id: 'file4', ownerId: 'user2', mimeType: 'application/pdf', size: 400, access: 'public' as const }
      ]

      for (const file of files) {
        await metadataManager.create(file)
      }
    })

    describe('List', () => {
      it('should list all files without filters', async () => {
        const result = await metadataManager.list()

        expect(result.length).toBe(4)
      })

      it('should filter by owner', async () => {
        const result = await metadataManager.list({ ownerId: 'user1' })

        expect(result.length).toBe(2)
        expect(result.every(f => f.ownerId === 'user1')).toBe(true)
      })

      it('should filter by MIME type', async () => {
        const result = await metadataManager.list({ mimeType: 'text/plain' })

        expect(result.length).toBe(2)
        expect(result.every(f => f.mimeType === 'text/plain')).toBe(true)
      })

      it('should filter by access level', async () => {
        const result = await metadataManager.list({ access: 'public' })

        expect(result.length).toBe(1)
        expect(result[0].access).toBe('public')
      })

      it('should filter by size range', async () => {
        const result = await metadataManager.list({ minSize: 150, maxSize: 350 })

        expect(result.length).toBe(2)
        expect(result.every(f => f.size >= 150 && f.size <= 350)).toBe(true)
      })

      it('should apply pagination', async () => {
        const page1 = await metadataManager.list({ limit: 2, offset: 0 })
        const page2 = await metadataManager.list({ limit: 2, offset: 2 })

        expect(page1.length).toBe(2)
        expect(page2.length).toBe(2)
        expect(page1[0].id).not.toBe(page2[0].id)
      })

      it('should sort by size descending', async () => {
        const result = await metadataManager.list({
          sortBy: 'size',
          sortOrder: 'desc'
        })

        expect(result.length).toBe(4)
        expect(result[0].size).toBe(400)
        expect(result[1].size).toBe(300)
        expect(result[2].size).toBe(200)
        expect(result[3].size).toBe(100)
      })

      it('should combine multiple filters', async () => {
        const result = await metadataManager.list({
          ownerId: 'user1',
          mimeType: 'text/plain',
          maxSize: 150
        })

        expect(result.length).toBe(1)
        expect(result[0].id).toBe('file1')
      })
    })

    describe('Search', () => {
      it('should search by filename', async () => {
        const query: FileSearchQuery = { filename: 'test-file' }
        const result = await metadataManager.search(query)

        expect(result.length).toBe(4)
      })

      it('should search by MIME type', async () => {
        const query: FileSearchQuery = { mimeType: 'image/jpeg' }
        const result = await metadataManager.search(query)

        expect(result.length).toBe(1)
        expect(result[0].mimeType).toBe('image/jpeg')
      })

      it('should search by owner', async () => {
        const query: FileSearchQuery = { ownerId: 'user2' }
        const result = await metadataManager.search(query)

        expect(result.length).toBe(2)
        expect(result.every(f => f.ownerId === 'user2')).toBe(true)
      })

      it('should search by size range', async () => {
        const query: FileSearchQuery = {
          sizeRange: { min: 200, max: 300 }
        }
        const result = await metadataManager.search(query)

        expect(result.length).toBe(2)
        expect(result.every(f => f.size >= 200 && f.size <= 300)).toBe(true)
      })

      it('should search by date range', async () => {
        const query: FileSearchQuery = {
          dateRange: {
            start: new Date('2023-12-31'),
            end: new Date('2024-01-02')
          }
        }
        const result = await metadataManager.search(query)

        expect(result.length).toBe(4) // All files created on 2024-01-01
      })
    })

    describe('Count', () => {
      it('should count all files', async () => {
        const count = await metadataManager.count()

        expect(count).toBe(4)
      })

      it('should count with filters', async () => {
        const count = await metadataManager.count({ ownerId: 'user1' })

        expect(count).toBe(2)
      })
    })
  })

  describe('Utility Operations', () => {
    beforeEach(async () => {
      const now = new Date()
      const expired = new Date(now.getTime() - 86400000) // 1 day ago
      const future = new Date(now.getTime() + 86400000) // 1 day from now

      const files = [
        { ...testMetadata, id: 'expired1', expiresAt: expired },
        { ...testMetadata, id: 'expired2', expiresAt: expired },
        { ...testMetadata, id: 'active1', expiresAt: future },
        { ...testMetadata, id: 'permanent1' } // No expiration
      ]

      for (const file of files) {
        await metadataManager.create(file)
      }
    })

    it('should get expired files', async () => {
      const expired = await metadataManager.getExpiredFiles()

      expect(expired.length).toBe(2)
      expect(expired.every(f => f.id.startsWith('expired'))).toBe(true)
    })

    it('should get files by owner', async () => {
      const files = await metadataManager.getFilesByOwner('user1', 2)

      expect(files.length).toBe(2)
      expect(files.every(f => f.ownerId === 'user1')).toBe(true)
    })

    it('should get files by MIME type', async () => {
      const files = await metadataManager.getFilesByMimeType('text/plain', 3)

      expect(files.length).toBe(3)
      expect(files.every(f => f.mimeType === 'text/plain')).toBe(true)
    })

    it('should get recent files', async () => {
      const recent = await metadataManager.getRecentFiles(2)

      expect(recent.length).toBe(2)
    })

    it('should get largest files', async () => {
      const largest = await metadataManager.getLargestFiles(2)

      expect(largest.length).toBe(2)
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      const files = [
                 { ...testMetadata, id: 'stat1', mimeType: 'text/plain', size: 100, access: 'public' as const },
         { ...testMetadata, id: 'stat2', mimeType: 'text/plain', size: 200, access: 'private' as const },
         { ...testMetadata, id: 'stat3', mimeType: 'image/jpeg', size: 300, access: 'public' as const },
         { ...testMetadata, id: 'stat4', mimeType: 'application/pdf', size: 400, access: 'private' as const }
      ]

      for (const file of files) {
        await metadataManager.create(file)
      }
    })

    it('should calculate storage statistics', async () => {
      const stats = await metadataManager.getStorageStats()

      expect(stats.totalFiles).toBe(4)
      expect(stats.totalSize).toBe(1000)
      expect(stats.averageFileSize).toBe(250)

      expect(stats.filesByType['text/plain']).toBe(2)
      expect(stats.filesByType['image/jpeg']).toBe(1)
      expect(stats.filesByType['application/pdf']).toBe(1)

      expect(stats.filesByAccess['public']).toBe(2)
      expect(stats.filesByAccess['private']).toBe(2)
    })

    it('should handle empty collection statistics', async () => {
      // Create new manager with empty collection
      const emptyDatabase = new CSDatabase(':memory:', 'empty-test')
      await emptyDatabase.connect()

      const emptyManager = new FileMetadataManager(emptyDatabase, {
        collectionName: 'empty_metadata',
        enableIndexing: false,
        enableCaching: false,
        cacheSize: 10,
        ttl: 1000
      })

      await emptyManager.initialize()

      const stats = await emptyManager.getStorageStats()

      expect(stats.totalFiles).toBe(0)
      expect(stats.totalSize).toBe(0)
      expect(stats.averageFileSize).toBe(0)
      expect(Object.keys(stats.filesByType)).toHaveLength(0)
      expect(Object.keys(stats.filesByAccess)).toHaveLength(0)

      await emptyManager.shutdown()
      await emptyDatabase.close()
    })
  })

  describe('Caching', () => {
    it('should cache metadata after retrieval', async () => {
      await metadataManager.create(testMetadata)

      // First retrieval - from database
      const result1 = await metadataManager.get(testMetadata.id)

      // Second retrieval - should use cache
      const result2 = await metadataManager.get(testMetadata.id)

      expect(result1).toEqual(result2)
    })

    it('should update cache after metadata update', async () => {
      await metadataManager.create(testMetadata)

      const updates = { filename: 'cached-file.txt' }
      await metadataManager.update(testMetadata.id, updates)

      const cached = await metadataManager.get(testMetadata.id)
      expect(cached?.filename).toBe(updates.filename)
    })

    it('should remove from cache after deletion', async () => {
      await metadataManager.create(testMetadata)

      // Cache the item
      await metadataManager.get(testMetadata.id)

      // Delete and verify cache is cleared
      await metadataManager.delete(testMetadata.id)

      const result = await metadataManager.get(testMetadata.id)
      expect(result).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const badDatabase = new CSDatabase('/invalid/path', 'bad-db')
      const badManager = new FileMetadataManager(badDatabase)

      // Should handle initialization errors
      await expect(badManager.initialize()).rejects.toThrow()
    })

    it('should emit events for operations', async () => {
      let createdEvent: any = null
      let updatedEvent: any = null
      let deletedEvent: any = null

      metadataManager.on('metadata_created', (event) => { createdEvent = event })
      metadataManager.on('metadata_updated', (event) => { updatedEvent = event })
      metadataManager.on('metadata_deleted', (event) => { deletedEvent = event })

      // Test create event
      await metadataManager.create(testMetadata)
      expect(createdEvent).toBeTruthy()
      expect(createdEvent.fileId).toBe(testMetadata.id)

      // Test update event
      await metadataManager.update(testMetadata.id, { filename: 'updated.txt' })
      expect(updatedEvent).toBeTruthy()
      expect(updatedEvent.fileId).toBe(testMetadata.id)

      // Test delete event
      await metadataManager.delete(testMetadata.id)
      expect(deletedEvent).toBeTruthy()
      expect(deletedEvent.fileId).toBe(testMetadata.id)
    })
  })

  describe('Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const bulkFiles = Array.from({ length: 100 }, (_, i) => ({
        ...testMetadata,
        id: `bulk-file-${i}`,
        filename: `bulk-file-${i}.txt`,
        size: i * 10
      }))

      const startTime = performance.now()

      // Create all files
      for (const file of bulkFiles) {
        await metadataManager.create(file)
      }

      const createTime = performance.now() - startTime

      // Query all files
      const queryStart = performance.now()
      const allFiles = await metadataManager.list()
      const queryTime = performance.now() - queryStart

      expect(allFiles.length).toBe(100)
      expect(createTime).toBeLessThan(5000) // Should complete in under 5 seconds
      expect(queryTime).toBeLessThan(1000) // Query should be fast
    })

    it('should handle concurrent operations', async () => {
      const concurrentFiles = Array.from({ length: 10 }, (_, i) => ({
        ...testMetadata,
        id: `concurrent-file-${i}`,
        filename: `concurrent-file-${i}.txt`
      }))

      const startTime = performance.now()

      // Create files concurrently
      const createPromises = concurrentFiles.map(file =>
        metadataManager.create(file)
      )

      const results = await Promise.all(createPromises)
      const endTime = performance.now()

      expect(results.length).toBe(10)
      expect(results.every(r => r !== null)).toBe(true)
      expect(endTime - startTime).toBeLessThan(2000) // Should be faster than sequential
    })
  })
})