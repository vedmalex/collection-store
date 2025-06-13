/**
 * Phase 5.3: Offline-First Support - Base Resolution Strategy
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Abstract base class for all resolution strategies
 * ✅ IDEA: Common functionality and performance monitoring
 * ✅ IDEA: Strategy pattern implementation
 */

import type {
  EnhancedConflictData,
  ConflictResolution,
  ConflictResolutionStrategy,
  IResolutionStrategy
} from '../../interfaces';

/**
 * Abstract base class for conflict resolution strategies
 */
export abstract class BaseResolutionStrategy implements IResolutionStrategy {
  public readonly name: ConflictResolutionStrategy;
  public readonly priority: number;
  public readonly description: string;

  protected performanceStats: {
    totalResolutions: number;
    totalTime: number;
    averageTime: number;
    successRate: number;
    failures: number;
  };

  constructor(
    name: ConflictResolutionStrategy,
    priority: number,
    description: string
  ) {
    this.name = name;
    this.priority = priority;
    this.description = description;

    this.performanceStats = {
      totalResolutions: 0,
      totalTime: 0,
      averageTime: 0,
      successRate: 1.0,
      failures: 0
    };
  }

  /**
   * Abstract method to resolve conflict - must be implemented by subclasses
   */
  abstract resolve(conflict: EnhancedConflictData): Promise<ConflictResolution>;

  /**
   * Check if this strategy can resolve the given conflict
   */
  canResolve(conflict: EnhancedConflictData): boolean {
    // Default implementation - can be overridden
    return true;
  }

  /**
   * Get performance statistics for this strategy
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats(): void {
    this.performanceStats = {
      totalResolutions: 0,
      totalTime: 0,
      averageTime: 0,
      successRate: 1.0,
      failures: 0
    };
  }

  /**
   * Protected method to execute resolution with performance tracking
   */
  protected async executeResolution(
    conflict: EnhancedConflictData,
    resolutionLogic: () => Promise<any>
  ): Promise<ConflictResolution> {
    const startTime = performance.now();

    try {
      const resolvedData = await resolutionLogic();
      const duration = performance.now() - startTime;

      this.updatePerformanceStats(duration, true);

      return {
        conflictId: conflict.id,
        strategy: this.name,
        resolvedData,
        timestamp: Date.now(),
        duration,
        success: true,
        metadata: {
          strategy: this.name,
          priority: this.priority,
          conflictType: conflict.conflictType,
          severity: conflict.metadata.severity
        }
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.updatePerformanceStats(duration, false);

      return {
        conflictId: conflict.id,
        strategy: this.name,
        resolvedData: null,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          strategy: this.name,
          priority: this.priority,
          conflictType: conflict.conflictType,
          severity: conflict.metadata.severity,
          error: error
        }
      };
    }
  }

  /**
   * Validate conflict data before resolution
   */
  protected validateConflict(conflict: EnhancedConflictData): void {
    if (!conflict) {
      throw new Error('Conflict data is required');
    }

    if (!conflict.id) {
      throw new Error('Conflict ID is required');
    }

    if (!conflict.collection) {
      throw new Error('Collection name is required');
    }

    if (!conflict.localData && !conflict.remoteData) {
      throw new Error('At least one data source (local or remote) is required');
    }
  }

  /**
   * Create a deep copy of data to avoid mutations
   */
  protected deepCopy<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (data instanceof Date) {
      return new Date(data.getTime()) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deepCopy(item)) as unknown as T;
    }

    const copy = {} as T;
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        copy[key] = this.deepCopy(data[key]);
      }
    }

    return copy;
  }

  /**
   * Merge two objects with conflict resolution
   */
  protected mergeObjects(local: any, remote: any, preferLocal: boolean = true): any {
    if (!local && !remote) return null;
    if (!local) return this.deepCopy(remote);
    if (!remote) return this.deepCopy(local);

    const result = this.deepCopy(preferLocal ? local : remote);
    const source = preferLocal ? remote : local;

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (!(key in result)) {
          // Add missing fields
          result[key] = this.deepCopy(source[key]);
        } else if (typeof result[key] === 'object' && typeof source[key] === 'object') {
          // Recursively merge objects
          result[key] = this.mergeObjects(result[key], source[key], preferLocal);
        }
        // Keep existing value for primitive conflicts
      }
    }

    return result;
  }

  /**
   * Extract timestamp from data
   */
  protected extractTimestamp(data: any): number {
    if (!data) return 0;

    const timestampFields = ['timestamp', 'updatedAt', 'modifiedAt', 'lastModified', '_timestamp'];

    for (const field of timestampFields) {
      if (data[field]) {
        const timestamp = typeof data[field] === 'number' ? data[field] : Date.parse(data[field]);
        if (!isNaN(timestamp)) return timestamp;
      }
    }

    return 0;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(duration: number, success: boolean): void {
    this.performanceStats.totalResolutions++;
    this.performanceStats.totalTime += duration;
    this.performanceStats.averageTime = this.performanceStats.totalTime / this.performanceStats.totalResolutions;

    if (!success) {
      this.performanceStats.failures++;
    }

    this.performanceStats.successRate =
      (this.performanceStats.totalResolutions - this.performanceStats.failures) /
      this.performanceStats.totalResolutions;
  }
}