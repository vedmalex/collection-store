/**
 * Phase 5.3: Offline-First Support - Timestamp Based Strategy
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Choose data based on most recent timestamp
 * ✅ IDEA: Intelligent conflict resolution using temporal data
 * ✅ IDEA: Fallback mechanisms for missing timestamps
 */

import type { EnhancedConflictData, ConflictResolution } from '../../interfaces';
import { BaseResolutionStrategy } from './base-strategy';

/**
 * Timestamp Based resolution strategy
 * Chooses the data with the most recent timestamp
 */
export class TimestampBasedStrategy extends BaseResolutionStrategy {
  private timestampTolerance: number; // ms tolerance for "same time"

  constructor(timestampTolerance: number = 1000) {
    super(
      'timestamp-based',
      3, // Medium priority - good balance of intelligence and reliability
      'Chooses data with the most recent timestamp'
    );
    this.timestampTolerance = timestampTolerance;
  }

  /**
   * Resolve conflict by choosing data with latest timestamp
   */
  async resolve(conflict: EnhancedConflictData): Promise<ConflictResolution> {
    return this.executeResolution(conflict, async () => {
      this.validateConflict(conflict);

      const localTimestamp = this.extractTimestamp(conflict.localData);
      const remoteTimestamp = this.extractTimestamp(conflict.remoteData);

      // Handle cases where timestamps are missing
      if (!localTimestamp && !remoteTimestamp) {
        throw new Error('No timestamps found in either local or remote data');
      }

      if (!localTimestamp) {
        return this.createResolvedData(conflict.remoteData, conflict.localData, 'remote', 'missing-local-timestamp');
      }

      if (!remoteTimestamp) {
        return this.createResolvedData(conflict.localData, conflict.remoteData, 'local', 'missing-remote-timestamp');
      }

      // Compare timestamps
      const timeDiff = localTimestamp - remoteTimestamp;

      if (Math.abs(timeDiff) <= this.timestampTolerance) {
        // Timestamps are essentially the same - use fallback strategy
        return this.resolveSameTimestamp(conflict, localTimestamp, remoteTimestamp);
      }

      // Choose the more recent data
      if (localTimestamp > remoteTimestamp) {
        return this.createResolvedData(conflict.localData, conflict.remoteData, 'local', 'newer-timestamp');
      } else {
        return this.createResolvedData(conflict.remoteData, conflict.localData, 'remote', 'newer-timestamp');
      }
    });
  }

  /**
   * Check if this strategy can resolve the conflict
   */
  canResolve(conflict: EnhancedConflictData): boolean {
    if (!conflict) return false;

    // Need at least one timestamp to make a decision
    const localTimestamp = this.extractTimestamp(conflict.localData);
    const remoteTimestamp = this.extractTimestamp(conflict.remoteData);

    return !!(localTimestamp || remoteTimestamp);
  }

  /**
   * Set timestamp tolerance for "same time" conflicts
   */
  setTimestampTolerance(tolerance: number): void {
    this.timestampTolerance = tolerance;
  }

  /**
   * Get current timestamp tolerance
   */
  getTimestampTolerance(): number {
    return this.timestampTolerance;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Resolve conflicts when timestamps are essentially the same
   */
  private resolveSameTimestamp(
    conflict: EnhancedConflictData,
    localTimestamp: number,
    remoteTimestamp: number
  ): any {
    // Fallback strategies for same timestamp:

    // 1. If one has more fields, choose that one
    const localFieldCount = this.countFields(conflict.localData);
    const remoteFieldCount = this.countFields(conflict.remoteData);

    if (localFieldCount !== remoteFieldCount) {
      const winner = localFieldCount > remoteFieldCount ? 'local' : 'remote';
      const winnerData = winner === 'local' ? conflict.localData : conflict.remoteData;
      const loserData = winner === 'local' ? conflict.remoteData : conflict.localData;

      return this.createResolvedData(winnerData, loserData, winner, 'more-fields');
    }

    // 2. If conflict metadata has severity, prefer lower severity (less conflicted)
    if (conflict.metadata && conflict.metadata.severity) {
      if (conflict.metadata.severity === 'low') {
        // For low severity, try to merge intelligently
        return this.createMergedData(conflict, 'intelligent-merge');
      }
    }

    // 3. Default fallback - prefer local data (offline-first principle)
    return this.createResolvedData(conflict.localData, conflict.remoteData, 'local', 'same-timestamp-fallback');
  }

  /**
   * Create resolved data with metadata
   */
  private createResolvedData(
    winnerData: any,
    loserData: any,
    winner: 'local' | 'remote',
    reason: string
  ): any {
    const resolvedData = this.deepCopy(winnerData);

    resolvedData._conflictResolution = {
      strategy: 'timestamp-based',
      timestamp: Date.now(),
      winner,
      reason,
      originalData: {
        local: winner === 'remote' ? this.deepCopy(loserData) : null,
        remote: winner === 'local' ? this.deepCopy(loserData) : null
      },
      timestampComparison: {
        localTimestamp: this.extractTimestamp(winner === 'local' ? winnerData : loserData),
        remoteTimestamp: this.extractTimestamp(winner === 'remote' ? winnerData : loserData),
        tolerance: this.timestampTolerance
      }
    };

    return resolvedData;
  }

  /**
   * Create merged data for same timestamp scenarios
   */
  private createMergedData(conflict: EnhancedConflictData, reason: string): any {
    // Intelligent merge: prefer local for user data, remote for system data
    const merged = this.mergeObjects(conflict.localData, conflict.remoteData, true);

    merged._conflictResolution = {
      strategy: 'timestamp-based',
      timestamp: Date.now(),
      winner: 'merged',
      reason,
      originalData: {
        local: this.deepCopy(conflict.localData),
        remote: this.deepCopy(conflict.remoteData)
      },
      timestampComparison: {
        localTimestamp: this.extractTimestamp(conflict.localData),
        remoteTimestamp: this.extractTimestamp(conflict.remoteData),
        tolerance: this.timestampTolerance
      }
    };

    return merged;
  }

  /**
   * Count fields in an object (for complexity comparison)
   */
  private countFields(data: any): number {
    if (!data || typeof data !== 'object') return 0;

    let count = 0;
    for (const key in data) {
      if (data.hasOwnProperty(key) && !key.startsWith('_')) {
        count++;
        if (typeof data[key] === 'object' && data[key] !== null) {
          count += this.countFields(data[key]);
        }
      }
    }

    return count;
  }
}