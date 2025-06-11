import { IConfigurationComponent, ComponentHealth, ComponentLifecycleState } from './IConfigurationComponent';

/**
 * Registry for managing configuration components.
 * Provides centralized component lifecycle management, health monitoring, and dependency resolution.
 */
export interface IComponentRegistry {
  /**
   * Register a configuration component with the registry.
   *
   * @param component Component to register
   * @throws {Error} If component with same ID already exists or registration fails
   */
  register<T extends IConfigurationComponent>(component: T): Promise<void>;

  /**
   * Unregister a component from the registry.
   * Stops the component and cleans up resources.
   *
   * @param id Component ID to unregister
   * @throws {Error} If component is not found or unregistration fails
   */
  unregister(id: string): Promise<void>;

  /**
   * Get a component by its ID.
   *
   * @param id Component ID
   * @returns Component instance or null if not found
   */
  get<T extends IConfigurationComponent>(id: string): T | null;

  /**
   * Get all components of a specific type.
   *
   * @param type Component type
   * @returns Array of components of the specified type
   */
  getByType<T extends IConfigurationComponent>(type: string): T[];

  /**
   * Get all registered components.
   *
   * @returns Array of all registered components
   */
  getAll(): IConfigurationComponent[];

  /**
   * Check if a component is registered.
   *
   * @param id Component ID
   * @returns True if component is registered, false otherwise
   */
  has(id: string): boolean;

  /**
   * Initialize all registered components.
   * Resolves dependencies and initializes components in correct order.
   *
   * @param config Global configuration object
   * @throws {Error} If initialization fails for any component
   */
  initializeAll(config: any): Promise<void>;

  /**
   * Start all registered components.
   * Starts components in dependency order.
   *
   * @throws {Error} If startup fails for any component
   */
  startAll(): Promise<void>;

  /**
   * Stop all registered components.
   * Stops components in reverse dependency order.
   *
   * @throws {Error} If shutdown fails for any component
   */
  stopAll(): Promise<void>;

  /**
   * Update configuration for all components.
   *
   * @param config New configuration object
   * @throws {Error} If configuration update fails for any component
   */
  updateAllConfigs(config: any): Promise<void>;

  /**
   * Update configuration for a specific component.
   *
   * @param id Component ID
   * @param config New configuration for the component
   * @throws {Error} If component is not found or update fails
   */
  updateComponentConfig(id: string, config: any): Promise<void>;

  /**
   * Get health status of all components.
   *
   * @returns Map of component IDs to their health status
   */
  getAllHealth(): Promise<Map<string, ComponentHealth>>;

  /**
   * Get health status of a specific component.
   *
   * @param id Component ID
   * @returns Component health status or null if not found
   */
  getComponentHealth(id: string): Promise<ComponentHealth | null>;

  /**
   * Get the current lifecycle state of a component.
   *
   * @param id Component ID
   * @returns Component lifecycle state or null if not found
   */
  getComponentState(id: string): ComponentLifecycleState | null;

  /**
   * Get registry statistics and information.
   *
   * @returns Registry statistics
   */
  getRegistryStats(): RegistryStats;

  /**
   * Cleanup all components and shutdown the registry.
   *
   * @throws {Error} If cleanup fails
   */
  cleanup(): Promise<void>;

  /**
   * Register a callback for component lifecycle events.
   *
   * @param event Event type to listen for
   * @param callback Callback function
   */
  on(event: RegistryEvent, callback: RegistryEventCallback): void;

  /**
   * Unregister a callback for component lifecycle events.
   *
   * @param event Event type
   * @param callback Callback function to remove
   */
  off(event: RegistryEvent, callback: RegistryEventCallback): void;
}

/**
 * Registry statistics and information
 */
export interface RegistryStats {
  /** Total number of registered components */
  totalComponents: number;

  /** Number of components by type */
  componentsByType: Map<string, number>;

  /** Number of components by state */
  componentsByState: Map<ComponentLifecycleState, number>;

  /** Number of healthy/unhealthy components */
  healthSummary: {
    healthy: number;
    warning: number;
    error: number;
    unknown: number;
  };

  /** Registry uptime in milliseconds */
  uptime: number;

  /** Total number of component registrations */
  totalRegistrations: number;

  /** Total number of component unregistrations */
  totalUnregistrations: number;
}

/**
 * Registry events
 */
export type RegistryEvent =
  | 'componentRegistered'
  | 'componentUnregistered'
  | 'componentStateChanged'
  | 'componentHealthChanged'
  | 'allComponentsInitialized'
  | 'allComponentsStarted'
  | 'allComponentsStopped'
  | 'registryError';

/**
 * Registry event callback function
 */
export type RegistryEventCallback = (data: RegistryEventData) => void;

/**
 * Data passed to registry event callbacks
 */
export interface RegistryEventData {
  /** Event type */
  event: RegistryEvent;

  /** Component ID (if applicable) */
  componentId?: string;

  /** Component type (if applicable) */
  componentType?: string;

  /** New state (for state change events) */
  newState?: ComponentLifecycleState;

  /** Previous state (for state change events) */
  previousState?: ComponentLifecycleState;

  /** Health status (for health change events) */
  health?: ComponentHealth;

  /** Error information (for error events) */
  error?: Error;

  /** Timestamp of the event */
  timestamp: Date;
}