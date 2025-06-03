/**
 * File Replication Manager
 * Week 2 Day 13-14: File Replication Manager
 *
 * Manages file replication across cluster nodes with:
 * - Multiple replication strategies (direct, chunked, streaming)
 * - Health monitoring and failure recovery
 * - WAL integration for durability
 * - Cross-node synchronization
 * - Orphaned file cleanup
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  FileMetadata,
  ReplicationConfig,
  ReplicationStrategy,
  ReplicationHealth,
  ReplicationJob,
  ReplicationStats,
  WALEntry,
  NodeInfo
} from '../interfaces/types';
import {
  FileStorageError,
  FileNotFoundError,
  ReplicationError
} from '../interfaces/errors';
import { ReplicationHealthMonitor } from './ReplicationHealthMonitor';
import { FileSyncManager } from './FileSyncManager';
import { DirectReplicationStrategy } from './strategies/DirectReplicationStrategy';
import { ChunkedReplicationStrategy } from './strategies/ChunkedReplicationStrategy';
import { StreamingReplicationStrategy } from './strategies/StreamingReplicationStrategy';

export interface FileReplicationManagerConfig {
  // Node configuration
  nodeId: string;
  clusterNodes: NodeInfo[];

  // Replication settings
  defaultStrategy: 'direct' | 'chunked' | 'streaming';
  largeFileThreshold: number; // bytes
  chunkSize: number;
  maxConcurrentReplications: number;

  // Health monitoring
  healthCheckInterval: number;
  nodeTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;

  // Cleanup settings
  orphanedFileCheckInterval: number;
  orphanedFileRetentionMs: number;

  // WAL integration
  walEnabled: boolean;
  walRetentionMs: number;
}

export class FileReplicationManager extends EventEmitter {
  private config: FileReplicationManagerConfig;
  private strategies = new Map<string, ReplicationStrategy>();
  private activeJobs = new Map<string, ReplicationJob>();
  private healthMonitor: ReplicationHealthMonitor;
  private syncManager: FileSyncManager;
  private initialized = false;
  private stats: ReplicationStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<FileReplicationManagerConfig> = {}) {
    super();

    this.config = {
      nodeId: crypto.randomUUID(),
      clusterNodes: [],
      defaultStrategy: 'direct',
      largeFileThreshold: 100 * 1024 * 1024, // 100MB
      chunkSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentReplications: 5,
      healthCheckInterval: 30000, // 30 seconds
      nodeTimeoutMs: 10000, // 10 seconds
      retryAttempts: 3,
      retryDelayMs: 1000,
      orphanedFileCheckInterval: 300000, // 5 minutes
      orphanedFileRetentionMs: 86400000, // 24 hours
      walEnabled: true,
      walRetentionMs: 604800000, // 7 days
      ...config
    };

    this.stats = {
      totalReplications: 0,
      successfulReplications: 0,
      failedReplications: 0,
      averageReplicationTime: 0,
      totalBytesReplicated: 0,
      activeReplications: 0,
      nodeHealth: new Map(),
      lastHealthCheck: new Date()
    };

    this.initializeStrategies();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize health monitor
      this.healthMonitor = new ReplicationHealthMonitor({
        nodeId: this.config.nodeId,
        clusterNodes: this.config.clusterNodes,
        healthCheckInterval: this.config.healthCheckInterval,
        nodeTimeoutMs: this.config.nodeTimeoutMs
      });

      // Initialize sync manager
      this.syncManager = new FileSyncManager({
        nodeId: this.config.nodeId,
        clusterNodes: this.config.clusterNodes,
        chunkSize: this.config.chunkSize
      });

            // Start health monitoring
      await this.healthMonitor.start();

      // Start sync manager
      await this.syncManager.start();

      // Setup event listeners
      this.setupEventListeners();

      // Start cleanup scheduler
      this.startCleanupScheduler();

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new FileStorageError('Failed to initialize replication manager', 'REPLICATION_INIT_ERROR', { cause: error });
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      // Cancel all active jobs
      await this.cancelAllJobs();

      // Stop cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }

      // Stop health monitoring
      await this.healthMonitor.stop();

      // Stop sync manager
      await this.syncManager.stop();

      this.initialized = false;
      this.emit('shutdown');
    } catch (error) {
      console.warn('Error during replication manager shutdown:', error);
    }
  }

  async replicateFile(
    fileId: string,
    targetNodes: string[],
    metadata?: FileMetadata
  ): Promise<void> {
    if (!this.initialized) {
      throw new FileStorageError('Replication manager not initialized');
    }

    if (targetNodes.length === 0) {
      throw new ReplicationError('No target nodes specified', { fileId });
    }

    // Check if we're already replicating this file
    const existingJob = Array.from(this.activeJobs.values())
      .find(job => job.fileId === fileId && job.status === 'running');

    if (existingJob) {
      throw new ReplicationError('File replication already in progress', { fileId });
    }

    const jobId = crypto.randomUUID();
    const job: ReplicationJob = {
      id: jobId,
      fileId,
      targetNodes,
      sourceNode: this.config.nodeId,
      strategy: this.selectStrategy(metadata),
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      retryCount: 0,
      metadata
    };

    this.activeJobs.set(jobId, job);
    this.stats.activeReplications++;

    try {
      // Create WAL entry if enabled
      if (this.config.walEnabled) {
        await this.createWALEntry(job);
      }

      // Start replication
      job.status = 'running';
      this.emit('replicationStarted', { jobId, fileId, targetNodes });

      const strategy = this.strategies.get(job.strategy);
      if (!strategy) {
        throw new ReplicationError(`Unknown replication strategy: ${job.strategy}`, { fileId });
      }

      await strategy.replicate(fileId, targetNodes, metadata);

      // Mark as completed
      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;

      this.updateStats(job, true);
      this.emit('replicationCompleted', { jobId, fileId, targetNodes });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error.message;

      this.updateStats(job, false);
      this.emit('replicationFailed', { jobId, fileId, targetNodes, error: error.message });

      // Retry if attempts remaining
      if (job.retryCount < this.config.retryAttempts) {
        await this.scheduleRetry(job);
      } else {
        throw new ReplicationError('File replication failed after all retry attempts', {
          fileId,
          cause: error
        });
      }
    } finally {
      this.activeJobs.delete(jobId);
      this.stats.activeReplications--;
    }
  }

  async syncFiles(sourceNode: string): Promise<void> {
    if (!this.initialized) {
      throw new FileStorageError('Replication manager not initialized');
    }

    try {
      await this.syncManager.syncFromNode(sourceNode);
      this.emit('syncCompleted', { sourceNode });
    } catch (error) {
      this.emit('syncFailed', { sourceNode, error: error.message });
      throw new ReplicationError('File synchronization failed', { sourceNode, cause: error });
    }
  }

  async checkReplicationHealth(): Promise<ReplicationHealth> {
    if (!this.initialized) {
      throw new FileStorageError('Replication manager not initialized');
    }

    return this.healthMonitor.getHealth();
  }

  async cleanupOrphanedFiles(): Promise<void> {
    if (!this.initialized) {
      throw new FileStorageError('Replication manager not initialized');
    }

    try {
      const orphanedFiles = await this.findOrphanedFiles();
      let cleanedCount = 0;

      for (const fileId of orphanedFiles) {
        try {
          await this.removeOrphanedFile(fileId);
          cleanedCount++;
        } catch (error) {
          console.warn(`Failed to cleanup orphaned file ${fileId}:`, error);
        }
      }

      this.emit('orphanedFilesCleanup', { cleanedCount, totalFound: orphanedFiles.length });
    } catch (error) {
      throw new ReplicationError('Orphaned file cleanup failed', { cause: error });
    }
  }

  getJobStatus(jobId: string): ReplicationJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  getActiveJobs(): ReplicationJob[] {
    return Array.from(this.activeJobs.values());
  }

  getStats(): ReplicationStats {
    return { ...this.stats };
  }

  updateConfig(updates: Partial<FileReplicationManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', this.config);
  }

  getConfig(): FileReplicationManagerConfig {
    return { ...this.config };
  }

  private initializeStrategies(): void {
    this.strategies.set('direct', new DirectReplicationStrategy({
      nodeId: this.config.nodeId,
      timeoutMs: this.config.nodeTimeoutMs
    }));

    this.strategies.set('chunked', new ChunkedReplicationStrategy({
      nodeId: this.config.nodeId,
      chunkSize: this.config.chunkSize,
      timeoutMs: this.config.nodeTimeoutMs
    }));

    this.strategies.set('streaming', new StreamingReplicationStrategy({
      nodeId: this.config.nodeId,
      chunkSize: this.config.chunkSize,
      timeoutMs: this.config.nodeTimeoutMs
    }));
  }

  private selectStrategy(metadata?: FileMetadata): string {
    if (!metadata) {
      return this.config.defaultStrategy;
    }

    // Use chunked strategy for large files
    if (metadata.size > this.config.largeFileThreshold) {
      return 'chunked';
    }

    // Use streaming for video/audio files
    if (metadata.mimeType.startsWith('video/') || metadata.mimeType.startsWith('audio/')) {
      return 'streaming';
    }

    return this.config.defaultStrategy;
  }

  private async createWALEntry(job: ReplicationJob): Promise<void> {
    const walEntry: WALEntry = {
      type: 'FILE_REPLICATION',
      transactionId: job.id,
      timestamp: Date.now(),
      data: {
        fileId: job.fileId,
        targetNodes: job.targetNodes,
        strategy: job.strategy,
        sourceNode: job.sourceNode
      }
    };

    // This would integrate with the actual WAL system
    this.emit('walEntryCreated', walEntry);
  }

  private async scheduleRetry(job: ReplicationJob): Promise<void> {
    job.retryCount++;
    job.status = 'retrying';

    const delay = this.config.retryDelayMs * Math.pow(2, job.retryCount - 1); // Exponential backoff

    setTimeout(async () => {
      try {
        await this.replicateFile(job.fileId, job.targetNodes, job.metadata);
      } catch (error) {
        console.warn(`Retry ${job.retryCount} failed for file ${job.fileId}:`, error);
      }
    }, delay);
  }

  private async findOrphanedFiles(): Promise<string[]> {
    // This would integrate with the actual file storage system
    // to find files that exist locally but are not properly replicated
    // or files that exist on remote nodes but not locally

    const orphanedFiles: string[] = [];
    const cutoffTime = Date.now() - this.config.orphanedFileRetentionMs;

    // Mock implementation - would be replaced with actual logic
    return orphanedFiles;
  }

  private async removeOrphanedFile(fileId: string): Promise<void> {
    // This would integrate with the actual file storage system
    // to remove orphaned files

    this.emit('orphanedFileRemoved', { fileId });
  }

  private updateStats(job: ReplicationJob, success: boolean): void {
    this.stats.totalReplications++;

    if (success) {
      this.stats.successfulReplications++;
    } else {
      this.stats.failedReplications++;
    }

    if (job.endTime && job.startTime) {
      const duration = job.endTime.getTime() - job.startTime.getTime();
      this.stats.averageReplicationTime =
        (this.stats.averageReplicationTime * (this.stats.totalReplications - 1) + duration) /
        this.stats.totalReplications;
    }

    if (job.metadata) {
      this.stats.totalBytesReplicated += job.metadata.size;
    }
  }

  private setupEventListeners(): void {
    this.healthMonitor.on('nodeHealthChanged', (event) => {
      this.stats.nodeHealth.set(event.nodeId, event.health);
      this.emit('nodeHealthChanged', event);
    });

    this.syncManager.on('syncProgress', (event) => {
      this.emit('syncProgress', event);
    });
  }

  private startCleanupScheduler(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        if (this.initialized) {
          await this.cleanupOrphanedFiles();
        }
      } catch (error) {
        // Only log if manager is still initialized
        if (this.initialized) {
          console.warn('Scheduled cleanup failed:', error);
        }
      }
    }, this.config.orphanedFileCheckInterval);
  }

  private async cancelAllJobs(): Promise<void> {
    const cancelPromises = Array.from(this.activeJobs.values()).map(async (job) => {
      job.status = 'cancelled';
      job.endTime = new Date();
      this.emit('replicationCancelled', { jobId: job.id, fileId: job.fileId });
    });

    await Promise.all(cancelPromises);
    this.activeJobs.clear();
    this.stats.activeReplications = 0;
  }
}