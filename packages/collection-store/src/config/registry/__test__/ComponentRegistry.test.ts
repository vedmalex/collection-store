import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ComponentRegistry } from '../ComponentRegistry';
import { BaseConfigurationComponent } from '../BaseConfigurationComponent';
import { ComponentHealth } from '../interfaces/IConfigurationComponent';

// Mock component for testing
class MockComponent extends BaseConfigurationComponent {
  private initialized = false;
  private started = false;

  constructor(id: string, dependencies: string[] = []) {
    super(
      id,
      'mock-component',
      `Mock Component ${id}`,
      '1.0.0',
      'A mock component for testing',
      dependencies,
      ['testing', 'mock']
    );
  }

  protected async doInitialize(config: any): Promise<void> {
    this.initialized = true;
    // Simulate async initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async doUpdateConfig(newConfig: any, oldConfig: any): Promise<void> {
    // Simulate config update
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  protected async doStart(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Component must be initialized before starting');
    }
    this.started = true;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async doStop(): Promise<void> {
    this.started = false;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async doGetHealth(): Promise<Partial<ComponentHealth>> {
    return {
      details: {
        responseTime: 5,
        metrics: {
          initialized: this.initialized,
          started: this.started
        }
      }
    };
  }

  protected async doCleanup(): Promise<void> {
    this.initialized = false;
    this.started = false;
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  // Getters for testing
  get isInitialized(): boolean { return this.initialized; }
  get isStarted(): boolean { return this.started; }
}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry({
      settings: {
        enableHealthMonitoring: false, // Disable for testing
        initializationTimeout: 5000,
        startupTimeout: 5000,
        shutdownTimeout: 5000,
        healthCheckInterval: 60000,
        enableDependencyValidation: true,
        maxDependencyDepth: 10
      }
    });
  });

  afterEach(async () => {
    await registry.cleanup();
  });

  describe('Component Registration', () => {
    it('should register a component successfully', async () => {
      const component = new MockComponent('test-1');

      await registry.register(component);

      expect(registry.has('test-1')).toBe(true);
      expect(registry.get('test-1')).toBe(component);
    });

    it('should throw error when registering duplicate component', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-1');

      await registry.register(component1);

      await expect(registry.register(component2)).rejects.toThrow(
        'Component with ID \'test-1\' is already registered'
      );
    });

    it('should unregister a component successfully', async () => {
      const component = new MockComponent('test-1');

      await registry.register(component);
      expect(registry.has('test-1')).toBe(true);

      await registry.unregister('test-1');
      expect(registry.has('test-1')).toBe(false);
    });

    it('should throw error when unregistering non-existent component', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow(
        'Component \'non-existent\' is not registered'
      );
    });
  });

  describe('Component Lifecycle', () => {
    it('should initialize all components', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      const config = { test: 'config' };
      await registry.initializeAll(config);

      expect(component1.isInitialized).toBe(true);
      expect(component2.isInitialized).toBe(true);
      expect(registry.getComponentState('test-1')).toBe('initialized');
      expect(registry.getComponentState('test-2')).toBe('initialized');
    });

    it('should start all components after initialization', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      await registry.initializeAll({});
      await registry.startAll();

      expect(component1.isStarted).toBe(true);
      expect(component2.isStarted).toBe(true);
      expect(registry.getComponentState('test-1')).toBe('running');
      expect(registry.getComponentState('test-2')).toBe('running');
    });

    it('should stop all components', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      await registry.initializeAll({});
      await registry.startAll();
      await registry.stopAll();

      expect(component1.isStarted).toBe(false);
      expect(component2.isStarted).toBe(false);
      expect(registry.getComponentState('test-1')).toBe('stopped');
      expect(registry.getComponentState('test-2')).toBe('stopped');
    });
  });

  describe('Component Queries', () => {
    it('should get components by type', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      const mockComponents = registry.getByType('mock-component');
      expect(mockComponents).toHaveLength(2);
      expect(mockComponents).toContain(component1);
      expect(mockComponents).toContain(component2);
    });

    it('should get all components', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      const allComponents = registry.getAll();
      expect(allComponents).toHaveLength(2);
      expect(allComponents).toContain(component1);
      expect(allComponents).toContain(component2);
    });

    it('should get registry statistics', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      const stats = registry.getRegistryStats();
      expect(stats.totalComponents).toBe(2);
      expect(stats.totalRegistrations).toBe(2);
      expect(stats.totalUnregistrations).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should get health status of all components', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      await registry.initializeAll({});
      await registry.startAll();

      const healthMap = await registry.getAllHealth();
      expect(healthMap.size).toBe(2);
      expect(healthMap.has('test-1')).toBe(true);
      expect(healthMap.has('test-2')).toBe(true);

      const health1 = healthMap.get('test-1');
      expect(health1?.status).toBe('healthy');
    });

    it('should get health status of specific component', async () => {
      const component = new MockComponent('test-1');

      await registry.register(component);
      await registry.initializeAll({});
      await registry.startAll();

      const health = await registry.getComponentHealth('test-1');
      expect(health).not.toBeNull();
      expect(health?.status).toBe('healthy');
      expect(health?.details.metrics?.initialized).toBe(true);
      expect(health?.details.metrics?.started).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration for all components', async () => {
      const component1 = new MockComponent('test-1');
      const component2 = new MockComponent('test-2');

      await registry.register(component1);
      await registry.register(component2);

      await registry.initializeAll({});

      const newConfig = { updated: true };
      await registry.updateAllConfigs(newConfig);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should update configuration for specific component', async () => {
      const component = new MockComponent('test-1');

      await registry.register(component);
      await registry.initializeAll({});

      const newConfig = { updated: true };
      await registry.updateComponentConfig('test-1', newConfig);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle component initialization failure', async () => {
      class FailingComponent extends MockComponent {
        protected async doInitialize(config: any): Promise<void> {
          throw new Error('Initialization failed');
        }
      }

      const component = new FailingComponent('failing-1');
      await registry.register(component);

      await expect(registry.initializeAll({})).rejects.toThrow(
        'Failed to initialize component \'failing-1\''
      );
    });

    it('should handle component startup failure', async () => {
      class FailingComponent extends MockComponent {
        protected async doStart(): Promise<void> {
          throw new Error('Startup failed');
        }
      }

      const component = new FailingComponent('failing-1');
      await registry.register(component);
      await registry.initializeAll({});

      await expect(registry.startAll()).rejects.toThrow(
        'Failed to start component \'failing-1\''
      );
    });
  });
});