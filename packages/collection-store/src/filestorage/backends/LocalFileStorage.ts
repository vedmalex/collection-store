/**
 * Local File Storage Backend
 * Phase 4: File Storage System - Local Implementation
 */

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { Readable } from 'stream'

import { IStorageBackend, BackendConfig } from './IStorageBackend'
import {
  FileMetadata,
  BackendCapabilities,
  BackendHealth,
  ByteRange,
  StreamingOptions
} from '../interfaces/types'
import {
  StorageBackendError,
  FileNotFoundError,
  BackendUnavailableError
} from '../interfaces/errors'

export class LocalFileStorage implements IStorageBackend {
  public readonly name: string
  public readonly type = 'local' as const

  private basePath: string
  private permissions: string
  private initialized = false

  constructor(name: string = 'local') {
    this.name = name
    this.basePath = ''
    this.permissions = '0644'
  }

  async initialize(config: BackendConfig): Promise<void> {
    try {
      this.basePath = config.basePath || './storage'
      this.permissions = config.permissions || '0644'

      // Ensure base directory exists
      await this.ensureDirectory(this.basePath)

      // Create subdirectories for organization
      await this.ensureDirectory(path.join(this.basePath, 'files'))
      await this.ensureDirectory(path.join(this.basePath, 'temp'))
      await this.ensureDirectory(path.join(this.basePath, 'thumbnails'))

      this.initialized = true
    } catch (error) {
      throw new StorageBackendError(this.name, 'initialize', error as Error)
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false
  }

  async store(
    fileId: string,
    stream: ReadableStream,
    metadata: FileMetadata,
    options?: StreamingOptions
  ): Promise<void> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)
    const tempPath = this.getTempPath(fileId)

    try {
      // Ensure directory exists
      await this.ensureDirectory(path.dirname(filePath))

      // Create write stream to temp location first
      const writeStream = fsSync.createWriteStream(tempPath, {
        mode: parseInt(this.permissions, 8)
      })

      // Convert ReadableStream to Node.js Readable and write to file
      const reader = stream.getReader()
      let uploadedBytes = 0
      const hash = crypto.createHash('sha256')

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            writeStream.write(value)
            hash.update(value)
            uploadedBytes += value.length

            // Report progress if callback provided
            if (options?.progressCallback) {
              options.progressCallback({
                uploadedBytes,
                totalBytes: metadata.size,
                percentage: (uploadedBytes / metadata.size) * 100,
                speed: 0, // TODO: Calculate speed
                estimatedTimeRemaining: 0 // TODO: Calculate ETA
              })
            }
          }
        }

        // Close the write stream
        await new Promise<void>((resolve, reject) => {
          writeStream.end((error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        // Update metadata with calculated checksum if it was pending
        if (metadata.checksum === 'pending') {
          metadata.checksum = hash.digest('hex')
        }
      } finally {
        reader.releaseLock()
      }

      // Verify file size matches metadata
      const stats = await fs.stat(tempPath)
      if (stats.size !== metadata.size) {
        await fs.unlink(tempPath).catch(() => {}) // Cleanup
        throw new Error(`File size mismatch: expected ${metadata.size}, got ${stats.size}`)
      }

      // Move from temp to final location atomically
      await fs.rename(tempPath, filePath)

    } catch (error) {
      // Cleanup temp file on error
      await fs.unlink(tempPath).catch(() => {})
      throw new StorageBackendError(this.name, 'store', error as Error)
    }
  }

  async retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      // Check if file exists
      await fs.access(filePath)

      let readStream: fsSync.ReadStream

      if (range) {
        // Create range-based read stream
        readStream = fsSync.createReadStream(filePath, {
          start: range.start,
          end: range.end
        })
      } else {
        // Create full file read stream
        readStream = fsSync.createReadStream(filePath)
      }

      // Convert Node.js Readable to ReadableStream
      return Readable.toWeb(readStream) as ReadableStream

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new FileNotFoundError(fileId)
      }
      throw new StorageBackendError(this.name, 'retrieve', error as Error)
    }
  }

  async delete(fileId: string): Promise<void> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist - consider it already deleted
        return
      }
      throw new StorageBackendError(this.name, 'delete', error as Error)
    }
  }

  async exists(fileId: string): Promise<boolean> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async getMetadata(fileId: string): Promise<Partial<FileMetadata> | null> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      const stats = await fs.stat(filePath)

      return {
        size: stats.size,
        updatedAt: stats.mtime,
        storagePath: filePath
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null
      }
      throw new StorageBackendError(this.name, 'getMetadata', error as Error)
    }
  }

  async updateMetadata(fileId: string, metadata: Partial<FileMetadata>): Promise<void> {
    // Local storage doesn't support extended metadata
    // This is a no-op for local backend
  }

  async copy(sourceFileId: string, targetFileId: string): Promise<void> {
    this.ensureInitialized()

    const sourcePath = this.getFilePath(sourceFileId)
    const targetPath = this.getFilePath(targetFileId)

    try {
      await this.ensureDirectory(path.dirname(targetPath))
      await fs.copyFile(sourcePath, targetPath)
    } catch (error) {
      throw new StorageBackendError(this.name, 'copy', error as Error)
    }
  }

  async move(sourceFileId: string, targetFileId: string): Promise<void> {
    this.ensureInitialized()

    const sourcePath = this.getFilePath(sourceFileId)
    const targetPath = this.getFilePath(targetFileId)

    try {
      await this.ensureDirectory(path.dirname(targetPath))
      await fs.rename(sourcePath, targetPath)
    } catch (error) {
      throw new StorageBackendError(this.name, 'move', error as Error)
    }
  }

  async getSize(fileId: string): Promise<number> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      const stats = await fs.stat(filePath)
      return stats.size
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new FileNotFoundError(fileId)
      }
      throw new StorageBackendError(this.name, 'getSize', error as Error)
    }
  }

  async deleteMultiple(fileIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    for (const fileId of fileIds) {
      try {
        await this.delete(fileId)
        success.push(fileId)
      } catch {
        failed.push(fileId)
      }
    }

    return { success, failed }
  }

  async listFiles(prefix?: string, limit?: number): Promise<string[]> {
    this.ensureInitialized()

    const filesDir = path.join(this.basePath, 'files')

    try {
      const files = await this.getAllFiles(filesDir)
      let filteredFiles = files

      if (prefix) {
        filteredFiles = files.filter(file => file.startsWith(prefix))
      }

      if (limit) {
        filteredFiles = filteredFiles.slice(0, limit)
      }

      return filteredFiles.map(file => path.relative(filesDir, file))
    } catch (error) {
      throw new StorageBackendError(this.name, 'listFiles', error as Error)
    }
  }

  async createReadStream(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    return this.retrieve(fileId, range)
  }

  async createWriteStream(fileId: string, metadata: FileMetadata): Promise<WritableStream> {
    this.ensureInitialized()

    const filePath = this.getFilePath(fileId)

    try {
      await this.ensureDirectory(path.dirname(filePath))

      const writeStream = fsSync.createWriteStream(filePath, {
        mode: parseInt(this.permissions, 8)
      })

      return new WritableStream({
        write(chunk) {
          return new Promise((resolve, reject) => {
            writeStream.write(chunk, (error) => {
              if (error) reject(error)
              else resolve()
            })
          })
        },
        close() {
          return new Promise((resolve) => {
            writeStream.end(() => resolve())
          })
        },
        abort(reason) {
          writeStream.destroy()
          return fs.unlink(filePath).catch(() => {})
        }
      })
    } catch (error) {
      throw new StorageBackendError(this.name, 'createWriteStream', error as Error)
    }
  }

  getCapabilities(): BackendCapabilities {
    return {
      supportsRangeRequests: true,
      supportsSignedUrls: false,
      supportsMetadata: false,
      maxFileSize: Number.MAX_SAFE_INTEGER,
      supportedMimeTypes: ['*/*'] // Supports all mime types
    }
  }

  async getHealth(): Promise<BackendHealth> {
    const startTime = performance.now()

    try {
      // Test write/read/delete operation
      const testFileId = `health-check-${Date.now()}`
      const testData = 'health check'
      const testStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(testData))
          controller.close()
        }
      })

      const testMetadata: FileMetadata = {
        id: testFileId,
        filename: 'health-check.txt',
        originalName: 'health-check.txt',
        mimeType: 'text/plain',
        size: testData.length,
        checksum: '',
        backend: this.name,
        storagePath: '',
        access: 'private',
        ownerId: 'system',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnails: [],
        replicationNodes: [],
        replicationStatus: 'completed'
      }

      await this.store(testFileId, testStream, testMetadata)
      await this.retrieve(testFileId)
      await this.delete(testFileId)

      const latency = performance.now() - startTime

      return {
        status: 'healthy',
        latency,
        errorRate: 0,
        lastChecked: new Date(),
        details: {
          basePath: this.basePath,
          initialized: this.initialized
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastChecked: new Date(),
        details: {
          error: (error as Error).message,
          basePath: this.basePath,
          initialized: this.initialized
        }
      }
    }
  }

  async validateConfig(config: BackendConfig): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!config.basePath) {
      errors.push('basePath is required for local storage')
    }

    if (config.basePath) {
      try {
        await fs.access(path.dirname(config.basePath))
      } catch {
        errors.push(`Parent directory of basePath does not exist: ${config.basePath}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new BackendUnavailableError(this.name, 'Backend not initialized')
    }
  }

  private getFilePath(fileId: string): string {
    // Create subdirectories based on first 2 characters of fileId for better distribution
    const subDir = fileId.substring(0, 2)
    return path.join(this.basePath, 'files', subDir, fileId)
  }

  private getTempPath(fileId: string): string {
    return path.join(this.basePath, 'temp', `${fileId}.tmp`)
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    async function traverse(currentDir: string): Promise<void> {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else {
          files.push(fullPath)
        }
      }
    }

    await traverse(dir)
    return files
  }
}