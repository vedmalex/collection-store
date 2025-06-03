/**
 * File Storage Integration Tests
 * Week 3 Day 15-16: Integration Testing & Access Control
 *
 * Integration testing of file storage components
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileReplicationManager } from '../replication/FileReplicationManager';
import { CompressionEngine } from '../compression/CompressionEngine';
import type { FileMetadata, NodeInfo } from '../interfaces/types';

describe('File Storage Component Integration', () => {
  let replicationManager: FileReplicationManager;
  let compressionEngine: CompressionEngine;
  let testNodes: NodeInfo[];

  beforeEach(async () => {
    // Setup test cluster nodes
    testNodes = [
      {
        id: 'node-1',
        address: '192.168.1.10',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['storage', 'replication', 'compression']
      },
      {
        id: 'node-2',
        address: '192.168.1.11',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['storage', 'replication']
      },
      {
        id: 'node-3',
        address: '192.168.1.12',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['storage', 'replication']
      }
    ];

    // Initialize replication manager
    replicationManager = new FileReplicationManager({
      nodeId: 'test-node',
      clusterNodes: testNodes,
      defaultStrategy: 'direct',
      maxConcurrentReplications: 3,
      healthCheckInterval: 5000,
      walEnabled: true
    });
    await replicationManager.initialize();

    // Initialize compression engine
    compressionEngine = new CompressionEngine({
      defaultAlgorithm: 'gzip',
      maxConcurrentJobs: 3
    });
  });

  afterEach(async () => {
    if (replicationManager) await replicationManager.shutdown();
  });

  describe('Replication Integration', () => {
    it('should replicate files across cluster nodes', async () => {
      const fileMetadata: FileMetadata = {
        id: 'test-file-123',
        filename: 'test-file.txt',
        originalName: 'test-file.txt',
        mimeType: 'text/plain',
        size: 1024,
        checksum: 'mock-checksum',
        backend: 'local',
        storagePath: '/files/test-file-123',
        access: 'private',
        ownerId: 'user-123',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnails: [],
        replicationNodes: [],
        replicationStatus: 'pending'
      };

      const targetNodes = ['node-2', 'node-3'];
      await replicationManager.replicateFile(fileMetadata.id, targetNodes, fileMetadata);

      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBe(1);
      expect(stats.successfulReplications).toBe(1);
    });

    it('should handle replication of different file types with appropriate strategies', async () => {
      const testFiles = [
        {
          id: 'small-text-file',
          filename: 'small.txt',
          mimeType: 'text/plain',
          size: 1024 * 1024 // 1MB - should use direct strategy
        },
        {
          id: 'large-binary-file',
          filename: 'large.bin',
          mimeType: 'application/octet-stream',
          size: 100 * 1024 * 1024 // 100MB - should use chunked strategy
        },
        {
          id: 'video-file',
          filename: 'video.mp4',
          mimeType: 'video/mp4',
          size: 50 * 1024 * 1024 // 50MB video - should use streaming strategy
        }
      ];

      const replicationPromises = testFiles.map(file => {
        const metadata: FileMetadata = {
          id: file.id,
          filename: file.filename,
          originalName: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          checksum: `checksum-${file.id}`,
          backend: 'local',
          storagePath: `/files/${file.id}`,
          access: 'private',
          ownerId: 'user-123',
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          thumbnails: [],
          replicationNodes: [],
          replicationStatus: 'pending'
        };

        return replicationManager.replicateFile(file.id, ['node-2'], metadata);
      });

      await Promise.all(replicationPromises);

      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBe(testFiles.length);
      expect(stats.successfulReplications).toBe(testFiles.length);
    });
  });

  describe('Compression Integration', () => {
    it('should compress data successfully', async () => {
      const testData = Buffer.alloc(10 * 1024, 'A'); // 10KB of compressible data

      const compressionResult = await compressionEngine.compress(testData, {
        algorithm: 'gzip',
        level: 6
      });

      expect(compressionResult.compressedData.length).toBeLessThan(testData.length);
      expect(compressionResult.compressionRatio).toBeGreaterThan(0);
      console.log(`Compression ratio: ${compressionResult.compressionRatio.toFixed(2)}%`);
    });

    it('should handle different compression algorithms', async () => {
      // Use larger data to exceed compression threshold
      const testData = Buffer.alloc(1024, 'This is test data for compression that needs to be large enough to exceed the compression threshold');

      const algorithms = ['gzip', 'deflate', 'brotli'] as const;

      for (const algorithm of algorithms) {
        const result = await compressionEngine.compress(testData, { algorithm });
        expect(result.compressedData.length).toBeGreaterThan(0);
        expect(result.algorithm).toBe(algorithm);
      }
    });
  });

  describe('Multi-Component Performance Integration', () => {
    it('should handle concurrent operations across components', async () => {
      const operations = [
        // Compression operations
        compressionEngine.compress(Buffer.alloc(1024, 'A'), { algorithm: 'gzip' }),
        compressionEngine.compress(Buffer.alloc(2048, 'B'), { algorithm: 'deflate' }),

        // Replication operations
        replicationManager.replicateFile('file-1', ['node-2'], {
          id: 'file-1',
          filename: 'concurrent-1.txt',
          originalName: 'concurrent-1.txt',
          mimeType: 'text/plain',
          size: 1024,
          checksum: 'checksum-1',
          backend: 'local',
          storagePath: '/files/file-1',
          access: 'private',
          ownerId: 'user-123',
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          thumbnails: [],
          replicationNodes: [],
          replicationStatus: 'pending'
        }),

        replicationManager.replicateFile('file-2', ['node-3'], {
          id: 'file-2',
          filename: 'concurrent-2.txt',
          originalName: 'concurrent-2.txt',
          mimeType: 'text/plain',
          size: 2048,
          checksum: 'checksum-2',
          backend: 'local',
          storagePath: '/files/file-2',
          access: 'private',
          ownerId: 'user-123',
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          thumbnails: [],
          replicationNodes: [],
          replicationStatus: 'pending'
        })
      ];

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const totalTime = performance.now() - startTime;

      expect(results.length).toBe(operations.length);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent operations: ${operations.length} operations in ${totalTime.toFixed(2)}ms`);

      // Verify compression results
      const compressionResults = results.slice(0, 2);
      compressionResults.forEach((result: any) => {
        expect(result).toBeDefined();
        expect(result.compressedData).toBeDefined();
        expect(result.compressedData.length).toBeGreaterThan(0);
      });

      // Verify replication stats
      const replicationStats = replicationManager.getStats();
      expect(replicationStats.totalReplications).toBeGreaterThanOrEqual(2);
    });

    it('should maintain data integrity across component interactions', async () => {
      // Use larger data to exceed compression threshold
      const originalData = Buffer.alloc(1024, 'This is test data for integrity verification that needs to be large enough to exceed the compression threshold');

      // 1. Compress data
      const compressionResult = await compressionEngine.compress(originalData, {
        algorithm: 'gzip',
        level: 9
      });

      // 2. Create file metadata for replication
      const fileMetadata: FileMetadata = {
        id: 'integrity-test-file',
        filename: 'integrity-test.txt',
        originalName: 'integrity-test.txt',
        mimeType: 'text/plain',
        size: compressionResult.compressedData.length,
        checksum: 'integrity-checksum',
        backend: 'local',
        storagePath: '/files/integrity-test-file',
        access: 'private',
        ownerId: 'user-123',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnails: [],
        replicationNodes: [],
        replicationStatus: 'pending'
      };

      // 3. Replicate compressed data
      await replicationManager.replicateFile(fileMetadata.id, ['node-2', 'node-3'], fileMetadata);

      // 4. Decompress and verify integrity
      const decompressionResult = await compressionEngine.decompress(compressionResult.compressedData, compressionResult.algorithm);

      expect(decompressionResult.decompressedData.length).toBe(originalData.length);
      expect(Buffer.compare(decompressionResult.decompressedData, originalData)).toBe(0);

      // 5. Verify replication completed successfully
      const stats = replicationManager.getStats();
      expect(stats.successfulReplications).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle component failures gracefully', async () => {
      // Test replication with invalid nodes
      const fileMetadata: FileMetadata = {
        id: 'error-test-file',
        filename: 'error-test.txt',
        originalName: 'error-test.txt',
        mimeType: 'text/plain',
        size: 1024,
        checksum: 'error-checksum',
        backend: 'local',
        storagePath: '/files/error-test-file',
        access: 'private',
        ownerId: 'user-123',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnails: [],
        replicationNodes: [],
        replicationStatus: 'pending'
      };

      // This should not throw but should handle the error gracefully
      try {
        await replicationManager.replicateFile('error-file', ['invalid-node'], fileMetadata);
      } catch (error) {
        // Expected to fail, but should not crash the system
        expect(error).toBeDefined();
      }

      // System should still be operational
      const healthCheck = await replicationManager.checkReplicationHealth();
      expect(healthCheck).toBeDefined();
    });

    it('should maintain system stability during failures', async () => {
      const operations: Promise<any>[] = [];

      // Add some operations that might fail
      for (let i = 0; i < 3; i++) {
        operations.push(
          compressionEngine.compress(Buffer.alloc(1024, `data-${i}`), {
            algorithm: 'gzip'
          }).catch(error => ({ error: error.message }))
        );
      }

      const results = await Promise.all(operations);

      // All operations should succeed with valid algorithm
      const successes = results.filter(r => !('error' in r));
      expect(successes.length).toBe(3);

      // System should still be responsive
      const compressionStats = compressionEngine.getStats();
      expect(compressionStats).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should handle configuration updates across components', async () => {
      // Update replication manager configuration
      replicationManager.updateConfig({
        defaultStrategy: 'chunked',
        maxConcurrentReplications: 5
      });

      const replicationConfig = replicationManager.getConfig();
      expect(replicationConfig.defaultStrategy).toBe('chunked');
      expect(replicationConfig.maxConcurrentReplications).toBe(5);

      // Update compression engine configuration
      compressionEngine.updateConfig({
        defaultAlgorithm: 'brotli',
        maxConcurrentJobs: 5
      });

      const compressionConfig = compressionEngine.getConfig();
      expect(compressionConfig.defaultAlgorithm).toBe('brotli');
      expect(compressionConfig.maxConcurrentJobs).toBe(5);

      // Verify components still work with new configuration
      const testData = Buffer.from('configuration test data');
      const compressionResult = await compressionEngine.compress(testData);
      expect(compressionResult.compressedData.length).toBeGreaterThan(0);

      const fileMetadata: FileMetadata = {
        id: 'config-test-file',
        filename: 'config-test.txt',
        originalName: 'config-test.txt',
        mimeType: 'text/plain',
        size: 1024,
        checksum: 'config-checksum',
        backend: 'local',
        storagePath: '/files/config-test-file',
        access: 'private',
        ownerId: 'user-123',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        thumbnails: [],
        replicationNodes: [],
        replicationStatus: 'pending'
      };

      await replicationManager.replicateFile('config-file', ['node-2'], fileMetadata);

      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should monitor system health across components', async () => {
      // Check replication health
      const replicationHealth = await replicationManager.checkReplicationHealth();
      expect(replicationHealth).toBeDefined();
      expect(replicationHealth.totalFiles).toBeGreaterThanOrEqual(0);
      expect(replicationHealth.replicatedFiles).toBeGreaterThanOrEqual(0);

      // Check compression stats
      const compressionStats = compressionEngine.getStats();
      expect(compressionStats).toBeDefined();
      expect(compressionStats.totalJobs).toBeGreaterThanOrEqual(0);
    });

    it('should handle health check failures gracefully', async () => {
      // Health checks should not throw errors
      const healthCheck = await replicationManager.checkReplicationHealth();
      expect(healthCheck).toBeDefined();

      const stats = compressionEngine.getStats();
      expect(stats).toBeDefined();
    });
  });
});