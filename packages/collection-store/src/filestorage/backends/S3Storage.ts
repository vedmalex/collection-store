/**
 * S3 Storage Backend Implementation
 * Phase 4: File Storage System - S3 Backend
 *
 * Supports AWS S3 and S3-compatible storage services including:
 * - MinIO, DigitalOcean Spaces, Wasabi, etc.
 * - Multipart uploads for large files
 * - Signed URLs for secure access
 * - Range requests for partial downloads
 * - Server-side encryption
 */

import { Readable, PassThrough } from 'stream'
import { pipeline } from 'stream/promises'

import { IStorageBackend, BackendConfig } from './IStorageBackend'
import {
  FileMetadata,
  BackendCapabilities,
  BackendHealth,
  ByteRange,
  StreamingOptions,
  UploadProgress
} from '../interfaces/types'
import {
  StorageBackendError,
  FileNotFoundError,
  BackendUnavailableError,
  SignedUrlError
} from '../interfaces/errors'

// Mock S3 client interfaces (in real implementation, use @aws-sdk/client-s3)
interface S3Client {
  send(command: any): Promise<any>
}

interface PutObjectCommand {
  input: {
    Bucket: string
    Key: string
    Body: any
    ContentType?: string
    ServerSideEncryption?: string
    Metadata?: Record<string, string>
  }
}

interface GetObjectCommand {
  input: {
    Bucket: string
    Key: string
    Range?: string
  }
}

interface DeleteObjectCommand {
  input: {
    Bucket: string
    Key: string
  }
}

interface HeadObjectCommand {
  input: {
    Bucket: string
    Key: string
  }
}

interface ListObjectsV2Command {
  input: {
    Bucket: string
    Prefix?: string
    MaxKeys?: number
  }
}

interface CreateMultipartUploadCommand {
  input: {
    Bucket: string
    Key: string
    ContentType?: string
  }
}

interface UploadPartCommand {
  input: {
    Bucket: string
    Key: string
    PartNumber: number
    UploadId: string
    Body: any
  }
}

interface CompleteMultipartUploadCommand {
  input: {
    Bucket: string
    Key: string
    UploadId: string
    MultipartUpload: {
      Parts: Array<{ ETag: string; PartNumber: number }>
    }
  }
}

interface GetObjectCommandOutput {
  Body?: any
  ContentLength?: number
  ContentType?: string
  LastModified?: Date
  ETag?: string
  Metadata?: Record<string, string>
}

export class S3Storage implements IStorageBackend {
  public readonly name: string
  public readonly type = 's3' as const

  private s3Client?: S3Client
  private bucket: string = ''
  private region: string = ''
  private endpoint?: string
  private accessKeyId: string = ''
  private secretAccessKey: string = ''
  private forcePathStyle: boolean = false
  private serverSideEncryption?: string
  private initialized = false

  // Multipart upload settings
  private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
  private readonly PART_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly MAX_PARTS = 10000

  constructor(name: string = 's3') {
    this.name = name
  }

  async initialize(config: BackendConfig): Promise<void> {
    try {
      this.bucket = config.bucket!
      this.region = config.region!
      this.endpoint = config.endpoint
      this.accessKeyId = config.accessKeyId!
      this.secretAccessKey = config.secretAccessKey!
      this.forcePathStyle = config.endpoint ? true : false // Use path style for custom endpoints
      this.serverSideEncryption = config.encryption?.enabled ? config.encryption.algorithm || 'AES256' : undefined

      // In a real implementation, initialize AWS SDK S3 client here
      this.s3Client = this.createS3Client()

      // Test connection
      await this.testConnection()

      this.initialized = true
    } catch (error) {
      throw new StorageBackendError(this.name, 'initialize', error as Error)
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false
    this.s3Client = undefined
  }

  async store(
    fileId: string,
    stream: ReadableStream,
    metadata: FileMetadata,
    options?: StreamingOptions
  ): Promise<void> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)
      const nodeStream = Readable.fromWeb(stream)

      // Determine if we should use multipart upload
      if (metadata.size >= this.MULTIPART_THRESHOLD) {
        await this.multipartUpload(key, nodeStream, metadata, options)
      } else {
        await this.singlePartUpload(key, nodeStream, metadata, options)
      }

    } catch (error) {
      throw new StorageBackendError(this.name, 'store', error as Error)
    }
  }

  async retrieve(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)
      const command = this.createGetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined
      })

      const response = await this.s3Client!.send(command) as GetObjectCommandOutput

      if (!response.Body) {
        throw new FileNotFoundError(fileId)
      }

      // Convert S3 response body to ReadableStream
      return Readable.toWeb(response.Body) as ReadableStream

    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new FileNotFoundError(fileId)
      }
      throw new StorageBackendError(this.name, 'retrieve', error as Error)
    }
  }

  async delete(fileId: string): Promise<void> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)
      const command = this.createDeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      await this.s3Client!.send(command)

    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw new StorageBackendError(this.name, 'delete', error as Error)
      }
      // If file doesn't exist, consider it already deleted
    }
  }

  async exists(fileId: string): Promise<boolean> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)
      const command = this.createHeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      await this.s3Client!.send(command)
      return true

    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false
      }
      throw new StorageBackendError(this.name, 'exists', error as Error)
    }
  }

  async getMetadata(fileId: string): Promise<Partial<FileMetadata> | null> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)
      const command = this.createHeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      const response = await this.s3Client!.send(command)

      return {
        size: response.ContentLength,
        mimeType: response.ContentType,
        updatedAt: response.LastModified,
        checksum: response.ETag?.replace(/"/g, ''), // Remove quotes from ETag
        storagePath: key
      }

    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null
      }
      throw new StorageBackendError(this.name, 'getMetadata', error as Error)
    }
  }

  async updateMetadata(fileId: string, metadata: Partial<FileMetadata>): Promise<void> {
    // S3 doesn't support in-place metadata updates
    // This would require copying the object with new metadata
    // For now, this is a no-op
  }

  async copy(sourceFileId: string, targetFileId: string): Promise<void> {
    this.ensureInitialized()

    try {
      const sourceKey = this.generateKey(sourceFileId)
      const targetKey = this.generateKey(targetFileId)

      // In real implementation, use CopyObjectCommand
      const copyCommand = {
        Bucket: this.bucket,
        Key: targetKey,
        CopySource: `${this.bucket}/${sourceKey}`
      }

      await this.s3Client!.send(copyCommand)

    } catch (error) {
      throw new StorageBackendError(this.name, 'copy', error as Error)
    }
  }

  async move(sourceFileId: string, targetFileId: string): Promise<void> {
    await this.copy(sourceFileId, targetFileId)
    await this.delete(sourceFileId)
  }

  async getSize(fileId: string): Promise<number> {
    const metadata = await this.getMetadata(fileId)
    if (!metadata || metadata.size === undefined) {
      throw new FileNotFoundError(fileId)
    }
    return metadata.size
  }

  async deleteMultiple(fileIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    // In real implementation, use DeleteObjectsCommand for batch deletion
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

    try {
      const command = this.createListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: limit
      })

      const response = await this.s3Client!.send(command)

      return (response.Contents || []).map((obj: any) => obj.Key)

    } catch (error) {
      throw new StorageBackendError(this.name, 'listFiles', error as Error)
    }
  }

  async generateSignedUrl(fileId: string, ttl: number, permissions: string[]): Promise<string> {
    this.ensureInitialized()

    try {
      const key = this.generateKey(fileId)

      // In real implementation, use getSignedUrl from @aws-sdk/s3-request-presigner
      const signedUrl = await this.createSignedUrl(key, ttl, permissions)

      return signedUrl

    } catch (error) {
      throw new SignedUrlError(fileId, (error as Error).message)
    }
  }

  async createReadStream(fileId: string, range?: ByteRange): Promise<ReadableStream> {
    return this.retrieve(fileId, range)
  }

  async createWriteStream(fileId: string, metadata: FileMetadata): Promise<WritableStream> {
    this.ensureInitialized()

    const key = this.generateKey(fileId)
    const passThrough = new PassThrough()

    // Start upload in background
    const uploadPromise = this.singlePartUpload(key, passThrough, metadata)

    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          passThrough.write(chunk, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      },
      close() {
        return new Promise((resolve, reject) => {
          passThrough.end()
          uploadPromise.then(() => resolve()).catch(reject)
        })
      },
      abort(reason) {
        passThrough.destroy()
        return Promise.resolve()
      }
    })
  }

  getCapabilities(): BackendCapabilities {
    return {
      supportsRangeRequests: true,
      supportsSignedUrls: true,
      supportsMetadata: true,
      maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
      supportedMimeTypes: ['*/*']
    }
  }

  async getHealth(): Promise<BackendHealth> {
    const startTime = performance.now()

    try {
      // Test basic connectivity by listing bucket
      const command = this.createListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1
      })

      await this.s3Client!.send(command)

      const latency = performance.now() - startTime

      return {
        status: 'healthy',
        latency,
        errorRate: 0,
        lastChecked: new Date(),
        details: {
          bucket: this.bucket,
          region: this.region,
          endpoint: this.endpoint
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
          bucket: this.bucket,
          region: this.region,
          endpoint: this.endpoint
        }
      }
    }
  }

  async validateConfig(config: BackendConfig): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!config.bucket) {
      errors.push('bucket is required for S3 storage')
    }

    if (!config.region) {
      errors.push('region is required for S3 storage')
    }

    if (!config.accessKeyId) {
      errors.push('accessKeyId is required for S3 storage')
    }

    if (!config.secretAccessKey) {
      errors.push('secretAccessKey is required for S3 storage')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized || !this.s3Client) {
      throw new BackendUnavailableError(this.name, 'Backend not initialized')
    }
  }

  private generateKey(fileId: string): string {
    // Create hierarchical key structure: prefix/ab/cd/abcd1234...
    const hash = fileId.substring(0, 8)
    return `files/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${fileId}`
  }

  private createS3Client(): S3Client {
    // In real implementation, create AWS SDK S3 client
    // For now, return a mock client
    return {
      send: async (command: any) => {
        // Mock implementation
        throw new Error('S3 client not implemented - this is a mock')
      }
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const command = this.createListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1
      })

      await this.s3Client!.send(command)
    } catch (error) {
      throw new Error(`Failed to connect to S3: ${(error as Error).message}`)
    }
  }

  private async singlePartUpload(
    key: string,
    stream: Readable,
    metadata: FileMetadata,
    options?: StreamingOptions
  ): Promise<void> {
    const command = this.createPutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentType: metadata.mimeType,
      ServerSideEncryption: this.serverSideEncryption,
      Metadata: {
        originalName: metadata.originalName,
        checksum: metadata.checksum,
        ownerId: metadata.ownerId
      }
    })

    await this.s3Client!.send(command)
  }

  private async multipartUpload(
    key: string,
    stream: Readable,
    metadata: FileMetadata,
    options?: StreamingOptions
  ): Promise<void> {
    // Initiate multipart upload
    const createCommand = this.createMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: metadata.mimeType
    })

    const createResponse = await this.s3Client!.send(createCommand)
    const uploadId = createResponse.UploadId

    try {
      const parts: Array<{ ETag: string; PartNumber: number }> = []
      let partNumber = 1
      let uploadedBytes = 0

      // Read stream in chunks and upload parts
      const chunks: Buffer[] = []
      let currentChunkSize = 0

      for await (const chunk of stream) {
        chunks.push(chunk)
        currentChunkSize += chunk.length

        if (currentChunkSize >= this.PART_SIZE || partNumber === this.MAX_PARTS) {
          const partData = Buffer.concat(chunks)

          const uploadCommand = this.createUploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: partData
          })

          const uploadResponse = await this.s3Client!.send(uploadCommand)

          parts.push({
            ETag: uploadResponse.ETag,
            PartNumber: partNumber
          })

          uploadedBytes += partData.length
          partNumber++

          // Report progress
          if (options?.progressCallback) {
            options.progressCallback({
              uploadedBytes,
              totalBytes: metadata.size,
              percentage: (uploadedBytes / metadata.size) * 100,
              speed: 0, // TODO: Calculate speed
              estimatedTimeRemaining: 0 // TODO: Calculate ETA
            })
          }

          // Reset for next part
          chunks.length = 0
          currentChunkSize = 0
        }
      }

      // Upload remaining data if any
      if (chunks.length > 0) {
        const partData = Buffer.concat(chunks)

        const uploadCommand = this.createUploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: partData
        })

        const uploadResponse = await this.s3Client!.send(uploadCommand)

        parts.push({
          ETag: uploadResponse.ETag,
          PartNumber: partNumber
        })
      }

      // Complete multipart upload
      const completeCommand = this.createCompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      })

      await this.s3Client!.send(completeCommand)

    } catch (error) {
      // Abort multipart upload on error
      try {
        const abortCommand = {
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId
        }
        await this.s3Client!.send(abortCommand)
      } catch (abortError) {
        console.warn('Failed to abort multipart upload:', abortError)
      }

      throw error
    }
  }

  private async createSignedUrl(key: string, ttl: number, permissions: string[]): Promise<string> {
    // In real implementation, use getSignedUrl from @aws-sdk/s3-request-presigner
    // For now, return a mock URL
    const operation = permissions.includes('write') ? 'putObject' : 'getObject'
    const expires = Math.floor(Date.now() / 1000) + ttl

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${ttl}&X-Amz-SignedHeaders=host&mock=true`
  }

  private isNotFoundError(error: any): boolean {
    return error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.statusCode === 404
  }

  // Command factory methods (mock implementations)
  private createPutObjectCommand(input: any): PutObjectCommand {
    return { input } as PutObjectCommand
  }

  private createGetObjectCommand(input: any): GetObjectCommand {
    return { input } as GetObjectCommand
  }

  private createDeleteObjectCommand(input: any): DeleteObjectCommand {
    return { input } as DeleteObjectCommand
  }

  private createHeadObjectCommand(input: any): HeadObjectCommand {
    return { input } as HeadObjectCommand
  }

  private createListObjectsV2Command(input: any): ListObjectsV2Command {
    return { input } as ListObjectsV2Command
  }

  private createMultipartUploadCommand(input: any): CreateMultipartUploadCommand {
    return { input } as CreateMultipartUploadCommand
  }

  private createUploadPartCommand(input: any): UploadPartCommand {
    return { input } as UploadPartCommand
  }

  private createCompleteMultipartUploadCommand(input: any): CompleteMultipartUploadCommand {
    return { input } as CompleteMultipartUploadCommand
  }
}