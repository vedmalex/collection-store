import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';
import { createGzip, createDeflate, createBrotliCompress, createGunzip, createInflate, createBrotliDecompress } from 'zlib';
import { FileStorageError, FileValidationError } from '../interfaces/errors';

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'brotli' | 'none';

export interface CompressionOptions {
  algorithm: CompressionAlgorithm;
  level?: number; // 1-9 for gzip/deflate, 1-11 for brotli
  chunkSize?: number;
  windowBits?: number; // For deflate
  memLevel?: number; // For deflate
}

export interface CompressionResult {
  compressedData: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: CompressionAlgorithm;
  metadata: {
    checksum: string;
    timestamp: number;
    options: CompressionOptions;
  };
}

export interface DecompressionResult {
  decompressedData: Buffer;
  originalSize: number;
  compressedSize: number;
  algorithm: CompressionAlgorithm;
  metadata: {
    checksum: string;
    timestamp: number;
  };
}

export interface CompressionJob {
  id: string;
  type: 'compress' | 'decompress';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: Error;
  result?: CompressionResult | DecompressionResult;
}

export interface CompressionStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageCompressionRatio: number;
  totalBytesProcessed: number;
  totalBytesSaved: number;
  averageProcessingTime: number;
  algorithmUsage: Record<CompressionAlgorithm, number>;
}

export interface CompressionEngineConfig {
  defaultAlgorithm: CompressionAlgorithm;
  defaultLevel: number;
  maxConcurrentJobs: number;
  chunkSize: number;
  enableStats: boolean;
  autoSelectAlgorithm: boolean;
  compressionThreshold: number; // Minimum file size to compress
}

export class CompressionEngine extends EventEmitter {
  private config: CompressionEngineConfig;
  private jobs: Map<string, CompressionJob> = new Map();
  private stats: CompressionStats;
  private activeJobs = 0;

  constructor(config: Partial<CompressionEngineConfig> = {}) {
    super();

    this.config = {
      defaultAlgorithm: 'gzip',
      defaultLevel: 6,
      maxConcurrentJobs: 4,
      chunkSize: 64 * 1024, // 64KB
      enableStats: true,
      autoSelectAlgorithm: false,
      compressionThreshold: 1024, // 1KB
      ...config
    };

    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageCompressionRatio: 0,
      totalBytesProcessed: 0,
      totalBytesSaved: 0,
      averageProcessingTime: 0,
      algorithmUsage: {
        gzip: 0,
        deflate: 0,
        brotli: 0,
        none: 0
      }
    };
  }

  /**
   * Compress data using specified algorithm
   */
  async compress(
    data: Buffer | Readable,
    options: Partial<CompressionOptions> = {}
  ): Promise<CompressionResult> {
    const jobId = this.generateJobId();
    const job = this.createJob(jobId, 'compress');

    try {
      this.emit('compressionStarted', { jobId, options });

      const compressionOptions: CompressionOptions = {
        algorithm: this.config.defaultAlgorithm,
        level: this.config.defaultLevel,
        chunkSize: this.config.chunkSize,
        ...options
      };

      // Auto-select algorithm if enabled
      if (this.config.autoSelectAlgorithm && Buffer.isBuffer(data)) {
        compressionOptions.algorithm = this.selectOptimalAlgorithm(data);
      }

      // Check compression threshold
      const inputSize = Buffer.isBuffer(data) ? data.length : 0;
      if (inputSize > 0 && inputSize < this.config.compressionThreshold) {
        compressionOptions.algorithm = 'none';
      }

      job.status = 'processing';
      this.activeJobs++;

      let result: CompressionResult;

      if (compressionOptions.algorithm === 'none') {
        const buffer = Buffer.isBuffer(data) ? data : await this.streamToBuffer(data);
        result = {
          compressedData: buffer,
          originalSize: buffer.length,
          compressedSize: buffer.length,
          compressionRatio: 1,
          algorithm: 'none',
          metadata: {
            checksum: this.calculateChecksum(buffer),
            timestamp: Date.now(),
            options: compressionOptions
          }
        };
      } else {
        result = await this.performCompression(data, compressionOptions, job);
      }

      job.status = 'completed';
      job.endTime = Date.now();
      job.result = result;
      job.progress = 100;

      this.updateStats(job, result);
      this.emit('compressionCompleted', { jobId, result });

      return result;

    } catch (error) {
      job.status = 'failed';
      job.error = error as Error;
      job.endTime = Date.now();

      this.stats.failedJobs++;
      this.emit('compressionFailed', { jobId, error });

      if (error instanceof FileValidationError) {
        throw error;
      }
      throw new FileStorageError(`Compression failed: ${(error as Error).message}`);
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Decompress data
   */
  async decompress(
    compressedData: Buffer | Readable,
    algorithm: CompressionAlgorithm
  ): Promise<DecompressionResult> {
    const jobId = this.generateJobId();
    const job = this.createJob(jobId, 'decompress');

    try {
      this.emit('decompressionStarted', { jobId, algorithm });

      job.status = 'processing';
      this.activeJobs++;

      let result: DecompressionResult;

      if (algorithm === 'none') {
        const buffer = Buffer.isBuffer(compressedData) ? compressedData : await this.streamToBuffer(compressedData);
        result = {
          decompressedData: buffer,
          originalSize: buffer.length,
          compressedSize: buffer.length,
          algorithm: 'none',
          metadata: {
            checksum: this.calculateChecksum(buffer),
            timestamp: Date.now()
          }
        };
      } else {
        result = await this.performDecompression(compressedData, algorithm, job);
      }

      job.status = 'completed';
      job.endTime = Date.now();
      job.result = result;
      job.progress = 100;

      this.updateDecompressionStats(job);
      this.emit('decompressionCompleted', { jobId, result });

      return result;

    } catch (error) {
      job.status = 'failed';
      job.error = error as Error;
      job.endTime = Date.now();

      this.stats.failedJobs++;
      this.emit('decompressionFailed', { jobId, error });

      if (error instanceof FileValidationError) {
        throw error;
      }
      throw new FileStorageError(`Decompression failed: ${(error as Error).message}`);
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Compress multiple files in batch
   */
  async compressBatch(
    files: Array<{ data: Buffer; name: string; options?: Partial<CompressionOptions> }>
  ): Promise<Array<{ name: string; result: CompressionResult }>> {
    const results: Array<{ name: string; result: CompressionResult }> = [];
    const concurrentLimit = Math.min(this.config.maxConcurrentJobs, files.length);

    for (let i = 0; i < files.length; i += concurrentLimit) {
      const batch = files.slice(i, i + concurrentLimit);
      const batchPromises = batch.map(async (file) => {
        const result = await this.compress(file.data, file.options);
        return { name: file.name, result };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Create compression stream
   */
  createCompressionStream(options: Partial<CompressionOptions> = {}): Transform {
    const compressionOptions: CompressionOptions = {
      algorithm: this.config.defaultAlgorithm,
      level: this.config.defaultLevel,
      ...options
    };

    return this.createCompressionTransform(compressionOptions);
  }

  /**
   * Create decompression stream
   */
  createDecompressionStream(algorithm: CompressionAlgorithm): Transform {
    return this.createDecompressionTransform(algorithm);
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): CompressionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'cancelled';
      job.endTime = Date.now();
      this.emit('jobCancelled', { jobId });
      return true;
    }
    return false;
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CompressionEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionEngineConfig {
    return { ...this.config };
  }

  // Private methods

  private async performCompression(
    data: Buffer | Readable,
    options: CompressionOptions,
    job: CompressionJob
  ): Promise<CompressionResult> {
    const inputBuffer = Buffer.isBuffer(data) ? data : await this.streamToBuffer(data);
    const originalSize = inputBuffer.length;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const compressionStream = this.createCompressionTransform(options);

      compressionStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        job.progress = Math.min(95, (chunks.length * options.chunkSize!) / originalSize * 100);
      });

      compressionStream.on('end', () => {
        const compressedData = Buffer.concat(chunks);
        const compressionRatio = originalSize / compressedData.length;

        resolve({
          compressedData,
          originalSize,
          compressedSize: compressedData.length,
          compressionRatio,
          algorithm: options.algorithm,
          metadata: {
            checksum: this.calculateChecksum(compressedData),
            timestamp: Date.now(),
            options
          }
        });
      });

      compressionStream.on('error', reject);

      compressionStream.write(inputBuffer);
      compressionStream.end();
    });
  }

  private async performDecompression(
    compressedData: Buffer | Readable,
    algorithm: CompressionAlgorithm,
    job: CompressionJob
  ): Promise<DecompressionResult> {
    const inputBuffer = Buffer.isBuffer(compressedData) ? compressedData : await this.streamToBuffer(compressedData);
    const compressedSize = inputBuffer.length;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const decompressionStream = this.createDecompressionTransform(algorithm);

      decompressionStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        job.progress = Math.min(95, chunks.length * 10); // Rough progress estimation
      });

      decompressionStream.on('end', () => {
        const decompressedData = Buffer.concat(chunks);

        resolve({
          decompressedData,
          originalSize: decompressedData.length,
          compressedSize,
          algorithm,
          metadata: {
            checksum: this.calculateChecksum(decompressedData),
            timestamp: Date.now()
          }
        });
      });

      decompressionStream.on('error', reject);

      decompressionStream.write(inputBuffer);
      decompressionStream.end();
    });
  }

  private createCompressionTransform(options: CompressionOptions): Transform {
    switch (options.algorithm) {
      case 'gzip':
        return createGzip({ level: options.level, chunkSize: options.chunkSize });
      case 'deflate':
        return createDeflate({
          level: options.level,
          chunkSize: options.chunkSize,
          windowBits: options.windowBits,
          memLevel: options.memLevel
        });
      case 'brotli':
        return createBrotliCompress({
          params: {
            [require('zlib').constants.BROTLI_PARAM_QUALITY]: options.level || 6
          },
          chunkSize: options.chunkSize
        });
      default:
        throw new FileValidationError(`Unsupported compression algorithm: ${options.algorithm}`, [`Invalid algorithm: ${options.algorithm}`]);
    }
  }

  private createDecompressionTransform(algorithm: CompressionAlgorithm): Transform {
    switch (algorithm) {
      case 'gzip':
        return createGunzip();
      case 'deflate':
        return createInflate();
      case 'brotli':
        return createBrotliDecompress();
      default:
        throw new FileValidationError(`Unsupported decompression algorithm: ${algorithm}`, [`Invalid algorithm: ${algorithm}`]);
    }
  }

  private selectOptimalAlgorithm(data: Buffer): CompressionAlgorithm {
    // Simple heuristic based on data characteristics
    const size = data.length;

    if (size < 1024) return 'none';
    if (size < 10 * 1024) return 'deflate'; // Small files
    if (size < 100 * 1024) return 'gzip'; // Medium files
    return 'brotli'; // Large files - better compression
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private calculateChecksum(data: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateJobId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createJob(id: string, type: 'compress' | 'decompress'): CompressionJob {
    const job: CompressionJob = {
      id,
      type,
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    };

    this.jobs.set(id, job);
    this.stats.totalJobs++;

    return job;
  }

    private updateStats(job: CompressionJob, result: CompressionResult): void {
    if (!this.config.enableStats) return;

    this.stats.completedJobs++;
    this.stats.totalBytesProcessed += result.originalSize;
    this.stats.totalBytesSaved += (result.originalSize - result.compressedSize);
    this.stats.algorithmUsage[result.algorithm]++;

    // Update averages
    const processingTime = (job.endTime! - job.startTime);
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.completedJobs - 1) + processingTime) / this.stats.completedJobs;

    this.stats.averageCompressionRatio =
      (this.stats.averageCompressionRatio * (this.stats.completedJobs - 1) + result.compressionRatio) / this.stats.completedJobs;
  }

  private updateDecompressionStats(job: CompressionJob): void {
    if (!this.config.enableStats) return;

    this.stats.completedJobs++;

    // Update average processing time
    const processingTime = (job.endTime! - job.startTime);
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.completedJobs - 1) + processingTime) / this.stats.completedJobs;
  }
}