/**
 * Storage Backend Interface
 * Phase 4: File Storage System - Backend Abstraction
 */

import {
  FileMetadata,
  BackendCapabilities,
  BackendHealth,
  ByteRange,
  StreamingOptions
} from '../interfaces/types'

export interface IStorageBackend {
  // Backend identification
  readonly name: string
  readonly type: 'local' | 's3' | 'azure' | 'gcs' | 'custom'

  // Core operations
  store(fileId: string, stream: ReadableStream, metadata: FileMetadata, options?: StreamingOptions): Promise<void>
  retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream>
  delete(fileId: string): Promise<void>
  exists(fileId: string): Promise<boolean>

  // Metadata operations
  getMetadata(fileId: string): Promise<Partial<FileMetadata> | null>
  updateMetadata(fileId: string, metadata: Partial<FileMetadata>): Promise<void>

  // Advanced operations
  copy(sourceFileId: string, targetFileId: string): Promise<void>
  move(sourceFileId: string, targetFileId: string): Promise<void>
  getSize(fileId: string): Promise<number>

  // Batch operations
  deleteMultiple(fileIds: string[]): Promise<{ success: string[]; failed: string[] }>
  listFiles(prefix?: string, limit?: number): Promise<string[]>

  // Signed URLs (if supported)
  generateSignedUrl?(fileId: string, ttl: number, permissions: string[]): Promise<string>

  // Backend capabilities and health
  getCapabilities(): BackendCapabilities
  getHealth(): Promise<BackendHealth>

  // Configuration and lifecycle
  initialize(config: BackendConfig): Promise<void>
  shutdown(): Promise<void>

  // Streaming support
  createReadStream(fileId: string, range?: ByteRange): Promise<ReadableStream>
  createWriteStream(fileId: string, metadata: FileMetadata): Promise<WritableStream>

  // Validation
  validateConfig(config: BackendConfig): Promise<{ isValid: boolean; errors: string[] }>
}

export interface BackendConfig {
  // Common configuration
  name: string
  type: 'local' | 's3' | 'azure' | 'gcs' | 'custom'

  // Local storage config
  basePath?: string
  permissions?: string

  // S3 config
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
  bucket?: string
  endpoint?: string

  // Azure config
  connectionString?: string
  containerName?: string
  accountName?: string
  accountKey?: string

  // GCS config
  projectId?: string
  keyFilename?: string
  bucketName?: string

  // Advanced options
  encryption?: {
    enabled: boolean
    algorithm?: string
    key?: string
  }
  compression?: {
    enabled: boolean
    algorithm?: 'gzip' | 'brotli'
    level?: number
  }
  retryPolicy?: {
    maxRetries: number
    backoffMultiplier: number
    maxBackoffTime: number
  }
  timeout?: number
  maxConcurrentOperations?: number
}

export interface BackendFactory {
  createBackend(config: BackendConfig): Promise<IStorageBackend>
  getSupportedTypes(): string[]
  validateConfig(config: BackendConfig): Promise<{ isValid: boolean; errors: string[] }>
}

export interface BackendManager {
  // Backend management
  registerBackend(name: string, backend: IStorageBackend): void
  unregisterBackend(name: string): void
  getBackend(name: string): IStorageBackend | null
  getDefaultBackend(): IStorageBackend
  setDefaultBackend(name: string): void

  // Health monitoring
  checkAllBackends(): Promise<Record<string, BackendHealth>>
  getHealthyBackends(): Promise<string[]>
  getUnhealthyBackends(): Promise<string[]>

  // Load balancing
  selectBackendForUpload(fileSize: number, mimeType: string): Promise<string>
  selectBackendForDownload(fileId: string): Promise<string>

  // Configuration
  updateBackendConfig(name: string, config: Partial<BackendConfig>): Promise<void>
  getBackendConfig(name: string): BackendConfig | null
}