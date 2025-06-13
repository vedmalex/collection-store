/**
 * Conflict Resolution Manager Interface
 * Manages resolution of configuration conflicts between different sources
 */

import { ComponentLifecycleState } from '../../registry/interfaces/IConfigurationComponent';

// Conflict Resolution Strategies
export enum ConflictResolutionStrategy {
  MERGE = 'merge',                    // Merge configurations with priority rules
  OVERRIDE = 'override',              // Override with highest priority source
  PROMPT = 'prompt',                  // Prompt user for resolution
  CUSTOM = 'custom',                  // Use custom resolution function
  PRESERVE_EXISTING = 'preserve',     // Keep existing configuration
  FAIL_ON_CONFLICT = 'fail'          // Fail when conflicts detected
}

// Conflict Types
export enum ConflictType {
  VALUE_MISMATCH = 'value_mismatch',           // Different values for same key
  TYPE_MISMATCH = 'type_mismatch',             // Different types for same key
  STRUCTURE_MISMATCH = 'structure_mismatch',   // Different object structures
  ARRAY_CONFLICT = 'array_conflict',           // Array merge conflicts
  DEPENDENCY_CONFLICT = 'dependency_conflict', // Conflicting dependencies
  VERSION_CONFLICT = 'version_conflict',       // Version compatibility conflicts
  PERMISSION_CONFLICT = 'permission_conflict'  // Permission/access conflicts
}

// Conflict Severity Levels
export enum ConflictSeverity {
  LOW = 'low',           // Minor conflicts, can be auto-resolved
  MEDIUM = 'medium',     // Moderate conflicts, may need attention
  HIGH = 'high',         // Serious conflicts, require resolution
  CRITICAL = 'critical'  // Critical conflicts, block operations
}

// Configuration Source Information
export interface ConfigurationSource {
  id: string;
  name: string;
  type: 'file' | 'database' | 'environment' | 'api' | 'user' | 'default';
  priority: number;        // Higher number = higher priority
  version?: string;
  lastModified: Date;
  checksum?: string;
  metadata?: Record<string, any>;
}

// Conflict Detection Result
export interface ConfigurationConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  path: string;           // JSON path to conflicting property
  description: string;
  sources: ConfigurationSource[];
  values: {
    source: ConfigurationSource;
    value: any;
    path: string;
  }[];
  detectedAt: Date;
  autoResolvable: boolean;
  suggestedStrategy: ConflictResolutionStrategy;
  metadata?: Record<string, any>;
}

// Resolution Rule Configuration
export interface ConflictResolutionRule {
  id: string;
  name: string;
  description: string;
  pattern: string | RegExp;    // Path pattern to match
  strategy: ConflictResolutionStrategy;
  priority: number;
  conditions?: {
    conflictTypes?: ConflictType[];
    severityLevels?: ConflictSeverity[];
    sourceTypes?: string[];
    customCondition?: (conflict: ConfigurationConflict) => boolean;
  };
  config?: {
    mergeStrategy?: 'deep' | 'shallow' | 'array_concat' | 'array_replace';
    preserveArrayOrder?: boolean;
    customResolver?: string;  // Function name for custom resolution
    promptMessage?: string;
    timeoutMs?: number;
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Resolution Execution Context
export interface ResolutionContext {
  conflictId: string;
  rule: ConflictResolutionRule;
  conflict: ConfigurationConflict;
  userInput?: any;
  environment: {
    interactive: boolean;
    timeoutMs: number;
    allowPrompts: boolean;
  };
  metadata?: Record<string, any>;
}

// Resolution Result
export interface ConflictResolutionResult {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  success: boolean;
  resolvedValue: any;
  appliedRule?: ConflictResolutionRule;
  executionTime: number;
  warnings?: string[];
  errors?: string[];
  metadata?: {
    originalValues: any[];
    mergeDetails?: any;
    userChoices?: any;
  };
}

// Batch Resolution Result
export interface BatchResolutionResult {
  totalConflicts: number;
  resolvedConflicts: number;
  failedConflicts: number;
  skippedConflicts: number;
  results: ConflictResolutionResult[];
  executionTime: number;
  summary: {
    byStrategy: Record<ConflictResolutionStrategy, number>;
    bySeverity: Record<ConflictSeverity, number>;
    byType: Record<ConflictType, number>;
  };
}

// Conflict Resolution Statistics
export interface ConflictResolutionStats {
  totalConflictsDetected: number;
  totalConflictsResolved: number;
  totalConflictsFailed: number;
  averageResolutionTime: number;
  conflictsByType: Record<ConflictType, number>;
  conflictsBySeverity: Record<ConflictSeverity, number>;
  resolutionsByStrategy: Record<ConflictResolutionStrategy, number>;
  rulesUsage: Record<string, number>;
  lastReset: Date;
  nextScheduledCheck: Date;
}

// Conflict Resolution Event
export interface ConflictResolutionEvent {
  type: 'conflict_detected' | 'conflict_resolved' | 'resolution_failed' | 'batch_completed' | 'rule_applied';
  timestamp: Date;
  data: {
    conflict?: ConfigurationConflict;
    result?: ConflictResolutionResult;
    batchResult?: BatchResolutionResult;
    rule?: ConflictResolutionRule;
    error?: string;
  };
}

// Manager Configuration
export interface ConflictResolutionManagerConfig {
  detection: {
    enabled: boolean;
    deepScan: boolean;
    checkInterval: number;        // ms between automatic checks
    maxDepth: number;            // Maximum object depth to scan
    ignorePatterns: string[];    // Patterns to ignore during detection
    customDetectors: string[];   // Custom conflict detector functions
  };
  resolution: {
    defaultStrategy: ConflictResolutionStrategy;
    autoResolve: boolean;
    maxAutoResolutionTime: number;  // ms
    batchSize: number;
    parallelResolution: boolean;
    retryAttempts: number;
    retryDelay: number;
  };
  rules: ConflictResolutionRule[];
  notifications: {
    enabled: boolean;
    severityThreshold: ConflictSeverity;
    channels: string[];
    templates: Record<string, string>;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    includeValues: boolean;
    maxLogSize: number;
  };
  performance: {
    enableCaching: boolean;
    cacheSize: number;
    cacheTTL: number;
    enableMetrics: boolean;
  };
}

// Main Interface
export interface IConflictResolutionManager {
  // Lifecycle Management
  initialize(config?: ConflictResolutionManagerConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): ComponentLifecycleState;
  getHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'error';
    details: {
      activeConflicts: number;
      pendingResolutions: number;
      rulesCount: number;
      lastCheck: Date;
      nextCheck: Date;
      averageResolutionTime: number;
    };
    issues: string[];
    recommendations: string[];
  }>;

  // Configuration Management
  updateConfig(config: Partial<ConflictResolutionManagerConfig>): Promise<void>;
  getConfig(): ConflictResolutionManagerConfig;

  // Conflict Detection
  detectConflicts(configurations: Record<string, any>, sources: ConfigurationSource[]): Promise<ConfigurationConflict[]>;
  detectConflictsInPath(path: string, configurations: Record<string, any>, sources: ConfigurationSource[]): Promise<ConfigurationConflict[]>;
  validateConfiguration(config: any, source: ConfigurationSource): Promise<{ valid: boolean; conflicts: ConfigurationConflict[] }>;
  scanForConflicts(): Promise<ConfigurationConflict[]>;

  // Conflict Management
  getConflict(conflictId: string): ConfigurationConflict | undefined;
  getAllConflicts(): ConfigurationConflict[];
  getConflictsByType(type: ConflictType): ConfigurationConflict[];
  getConflictsBySeverity(severity: ConflictSeverity): ConfigurationConflict[];
  removeConflict(conflictId: string): Promise<void>;
  clearAllConflicts(): Promise<void>;

  // Resolution Rules Management
  addResolutionRule(rule: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  updateResolutionRule(ruleId: string, updates: Partial<ConflictResolutionRule>): Promise<void>;
  removeResolutionRule(ruleId: string): Promise<void>;
  getResolutionRule(ruleId: string): ConflictResolutionRule | undefined;
  getAllResolutionRules(): ConflictResolutionRule[];
  enableResolutionRule(ruleId: string): Promise<void>;
  disableResolutionRule(ruleId: string): Promise<void>;
  validateResolutionRule(rule: Partial<ConflictResolutionRule>): Promise<{ valid: boolean; errors: string[] }>;

  // Conflict Resolution
  resolveConflict(conflictId: string, strategy?: ConflictResolutionStrategy, userInput?: any): Promise<ConflictResolutionResult>;
  resolveConflicts(conflictIds: string[], strategy?: ConflictResolutionStrategy): Promise<BatchResolutionResult>;
  resolveAllConflicts(strategy?: ConflictResolutionStrategy): Promise<BatchResolutionResult>;
  autoResolveConflicts(): Promise<BatchResolutionResult>;

  // Resolution Strategies
  mergeConfigurations(configurations: any[], sources: ConfigurationSource[], strategy?: 'deep' | 'shallow'): Promise<any>;
  selectConfiguration(configurations: any[], sources: ConfigurationSource[], criteria?: string): Promise<any>;
  promptUserForResolution(conflict: ConfigurationConflict): Promise<any>;
  applyCustomResolution(conflict: ConfigurationConflict, resolverName: string): Promise<any>;

  // Statistics and Monitoring
  getStatistics(): ConflictResolutionStats;
  resetStatistics(): Promise<void>;
  exportStatistics(): Promise<string>;

  // Event System
  on(event: string, callback: (event: ConflictResolutionEvent) => void): void;
  off(event: string, callback: Function): void;
  emit(event: string, data: any): void;

  // Utility Methods
  compareConfigurations(config1: any, config2: any, source1: ConfigurationSource, source2: ConfigurationSource): Promise<ConfigurationConflict[]>;
  generateConflictReport(): Promise<string>;
  simulateResolution(conflictId: string, strategy: ConflictResolutionStrategy): Promise<{
    success: boolean;
    result: any;
    warnings: string[];
    estimatedTime: number;
  }>;

  // Bulk Operations
  addMultipleResolutionRules(rules: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<string[]>;
  updateMultipleResolutionRules(updates: { ruleId: string; updates: Partial<ConflictResolutionRule> }[]): Promise<void>;
  removeMultipleResolutionRules(ruleIds: string[]): Promise<void>;

  // Import/Export
  exportConfiguration(): Promise<string>;
  importConfiguration(configData: string): Promise<void>;
  exportConflictHistory(): Promise<string>;
  importConflictHistory(historyData: string): Promise<void>;
}