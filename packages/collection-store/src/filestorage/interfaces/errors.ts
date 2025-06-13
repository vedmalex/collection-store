/**
 * Error definitions for File Storage System
 * Phase 4: File Storage System - Error Handling
 */

export class FileStorageError extends Error {
  public readonly code: string
  public readonly details?: Record<string, any>

  constructor(message: string, code: string = 'FILE_STORAGE_ERROR', details?: Record<string, any>) {
    super(message)
    this.name = 'FileStorageError'
    this.code = code
    this.details = details
  }
}

export class FileNotFoundError extends FileStorageError {
  constructor(fileId: string) {
    super(`File not found: ${fileId}`, 'FILE_NOT_FOUND', { fileId })
    this.name = 'FileNotFoundError'
  }
}

export class FileAccessDeniedError extends FileStorageError {
  constructor(fileId: string, userId: string, action: string) {
    super(`Access denied for file ${fileId}`, 'FILE_ACCESS_DENIED', { fileId, userId, action })
    this.name = 'FileAccessDeniedError'
  }
}

export class FileValidationError extends FileStorageError {
  constructor(message: string, validationErrors: string[]) {
    super(message, 'FILE_VALIDATION_ERROR', { validationErrors })
    this.name = 'FileValidationError'
  }
}

export class FileSizeLimitError extends FileStorageError {
  constructor(actualSize: number, maxSize: number) {
    super(`File size ${actualSize} exceeds limit ${maxSize}`, 'FILE_SIZE_LIMIT', { actualSize, maxSize })
    this.name = 'FileSizeLimitError'
  }
}

export class FileSizeExceededError extends FileStorageError {
  constructor(actualSize: number, maxSize: number) {
    super(`File size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes`, 'FILE_SIZE_EXCEEDED', {
      actualSize,
      maxSize
    })
    this.name = 'FileSizeExceededError'
  }
}

export class UnsupportedFileTypeError extends FileStorageError {
  constructor(mimeType: string, supportedTypes: string[]) {
    super(`Unsupported file type: ${mimeType}`, 'UNSUPPORTED_FILE_TYPE', { mimeType, supportedTypes })
    this.name = 'UnsupportedFileTypeError'
  }
}

export class ChecksumMismatchError extends FileStorageError {
  constructor(expected: string, actual: string) {
    super(`Checksum mismatch: expected ${expected}, got ${actual}`, 'CHECKSUM_MISMATCH', { expected, actual })
    this.name = 'ChecksumMismatchError'
  }
}

export class StorageBackendError extends FileStorageError {
  constructor(backend: string, operation: string, originalError: Error) {
    super(`Storage backend error in ${backend} during ${operation}: ${originalError.message}`, 'STORAGE_BACKEND_ERROR', {
      backend,
      operation,
      originalError: originalError.message
    })
    this.name = 'StorageBackendError'
  }
}

export class ThumbnailGenerationError extends FileStorageError {
  constructor(fileId: string, reason: string) {
    super(`Failed to generate thumbnail for ${fileId}: ${reason}`, 'THUMBNAIL_GENERATION_ERROR', { fileId, reason })
    this.name = 'ThumbnailGenerationError'
  }
}

export class FileReplicationError extends FileStorageError {
  constructor(fileId: string, targetNode: string, reason: string) {
    super(`Failed to replicate file ${fileId} to ${targetNode}: ${reason}`, 'FILE_REPLICATION_ERROR', {
      fileId,
      targetNode,
      reason
    })
    this.name = 'FileReplicationError'
  }
}

export class StreamingError extends FileStorageError {
  constructor(operation: string, reason: string) {
    super(`Streaming error during ${operation}: ${reason}`, 'STREAMING_ERROR', { operation, reason })
    this.name = 'StreamingError'
  }
}

export class SignedUrlError extends FileStorageError {
  constructor(fileId: string, reason: string) {
    super(`Failed to generate signed URL for ${fileId}: ${reason}`, 'SIGNED_URL_ERROR', { fileId, reason })
    this.name = 'SignedUrlError'
  }
}

export class FileExpiredError extends FileStorageError {
  constructor(fileId: string, expiredAt: Date) {
    super(`File ${fileId} expired at ${expiredAt.toISOString()}`, 'FILE_EXPIRED', { fileId, expiredAt })
    this.name = 'FileExpiredError'
  }
}

export class QuotaExceededError extends FileStorageError {
  constructor(userId: string, currentUsage: number, quota: number) {
    super(`Storage quota exceeded for user ${userId}: ${currentUsage}/${quota} bytes`, 'QUOTA_EXCEEDED', {
      userId,
      currentUsage,
      quota
    })
    this.name = 'QuotaExceededError'
  }
}

export class ConcurrentModificationError extends FileStorageError {
  constructor(fileId: string) {
    super(`Concurrent modification detected for file ${fileId}`, 'CONCURRENT_MODIFICATION', { fileId })
    this.name = 'ConcurrentModificationError'
  }
}

export class BackendUnavailableError extends FileStorageError {
  constructor(backend: string, reason: string) {
    super(`Storage backend ${backend} is unavailable: ${reason}`, 'BACKEND_UNAVAILABLE', { backend, reason })
    this.name = 'BackendUnavailableError'
  }
}

export class MetadataCorruptionError extends FileStorageError {
  constructor(fileId: string, reason: string) {
    super(`Metadata corruption detected for file ${fileId}: ${reason}`, 'METADATA_CORRUPTION', { fileId, reason })
    this.name = 'MetadataCorruptionError'
  }
}

export class ReplicationError extends FileStorageError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'REPLICATION_ERROR', details)
    this.name = 'ReplicationError'
  }
}