/**
 * Phase 5.3: Offline-First Support - Conflict Detector
 * Day 2: Conflict Resolution System
 *
 * ✅ IDEA: High-performance conflict detection with multiple algorithms
 * ✅ IDEA: Timestamp, hash, and field-level conflict detection
 * ✅ IDEA: Batch operations for performance
 * ✅ IDEA: Configurable severity assessment
 */

import { createHash } from 'crypto';
import type {
  ConflictDetectionResult,
  ConflictType,
  ConflictMetadata,
  IConflictDetector
} from '../interfaces';

/**
 * Configuration for conflict detection
 */
export interface ConflictDetectorConfig {
  timestampTolerance: number; // ms tolerance for timestamp conflicts
  hashAlgorithm: 'md5' | 'sha1' | 'sha256';
  fieldComparisonDepth: number; // max depth for field comparison
  autoResolvableThreshold: number; // 0-1 threshold for auto-resolvable conflicts
  performanceTarget: number; // target detection time in ms
}

/**
 * High-performance conflict detector
 */
export class ConflictDetector implements IConflictDetector {
  private config: ConflictDetectorConfig;
  private performanceStats: {
    totalDetections: number;
    totalTime: number;
    averageTime: number;
    maxTime: number;
    minTime: number;
  };

  constructor(config?: Partial<ConflictDetectorConfig>) {
    this.config = {
      timestampTolerance: 1000, // 1 second
      hashAlgorithm: 'md5',
      fieldComparisonDepth: 5,
      autoResolvableThreshold: 0.7,
      performanceTarget: 5, // 5ms target
      ...config
    };

    this.performanceStats = {
      totalDetections: 0,
      totalTime: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Infinity
    };
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflict(
    localData: any,
    remoteData: any,
    collection: string,
    documentId: string
  ): Promise<ConflictDetectionResult> {
    const startTime = performance.now();

    try {
      // Quick null/undefined checks
      if (!localData && !remoteData) {
        return this.createResult(false, 'low', true);
      }

      if (!localData || !remoteData) {
        return this.createResult(true, 'high', false, 'delete');
      }

      // Timestamp-based detection
      const timestampConflict = this.detectTimestampConflict(localData, remoteData);

      // Hash-based detection for quick comparison
      const hashConflict = this.detectHashConflict(localData, remoteData);

      // Field-level detection for detailed analysis
      const fieldConflict = this.detectFieldConflicts(localData, remoteData);

      // Determine overall conflict status
      const hasConflict = timestampConflict || hashConflict || fieldConflict.hasConflict;

      if (!hasConflict) {
        return this.createResult(false, 'low', true);
      }

      // Determine conflict type and severity
      const conflictType = this.determineConflictType(localData, remoteData, fieldConflict);
      const severity = this.calculateSeverity(localData, remoteData, fieldConflict);
      const autoResolvable = this.checkAutoResolvable(localData, remoteData, severity, fieldConflict);

      // Create metadata
      const metadata: ConflictMetadata = {
        localTimestamp: this.extractTimestamp(localData),
        remoteTimestamp: this.extractTimestamp(remoteData),
        localHash: this.calculateHash(localData),
        remoteHash: this.calculateHash(remoteData),
        conflictedFields: fieldConflict.conflictedFields,
        severity,
        autoResolvable,
        detectionTime: Date.now(),
        detectionDuration: performance.now() - startTime
      };

      return {
        hasConflict: true,
        conflictType,
        conflictedFields: fieldConflict.conflictedFields,
        severity,
        autoResolvable,
        confidence: this.calculateConfidence(fieldConflict, timestampConflict, hashConflict),
        metadata
      };

    } finally {
      this.updatePerformanceStats(performance.now() - startTime);
    }
  }

  /**
   * Batch conflict detection for performance
   */
  async detectConflicts(operations: Array<{
    localData: any;
    remoteData: any;
    collection: string;
    documentId: string;
  }>): Promise<ConflictDetectionResult[]> {
    const startTime = performance.now();
    const results: ConflictDetectionResult[] = [];

    // Process in batches for memory efficiency
    const batchSize = 100;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchPromises = batch.map(op =>
        this.detectConflict(op.localData, op.remoteData, op.collection, op.documentId)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const duration = performance.now() - startTime;
    console.log(`✅ Batch conflict detection: ${operations.length} operations in ${duration.toFixed(2)}ms`);

    return results;
  }

  /**
   * Quick conflict check without detailed analysis
   */
  hasConflict(localData: any, remoteData: any): boolean {
    if (!localData || !remoteData) return true;

    // Quick hash comparison
    const localHash = this.calculateHash(localData);
    const remoteHash = this.calculateHash(remoteData);

    return localHash !== remoteHash;
  }

  /**
   * Get conflict severity assessment
   */
  getConflictSeverity(localData: any, remoteData: any): 'low' | 'medium' | 'high' {
    const fieldConflict = this.detectFieldConflicts(localData, remoteData);
    return this.calculateSeverity(localData, remoteData, fieldConflict);
  }

  /**
   * Calculate hash for data comparison
   */
  calculateHash(data: any): string {
    if (!data) return '';

    try {
      // Normalize data for consistent hashing
      const normalized = this.normalizeForHashing(data);
      const serialized = JSON.stringify(normalized);

      return createHash(this.config.hashAlgorithm)
        .update(serialized)
        .digest('hex');
    } catch (error) {
      console.warn('Hash calculation failed:', error);
      return '';
    }
  }

  /**
   * Get conflicted fields between local and remote data
   */
  getConflictedFields(localData: any, remoteData: any): string[] {
    const result = this.detectFieldConflicts(localData, remoteData);
    return result.conflictedFields || [];
  }

  /**
   * Determine conflict type
   */
  getConflictType(localData: any, remoteData: any): ConflictType {
    return this.determineConflictType(localData, remoteData, this.detectFieldConflicts(localData, remoteData));
  }

  /**
   * Check if conflict is auto-resolvable
   */
  isAutoResolvable(localData: any, remoteData: any): boolean {
    const fieldConflict = this.detectFieldConflicts(localData, remoteData);
    const severity = this.calculateSeverity(localData, remoteData, fieldConflict);
    return this.checkAutoResolvable(localData, remoteData, severity, fieldConflict);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats(): void {
    this.performanceStats = {
      totalDetections: 0,
      totalTime: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Infinity
    };
  }

  // ===== PRIVATE METHODS =====

  /**
   * Detect timestamp-based conflicts
   */
  private detectTimestampConflict(localData: any, remoteData: any): boolean {
    const localTimestamp = this.extractTimestamp(localData);
    const remoteTimestamp = this.extractTimestamp(remoteData);

    if (!localTimestamp || !remoteTimestamp) return false;

    const diff = Math.abs(localTimestamp - remoteTimestamp);
    return diff > this.config.timestampTolerance;
  }

  /**
   * Detect hash-based conflicts
   */
  private detectHashConflict(localData: any, remoteData: any): boolean {
    const localHash = this.calculateHash(localData);
    const remoteHash = this.calculateHash(remoteData);

    return localHash !== remoteHash;
  }

  /**
   * Detect field-level conflicts
   */
  private detectFieldConflicts(localData: any, remoteData: any): {
    hasConflict: boolean;
    conflictedFields: string[];
    totalFields: number;
    conflictRatio: number;
  } {
    const conflictedFields: string[] = [];
    const allFields = new Set<string>();

    this.compareFields(localData, remoteData, '', conflictedFields, allFields, 0);

    const totalFields = allFields.size;
    const conflictRatio = totalFields > 0 ? conflictedFields.length / totalFields : 0;

    return {
      hasConflict: conflictedFields.length > 0,
      conflictedFields,
      totalFields,
      conflictRatio
    };
  }

  /**
   * Recursively compare fields
   */
  private compareFields(
    local: any,
    remote: any,
    path: string,
    conflicts: string[],
    allFields: Set<string>,
    depth: number
  ): void {
    if (depth >= this.config.fieldComparisonDepth) return;

    const localKeys = local ? Object.keys(local) : [];
    const remoteKeys = remote ? Object.keys(remote) : [];
    const allKeys = new Set([...localKeys, ...remoteKeys]);

    for (const key of allKeys) {
      const fieldPath = path ? `${path}.${key}` : key;
      allFields.add(fieldPath);

      const localValue = local?.[key];
      const remoteValue = remote?.[key];

      // Skip timestamp and metadata fields
      if (this.isMetadataField(key)) continue;

      if (localValue === undefined || remoteValue === undefined) {
        conflicts.push(fieldPath);
        continue;
      }

      if (typeof localValue !== typeof remoteValue) {
        conflicts.push(fieldPath);
        continue;
      }

      if (typeof localValue === 'object' && localValue !== null) {
        this.compareFields(localValue, remoteValue, fieldPath, conflicts, allFields, depth + 1);
      } else if (localValue !== remoteValue) {
        conflicts.push(fieldPath);
      }
    }
  }

  /**
   * Determine conflict type based on analysis
   */
  private determineConflictType(localData: any, remoteData: any, fieldConflict: any): ConflictType {
    if (!localData || !remoteData) return 'delete';

    const localTimestamp = this.extractTimestamp(localData);
    const remoteTimestamp = this.extractTimestamp(remoteData);

    if (localTimestamp && remoteTimestamp && Math.abs(localTimestamp - remoteTimestamp) > this.config.timestampTolerance) {
      return 'timestamp';
    }

    if (fieldConflict.conflictedFields.length > 0) {
      return fieldConflict.conflictRatio > 0.5 ? 'data' : 'field';
    }

    return 'data';
  }

  /**
   * Calculate conflict severity
   */
  private calculateSeverity(localData: any, remoteData: any, fieldConflict: any): 'low' | 'medium' | 'high' {
    if (!localData || !remoteData) return 'high';

    const conflictRatio = fieldConflict.conflictRatio || 0;

    if (conflictRatio > 0.7) return 'high';
    if (conflictRatio > 0.3) return 'medium';
    return 'low';
  }

    /**
   * Check if conflict is auto-resolvable (private implementation)
   */
  private checkAutoResolvable(localData: any, remoteData: any, severity: string, fieldConflict: any): boolean {
    if (severity === 'high') return false;

    const conflictRatio = fieldConflict.conflictRatio || 0;
    return conflictRatio < this.config.autoResolvableThreshold;
  }

  /**
   * Calculate confidence in conflict detection
   */
  private calculateConfidence(fieldConflict: any, timestampConflict: boolean, hashConflict: boolean): number {
    let confidence = 0.5; // base confidence

    if (hashConflict) confidence += 0.3;
    if (timestampConflict) confidence += 0.2;
    if (fieldConflict.hasConflict) confidence += fieldConflict.conflictRatio * 0.3;

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract timestamp from data
   */
  private extractTimestamp(data: any): number {
    if (!data) return 0;

    // Try common timestamp fields
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
   * Normalize data for consistent hashing
   */
  private normalizeForHashing(data: any): any {
    if (data === null || data === undefined) return null;

    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map(item => this.normalizeForHashing(item)).sort();
    }

    const normalized: any = {};
    const keys = Object.keys(data).sort();

    for (const key of keys) {
      if (!this.isMetadataField(key)) {
        normalized[key] = this.normalizeForHashing(data[key]);
      }
    }

    return normalized;
  }

  /**
   * Check if field is metadata (should be ignored in conflict detection)
   */
  private isMetadataField(key: string): boolean {
    const metadataFields = ['_id', '_rev', '_timestamp', 'createdAt', 'updatedAt', '__v'];
    return metadataFields.includes(key) || key.startsWith('_');
  }

  /**
   * Create conflict detection result
   */
  private createResult(
    hasConflict: boolean,
    severity: 'low' | 'medium' | 'high',
    autoResolvable: boolean,
    conflictType?: ConflictType
  ): ConflictDetectionResult {
    return {
      hasConflict,
      conflictType,
      conflictedFields: [],
      severity,
      autoResolvable,
      confidence: hasConflict ? 0.9 : 1.0
    };
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(duration: number): void {
    this.performanceStats.totalDetections++;
    this.performanceStats.totalTime += duration;
    this.performanceStats.averageTime = this.performanceStats.totalTime / this.performanceStats.totalDetections;
    this.performanceStats.maxTime = Math.max(this.performanceStats.maxTime, duration);
    this.performanceStats.minTime = Math.min(this.performanceStats.minTime, duration);

    // Log performance warning if target exceeded
    if (duration > this.config.performanceTarget) {
      console.warn(`⚠️ Conflict detection exceeded target: ${duration.toFixed(2)}ms > ${this.config.performanceTarget}ms`);
    }
  }
}