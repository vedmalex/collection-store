import { IConfigurationComponent } from '../../registry/interfaces/IConfigurationComponent';

/**
 * Configuration inheritance priority levels
 */
export enum InheritancePriority {
  SYSTEM = 'SYSTEM',           // System-wide defaults (lowest priority)
  DATABASE = 'DATABASE',       // Database-level configuration
  COLLECTION = 'COLLECTION',   // Collection-level overrides
  RUNTIME = 'RUNTIME'          // Runtime overrides (highest priority)
}

/**
 * Configuration scope types
 */
export type ConfigurationScope =
  | 'performance'
  | 'security'
  | 'validation'
  | 'replication'
  | 'caching'
  | 'monitoring'
  | 'backup'
  | 'indexing';

/**
 * Database-level configuration
 */
export interface DatabaseConfig {
  databaseId: string;
  name: string;
  description?: string;

  // Performance settings
  performance?: {
    maxConnections?: number;
    connectionTimeout?: number;
    queryTimeout?: number;
    batchSize?: number;
    cacheSize?: number;
  };

  // Security settings
  security?: {
    encryption?: boolean;
    accessControl?: boolean;
    auditLogging?: boolean;
    dataClassification?: string;
  };

  // Validation settings
  validation?: {
    strictMode?: boolean;
    schemaValidation?: boolean;
    dataTypeValidation?: boolean;
    customValidators?: string[];
  };

  // Replication settings
  replication?: {
    enabled?: boolean;
    strategy?: string;
    syncInterval?: number;
    conflictResolution?: string;
  };

  // Caching settings
  caching?: {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
    strategy?: string;
  };

  // Monitoring settings
  monitoring?: {
    enabled?: boolean;
    metricsCollection?: boolean;
    alerting?: boolean;
    logLevel?: string;
  };

  // Backup settings
  backup?: {
    enabled?: boolean;
    schedule?: string;
    retention?: number;
    compression?: boolean;
  };

  // Indexing settings
  indexing?: {
    autoIndexing?: boolean;
    indexStrategy?: string;
    rebuildThreshold?: number;
  };

  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection-level configuration override
 */
export interface CollectionConfigOverride {
  collectionId: string;
  databaseId: string;
  overrides: Partial<DatabaseConfig>;
  priority: InheritancePriority;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved configuration after inheritance
 */
export interface ResolvedConfig {
  databaseId: string;
  collectionId?: string;
  finalConfig: DatabaseConfig;
  inheritanceChain: InheritanceStep[];
  resolutionTimestamp: Date;
}

/**
 * Inheritance step in the resolution chain
 */
export interface InheritanceStep {
  source: 'SYSTEM' | 'DATABASE' | 'COLLECTION' | 'RUNTIME';
  priority: InheritancePriority;
  configSection: ConfigurationScope;
  value: any;
  overridden: boolean;
  reason?: string;
}

/**
 * Configuration inheritance rule
 */
export interface InheritanceRule {
  name: string;
  description: string;
  scope: ConfigurationScope;
  condition: (context: InheritanceContext) => boolean;
  transformer?: (value: any, context: InheritanceContext) => any;
  priority: number;
  enabled: boolean;
}

/**
 * Context for inheritance resolution
 */
export interface InheritanceContext {
  databaseId: string;
  collectionId?: string;
  configScope: ConfigurationScope;
  currentValue?: any;
  parentValue?: any;
  metadata?: Record<string, any>;
}

/**
 * Inheritance validation result
 */
export interface InheritanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Database inheritance statistics
 */
export interface DatabaseInheritanceStats {
  totalDatabases: number;
  configuredDatabases: number;
  totalCollections: number;
  collectionsWithOverrides: number;
  inheritanceRulesCount: number;
  resolutionCacheSize: number;
  lastResolutionTime?: Date;
  averageResolutionTime: number;
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
  type: 'DATABASE_CONFIG_UPDATED' | 'COLLECTION_OVERRIDE_ADDED' | 'COLLECTION_OVERRIDE_REMOVED' | 'INHERITANCE_RULE_CHANGED';
  databaseId: string;
  collectionId?: string;
  changes: Record<string, { oldValue: any; newValue: any }>;
  timestamp: Date;
  source: string;
}

/**
 * Callback for configuration change events
 */
export type ConfigurationChangeCallback = (event: ConfigurationChangeEvent) => void;

/**
 * Database inheritance manager configuration
 */
export interface DatabaseInheritanceManagerConfig {
  enableInheritance: boolean;
  enableCaching: boolean;
  cacheTimeout: number; // milliseconds
  enableEvents: boolean;
  enableValidation: boolean;
  defaultInheritanceRules: InheritanceRule[];
  resolutionTimeout: number; // milliseconds
}

/**
 * Interface for managing database-level configuration inheritance
 */
export interface IDatabaseInheritanceManager extends IConfigurationComponent {
  /**
   * Set database-level configuration
   */
  setDatabaseConfig(databaseId: string, config: Partial<DatabaseConfig>): Promise<void>;

  /**
   * Get database configuration
   */
  getDatabaseConfig(databaseId: string): DatabaseConfig | null;

  /**
   * Get all database configurations
   */
  getAllDatabaseConfigs(): Map<string, DatabaseConfig>;

  /**
   * Add collection-level configuration override
   */
  addCollectionOverride(
    databaseId: string,
    collectionId: string,
    overrides: Partial<DatabaseConfig>,
    priority?: InheritancePriority,
    reason?: string
  ): Promise<void>;

  /**
   * Remove collection-level configuration override
   */
  removeCollectionOverride(databaseId: string, collectionId: string): Promise<void>;

  /**
   * Get collection override
   */
  getCollectionOverride(databaseId: string, collectionId: string): CollectionConfigOverride | null;

  /**
   * Get all collection overrides for a database
   */
  getCollectionOverrides(databaseId: string): Map<string, CollectionConfigOverride>;

  /**
   * Resolve effective configuration for a collection
   */
  resolveEffectiveConfig(databaseId: string, collectionId?: string): Promise<ResolvedConfig>;

  /**
   * Get configuration value with inheritance
   */
  getConfigValue<T>(
    databaseId: string,
    configPath: string,
    collectionId?: string
  ): Promise<T | undefined>;

  /**
   * Validate configuration inheritance
   */
  validateInheritance(databaseId: string, collectionId?: string): Promise<InheritanceValidationResult>;

  /**
   * Add inheritance rule
   */
  addInheritanceRule(rule: InheritanceRule): void;

  /**
   * Remove inheritance rule
   */
  removeInheritanceRule(ruleName: string): void;

  /**
   * Get all inheritance rules
   */
  getInheritanceRules(): InheritanceRule[];

  /**
   * Clear resolution cache
   */
  clearResolutionCache(): void;

  /**
   * Get inheritance statistics
   */
  getStats(): DatabaseInheritanceStats;

  /**
   * Subscribe to configuration change events
   */
  onConfigurationChange(callback: ConfigurationChangeCallback): void;

  /**
   * Unsubscribe from configuration change events
   */
  offConfigurationChange(callback: ConfigurationChangeCallback): void;

  /**
   * Export database configurations
   */
  exportConfigurations(): {
    databases: Record<string, DatabaseConfig>;
    overrides: Record<string, Record<string, CollectionConfigOverride>>;
  };

  /**
   * Import database configurations
   */
  importConfigurations(data: {
    databases: Record<string, DatabaseConfig>;
    overrides: Record<string, Record<string, CollectionConfigOverride>>;
  }, merge?: boolean): Promise<void>;

  /**
   * Bulk update database configurations
   */
  bulkUpdateDatabaseConfigs(
    updates: Map<string, Partial<DatabaseConfig>>
  ): Promise<void>;

  /**
   * Bulk update collection overrides
   */
  bulkUpdateCollectionOverrides(
    updates: Map<string, Map<string, Partial<DatabaseConfig>>>
  ): Promise<void>;

  /**
   * Get configuration hierarchy for debugging
   */
  getConfigurationHierarchy(databaseId: string, collectionId?: string): Promise<{
    system: any;
    database: DatabaseConfig | null;
    collection: CollectionConfigOverride | null;
    resolved: ResolvedConfig;
  }>;

  /**
   * Force refresh of all configurations
   */
  refreshAllConfigurations(): Promise<void>;
}