/**
 * Phase 5.3: Offline-First Support - Conflict Resolution Module
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Central export for all conflict resolution components
 * ✅ IDEA: Easy import and module management
 */

// Core conflict detection
export { ConflictDetector, type ConflictDetectorConfig } from './conflict-detector';

// Resolution strategies
export * from './strategies';

// Re-export interfaces for convenience
export type {
  IConflictDetector,
  IConflictResolver,
  IConflictStorage,
  IManualResolver
} from '../interfaces';

export type {
  ConflictType,
  ConflictMetadata,
  EnhancedConflictData,
  ConflictResolution,
  ConflictDetectionResult,
  ConflictStats,
  BatchConflictOperation,
  BatchConflictResult,
  IResolutionStrategy,
  ManualResolutionData
} from '../interfaces';