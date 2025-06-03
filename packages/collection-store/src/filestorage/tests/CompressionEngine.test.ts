import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Readable } from 'stream';
import { CompressionEngine, CompressionAlgorithm, CompressionOptions } from '../compression/CompressionEngine';
import { FileStorageError, FileValidationError } from '../interfaces/errors';

describe('CompressionEngine', () => {
  let engine: CompressionEngine;
  const testData = Buffer.from('Hello, World! This is a test string for compression. '.repeat(100));
  const smallData = Buffer.from('Hi');

  beforeEach(() => {
    engine = new CompressionEngine({
      defaultAlgorithm: 'gzip',
      defaultLevel: 6,
      maxConcurrentJobs: 2,
      chunkSize: 1024,
      enableStats: true,
      autoSelectAlgorithm: false,
      compressionThreshold: 100
    });
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new CompressionEngine();
      const config = defaultEngine.getConfig();

      expect(config.defaultAlgorithm).toBe('gzip');
      expect(config.defaultLevel).toBe(6);
      expect(config.maxConcurrentJobs).toBe(4);
      expect(config.chunkSize).toBe(64 * 1024);
      expect(config.enableStats).toBe(true);
      expect(config.autoSelectAlgorithm).toBe(false);
      expect(config.compressionThreshold).toBe(1024);
    });

    it('should initialize with custom configuration', () => {
      const config = engine.getConfig();

      expect(config.defaultAlgorithm).toBe('gzip');
      expect(config.defaultLevel).toBe(6);
      expect(config.maxConcurrentJobs).toBe(2);
      expect(config.chunkSize).toBe(1024);
      expect(config.enableStats).toBe(true);
      expect(config.autoSelectAlgorithm).toBe(false);
      expect(config.compressionThreshold).toBe(100);
    });

    it('should initialize with empty stats', () => {
      const stats = engine.getStats();

      expect(stats.totalJobs).toBe(0);
      expect(stats.completedJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
      expect(stats.averageCompressionRatio).toBe(0);
      expect(stats.totalBytesProcessed).toBe(0);
      expect(stats.totalBytesSaved).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.algorithmUsage.gzip).toBe(0);
      expect(stats.algorithmUsage.deflate).toBe(0);
      expect(stats.algorithmUsage.brotli).toBe(0);
      expect(stats.algorithmUsage.none).toBe(0);
    });
  });

  describe('Basic Compression', () => {
    it('should compress data with gzip', async () => {
      const result = await engine.compress(testData, { algorithm: 'gzip' });

      expect(result.algorithm).toBe('gzip');
      expect(result.originalSize).toBe(testData.length);
      expect(result.compressedSize).toBeLessThan(testData.length);
      expect(result.compressionRatio).toBeGreaterThan(1);
      expect(result.compressedData).toBeInstanceOf(Buffer);
      expect(result.metadata.checksum).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.options.algorithm).toBe('gzip');
    });

    it('should compress data with deflate', async () => {
      const result = await engine.compress(testData, { algorithm: 'deflate' });

      expect(result.algorithm).toBe('deflate');
      expect(result.originalSize).toBe(testData.length);
      expect(result.compressedSize).toBeLessThan(testData.length);
      expect(result.compressionRatio).toBeGreaterThan(1);
    });

    it('should compress data with brotli', async () => {
      const result = await engine.compress(testData, { algorithm: 'brotli' });

      expect(result.algorithm).toBe('brotli');
      expect(result.originalSize).toBe(testData.length);
      expect(result.compressedSize).toBeLessThan(testData.length);
      expect(result.compressionRatio).toBeGreaterThan(1);
    });

    it('should handle no compression', async () => {
      const result = await engine.compress(testData, { algorithm: 'none' });

      expect(result.algorithm).toBe('none');
      expect(result.originalSize).toBe(testData.length);
      expect(result.compressedSize).toBe(testData.length);
      expect(result.compressionRatio).toBe(1);
      expect(result.compressedData).toEqual(testData);
    });

    it('should use default algorithm when not specified', async () => {
      const result = await engine.compress(testData);

      expect(result.algorithm).toBe('gzip');
    });

    it('should compress stream data', async () => {
      const stream = new Readable({
        read() {
          this.push(testData);
          this.push(null);
        }
      });

      const result = await engine.compress(stream, { algorithm: 'gzip' });

      expect(result.algorithm).toBe('gzip');
      expect(result.originalSize).toBe(testData.length);
      expect(result.compressedSize).toBeLessThan(testData.length);
    });
  });

  describe('Decompression', () => {
    it('should decompress gzip data', async () => {
      const compressed = await engine.compress(testData, { algorithm: 'gzip' });
      const decompressed = await engine.decompress(compressed.compressedData, 'gzip');

      expect(decompressed.algorithm).toBe('gzip');
      expect(decompressed.originalSize).toBe(testData.length);
      expect(decompressed.compressedSize).toBe(compressed.compressedSize);
      expect(decompressed.decompressedData).toEqual(testData);
    });

    it('should decompress deflate data', async () => {
      const compressed = await engine.compress(testData, { algorithm: 'deflate' });
      const decompressed = await engine.decompress(compressed.compressedData, 'deflate');

      expect(decompressed.algorithm).toBe('deflate');
      expect(decompressed.decompressedData).toEqual(testData);
    });

    it('should decompress brotli data', async () => {
      const compressed = await engine.compress(testData, { algorithm: 'brotli' });
      const decompressed = await engine.decompress(compressed.compressedData, 'brotli');

      expect(decompressed.algorithm).toBe('brotli');
      expect(decompressed.decompressedData).toEqual(testData);
    });

    it('should handle no decompression', async () => {
      const decompressed = await engine.decompress(testData, 'none');

      expect(decompressed.algorithm).toBe('none');
      expect(decompressed.originalSize).toBe(testData.length);
      expect(decompressed.compressedSize).toBe(testData.length);
      expect(decompressed.decompressedData).toEqual(testData);
    });

    it('should decompress stream data', async () => {
      const compressed = await engine.compress(testData, { algorithm: 'gzip' });
      const stream = new Readable({
        read() {
          this.push(compressed.compressedData);
          this.push(null);
        }
      });

      const decompressed = await engine.decompress(stream, 'gzip');

      expect(decompressed.decompressedData).toEqual(testData);
    });
  });

  describe('Compression Levels', () => {
    it('should compress with different levels', async () => {
      const level1 = await engine.compress(testData, { algorithm: 'gzip', level: 1 });
      const level9 = await engine.compress(testData, { algorithm: 'gzip', level: 9 });

      expect(level1.compressedSize).toBeGreaterThanOrEqual(level9.compressedSize);
      expect(level1.metadata.options.level).toBe(1);
      expect(level9.metadata.options.level).toBe(9);
    });

    it('should compress brotli with different levels', async () => {
      const level1 = await engine.compress(testData, { algorithm: 'brotli', level: 1 });
      const level11 = await engine.compress(testData, { algorithm: 'brotli', level: 11 });

      expect(level1.compressedSize).toBeGreaterThanOrEqual(level11.compressedSize);
    });
  });

  describe('Batch Compression', () => {
        it('should compress multiple files', async () => {
      const files = [
        { data: testData, name: 'file1.txt' },
        { data: smallData, name: 'file2.txt' },
        { data: Buffer.from('Another test'.repeat(10)), name: 'file3.txt' }
      ];

      const results = await engine.compressBatch(files);

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('file1.txt');
      expect(results[1].name).toBe('file2.txt');
      expect(results[2].name).toBe('file3.txt');

      // First file should be compressed (large enough)
      expect(results[0].result.algorithm).toBe('gzip');
      expect(results[0].result.compressedData).toBeInstanceOf(Buffer);

      // Second file should not be compressed (too small)
      expect(results[1].result.algorithm).toBe('none');
      expect(results[1].result.compressedData).toBeInstanceOf(Buffer);

      // Third file should be compressed (large enough)
      expect(results[2].result.algorithm).toBe('gzip');
      expect(results[2].result.compressedData).toBeInstanceOf(Buffer);
    });

    it('should compress batch with different options', async () => {
      const files = [
        { data: testData, name: 'file1.txt', options: { algorithm: 'gzip' as CompressionAlgorithm } },
        { data: testData, name: 'file2.txt', options: { algorithm: 'deflate' as CompressionAlgorithm } },
        { data: testData, name: 'file3.txt', options: { algorithm: 'brotli' as CompressionAlgorithm } }
      ];

      const results = await engine.compressBatch(files);

      expect(results[0].result.algorithm).toBe('gzip');
      expect(results[1].result.algorithm).toBe('deflate');
      expect(results[2].result.algorithm).toBe('brotli');
    });
  });

  describe('Streaming', () => {
    it('should create compression stream', () => {
      const stream = engine.createCompressionStream({ algorithm: 'gzip' });

      expect(stream).toBeDefined();
      expect(typeof stream.write).toBe('function');
      expect(typeof stream.end).toBe('function');
    });

    it('should create decompression stream', () => {
      const stream = engine.createDecompressionStream('gzip');

      expect(stream).toBeDefined();
      expect(typeof stream.write).toBe('function');
      expect(typeof stream.end).toBe('function');
    });

    it('should process data through compression stream', (done) => {
      const compressionStream = engine.createCompressionStream({ algorithm: 'gzip' });
      const chunks: Buffer[] = [];

      compressionStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      compressionStream.on('end', () => {
        const compressed = Buffer.concat(chunks);
        expect(compressed.length).toBeGreaterThan(0);
        expect(compressed.length).toBeLessThan(testData.length);
        done();
      });

      compressionStream.write(testData);
      compressionStream.end();
    });
  });

  describe('Auto Algorithm Selection', () => {
    it('should auto-select algorithm based on data size', async () => {
      const autoEngine = new CompressionEngine({
        autoSelectAlgorithm: true,
        compressionThreshold: 100
      });

      const smallResult = await autoEngine.compress(Buffer.from('Hi'));
      expect(smallResult.algorithm).toBe('none');

      const mediumResult = await autoEngine.compress(Buffer.from('x'.repeat(5000)));
      expect(mediumResult.algorithm).toBe('deflate');

      const largeResult = await autoEngine.compress(Buffer.from('x'.repeat(50000)));
      expect(largeResult.algorithm).toBe('gzip');

      const veryLargeResult = await autoEngine.compress(Buffer.from('x'.repeat(200000)));
      expect(veryLargeResult.algorithm).toBe('brotli');
    });
  });

  describe('Compression Threshold', () => {
    it('should skip compression for small files', async () => {
      const result = await engine.compress(smallData);

      expect(result.algorithm).toBe('none');
      expect(result.compressionRatio).toBe(1);
      expect(result.compressedData).toEqual(smallData);
    });

    it('should compress files above threshold', async () => {
      const result = await engine.compress(testData);

      expect(result.algorithm).toBe('gzip');
      expect(result.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('Job Management', () => {
    it('should track job status', async () => {
      let jobId: string;

      engine.on('compressionStarted', (event) => {
        jobId = event.jobId;
        const job = engine.getJobStatus(jobId);
        expect(job).toBeDefined();
        expect(job!.status).toBe('pending');
      });

      await engine.compress(testData);

      const job = engine.getJobStatus(jobId!);
      expect(job!.status).toBe('completed');
      expect(job!.progress).toBe(100);
      expect(job!.endTime).toBeDefined();
    });

    it('should clear completed jobs', async () => {
      await engine.compress(testData);

      const statsBefore = engine.getStats();
      expect(statsBefore.totalJobs).toBe(1);

      engine.clearCompletedJobs();

      // Jobs are cleared but stats remain
      const statsAfter = engine.getStats();
      expect(statsAfter.totalJobs).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track compression statistics', async () => {
      await engine.compress(testData, { algorithm: 'gzip' });
      await engine.compress(testData, { algorithm: 'deflate' });

      const stats = engine.getStats();

      expect(stats.totalJobs).toBe(2);
      expect(stats.completedJobs).toBe(2);
      expect(stats.failedJobs).toBe(0);
      expect(stats.totalBytesProcessed).toBe(testData.length * 2);
      expect(stats.totalBytesSaved).toBeGreaterThan(0);
      expect(stats.averageCompressionRatio).toBeGreaterThan(1);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.algorithmUsage.gzip).toBe(1);
      expect(stats.algorithmUsage.deflate).toBe(1);
    });

    it('should not track stats when disabled', async () => {
      const noStatsEngine = new CompressionEngine({ enableStats: false });

      await noStatsEngine.compress(testData);

      const stats = noStatsEngine.getStats();
      expect(stats.totalJobs).toBe(1); // Job count is always tracked
      expect(stats.completedJobs).toBe(0); // But completion stats are not
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        defaultAlgorithm: 'brotli' as CompressionAlgorithm,
        defaultLevel: 8,
        maxConcurrentJobs: 6
      };

      let configUpdated = false;
      engine.on('configUpdated', () => {
        configUpdated = true;
      });

      engine.updateConfig(newConfig);

      const config = engine.getConfig();
      expect(config.defaultAlgorithm).toBe('brotli');
      expect(config.defaultLevel).toBe(8);
      expect(config.maxConcurrentJobs).toBe(6);
      expect(configUpdated).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit compression events', async () => {
      let startedEmitted = false;
      let completedEmitted = false;

      engine.on('compressionStarted', () => {
        startedEmitted = true;
      });

      engine.on('compressionCompleted', () => {
        completedEmitted = true;
      });

      await engine.compress(testData);

      expect(startedEmitted).toBe(true);
      expect(completedEmitted).toBe(true);
    });

    it('should emit decompression events', async () => {
      let startedEmitted = false;
      let completedEmitted = false;

      engine.on('decompressionStarted', () => {
        startedEmitted = true;
      });

      engine.on('decompressionCompleted', () => {
        completedEmitted = true;
      });

      const compressed = await engine.compress(testData);
      await engine.decompress(compressed.compressedData, 'gzip');

      expect(startedEmitted).toBe(true);
      expect(completedEmitted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid compression algorithm', async () => {
      await expect(engine.compress(testData, { algorithm: 'invalid' as any }))
        .rejects.toThrow(FileValidationError);
    });

    it('should handle invalid decompression algorithm', async () => {
      await expect(engine.decompress(testData, 'invalid' as any))
        .rejects.toThrow(FileValidationError);
    });

    it('should emit error events on failure', async () => {
      let errorEmitted = false;

      engine.on('compressionFailed', () => {
        errorEmitted = true;
      });

      try {
        await engine.compress(testData, { algorithm: 'invalid' as any });
      } catch (error) {
        // Expected error
      }

      expect(errorEmitted).toBe(true);
    });

    it('should track failed jobs in statistics', async () => {
      try {
        await engine.compress(testData, { algorithm: 'invalid' as any });
      } catch (error) {
        // Expected error
      }

      const stats = engine.getStats();
      expect(stats.failedJobs).toBe(1);
    });

    it('should handle corrupted compressed data', async () => {
      const corruptedData = Buffer.from('This is not compressed data');

      await expect(engine.decompress(corruptedData, 'gzip'))
        .rejects.toThrow(FileStorageError);
    });
  });

  describe('Performance', () => {
    it('should handle large data efficiently', async () => {
      const largeData = Buffer.from('x'.repeat(1000000)); // 1MB
      const startTime = Date.now();

      const result = await engine.compress(largeData, { algorithm: 'gzip' });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.compressionRatio).toBeGreaterThan(1);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent compressions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        engine.compress(Buffer.from(`Test data ${i}`.repeat(100)))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.algorithm).toBe('gzip');
        expect(result.compressionRatio).toBeGreaterThan(1);
      });
    });
  });

  describe('Round-trip Integrity', () => {
    it('should maintain data integrity through compression/decompression cycle', async () => {
      const algorithms: CompressionAlgorithm[] = ['gzip', 'deflate', 'brotli'];

      for (const algorithm of algorithms) {
        const compressed = await engine.compress(testData, { algorithm });
        const decompressed = await engine.decompress(compressed.compressedData, algorithm);

        expect(decompressed.decompressedData).toEqual(testData);
      }
    });

    it('should handle binary data correctly', async () => {
      // Create larger binary data to exceed compression threshold
      const binaryData = Buffer.from([0, 1, 2, 3, 255, 254, 253, 252].concat(Array(200).fill(0).map((_, i) => i % 256)));

      const compressed = await engine.compress(binaryData, { algorithm: 'gzip' });
      const decompressed = await engine.decompress(compressed.compressedData, 'gzip');

      expect(decompressed.decompressedData).toEqual(binaryData);
    });

    it('should handle empty data', async () => {
      const emptyData = Buffer.alloc(0);

      const compressed = await engine.compress(emptyData, { algorithm: 'gzip' });
      const decompressed = await engine.decompress(compressed.compressedData, 'gzip');

      expect(decompressed.decompressedData).toEqual(emptyData);
    });
  });
});