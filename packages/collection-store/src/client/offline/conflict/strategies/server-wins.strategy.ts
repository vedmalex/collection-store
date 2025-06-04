/**
 * Phase 5.3: Offline-First Support - Server Wins Strategy
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Server-side data always takes precedence
 * ✅ IDEA: Ensures data consistency with authoritative source
 * ✅ IDEA: Useful for critical data synchronization
 */

import type { EnhancedConflictData, ConflictResolution } from '../../interfaces';
import { BaseResolutionStrategy } from './base-strategy';

/**
 * Server Wins resolution strategy
 * Always chooses the remote/server data over local/client data
 */
export class ServerWinsStrategy extends BaseResolutionStrategy {
  constructor() {
    super(
      'server-wins',
      2, // Medium-high priority for data consistency
      'Always chooses server/remote data over client/local data'
    );
  }

  /**
   * Resolve conflict by choosing server data
   */
  async resolve(conflict: EnhancedConflictData): Promise<ConflictResolution> {
    return this.executeResolution(conflict, async () => {
      this.validateConflict(conflict);

      // Always return remote data
      if (!conflict.remoteData) {
        throw new Error('Server data is required for server-wins strategy');
      }

      // Create a deep copy to avoid mutations
      const resolvedData = this.deepCopy(conflict.remoteData);

      // Add resolution metadata
      resolvedData._conflictResolution = {
        strategy: 'server-wins',
        timestamp: Date.now(),
        originalLocalData: conflict.localData ? this.deepCopy(conflict.localData) : null
      };

      return resolvedData;
    });
  }

  /**
   * Check if this strategy can resolve the conflict
   */
  canResolve(conflict: EnhancedConflictData): boolean {
    // Can resolve any conflict where remote data exists
    return !!(conflict && conflict.remoteData);
  }
}