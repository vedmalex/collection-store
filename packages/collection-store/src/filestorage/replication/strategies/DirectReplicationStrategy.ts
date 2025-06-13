/**
 * Direct Replication Strategy
 * Week 2 Day 13-14: File Replication Manager
 *
 * Simple direct file replication for small to medium files
 */

import type { ReplicationStrategy, FileMetadata } from '../../interfaces/types';

export interface DirectReplicationStrategyConfig {
  nodeId: string;
  timeoutMs: number;
}

export class DirectReplicationStrategy implements ReplicationStrategy {
  readonly name = 'direct';
  private config: DirectReplicationStrategyConfig;

  constructor(config: DirectReplicationStrategyConfig) {
    this.config = config;
  }

  async replicate(fileId: string, targetNodes: string[], metadata?: FileMetadata): Promise<void> {
    // Mock implementation - would perform actual direct replication
    for (const node of targetNodes) {
      await this.replicateToNode(fileId, node, metadata);
    }
  }

  canHandle(metadata: FileMetadata): boolean {
    // Direct strategy is good for files under 50MB
    return metadata.size < 50 * 1024 * 1024;
  }

  getEstimatedTime(metadata: FileMetadata): number {
    // Estimate based on file size (simplified)
    return Math.max(1000, metadata.size / (10 * 1024 * 1024) * 1000); // ~10MB/s
  }

  private async replicateToNode(fileId: string, targetNode: string, metadata?: FileMetadata): Promise<void> {
    // Mock implementation - would make actual network call
    // Make it slower for testing duplicate job prevention
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}