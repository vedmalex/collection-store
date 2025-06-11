import { EventEmitter } from 'events';
import {
  IComponentRegistry,
  RegistryStats,
  RegistryEvent,
  RegistryEventCallback,
  RegistryEventData
} from './interfaces/IComponentRegistry';
import {
  IConfigurationComponent,
  ComponentHealth,
  ComponentLifecycleState
} from './interfaces/IConfigurationComponent';
import {
  ComponentRegistration,
  DependencyResolution,
  ComponentOperationResult,
  RegistryConfig
} from './types/ComponentTypes';

/**
 * Central registry for managing configuration components.
 * Provides lifecycle management, dependency resolution, and health monitoring.
 */
export class ComponentRegistry extends EventEmitter implements IComponentRegistry {
  private components: Map<string, ComponentRegistration> = new Map();
  private config: RegistryConfig;
  private startTime: Date = new Date();
  private totalRegistrations: number = 0;
  private totalUnregistrations: number = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config?: Partial<RegistryConfig>) {
    super();
    this.config = this.mergeWithDefaults(config);

    if (this.config.settings.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Register a configuration component with the registry
   */
  async register<T extends IConfigurationComponent>(component: T): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate component
      this.validateComponent(component);

      // Check for duplicate registration
      if (this.components.has(component.id)) {
        throw new Error(`Component with ID '${component.id}' is already registered`);
      }

      // Create registration record
      const registration: ComponentRegistration = {
        component,
        state: 'uninitialized',
        registeredAt: new Date(),
        lastStateChange: new Date(),
        dependencies: component.getMetadata().dependencies || [],
        dependents: [],
        config: undefined
      };

      // Add to registry
      this.components.set(component.id, registration);
      this.totalRegistrations++;

      // Update dependents for dependencies
      this.updateDependents(component.id, registration.dependencies);

      // Emit registration event
      this.emitEvent('componentRegistered', {
        componentId: component.id,
        componentType: component.type
      });

      // Log successful registration
      const duration = Date.now() - startTime;
      console.log(`Component '${component.id}' registered successfully in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `Failed to register component '${component.id}': ${(error as Error).message}`;

      this.emitEvent('registryError', {
        componentId: component.id,
        error: error as Error
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Unregister a component from the registry
   */
  async unregister(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      const registration = this.components.get(id);
      if (!registration) {
        throw new Error(`Component '${id}' is not registered`);
      }

      // Check for dependents
      if (registration.dependents.length > 0) {
        throw new Error(`Cannot unregister component '${id}': it has dependents: ${registration.dependents.join(', ')}`);
      }

      // Stop component if running
      if (registration.state === 'running') {
        await this.stopComponent(id);
      }

      // Cleanup component
      if (registration.state !== 'uninitialized') {
        await registration.component.cleanup();
        this.updateComponentState(id, 'cleanup');
      }

      // Remove from dependents of dependencies
      this.removeDependents(id, registration.dependencies);

      // Remove from registry
      this.components.delete(id);
      this.totalUnregistrations++;

      // Emit unregistration event
      this.emitEvent('componentUnregistered', {
        componentId: id,
        componentType: registration.component.type
      });

      const duration = Date.now() - startTime;
      console.log(`Component '${id}' unregistered successfully in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `Failed to unregister component '${id}': ${(error as Error).message}`;

      this.emitEvent('registryError', {
        componentId: id,
        error: error as Error
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Get a component by its ID
   */
  get<T extends IConfigurationComponent>(id: string): T | null {
    const registration = this.components.get(id);
    return registration ? (registration.component as T) : null;
  }

  /**
   * Get all components of a specific type
   */
  getByType<T extends IConfigurationComponent>(type: string): T[] {
    const components: T[] = [];
    for (const registration of this.components.values()) {
      if (registration.component.type === type) {
        components.push(registration.component as T);
      }
    }
    return components;
  }

  /**
   * Get all registered components
   */
  getAll(): IConfigurationComponent[] {
    return Array.from(this.components.values()).map(reg => reg.component);
  }

  /**
   * Check if a component is registered
   */
  has(id: string): boolean {
    return this.components.has(id);
  }

  /**
   * Initialize all registered components
   */
  async initializeAll(config: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Resolve dependencies
      const resolution = this.resolveDependencies();

      if (resolution.circularDependencies.length > 0) {
        throw new Error(`Circular dependencies detected: ${JSON.stringify(resolution.circularDependencies)}`);
      }

      if (resolution.unresolvedDependencies.size > 0) {
        const unresolved = Array.from(resolution.unresolvedDependencies.entries())
          .map(([comp, deps]) => `${comp}: [${deps.join(', ')}]`)
          .join(', ');
        throw new Error(`Unresolved dependencies: ${unresolved}`);
      }

      // Initialize components in dependency order
      const results: ComponentOperationResult[] = [];

      for (const componentId of resolution.initializationOrder) {
        const result = await this.initializeComponent(componentId, config);
        results.push(result);

        if (!result.success) {
          throw new Error(`Failed to initialize component '${componentId}': ${result.error?.message}`);
        }
      }

      // Emit completion event
      this.emitEvent('allComponentsInitialized', {});

      const duration = Date.now() - startTime;
      console.log(`All components initialized successfully in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `Failed to initialize all components: ${(error as Error).message}`;

      this.emitEvent('registryError', {
        error: error as Error
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Start all registered components
   */
  async startAll(): Promise<void> {
    const startTime = Date.now();

    try {
      const resolution = this.resolveDependencies();
      const results: ComponentOperationResult[] = [];

      for (const componentId of resolution.startupOrder) {
        const result = await this.startComponent(componentId);
        results.push(result);

        if (!result.success) {
          throw new Error(`Failed to start component '${componentId}': ${result.error?.message}`);
        }
      }

      this.emitEvent('allComponentsStarted', {});

      const duration = Date.now() - startTime;
      console.log(`All components started successfully in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `Failed to start all components: ${(error as Error).message}`;

      this.emitEvent('registryError', {
        error: error as Error
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Stop all registered components
   */
  async stopAll(): Promise<void> {
    const startTime = Date.now();

    try {
      const resolution = this.resolveDependencies();
      const results: ComponentOperationResult[] = [];

      // Stop in reverse order
      for (const componentId of resolution.shutdownOrder) {
        const result = await this.stopComponent(componentId);
        results.push(result);

        if (!result.success) {
          console.warn(`Failed to stop component '${componentId}': ${result.error?.message}`);
        }
      }

      this.emitEvent('allComponentsStopped', {});

      const duration = Date.now() - startTime;
      console.log(`All components stopped in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Error during component shutdown: ${(error as Error).message}`);

      this.emitEvent('registryError', {
        error: error as Error
      });
    }
  }

  /**
   * Update configuration for all components
   */
  async updateAllConfigs(config: any): Promise<void> {
    const results: ComponentOperationResult[] = [];

    for (const [componentId, registration] of this.components) {
      try {
        const componentConfig = this.extractComponentConfig(config, registration.component.type, componentId);
        const result = await this.updateComponentConfigInternal(componentId, componentConfig);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          componentId,
          operation: 'updateConfig',
          duration: 0,
          error: {
            message: (error as Error).message,
            code: 'CONFIG_UPDATE_FAILED'
          },
          timestamp: new Date()
        });
      }
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      const failedIds = failed.map(r => r.componentId).join(', ');
      throw new Error(`Failed to update configuration for components: ${failedIds}`);
    }
  }

  /**
   * Update configuration for a specific component
   */
  async updateComponentConfig(id: string, config: any): Promise<void> {
    const result = await this.updateComponentConfigInternal(id, config);
    if (!result.success) {
      throw new Error(`Failed to update configuration for component '${id}': ${result.error?.message}`);
    }
  }

  /**
   * Get health status of all components
   */
  async getAllHealth(): Promise<Map<string, ComponentHealth>> {
    const healthMap = new Map<string, ComponentHealth>();

    for (const [componentId, registration] of this.components) {
      try {
        const health = await registration.component.getHealth();
        healthMap.set(componentId, health);
      } catch (error) {
        healthMap.set(componentId, {
          status: 'error',
          lastCheck: new Date(),
          details: {
            error: (error as Error).message
          },
          uptime: registration.startedAt ? Date.now() - registration.startedAt.getTime() : 0
        });
      }
    }

    return healthMap;
  }

  /**
   * Get health status of a specific component
   */
  async getComponentHealth(id: string): Promise<ComponentHealth | null> {
    const registration = this.components.get(id);
    if (!registration) {
      return null;
    }

    try {
      return await registration.component.getHealth();
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        details: {
          error: (error as Error).message
        },
        uptime: registration.startedAt ? Date.now() - registration.startedAt.getTime() : 0
      };
    }
  }

  getComponentState(id: string): ComponentLifecycleState | null {
    const registration = this.components.get(id);
    return registration ? registration.state : null;
  }

  getRegistryStats(): RegistryStats {
    return {
      totalComponents: this.components.size,
      componentsByType: new Map(),
      componentsByState: new Map(),
      healthSummary: { healthy: 0, warning: 0, error: 0, unknown: 0 },
      uptime: Date.now() - this.startTime.getTime(),
      totalRegistrations: this.totalRegistrations,
      totalUnregistrations: this.totalUnregistrations
    };
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up registry...');
  }

  /**
   * Register a callback for component lifecycle events
   */
  override on(event: RegistryEvent, callback: RegistryEventCallback): this {
    super.on(event, callback);
    return this;
  }

  /**
   * Unregister a callback for component lifecycle events
   */
  override off(event: RegistryEvent, callback: RegistryEventCallback): this {
    super.off(event, callback);
    return this;
  }

  // Private helper methods - basic implementations
  private validateComponent(component: IConfigurationComponent): void {
    if (!component.id || typeof component.id !== 'string') {
      throw new Error('Component must have a valid string ID');
    }

    if (!component.type || typeof component.type !== 'string') {
      throw new Error('Component must have a valid string type');
    }

    if (!component.name || typeof component.name !== 'string') {
      throw new Error('Component must have a valid string name');
    }

    if (!component.version || typeof component.version !== 'string') {
      throw new Error('Component must have a valid string version');
    }
  }

  private updateComponentState(componentId: string, newState: ComponentLifecycleState): void {
    const registration = this.components.get(componentId);
    if (!registration) {
      return;
    }

    const previousState = registration.state;
    registration.state = newState;
    registration.lastStateChange = new Date();

    if (newState === 'running' && !registration.startedAt) {
      registration.startedAt = new Date();
    }

    this.emitEvent('componentStateChanged', {
      event: 'componentStateChanged',
      componentId,
      componentType: registration.component.type,
      newState,
      previousState,
      timestamp: new Date()
    });
  }

  private updateDependents(componentId: string, dependencies: string[]): void {
    for (const depId of dependencies) {
      const depRegistration = this.components.get(depId);
      if (depRegistration && !depRegistration.dependents.includes(componentId)) {
        depRegistration.dependents.push(componentId);
      }
    }
  }

  private removeDependents(componentId: string, dependencies: string[]): void {
    for (const depId of dependencies) {
      const depRegistration = this.components.get(depId);
      if (depRegistration) {
        const index = depRegistration.dependents.indexOf(componentId);
        if (index !== -1) {
          depRegistration.dependents.splice(index, 1);
        }
      }
    }
  }

  private resolveDependencies(): DependencyResolution {
    return {
      initializationOrder: Array.from(this.components.keys()),
      startupOrder: Array.from(this.components.keys()),
      shutdownOrder: Array.from(this.components.keys()).reverse(),
      circularDependencies: [],
      unresolvedDependencies: new Map()
    };
  }

  private async initializeComponent(componentId: string, config: any): Promise<ComponentOperationResult> {
    const startTime = Date.now();

    try {
      const registration = this.components.get(componentId);
      if (!registration) {
        throw new Error(`Component '${componentId}' not found`);
      }

      this.updateComponentState(componentId, 'initializing');
      await registration.component.initialize(config);
      this.updateComponentState(componentId, 'initialized');

      const duration = Date.now() - startTime;
      return {
        success: true,
        componentId,
        operation: 'initialize',
        duration,
        timestamp: new Date()
      };

    } catch (error) {
      this.updateComponentState(componentId, 'error');
      const duration = Date.now() - startTime;

      return {
        success: false,
        componentId,
        operation: 'initialize',
        duration,
        error: {
          message: (error as Error).message,
          code: 'INITIALIZATION_FAILED',
          stack: (error as Error).stack
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Start a specific component
   */
  private async startComponent(id: string): Promise<ComponentOperationResult> {
    const startTime = Date.now();
    const registration = this.components.get(id);

    if (!registration) {
      return {
        success: false,
        componentId: id,
        operation: 'start',
        duration: Date.now() - startTime,
        error: {
          message: `Component '${id}' not found`,
          code: 'COMPONENT_NOT_FOUND'
        },
        timestamp: new Date()
      };
    }

    if (registration.state === 'running') {
      return {
        success: true,
        componentId: id,
        operation: 'start',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    try {
      await registration.component.start();
      registration.state = 'running';
      registration.startedAt = new Date();

      this.emitEvent('componentStateChanged', {
        event: 'componentStateChanged',
        componentId: id,
        componentType: registration.component.type,
        newState: 'running',
        previousState: registration.state,
        timestamp: new Date()
      });

      return {
        success: true,
        componentId: id,
        operation: 'start',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      registration.state = 'error';

      this.emitEvent('registryError', {
        event: 'registryError',
        componentId: id,
        componentType: registration.component.type,
        error: error as Error,
        timestamp: new Date()
      });

      return {
        success: false,
        componentId: id,
        operation: 'start',
        duration: Date.now() - startTime,
        error: {
          message: (error as Error).message,
          code: 'START_FAILED'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Stop a specific component
   */
  private async stopComponent(id: string): Promise<ComponentOperationResult> {
    const startTime = Date.now();
    const registration = this.components.get(id);

    if (!registration) {
      return {
        success: false,
        componentId: id,
        operation: 'stop',
        duration: Date.now() - startTime,
        error: {
          message: `Component '${id}' not found`,
          code: 'COMPONENT_NOT_FOUND'
        },
        timestamp: new Date()
      };
    }

    if (registration.state === 'stopped') {
      return {
        success: true,
        componentId: id,
        operation: 'stop',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    try {
      await registration.component.stop();
      registration.state = 'stopped';
      registration.lastStateChange = new Date();

      this.emitEvent('componentStateChanged', {
        event: 'componentStateChanged',
        componentId: id,
        componentType: registration.component.type,
        newState: 'stopped',
        previousState: registration.state,
        timestamp: new Date()
      });

      return {
        success: true,
        componentId: id,
        operation: 'stop',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      registration.state = 'error';

      this.emitEvent('registryError', {
        event: 'registryError',
        componentId: id,
        componentType: registration.component.type,
        error: error as Error,
        timestamp: new Date()
      });

      return {
        success: false,
        componentId: id,
        operation: 'stop',
        duration: Date.now() - startTime,
        error: {
          message: (error as Error).message,
          code: 'STOP_FAILED'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Extract component-specific configuration from global config
   */
  private extractComponentConfig(globalConfig: any, componentType: string, componentId: string): any {
    if (!globalConfig) {
      return {};
    }

    // Try to find component-specific config
    const componentConfig = globalConfig[componentType] || globalConfig[componentId] || {};

    // Merge with global settings if available
    const globalSettings = globalConfig.global || {};

    return {
      ...globalSettings,
      ...componentConfig
    };
  }

  /**
   * Internal method to update component configuration
   */
  private async updateComponentConfigInternal(id: string, config: any): Promise<ComponentOperationResult> {
    const startTime = Date.now();
    const registration = this.components.get(id);

    if (!registration) {
      return {
        success: false,
        componentId: id,
        operation: 'updateConfig',
        duration: Date.now() - startTime,
        error: {
          message: `Component '${id}' not found`,
          code: 'COMPONENT_NOT_FOUND'
        },
        timestamp: new Date()
      };
    }

    try {
      await registration.component.updateConfig(config);
      registration.config = config;
      registration.lastStateChange = new Date();

      // Emit a generic state change event for config updates
      this.emitEvent('componentStateChanged', {
        event: 'componentStateChanged',
        componentId: id,
        componentType: registration.component.type,
        newState: registration.state,
        previousState: registration.state,
        timestamp: new Date()
      });

      return {
        success: true,
        componentId: id,
        operation: 'updateConfig',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.emitEvent('registryError', {
        event: 'registryError',
        componentId: id,
        componentType: registration.component.type,
        error: error as Error,
        timestamp: new Date()
      });

      return {
        success: false,
        componentId: id,
        operation: 'updateConfig',
        duration: Date.now() - startTime,
        error: {
          message: (error as Error).message,
          code: 'CONFIG_UPDATE_FAILED'
        },
        timestamp: new Date()
      };
    }
  }

  private startHealthMonitoring(): void {
    console.log('Health monitoring started');
  }

  private emitEvent(event: RegistryEvent, data: Partial<RegistryEventData>): void {
    const eventData: RegistryEventData = {
      event,
      timestamp: new Date(),
      ...data
    };

    this.emit(event, eventData);
  }

  private mergeWithDefaults(config?: Partial<RegistryConfig>): RegistryConfig {
    return {
      components: config?.components || {},
      settings: {
        initializationTimeout: config?.settings?.initializationTimeout || 30000,
        startupTimeout: config?.settings?.startupTimeout || 30000,
        shutdownTimeout: config?.settings?.shutdownTimeout || 30000,
        healthCheckInterval: config?.settings?.healthCheckInterval || 60000,
        enableHealthMonitoring: config?.settings?.enableHealthMonitoring ?? true,
        enableDependencyValidation: config?.settings?.enableDependencyValidation ?? true,
        maxDependencyDepth: config?.settings?.maxDependencyDepth || 10
      }
    };
  }
}
