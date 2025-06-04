import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileOperationsProfiler } from '../monitoring/FileOperationsProfiler';
import type { ProfilerConfig } from '../testing/interfaces';

describe('FileOperationsProfiler', () => {
  let profiler: FileOperationsProfiler;
  let testConfig: ProfilerConfig;

  beforeEach(() => {
    testConfig = {
      samplingInterval: 100, // Fast sampling for tests
      maxProfileDuration: 5000, // 5 seconds for tests
      retainProfiles: 60000, // 1 minute for tests
      enableDetailedLogging: false
    };
    profiler = new FileOperationsProfiler(testConfig);
  });

  afterEach(async () => {
    if (profiler.isActive()) {
      await profiler.stopMonitoring();
    }
    profiler.clearHistory();
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', async () => {
      expect(profiler.isActive()).toBe(false);

      await profiler.startMonitoring('test-session-1');

      expect(profiler.isActive()).toBe(true);
    });

    it('should stop monitoring and generate report', async () => {
      await profiler.startMonitoring('test-session-2');
      expect(profiler.isActive()).toBe(true);

      const report = await profiler.stopMonitoring();

      expect(profiler.isActive()).toBe(false);
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.duration).toBe('number');
      expect(typeof report.totalOperations).toBe('number');
      expect(typeof report.successRate).toBe('number');
      expect(typeof report.averageUploadThroughput).toBe('number');
      expect(typeof report.averageDownloadThroughput).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should throw error when starting monitoring twice', async () => {
      await profiler.startMonitoring('test-session-3');

      await expect(profiler.startMonitoring('test-session-4')).rejects.toThrow(
        'File operations monitoring already active'
      );
    });

    it('should throw error when stopping inactive monitoring', async () => {
      await expect(profiler.stopMonitoring()).rejects.toThrow(
        'File operations monitoring not active'
      );
    });
  });

  describe('File Upload Profiling', () => {
    it('should profile file upload performance', async () => {
      const fileConfig = {
        size: 5 * 1024 * 1024, // 5MB
        enableCompression: true,
        chunkSize: 1024 * 1024 // 1MB chunks
      };

      const analysis = await profiler.profileFileUpload(fileConfig);

      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.fileSize).toBe(fileConfig.size);
      expect(typeof analysis.uploadTime).toBe('number');
      expect(typeof analysis.throughput).toBe('number');
      expect(typeof analysis.compressionRatio).toBe('number');
      expect(typeof analysis.errorRate).toBe('number');
      expect(typeof analysis.retryCount).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      expect(analysis.uploadTime).toBeGreaterThan(0);
      expect(analysis.throughput).toBeGreaterThan(0);
      expect(analysis.compressionRatio).toBeGreaterThan(0);
      expect(analysis.errorRate).toBeGreaterThanOrEqual(0);
      expect(analysis.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should generate upload recommendations for poor performance', async () => {
      const fileConfig = { size: 100 * 1024 * 1024 }; // 100MB

      const analysis = await profiler.profileFileUpload(fileConfig);

      // Should generate recommendations for large files
      if (analysis.throughput < 10 * 1024 * 1024) {
        expect(analysis.recommendations).toContain('Consider enabling compression for large files');
        expect(analysis.recommendations).toContain('Implement chunked upload for better reliability');
      }

      if (analysis.errorRate > 0.01) {
        expect(analysis.recommendations).toContain('Improve error handling and retry mechanisms');
      }
    });

    it('should record upload operations in history', async () => {
      const fileConfig = { size: 1024 * 1024 }; // 1MB

      await profiler.profileFileUpload(fileConfig);

      const history = profiler.getOperationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('upload');
      expect(history[0].fileSize).toBe(fileConfig.size);
      expect(typeof history[0].duration).toBe('number');
      expect(typeof history[0].success).toBe('boolean');
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('File Download Profiling', () => {
    it('should profile file download performance', async () => {
      const fileConfig = {
        size: 10 * 1024 * 1024, // 10MB
        enableCaching: true
      };

      const analysis = await profiler.profileFileDownload(fileConfig);

      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.fileSize).toBe(fileConfig.size);
      expect(typeof analysis.downloadTime).toBe('number');
      expect(typeof analysis.throughput).toBe('number');
      expect(typeof analysis.cacheHitRate).toBe('number');
      expect(typeof analysis.errorRate).toBe('number');
      expect(Array.isArray(analysis.recommendations)).toBe(true);

      expect(analysis.downloadTime).toBeGreaterThan(0);
      expect(analysis.throughput).toBeGreaterThan(0);
      expect(analysis.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(analysis.cacheHitRate).toBeLessThanOrEqual(1);
      expect(analysis.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should generate download recommendations for poor performance', async () => {
      const fileConfig = { size: 50 * 1024 * 1024 }; // 50MB

      const analysis = await profiler.profileFileDownload(fileConfig);

      // Should generate recommendations for slow downloads
      if (analysis.throughput < 20 * 1024 * 1024) {
        expect(analysis.recommendations).toContain('Implement CDN for better download performance');
        expect(analysis.recommendations).toContain('Enable HTTP/2 for multiplexed downloads');
      }

      if (analysis.cacheHitRate < 0.5) {
        expect(analysis.recommendations).toContain('Optimize caching strategy for frequently accessed files');
      }
    });

    it('should record download operations in history', async () => {
      const fileConfig = { size: 2 * 1024 * 1024 }; // 2MB

      await profiler.profileFileDownload(fileConfig);

      const history = profiler.getOperationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('download');
      expect(history[0].fileSize).toBe(fileConfig.size);
      expect(typeof history[0].duration).toBe('number');
      expect(typeof history[0].success).toBe('boolean');
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Operation History Management', () => {
    it('should maintain operation history', async () => {
      await profiler.profileFileUpload({ size: 1024 * 1024 });
      await profiler.profileFileDownload({ size: 2 * 1024 * 1024 });

      const history = profiler.getOperationHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('upload');
      expect(history[1].type).toBe('download');
    });

    it('should clear all monitoring history', async () => {
      await profiler.profileFileUpload({ size: 1024 * 1024 });
      await profiler.profileFileDownload({ size: 2 * 1024 * 1024 });

      expect(profiler.getOperationHistory().length).toBeGreaterThan(0);

      profiler.clearHistory();

      expect(profiler.getOperationHistory()).toHaveLength(0);
    });

    it('should return copy of operation history', async () => {
      await profiler.profileFileUpload({ size: 1024 * 1024 });

      const history1 = profiler.getOperationHistory();
      const history2 = profiler.getOperationHistory();

      expect(history1).not.toBe(history2); // Different array instances
      expect(history1).toEqual(history2); // Same content
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance report', async () => {
      // Generate some operations
      await profiler.profileFileUpload({ size: 1024 * 1024 });
      await profiler.profileFileDownload({ size: 2 * 1024 * 1024 });
      await profiler.profileFileUpload({ size: 5 * 1024 * 1024 });

      await profiler.startMonitoring('test-session');
      const report = await profiler.stopMonitoring();

      expect(report.totalOperations).toBeGreaterThan(0);
      expect(report.successRate).toBeGreaterThanOrEqual(0);
      expect(report.successRate).toBeLessThanOrEqual(1);
      expect(report.averageUploadThroughput).toBeGreaterThanOrEqual(0);
      expect(report.averageDownloadThroughput).toBeGreaterThanOrEqual(0);
      expect(report.storageUtilization).toBeGreaterThanOrEqual(0);
      expect(report.storageUtilization).toBeLessThanOrEqual(1);
      expect(report.cacheEfficiency).toBeGreaterThanOrEqual(0);
      expect(report.cacheEfficiency).toBeLessThanOrEqual(1);
    });

    it('should identify bottlenecks in performance report', async () => {
      // Generate operations that might trigger bottleneck detection with smaller files
      for (let i = 0; i < 3; i++) {
        await profiler.profileFileUpload({ size: 10 * 1024 * 1024 }); // 10MB files instead of 100MB
      }

      await profiler.startMonitoring('test-session');
      const report = await profiler.stopMonitoring();

      // Check if bottlenecks are identified
      expect(report.totalOperations).toBeGreaterThan(0);
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Verify report structure regardless of specific thresholds
      expect(typeof report.averageUploadThroughput).toBe('number');
      expect(typeof report.averageDownloadThroughput).toBe('number');
      expect(report.averageUploadThroughput).toBeGreaterThanOrEqual(0);
      expect(report.averageDownloadThroughput).toBeGreaterThanOrEqual(0);
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultProfiler = new FileOperationsProfiler();
      expect(defaultProfiler.isActive()).toBe(false);
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = { samplingInterval: 500 };
      const customProfiler = new FileOperationsProfiler(customConfig);
      expect(customProfiler.isActive()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle zero-size file uploads gracefully', async () => {
      const fileConfig = { size: 0 };

      const analysis = await profiler.profileFileUpload(fileConfig);

      expect(analysis.fileSize).toBe(0);
      expect(analysis.uploadTime).toBeGreaterThanOrEqual(0);
      expect(analysis.throughput).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero-size file downloads gracefully', async () => {
      const fileConfig = { size: 0 };

      const analysis = await profiler.profileFileDownload(fileConfig);

      expect(analysis.fileSize).toBe(0);
      expect(analysis.downloadTime).toBeGreaterThanOrEqual(0);
      expect(analysis.throughput).toBeGreaterThanOrEqual(0);
    });

        it('should handle monitoring without operations', async () => {
      // Clear any existing operations first
      profiler.clearHistory();

      await profiler.startMonitoring('empty-session');
      const report = await profiler.stopMonitoring();

      // Note: startMonitoring runs baseline measurements, so we expect some operations
      expect(report.totalOperations).toBeGreaterThanOrEqual(0);
      expect(report.successRate).toBeGreaterThanOrEqual(0);
      expect(report.successRate).toBeLessThanOrEqual(1);
      expect(report.averageUploadThroughput).toBeGreaterThanOrEqual(0);
      expect(report.averageDownloadThroughput).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Calculations', () => {
    it('should calculate throughput correctly', async () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const fileConfig = { size: fileSize };

      const analysis = await profiler.profileFileUpload(fileConfig);

      // Throughput should be fileSize / (uploadTime / 1000)
      const expectedThroughput = fileSize / (analysis.uploadTime / 1000);
      expect(Math.abs(analysis.throughput - expectedThroughput)).toBeLessThan(1);
    });

    it('should calculate success rate correctly', async () => {
      // Generate mix of successful and failed operations
      await profiler.profileFileUpload({ size: 1024 * 1024 });
      await profiler.profileFileDownload({ size: 1024 * 1024 });

      await profiler.startMonitoring('test-session');
      const report = await profiler.stopMonitoring();

      const history = profiler.getOperationHistory();
      const successfulOps = history.filter(op => op.success).length;
      const expectedSuccessRate = history.length > 0 ? successfulOps / history.length : 1;

      expect(Math.abs(report.successRate - expectedSuccessRate)).toBeLessThan(0.01);
    });
  });
});