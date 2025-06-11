import {
  IConfigurationComponent,
  ComponentHealth,
  ComponentMetadata,
  ComponentLifecycleState,
  ComponentStatus
} from './interfaces/IConfigurationComponent';

/**
 * Base abstract class for configuration components.
 * Provides common functionality and lifecycle management.
 */
export abstract class BaseConfigurationComponent implements IConfigurationComponent {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public readonly version: string;

  protected state: ComponentLifecycleState = 'uninitialized';
  protected startTime?: Date;
  protected config: any;
  protected metadata: ComponentMetadata;

  constructor(
    id: string,
    type: string,
    name: string,
    version: string,
    description: string,
    dependencies: string[] = [],
    capabilities: string[] = []
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.version = version;

    this.metadata = {
      description,
      dependencies,
      configVersion: '1.0.0',
      capabilities,
      lastConfigUpdate: new Date(),
      statistics: {
        configUpdates: 0,
        restarts: 0,
        totalRuntime: 0
      }
    };
  }

  /**
   * Initialize the component with the provided configuration.
   * Subclasses should override doInitialize() for custom initialization logic.
   */
  async initialize(config: any): Promise<void> {
    if (this.state !== 'uninitialized') {
      throw new Error(`Component ${this.id} is already initialized`);
    }

    try {
      this.state = 'initializing';
      this.config = config;

      await this.doInitialize(config);

      this.state = 'initialized';
      console.log(`Component ${this.id} initialized successfully`);
    } catch (error) {
      this.state = 'error';
      throw new Error(`Failed to initialize component ${this.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Update the component configuration at runtime.
   * Subclasses should override doUpdateConfig() for custom update logic.
   */
  async updateConfig(config: any): Promise<void> {
    try {
      const oldConfig = this.config;
      this.config = config;

      await this.doUpdateConfig(config, oldConfig);

      this.metadata.lastConfigUpdate = new Date();
      this.metadata.statistics.configUpdates++;

      console.log(`Component ${this.id} configuration updated successfully`);
    } catch (error) {
      throw new Error(`Failed to update configuration for component ${this.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Start the component and begin its operations.
   * Subclasses should override doStart() for custom startup logic.
   */
  async start(): Promise<void> {
    if (this.state !== 'initialized') {
      throw new Error(`Component ${this.id} must be initialized before starting`);
    }

    try {
      this.state = 'starting';

      await this.doStart();

      this.state = 'running';
      this.startTime = new Date();

      console.log(`Component ${this.id} started successfully`);
    } catch (error) {
      this.state = 'error';
      throw new Error(`Failed to start component ${this.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the component and cease its operations.
   * Subclasses should override doStop() for custom shutdown logic.
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      console.log(`Component ${this.id} is not running, skipping stop`);
      return;
    }

    try {
      this.state = 'stopping';

      await this.doStop();

      this.state = 'stopped';

      // Update runtime statistics
      if (this.startTime) {
        const runtime = Date.now() - this.startTime.getTime();
        this.metadata.statistics.totalRuntime += runtime;
        this.startTime = undefined;
      }

      console.log(`Component ${this.id} stopped successfully`);
    } catch (error) {
      this.state = 'error';
      throw new Error(`Failed to stop component ${this.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Get the current health status of this component.
   * Subclasses can override doGetHealth() for custom health checks.
   */
  async getHealth(): Promise<ComponentHealth> {
    try {
      const customHealth = await this.doGetHealth();

      // Use custom status if provided, otherwise use default based on state
      const status = customHealth.status ||
        (this.state === 'running' ? ComponentStatus.HEALTHY : ComponentStatus.UNKNOWN);

      return {
        status,
        lastCheck: new Date(),
        details: {
          responseTime: 0,
          ...customHealth.details
        },
        uptime: this.getUptime()
      };
    } catch (error) {
      return {
        status: ComponentStatus.ERROR,
        lastCheck: new Date(),
        details: {
          error: (error as Error).message
        },
        uptime: this.getUptime()
      };
    }
  }

  /**
   * Cleanup resources and prepare for shutdown.
   * Subclasses should override doCleanup() for custom cleanup logic.
   */
  async cleanup(): Promise<void> {
    try {
      if (this.state === 'running') {
        await this.stop();
      }

      await this.doCleanup();

      this.state = 'cleanup';
      console.log(`Component ${this.id} cleanup completed`);
    } catch (error) {
      console.error(`Failed to cleanup component ${this.id}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check if the component is currently running.
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  /**
   * Get component-specific metadata and status information.
   */
  getMetadata(): ComponentMetadata {
    return { ...this.metadata };
  }

  /**
   * Get the current lifecycle state of the component.
   */
  getState(): ComponentLifecycleState {
    return this.state;
  }

  /**
   * Get component uptime in milliseconds.
   */
  protected getUptime(): number {
    if (!this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime.getTime();
  }

  // Abstract methods that subclasses must implement

  /**
   * Custom initialization logic for the component.
   * Called during the initialize() method.
   */
  protected abstract doInitialize(config: any): Promise<void>;

  /**
   * Custom configuration update logic for the component.
   * Called during the updateConfig() method.
   */
  protected abstract doUpdateConfig(newConfig: any, oldConfig: any): Promise<void>;

  /**
   * Custom startup logic for the component.
   * Called during the start() method.
   */
  protected abstract doStart(): Promise<void>;

  /**
   * Custom shutdown logic for the component.
   * Called during the stop() method.
   */
  protected abstract doStop(): Promise<void>;

  /**
   * Custom health check logic for the component.
   * Called during the getHealth() method.
   */
  protected abstract doGetHealth(): Promise<Partial<ComponentHealth>>;

  /**
   * Custom cleanup logic for the component.
   * Called during the cleanup() method.
   */
  protected abstract doCleanup(): Promise<void>;
}