import { BaseConfigurationComponent } from '../registry/BaseConfigurationComponent';
import { ComponentHealth, ComponentMetadata } from '../registry/interfaces/IConfigurationComponent';
import {
  IAdapterFactoryManager,
  IExternalAdapter,
  AdapterConstructor,
  AdapterConfig,
  AdapterFactoryConfig,
  AdapterHealth,
  AdapterOperationResult,
  AdapterFactoryStats
} from './interfaces/IAdapterFactoryManager';

/**
 * Adapter Factory Manager implementation
 * Manages creation, lifecycle, and monitoring of external adapters
 */
export class AdapterFactoryManager extends BaseConfigurationComponent implements IAdapterFactoryManager {
  public override readonly type = 'adapter-factory';
  public override readonly name = 'Adapter Factory Manager';
  public override readonly version = '1.0.0';

  private adapters: Map<string, IExternalAdapter> = new Map();
  private adapterTypes: Map<string, AdapterConstructor> = new Map();
  private adapterConfig: AdapterFactoryConfig;
  private factoryStartTime: Date = new Date();
  private totalCreations: number = 0;
  private totalRemovals: number = 0;
  private startupTimes: number[] = [];

  constructor(id: string) {
    super(
      id,
      'adapter-factory',
      'Adapter Factory Manager',
      '1.0.0',
      'Manages creation and lifecycle of external adapters',
      [],
      ['adapter-creation', 'adapter-lifecycle', 'health-monitoring', 'configuration-updates']
    );
  }

  /**
   * Initialize the adapter factory with configuration
   */
  protected async doInitialize(config: AdapterFactoryConfig): Promise<void> {
    this.adapterConfig = {
      adapters: config.adapters || [],
      settings: {
        initializationTimeout: 30000,
        startupTimeout: 30000,
        shutdownTimeout: 30000,
        enableHealthMonitoring: true,
        globalHealthCheckInterval: 60000,
        autoRestartFailedAdapters: false,
        maxRestartAttempts: 3,
        ...config.settings
      }
    };

    // Register built-in adapter types
    this.registerBuiltInAdapterTypes();

    // Create adapters from configuration
    await this.createAdaptersFromConfig();

    console.log(`AdapterFactoryManager initialized with ${this.adapters.size} adapters`);
  }

  /**
   * Update adapter factory configuration
   */
  protected async doUpdateConfig(newConfig: AdapterFactoryConfig, oldConfig: AdapterFactoryConfig): Promise<void> {
    this.adapterConfig = { ...this.adapterConfig, ...newConfig };

    try {
      // Update existing adapters if their configs changed
      for (const adapterConfig of this.adapterConfig.adapters) {
        const existingAdapter = this.adapters.get(adapterConfig.id);
        if (existingAdapter) {
          await existingAdapter.updateConfig(adapterConfig.config);
        } else if (adapterConfig.enabled) {
          // Create new adapter if it doesn't exist and is enabled
          await this.createAdapter(adapterConfig.type, adapterConfig);
        }
      }

      // Remove adapters that are no longer in config
      const configAdapterIds = new Set(this.adapterConfig.adapters.map(a => a.id));
      for (const [adapterId] of this.adapters) {
        if (!configAdapterIds.has(adapterId)) {
          await this.removeAdapter(adapterId);
        }
      }

      console.log('AdapterFactoryManager configuration updated');
    } catch (error) {
      // Rollback configuration on error
      this.adapterConfig = oldConfig;
      throw new Error(`Failed to update adapter factory configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Start the adapter factory and all adapters
   */
  protected async doStart(): Promise<void> {
    await this.startAllAdapters();
    console.log(`AdapterFactoryManager started with ${this.adapters.size} adapters`);
  }

  /**
   * Stop the adapter factory and all adapters
   */
  protected async doStop(): Promise<void> {
    await this.stopAllAdapters();
    console.log('AdapterFactoryManager stopped');
  }

  /**
   * Get adapter factory health status
   */
  protected async doGetHealth(): Promise<Partial<ComponentHealth>> {
    const adaptersHealth = await this.getAllAdaptersHealth();
    const healthyCount = Array.from(adaptersHealth.values()).filter(h => h.status === 'healthy').length;
    const totalCount = adaptersHealth.size;

    let status: ComponentHealth['status'] = 'healthy';
    if (healthyCount === 0 && totalCount > 0) {
      status = 'error';
    } else if (healthyCount < totalCount) {
      status = 'warning';
    }

    return {
      status,
      details: {
        metrics: {
          totalAdapters: totalCount,
          healthyAdapters: healthyCount,
          unhealthyAdapters: totalCount - healthyCount,
          avgStartupTime: this.getAverageStartupTime(),
          totalCreations: this.totalCreations,
          totalRemovals: this.totalRemovals
        }
      }
    };
  }

  /**
   * Cleanup adapter factory resources
   */
  protected async doCleanup(): Promise<void> {
    await this.stopAllAdapters();

    // Cleanup all adapters
    for (const [adapterId, adapter] of this.adapters) {
      try {
        await adapter.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup adapter ${adapterId}: ${(error as Error).message}`);
      }
    }

    this.adapters.clear();
    this.adapterTypes.clear();
    console.log('AdapterFactoryManager cleanup completed');
  }

  /**
   * Override updateConfig to use the correct signature
   */
  override async updateConfig(config: AdapterFactoryConfig): Promise<void> {
    await super.updateConfig(config);
  }

  /**
   * Override getHealth to use the correct signature
   */
  override async getHealth(): Promise<ComponentHealth> {
    return await super.getHealth();
  }

  /**
   * Override getMetadata to use the correct signature
   */
  override getMetadata(): ComponentMetadata {
    return super.getMetadata();
  }

  // IAdapterFactoryManager implementation

  /**
   * Create a new adapter instance
   */
  async createAdapter(type: string, config: AdapterConfig): Promise<IExternalAdapter> {
    const startTime = Date.now();

    try {
      const AdapterClass = this.adapterTypes.get(type);
      if (!AdapterClass) {
        throw new Error(`Adapter type '${type}' is not registered`);
      }

      if (this.adapters.has(config.id)) {
        throw new Error(`Adapter with ID '${config.id}' already exists`);
      }

      // Create adapter instance
      const adapter = new AdapterClass(config.id, config.config);

      // Initialize adapter
      await adapter.initialize(config.config);

      // Store adapter
      this.adapters.set(config.id, adapter);
      this.totalCreations++;

      const duration = Date.now() - startTime;
      this.startupTimes.push(duration);

      console.log(`Adapter '${config.id}' of type '${type}' created successfully in ${duration}ms`);
      return adapter;

    } catch (error) {
      const duration = Date.now() - startTime;
      throw new Error(`Failed to create adapter '${config.id}': ${(error as Error).message}`);
    }
  }

  /**
   * Get an adapter by its ID
   */
  getAdapter(id: string): IExternalAdapter | null {
    return this.adapters.get(id) || null;
  }

  /**
   * Get all adapters of a specific type
   */
  getAdaptersByType(type: string): IExternalAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => adapter.type === type);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): IExternalAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Register a new adapter type
   */
  registerAdapterType(type: string, constructor: AdapterConstructor): void {
    if (this.adapterTypes.has(type)) {
      throw new Error(`Adapter type '${type}' is already registered`);
    }

    this.adapterTypes.set(type, constructor);
    console.log(`Adapter type '${type}' registered successfully`);
  }

  /**
   * Unregister an adapter type
   */
  unregisterAdapterType(type: string): void {
    if (!this.adapterTypes.has(type)) {
      throw new Error(`Adapter type '${type}' is not registered`);
    }

    // Check if there are active instances of this type
    const activeInstances = this.getAdaptersByType(type);
    if (activeInstances.length > 0) {
      throw new Error(`Cannot unregister adapter type '${type}': ${activeInstances.length} active instances exist`);
    }

    this.adapterTypes.delete(type);
    console.log(`Adapter type '${type}' unregistered successfully`);
  }

  /**
   * Start all registered adapters
   */
  async startAllAdapters(): Promise<void> {
    const startTime = Date.now();
    const results: AdapterOperationResult[] = [];

    // Sort adapters by priority (higher priority starts first)
    const sortedAdapters = Array.from(this.adapters.entries())
      .map(([id, adapter]) => {
        const config = this.adapterConfig.adapters.find(a => a.id === id);
        return { id, adapter, priority: config?.priority || 0 };
      })
      .sort((a, b) => b.priority - a.priority);

    for (const { id, adapter } of sortedAdapters) {
      try {
        if (!adapter.isRunning()) {
          await adapter.start();
          results.push({
            success: true,
            adapterId: id,
            operation: 'start',
            duration: Date.now() - startTime,
            timestamp: new Date()
          });
        }
      } catch (error) {
        results.push({
          success: false,
          adapterId: id,
          operation: 'start',
          duration: Date.now() - startTime,
          error: {
            message: (error as Error).message,
            code: 'START_FAILED'
          },
          timestamp: new Date()
        });

        if (!this.adapterConfig.settings.autoRestartFailedAdapters) {
          throw new Error(`Failed to start adapter '${id}': ${(error as Error).message}`);
        }
      }
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0 && !this.adapterConfig.settings.autoRestartFailedAdapters) {
      const failedIds = failed.map(r => r.adapterId).join(', ');
      throw new Error(`Failed to start adapters: ${failedIds}`);
    }

    const duration = Date.now() - startTime;
    console.log(`All adapters started successfully in ${duration}ms`);
  }

  /**
   * Stop all registered adapters
   */
  async stopAllAdapters(): Promise<void> {
    const startTime = Date.now();
    const results: AdapterOperationResult[] = [];

    // Stop adapters in reverse priority order
    const sortedAdapters = Array.from(this.adapters.entries())
      .map(([id, adapter]) => {
        const config = this.adapterConfig.adapters.find(a => a.id === id);
        return { id, adapter, priority: config?.priority || 0 };
      })
      .sort((a, b) => a.priority - b.priority);

    for (const { id, adapter } of sortedAdapters) {
      try {
        if (adapter.isRunning()) {
          await adapter.stop();
        }
        results.push({
          success: true,
          adapterId: id,
          operation: 'stop',
          duration: Date.now() - startTime,
          timestamp: new Date()
        });
      } catch (error) {
        results.push({
          success: false,
          adapterId: id,
          operation: 'stop',
          duration: Date.now() - startTime,
          error: {
            message: (error as Error).message,
            code: 'STOP_FAILED'
          },
          timestamp: new Date()
        });
        console.warn(`Failed to stop adapter '${id}': ${(error as Error).message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`All adapters stopped in ${duration}ms`);
  }

  /**
   * Restart a specific adapter
   */
  async restartAdapter(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter '${id}' not found`);
    }

    try {
      if (adapter.isRunning()) {
        await adapter.stop();
      }
      await adapter.start();
      console.log(`Adapter '${id}' restarted successfully`);
    } catch (error) {
      throw new Error(`Failed to restart adapter '${id}': ${(error as Error).message}`);
    }
  }

  /**
   * Remove an adapter instance
   */
  async removeAdapter(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter '${id}' not found`);
    }

    try {
      if (adapter.isRunning()) {
        await adapter.stop();
      }
      await adapter.cleanup();
      this.adapters.delete(id);
      this.totalRemovals++;
      console.log(`Adapter '${id}' removed successfully`);
    } catch (error) {
      throw new Error(`Failed to remove adapter '${id}': ${(error as Error).message}`);
    }
  }

  /**
   * Get health status of a specific adapter
   */
  async getAdapterHealth(id: string): Promise<AdapterHealth | null> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return null;
    }

    try {
      const health = await adapter.getHealth();
      return health as AdapterHealth;
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        details: {
          error: (error as Error).message
        },
        uptime: 0
      };
    }
  }

  /**
   * Get health status of all adapters
   */
  async getAllAdaptersHealth(): Promise<Map<string, AdapterHealth>> {
    const healthMap = new Map<string, AdapterHealth>();

    for (const [id, adapter] of this.adapters) {
      try {
        const health = await adapter.getHealth();
        healthMap.set(id, health as AdapterHealth);
      } catch (error) {
        healthMap.set(id, {
          status: 'error',
          lastCheck: new Date(),
          details: {
            error: (error as Error).message
          },
          uptime: 0
        });
      }
    }

    return healthMap;
  }

  /**
   * Update configuration for a specific adapter
   */
  async updateAdapterConfig(id: string, config: any): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Adapter '${id}' not found`);
    }

    try {
      await adapter.updateConfig(config);
      console.log(`Adapter '${id}' configuration updated successfully`);
    } catch (error) {
      throw new Error(`Failed to update adapter '${id}' configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Get list of registered adapter types
   */
  getRegisteredAdapterTypes(): string[] {
    return Array.from(this.adapterTypes.keys());
  }

  /**
   * Check if an adapter type is registered
   */
  isAdapterTypeRegistered(type: string): boolean {
    return this.adapterTypes.has(type);
  }

  /**
   * Get adapter factory statistics
   */
  getFactoryStats(): AdapterFactoryStats {
    const adaptersByType = new Map<string, number>();
    const adaptersByStatus = {
      running: 0,
      stopped: 0,
      error: 0,
      initializing: 0
    };

    for (const adapter of this.adapters.values()) {
      // Count by type
      const count = adaptersByType.get(adapter.type) || 0;
      adaptersByType.set(adapter.type, count + 1);

      // Count by status (simplified)
      if (adapter.isRunning()) {
        adaptersByStatus.running++;
      } else {
        adaptersByStatus.stopped++;
      }
    }

    return {
      totalAdapterTypes: this.adapterTypes.size,
      totalAdapterInstances: this.adapters.size,
      adaptersByType,
      adaptersByStatus,
      uptime: Date.now() - this.factoryStartTime.getTime(),
      totalCreations: this.totalCreations,
      totalRemovals: this.totalRemovals,
      avgStartupTime: this.getAverageStartupTime()
    };
  }

  // Private helper methods

  /**
   * Register built-in adapter types
   */
  private registerBuiltInAdapterTypes(): void {
    // Note: These would be actual adapter implementations
    // For now, we'll register placeholder types
    console.log('Built-in adapter types would be registered here');
    // this.registerAdapterType('mongodb', MongoDBAdapter);
    // this.registerAdapterType('googlesheets', GoogleSheetsAdapter);
    // this.registerAdapterType('markdown', MarkdownAdapter);
  }

  /**
   * Create adapters from configuration
   */
  private async createAdaptersFromConfig(): Promise<void> {
    for (const adapterConfig of this.adapterConfig.adapters) {
      if (adapterConfig.enabled) {
        try {
          await this.createAdapter(adapterConfig.type, adapterConfig);
        } catch (error) {
          console.error(`Failed to create adapter '${adapterConfig.id}': ${(error as Error).message}`);
          if (!this.adapterConfig.settings.autoRestartFailedAdapters) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Get average startup time
   */
  private getAverageStartupTime(): number {
    if (this.startupTimes.length === 0) {
      return 0;
    }
    return this.startupTimes.reduce((sum, time) => sum + time, 0) / this.startupTimes.length;
  }
}