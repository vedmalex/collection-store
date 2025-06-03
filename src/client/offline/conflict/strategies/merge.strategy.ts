/**
 * Phase 5.3: Offline-First Support - Merge Strategy
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: Intelligent merging of local and remote data
 * ✅ IDEA: Field-level conflict resolution
 * ✅ IDEA: Configurable merge rules and priorities
 */

import type { EnhancedConflictData, ConflictResolution } from '../../interfaces';
import { BaseResolutionStrategy } from './base-strategy';

/**
 * Merge field resolution rule
 */
export interface MergeRule {
  field: string;
  strategy: 'local' | 'remote' | 'newest' | 'largest' | 'combine' | 'custom';
  customResolver?: (localValue: any, remoteValue: any) => any;
}

/**
 * Merge strategy configuration
 */
export interface MergeConfig {
  defaultRule: 'local' | 'remote' | 'newest';
  fieldRules: MergeRule[];
  arrayMergeStrategy: 'union' | 'local' | 'remote' | 'newest';
  preserveMetadata: boolean;
  conflictMarkers: boolean;
}

/**
 * Merge resolution strategy
 * Intelligently merges local and remote data based on configurable rules
 */
export class MergeStrategy extends BaseResolutionStrategy {
  private config: MergeConfig;

  constructor(config?: Partial<MergeConfig>) {
    super(
      'merge',
      4, // High priority for intelligent resolution
      'Intelligently merges local and remote data using configurable rules'
    );

    this.config = {
      defaultRule: 'newest',
      fieldRules: [],
      arrayMergeStrategy: 'union',
      preserveMetadata: true,
      conflictMarkers: false,
      ...config
    };
  }

  /**
   * Resolve conflict by merging data intelligently
   */
  async resolve(conflict: EnhancedConflictData): Promise<ConflictResolution> {
    return this.executeResolution(conflict, async () => {
      this.validateConflict(conflict);

      if (!conflict.localData && !conflict.remoteData) {
        throw new Error('At least one data source is required for merge strategy');
      }

      if (!conflict.localData) {
        return this.deepCopy(conflict.remoteData);
      }

      if (!conflict.remoteData) {
        return this.deepCopy(conflict.localData);
      }

      // Perform intelligent merge
      const merged = this.performMerge(conflict.localData, conflict.remoteData, conflict);

      // Add resolution metadata
      merged._conflictResolution = {
        strategy: 'merge',
        timestamp: Date.now(),
        mergeConfig: this.config,
        conflictedFields: conflict.metadata?.conflictedFields || [],
        originalData: {
          local: this.deepCopy(conflict.localData),
          remote: this.deepCopy(conflict.remoteData)
        }
      };

      return merged;
    });
  }

  /**
   * Check if this strategy can resolve the conflict
   */
  canResolve(conflict: EnhancedConflictData): boolean {
    // Can resolve any conflict where at least one data source exists
    return !!(conflict && (conflict.localData || conflict.remoteData));
  }

  /**
   * Update merge configuration
   */
  updateConfig(config: Partial<MergeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add field-specific merge rule
   */
  addFieldRule(rule: MergeRule): void {
    // Remove existing rule for the same field
    this.config.fieldRules = this.config.fieldRules.filter(r => r.field !== rule.field);
    this.config.fieldRules.push(rule);
  }

  /**
   * Remove field-specific merge rule
   */
  removeFieldRule(field: string): void {
    this.config.fieldRules = this.config.fieldRules.filter(r => r.field !== field);
  }

  /**
   * Get current configuration
   */
  getConfig(): MergeConfig {
    return { ...this.config };
  }

  // ===== PRIVATE METHODS =====

  /**
   * Perform the actual merge operation
   */
  private performMerge(local: any, remote: any, conflict: EnhancedConflictData): any {
    if (typeof local !== 'object' || typeof remote !== 'object') {
      return this.resolveScalarConflict(local, remote, '', conflict);
    }

    const result: any = {};
    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);

    for (const key of allKeys) {
      const localValue = local[key];
      const remoteValue = remote[key];

      if (localValue === undefined) {
        result[key] = this.deepCopy(remoteValue);
      } else if (remoteValue === undefined) {
        result[key] = this.deepCopy(localValue);
      } else if (localValue === remoteValue) {
        result[key] = this.deepCopy(localValue);
      } else {
        result[key] = this.resolveFieldConflict(key, localValue, remoteValue, conflict);
      }
    }

    return result;
  }

  /**
   * Resolve conflict for a specific field
   */
  private resolveFieldConflict(
    field: string,
    localValue: any,
    remoteValue: any,
    conflict: EnhancedConflictData
  ): any {
    // Check for field-specific rule
    const fieldRule = this.config.fieldRules.find(rule =>
      rule.field === field || this.matchesFieldPattern(field, rule.field)
    );

    if (fieldRule) {
      return this.applyFieldRule(fieldRule, localValue, remoteValue, field, conflict);
    }

    // Handle arrays specially
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return this.mergeArrays(localValue, remoteValue);
    }

    // Handle objects recursively
    if (typeof localValue === 'object' && typeof remoteValue === 'object' &&
        localValue !== null && remoteValue !== null) {
      return this.performMerge(localValue, remoteValue, conflict);
    }

    // Apply default rule for scalar conflicts
    return this.resolveScalarConflict(localValue, remoteValue, field, conflict);
  }

  /**
   * Apply a specific field rule
   */
  private applyFieldRule(
    rule: MergeRule,
    localValue: any,
    remoteValue: any,
    field: string,
    conflict: EnhancedConflictData
  ): any {
    switch (rule.strategy) {
      case 'local':
        return this.deepCopy(localValue);

      case 'remote':
        return this.deepCopy(remoteValue);

      case 'newest':
        return this.chooseNewest(localValue, remoteValue, conflict);

      case 'largest':
        return this.chooseLargest(localValue, remoteValue);

      case 'combine':
        return this.combineValues(localValue, remoteValue);

      case 'custom':
        if (rule.customResolver) {
          return rule.customResolver(localValue, remoteValue);
        }
        return this.resolveScalarConflict(localValue, remoteValue, field, conflict);

      default:
        return this.resolveScalarConflict(localValue, remoteValue, field, conflict);
    }
  }

  /**
   * Resolve scalar value conflicts using default rule
   */
  private resolveScalarConflict(
    localValue: any,
    remoteValue: any,
    field: string,
    conflict: EnhancedConflictData
  ): any {
    switch (this.config.defaultRule) {
      case 'local':
        return this.deepCopy(localValue);

      case 'remote':
        return this.deepCopy(remoteValue);

      case 'newest':
        return this.chooseNewest(localValue, remoteValue, conflict);

      default:
        return this.deepCopy(localValue); // Fallback to local
    }
  }

  /**
   * Choose value based on timestamp
   */
  private chooseNewest(localValue: any, remoteValue: any, conflict: EnhancedConflictData): any {
    const localTimestamp = this.extractTimestamp(conflict.localData);
    const remoteTimestamp = this.extractTimestamp(conflict.remoteData);

    if (!localTimestamp && !remoteTimestamp) {
      return this.deepCopy(localValue); // Fallback to local
    }

    if (!localTimestamp) return this.deepCopy(remoteValue);
    if (!remoteTimestamp) return this.deepCopy(localValue);

    return localTimestamp >= remoteTimestamp ?
      this.deepCopy(localValue) :
      this.deepCopy(remoteValue);
  }

  /**
   * Choose larger value (for numbers, strings, arrays)
   */
  private chooseLargest(localValue: any, remoteValue: any): any {
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return Math.max(localValue, remoteValue);
    }

    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      return localValue.length >= remoteValue.length ? localValue : remoteValue;
    }

    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return localValue.length >= remoteValue.length ?
        this.deepCopy(localValue) :
        this.deepCopy(remoteValue);
    }

    return this.deepCopy(localValue); // Fallback
  }

  /**
   * Combine values when possible
   */
  private combineValues(localValue: any, remoteValue: any): any {
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return localValue + remoteValue;
    }

    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      return `${localValue} ${remoteValue}`;
    }

    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return this.mergeArrays(localValue, remoteValue);
    }

    return this.deepCopy(localValue); // Fallback
  }

  /**
   * Merge arrays based on strategy
   */
  private mergeArrays(localArray: any[], remoteArray: any[]): any[] {
    switch (this.config.arrayMergeStrategy) {
      case 'union':
        // Create union of arrays, removing duplicates
        const union = [...localArray];
        for (const item of remoteArray) {
          if (!this.arrayContains(union, item)) {
            union.push(item);
          }
        }
        return union;

      case 'local':
        return this.deepCopy(localArray);

      case 'remote':
        return this.deepCopy(remoteArray);

      case 'newest':
        // For arrays, "newest" means the longer one
        return localArray.length >= remoteArray.length ?
          this.deepCopy(localArray) :
          this.deepCopy(remoteArray);

      default:
        return this.deepCopy(localArray);
    }
  }

  /**
   * Check if array contains item (deep comparison)
   */
  private arrayContains(array: any[], item: any): boolean {
    return array.some(existing => this.deepEquals(existing, item));
  }

  /**
   * Deep equality check
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => this.deepEquals(item, b[index]));
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => this.deepEquals(a[key], b[key]));
    }

    return false;
  }

  /**
   * Check if field matches pattern (supports wildcards)
   */
  private matchesFieldPattern(field: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(field);
    }
    return field === pattern;
  }
}