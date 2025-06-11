import { IConfigurationComponent } from '../../registry/interfaces/IConfigurationComponent';

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  /** Feature name/identifier */
  name: string;
  /** Whether feature is enabled */
  enabled: boolean;
  /** Feature description */
  description?: string;
  /** Feature conditions for evaluation */
  conditions?: FeatureConditions;
  /** Feature metadata */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Feature conditions for complex evaluation
 */
export interface FeatureConditions {
  /** Percentage rollout (0-100) */
  percentage?: number;
  /** Target user groups */
  userGroups?: string[];
  /** Time-based activation */
  timeWindow?: {
    start?: Date;
    end?: Date;
  };
  /** Environment restrictions */
  environments?: string[];
  /** Feature dependencies */
  dependencies?: string[];
  /** Custom evaluation function */
  customEvaluator?: string;
}

/**
 * Feature configuration for updates
 */
export interface FeatureConfig {
  /** Whether feature is enabled */
  enabled: boolean;
  /** Feature description */
  description?: string;
  /** Feature conditions */
  conditions?: FeatureConditions;
  /** Feature metadata */
  metadata?: Record<string, any>;
}

/**
 * Feature change event data
 */
export interface FeatureChangeEvent {
  /** Feature name */
  feature: string;
  /** Previous state */
  previousState: boolean;
  /** New state */
  newState: boolean;
  /** Change timestamp */
  timestamp: Date;
  /** Change reason */
  reason?: string;
  /** User/system that made the change */
  changedBy?: string;
}

/**
 * Feature evaluation context
 */
export interface FeatureEvaluationContext {
  /** User ID for user-specific features */
  userId?: string;
  /** User groups */
  userGroups?: string[];
  /** Current environment */
  environment?: string;
  /** Request timestamp */
  timestamp?: Date;
  /** Additional context data */
  context?: Record<string, any>;
}

/**
 * Feature toggle statistics
 */
export interface FeatureToggleStats {
  /** Total number of features */
  totalFeatures: number;
  /** Number of enabled features */
  enabledFeatures: number;
  /** Number of disabled features */
  disabledFeatures: number;
  /** Features with conditions */
  conditionalFeatures: number;
  /** Feature evaluation count */
  evaluationCount: number;
  /** Last evaluation timestamp */
  lastEvaluation?: Date;
}

/**
 * Feature change callback function
 */
export type FeatureChangeCallback = (event: FeatureChangeEvent) => void;

/**
 * Feature toggle manager configuration
 */
export interface FeatureToggleManagerConfig {
  /** Default feature state for unknown features */
  defaultEnabled: boolean;
  /** Enable feature evaluation caching */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Enable feature change events */
  enableEvents: boolean;
  /** Feature persistence settings */
  persistence?: {
    enabled: boolean;
    storage: 'memory' | 'file' | 'database';
    path?: string;
  };
  /** Feature evaluation settings */
  evaluation?: {
    enableUserGrouping: boolean;
    enablePercentageRollout: boolean;
    enableTimeWindows: boolean;
    enableDependencies: boolean;
  };
}

/**
 * Feature toggle manager interface
 * Manages dynamic feature flags with hot reload support
 */
export interface IFeatureToggleManager extends IConfigurationComponent {
  /**
   * Check if a feature is enabled
   * @param feature Feature name
   * @param context Evaluation context
   * @returns True if feature is enabled
   */
  isEnabled(feature: string, context?: FeatureEvaluationContext): boolean;

  /**
   * Enable a feature
   * @param feature Feature name
   * @param reason Optional reason for change
   * @returns Promise that resolves when feature is enabled
   */
  enable(feature: string, reason?: string): Promise<void>;

  /**
   * Disable a feature
   * @param feature Feature name
   * @param reason Optional reason for change
   * @returns Promise that resolves when feature is disabled
   */
  disable(feature: string, reason?: string): Promise<void>;

  /**
   * Toggle a feature state
   * @param feature Feature name
   * @param reason Optional reason for change
   * @returns Promise that resolves when feature is toggled
   */
  toggle(feature: string, reason?: string): Promise<void>;

  /**
   * Enable multiple features
   * @param features Array of feature names
   * @param reason Optional reason for change
   * @returns Promise that resolves when all features are enabled
   */
  enableMultiple(features: string[], reason?: string): Promise<void>;

  /**
   * Disable multiple features
   * @param features Array of feature names
   * @param reason Optional reason for change
   * @returns Promise that resolves when all features are disabled
   */
  disableMultiple(features: string[], reason?: string): Promise<void>;

  /**
   * Update feature configuration
   * @param feature Feature name
   * @param config New feature configuration
   * @returns Promise that resolves when configuration is updated
   */
  updateFeatureConfig(feature: string, config: FeatureConfig): Promise<void>;

  /**
   * Get feature configuration
   * @param feature Feature name
   * @returns Feature configuration or null if not found
   */
  getFeatureConfig(feature: string): FeatureConfig | null;

  /**
   * Get feature flag details
   * @param feature Feature name
   * @returns Feature flag or null if not found
   */
  getFeatureFlag(feature: string): FeatureFlag | null;

  /**
   * Get all features
   * @returns Map of all features
   */
  getAllFeatures(): Map<string, FeatureFlag>;

  /**
   * Get enabled features
   * @param context Optional evaluation context
   * @returns Array of enabled feature names
   */
  getEnabledFeatures(context?: FeatureEvaluationContext): string[];

  /**
   * Get disabled features
   * @returns Array of disabled feature names
   */
  getDisabledFeatures(): string[];

  /**
   * Create a new feature
   * @param feature Feature name
   * @param config Feature configuration
   * @returns Promise that resolves when feature is created
   */
  createFeature(feature: string, config: FeatureConfig): Promise<void>;

  /**
   * Remove a feature
   * @param feature Feature name
   * @returns Promise that resolves when feature is removed
   */
  removeFeature(feature: string): Promise<void>;

  /**
   * Check if feature exists
   * @param feature Feature name
   * @returns True if feature exists
   */
  hasFeature(feature: string): boolean;

  /**
   * Get feature toggle statistics
   * @returns Current statistics
   */
  getStats(): FeatureToggleStats;

  /**
   * Clear evaluation cache
   * @param feature Optional specific feature to clear
   */
  clearCache(feature?: string): void;

  /**
   * Subscribe to feature changes
   * @param callback Callback function
   */
  onFeatureChange(callback: FeatureChangeCallback): void;

  /**
   * Unsubscribe from feature changes
   * @param callback Callback function
   */
  offFeatureChange(callback: FeatureChangeCallback): void;

  /**
   * Evaluate feature with context
   * @param feature Feature name
   * @param context Evaluation context
   * @returns Evaluation result
   */
  evaluateFeature(feature: string, context?: FeatureEvaluationContext): {
    enabled: boolean;
    reason: string;
    evaluatedAt: Date;
  };

  /**
   * Bulk update features
   * @param updates Map of feature names to configurations
   * @returns Promise that resolves when all updates are complete
   */
  bulkUpdate(updates: Map<string, FeatureConfig>): Promise<void>;

  /**
   * Export features configuration
   * @returns Serializable features configuration
   */
  exportConfig(): Record<string, FeatureConfig>;

  /**
   * Import features configuration
   * @param config Features configuration to import
   * @param merge Whether to merge with existing features
   * @returns Promise that resolves when import is complete
   */
  importConfig(config: Record<string, FeatureConfig>, merge?: boolean): Promise<void>;
}