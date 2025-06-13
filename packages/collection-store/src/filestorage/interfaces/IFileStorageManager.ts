/**
 * Main File Storage Manager Interface
 * Phase 4: File Storage System - Core Interface
 */

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
  BackendHealth
} from './types'

export interface IFileStorageManager {
  // Core file operations
  upload(file: FileUpload, options: UploadOptions, userId: string): Promise<FileMetadata>
  download(fileId: string, options?: DownloadOptions, userId?: string): Promise<ReadableStream>
  delete(fileId: string, userId: string): Promise<void>

  // Metadata management
  getMetadata(fileId: string, userId?: string): Promise<FileMetadata>
  updateMetadata(fileId: string, updates: Partial<FileMetadata>, userId: string): Promise<FileMetadata>
  listFiles(userId: string, filters?: FileListFilters): Promise<FileMetadata[]>

  // Streaming support
  streamFile(fileId: string, range?: { start: number; end: number }, userId?: string): Promise<ReadableStream>
  getFileSize(fileId: string, userId?: string): Promise<number>

  // Thumbnail generation
  generateThumbnail(fileId: string, size: ThumbnailSize, userId: string): Promise<ThumbnailInfo>
  generateThumbnails(fileId: string, sizes: ThumbnailSize[], userId: string): Promise<ThumbnailInfo[]>
  getThumbnails(fileId: string, userId?: string): Promise<ThumbnailInfo[]>

  // Access control
  generateSignedUrl(fileId: string, options: SignedUrlOptions, userId: string): Promise<string>
  checkAccess(fileId: string, action: 'read' | 'write' | 'delete', userId: string): Promise<boolean>
  updatePermissions(fileId: string, permissions: any[], userId: string): Promise<void>

  // File validation
  validateFile(file: FileUpload, userId: string): Promise<{ isValid: boolean; errors: string[] }>
  detectMimeType(stream: ReadableStream): Promise<string>

  // Lifecycle management
  setExpiration(fileId: string, expiresAt: Date, userId: string): Promise<void>
  cleanupExpiredFiles(): Promise<string[]>
  getStorageUsage(userId: string): Promise<{ used: number; quota: number }>

  // Health and monitoring
  getHealth(): Promise<BackendHealth>
  getReplicationHealth(): Promise<ReplicationHealth>
  getStorageStats(): Promise<StorageStats>

  // Batch operations
  uploadMultiple(files: FileUpload[], options: UploadOptions, userId: string): Promise<FileOperationResult[]>
  deleteMultiple(fileIds: string[], userId: string): Promise<FileOperationResult[]>

  // Search and filtering
  searchFiles(query: FileSearchQuery, userId: string): Promise<FileMetadata[]>
  getFilesByType(mimeType: string, userId: string): Promise<FileMetadata[]>
  getRecentFiles(userId: string, limit?: number): Promise<FileMetadata[]>
}

export interface FileListFilters {
  mimeType?: string
  minSize?: number
  maxSize?: number
  createdAfter?: Date
  createdBefore?: Date
  access?: 'public' | 'private' | 'restricted'
  hasExpiration?: boolean
  limit?: number
  offset?: number
  sortBy?: 'name' | 'size' | 'created' | 'modified'
  sortOrder?: 'asc' | 'desc'
}

export interface FileSearchQuery {
  filename?: string
  mimeType?: string
  tags?: string[]
  content?: string // для полнотекстового поиска
  metadata?: Record<string, any>
  dateRange?: {
    start: Date
    end: Date
  }
  sizeRange?: {
    min: number
    max: number
  }
}

export interface StorageStats {
  totalFiles: number
  totalSize: number
  filesByType: Record<string, number>
  averageFileSize: number
  largestFile: {
    id: string
    size: number
    filename: string
  }
  oldestFile: {
    id: string
    createdAt: Date
    filename: string
  }
  recentActivity: {
    uploadsToday: number
    downloadsToday: number
    deletionsToday: number
  }
}