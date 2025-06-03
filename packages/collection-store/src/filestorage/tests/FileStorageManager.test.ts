/**
 * File Storage Manager Tests
 * Phase 4: File Storage System - Manager Testing
 *
 * Following DEVELOPMENT_RULES.md testing guidelines:
 * - High-granularity tests grouped by functionality
 * - Performance timing with performance.now()
 * - Test context isolation and cleanup
 * - Comprehensive error handling testing
 */

import { FileStorageManager, FileStorageManagerConfig } from '../core/FileStorageManager'
import { LocalFileStorage } from '../backends/LocalFileStorage'
import {
  FileUpload,
  UploadOptions,
  DownloadOptions,
  ThumbnailSize,
  FileMetadata
} from '../interfaces/types'
import {
  FileStorageError,
  FileNotFoundError,
  FileValidationError,
  QuotaExceededError
} from '../interfaces/errors'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('FileStorageManager', () => {
  let manager: FileStorageManager
  let testConfig: FileStorageManagerConfig
  let testDir: string

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, '../../test-data', `test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })

    // Test configuration
    testConfig = {
      backends: {
        default: 'local',
        configs: {
          local: {
            name: 'local',
            type: 'local',
            basePath: testDir
          }
        }
      },
      validation: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['*/*'],
        blockedMimeTypes: ['application/x-executable']
      },
      thumbnails: {
        enabled: true,
        defaultSizes: [
          { width: 150, height: 150 },
          { width: 300, height: 300 }
        ],
        quality: 80
      },
      replication: {
        enabled: false,
        minReplicas: 1,
        preferredNodes: []
      },
      quotas: {
        defaultUserQuota: 100 * 1024 * 1024, // 100MB
        adminQuota: 1024 * 1024 * 1024 // 1GB
      },
      cleanup: {
        expiredFilesCheckInterval: 60000, // 1 minute
        tempFileCleanupInterval: 300000 // 5 minutes
      }
    }

    manager = new FileStorageManager(testConfig)
    await manager.initialize()
  })

  afterEach(async () => {
    // Cleanup
    if (manager) {
      await manager.shutdown()
    }

    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error)
    }
  })

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid config', async () => {
      const newManager = new FileStorageManager(testConfig)

      const startTime = performance.now()
      await newManager.initialize()
      const initTime = performance.now() - startTime

      expect(initTime).toBeLessThan(1000) // Should initialize quickly

      await newManager.shutdown()
    })

    it('should handle multiple initialization calls gracefully', async () => {
      const newManager = new FileStorageManager(testConfig)

      await newManager.initialize()
      await newManager.initialize() // Should not throw

      await newManager.shutdown()
    })

    it('should emit initialization events', async () => {
      const newManager = new FileStorageManager(testConfig)

      let initEventFired = false
      newManager.on('initialized', () => {
        initEventFired = true
      })

      await newManager.initialize()
      expect(initEventFired).toBe(true)

      await newManager.shutdown()
    })

    it('should throw error when using uninitialized manager', async () => {
      const newManager = new FileStorageManager(testConfig)

      const testFile: FileUpload = {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test content'))
            controller.close()
          }
        })
      }

      await expect(newManager.upload(testFile, { access: 'private' }, 'user1'))
        .rejects.toThrow(FileStorageError)
    })
  })

  describe('File Upload Operations', () => {
    it('should upload a simple text file successfully', async () => {
      const testContent = 'Hello, World!'
      const testFile: FileUpload = {
        filename: 'hello.txt',
        mimeType: 'text/plain',
        size: testContent.length,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const uploadOptions: UploadOptions = {
        access: 'private',
        generateThumbnails: false
      }

      const startTime = performance.now()
      const metadata = await manager.upload(testFile, uploadOptions, 'user1')
      const uploadTime = performance.now() - startTime

      expect(metadata).toBeDefined()
      expect(metadata.id).toBeDefined()
      expect(metadata.originalName).toBe('hello.txt')
      expect(metadata.mimeType).toBe('text/plain')
      expect(metadata.size).toBe(testContent.length)
      expect(metadata.ownerId).toBe('user1')
      expect(metadata.access).toBe('private')
      expect(uploadTime).toBeLessThan(1000) // Should upload quickly

      console.log(`Upload completed in ${uploadTime.toFixed(2)}ms`)
    })

    it('should generate file ID and checksum automatically', async () => {
      const testContent = 'test content for checksum'
      const testFile: FileUpload = {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: testContent.length,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(testFile, { access: 'private' }, 'user1')

      expect(metadata.id).toMatch(/^[0-9a-f]{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}$/) // Hybrid ID format
      expect(metadata.checksum).toBeDefined()
      expect(metadata.checksum.length).toBe(64) // SHA256 hex length
    })

    it('should validate file size limits', async () => {
      const largeSize = testConfig.validation.maxFileSize + 1
      const testContent = 'large file'
      const testFile: FileUpload = {
        filename: 'large.txt',
        mimeType: 'text/plain',
        size: largeSize,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      await expect(manager.upload(testFile, { access: 'private' }, 'user1'))
        .rejects.toThrow(FileValidationError)
    })

    it('should validate blocked mime types', async () => {
      const testContent = 'executable'
      const testFile: FileUpload = {
        filename: 'malware.exe',
        mimeType: 'application/x-executable',
        size: testContent.length,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      await expect(manager.upload(testFile, { access: 'private' }, 'user1'))
        .rejects.toThrow(FileValidationError)
    })

    it('should check user quota limits', async () => {
      const testContent = 'quota test'
      const testFile: FileUpload = {
        filename: 'quota-test.txt',
        mimeType: 'text/plain',
        size: testConfig.quotas.defaultUserQuota + 1,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      await expect(manager.upload(testFile, { access: 'private' }, 'user1'))
        .rejects.toThrow(FileValidationError)
    })

    it('should emit upload events', async () => {
      const testContent = 'event test'
      const testFile: FileUpload = {
        filename: 'event-test.txt',
        mimeType: 'text/plain',
        size: testContent.length,
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      let uploadEventFired = false
      manager.on('file_uploaded', (event) => {
        uploadEventFired = true
        expect(event.fileId).toBeDefined()
        expect(event.userId).toBe('user1')
        expect(event.uploadTime).toBeGreaterThan(0)
      })

      await manager.upload(testFile, { access: 'private' }, 'user1')
      expect(uploadEventFired).toBe(true)
    })
  })

  describe('File Download Operations', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      // Upload a test file for download tests
      const testContent = 'content for download test'
      const testFile: FileUpload = {
        filename: 'download-test.txt',
        mimeType: 'text/plain',
        size: testContent.length, // Fix: Use actual content length (26 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(testFile, { access: 'private' }, 'user1')
      uploadedFileId = metadata.id
    })

    it('should download file successfully', async () => {
      const startTime = performance.now()
      const stream = await manager.download(uploadedFileId, {}, 'user1')
      const downloadTime = performance.now() - startTime

      expect(stream).toBeInstanceOf(ReadableStream)
      expect(downloadTime).toBeLessThan(500) // Should download quickly

      // Read stream content
      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const content = new TextDecoder().decode(Buffer.concat(chunks))
      expect(content).toBe('content for download test')

      console.log(`Download completed in ${downloadTime.toFixed(2)}ms`)
    })

    it('should support range downloads', async () => {
      const range = { start: 0, end: 10 }
      const stream = await manager.download(uploadedFileId, { range }, 'user1')

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const content = new TextDecoder().decode(Buffer.concat(chunks))
      expect(content.length).toBeLessThanOrEqual(11) // range end - start + 1
    })

    it('should check access permissions', async () => {
      await expect(manager.download(uploadedFileId, {}, 'user2'))
        .rejects.toThrow() // Should deny access to different user
    })

    it('should handle non-existent files', async () => {
      await expect(manager.download('non-existent-id', {}, 'user1'))
        .rejects.toThrow(FileNotFoundError)
    })

    it('should emit download events', async () => {
      let downloadEventFired = false
      manager.on('file_downloaded', (event) => {
        downloadEventFired = true
        expect(event.fileId).toBe(uploadedFileId)
        expect(event.userId).toBe('user1')
      })

      await manager.download(uploadedFileId, {}, 'user1')
      expect(downloadEventFired).toBe(true)
    })
  })

  describe('File Metadata Operations', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      const testContent = 'metadata test content'
      const testFile: FileUpload = {
        filename: 'metadata-test.txt',
        mimeType: 'text/plain',
        size: testContent.length, // Fix: Use actual content length (21 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(testFile, { access: 'private' }, 'user1')
      uploadedFileId = metadata.id
    })

    it('should retrieve file metadata', async () => {
      const metadata = await manager.getMetadata(uploadedFileId, 'user1')

      expect(metadata.id).toBe(uploadedFileId)
      expect(metadata.originalName).toBe('metadata-test.txt')
      expect(metadata.mimeType).toBe('text/plain')
      expect(metadata.size).toBe(21) // Fix: Update expected size to match actual content
      expect(metadata.ownerId).toBe('user1')
      expect(metadata.createdAt).toBeInstanceOf(Date)
      expect(metadata.updatedAt).toBeInstanceOf(Date)
    })

    it('should update file metadata', async () => {
      const updates = {
        access: 'public' as const,
        expiresAt: new Date(Date.now() + 86400000) // 24 hours
      }

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))

      const updatedMetadata = await manager.updateMetadata(uploadedFileId, updates, 'user1')

      expect(updatedMetadata.access).toBe('public')
      expect(updatedMetadata.expiresAt).toBeInstanceOf(Date)
      expect(updatedMetadata.updatedAt.getTime()).toBeGreaterThanOrEqual(updatedMetadata.createdAt.getTime())
    })

    it('should list user files with filters', async () => {
      // Upload additional test files
      const imageContent = 'fake image'
      const pdfContent = 'fake pdf'

      const files = await Promise.all([
        manager.upload({
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          size: imageContent.length, // Fix: Use actual content length (10 bytes)
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(imageContent))
              controller.close()
            }
          })
        }, { access: 'public' }, 'user1'),

        manager.upload({
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          size: pdfContent.length, // Fix: Use actual content length (8 bytes)
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(pdfContent))
              controller.close()
            }
          })
        }, { access: 'private' }, 'user1')
      ])

      // Test listing all files
      const allFiles = await manager.listFiles('user1')
      expect(allFiles.length).toBe(3) // Original + 2 new files

      // Test filtering by mime type
      const imageFiles = await manager.listFiles('user1', { mimeType: 'image/jpeg' })
      expect(imageFiles.length).toBe(1)
      expect(imageFiles[0].mimeType).toBe('image/jpeg')

      // Test filtering by access level
      const publicFiles = await manager.listFiles('user1', { access: 'public' })
      expect(publicFiles.length).toBe(1)
      expect(publicFiles[0].access).toBe('public')

      // Test sorting and pagination
      const sortedFiles = await manager.listFiles('user1', {
        sortBy: 'size',
        sortOrder: 'desc',
        limit: 2
      })
      expect(sortedFiles.length).toBe(2)
      expect(sortedFiles[0].size).toBeGreaterThanOrEqual(sortedFiles[1].size)
    })
  })

  describe('File Deletion Operations', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      const testContent = 'content to be deleted'
      const testFile: FileUpload = {
        filename: 'delete-test.txt',
        mimeType: 'text/plain',
        size: testContent.length, // Fix: Use actual content length (21 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(testFile, { access: 'private' }, 'user1')
      uploadedFileId = metadata.id
    })

    it('should delete file successfully', async () => {
      const startTime = performance.now()
      await manager.delete(uploadedFileId, 'user1')
      const deleteTime = performance.now() - startTime

      expect(deleteTime).toBeLessThan(500) // Should delete quickly

      // Verify file is deleted
      await expect(manager.getMetadata(uploadedFileId, 'user1'))
        .rejects.toThrow(FileNotFoundError)

      console.log(`Delete completed in ${deleteTime.toFixed(2)}ms`)
    })

    it('should check delete permissions', async () => {
      await expect(manager.delete(uploadedFileId, 'user2'))
        .rejects.toThrow() // Should deny access to different user
    })

    it('should emit delete events', async () => {
      let deleteEventFired = false
      manager.on('file_deleted', (event) => {
        deleteEventFired = true
        expect(event.fileId).toBe(uploadedFileId)
        expect(event.userId).toBe('user1')
      })

      await manager.delete(uploadedFileId, 'user1')
      expect(deleteEventFired).toBe(true)
    })

    it('should handle deletion of non-existent files', async () => {
      await expect(manager.delete('non-existent-id', 'user1'))
        .rejects.toThrow(FileNotFoundError)
    })
  })

  describe('Thumbnail Generation', () => {
    let imageFileId: string

    beforeEach(async () => {
      const testContent = 'fake image data'
      const testFile: FileUpload = {
        filename: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: testContent.length, // Fix: Use actual content length (15 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(testFile, { access: 'private' }, 'user1')
      imageFileId = metadata.id
    })

    it('should generate single thumbnail', async () => {
      const size: ThumbnailSize = { width: 150, height: 150 }

      const thumbnail = await manager.generateThumbnail(imageFileId, size, 'user1')

      expect(thumbnail).toBeDefined()
      expect(thumbnail.sourceFileId).toBe(imageFileId)
      expect(thumbnail.size).toEqual(size)
      expect(thumbnail.mimeType).toBe('image/jpeg')
      expect(thumbnail.generatedAt).toBeInstanceOf(Date)
    })

    it('should generate multiple thumbnails', async () => {
      const sizes: ThumbnailSize[] = [
        { width: 150, height: 150 },
        { width: 300, height: 300 },
        { width: 600, height: 400 }
      ]

      const thumbnails = await manager.generateThumbnails(imageFileId, sizes, 'user1')

      expect(thumbnails.length).toBe(sizes.length)
      thumbnails.forEach((thumbnail, index) => {
        expect(thumbnail.size).toEqual(sizes[index])
      })
    })

    it('should reject thumbnail generation for non-image files', async () => {
      const testContent = 'text content'
      const textFile: FileUpload = {
        filename: 'text.txt',
        mimeType: 'text/plain',
        size: testContent.length, // Fix: Use actual content length (12 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }

      const metadata = await manager.upload(textFile, { access: 'private' }, 'user1')
      const size: ThumbnailSize = { width: 150, height: 150 }

      await expect(manager.generateThumbnail(metadata.id, size, 'user1'))
        .rejects.toThrow()
    })
  })

  describe('Health and Monitoring', () => {
    it('should report healthy status when backends are working', async () => {
      const health = await manager.getHealth()

      expect(health.status).toBe('healthy')
      expect(health.latency).toBeGreaterThan(0)
      expect(health.errorRate).toBe(0)
      expect(health.lastChecked).toBeInstanceOf(Date)
      expect(health.details).toBeDefined()
    })

    it('should provide storage statistics', async () => {
      // Upload some test files
      const file1Content = 'file 1'
      const file2Content = 'file 2'

      await Promise.all([
        manager.upload({
          filename: 'file1.txt',
          mimeType: 'text/plain',
          size: file1Content.length, // Fix: Use actual content length (6 bytes)
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(file1Content))
              controller.close()
            }
          })
        }, { access: 'private' }, 'user1'),

        manager.upload({
          filename: 'file2.jpg',
          mimeType: 'image/jpeg',
          size: file2Content.length, // Fix: Use actual content length (6 bytes)
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(file2Content))
              controller.close()
            }
          })
        }, { access: 'public' }, 'user1')
      ])

      const stats = await manager.getStorageStats()

      expect(stats.totalFiles).toBe(2)
      expect(stats.totalSize).toBe(12) // Fix: Update expected total size (6 + 6 = 12)
      expect(stats.filesByType['text/plain']).toBe(1)
      expect(stats.filesByType['image/jpeg']).toBe(1)
      expect(stats.averageFileSize).toBe(6) // Fix: Update expected average (12 / 2 = 6)
      expect(stats.largestFile).toBeDefined()
      expect(stats.oldestFile).toBeDefined()
      expect(stats.recentActivity).toBeDefined()
    })

    it('should track user storage usage', async () => {
      const initialUsage = await manager.getStorageUsage('user1')
      expect(initialUsage.used).toBe(0)
      expect(initialUsage.quota).toBe(testConfig.quotas.defaultUserQuota)

      // Upload a file
      const testContent = 'usage test'
      await manager.upload({
        filename: 'usage-test.txt',
        mimeType: 'text/plain',
        size: testContent.length, // Fix: Use actual content length (10 bytes)
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testContent))
            controller.close()
          }
        })
      }, { access: 'private' }, 'user1')

      const updatedUsage = await manager.getStorageUsage('user1')
      expect(updatedUsage.used).toBe(10) // Fix: Update expected usage to match actual content size
    })
  })

  describe('Performance Benchmarks', () => {
    it('should handle concurrent uploads efficiently', async () => {
      const concurrentUploads = 10
      const baseContent = 'concurrent file'

      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) => {
        const content = `${baseContent} ${i}`
        return manager.upload({
          filename: `concurrent-${i}.txt`,
          mimeType: 'text/plain',
          size: content.length, // Fix: Calculate size for each file with index
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(content))
              controller.close()
            }
          })
        }, { access: 'private' }, 'user1')
      })

      const startTime = performance.now()
      const results = await Promise.all(uploadPromises)
      const totalTime = performance.now() - startTime

      expect(results.length).toBe(concurrentUploads)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds

      const avgTimePerUpload = totalTime / concurrentUploads
      console.log(`Concurrent uploads: ${concurrentUploads} files in ${totalTime.toFixed(2)}ms (avg: ${avgTimePerUpload.toFixed(2)}ms per file)`)
    })

    it('should maintain performance under load', async () => {
      const iterations = 50
      const uploadTimes: number[] = []
      const baseContent = 'load test'

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        const content = `${baseContent} ${i}`

        await manager.upload({
          filename: `load-test-${i}.txt`,
          mimeType: 'text/plain',
          size: content.length, // Fix: Calculate size for each file with index
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(content))
              controller.close()
            }
          })
        }, { access: 'private' }, 'user1')

        uploadTimes.push(performance.now() - startTime)
      }

      const avgUploadTime = uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
      const maxUploadTime = Math.max(...uploadTimes)

      expect(avgUploadTime).toBeLessThan(100) // Average should be under 100ms
      expect(maxUploadTime).toBeLessThan(500) // Max should be under 500ms

      console.log(`Load test: ${iterations} uploads, avg: ${avgUploadTime.toFixed(2)}ms, max: ${maxUploadTime.toFixed(2)}ms`)
    })
  })
})