/**
 * Phase 5.3: Offline-First Support - Conflict Resolver Interface
 * Day 2: Enhanced Conflict Resolution System
 *
 * ✅ IDEA: Enhanced conflict detection with multiple algorithms
 * ✅ IDEA: 6+ resolution strategies with priority system
 * ✅ IDEA: Conflict storage with persistence and indexing
 * ✅ IDEA: Manual resolution UI with preview capabilities
 * ✅ IDEA: Batch operations for performance
 */

import type {
  ConflictData,
  EnhancedConflictData,
  ConflictResolutionStrategy,
  ConflictResolution,
  ConflictDetectionResult,
  ConflictStats,
  BatchConflictOperation,
  BatchConflictResult,
  IResolutionStrategy,
  ConflictType
} from './types';

/**
 * Interface for conflict detection
 */
export interface IConflictDetector {
  /**
   * Detect conflicts between local and remote data
   */
  detectConflict(localData: any, remoteData: any, collection: string, documentId: string): Promise<ConflictDetectionResult>;

  /**
   * Batch conflict detection
   */
  detectConflicts(operations: Array<{
    localData: any;
    remoteData: any;
    collection: string;
    documentId: string;
  }>): Promise<ConflictDetectionResult[]>;

  /**
   * Check if data has conflicts
   */
  hasConflict(localData: any, remoteData: any): boolean;

  /**
   * Get conflict severity
   */
  getConflictSeverity(localData: any, remoteData: any): 'low' | 'medium' | 'high';

  /**
   * Calculate conflict hash for comparison
   */
  calculateHash(data: any): string;

  /**
   * Get conflicted fields
   */
  getConflictedFields(localData: any, remoteData: any): string[];

  /**
   * Determine conflict type
   */
  getConflictType(localData: any, remoteData: any): ConflictType;

  /**
   * Check if conflict is auto-resolvable
   */
  isAutoResolvable(localData: any, remoteData: any): boolean;
}

/**
 * Interface for conflict storage
 */
export interface IConflictStorage {
  /**
   * Store a conflict
   */
  storeConflict(conflict: EnhancedConflictData): Promise<void>;

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): Promise<EnhancedConflictData | null>;

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): Promise<EnhancedConflictData[]>;

  /**
   * Get conflicts by collection
   */
  getConflictsByCollection(collection: string): Promise<EnhancedConflictData[]>;

  /**
   * Mark conflict as resolved
   */
  markResolved(conflictId: string, resolution: ConflictResolution): Promise<void>;

  /**
   * Remove resolved conflicts
   */
  cleanupResolvedConflicts(olderThan?: number): Promise<number>;

  /**
   * Get conflict statistics
   */
  getStats(): Promise<ConflictStats>;

  /**
   * Export conflicts for backup
   */
  exportConflicts(): Promise<Record<string, EnhancedConflictData[]>>;

  /**
   * Import conflicts from backup
   */
  importConflicts(data: Record<string, EnhancedConflictData[]>): Promise<void>;

  /**
   * Initialize storage
   */
  initialize(): Promise<void>;

  /**
   * Shutdown storage
   */
  shutdown(): Promise<void>;
}

/**
 * Enhanced interface for conflict resolution
 */
export interface IConflictResolver {
  /**
   * Resolve a conflict using specified strategy
   */
  resolveConflict(conflict: EnhancedConflictData, strategy?: ConflictResolutionStrategy): Promise<ConflictResolution>;

  /**
   * Batch resolve conflicts
   */
  resolveConflicts(operation: BatchConflictOperation): Promise<BatchConflictResult>;

  /**
   * Detect conflicts between local and remote data
   */
  detectConflict(localData: any, remoteData: any, collection: string, documentId: string): Promise<EnhancedConflictData | null>;

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): Promise<EnhancedConflictData[]>;

  /**
   * Set default resolution strategy
   */
  setDefaultStrategy(strategy: ConflictResolutionStrategy): void;

  /**
   * Get default resolution strategy
   */
  getDefaultStrategy(): ConflictResolutionStrategy;

  /**
   * Register custom resolution strategy
   */
  registerStrategy(strategy: IResolutionStrategy): void;

  /**
   * Unregister resolution strategy
   */
  unregisterStrategy(name: ConflictResolutionStrategy): void;

  /**
   * Get available strategies
   */
  getAvailableStrategies(): ConflictResolutionStrategy[];

  /**
   * Get strategy by name
   */
  getStrategy(name: ConflictResolutionStrategy): IResolutionStrategy | null;

  /**
   * Get conflict statistics
   */
  getStats(): Promise<ConflictStats>;

  /**
   * Clear all conflicts
   */
  clearConflicts(): Promise<void>;

  /**
   * Set conflict detector
   */
  setDetector(detector: IConflictDetector): void;

  /**
   * Set conflict storage
   */
  setStorage(storage: IConflictStorage): void;

  /**
   * Initialize conflict resolver
   */
  initialize(): Promise<void>;

  /**
   * Shutdown conflict resolver
   */
  shutdown(): Promise<void>;

  /**
   * Process conflict queue
   */
  processQueue(): Promise<void>;

  /**
   * Add event listener for conflict events
   */
  addEventListener(event: 'conflict-detected' | 'conflict-resolved' | 'resolution-failed', handler: (data: any) => void): void;

  /**
   * Remove event listener
   */
  removeEventListener(event: 'conflict-detected' | 'conflict-resolved' | 'resolution-failed', handler: (data: any) => void): void;
}

/**
 * Interface for manual conflict resolution
 */
export interface IManualResolver {
  /**
   * Show resolution UI for a conflict
   */
  showResolutionUI(conflict: EnhancedConflictData): Promise<ConflictResolution>;

  /**
   * Get preview of resolution strategies
   */
  getResolutionPreview(conflict: EnhancedConflictData, strategies: ConflictResolutionStrategy[]): Promise<Record<ConflictResolutionStrategy, any>>;

  /**
   * Batch manual resolution
   */
  batchResolve(conflicts: EnhancedConflictData[]): Promise<ConflictResolution[]>;

  /**
   * Get conflicts requiring manual intervention
   */
  getManualConflicts(): Promise<EnhancedConflictData[]>;

  /**
   * Set user preference for conflict types
   */
  setUserPreference(conflictType: string, strategy: ConflictResolutionStrategy): void;

  /**
   * Get user preferences
   */
  getUserPreferences(): Record<string, ConflictResolutionStrategy>;

  /**
   * Initialize manual resolver
   */
  initialize(): Promise<void>;

  /**
   * Shutdown manual resolver
   */
  shutdown(): Promise<void>;
}

/**
 * Legacy interface for backward compatibility
 */
export interface IConflictResolutionStrategy {
  /**
   * Strategy name
   */
  name: string;

  /**
   * Resolve conflict between local and server data
   */
  resolve(localData: any, serverData: any, metadata?: Record<string, any>): Promise<any>;

  /**
   * Check if this strategy can handle the conflict
   */
  canHandle(localData: any, serverData: any, metadata?: Record<string, any>): boolean;
}