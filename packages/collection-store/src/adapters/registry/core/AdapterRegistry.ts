// AdapterRegistry - centralized management of all external adapters
// Based on creative phase decisions: Registry pattern for adapter management

import { EventEmitter } from 'events';
import { IExternalAdapter } from '../../base/interfaces/IExternalAdapter';
import { AdapterConfig, AdapterType, AdapterState, AdapterEvent } from '../../base/types/AdapterTypes';

export interface AdapterRegistryConfig {
  maxAdapters: number;
  healthCheckInterval: number;
  autoStart: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface AdapterInfo {
  adapter: IExternalAdapter;
  registeredAt: Date;
  lastHealthCheck: Date;
  failureCount: number;
}

export class AdapterRegistry extends EventEmitter {
  private adapters: Map<string, AdapterInfo> = new Map();
  private adaptersByType: Map<AdapterType, Set<string>> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private config: AdapterRegistryConfig) {
    super();
    this.setupHealthMonitoring();
  }

  // Registration methods
  async register(adapter: IExternalAdapter): Promise<void> {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter with id '${adapter.id}' is already registered`);
    }

    if (this.adapters.size >= this.config.maxAdapters) {
      throw new Error(`Maximum number of adapters (${this.config.maxAdapters}) reached`);
    }

    // Validate adapter configuration
    if (!await adapter.validateConfig(adapter.config)) {
      throw new Error(`Invalid configuration for adapter '${adapter.id}'`);
    }

    // Initialize adapter
    await adapter.initialize();

    // Register adapter
    const adapterInfo: AdapterInfo = {
      adapter,
      registeredAt: new Date(),
      lastHealthCheck: new Date(),
      failureCount: 0
    };

    this.adapters.set(adapter.id, adapterInfo);

    // Add to type index
    const type = adapter.config.type;
    if (!this.adaptersByType.has(type)) {
      this.adaptersByType.set(type, new Set());
    }
    this.adaptersByType.get(type)!.add(adapter.id);

    // Setup event forwarding
    this.setupAdapterEventForwarding(adapter);

    // Auto-start if configured
    if (this.config.autoStart && adapter.config.lifecycle.autoStart) {
      await this.start(adapter.id);
    }

    this.emit('adapter-registered', { adapterId: adapter.id, type });
  }

  async unregister(adapterId: string): Promise<void> {
    const adapterInfo = this.adapters.get(adapterId);
    if (!adapterInfo) {
      throw new Error(`Adapter '${adapterId}' is not registered`);
    }

    const { adapter } = adapterInfo;

    // Stop adapter if running
    if (adapter.state === AdapterState.ACTIVE) {
      await adapter.stop();
    }

    // Remove from type index
    const type = adapter.config.type;
    const typeSet = this.adaptersByType.get(type);
    if (typeSet) {
      typeSet.delete(adapterId);
      if (typeSet.size === 0) {
        this.adaptersByType.delete(type);
      }
    }

    // Remove from registry
    this.adapters.delete(adapterId);

    this.emit('adapter-unregistered', { adapterId, type });
  }

  // Lifecycle management
  async start(adapterId: string): Promise<void> {
    const adapterInfo = this.adapters.get(adapterId);
    if (!adapterInfo) {
      throw new Error(`Adapter '${adapterId}' is not registered`);
    }

    try {
      await adapterInfo.adapter.start();
      adapterInfo.failureCount = 0;
      this.emit('adapter-started', { adapterId });
    } catch (error) {
      adapterInfo.failureCount++;
      this.emit('adapter-start-failed', { adapterId, error: (error as Error).message });
      throw error;
    }
  }

  async stop(adapterId: string): Promise<void> {
    const adapterInfo = this.adapters.get(adapterId);
    if (!adapterInfo) {
      throw new Error(`Adapter '${adapterId}' is not registered`);
    }

    try {
      await adapterInfo.adapter.stop();
      this.emit('adapter-stopped', { adapterId });
    } catch (error) {
      this.emit('adapter-stop-failed', { adapterId, error: (error as Error).message });
      throw error;
    }
  }

  async restart(adapterId: string): Promise<void> {
    await this.stop(adapterId);
    await this.start(adapterId);
  }

  async startAll(): Promise<void> {
    const startPromises = Array.from(this.adapters.keys()).map(id =>
      this.start(id).catch(error => ({ id, error }))
    );

    const results = await Promise.all(startPromises);
    const failures = results.filter(result => result && 'error' in result);

    if (failures.length > 0) {
      this.emit('bulk-start-completed', {
        total: this.adapters.size,
        failures: failures.length,
        failedAdapters: failures
      });
    }
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.adapters.keys()).map(id =>
      this.stop(id).catch(error => ({ id, error }))
    );

    await Promise.all(stopPromises);
    this.emit('bulk-stop-completed', { total: this.adapters.size });
  }

  // Query methods
  getAdapter(adapterId: string): IExternalAdapter | undefined {
    return this.adapters.get(adapterId)?.adapter;
  }

  getAdaptersByType(type: AdapterType): IExternalAdapter[] {
    const adapterIds = this.adaptersByType.get(type);
    if (!adapterIds) {
      return [];
    }

    return Array.from(adapterIds)
      .map(id => this.adapters.get(id)?.adapter)
      .filter((adapter): adapter is IExternalAdapter => adapter !== undefined);
  }

  getAllAdapters(): IExternalAdapter[] {
    return Array.from(this.adapters.values()).map(info => info.adapter);
  }

  getActiveAdapters(): IExternalAdapter[] {
    return this.getAllAdapters().filter(adapter => adapter.state === AdapterState.ACTIVE);
  }

  getAdapterInfo(adapterId: string): AdapterInfo | undefined {
    return this.adapters.get(adapterId);
  }

  // Health monitoring
  async checkHealth(adapterId?: string): Promise<Map<string, any>> {
    const healthResults = new Map<string, any>();

    if (adapterId) {
      const adapter = this.getAdapter(adapterId);
      if (adapter) {
        try {
          const health = await adapter.getHealth();
          healthResults.set(adapterId, health);

          const adapterInfo = this.adapters.get(adapterId)!;
          adapterInfo.lastHealthCheck = new Date();

          if (health.status === 'unhealthy') {
            adapterInfo.failureCount++;
            this.handleUnhealthyAdapter(adapterId, adapterInfo);
          } else {
            adapterInfo.failureCount = 0;
          }
        } catch (error) {
          healthResults.set(adapterId, { status: 'error', error: (error as Error).message });
        }
      }
    } else {
      // Check all adapters
      for (const [id, info] of this.adapters) {
        try {
          const health = await info.adapter.getHealth();
          healthResults.set(id, health);

          info.lastHealthCheck = new Date();

          if (health.status === 'unhealthy') {
            info.failureCount++;
            this.handleUnhealthyAdapter(id, info);
          } else {
            info.failureCount = 0;
          }
        } catch (error) {
          healthResults.set(id, { status: 'error', error: (error as Error).message });
          info.failureCount++;
        }
      }
    }

    return healthResults;
  }

  // Configuration management
  async updateAdapterConfig(adapterId: string, config: Partial<AdapterConfig>): Promise<void> {
    const adapter = this.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${adapterId}' is not registered`);
    }

    await adapter.updateConfig(config);
    this.emit('adapter-config-updated', { adapterId, config });
  }

  // Statistics
  getRegistryStats() {
    const stats = {
      totalAdapters: this.adapters.size,
      activeAdapters: 0,
      inactiveAdapters: 0,
      errorAdapters: 0,
      adaptersByType: {} as Record<string, number>
    };

    for (const info of this.adapters.values()) {
      const state = info.adapter.state;
      switch (state) {
        case AdapterState.ACTIVE:
          stats.activeAdapters++;
          break;
        case AdapterState.INACTIVE:
          stats.inactiveAdapters++;
          break;
        case AdapterState.ERROR:
          stats.errorAdapters++;
          break;
      }

      const type = info.adapter.config.type;
      stats.adaptersByType[type] = (stats.adaptersByType[type] || 0) + 1;
    }

    return stats;
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Stop all adapters
    await this.stopAll();

    // Clear registry
    this.adapters.clear();
    this.adaptersByType.clear();

    this.emit('registry-shutdown');
  }

  // Private methods
  private setupHealthMonitoring(): void {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.checkHealth();
        } catch (error) {
          this.emit('health-check-error', { error: (error as Error).message });
        }
      }, this.config.healthCheckInterval);
    }
  }

  private setupAdapterEventForwarding(adapter: IExternalAdapter): void {
    const forwardEvent = (event: AdapterEvent) => {
      this.emit('adapter-event', event);
    };

    adapter.on('STATE_CHANGE', forwardEvent);
    adapter.on('ERROR', forwardEvent);
    adapter.on('OPERATION', forwardEvent);
    adapter.on('HEALTH_CHECK', forwardEvent);
  }

  private async handleUnhealthyAdapter(adapterId: string, adapterInfo: AdapterInfo): Promise<void> {
    this.emit('adapter-unhealthy', {
      adapterId,
      failureCount: adapterInfo.failureCount
    });

    // Auto-restart if failure count exceeds threshold
    if (adapterInfo.failureCount >= this.config.retryAttempts) {
      try {
        await this.restart(adapterId);
        this.emit('adapter-auto-restarted', { adapterId });
      } catch (error) {
        this.emit('adapter-auto-restart-failed', {
          adapterId,
          error: (error as Error).message
        });
      }
    }
  }
}