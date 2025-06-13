/**
 * StreamingManager Tests
 * Phase 4: File Storage System - Streaming Support Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { StreamingManager, StreamChunk, StreamTransform } from '../core/StreamingManager'
import { FileUpload, StreamingOptions, ByteRange } from '../interfaces/types'
import { StreamingError } from '../interfaces/errors'

describe('StreamingManager', () => {
  let streamingManager: StreamingManager

  beforeEach(() => {
    streamingManager = new StreamingManager({
      defaultChunkSize: 1024, // 1KB for testing
      maxConcurrentStreams: 5,
      enableCompression: false,
      progressUpdateInterval: 50,
      timeoutMs: 5000
    })
  })

  // Helper function to create a test file
  function createTestFile(content: string, filename: string = 'test.txt'): FileUpload {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)

    return {
      filename,
      mimeType: 'text/plain',
      size: data.length,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        }
      })
    }
  }

  // Helper function to create large test file
  function createLargeTestFile(sizeInKB: number): FileUpload {
    const content = 'x'.repeat(sizeInKB * 1024)
    return createTestFile(content, 'large.txt')
  }

  // Helper function to read stream chunks
  async function readStreamChunks<T>(stream: ReadableStream<T>): Promise<T[]> {
    const chunks: T[] = []
    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    return chunks
  }

  // Helper function to read stream as bytes
  async function readStreamAsBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const chunks = await readStreamChunks(stream)
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const manager = new StreamingManager()
      const config = manager.getConfig()

      expect(config.defaultChunkSize).toBe(64 * 1024)
      expect(config.maxConcurrentStreams).toBe(10)
      expect(config.enableCompression).toBe(false)
    })

    it('should update configuration', () => {
      const newConfig = {
        defaultChunkSize: 128 * 1024,
        maxConcurrentStreams: 20
      }

      streamingManager.updateConfig(newConfig)
      const config = streamingManager.getConfig()

      expect(config.defaultChunkSize).toBe(128 * 1024)
      expect(config.maxConcurrentStreams).toBe(20)
    })

    it('should emit config update events', async () => {
      let configUpdated = false

      streamingManager.on('config_updated', () => {
        configUpdated = true
      })

      streamingManager.updateConfig({ defaultChunkSize: 2048 })
      expect(configUpdated).toBe(true)
    })
  })

  describe('Upload Streaming', () => {
    it('should create upload stream for small file', async () => {
      const file = createTestFile('Hello, world!')
      const uploadStream = await streamingManager.createUploadStream(file)

      const chunks = await readStreamChunks(uploadStream)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].index).toBe(0)
      expect(chunks[0].isLast).toBe(true)
      expect(chunks[0].data).toBeInstanceOf(Uint8Array)
      expect(chunks[0].checksum).toBeDefined()
    })

        it('should create chunked upload stream for large file', async () => {
      // Create a file that's 2.5KB (2560 bytes) so it doesn't divide evenly into 1KB chunks
      const content = 'x'.repeat(2560)
      const file = createTestFile(content, 'large.txt')

      const uploadStream = await streamingManager.createUploadStream(file)

      const chunks = await readStreamChunks(uploadStream)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks[0].index).toBe(0)
      expect(chunks[0].isLast).toBe(false)
      expect(chunks[chunks.length - 1].isLast).toBe(true)

      // Verify chunk sizes
      expect(chunks[0].data.length).toBe(1024)
      expect(chunks[1].data.length).toBe(1024)
      expect(chunks[2].data.length).toBe(512) // Last chunk should be smaller
    })

    it('should track upload progress', async () => {
      const file = createLargeTestFile(2) // 2KB file
      let progressUpdates = 0

      const options: StreamingOptions = {
        chunkSize: 1024,
        compression: false,
        progressCallback: (progress) => {
          progressUpdates++
          expect(progress.uploadedBytes).toBeGreaterThanOrEqual(0)
          expect(progress.totalBytes).toBe(file.size)
          expect(progress.percentage).toBeGreaterThanOrEqual(0)
          expect(progress.percentage).toBeLessThanOrEqual(100)
        }
      }

      const uploadStream = await streamingManager.createUploadStream(file, options)
      await readStreamChunks(uploadStream)

      expect(progressUpdates).toBeGreaterThan(0)
    })

    it('should emit stream events', async () => {
      const file = createTestFile('test content')
      let streamStarted = false
      let streamCompleted = false

      streamingManager.on('stream_started', () => { streamStarted = true })
      streamingManager.on('stream_completed', () => { streamCompleted = true })

      const uploadStream = await streamingManager.createUploadStream(file)
      await readStreamChunks(uploadStream)

      expect(streamStarted).toBe(true)
      expect(streamCompleted).toBe(true)
    })

    it('should handle stream cancellation', async () => {
      const file = createLargeTestFile(5) // Large file
      let streamCancelled = false

      streamingManager.on('stream_cancelled', () => { streamCancelled = true })

      const uploadStream = await streamingManager.createUploadStream(file)
      const reader = uploadStream.getReader()

      // Read first chunk then cancel
      await reader.read()
      await reader.cancel()

      expect(streamCancelled).toBe(true)
    })
  })

  describe('Download Streaming', () => {
    it('should create download stream', async () => {
      const testData = new TextEncoder().encode('Hello, streaming world!')
      const downloadStream = await streamingManager.createDownloadStream(testData)

      const result = await readStreamAsBytes(downloadStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('Hello, streaming world!')
    })

    it('should support range downloads', async () => {
      const testData = new TextEncoder().encode('0123456789')
      const range: ByteRange = { start: 2, end: 5 }

      const downloadStream = await streamingManager.createDownloadStream(testData, range)
      const result = await readStreamAsBytes(downloadStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('2345')
    })

    it('should chunk large downloads', async () => {
      const largeData = new Uint8Array(5000) // 5KB
      largeData.fill(65) // Fill with 'A'

      const downloadStream = await streamingManager.createDownloadStream(largeData, undefined, {
        chunkSize: 1024,
        compression: false
      })

      const chunks = await readStreamChunks(downloadStream)
      expect(chunks.length).toBeGreaterThan(1)

      // Verify total size
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      expect(totalSize).toBe(5000)
    })

    it('should emit download events', async () => {
      const testData = new Uint8Array(100)
      let downloadStarted = false
      let downloadCompleted = false
      let progressUpdates = 0

      streamingManager.on('download_started', () => { downloadStarted = true })
      streamingManager.on('download_completed', () => { downloadCompleted = true })
      streamingManager.on('download_progress', () => { progressUpdates++ })

      const downloadStream = await streamingManager.createDownloadStream(testData)
      await readStreamAsBytes(downloadStream)

      expect(downloadStarted).toBe(true)
      expect(downloadCompleted).toBe(true)
      expect(progressUpdates).toBeGreaterThan(0)
    })
  })

  describe('Stream Transformations', () => {
    it('should apply single transformation', async () => {
      const testData = new TextEncoder().encode('hello')
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData)
          controller.close()
        }
      })

      const uppercaseTransform: StreamTransform = {
        name: 'uppercase',
        transform: async (chunk) => {
          const text = new TextDecoder().decode(chunk)
          return new TextEncoder().encode(text.toUpperCase())
        }
      }

      const transformedStream = await streamingManager.transformStream(sourceStream, [uppercaseTransform])
      const result = await readStreamAsBytes(transformedStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('HELLO')
    })

    it('should apply multiple transformations', async () => {
      const testData = new TextEncoder().encode('hello world')
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData)
          controller.close()
        }
      })

      const uppercaseTransform: StreamTransform = {
        name: 'uppercase',
        transform: async (chunk) => {
          const text = new TextDecoder().decode(chunk)
          return new TextEncoder().encode(text.toUpperCase())
        }
      }

      const reverseTransform: StreamTransform = {
        name: 'reverse',
        transform: async (chunk) => {
          const text = new TextDecoder().decode(chunk)
          return new TextEncoder().encode(text.split('').reverse().join(''))
        }
      }

      const transformedStream = await streamingManager.transformStream(sourceStream, [
        uppercaseTransform,
        reverseTransform
      ])
      const result = await readStreamAsBytes(transformedStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('DLROW OLLEH')
    })

    it('should handle transformation with finalization', async () => {
      const testData = new TextEncoder().encode('test')
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData)
          controller.close()
        }
      })

      const appendTransform: StreamTransform = {
        name: 'append',
        transform: async (chunk) => chunk,
        finalize: async () => new TextEncoder().encode(' - processed')
      }

      const transformedStream = await streamingManager.transformStream(sourceStream, [appendTransform])
      const result = await readStreamAsBytes(transformedStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('test - processed')
    })

    it('should emit transformation events', async () => {
      const testData = new Uint8Array([1, 2, 3])
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData)
          controller.close()
        }
      })

      let transformStarted = false
      let transformCompleted = false

      streamingManager.on('transform_started', () => { transformStarted = true })
      streamingManager.on('transform_completed', () => { transformCompleted = true })

      const identityTransform: StreamTransform = {
        name: 'identity',
        transform: async (chunk) => chunk
      }

      const transformedStream = await streamingManager.transformStream(sourceStream, [identityTransform])
      await readStreamAsBytes(transformedStream)

      expect(transformStarted).toBe(true)
      expect(transformCompleted).toBe(true)
    })
  })

  describe('Stream Merging', () => {
    it('should merge multiple streams', async () => {
      const stream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello '))
          controller.close()
        }
      })

      const stream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('World'))
          controller.close()
        }
      })

      const stream3 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('!'))
          controller.close()
        }
      })

      const mergedStream = await streamingManager.mergeStreams([stream1, stream2, stream3])
      const result = await readStreamAsBytes(mergedStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('Hello World!')
    })

    it('should handle empty streams in merge', async () => {
      const emptyStream = new ReadableStream({
        start(controller) {
          controller.close()
        }
      })

      const dataStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data'))
          controller.close()
        }
      })

      const mergedStream = await streamingManager.mergeStreams([emptyStream, dataStream])
      const result = await readStreamAsBytes(mergedStream)
      const resultText = new TextDecoder().decode(result)

      expect(resultText).toBe('data')
    })

    it('should emit merge events', async () => {
      const stream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        }
      })

      let mergeStarted = false
      let mergeCompleted = false

      streamingManager.on('merge_started', () => { mergeStarted = true })
      streamingManager.on('merge_completed', () => { mergeCompleted = true })

      const mergedStream = await streamingManager.mergeStreams([stream1])
      await readStreamAsBytes(mergedStream)

      expect(mergeStarted).toBe(true)
      expect(mergeCompleted).toBe(true)
    })
  })

  describe('Stream Splitting', () => {
    it('should split stream by size', async () => {
      const largeData = new Uint8Array(5000) // 5KB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256
      }

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(largeData)
          controller.close()
        }
      })

      const splitStreams = await streamingManager.splitStream(sourceStream, 2000) // 2KB per stream

      expect(splitStreams.length).toBeGreaterThan(1)

      // Read all split streams and verify total size
      let totalSize = 0
      for (const stream of splitStreams) {
        const data = await readStreamAsBytes(stream)
        totalSize += data.length
      }

      expect(totalSize).toBe(5000)
    })

    it('should handle small data that fits in one stream', async () => {
      const smallData = new Uint8Array(100)
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(smallData)
          controller.close()
        }
      })

      const splitStreams = await streamingManager.splitStream(sourceStream, 1000) // Larger than data

      expect(splitStreams).toHaveLength(1)

      const result = await readStreamAsBytes(splitStreams[0])
      expect(result.length).toBe(100)
    })
  })

  describe('Stream Management', () => {
    it('should track active streams', async () => {
      const file = createLargeTestFile(2)

      expect(streamingManager.getActiveStreams()).toHaveLength(0)

      const uploadStream = await streamingManager.createUploadStream(file)
      expect(streamingManager.getActiveStreams().length).toBeGreaterThan(0)

      await readStreamChunks(uploadStream)

      // Stream should be cleaned up after completion
      expect(streamingManager.getActiveStreams()).toHaveLength(0)
    })

    it('should provide stream statistics', async () => {
      const file = createTestFile('test content for stats')
      const uploadStream = await streamingManager.createUploadStream(file)

      // Get stream ID from active streams
      const activeStreams = streamingManager.getActiveStreams()
      expect(activeStreams).toHaveLength(1)

      const streamId = activeStreams[0]
      const stats = streamingManager.getStreamStats(streamId)

      expect(stats).toBeDefined()
      expect(stats?.totalBytes).toBe(file.size)
      expect(stats?.totalChunks).toBeGreaterThan(0)

      await readStreamChunks(uploadStream)
    })

    it('should cancel specific stream', async () => {
      const file = createLargeTestFile(5)
      const uploadStream = await streamingManager.createUploadStream(file)

      const activeStreams = streamingManager.getActiveStreams()
      const streamId = activeStreams[0]

      const cancelled = streamingManager.cancelStream(streamId)
      expect(cancelled).toBe(true)

      // Stream should be removed from active streams
      expect(streamingManager.getActiveStreams()).toHaveLength(0)
    })

    it('should cancel all streams', async () => {
      const file1 = createLargeTestFile(2)
      const file2 = createLargeTestFile(3)

      await streamingManager.createUploadStream(file1)
      await streamingManager.createUploadStream(file2)

      expect(streamingManager.getActiveStreams().length).toBe(2)

      streamingManager.cancelAllStreams()
      expect(streamingManager.getActiveStreams()).toHaveLength(0)
    })

    it('should return false when cancelling non-existent stream', () => {
      const cancelled = streamingManager.cancelStream('non-existent-id')
      expect(cancelled).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle stream errors gracefully', async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'))
        }
      })

      const identityTransform: StreamTransform = {
        name: 'identity',
        transform: async (chunk) => chunk
      }

      const transformedStream = await streamingManager.transformStream(errorStream, [identityTransform])

      await expect(readStreamAsBytes(transformedStream))
        .rejects.toThrow()
    })

    it('should handle transformation errors', async () => {
      const testData = new Uint8Array([1, 2, 3])
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData)
          controller.close()
        }
      })

      const errorTransform: StreamTransform = {
        name: 'error',
        transform: async () => {
          throw new Error('Transform error')
        }
      }

      const transformedStream = await streamingManager.transformStream(sourceStream, [errorTransform])

      await expect(readStreamAsBytes(transformedStream))
        .rejects.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle large files efficiently', async () => {
      // Create a 100.5KB file (102912 bytes) so it doesn't divide evenly
      const content = 'x'.repeat(102912)
      const file = createTestFile(content, 'large.txt')

      const startTime = performance.now()
      const uploadStream = await streamingManager.createUploadStream(file)
      const chunks = await readStreamChunks(uploadStream)
      const endTime = performance.now()

      expect(chunks.length).toBeGreaterThan(1)
      expect(endTime - startTime).toBeLessThan(2000) // Should complete in under 2 seconds
    })

    it('should handle concurrent streams', async () => {
      const files = Array.from({ length: 3 }, (_, i) =>
        createTestFile(`Content for file ${i}`, `file${i}.txt`)
      )

      const startTime = performance.now()

      const streamPromises = files.map(async (file) => {
        const uploadStream = await streamingManager.createUploadStream(file)
        return readStreamChunks(uploadStream)
      })

      const results = await Promise.all(streamPromises)
      const endTime = performance.now()

      expect(results).toHaveLength(3)
      expect(results.every(chunks => chunks.length > 0)).toBe(true)
      expect(endTime - startTime).toBeLessThan(1000) // Should be efficient
    })
  })
})