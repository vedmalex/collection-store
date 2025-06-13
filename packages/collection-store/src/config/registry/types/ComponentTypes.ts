import { IConfigurationComponent, ComponentLifecycleState } from '../interfaces/IConfigurationComponent';

/**
 * Component registration information
 */
export interface ComponentRegistration {
  /** The component instance */
  component: IConfigurationComponent;

  /** Current lifecycle state */
  state: ComponentLifecycleState;

  /** Registration timestamp */
  registeredAt: Date;

  /** Last state change timestamp */
  lastStateChange: Date;

  /** Component start timestamp (if started) */
  startedAt?: Date;

  /** Component configuration */
  config?: any;

  /** Component dependencies */
  dependencies: string[];

  /** Components that depend on this component */
  dependents: string[];
}

/**
 * Component dependency graph node
 */
export interface DependencyNode {
  /** Component ID */
  id: string;

  /** Component type */
  type: string;

  /** Direct dependencies */
  dependencies: string[];

  /** Components that depend on this one */
  dependents: string[];

  /** Dependency depth level */
  level: number;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  /** Components in initialization order */
  initializationOrder: string[];

  /** Components in startup order */
  startupOrder: string[];

  /** Components in shutdown order */
  shutdownOrder: string[];

  /** Circular dependencies detected */
  circularDependencies: string[][];

  /** Unresolved dependencies */
  unresolvedDependencies: Map<string, string[]>;
}

/**
 * Component configuration with metadata
 */
export interface ComponentConfig {
  /** Component type */
  type: string;

  /** Component configuration data */
  config: any;

  /** Whether component is enabled */
  enabled: boolean;

  /** Component priority (higher numbers start first) */
  priority: number;

  /** Component dependencies */
  dependencies?: string[];

  /** Component-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Component configurations */
  components: Record<string, ComponentConfig>;

  /** Global registry settings */
  settings: {
    /** Maximum time to wait for component initialization (ms) */
    initializationTimeout: number;

    /** Maximum time to wait for component startup (ms) */
    startupTimeout: number;

    /** Maximum time to wait for component shutdown (ms) */
    shutdownTimeout: number;

    /** Health check interval (ms) */
    healthCheckInterval: number;

    /** Whether to enable automatic health monitoring */
    enableHealthMonitoring: boolean;

    /** Whether to enable dependency validation */
    enableDependencyValidation: boolean;

    /** Maximum dependency depth allowed */
    maxDependencyDepth: number;
  };
}

/**
 * Component factory function type
 */
export type ComponentFactory<T extends IConfigurationComponent> = (config: any) => T | Promise<T>;

/**
 * Component factory registration
 */
export interface ComponentFactoryRegistration<T extends IConfigurationComponent> {
  /** Component type */
  type: string;

  /** Factory function */
  factory: ComponentFactory<T>;

  /** Factory metadata */
  metadata: {
    /** Factory description */
    description: string;

    /** Supported configuration schema version */
    configVersion: string;

    /** Factory capabilities */
    capabilities: string[];
  };
}

/**
 * Component operation result
 */
export interface ComponentOperationResult {
  /** Whether operation was successful */
  success: boolean;

  /** Component ID */
  componentId: string;

  /** Operation type */
  operation: 'register' | 'unregister' | 'initialize' | 'start' | 'stop' | 'updateConfig' | 'cleanup';

  /** Operation duration in milliseconds */
  duration: number;

  /** Error information (if operation failed) */
  error?: {
    /** Error message */
    message: string;

    /** Error code */
    code: string;

    /** Error stack trace */
    stack?: string;

    /** Additional error details */
    details?: Record<string, any>;
  };

  /** Operation result data */
  data?: any;

  /** Operation timestamp */
  timestamp: Date;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Overall operation success */
  success: boolean;

  /** Total number of operations */
  total: number;

  /** Number of successful operations */
  successful: number;

  /** Number of failed operations */
  failed: number;

  /** Individual operation results */
  results: ComponentOperationResult[];

  /** Batch operation duration in milliseconds */
  duration: number;

  /** Batch operation timestamp */
  timestamp: Date;
}

/**
 * Component health check configuration
 */
export interface HealthCheckConfig {
  /** Health check interval in milliseconds */
  interval: number;

  /** Health check timeout in milliseconds */
  timeout: number;

  /** Number of consecutive failures before marking as unhealthy */
  failureThreshold: number;

  /** Number of consecutive successes before marking as healthy */
  successThreshold: number;

  /** Whether to enable health check for this component */
  enabled: boolean;
}

/**
 * Component performance metrics
 */
export interface ComponentMetrics {
  /** Component ID */
  componentId: string;

  /** Metrics collection timestamp */
  timestamp: Date;

  /** Performance metrics */
  performance: {
    /** Average response time in milliseconds */
    avgResponseTime: number;

    /** Maximum response time in milliseconds */
    maxResponseTime: number;

    /** Minimum response time in milliseconds */
    minResponseTime: number;

    /** Total number of operations */
    totalOperations: number;

    /** Operations per second */
    operationsPerSecond: number;
  };

  /** Resource usage metrics */
  resources: {
    /** Memory usage in bytes */
    memoryUsage: number;

    /** CPU usage percentage */
    cpuUsage: number;

    /** Number of active connections/handles */
    activeConnections: number;
  };

  /** Error metrics */
  errors: {
    /** Total number of errors */
    totalErrors: number;

    /** Error rate (errors per operation) */
    errorRate: number;

    /** Recent error messages */
    recentErrors: string[];
  };
}