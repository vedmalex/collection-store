/**
 * Phase 5.3: Offline-First Support - Core Interfaces
 *
 * ✅ IDEA: Comprehensive offline-first support with conflict resolution
 * ✅ IDEA: IndexedDB-based local data caching system
 * ✅ IDEA: Multiple conflict resolution strategies
 * ✅ IDEA: Automatic sync management with network detection
 * ✅ IDEA: Storage optimization and cleanup
 *
 * Performance Requirements:
 * - Cache operations: <10ms
 * - Sync operations: <5s for 1000 operations
 * - Storage overhead: <50MB
 * - Memory overhead: <20MB
 */

export * from './types';
export * from './offline-manager.interface';
export * from './local-data-cache.interface';
export * from './conflict-resolver.interface';
export * from './sync-manager.interface';

// Day 3: Sync Management Interfaces
export { IOperationQueue } from './operation-queue.interface';
export { INetworkDetector } from './network-detector.interface';