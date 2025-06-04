/**
 * Phase 5.3: Offline-First Support - Client Wins Strategy
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Client-side data always takes precedence
 * ✅ IDEA: Simple and fast resolution strategy
 * ✅ IDEA: Useful for offline-first applications
 */

import type { EnhancedConflictData, ConflictResolution } from '../../interfaces';
import { BaseResolutionStrategy } from './base-strategy';

/**
 * Client Wins resolution strategy
 * Always chooses the local/client data over remote/server data
 */
export class ClientWinsStrategy extends BaseResolutionStrategy {
  constructor() {
    super(
      'client-wins',
      1, // High priority for offline-first scenarios
      'Always chooses client/local data over server/remote data'
    );
  }

  /**
   * Resolve conflict by choosing client data
   */
  async resolve(conflict: EnhancedConflictData): Promise<ConflictResolution> {
    return this.executeResolution(conflict, async () => {
      this.validateConflict(conflict);

      // Always return local data
      if (!conflict.localData) {
        throw new Error('Client data is required for client-wins strategy');
      }

      // Create a deep copy to avoid mutations
      const resolvedData = this.deepCopy(conflict.localData);

      // Add resolution metadata
      resolvedData._conflictResolution = {
        strategy: 'client-wins',
        timestamp: Date.now(),
        originalRemoteData: conflict.remoteData ? this.deepCopy(conflict.remoteData) : null
      };

      return resolvedData;
    });
  }

  /**
   * Check if this strategy can resolve the conflict
   */
  canResolve(conflict: EnhancedConflictData): boolean {
    // Can resolve any conflict where local data exists
    return !!(conflict && conflict.localData);
  }
}