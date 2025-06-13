/**
 * Core types and interfaces for File Storage System
 * Phase 4: File Storage System - Core Types
 */

export interface FileMetadata {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  checksum: string

  // Storage info
  backend: string
  storagePath: string
  bucketName?: string

  // Access control
  access: 'public' | 'private' | 'restricted'
  ownerId: string
  permissions: FilePermission[]

  // Lifecycle
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
  lastAccessedAt?: Date

  // Media-specific metadata
  imageMetadata?: ImageMetadata
  videoMetadata?: VideoMetadata
  documentMetadata?: DocumentMetadata

  // Thumbnails
  thumbnails: ThumbnailInfo[]

  // Replication
  replicationNodes: string[]
  replicationStatus: 'pending' | 'completed' | 'failed'
}

export interface FileUpload {
  filename: string
  mimeType: string
  size: number
  stream: ReadableStream
  checksum?: string
}

export interface UploadOptions {
  backend?: 'local' | 's3' | 'azure' | 'gcs'
  access: 'public' | 'private' | 'restricted'
  ttl?: number // время жизни файла в секундах
  generateThumbnails?: boolean
  thumbnailSizes?: ThumbnailSize[]
  chunkSize?: number // для streaming upload
  replicate?: boolean
  replicationNodes?: string[]
}

export interface DownloadOptions {
  range?: ByteRange
  includeMetadata?: boolean
  trackAccess?: boolean
}

export interface ByteRange {
  start: number
  end: number
}

export interface ThumbnailSize {
  width: number
  height: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface ThumbnailInfo {
  id: string
  sourceFileId: string
  size: ThumbnailSize
  fileId: string
  mimeType: string
  generatedAt: Date
  backend: string
  storagePath: string
}

export interface FilePermission {
  userId?: string
  roleId?: string
  action: 'read' | 'write' | 'delete' | 'admin'
  conditions?: Record<string, any>
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  colorSpace: string
  hasAlpha: boolean
  exif?: Record<string, any>
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  format: string
  codec: string
  bitrate: number
  fps: number
}

export interface DocumentMetadata {
  pageCount: number
  format: string
  title?: string
  author?: string
  createdAt?: Date
}

export interface BackendCapabilities {
  supportsRangeRequests: boolean
  supportsSignedUrls: boolean
  supportsMetadata: boolean
  maxFileSize: number
  supportedMimeTypes: string[]
}

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  errorRate: number
  lastChecked: Date
  details?: Record<string, any>
}

export interface UploadProgress {
  uploadedBytes: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
}

export interface ReplicationHealth {
  totalFiles: number
  replicatedFiles: number
  missingReplicas: string[]
  corruptedFiles: string[]
  lastSyncTime: Date
}

export interface ThumbnailOptions {
  quality?: number // 1-100
  format?: 'jpeg' | 'png' | 'webp'
  crop?: 'center' | 'smart' | 'entropy'
  background?: string // для PNG с прозрачностью
}

export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  detectedMimeType?: string
  actualSize?: number
}

export interface SignedUrlOptions {
  ttl: number // seconds
  permissions: ('read' | 'write' | 'delete')[]
  ipRestriction?: string[]
  downloadFilename?: string
}

export interface FileOperationResult {
  success: boolean
  fileId?: string
  metadata?: FileMetadata
  error?: string
  executionTime: number
  memoryUsage: number
}

export interface StreamingOptions {
  chunkSize: number
  compression: boolean
  progressCallback?: (progress: UploadProgress) => void
  abortSignal?: AbortSignal
}

export interface FileListFilters {
  ownerId?: string
  mimeType?: string
  access?: 'public' | 'private' | 'restricted'
  minSize?: number
  maxSize?: number
  createdAfter?: Date
  createdBefore?: Date
  hasExpiration?: boolean
  sortBy?: 'name' | 'size' | 'created' | 'modified'
  sortOrder?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface FileSearchQuery {
  filename?: string
  mimeType?: string
  ownerId?: string
  dateRange?: {
    start: Date
    end: Date
  }
  sizeRange?: {
    min: number
    max: number
  }
}

// Replication types
export interface NodeInfo {
  id: string
  address: string
  port: number
  status: 'online' | 'offline' | 'degraded'
  lastSeen: Date
  capabilities: string[]
}

export interface ReplicationConfig {
  enabled: boolean
  minReplicas: number
  maxReplicas: number
  preferredNodes: string[]
  strategy: 'direct' | 'chunked' | 'streaming'
  healthCheckInterval: number
}

export interface ReplicationStrategy {
  name: string
  replicate(fileId: string, targetNodes: string[], metadata?: FileMetadata): Promise<void>
  canHandle(metadata: FileMetadata): boolean
  getEstimatedTime(metadata: FileMetadata): number
}

export interface ReplicationJob {
  id: string
  fileId: string
  targetNodes: string[]
  sourceNode: string
  strategy: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying'
  progress: number
  startTime: Date
  endTime?: Date
  retryCount: number
  error?: string
  metadata?: FileMetadata
}

export interface ReplicationStats {
  totalReplications: number
  successfulReplications: number
  failedReplications: number
  averageReplicationTime: number
  totalBytesReplicated: number
  activeReplications: number
  nodeHealth: Map<string, any>
  lastHealthCheck: Date
}

export interface WALEntry {
  type: string
  transactionId: string
  timestamp: number
  data: any
}

// User interface for file operations
export interface User {
  id: string
  email?: string
  roles?: string[]
  permissions?: string[]
}