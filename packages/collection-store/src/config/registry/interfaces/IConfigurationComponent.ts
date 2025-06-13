/**
 * Base interface for all configuration components in the Collection Store.
 * Provides lifecycle management, health monitoring, and configuration updates.
 */
export interface IConfigurationComponent {
  /** Unique identifier for this component */
  readonly id: string;

  /** Type identifier for this component (e.g., 'adapter-factory', 'feature-toggles') */
  readonly type: string;

  /** Human-readable name for this component */
  readonly name: string;

  /** Current version of this component */
  readonly version: string;

  /**
   * Initialize the component with the provided configuration.
   * Called once during component registration.
   *
   * @param config Component-specific configuration
   * @throws {Error} If initialization fails
   */
  initialize(config: any): Promise<void>;

  /**
   * Update the component configuration at runtime.
   * Called when configuration changes are detected.
   *
   * @param config Updated configuration
   * @throws {Error} If configuration update fails
   */
  updateConfig(config: any): Promise<void>;

  /**
   * Start the component and begin its operations.
   * Called after initialization is complete.
   *
   * @throws {Error} If component cannot be started
   */
  start(): Promise<void>;

  /**
   * Stop the component and cease its operations.
   * Called during shutdown or before configuration updates.
   *
   * @throws {Error} If component cannot be stopped gracefully
   */
  stop(): Promise<void>;

  /**
   * Get the current health status of this component.
   * Used for monitoring and diagnostics.
   *
   * @returns Current health status
   */
  getHealth(): Promise<ComponentHealth>;

  /**
   * Cleanup resources and prepare for shutdown.
   * Called during application shutdown.
   *
   * @throws {Error} If cleanup fails
   */
  cleanup(): Promise<void>;

  /**
   * Check if the component is currently running.
   *
   * @returns True if component is running, false otherwise
   */
  isRunning(): boolean;

  /**
   * Get component-specific metadata and status information.
   *
   * @returns Component metadata
   */
  getMetadata(): ComponentMetadata;
}

/**
 * Component health status enumeration
 */
export enum ComponentStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

/**
 * Health status of a configuration component
 */
export interface ComponentHealth {
  /** Overall health status */
  status: ComponentStatus;

  /** Timestamp of last health check */
  lastCheck: Date;

  /** Health check details and metrics */
  details: {
    /** Response time in milliseconds */
    responseTime?: number;

    /** Error message if status is 'error' */
    error?: string;

    /** Warning message if status is 'warning' */
    warning?: string;

    /** Number of databases configured */
    databases?: number;

    /** Additional health metrics */
    metrics?: Record<string, any>;
  };

  /** Uptime in milliseconds since component start */
  uptime: number;
}

/**
 * Metadata information for a configuration component
 */
export interface ComponentMetadata {
  /** Component description */
  description: string;

  /** Component dependencies */
  dependencies: string[];

  /** Configuration schema version */
  configVersion: string;

  /** Component capabilities */
  capabilities: string[];

  /** Last configuration update timestamp */
  lastConfigUpdate: Date;

  /** Component statistics */
  statistics: {
    /** Number of configuration updates */
    configUpdates: number;

    /** Number of restarts */
    restarts: number;

    /** Total runtime in milliseconds */
    totalRuntime: number;
  };
}

/**
 * Lifecycle state of a configuration component
 */
export type ComponentLifecycleState =
  | 'uninitialized'
  | 'initializing'
  | 'initialized'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'cleanup';

/**
 * Configuration component events
 */
export interface ComponentEvents {
  /** Fired when component state changes */
  stateChange: (state: ComponentLifecycleState) => void;

  /** Fired when component configuration is updated */
  configUpdate: (config: any) => void;

  /** Fired when component health status changes */
  healthChange: (health: ComponentHealth) => void;

  /** Fired when component encounters an error */
  error: (error: Error) => void;
}