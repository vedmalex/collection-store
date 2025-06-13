/**
 * Streaming Manager
 * Phase 4: File Storage System - Streaming Support
 *
 * Provides efficient streaming operations including:
 * - Chunked file uploads with progress tracking
 * - Streaming downloads with range support
 * - Stream transformations and compression
 * - Memory-efficient processing of large files
 * - Abort signal support for cancellation
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import {
  StreamingOptions,
  UploadProgress,
  ByteRange,
  FileUpload
} from '../interfaces/types'
import {
  StreamingError,
  FileStorageError
} from '../interfaces/errors'

export interface StreamingManagerConfig {
  defaultChunkSize: number
  maxConcurrentStreams: number
  enableCompression: boolean
  compressionLevel: number
  progressUpdateInterval: number
  timeoutMs: number
}

export interface StreamChunk {
  data: Uint8Array
  index: number
  isLast: boolean
  checksum?: string
}

export interface StreamProgress {
  bytesProcessed: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
  chunksProcessed: number
  totalChunks: number
}

export interface StreamTransform {
  name: string
  transform: (chunk: Uint8Array) => Promise<Uint8Array>
  finalize?: () => Promise<Uint8Array | null>
}

export class StreamingManager extends EventEmitter {
  private config: StreamingManagerConfig
  private activeStreams = new Map<string, AbortController>()
  private streamStats = new Map<string, StreamProgress>()

  constructor(config: Partial<StreamingManagerConfig> = {}) {
    super()

    this.config = {
      defaultChunkSize: 64 * 1024, // 64KB default
      maxConcurrentStreams: 10,
      enableCompression: false,
      compressionLevel: 6,
      progressUpdateInterval: 100, // ms
      timeoutMs: 30000, // 30 seconds
      ...config
    }
  }

  /**
   * Create a chunked upload stream from a file
   */
  async createUploadStream(
    file: FileUpload,
    options: StreamingOptions = {
      chunkSize: this.config.defaultChunkSize,
      compression: this.config.enableCompression
    }
  ): Promise<ReadableStream<StreamChunk>> {
    const streamId = this.generateStreamId()
    const abortController = new AbortController()
    this.activeStreams.set(streamId, abortController)

    const chunkSize = options.chunkSize || this.config.defaultChunkSize
    const totalChunks = Math.ceil(file.size / chunkSize)

    let chunkIndex = 0
    let bytesProcessed = 0
    let buffer = new Uint8Array(0)
    let sourceReader: any = null
    let sourceFinished = false
    const startTime = Date.now()

    const progress: StreamProgress = {
      bytesProcessed: 0,
      totalBytes: file.size,
      percentage: 0,
      speed: 0,
      estimatedTimeRemaining: 0,
      chunksProcessed: 0,
      totalChunks
    }

    this.streamStats.set(streamId, progress)

    return new ReadableStream<StreamChunk>({
      start: (controller) => {
        sourceReader = file.stream.getReader()
        this.emit('stream_started', { streamId, file, options })
      },

      pull: async (controller) => {
        try {
          if (abortController.signal.aborted) {
            controller.close()
            this.cleanup(streamId)
            return
          }

          // Fill buffer until we have enough for a chunk or source is finished
          while (buffer.length < chunkSize && !sourceFinished) {
            const { done, value } = await sourceReader!.read()

            if (done) {
              sourceFinished = true
              break
            }

            // Append new data to buffer
            const newBuffer = new Uint8Array(buffer.length + value.length)
            newBuffer.set(buffer)
            newBuffer.set(value, buffer.length)
            buffer = newBuffer
          }

          // If no data left, close stream
          if (buffer.length === 0 && sourceFinished) {
            controller.close()
            this.emit('stream_completed', { streamId, progress })
            this.cleanup(streamId)
            return
          }

          // Extract chunk from buffer
          const actualChunkSize = Math.min(chunkSize, buffer.length)
          let chunkData = buffer.slice(0, actualChunkSize)
          buffer = buffer.slice(actualChunkSize)

          // Check if this is the last chunk
          const isLast = sourceFinished && buffer.length === 0

          // Process chunk
          if (options.compression) {
            chunkData = new Uint8Array(await this.compressChunk(chunkData))
          }

          // Calculate checksum for chunk
          const checksum = this.calculateChunkChecksum(chunkData)

          const chunk: StreamChunk = {
            data: chunkData,
            index: chunkIndex++,
            isLast,
            checksum
          }

          // Update progress
          bytesProcessed += actualChunkSize
          const elapsed = Date.now() - startTime
          const speed = elapsed > 0 ? (bytesProcessed / elapsed) * 1000 : 0
          const remaining = speed > 0 ? (file.size - bytesProcessed) / speed : 0

          progress.bytesProcessed = bytesProcessed
          progress.percentage = (bytesProcessed / file.size) * 100
          progress.speed = speed
          progress.estimatedTimeRemaining = remaining
          progress.chunksProcessed = chunkIndex

          // Emit progress update
          if (options.progressCallback) {
            options.progressCallback({
              uploadedBytes: bytesProcessed,
              totalBytes: file.size,
              percentage: progress.percentage,
              speed: progress.speed,
              estimatedTimeRemaining: progress.estimatedTimeRemaining
            })
          }

          this.emit('stream_progress', { streamId, progress })

          controller.enqueue(chunk)

        } catch (error) {
          controller.error(new StreamingError('upload', error instanceof Error ? error.message : 'Unknown error'))
          this.cleanup(streamId)
        }
      },

      cancel: () => {
        abortController.abort()
        sourceReader?.releaseLock()
        this.emit('stream_cancelled', { streamId })
        this.cleanup(streamId)
      }
    })
  }

  /**
   * Create a download stream with range support
   */
  async createDownloadStream(
    data: Uint8Array,
    range?: ByteRange,
    options: StreamingOptions = {
      chunkSize: this.config.defaultChunkSize,
      compression: false
    }
  ): Promise<ReadableStream<Uint8Array>> {
    const streamId = this.generateStreamId()
    const abortController = new AbortController()
    this.activeStreams.set(streamId, abortController)

    // Apply range if specified
    let streamData = data
    if (range) {
      const start = Math.max(0, range.start)
      const end = Math.min(data.length - 1, range.end)
      streamData = data.slice(start, end + 1)
    }

    const chunkSize = options.chunkSize || this.config.defaultChunkSize
    let offset = 0

    return new ReadableStream<Uint8Array>({
      start: () => {
        this.emit('download_started', { streamId, size: streamData.length, range })
      },

      pull: async (controller) => {
        try {
          if (abortController.signal.aborted) {
            controller.close()
            this.cleanup(streamId)
            return
          }

          if (offset >= streamData.length) {
            controller.close()
            this.emit('download_completed', { streamId })
            this.cleanup(streamId)
            return
          }

          const end = Math.min(offset + chunkSize, streamData.length)
          let chunk = streamData.slice(offset, end)

                     // Apply compression if requested
           if (options.compression) {
             chunk = new Uint8Array(await this.compressChunk(chunk))
           }

          controller.enqueue(chunk)
          offset = end

          this.emit('download_progress', {
            streamId,
            bytesStreamed: offset,
            totalBytes: streamData.length,
            percentage: (offset / streamData.length) * 100
          })

        } catch (error) {
          controller.error(new StreamingError('download', error instanceof Error ? error.message : 'Unknown error'))
          this.cleanup(streamId)
        }
      },

      cancel: () => {
        abortController.abort()
        this.emit('download_cancelled', { streamId })
        this.cleanup(streamId)
      }
    })
  }

  /**
   * Transform a stream with custom transformations
   */
  async transformStream(
    sourceStream: ReadableStream<Uint8Array>,
    transforms: StreamTransform[]
  ): Promise<ReadableStream<Uint8Array>> {
    const streamId = this.generateStreamId()

    return new ReadableStream<Uint8Array>({
      start: () => {
        this.emit('transform_started', { streamId, transforms: transforms.map(t => t.name) })
      },

      pull: async (controller) => {
        try {
          const reader = sourceStream.getReader()
          const { done, value } = await reader.read()
          reader.releaseLock()

          if (done) {
            // Apply finalization transforms
            for (const transform of transforms) {
              if (transform.finalize) {
                const finalChunk = await transform.finalize()
                if (finalChunk) {
                  controller.enqueue(finalChunk)
                }
              }
            }

            controller.close()
            this.emit('transform_completed', { streamId })
            return
          }

          // Apply all transforms sequentially
          let transformedData = value
          for (const transform of transforms) {
            transformedData = await transform.transform(transformedData)
          }

          controller.enqueue(transformedData)

        } catch (error) {
          controller.error(new StreamingError('transform', error instanceof Error ? error.message : 'Unknown error'))
        }
      }
    })
  }

  /**
   * Merge multiple streams into one
   */
  async mergeStreams(streams: ReadableStream<Uint8Array>[]): Promise<ReadableStream<Uint8Array>> {
    const streamId = this.generateStreamId()
    let currentStreamIndex = 0
    let currentReader: any = null

    return new ReadableStream<Uint8Array>({
      start: () => {
        this.emit('merge_started', { streamId, streamCount: streams.length })
      },

      pull: async (controller) => {
        try {
          while (currentStreamIndex < streams.length) {
            // Get reader for current stream if we don't have one
            if (!currentReader) {
              currentReader = streams[currentStreamIndex].getReader()
            }

            const { done, value } = await currentReader.read()

            if (done) {
              // Current stream is done, move to next
              currentReader.releaseLock()
              currentReader = null
              currentStreamIndex++
              continue
            }

            // We have data, enqueue it
            controller.enqueue(value)
            return
          }

          // All streams are done
          controller.close()
          this.emit('merge_completed', { streamId })

        } catch (error) {
          if (currentReader) {
            currentReader.releaseLock()
          }
          controller.error(new StreamingError('merge', error instanceof Error ? error.message : 'Unknown error'))
        }
      },

      cancel: () => {
        if (currentReader) {
          currentReader.releaseLock()
        }
      }
    })
  }

  /**
   * Split a stream into multiple streams based on size
   */
  async splitStream(
    sourceStream: ReadableStream<Uint8Array>,
    maxSizePerStream: number
  ): Promise<ReadableStream<Uint8Array>[]> {
    // First, read all data from source stream
    const reader = sourceStream.getReader()
    const chunks: Uint8Array[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    // Combine all chunks into one buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const allData = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      allData.set(chunk, offset)
      offset += chunk.length
    }

    // Split the data into multiple streams
    const streams: ReadableStream<Uint8Array>[] = []
    let currentOffset = 0

    while (currentOffset < allData.length) {
      const endOffset = Math.min(currentOffset + maxSizePerStream, allData.length)
      const streamData = allData.slice(currentOffset, endOffset)

      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          controller.enqueue(streamData)
          controller.close()
        }
      })

      streams.push(stream)
      currentOffset = endOffset
    }

    return streams
  }

  /**
   * Calculate stream statistics
   */
  getStreamStats(streamId: string): StreamProgress | null {
    return this.streamStats.get(streamId) || null
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys())
  }

  /**
   * Cancel a specific stream
   */
  cancelStream(streamId: string): boolean {
    const controller = this.activeStreams.get(streamId)
    if (controller) {
      controller.abort()
      this.cleanup(streamId)
      return true
    }
    return false
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    for (const [streamId, controller] of this.activeStreams.entries()) {
      controller.abort()
      this.cleanup(streamId)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StreamingManagerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('config_updated', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): StreamingManagerConfig {
    return { ...this.config }
  }

  // Private helper methods

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private cleanup(streamId: string): void {
    this.activeStreams.delete(streamId)
    this.streamStats.delete(streamId)
  }

  private calculateChunkChecksum(chunk: Uint8Array): string {
    const hash = createHash('md5')
    hash.update(chunk)
    return hash.digest('hex')
  }

  private async compressChunk(chunk: Uint8Array): Promise<Uint8Array> {
    // Placeholder for compression implementation
    // In a real implementation, this would use a compression library like zlib
    return chunk
  }

  private async decompressChunk(chunk: Uint8Array): Promise<Uint8Array> {
    // Placeholder for decompression implementation
    return chunk
  }
}