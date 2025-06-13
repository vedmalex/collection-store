/**
 * Conflict Resolution Module Exports
 * Provides configuration conflict detection and resolution capabilities
 */

// Main implementation
export { ConflictResolutionManager } from './ConflictResolutionManager';

// Interfaces and types
export type {
  IConflictResolutionManager,
  ConflictResolutionStrategy,
  ConflictType,
  ConflictSeverity,
  ConfigurationSource,
  ConfigurationConflict,
  ConflictResolutionRule,
  ResolutionContext,
  ConflictResolutionResult,
  BatchResolutionResult,
  ConflictResolutionStats,
  ConflictResolutionEvent,
  ConflictResolutionManagerConfig
} from './interfaces/IConflictResolutionManager';

import type {
  IConflictResolutionManager,
  ConfigurationConflict,
  ConflictResolutionResult,
  ConfigurationSource,
  ConflictResolutionRule,
  ConflictResolutionStrategy
} from './interfaces/IConflictResolutionManager';

// Type guards
export function isConflictResolutionManager(obj: any): obj is IConflictResolutionManager {
  return obj && typeof obj.initialize === 'function' && typeof obj.detectConflicts === 'function';
}

export function isConfigurationConflict(obj: any): obj is ConfigurationConflict {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.severity === 'string' &&
    typeof obj.path === 'string' &&
    Array.isArray(obj.sources) &&
    Array.isArray(obj.values);
}

export function isConflictResolutionResult(obj: any): obj is ConflictResolutionResult {
  return obj &&
    typeof obj.conflictId === 'string' &&
    typeof obj.strategy === 'string' &&
    typeof obj.success === 'boolean' &&
    typeof obj.executionTime === 'number';
}

// Utility functions
export function createConfigurationSource(
  id: string,
  name: string,
  priority: number = 100,
  type: 'default' | 'file' | 'database' | 'environment' | 'api' | 'user' = 'default'
): ConfigurationSource {
  return {
    id,
    name,
    priority,
    type,
    lastModified: new Date(),
    metadata: {
      createdAt: new Date(),
      version: '1.0.0'
    }
  };
}

export function createConflictResolutionRule(
  name: string,
  pattern: string | RegExp,
  strategy: ConflictResolutionStrategy,
  priority: number = 100
): Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    description: `Auto-generated rule for ${name}`,
    pattern,
    strategy,
    priority,
    enabled: true
  };
}