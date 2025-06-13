/**
 * Main File Storage Manager Implementation
 * Phase 4: File Storage System - Unified Manager
 *
 * Orchestrates all file storage operations including:
 * - File upload/download/delete
 * - Metadata management
 * - Backend selection and management
 * - Authorization and access control
 * - Thumbnail generation
 * - File replication
 * - Health monitoring
 */

import { EventEmitter } from 'events'
import * as crypto from 'crypto'
import { Readable } from 'stream'

import { IFileStorageManager, FileListFilters, FileSearchQuery, StorageStats } from '../interfaces/IFileStorageManager'
import {
  FileMetadata,
  FileUpload,
  UploadOptions,
  DownloadOptions,
  ThumbnailSize,
  ThumbnailInfo,
  SignedUrlOptions,
  FileOperationResult,
  ReplicationHealth,
  BackendHealth,
  ByteRange,
  UploadProgress,
  FileValidationResult
} from '../interfaces/types'
import {
  FileStorageError,
  FileNotFoundError,
  FileAccessDeniedError,
  FileValidationError,
  FileSizeLimitError,
  UnsupportedFileTypeError,
  QuotaExceededError,
  FileExpiredError
} from '../interfaces/errors'
import { IStorageBackend, BackendConfig } from '../backends/IStorageBackend'
import { LocalFileStorage } from '../backends/LocalFileStorage'
import { generateFileId, validateFileId, getFileIdInfo } from './FileIdGenerator'

export interface FileStorageManagerConfig {
  backends: {
    default: string
    configs: Record<string, BackendConfig>
  }
  validation: {
    maxFileSize: number
    allowedMimeTypes: string[]
    blockedMimeTypes: string[]
  }
  thumbnails: {
    enabled: boolean
    defaultSizes: ThumbnailSize[]
    quality: number
  }
  replication: {
    enabled: boolean
    minReplicas: number
    preferredNodes: string[]
  }
  quotas: {
    defaultUserQuota: number
    adminQuota: number
  }
  cleanup: {
    expiredFilesCheckInterval: number
    tempFileCleanupInterval: number
  }
}

export class FileStorageManager extends EventEmitter implements IFileStorageManager {
  private backends = new Map<string, IStorageBackend>()
  private defaultBackend: string
  private initialized = false
  private fileMetadata = new Map<string, FileMetadata>() // In-memory cache, should be replaced with database
  private userQuotas = new Map<string, { used: number; quota: number }>()

  constructor(private config: FileStorageManagerConfig) {
    super()
    this.defaultBackend = config.backends.default
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Initialize storage backends
      for (const [name, backendConfig] of Object.entries(this.config.backends.configs)) {
        await this.initializeBackend(name, backendConfig)
      }

      // Start cleanup intervals
      this.startCleanupIntervals()

      this.initialized = true
      this.emit('initialized')

    } catch (error) {
      throw new FileStorageError('Failed to initialize file storage manager', 'INITIALIZATION_ERROR', { error })
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    // Shutdown all backends
    for (const backend of this.backends.values()) {
      await backend.shutdown()
    }

    this.backends.clear()
    this.initialized = false
    this.emit('shutdown')
  }

  // Core file operations

  async upload(file: FileUpload, options: UploadOptions, userId: string): Promise<FileMetadata> {
    this.ensureInitialized()

    const startTime = performance.now()

    try {
      // 1. Validate file
      const validation = await this.validateFile(file, userId)
      if (!validation.isValid) {
        throw new FileValidationError('File validation failed', validation.errors)
      }

      // 2. Check user quota
      await this.checkUserQuota(userId, file.size)

      // 3. Generate unique file ID
      const fileId = generateFileId()

      // 4. Get storage backend
      const backendName = options.backend || this.defaultBackend
      const backend = this.getBackend(backendName)

      // 5. Calculate checksum if not provided (we'll calculate it during storage)
      const checksum = file.checksum || 'pending'

      // 6. Create metadata
      const metadata: FileMetadata = {
        id: fileId,
        filename: fileId,
        originalName: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        checksum,
        backend: backendName,
        storagePath: this.generateStoragePath(fileId),
        access: options.access,
        ownerId: userId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: options.ttl ? new Date(Date.now() + options.ttl * 1000) : undefined,
        thumbnails: [],
        replicationNodes: options.replicationNodes || [],
        replicationStatus: 'pending'
      }

      // 7. Store file in backend
      await backend.store(fileId, file.stream, metadata, {
        chunkSize: options.chunkSize || 64 * 1024,
        compression: false,
        progressCallback: (progress: UploadProgress) => {
          this.emit('upload_progress', { fileId, progress, userId })
        }
      })

      // 8. Save metadata
      this.fileMetadata.set(fileId, metadata)

      // 9. Update user quota
      await this.updateUserQuota(userId, file.size)

      // 10. Generate thumbnails if requested
      if (options.generateThumbnails && this.isImageOrVideo(file.mimeType)) {
        this.generateThumbnailsAsync(fileId, options.thumbnailSizes || this.config.thumbnails.defaultSizes)
      }

      // 11. Emit events
      this.emit('file_uploaded', { fileId, metadata, userId, uploadTime: performance.now() - startTime })

      return metadata

    } catch (error) {
      this.emit('upload_error', { file, options, userId, error, uploadTime: performance.now() - startTime })
      throw error
    }
  }

  async download(fileId: string, options: DownloadOptions = {}, userId?: string): Promise<ReadableStream> {
    this.ensureInitialized()

    const startTime = performance.now()

    try {
      // 1. Get file metadata
      const metadata = await this.getMetadata(fileId, userId)

      // 2. Check if file is expired
      if (metadata.expiresAt && metadata.expiresAt < new Date()) {
        throw new FileExpiredError(fileId, metadata.expiresAt)
      }

      // 3. Check access permissions
      if (userId) {
        await this.checkAccess(fileId, 'read', userId)
      }

      // 4. Get storage backend
      const backend = this.getBackend(metadata.backend)

      // 5. Retrieve file stream
      const stream = await backend.retrieve(fileId, options.range)

      // 6. Update last accessed time if tracking is enabled
      if (options.trackAccess) {
        metadata.lastAccessedAt = new Date()
        this.fileMetadata.set(fileId, metadata)
      }

      // 7. Emit events
      this.emit('file_downloaded', { fileId, metadata, userId, downloadTime: performance.now() - startTime })

      return stream

    } catch (error) {
      this.emit('download_error', { fileId, options, userId, error, downloadTime: performance.now() - startTime })
      throw error
    }
  }

  async delete(fileId: string, userId: string): Promise<void> {
    this.ensureInitialized()

    const startTime = performance.now()

    try {
      // 1. Get file metadata
      const metadata = await this.getMetadata(fileId, userId)

      // 2. Check delete permissions
      await this.checkAccess(fileId, 'delete', userId)

      // 3. Get storage backend
      const backend = this.getBackend(metadata.backend)

      // 4. Delete file from backend
      await backend.delete(fileId)

      // 5. Delete thumbnails
      for (const thumbnail of metadata.thumbnails) {
        try {
          const thumbnailBackend = this.getBackend(thumbnail.fileId.split('-')[0]) // Extract backend from thumbnail ID
          await thumbnailBackend.delete(thumbnail.fileId)
        } catch (error) {
          console.warn(`Failed to delete thumbnail ${thumbnail.id}:`, error)
        }
      }

      // 6. Update user quota
      await this.updateUserQuota(userId, -metadata.size)

      // 7. Remove metadata
      this.fileMetadata.delete(fileId)

      // 8. Emit events
      this.emit('file_deleted', { fileId, metadata, userId, deleteTime: performance.now() - startTime })

    } catch (error) {
      this.emit('delete_error', { fileId, userId, error, deleteTime: performance.now() - startTime })
      throw error
    }
  }

  // Metadata management

  async getMetadata(fileId: string, userId?: string): Promise<FileMetadata> {
    this.ensureInitialized()

    const metadata = this.fileMetadata.get(fileId)
    if (!metadata) {
      throw new FileNotFoundError(fileId)
    }

    // Check basic access if userId provided
    if (userId && !this.hasBasicAccess(metadata, userId)) {
      throw new FileAccessDeniedError(fileId, userId, 'read')
    }

    return metadata
  }

  async updateMetadata(fileId: string, updates: Partial<FileMetadata>, userId: string): Promise<FileMetadata> {
    this.ensureInitialized()

    const metadata = await this.getMetadata(fileId, userId)

    // Check write permissions
    await this.checkAccess(fileId, 'write', userId)

    // Apply updates
    const updatedMetadata = {
      ...metadata,
      ...updates,
      id: fileId, // Prevent ID changes
      updatedAt: new Date()
    }

    this.fileMetadata.set(fileId, updatedMetadata)

    this.emit('metadata_updated', { fileId, updates, userId })

    return updatedMetadata
  }

  async listFiles(userId: string, filters: FileListFilters = {}): Promise<FileMetadata[]> {
    this.ensureInitialized()

    let files = Array.from(this.fileMetadata.values())

    // Filter by user access
    files = files.filter(file => this.hasBasicAccess(file, userId))

    // Apply filters
    if (filters.mimeType) {
      files = files.filter(file => file.mimeType === filters.mimeType)
    }

    if (filters.minSize !== undefined) {
      files = files.filter(file => file.size >= filters.minSize!)
    }

    if (filters.maxSize !== undefined) {
      files = files.filter(file => file.size <= filters.maxSize!)
    }

    if (filters.createdAfter) {
      files = files.filter(file => file.createdAt >= filters.createdAfter!)
    }

    if (filters.createdBefore) {
      files = files.filter(file => file.createdAt <= filters.createdBefore!)
    }

    if (filters.access) {
      files = files.filter(file => file.access === filters.access)
    }

    if (filters.hasExpiration !== undefined) {
      files = files.filter(file => filters.hasExpiration ? !!file.expiresAt : !file.expiresAt)
    }

    // Sort files
    if (filters.sortBy) {
      files.sort((a, b) => {
        let aValue: any, bValue: any

        switch (filters.sortBy) {
          case 'name':
            aValue = a.originalName
            bValue = b.originalName
            break
          case 'size':
            aValue = a.size
            bValue = b.size
            break
          case 'created':
            aValue = a.createdAt
            bValue = b.createdAt
            break
          case 'modified':
            aValue = a.updatedAt
            bValue = b.updatedAt
            break
          default:
            return 0
        }

        if (filters.sortOrder === 'desc') {
          return bValue > aValue ? 1 : bValue < aValue ? -1 : 0
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        }
      })
    }

    // Apply pagination
    const offset = filters.offset || 0
    const limit = filters.limit || files.length

    return files.slice(offset, offset + limit)
  }

  // Streaming support

  async streamFile(fileId: string, range?: { start: number; end: number }, userId?: string): Promise<ReadableStream> {
    return this.download(fileId, { range }, userId)
  }

  async getFileSize(fileId: string, userId?: string): Promise<number> {
    const metadata = await this.getMetadata(fileId, userId)
    return metadata.size
  }

  // Thumbnail generation

  async generateThumbnail(fileId: string, size: ThumbnailSize, userId: string): Promise<ThumbnailInfo> {
    this.ensureInitialized()

    const metadata = await this.getMetadata(fileId, userId)

    if (!this.isImageOrVideo(metadata.mimeType)) {
      throw new UnsupportedFileTypeError(metadata.mimeType, ['image/*', 'video/*'])
    }

    // For now, return a mock thumbnail info
    // In a real implementation, this would use an image processing library
    const thumbnailInfo: ThumbnailInfo = {
      id: `thumb_${fileId}_${size.width}x${size.height}`,
      sourceFileId: fileId,
      size,
      fileId: `thumb_${fileId}_${size.width}x${size.height}`,
      mimeType: 'image/jpeg',
      generatedAt: new Date()
    }

    // Add to metadata
    metadata.thumbnails.push(thumbnailInfo)
    this.fileMetadata.set(fileId, metadata)

    return thumbnailInfo
  }

  async generateThumbnails(fileId: string, sizes: ThumbnailSize[], userId: string): Promise<ThumbnailInfo[]> {
    const thumbnails: ThumbnailInfo[] = []

    for (const size of sizes) {
      try {
        const thumbnail = await this.generateThumbnail(fileId, size, userId)
        thumbnails.push(thumbnail)
      } catch (error) {
        console.warn(`Failed to generate thumbnail ${size.width}x${size.height} for ${fileId}:`, error)
      }
    }

    return thumbnails
  }

  async getThumbnails(fileId: string, userId?: string): Promise<ThumbnailInfo[]> {
    const metadata = await this.getMetadata(fileId, userId)
    return metadata.thumbnails
  }

  // Access control

  async generateSignedUrl(fileId: string, options: SignedUrlOptions, userId: string): Promise<string> {
    this.ensureInitialized()

    const metadata = await this.getMetadata(fileId, userId)

    // Check if user has required permissions
    for (const permission of options.permissions) {
      await this.checkAccess(fileId, permission as any, userId)
    }

    // Generate signed token
    const payload = {
      fileId,
      permissions: options.permissions,
      userId,
      exp: Math.floor(Date.now() / 1000) + options.ttl,
      downloadFilename: options.downloadFilename
    }

    const token = Buffer.from(JSON.stringify(payload)).toString('base64')

    return `${process.env.BASE_URL || 'http://localhost:3000'}/api/files/${fileId}/download?token=${token}`
  }

  async checkAccess(fileId: string, action: 'read' | 'write' | 'delete', userId: string): Promise<boolean> {
    const metadata = await this.getMetadata(fileId)

    // Owner has all permissions
    if (metadata.ownerId === userId) {
      return true
    }

    // Check public access
    if (metadata.access === 'public' && action === 'read') {
      return true
    }

    // Check specific permissions
    const hasPermission = metadata.permissions.some(permission => {
      return (permission.userId === userId || permission.roleId) && permission.action === action
    })

    if (!hasPermission) {
      throw new FileAccessDeniedError(fileId, userId, action)
    }

    return true
  }

  async updatePermissions(fileId: string, permissions: any[], userId: string): Promise<void> {
    const metadata = await this.updateMetadata(fileId, { permissions }, userId)
    this.emit('permissions_updated', { fileId, permissions, userId })
  }

  // File validation

  async validateFile(file: FileUpload, userId: string): Promise<FileValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check file size
    if (file.size > this.config.validation.maxFileSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size ${this.config.validation.maxFileSize}`)
    }

    // Check mime type
    if (this.config.validation.blockedMimeTypes.includes(file.mimeType)) {
      errors.push(`File type ${file.mimeType} is not allowed`)
    }

    if (this.config.validation.allowedMimeTypes.length > 0 &&
        !this.config.validation.allowedMimeTypes.includes(file.mimeType) &&
        !this.config.validation.allowedMimeTypes.includes('*/*')) {
      errors.push(`File type ${file.mimeType} is not in allowed types`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedMimeType: file.mimeType,
      actualSize: file.size
    }
  }

  async detectMimeType(stream: ReadableStream): Promise<string> {
    // For now, return a default mime type
    // In a real implementation, this would analyze the file content
    return 'application/octet-stream'
  }

  // Lifecycle management

  async setExpiration(fileId: string, expiresAt: Date, userId: string): Promise<void> {
    await this.updateMetadata(fileId, { expiresAt }, userId)
  }

  async cleanupExpiredFiles(): Promise<string[]> {
    const now = new Date()
    const expiredFiles: string[] = []

    for (const [fileId, metadata] of this.fileMetadata.entries()) {
      if (metadata.expiresAt && metadata.expiresAt < now) {
        try {
          await this.delete(fileId, metadata.ownerId)
          expiredFiles.push(fileId)
        } catch (error) {
          console.warn(`Failed to cleanup expired file ${fileId}:`, error)
        }
      }
    }

    return expiredFiles
  }

  async getStorageUsage(userId: string): Promise<{ used: number; quota: number }> {
    const quota = this.userQuotas.get(userId) || { used: 0, quota: this.config.quotas.defaultUserQuota }
    return quota
  }

  // Health and monitoring

  async getHealth(): Promise<BackendHealth> {
    const backendHealths = await Promise.all(
      Array.from(this.backends.values()).map(backend => backend.getHealth())
    )

    const unhealthyBackends = backendHealths.filter(health => health.status !== 'healthy')
    const avgLatency = backendHealths.reduce((sum, health) => sum + health.latency, 0) / backendHealths.length

    return {
      status: unhealthyBackends.length === 0 ? 'healthy' : unhealthyBackends.length < backendHealths.length ? 'degraded' : 'unhealthy',
      latency: avgLatency,
      errorRate: unhealthyBackends.length / backendHealths.length,
      lastChecked: new Date(),
      details: {
        backends: Object.fromEntries(
          Array.from(this.backends.keys()).map((name, index) => [name, backendHealths[index]])
        )
      }
    }
  }

  async getReplicationHealth(): Promise<ReplicationHealth> {
    const totalFiles = this.fileMetadata.size
    const replicatedFiles = Array.from(this.fileMetadata.values()).filter(
      file => file.replicationStatus === 'completed'
    ).length

    return {
      totalFiles,
      replicatedFiles,
      missingReplicas: [],
      corruptedFiles: [],
      lastSyncTime: new Date()
    }
  }

  async getStorageStats(): Promise<StorageStats> {
    const files = Array.from(this.fileMetadata.values())
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const filesByType: Record<string, number> = {}

    files.forEach(file => {
      filesByType[file.mimeType] = (filesByType[file.mimeType] || 0) + 1
    })

        const largestFile = files.reduce((largest, file) =>
      file.size > largest.size ? file : largest, files[0] || { id: '', size: 0, filename: '', originalName: '' } as FileMetadata
    )

    const oldestFile = files.reduce((oldest, file) =>
      file.createdAt < oldest.createdAt ? file : oldest, files[0] || { id: '', createdAt: new Date(), filename: '', originalName: '' } as FileMetadata
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const recentActivity = {
      uploadsToday: files.filter(file => file.createdAt >= today).length,
      downloadsToday: 0, // Would need to track downloads
      deletionsToday: 0  // Would need to track deletions
    }

    return {
      totalFiles: files.length,
      totalSize,
      filesByType,
      averageFileSize: files.length > 0 ? totalSize / files.length : 0,
      largestFile: {
        id: largestFile.id,
        size: largestFile.size,
        filename: largestFile.originalName || largestFile.filename
      },
      oldestFile: {
        id: oldestFile.id,
        createdAt: oldestFile.createdAt,
        filename: oldestFile.originalName || oldestFile.filename
      },
      recentActivity
    }
  }

  // Batch operations

  async uploadMultiple(files: FileUpload[], options: UploadOptions, userId: string): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = []

    for (const file of files) {
      const startTime = performance.now()
      try {
        const metadata = await this.upload(file, options, userId)
        results.push({
          success: true,
          fileId: metadata.id,
          metadata,
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        })
      } catch (error) {
        results.push({
          success: false,
          error: (error as Error).message,
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        })
      }
    }

    return results
  }

  async deleteMultiple(fileIds: string[], userId: string): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = []

    for (const fileId of fileIds) {
      const startTime = performance.now()
      try {
        await this.delete(fileId, userId)
        results.push({
          success: true,
          fileId,
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        })
      } catch (error) {
        results.push({
          success: false,
          fileId,
          error: (error as Error).message,
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        })
      }
    }

    return results
  }

  // Search and filtering

  async searchFiles(query: FileSearchQuery, userId: string): Promise<FileMetadata[]> {
    let files = await this.listFiles(userId)

    if (query.filename) {
      files = files.filter(file =>
        file.originalName.toLowerCase().includes(query.filename!.toLowerCase())
      )
    }

    if (query.mimeType) {
      files = files.filter(file => file.mimeType === query.mimeType)
    }

    if (query.dateRange) {
      files = files.filter(file =>
        file.createdAt >= query.dateRange!.start && file.createdAt <= query.dateRange!.end
      )
    }

    if (query.sizeRange) {
      files = files.filter(file =>
        file.size >= query.sizeRange!.min && file.size <= query.sizeRange!.max
      )
    }

    return files
  }

  async getFilesByType(mimeType: string, userId: string): Promise<FileMetadata[]> {
    return this.listFiles(userId, { mimeType })
  }

  async getRecentFiles(userId: string, limit: number = 10): Promise<FileMetadata[]> {
    return this.listFiles(userId, {
      sortBy: 'created',
      sortOrder: 'desc',
      limit
    })
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new FileStorageError('File storage manager not initialized', 'NOT_INITIALIZED')
    }
  }

  private async initializeBackend(name: string, config: BackendConfig): Promise<void> {
    let backend: IStorageBackend

    switch (config.type) {
      case 'local':
        backend = new LocalFileStorage(name)
        break
      default:
        throw new FileStorageError(`Unsupported backend type: ${config.type}`, 'UNSUPPORTED_BACKEND')
    }

    await backend.initialize(config)
    this.backends.set(name, backend)
  }

  private getBackend(name: string): IStorageBackend {
    const backend = this.backends.get(name)
    if (!backend) {
      throw new FileStorageError(`Backend not found: ${name}`, 'BACKEND_NOT_FOUND')
    }
    return backend
  }

  private generateStoragePath(fileId: string): string {
    // Create hierarchical path: /ab/cd/abcd1234...
    const hash = crypto.createHash('md5').update(fileId).digest('hex')
    return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${fileId}`
  }

  private async calculateChecksum(stream: ReadableStream): Promise<string> {
    const hash = crypto.createHash('sha256')
    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        hash.update(value)
      }
    } finally {
      reader.releaseLock()
    }

    return hash.digest('hex')
  }

  private isImageOrVideo(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType.startsWith('video/')
  }

  private hasBasicAccess(metadata: FileMetadata, userId: string): boolean {
    return metadata.ownerId === userId ||
           metadata.access === 'public' ||
           metadata.permissions.some(p => p.userId === userId && p.action === 'read')
  }

  private async checkUserQuota(userId: string, fileSize: number): Promise<void> {
    const quota = this.userQuotas.get(userId) || { used: 0, quota: this.config.quotas.defaultUserQuota }

    if (quota.used + fileSize > quota.quota) {
      throw new QuotaExceededError(userId, quota.used + fileSize, quota.quota)
    }
  }

  private async updateUserQuota(userId: string, sizeChange: number): Promise<void> {
    const quota = this.userQuotas.get(userId) || { used: 0, quota: this.config.quotas.defaultUserQuota }
    quota.used += sizeChange
    this.userQuotas.set(userId, quota)
  }

  private async generateThumbnailsAsync(fileId: string, sizes: ThumbnailSize[]): Promise<void> {
    // Run thumbnail generation in background
    setImmediate(async () => {
      try {
        const metadata = this.fileMetadata.get(fileId)
        if (!metadata) return

        await this.generateThumbnails(fileId, sizes, metadata.ownerId)
        this.emit('thumbnails_generated', { fileId, sizes })
      } catch (error) {
        this.emit('thumbnail_generation_error', { fileId, sizes, error })
      }
    })
  }

  private startCleanupIntervals(): void {
    // Cleanup expired files
    setInterval(async () => {
      try {
        const expiredFiles = await this.cleanupExpiredFiles()
        if (expiredFiles.length > 0) {
          this.emit('expired_files_cleaned', { count: expiredFiles.length, files: expiredFiles })
        }
      } catch (error) {
        this.emit('cleanup_error', { type: 'expired_files', error })
      }
    }, this.config.cleanup.expiredFilesCheckInterval)

    // Additional cleanup intervals can be added here
  }
}