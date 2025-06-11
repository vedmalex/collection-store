import { IConfigurationComponent, ComponentStatus } from '../../registry/interfaces/IConfigurationComponent';

/**
 * Write operation types that can be blocked
 */
export type WriteOperationType =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'BULK_INSERT'
  | 'BULK_UPDATE'
  | 'BULK_DELETE'
  | 'REPLACE'
  | 'UPSERT';

/**
 * Protection levels for read-only collections
 */
export enum ProtectionLevel {
  STRICT = 'STRICT',           // Block all write operations
  WARNING = 'WARNING',         // Allow but log warnings
  CUSTOM = 'CUSTOM',          // Use custom rules
  DISABLED = 'DISABLED'       // No protection
}

/**
 * Write operation details
 */
export interface WriteOperation {
  type: WriteOperationType;
  collectionId: string;
  data?: any;
  filter?: any;
  options?: any;
  timestamp: Date;
  source?: string;
}

/**
 * Read-only collection configuration
 */
export interface ReadOnlyCollectionConfig {
  collectionId: string;
  protectionLevel: ProtectionLevel;
  allowedOperations?: WriteOperationType[];
  blockedOperations?: WriteOperationType[];
  autoDetected: boolean;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Write operation validation result
 */
export interface WriteValidationResult {
  allowed: boolean;
  reason: string;
  protectionLevel: ProtectionLevel;
  suggestedAction?: string;
  metadata?: Record<string, any>;
}

/**
 * Auto-detection rules for read-only collections
 */
export interface AutoDetectionRule {
  name: string;
  description: string;
  condition: (collectionId: string, metadata?: any) => boolean;
  protectionLevel: ProtectionLevel;
  priority: number;
  enabled: boolean;
}

/**
 * Read-only collection statistics
 */
export interface ReadOnlyCollectionStats {
  totalCollections: number;
  readOnlyCollections: number;
  protectedCollections: number;
  autoDetectedCollections: number;
  blockedOperations: number;
  warningOperations: number;
  lastBlockedOperation?: Date;
  lastAutoDetection?: Date;
}

/**
 * Write operation event
 */
export interface WriteOperationEvent {
  operation: WriteOperation;
  result: WriteValidationResult;
  timestamp: Date;
  collectionConfig: ReadOnlyCollectionConfig;
}

/**
 * Callback for write operation events
 */
export type WriteOperationCallback = (event: WriteOperationEvent) => void;

/**
 * Read-only collection manager configuration
 */
export interface ReadOnlyCollectionManagerConfig {
  defaultProtectionLevel: ProtectionLevel;
  enableAutoDetection: boolean;
  enableEvents: boolean;
  enableLogging: boolean;
  autoDetectionInterval: number; // milliseconds
  detectionRules: AutoDetectionRule[];
}

/**
 * Interface for managing read-only collections with write protection
 */
export interface IReadOnlyCollectionManager extends IConfigurationComponent {
  /**
   * Mark a collection as read-only
   */
  markAsReadOnly(
    collectionId: string,
    protectionLevel?: ProtectionLevel,
    reason?: string
  ): Promise<void>;

  /**
   * Remove read-only protection from a collection
   */
  markAsWritable(collectionId: string): Promise<void>;

  /**
   * Check if a collection is read-only
   */
  isReadOnly(collectionId: string): boolean;

  /**
   * Get read-only configuration for a collection
   */
  getReadOnlyConfig(collectionId: string): ReadOnlyCollectionConfig | null;

  /**
   * Get all read-only collections
   */
  getAllReadOnlyCollections(): Map<string, ReadOnlyCollectionConfig>;

  /**
   * Validate a write operation against read-only rules
   */
  validateWriteOperation(
    collectionId: string,
    operation: WriteOperation
  ): Promise<WriteValidationResult>;

  /**
   * Auto-detect read-only collections based on rules
   */
  autoDetectReadOnlyCollections(): Promise<string[]>;

  /**
   * Add a custom auto-detection rule
   */
  addDetectionRule(rule: AutoDetectionRule): void;

  /**
   * Remove an auto-detection rule
   */
  removeDetectionRule(ruleName: string): void;

  /**
   * Get all detection rules
   */
  getDetectionRules(): AutoDetectionRule[];

  /**
   * Update protection level for a collection
   */
  updateProtectionLevel(
    collectionId: string,
    protectionLevel: ProtectionLevel
  ): Promise<void>;

  /**
   * Bulk update read-only configurations
   */
  bulkUpdateConfigurations(
    updates: Map<string, Partial<ReadOnlyCollectionConfig>>
  ): Promise<void>;

  /**
   * Get read-only collection statistics
   */
  getStats(): ReadOnlyCollectionStats;

  /**
   * Subscribe to write operation events
   */
  onWriteOperation(callback: WriteOperationCallback): void;

  /**
   * Unsubscribe from write operation events
   */
  offWriteOperation(callback: WriteOperationCallback): void;

  /**
   * Export read-only configurations
   */
  exportConfigurations(): Record<string, ReadOnlyCollectionConfig>;

  /**
   * Import read-only configurations
   */
  importConfigurations(
    configurations: Record<string, ReadOnlyCollectionConfig>,
    merge?: boolean
  ): Promise<void>;

  /**
   * Clear all read-only configurations
   */
  clearAllConfigurations(): Promise<void>;

  /**
   * Force re-detection of read-only collections
   */
  forceAutoDetection(): Promise<string[]>;
}