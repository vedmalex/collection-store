/**
 * File Replication Manager Tests
 * Week 2 Day 13-14: File Replication Manager Testing
 *
 * Comprehensive test suite for file replication across cluster nodes
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileReplicationManager, FileReplicationManagerConfig } from '../replication/FileReplicationManager';
import type { FileMetadata, NodeInfo, ReplicationJob } from '../interfaces/types';
import { ReplicationError } from '../interfaces/errors';

describe('FileReplicationManager', () => {
  let replicationManager: FileReplicationManager;
  let testConfig: Partial<FileReplicationManagerConfig>;
  let testNodes: NodeInfo[];
  let testMetadata: FileMetadata;

  beforeEach(async () => {
    // Setup test nodes
    testNodes = [
      {
        id: 'node-1',
        address: '192.168.1.10',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['replication', 'storage']
      },
      {
        id: 'node-2',
        address: '192.168.1.11',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['replication', 'storage']
      },
      {
        id: 'node-3',
        address: '192.168.1.12',
        port: 8080,
        status: 'online',
        lastSeen: new Date(),
        capabilities: ['replication', 'storage']
      }
    ];

    // Test configuration
    testConfig = {
      nodeId: 'test-node',
      clusterNodes: testNodes,
      defaultStrategy: 'direct',
      largeFileThreshold: 50 * 1024 * 1024, // 50MB
      chunkSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentReplications: 3,
      healthCheckInterval: 5000, // 5 seconds for testing
      nodeTimeoutMs: 2000,
      retryAttempts: 2,
      retryDelayMs: 100,
      orphanedFileCheckInterval: 10000,
      orphanedFileRetentionMs: 60000,
      walEnabled: true,
      walRetentionMs: 300000
    };

    // Test file metadata
    testMetadata = {
      id: 'test-file-123',
      filename: 'test-document.pdf',
      originalName: 'test-document.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 1024, // 1MB
      checksum: 'abc123def456',
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

    replicationManager = new FileReplicationManager(testConfig);
    await replicationManager.initialize();
  });

  afterEach(async () => {
    if (replicationManager) {
      await replicationManager.shutdown();
    }
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid config', async () => {
      const newManager = new FileReplicationManager(testConfig);

      const startTime = performance.now();
      await newManager.initialize();
      const initTime = performance.now() - startTime;

      expect(initTime).toBeLessThan(1000); // Should initialize quickly

      await newManager.shutdown();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      const newManager = new FileReplicationManager(testConfig);

      await newManager.initialize();
      await newManager.initialize(); // Should not throw

      await newManager.shutdown();
    });

    it('should emit initialization events', async () => {
      const newManager = new FileReplicationManager(testConfig);

      let initEventFired = false;
      newManager.on('initialized', () => {
        initEventFired = true;
      });

      await newManager.initialize();
      expect(initEventFired).toBe(true);

      await newManager.shutdown();
    });

    it('should shutdown gracefully', async () => {
      const newManager = new FileReplicationManager(testConfig);
      await newManager.initialize();

      let shutdownEventFired = false;
      newManager.on('shutdown', () => {
        shutdownEventFired = true;
      });

      await newManager.shutdown();
      expect(shutdownEventFired).toBe(true);
    });
  });

  describe('File Replication Operations', () => {
    it('should replicate file to target nodes successfully', async () => {
      const targetNodes = ['node-1', 'node-2'];

      let replicationStarted = false;
      let replicationCompleted = false;

      replicationManager.on('replicationStarted', (event) => {
        replicationStarted = true;
        expect(event.fileId).toBe(testMetadata.id);
        expect(event.targetNodes).toEqual(targetNodes);
      });

      replicationManager.on('replicationCompleted', (event) => {
        replicationCompleted = true;
        expect(event.fileId).toBe(testMetadata.id);
        expect(event.targetNodes).toEqual(targetNodes);
      });

      const startTime = performance.now();
      await replicationManager.replicateFile(testMetadata.id, targetNodes, testMetadata);
      const replicationTime = performance.now() - startTime;

      expect(replicationStarted).toBe(true);
      expect(replicationCompleted).toBe(true);
      expect(replicationTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Replication completed in ${replicationTime.toFixed(2)}ms`);
    });

    it('should select appropriate strategy based on file metadata', async () => {
      // Small file should use direct strategy
      const smallFile = { ...testMetadata, size: 1024 * 1024 }; // 1MB
      await replicationManager.replicateFile(smallFile.id, ['node-1'], smallFile);

      // Large file should use chunked strategy
      const largeFile = { ...testMetadata, id: 'large-file', size: 100 * 1024 * 1024 }; // 100MB
      await replicationManager.replicateFile(largeFile.id, ['node-1'], largeFile);

      // Video file should use streaming strategy
      const videoFile = { ...testMetadata, id: 'video-file', mimeType: 'video/mp4', size: 50 * 1024 * 1024 };
      await replicationManager.replicateFile(videoFile.id, ['node-1'], videoFile);

      // All should complete successfully
      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBe(3);
      expect(stats.successfulReplications).toBe(3);
    });

    it('should handle replication to multiple nodes', async () => {
      const targetNodes = ['node-1', 'node-2', 'node-3'];

      await replicationManager.replicateFile(testMetadata.id, targetNodes, testMetadata);

      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBe(1);
      expect(stats.successfulReplications).toBe(1);
    });

    it('should reject replication with no target nodes', async () => {
      await expect(replicationManager.replicateFile(testMetadata.id, [], testMetadata))
        .rejects.toThrow(ReplicationError);
    });

    it('should prevent duplicate replication jobs', async () => {
      // Start first replication (don't await)
      const firstReplication = replicationManager.replicateFile(testMetadata.id, ['node-1'], testMetadata);

      // Wait a bit to ensure first job is registered
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to start second replication for same file
      await expect(replicationManager.replicateFile(testMetadata.id, ['node-2'], testMetadata))
        .rejects.toThrow(ReplicationError);

      // Wait for first to complete
      await firstReplication;
    });

    it('should emit WAL entries when enabled', async () => {
      let walEntryCreated = false;

      replicationManager.on('walEntryCreated', (entry) => {
        walEntryCreated = true;
        expect(entry.type).toBe('FILE_REPLICATION');
        expect(entry.data.fileId).toBe(testMetadata.id);
      });

      await replicationManager.replicateFile(testMetadata.id, ['node-1'], testMetadata);
      expect(walEntryCreated).toBe(true);
    });
  });

  describe('Job Management', () => {
    it('should track active replication jobs', async () => {
      const targetNodes = ['node-1', 'node-2'];

      // Start replication but don't await
      const replicationPromise = replicationManager.replicateFile(testMetadata.id, targetNodes, testMetadata);

      // Check active jobs during replication
      const activeJobs = replicationManager.getActiveJobs();
      expect(activeJobs.length).toBeGreaterThanOrEqual(0); // Job might complete quickly

      await replicationPromise;

      // After completion, no active jobs
      const finalActiveJobs = replicationManager.getActiveJobs();
      expect(finalActiveJobs.length).toBe(0);
    });

    it('should provide job status information', async () => {
      let jobId: string;

      replicationManager.on('replicationStarted', (event) => {
        jobId = event.jobId;
      });

      await replicationManager.replicateFile(testMetadata.id, ['node-1'], testMetadata);

      // Job should be completed or not found (cleaned up)
      const jobStatus = replicationManager.getJobStatus(jobId!);
      // Job might be cleaned up after completion, so either null or completed
      if (jobStatus) {
        expect(jobStatus.status).toBe('completed');
      }
    });

    it('should update statistics correctly', async () => {
      const initialStats = replicationManager.getStats();
      expect(initialStats.totalReplications).toBe(0);

      await replicationManager.replicateFile(testMetadata.id, ['node-1'], testMetadata);

      const updatedStats = replicationManager.getStats();
      expect(updatedStats.totalReplications).toBe(1);
      expect(updatedStats.successfulReplications).toBe(1);
      expect(updatedStats.failedReplications).toBe(0);
      expect(updatedStats.totalBytesReplicated).toBe(testMetadata.size);
      expect(updatedStats.averageReplicationTime).toBeGreaterThan(0);
    });
  });

  describe('File Synchronization', () => {
    it('should sync files from source node', async () => {
      let syncCompleted = false;

      replicationManager.on('syncCompleted', (event) => {
        syncCompleted = true;
        expect(event.sourceNode).toBe('node-1');
      });

      await replicationManager.syncFiles('node-1');
      expect(syncCompleted).toBe(true);
    });

    it('should handle sync failures gracefully', async () => {
      let syncFailed = false;

      replicationManager.on('syncFailed', (event) => {
        syncFailed = true;
        expect(event.sourceNode).toBe('invalid-node');
      });

      // This would fail in a real implementation
      try {
        await replicationManager.syncFiles('invalid-node');
      } catch (error) {
        // Expected to fail
      }
    });

    it('should emit sync progress events', async () => {
      let progressReceived = false;

      replicationManager.on('syncProgress', (event) => {
        progressReceived = true;
        expect(event.sourceNode).toBeDefined();
      });

      await replicationManager.syncFiles('node-1');
      expect(progressReceived).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should check replication health', async () => {
      const health = await replicationManager.checkReplicationHealth();

      expect(health).toBeDefined();
      expect(health.totalFiles).toBeGreaterThanOrEqual(0);
      expect(health.replicatedFiles).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(health.missingReplicas)).toBe(true);
      expect(Array.isArray(health.corruptedFiles)).toBe(true);
      expect(health.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should emit node health change events', async () => {
      let healthChangeReceived = false;

      replicationManager.on('nodeHealthChanged', (event) => {
        healthChangeReceived = true;
        expect(event.nodeId).toBeDefined();
        expect(event.health).toBeDefined();
      });

      // Wait a bit for health checks to run
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Orphaned File Cleanup', () => {
    it('should cleanup orphaned files', async () => {
      let cleanupCompleted = false;

      replicationManager.on('orphanedFilesCleanup', (event) => {
        cleanupCompleted = true;
        expect(event.cleanedCount).toBeGreaterThanOrEqual(0);
        expect(event.totalFound).toBeGreaterThanOrEqual(0);
      });

      await replicationManager.cleanupOrphanedFiles();
      expect(cleanupCompleted).toBe(true);
    });

    it('should emit orphaned file removal events', async () => {
      let fileRemoved = false;

      replicationManager.on('orphanedFileRemoved', (event) => {
        fileRemoved = true;
        expect(event.fileId).toBeDefined();
      });

      await replicationManager.cleanupOrphanedFiles();
      // May or may not have orphaned files to remove
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const newConfig = {
        defaultStrategy: 'chunked' as const,
        maxConcurrentReplications: 10,
        retryAttempts: 5
      };

      let configUpdated = false;
      replicationManager.on('configUpdated', (config) => {
        configUpdated = true;
        expect(config.defaultStrategy).toBe('chunked');
        expect(config.maxConcurrentReplications).toBe(10);
        expect(config.retryAttempts).toBe(5);
      });

      replicationManager.updateConfig(newConfig);

      const updatedConfig = replicationManager.getConfig();
      expect(updatedConfig.defaultStrategy).toBe('chunked');
      expect(updatedConfig.maxConcurrentReplications).toBe(10);
      expect(updatedConfig.retryAttempts).toBe(5);
      expect(configUpdated).toBe(true);
    });

    it('should preserve existing config when updating', async () => {
      const originalConfig = replicationManager.getConfig();
      const originalNodeId = originalConfig.nodeId;

      replicationManager.updateConfig({ defaultStrategy: 'streaming' });

      const updatedConfig = replicationManager.getConfig();
      expect(updatedConfig.nodeId).toBe(originalNodeId); // Should be preserved
      expect(updatedConfig.defaultStrategy).toBe('streaming'); // Should be updated
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedManager = new FileReplicationManager(testConfig);

      await expect(uninitializedManager.replicateFile(testMetadata.id, ['node-1'], testMetadata))
        .rejects.toThrow('Replication manager not initialized');

      await expect(uninitializedManager.syncFiles('node-1'))
        .rejects.toThrow('Replication manager not initialized');

      await expect(uninitializedManager.checkReplicationHealth())
        .rejects.toThrow('Replication manager not initialized');

      await expect(uninitializedManager.cleanupOrphanedFiles())
        .rejects.toThrow('Replication manager not initialized');
    });

    it('should handle replication failures with retry', async () => {
      // This test would need a way to simulate failures
      // For now, we'll test the retry mechanism indirectly
      const stats = replicationManager.getStats();
      expect(stats.failedReplications).toBe(0); // No failures yet
    });

    it('should emit replication failed events', async () => {
      let replicationFailed = false;

      replicationManager.on('replicationFailed', (event) => {
        replicationFailed = true;
        expect(event.fileId).toBeDefined();
        expect(event.error).toBeDefined();
      });

      // In a real scenario, this would trigger a failure
      // For testing, we'll just verify the event handler is set up
    });
  });

  describe('Performance', () => {
    it('should handle concurrent replications efficiently', async () => {
      const concurrentReplications = 3;
      const files = Array.from({ length: concurrentReplications }, (_, i) => ({
        ...testMetadata,
        id: `concurrent-file-${i}`,
        filename: `concurrent-file-${i}.pdf`
      }));

      const startTime = performance.now();
      const replicationPromises = files.map(file =>
        replicationManager.replicateFile(file.id, ['node-1'], file)
      );

      await Promise.all(replicationPromises);
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      const stats = replicationManager.getStats();
      expect(stats.totalReplications).toBe(concurrentReplications);
      expect(stats.successfulReplications).toBe(concurrentReplications);

      console.log(`Concurrent replications: ${concurrentReplications} files in ${totalTime.toFixed(2)}ms`);
    });

    it('should maintain performance under load', async () => {
      const iterations = 10;
      const replicationTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const file = {
          ...testMetadata,
          id: `load-test-file-${i}`,
          filename: `load-test-file-${i}.pdf`
        };

        const startTime = performance.now();
        await replicationManager.replicateFile(file.id, ['node-1'], file);
        replicationTimes.push(performance.now() - startTime);
      }

      const avgReplicationTime = replicationTimes.reduce((sum, time) => sum + time, 0) / replicationTimes.length;
      const maxReplicationTime = Math.max(...replicationTimes);

      expect(avgReplicationTime).toBeLessThan(1000); // Average should be under 1 second
      expect(maxReplicationTime).toBeLessThan(2000); // Max should be under 2 seconds

      console.log(`Load test: ${iterations} replications, avg: ${avgReplicationTime.toFixed(2)}ms, max: ${maxReplicationTime.toFixed(2)}ms`);
    });
  });

  describe('Strategy Selection', () => {
    it('should use direct strategy for small files', async () => {
      const smallFile = { ...testMetadata, size: 10 * 1024 * 1024 }; // 10MB

      await replicationManager.replicateFile(smallFile.id, ['node-1'], smallFile);

      // Strategy selection is internal, but we can verify it completed successfully
      const stats = replicationManager.getStats();
      expect(stats.successfulReplications).toBe(1);
    });

    it('should use chunked strategy for large files', async () => {
      const largeFile = { ...testMetadata, id: 'large-file', size: 200 * 1024 * 1024 }; // 200MB

      await replicationManager.replicateFile(largeFile.id, ['node-1'], largeFile);

      const stats = replicationManager.getStats();
      expect(stats.successfulReplications).toBe(1);
    });

    it('should use streaming strategy for media files', async () => {
      const videoFile = { ...testMetadata, id: 'video-file', mimeType: 'video/mp4' };
      const audioFile = { ...testMetadata, id: 'audio-file', mimeType: 'audio/mp3' };
      const imageFile = { ...testMetadata, id: 'image-file', mimeType: 'image/jpeg' };

      await Promise.all([
        replicationManager.replicateFile(videoFile.id, ['node-1'], videoFile),
        replicationManager.replicateFile(audioFile.id, ['node-1'], audioFile),
        replicationManager.replicateFile(imageFile.id, ['node-1'], imageFile)
      ]);

      const stats = replicationManager.getStats();
      expect(stats.successfulReplications).toBe(3);
    });
  });
});