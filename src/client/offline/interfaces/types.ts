/**
 * Phase 5.3: Offline-First Support - Core Types
 */

/**
 * Offline operation types
 */
export type OfflineOperationType = 'create' | 'update' | 'delete' | 'query';

/**
 * Offline operation status
 */
export type OfflineOperationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

/**
 * Network connection status
 */
export type NetworkStatus = 'online' | 'offline' | 'slow' | 'unknown';

/**
 * Conflict resolution strategy types
 */
export type ConflictResolutionStrategy = 'client-wins' | 'server-wins' | 'manual' | 'timestamp-based' | 'custom' | 'merge';

/**
 * Storage optimization strategy
 */
export type StorageOptimizationStrategy = 'lru' | 'size-based' | 'time-based' | 'priority-based';

/**
 * Sync priority levels
 */
export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Offline operation data structure
 */
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  collection: string;
  data: any;
  timestamp: number;
  status: OfflineOperationStatus;
  priority: SyncPriority;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

/**
 * Cached data entry structure
 */
export interface CachedDataEntry {
  id: string;
  collection: string;
  data: any;
  timestamp: number;
  lastAccessed: number;
  size: number;
  version: number;
  metadata?: Record<string, any>;
}

/**
 * Conflict data structure
 */
export interface ConflictData {
  id: string;
  collection: string;
  localData: any;
  serverData: any;
  timestamp: number;
  strategy: ConflictResolutionStrategy;
  resolved: boolean;
  resolution?: any;
  metadata?: Record<string, any>;
}

/**
 * Network status information (legacy - use Day 3 NetworkInfo)
 * @deprecated Use the Day 3 NetworkInfo interface instead
 */
export interface LegacyNetworkInfo {
  status: NetworkStatus;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  timestamp: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  entryCount: number;
  collections: Record<string, {
    size: number;
    count: number;
  }>;
}

/**
 * Sync statistics (legacy - use Day 3 SyncStats)
 * @deprecated Use the Day 3 SyncStats interface instead
 */
export interface LegacySyncStats {
  pendingOperations: number;
  syncedOperations: number;
  failedOperations: number;
  conflictedOperations: number;
  lastSyncTime: number;
  averageSyncTime: number;
  totalSyncTime: number;
}

/**
 * Offline configuration
 */
export interface OfflineConfig {
  enabled: boolean;
  maxStorageSize: number;
  maxCacheAge: number;
  syncInterval: number;
  retryInterval: number;
  maxRetries: number;
  conflictResolution: ConflictResolutionStrategy;
  storageOptimization: StorageOptimizationStrategy;
  networkDetection: boolean;
  autoSync: boolean;
  batchSize: number;
  compressionEnabled: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  maxAge: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  optimizationStrategy: StorageOptimizationStrategy;
  cleanupInterval: number;
}

/**
 * Sync configuration (legacy - use Day 3 SyncConfig)
 * @deprecated Use the Day 3 SyncConfig interface instead
 */
export interface LegacySyncConfig {
  enabled: boolean;
  interval: number;
  batchSize: number;
  retryInterval: number;
  maxRetries: number;
  priority: SyncPriority;
  networkAware: boolean;
}

/**
 * Event types for offline operations
 */
export type OfflineEventType =
  | 'offline-mode-changed'
  | 'network-status-changed'
  | 'sync-started'
  | 'sync-completed'
  | 'sync-failed'
  | 'conflict-detected'
  | 'conflict-resolved'
  | 'storage-optimized'
  | 'cache-cleared';

/**
 * Offline event data
 */
export interface OfflineEvent {
  type: OfflineEventType;
  timestamp: number;
  data?: any;
  metadata?: Record<string, any>;
}

// ===== DAY 2: CONFLICT RESOLUTION TYPES =====

/**
 * Types of conflicts that can occur
 */
export type ConflictType =
  | 'timestamp'
  | 'data'
  | 'delete'
  | 'schema'
  | 'field';

/**
 * Additional metadata for conflicts
 */
export interface ConflictMetadata {
  localTimestamp: number;
  remoteTimestamp: number;
  localHash?: string;
  remoteHash?: string;
  conflictedFields?: string[];
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
  detectionTime: number;
  detectionDuration: number;
}

/**
 * Enhanced conflict data structure for Day 2
 */
export interface EnhancedConflictData extends ConflictData {
  conflictType: ConflictType;
  metadata: ConflictMetadata;
  documentId: string;
  remoteData: any; // Rename serverData to remoteData for consistency
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType?: ConflictType;
  conflictedFields?: string[];
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
  confidence: number; // 0-1 confidence in detection
  metadata?: ConflictMetadata;
}

/**
 * Resolution strategy interface
 */
export interface IResolutionStrategy {
  name: ConflictResolutionStrategy;
  resolve(conflict: EnhancedConflictData): Promise<ConflictResolution>;
  canResolve(conflict: EnhancedConflictData): boolean;
  priority: number;
  description: string;
}

/**
 * Conflict statistics
 */
export interface ConflictStats {
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  failedResolutions: number;
  averageResolutionTime: number;
  averageDetectionTime: number;
  strategiesUsed: Record<ConflictResolutionStrategy, number>;
  conflictTypes: Record<ConflictType, number>;
  severityDistribution: Record<'low' | 'medium' | 'high', number>;
}

/**
 * Batch conflict operation
 */
export interface BatchConflictOperation {
  operation: 'detect' | 'resolve';
  conflicts: EnhancedConflictData[];
  strategy?: ConflictResolutionStrategy;
  options?: Record<string, any>;
}

/**
 * Batch conflict result
 */
export interface BatchConflictResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  duration: number;
  results: ConflictResolution[];
  errors: Array<{ conflictId: string; error: string }>;
}

/**
 * Manual resolution UI data
 */
export interface ManualResolutionData {
  conflict: EnhancedConflictData;
  availableStrategies: ConflictResolutionStrategy[];
  previewData?: Record<ConflictResolutionStrategy, any>;
  userChoice?: {
    strategy: ConflictResolutionStrategy;
    customData?: any;
    timestamp: number;
  };
}

// ==========================================
// Day 3: Sync Management Types
// ==========================================

/**
 * Types of sync operations that can be queued
 */
export type SyncOperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'batch'
  | 'custom';

/**
 * Status of sync operations
 */
export type SyncOperationStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

/**
 * Sync direction for operations
 */
export type SyncDirection =
  | 'upload'    // Local to remote
  | 'download'  // Remote to local
  | 'bidirectional'; // Both directions

/**
 * Network connection quality
 */
export type NetworkQuality =
  | 'excellent'  // >10Mbps, <50ms latency
  | 'good'       // 1-10Mbps, 50-200ms latency
  | 'poor'       // <1Mbps, >200ms latency
  | 'offline';   // No connection

/**
 * Sync strategy based on network conditions
 */
export type SyncStrategy =
  | 'immediate'     // Sync immediately
  | 'batched'       // Batch operations
  | 'scheduled'     // Sync at intervals
  | 'manual'        // User-triggered only
  | 'adaptive';     // Adapt to network conditions

/**
 * Operation retry strategy
 */
export type RetryStrategy =
  | 'exponential'   // Exponential backoff
  | 'linear'        // Linear intervals
  | 'fixed'         // Fixed intervals
  | 'none';         // No retries

/**
 * Queued sync operation
 */
export interface QueuedOperation {
  id: string;
  type: SyncOperationType;
  collection: string;
  operation: OfflineOperation;
  status: SyncOperationStatus;
  priority: number; // 1-10, higher = more important
  retryCount: number;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  createdAt: number;
  scheduledAt?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Batch of operations for efficient sync
 */
export interface OperationBatch {
  id: string;
  operations: QueuedOperation[];
  collection: string;
  totalSize: number;
  estimatedDuration: number;
  createdAt: number;
  status: SyncOperationStatus;
}

/**
 * Network information and quality metrics
 */
export interface NetworkInfo {
  isOnline: boolean;
  quality: NetworkQuality;
  bandwidth?: number; // Mbps
  latency?: number;   // ms
  lastChecked: number;
  connectionType?: string; // wifi, cellular, ethernet
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  operationId: string;
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  currentOperation?: string;
  estimatedTimeRemaining?: number;
  bytesTransferred?: number;
  totalBytes?: number;
  startTime: number;
}

/**
 * Sync statistics and metrics
 */
export interface SyncStats {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  totalSyncTime: number;
  lastSyncTime: number;
  successRate: number;
  networkEfficiency: number;
  conflictsResolved: number;
  dataTransferred: number;
}

/**
 * Sync configuration options
 */
export interface SyncConfig {
  enabled: boolean;
  strategy: SyncStrategy;
  batchSize: number;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  syncInterval: number; // ms
  maxQueueSize: number;
  priorityThreshold: number;
  networkQualityThreshold: NetworkQuality;
  autoResolveConflicts: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backgroundSync: boolean;
  adaptiveStrategy: boolean;
}

/**
 * Sync event types
 */
export type SyncEventType =
  | 'sync-started'
  | 'sync-progress'
  | 'sync-completed'
  | 'sync-failed'
  | 'sync-cancelled'
  | 'operation-queued'
  | 'operation-started'
  | 'operation-completed'
  | 'operation-failed'
  | 'operation-retrying'
  | 'batch-created'
  | 'batch-completed'
  | 'network-changed'
  | 'queue-full'
  | 'conflict-detected';

/**
 * Sync event data
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  data: {
    operationId?: string;
    batchId?: string;
    progress?: SyncProgress;
    error?: string;
    networkInfo?: NetworkInfo;
    stats?: SyncStats;
    [key: string]: any;
  };
}

/**
 * Network detection configuration
 */
export interface NetworkDetectionConfig {
  enabled: boolean;
  checkInterval: number; // ms
  timeoutDuration: number; // ms
  testUrls: string[];
  qualityTestEnabled: boolean;
  bandwidthTestEnabled: boolean;
  latencyTestEnabled: boolean;
}

/**
 * Operation queue configuration
 */
export interface QueueConfig {
  maxSize: number;
  persistToDisk: boolean;
  priorityEnabled: boolean;
  batchingEnabled: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionPeriod: number; // ms
  cleanupInterval: number; // ms
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  syncConfig: SyncConfig;
  queueConfig: QueueConfig;
  networkConfig: NetworkDetectionConfig;
  performanceTargets: {
    maxSyncTime: number;        // ms
    maxOperationTime: number;   // ms
    maxQueueProcessingTime: number; // ms
    targetThroughput: number;   // operations/second
  };
}