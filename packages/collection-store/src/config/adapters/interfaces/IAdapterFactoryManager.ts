import { IConfigurationComponent, ComponentHealth } from '../../registry/interfaces/IConfigurationComponent';

/**
 * External adapter interface for Collection Store
 */
export interface IExternalAdapter {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** Adapter type (e.g., 'mongodb', 'googlesheets', 'markdown') */
  readonly type: string;

  /** Human-readable name for this adapter */
  readonly name: string;

  /** Current version of this adapter */
  readonly version: string;

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: any): Promise<void>;

  /**
   * Start the adapter operations
   */
  start(): Promise<void>;

  /**
   * Stop the adapter operations
   */
  stop(): Promise<void>;

  /**
   * Get adapter health status
   */
  getHealth(): Promise<ComponentHealth>;

  /**
   * Update adapter configuration
   */
  updateConfig(config: any): Promise<void>;

  /**
   * Cleanup adapter resources
   */
  cleanup(): Promise<void>;

  /**
   * Check if adapter is currently running
   */
  isRunning(): boolean;
}

/**
 * Adapter constructor type
 */
export type AdapterConstructor = new (id: string, config: any) => IExternalAdapter;

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Adapter ID */
  id: string;

  /** Adapter type */
  type: string;

  /** Adapter name */
  name: string;

  /** Whether adapter is enabled */
  enabled: boolean;

  /** Adapter priority (higher numbers start first) */
  priority: number;

  /** Adapter-specific configuration */
  config: any;

  /** Adapter dependencies */
  dependencies?: string[];

  /** Health check configuration */
  healthCheck?: {
    /** Health check interval in milliseconds */
    interval: number;

    /** Health check timeout in milliseconds */
    timeout: number;

    /** Number of failures before marking as unhealthy */
    failureThreshold: number;
  };
}

/**
 * Adapter factory configuration
 */
export interface AdapterFactoryConfig {
  /** List of adapter configurations */
  adapters: AdapterConfig[];

  /** Global adapter settings */
  settings: {
    /** Maximum time to wait for adapter initialization (ms) */
    initializationTimeout: number;

    /** Maximum time to wait for adapter startup (ms) */
    startupTimeout: number;

    /** Maximum time to wait for adapter shutdown (ms) */
    shutdownTimeout: number;

    /** Whether to enable automatic health monitoring */
    enableHealthMonitoring: boolean;

    /** Health check interval for all adapters (ms) */
    globalHealthCheckInterval: number;

    /** Whether to auto-restart failed adapters */
    autoRestartFailedAdapters: boolean;

    /** Maximum number of restart attempts */
    maxRestartAttempts: number;
  };
}

/**
 * Adapter health status
 */
export interface AdapterHealth extends ComponentHealth {
  /** Adapter-specific health metrics */
  adapterMetrics?: {
    /** Number of active connections */
    activeConnections: number;

    /** Number of pending operations */
    pendingOperations: number;

    /** Average response time in milliseconds */
    avgResponseTime: number;

    /** Error rate (errors per operation) */
    errorRate: number;

    /** Last successful operation timestamp */
    lastSuccessfulOperation: Date;
  };
}

/**
 * Adapter operation result
 */
export interface AdapterOperationResult {
  /** Whether operation was successful */
  success: boolean;

  /** Adapter ID */
  adapterId: string;

  /** Operation type */
  operation: 'create' | 'start' | 'stop' | 'restart' | 'updateConfig' | 'healthCheck';

  /** Operation duration in milliseconds */
  duration: number;

  /** Error information (if operation failed) */
  error?: {
    /** Error message */
    message: string;

    /** Error code */
    code: string;

    /** Error details */
    details?: any;
  };

  /** Operation result data */
  data?: any;

  /** Operation timestamp */
  timestamp: Date;
}

/**
 * Adapter Factory Manager interface
 * Manages creation, lifecycle, and monitoring of external adapters
 */
export interface IAdapterFactoryManager extends IConfigurationComponent {
  /**
   * Create a new adapter instance
   *
   * @param type Adapter type
   * @param config Adapter configuration
   * @returns Created adapter instance
   * @throws {Error} If adapter type is not registered or creation fails
   */
  createAdapter(type: string, config: AdapterConfig): Promise<IExternalAdapter>;

  /**
   * Get an adapter by its ID
   *
   * @param id Adapter ID
   * @returns Adapter instance or null if not found
   */
  getAdapter(id: string): IExternalAdapter | null;

  /**
   * Get all adapters of a specific type
   *
   * @param type Adapter type
   * @returns Array of adapters of the specified type
   */
  getAdaptersByType(type: string): IExternalAdapter[];

  /**
   * Get all registered adapters
   *
   * @returns Array of all adapters
   */
  getAllAdapters(): IExternalAdapter[];

  /**
   * Register a new adapter type
   *
   * @param type Adapter type name
   * @param constructor Adapter constructor function
   * @throws {Error} If adapter type is already registered
   */
  registerAdapterType(type: string, constructor: AdapterConstructor): void;

  /**
   * Unregister an adapter type
   *
   * @param type Adapter type name
   * @throws {Error} If adapter type is not registered or has active instances
   */
  unregisterAdapterType(type: string): void;

  /**
   * Start all registered adapters
   *
   * @throws {Error} If any adapter fails to start
   */
  startAllAdapters(): Promise<void>;

  /**
   * Stop all registered adapters
   *
   * @throws {Error} If any adapter fails to stop gracefully
   */
  stopAllAdapters(): Promise<void>;

  /**
   * Restart a specific adapter
   *
   * @param id Adapter ID
   * @throws {Error} If adapter is not found or restart fails
   */
  restartAdapter(id: string): Promise<void>;

  /**
   * Remove an adapter instance
   *
   * @param id Adapter ID
   * @throws {Error} If adapter is not found or removal fails
   */
  removeAdapter(id: string): Promise<void>;

  /**
   * Get health status of a specific adapter
   *
   * @param id Adapter ID
   * @returns Adapter health status or null if not found
   */
  getAdapterHealth(id: string): Promise<AdapterHealth | null>;

  /**
   * Get health status of all adapters
   *
   * @returns Map of adapter IDs to their health status
   */
  getAllAdaptersHealth(): Promise<Map<string, AdapterHealth>>;

  /**
   * Update configuration for a specific adapter
   *
   * @param id Adapter ID
   * @param config New adapter configuration
   * @throws {Error} If adapter is not found or update fails
   */
  updateAdapterConfig(id: string, config: any): Promise<void>;

  /**
   * Get list of registered adapter types
   *
   * @returns Array of registered adapter type names
   */
  getRegisteredAdapterTypes(): string[];

  /**
   * Check if an adapter type is registered
   *
   * @param type Adapter type name
   * @returns True if adapter type is registered, false otherwise
   */
  isAdapterTypeRegistered(type: string): boolean;

  /**
   * Get adapter factory statistics
   *
   * @returns Factory statistics and information
   */
  getFactoryStats(): AdapterFactoryStats;
}

/**
 * Adapter factory statistics
 */
export interface AdapterFactoryStats {
  /** Total number of registered adapter types */
  totalAdapterTypes: number;

  /** Total number of adapter instances */
  totalAdapterInstances: number;

  /** Number of adapters by type */
  adaptersByType: Map<string, number>;

  /** Number of adapters by status */
  adaptersByStatus: {
    running: number;
    stopped: number;
    error: number;
    initializing: number;
  };

  /** Factory uptime in milliseconds */
  uptime: number;

  /** Total number of adapter creations */
  totalCreations: number;

  /** Total number of adapter removals */
  totalRemovals: number;

  /** Average adapter startup time in milliseconds */
  avgStartupTime: number;
}