/**
 * Phase 5.3: Offline-First Support - Storage Optimizer Implementation
 */

import {
  CachedDataEntry,
  StorageOptimizationStrategy,
  StorageStats
} from '../interfaces';

/**
 * Storage optimizer for managing cache storage efficiently
 *
 * ✅ IDEA: Multiple optimization strategies (LRU, size-based, time-based, priority-based)
 * ✅ IDEA: Automatic cleanup and storage management
 * ✅ IDEA: Performance monitoring and statistics
 */
export class StorageOptimizer {
  private strategy: StorageOptimizationStrategy;
  private maxSize: number;
  private targetUtilization: number;

  constructor(
    strategy: StorageOptimizationStrategy = 'lru',
    maxSize: number = 50 * 1024 * 1024, // 50MB
    targetUtilization: number = 0.8 // 80%
  ) {
    this.strategy = strategy;
    this.maxSize = maxSize;
    this.targetUtilization = targetUtilization;
  }

  /**
   * Optimize storage by removing entries based on strategy
   */
  async optimize(entries: CachedDataEntry[], currentStats: StorageStats): Promise<CachedDataEntry[]> {
    const startTime = performance.now();

    try {
      const targetSize = this.maxSize * this.targetUtilization;

      if (currentStats.usedSize <= targetSize) {
        return []; // No optimization needed
      }

      const excessSize = currentStats.usedSize - targetSize;
      const entriesToRemove = this.selectEntriesForRemoval(entries, excessSize);

      const duration = performance.now() - startTime;
      console.log(`Storage optimization completed in ${duration.toFixed(2)}ms, selected ${entriesToRemove.length} entries for removal`);

      return entriesToRemove;
    } catch (error) {
      console.error('Storage optimization failed:', error);
      throw error;
    }
  }

  /**
   * Select entries for removal based on optimization strategy
   */
  private selectEntriesForRemoval(entries: CachedDataEntry[], targetRemovalSize: number): CachedDataEntry[] {
    let sortedEntries: CachedDataEntry[];

    switch (this.strategy) {
      case 'lru':
        sortedEntries = this.sortByLRU(entries);
        break;
      case 'size-based':
        sortedEntries = this.sortBySize(entries);
        break;
      case 'time-based':
        sortedEntries = this.sortByAge(entries);
        break;
      case 'priority-based':
        sortedEntries = this.sortByPriority(entries);
        break;
      default:
        sortedEntries = this.sortByLRU(entries);
    }

    const entriesToRemove: CachedDataEntry[] = [];
    let removedSize = 0;

    for (const entry of sortedEntries) {
      if (removedSize >= targetRemovalSize) {
        break;
      }

      entriesToRemove.push(entry);
      removedSize += entry.size;
    }

    return entriesToRemove;
  }

  /**
   * Sort entries by Least Recently Used (LRU)
   */
  private sortByLRU(entries: CachedDataEntry[]): CachedDataEntry[] {
    return [...entries].sort((a, b) => a.lastAccessed - b.lastAccessed);
  }

  /**
   * Sort entries by size (largest first)
   */
  private sortBySize(entries: CachedDataEntry[]): CachedDataEntry[] {
    return [...entries].sort((a, b) => b.size - a.size);
  }

  /**
   * Sort entries by age (oldest first)
   */
  private sortByAge(entries: CachedDataEntry[]): CachedDataEntry[] {
    return [...entries].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Sort entries by priority (lowest priority first)
   */
  private sortByPriority(entries: CachedDataEntry[]): CachedDataEntry[] {
    return [...entries].sort((a, b) => {
      const aPriority = this.calculatePriority(a);
      const bPriority = this.calculatePriority(b);
      return aPriority - bPriority;
    });
  }

  /**
   * Calculate priority score for an entry
   */
  private calculatePriority(entry: CachedDataEntry): number {
    const now = Date.now();
    const age = now - entry.timestamp;
    const timeSinceAccess = now - entry.lastAccessed;
    const sizeWeight = entry.size / (1024 * 1024); // Size in MB

    // Lower score = higher priority (less likely to be removed)
    // Factors: recent access, small size, newer entries
    return (timeSinceAccess / 1000) + (age / 10000) + (sizeWeight * 10);
  }

  /**
   * Get optimization strategy
   */
  getStrategy(): StorageOptimizationStrategy {
    return this.strategy;
  }

  /**
   * Set optimization strategy
   */
  setStrategy(strategy: StorageOptimizationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get max size
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Set max size
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
  }

  /**
   * Get target utilization
   */
  getTargetUtilization(): number {
    return this.targetUtilization;
  }

  /**
   * Set target utilization
   */
  setTargetUtilization(utilization: number): void {
    if (utilization < 0 || utilization > 1) {
      throw new Error('Target utilization must be between 0 and 1');
    }
    this.targetUtilization = utilization;
  }

  /**
   * Check if optimization is needed
   */
  isOptimizationNeeded(stats: StorageStats): boolean {
    const targetSize = this.maxSize * this.targetUtilization;
    return stats.usedSize > targetSize;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(entries: CachedDataEntry[]): {
    totalEntries: number;
    totalSize: number;
    averageSize: number;
    oldestEntry: number;
    newestEntry: number;
    leastRecentlyUsed: number;
    mostRecentlyUsed: number;
  } {
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        totalSize: 0,
        averageSize: 0,
        oldestEntry: 0,
        newestEntry: 0,
        leastRecentlyUsed: 0,
        mostRecentlyUsed: 0
      };
    }

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = entries.map(e => e.timestamp);
    const accessTimes = entries.map(e => e.lastAccessed);

    return {
      totalEntries: entries.length,
      totalSize,
      averageSize: totalSize / entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      leastRecentlyUsed: Math.min(...accessTimes),
      mostRecentlyUsed: Math.max(...accessTimes)
    };
  }
}