/**
 * File Metadata Manager
 * Phase 4: File Storage System - Metadata Management
 *
 * Manages file metadata in the database collection including:
 * - CRUD operations for file metadata
 * - Search and filtering capabilities
 * - Metadata validation and indexing
 * - Integration with Collection Store database
 */

import { EventEmitter } from 'events'
import type { CSDatabase } from '../../CSDatabase'
import type { IDataCollection } from '../../IDataCollection'
import {
  FileMetadata,
  FileListFilters,
  FileSearchQuery,
  FileValidationResult
} from '../interfaces/types'
import {
  FileStorageError,
  FileNotFoundError,
  FileValidationError
} from '../interfaces/errors'

export interface FileMetadataManagerConfig {
  collectionName: string
  enableIndexing: boolean
  enableCaching: boolean
  cacheSize: number
  ttl: number
}

export class FileMetadataManager extends EventEmitter {
  private collection?: IDataCollection<FileMetadata>
  private initialized = false
  private cache = new Map<string, { metadata: FileMetadata; timestamp: number }>()

  constructor(
    private database: CSDatabase,
    private config: FileMetadataManagerConfig = {
      collectionName: 'file_metadata',
      enableIndexing: true,
      enableCaching: true,
      cacheSize: 10000,
      ttl: 300000 // 5 minutes
    }
  ) {
    super()
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Always create the collection - CSDatabase will handle if it already exists
      this.collection = await this.database.createCollection<FileMetadata>(this.config.collectionName)

      // Create indexes for efficient querying
      if (this.config.enableIndexing) {
        await this.createIndexes()
      }

      // Start cache cleanup interval
      if (this.config.enableCaching) {
        this.startCacheCleanup()
      }

      this.initialized = true
      this.emit('initialized')

    } catch (error) {
      throw new FileStorageError('Failed to initialize file metadata manager', 'INITIALIZATION_ERROR', { error })
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.cache.clear()
    this.initialized = false
    this.emit('shutdown')
  }

  // CRUD Operations

  async create(metadata: FileMetadata): Promise<FileMetadata> {
    this.ensureInitialized()

    try {
      // Validate metadata
      const validation = this.validateMetadata(metadata)
      if (!validation.isValid) {
        throw new FileValidationError('Invalid file metadata', validation.errors)
      }

      // Insert into database using Collection Store API
      const result = await this.collection!.create(metadata)

      if (!result) {
        throw new FileStorageError('Failed to create file metadata', 'METADATA_CREATE_ERROR', {
          fileId: metadata.id
        })
      }

      // Cache the metadata
      if (this.config.enableCaching) {
        this.cache.set(metadata.id, {
          metadata: result,
          timestamp: Date.now()
        })
      }

      this.emit('metadata_created', { fileId: metadata.id, metadata: result })
      return result

    } catch (error) {
      this.emit('metadata_create_error', { fileId: metadata.id, error })

      // Re-throw validation and not found errors as-is
      if (error instanceof FileValidationError || error instanceof FileNotFoundError) {
        throw error
      }

      throw new FileStorageError('Failed to create file metadata', 'METADATA_CREATE_ERROR', {
        fileId: metadata.id,
        error
      })
    }
  }

  async get(fileId: string): Promise<FileMetadata | null> {
    this.ensureInitialized()

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.cache.get(fileId)
        if (cached && (Date.now() - cached.timestamp) < this.config.ttl) {
          return cached.metadata
        }
      }

      // Query database using Collection Store API
      const metadata = await this.collection!.findById(fileId)

      if (metadata) {
        // Update cache
        if (this.config.enableCaching) {
          this.cache.set(fileId, {
            metadata,
            timestamp: Date.now()
          })
        }
      }

      return metadata || null

    } catch (error) {
      throw new FileStorageError('Failed to get file metadata', 'METADATA_GET_ERROR', {
        fileId,
        error
      })
    }
  }

  async getRequired(fileId: string): Promise<FileMetadata> {
    const metadata = await this.get(fileId)
    if (!metadata) {
      throw new FileNotFoundError(fileId)
    }
    return metadata
  }

  async update(fileId: string, updates: Partial<FileMetadata>): Promise<FileMetadata> {
    this.ensureInitialized()

    try {
      // Get existing metadata
      const existing = await this.getRequired(fileId)

      // Merge updates
      const updatedMetadata: FileMetadata = {
        ...existing,
        ...updates,
        id: fileId, // Prevent ID changes
        updatedAt: new Date()
      }

      // Validate updated metadata
      const validation = this.validateMetadata(updatedMetadata)
      if (!validation.isValid) {
        throw new FileValidationError('Invalid updated metadata', validation.errors)
      }

      // Update in database using Collection Store API
      const result = await this.collection!.updateWithId(fileId, updatedMetadata)

      if (!result) {
        throw new FileNotFoundError(fileId)
      }

      // Update cache
      if (this.config.enableCaching) {
        this.cache.set(fileId, {
          metadata: result,
          timestamp: Date.now()
        })
      }

      this.emit('metadata_updated', { fileId, updates, metadata: result })
      return result

    } catch (error) {
      this.emit('metadata_update_error', { fileId, updates, error })

      // Re-throw validation and not found errors as-is
      if (error instanceof FileValidationError || error instanceof FileNotFoundError) {
        throw error
      }

      throw new FileStorageError('Failed to update file metadata', 'METADATA_UPDATE_ERROR', {
        fileId,
        error
      })
    }
  }

  async delete(fileId: string): Promise<void> {
    this.ensureInitialized()

    try {
      // Remove from database using Collection Store API
      const result = await this.collection!.removeWithId(fileId)

      if (!result) {
        throw new FileNotFoundError(fileId)
      }

      // Remove from cache
      if (this.config.enableCaching) {
        this.cache.delete(fileId)
      }

      this.emit('metadata_deleted', { fileId })

    } catch (error) {
      this.emit('metadata_delete_error', { fileId, error })

      // Re-throw validation and not found errors as-is
      if (error instanceof FileValidationError || error instanceof FileNotFoundError) {
        throw error
      }

      throw new FileStorageError('Failed to delete file metadata', 'METADATA_DELETE_ERROR', {
        fileId,
        error
      })
    }
  }

  // Query Operations

  async list(filters: FileListFilters = {}): Promise<FileMetadata[]> {
    this.ensureInitialized()

    try {
      // Build condition for Collection Store find
      const condition = this.buildCondition(filters)

      // Execute query using Collection Store API
      let results = await this.collection!.find(condition)

      // Apply sorting (Collection Store doesn't have built-in sorting, so we do it in memory)
      if (filters.sortBy) {
        const sortField = this.mapSortField(filters.sortBy)
        const sortOrder = filters.sortOrder === 'desc' ? -1 : 1

        results.sort((a, b) => {
          const aVal = this.getNestedValue(a, sortField)
          const bVal = this.getNestedValue(b, sortField)

          if (aVal < bVal) return -1 * sortOrder
          if (aVal > bVal) return 1 * sortOrder
          return 0
        })
      }

      // Apply pagination
      if (filters.offset) {
        results = results.slice(filters.offset)
      }

      if (filters.limit) {
        results = results.slice(0, filters.limit)
      }

      return results

    } catch (error) {
      throw new FileStorageError('Failed to list file metadata', 'METADATA_LIST_ERROR', {
        filters,
        error
      })
    }
  }

  async search(query: FileSearchQuery): Promise<FileMetadata[]> {
    this.ensureInitialized()

    try {
      // Build condition for Collection Store find
      const condition = this.buildSearchCondition(query)

      // Execute search using Collection Store API
      const results = await this.collection!.find(condition)
      return results

    } catch (error) {
      throw new FileStorageError('Failed to search file metadata', 'METADATA_SEARCH_ERROR', {
        query,
        error
      })
    }
  }

  async count(filters: FileListFilters = {}): Promise<number> {
    this.ensureInitialized()

    try {
      // Build condition for Collection Store find
      const condition = this.buildCondition(filters)

      // Execute query and count results
      const results = await this.collection!.find(condition)
      return results.length

    } catch (error) {
      throw new FileStorageError('Failed to count file metadata', 'METADATA_COUNT_ERROR', {
        filters,
        error
      })
    }
  }

  // Utility Operations

  async getExpiredFiles(): Promise<FileMetadata[]> {
    this.ensureInitialized()

    try {
      const now = new Date()
      const expiredFiles = await this.collection!.find((item) => {
        return item.expiresAt && item.expiresAt <= now
      })

      return expiredFiles

    } catch (error) {
      throw new FileStorageError('Failed to get expired files', 'METADATA_EXPIRED_ERROR', { error })
    }
  }

  async getFilesByOwner(ownerId: string, limit?: number): Promise<FileMetadata[]> {
    return this.list({ ownerId, limit })
  }

  async getFilesByMimeType(mimeType: string, limit?: number): Promise<FileMetadata[]> {
    return this.list({ mimeType, limit })
  }

  async getRecentFiles(limit: number = 10): Promise<FileMetadata[]> {
    return this.list({
      sortBy: 'created',
      sortOrder: 'desc',
      limit
    })
  }

  async getLargestFiles(limit: number = 10): Promise<FileMetadata[]> {
    return this.list({
      sortBy: 'size',
      sortOrder: 'desc',
      limit
    })
  }

  // Statistics

  async getStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
    filesByType: Record<string, number>
    filesByAccess: Record<string, number>
    averageFileSize: number
  }> {
    this.ensureInitialized()

    try {
      // Get all files
      const allFiles = await this.collection!.find(() => true)

      if (allFiles.length === 0) {
        return {
          totalFiles: 0,
          totalSize: 0,
          filesByType: {},
          filesByAccess: {},
          averageFileSize: 0
        }
      }

      // Calculate statistics
      const totalFiles = allFiles.length
      const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0)

      // Count files by type
      const filesByType: Record<string, number> = {}
      allFiles.forEach(file => {
        filesByType[file.mimeType] = (filesByType[file.mimeType] || 0) + 1
      })

      // Count files by access level
      const filesByAccess: Record<string, number> = {}
      allFiles.forEach(file => {
        filesByAccess[file.access] = (filesByAccess[file.access] || 0) + 1
      })

      return {
        totalFiles,
        totalSize,
        filesByType,
        filesByAccess,
        averageFileSize: totalSize / totalFiles
      }

    } catch (error) {
      throw new FileStorageError('Failed to get storage statistics', 'METADATA_STATS_ERROR', { error })
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized || !this.collection) {
      throw new FileStorageError('File metadata manager not initialized', 'NOT_INITIALIZED')
    }
  }

  private validateMetadata(metadata: FileMetadata): FileValidationResult {
    const errors: string[] = []

    // Required fields validation
    if (!metadata.id) {
      errors.push('File ID is required')
    }

    if (!metadata.filename) {
      errors.push('Filename is required')
    }

    if (!metadata.originalName) {
      errors.push('Original name is required')
    }

    if (!metadata.mimeType) {
      errors.push('MIME type is required')
    }

    if (typeof metadata.size !== 'number' || metadata.size < 0) {
      errors.push('Valid file size is required')
    }

    if (!metadata.checksum) {
      errors.push('File checksum is required')
    }

    if (!metadata.backend) {
      errors.push('Storage backend is required')
    }

    if (!metadata.storagePath) {
      errors.push('Storage path is required')
    }

    if (!['public', 'private', 'restricted'].includes(metadata.access)) {
      errors.push('Valid access level is required')
    }

    if (!metadata.ownerId) {
      errors.push('Owner ID is required')
    }

    if (!metadata.createdAt || !(metadata.createdAt instanceof Date)) {
      errors.push('Valid creation date is required')
    }

    if (!metadata.updatedAt || !(metadata.updatedAt instanceof Date)) {
      errors.push('Valid update date is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.collection) return

    try {
      // Create indexes for common queries using Collection Store API
      await this.database.createIndex(this.config.collectionName, 'ownerId', { key: 'ownerId' })
      await this.database.createIndex(this.config.collectionName, 'mimeType', { key: 'mimeType' })
      await this.database.createIndex(this.config.collectionName, 'access', { key: 'access' })
      await this.database.createIndex(this.config.collectionName, 'createdAt', { key: 'createdAt' })
      await this.database.createIndex(this.config.collectionName, 'size', { key: 'size' })
      await this.database.createIndex(this.config.collectionName, 'expiresAt', { key: 'expiresAt' })

    } catch (error) {
      console.warn('Failed to create some indexes:', error)
    }
  }

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      'name': 'originalName',
      'size': 'size',
      'created': 'createdAt',
      'modified': 'updatedAt'
    }

    return fieldMap[sortBy] || 'createdAt'
  }

  private buildCondition(filters: FileListFilters): (item: FileMetadata) => boolean {
    return (item: FileMetadata) => {
      // Apply filters
      if (filters.ownerId && item.ownerId !== filters.ownerId) {
        return false
      }

      if (filters.mimeType && item.mimeType !== filters.mimeType) {
        return false
      }

      if (filters.access && item.access !== filters.access) {
        return false
      }

      if (filters.minSize !== undefined && item.size < filters.minSize) {
        return false
      }

      if (filters.maxSize !== undefined && item.size > filters.maxSize) {
        return false
      }

      if (filters.createdAfter && item.createdAt < filters.createdAfter) {
        return false
      }

      if (filters.createdBefore && item.createdAt > filters.createdBefore) {
        return false
      }

      if (filters.hasExpiration !== undefined) {
        const hasExpiration = !!item.expiresAt
        if (filters.hasExpiration !== hasExpiration) {
          return false
        }
      }

      return true
    }
  }

  private buildSearchCondition(query: FileSearchQuery): (item: FileMetadata) => boolean {
    return (item: FileMetadata) => {
      // Text search on filename
      if (query.filename) {
        const regex = new RegExp(query.filename, 'i')
        if (!regex.test(item.originalName)) {
          return false
        }
      }

      // MIME type filter
      if (query.mimeType && item.mimeType !== query.mimeType) {
        return false
      }

      // Owner filter
      if (query.ownerId && item.ownerId !== query.ownerId) {
        return false
      }

      // Date range filter
      if (query.dateRange) {
        if (item.createdAt < query.dateRange.start || item.createdAt > query.dateRange.end) {
          return false
        }
      }

      // Size range filter
      if (query.sizeRange) {
        if (item.size < query.sizeRange.min || item.size > query.sizeRange.max) {
          return false
        }
      }

      return true
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      const expiredKeys: string[] = []

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.config.ttl) {
          expiredKeys.push(key)
        }
      }

      expiredKeys.forEach(key => this.cache.delete(key))

      // Limit cache size
      if (this.cache.size > this.config.cacheSize) {
        const entries = Array.from(this.cache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

        const toRemove = entries.slice(0, this.cache.size - this.config.cacheSize)
        toRemove.forEach(([key]) => this.cache.delete(key))
      }

    }, 60000) // Cleanup every minute
  }
}