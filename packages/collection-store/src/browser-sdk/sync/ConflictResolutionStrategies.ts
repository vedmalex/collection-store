import { DataConflict, ResolutionResult } from './types';

/**
 * Defines strategies for resolving data conflicts during synchronization.
 */
export class ConflictResolutionStrategies {
  /**
   * Resolves a conflict using the "Last Write Wins" strategy based on a timestamp.
   * Assumes data items have a 'timestamp' property.
   * @param localData The local version of the data.
   * @param remoteData The remote version of the data.
   * @returns The resolved data item.
   */
  static lastWriteWins<T extends { timestamp: number }>(localData: T, remoteData: T): T {
    if (localData.timestamp > remoteData.timestamp) {
      return localData;
    } else {
      return remoteData;
    }
  }

  /**
   * Resolves a conflict by merging non-conflicting fields.
   * For conflicting fields, the remote version is preferred. This is a simplified merge.
   * @param localData The local version of the data.
   * @param remoteData The remote version of the data.
   * @returns The merged data item.
   */
  static mergeNonConflicting<T extends Record<string, any>>(localData: T, remoteData: T): T {
    const merged: T = { ...remoteData }; // Start with remote data

    for (const key in localData) {
      if (Object.prototype.hasOwnProperty.call(localData, key)) {
        // If the key exists in local but not in remote (or is different), prefer local if remote doesn't have it
        // or if local is more recent (if timestamps are available, otherwise a simple overwrite)
        if (!(key in remoteData) || JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])) {
          // A more sophisticated merge would involve deep merging objects and arrays
          // For simplicity, if conflict, remote wins for now or if no remote, local wins.
          if (!(key in remoteData)) {
            merged[key] = localData[key];
          } else if (typeof localData[key] === 'object' && localData[key] !== null &&
                     typeof remoteData[key] === 'object' && remoteData[key] !== null) {
            // Recursive merge for nested objects, can be expanded for arrays
            merged[key] = this.mergeNonConflicting(localData[key], remoteData[key]);
          }
          // If it's a primitive and conflicts, remoteData[key] is already in merged
        }
      }
    }
    return merged;
  }

  /**
   * A placeholder for a custom conflict resolution strategy.
   * This method can be extended to implement specific business logic for resolving conflicts.
   * @param conflict The DataConflict object containing local and remote versions.
   * @returns A promise that resolves with the ResolutionResult.
   */
  static async customResolution<T = any>(conflict: DataConflict<T>): Promise<ResolutionResult<T>> {
    console.warn('Custom conflict resolution strategy not implemented. Remote data is preferred.', conflict);
    return {
      success: true,
      message: 'Custom resolution not implemented, remote data preferred.',
      resolvedData: conflict.remoteData,
    };
  }

  /**
   * Chooses a resolution strategy based on the conflict type or predefined rules.
   * This method acts as a dispatcher to different resolution strategies.
   * @param conflict The DataConflict object.
   * @returns A promise that resolves with the ResolutionResult.
   */
  static async resolve<T extends Record<string, any> & { timestamp?: number }>(conflict: DataConflict<T>): Promise<ResolutionResult<T>> {
    // Example: if data has timestamp, use lastWriteWins, otherwise use mergeNonConflicting or custom.
    if (conflict.localData.timestamp !== undefined && conflict.remoteData.timestamp !== undefined) {
      // Type assertion to ensure timestamp is present before passing to lastWriteWins
      const localWithTimestamp = conflict.localData as T & { timestamp: number };
      const remoteWithTimestamp = conflict.remoteData as T & { timestamp: number };
      const resolved = ConflictResolutionStrategies.lastWriteWins(localWithTimestamp, remoteWithTimestamp);
      return { success: true, message: 'Conflict resolved using Last Write Wins.', resolvedData: resolved };
    } else {
      const resolved = ConflictResolutionStrategies.mergeNonConflicting(conflict.localData, conflict.remoteData);
      return { success: true, message: 'Conflict resolved using non-conflicting merge.', resolvedData: resolved };
    }
    // Alternatively, you could implement more complex logic here to choose strategies
    // For example, based on collection name, type of data, or user preferences.
  }
}