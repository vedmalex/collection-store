import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AdapterFactoryManager } from '../AdapterFactoryManager';
import {
  IExternalAdapter,
  AdapterConfig,
  AdapterFactoryConfig,
  AdapterConstructor
} from '../interfaces/IAdapterFactoryManager';
import { ComponentHealth } from '../../registry/interfaces/IConfigurationComponent';

// Mock adapter implementation for testing
class MockAdapter implements IExternalAdapter {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public readonly version: string = '1.0.0';

  private running: boolean = false;
  private config: any;

  constructor(id: string, config: any) {
    this.id = id;
    this.type = 'mock';
    this.name = `Mock Adapter ${id}`;
    this.config = config;
  }

  async initialize(config: any): Promise<void> {
    this.config = config;
    // Simulate initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Adapter is already running');
    }
    this.running = true;
    // Simulate startup
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
    // Simulate shutdown
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async getHealth(): Promise<ComponentHealth> {
    return {
      status: this.running ? 'healthy' : 'unknown',
      lastCheck: new Date(),
      details: {
        responseTime: 5,
        metrics: {
          isRunning: this.running
        }
      },
      uptime: this.running ? 1000 : 0
    };
  }

  async updateConfig(config: any): Promise<void> {
    this.config = config;
    // Simulate config update
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  async cleanup(): Promise<void> {
    if (this.running) {
      await this.stop();
    }
    // Simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  isRunning(): boolean {
    return this.running;
  }
}

// Failing mock adapter for error testing
class FailingMockAdapter extends MockAdapter {
  async start(): Promise<void> {
    throw new Error('Mock adapter start failure');
  }
}

describe('AdapterFactoryManager', () => {
  let manager: AdapterFactoryManager;
  let config: AdapterFactoryConfig;

  beforeEach(() => {
    manager = new AdapterFactoryManager('test-factory');
    config = {
      adapters: [
        {
          id: 'adapter1',
          type: 'mock',
          name: 'Test Adapter 1',
          enabled: true,
          priority: 10,
          config: { setting1: 'value1' }
        },
        {
          id: 'adapter2',
          type: 'mock',
          name: 'Test Adapter 2',
          enabled: true,
          priority: 5,
          config: { setting2: 'value2' }
        }
      ],
      settings: {
        initializationTimeout: 5000,
        startupTimeout: 5000,
        shutdownTimeout: 5000,
        enableHealthMonitoring: true,
        globalHealthCheckInterval: 30000,
        autoRestartFailedAdapters: false,
        maxRestartAttempts: 3
      }
    };
  });

  afterEach(async () => {
    if (manager.isRunning()) {
      await manager.stop();
    }
    await manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Register mock adapter type
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);

      await manager.initialize(config);

      expect(manager.getState()).toBe('initialized');
      expect(manager.getAllAdapters()).toHaveLength(2);
      expect(manager.getRegisteredAdapterTypes()).toContain('mock');
    });

    it('should fail initialization with unregistered adapter type', async () => {
      await expect(manager.initialize(config)).rejects.toThrow(
        "Adapter type 'mock' is not registered"
      );
    });

    it('should handle empty adapter configuration', async () => {
      const emptyConfig: AdapterFactoryConfig = {
        adapters: [],
        settings: config.settings
      };

      await manager.initialize(emptyConfig);

      expect(manager.getState()).toBe('initialized');
      expect(manager.getAllAdapters()).toHaveLength(0);
    });
  });

  describe('Adapter Type Registration', () => {
    it('should register adapter types successfully', () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);

      expect(manager.isAdapterTypeRegistered('mock')).toBe(true);
      expect(manager.getRegisteredAdapterTypes()).toContain('mock');
    });

    it('should prevent duplicate adapter type registration', () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);

      expect(() => {
        manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      }).toThrow("Adapter type 'mock' is already registered");
    });

    it('should unregister adapter types when no instances exist', () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      manager.unregisterAdapterType('mock');

      expect(manager.isAdapterTypeRegistered('mock')).toBe(false);
    });

    it('should prevent unregistering adapter types with active instances', async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);

      expect(() => {
        manager.unregisterAdapterType('mock');
      }).toThrow("Cannot unregister adapter type 'mock': 2 active instances exist");
    });
  });

  describe('Adapter Lifecycle', () => {
    beforeEach(async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);
    });

    it('should start all adapters successfully', async () => {
      await manager.start();

      expect(manager.isRunning()).toBe(true);

      const adapters = manager.getAllAdapters();
      for (const adapter of adapters) {
        expect(adapter.isRunning()).toBe(true);
      }
    });

    it('should stop all adapters successfully', async () => {
      await manager.start();
      await manager.stop();

      expect(manager.isRunning()).toBe(false);

      const adapters = manager.getAllAdapters();
      for (const adapter of adapters) {
        expect(adapter.isRunning()).toBe(false);
      }
    });

    it('should start adapters in priority order', async () => {
      const startOrder: string[] = [];

      // Override start method to track order
      const adapters = manager.getAllAdapters();
      for (const adapter of adapters) {
        const originalStart = adapter.start.bind(adapter);
        adapter.start = async () => {
          startOrder.push(adapter.id);
          await originalStart();
        };
      }

      await manager.start();

      // Higher priority (10) should start before lower priority (5)
      expect(startOrder).toEqual(['adapter1', 'adapter2']);
    });
  });

  describe('Adapter Management', () => {
    beforeEach(async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);
    });

    it('should create new adapters', async () => {
      const newConfig: AdapterConfig = {
        id: 'adapter3',
        type: 'mock',
        name: 'Test Adapter 3',
        enabled: true,
        priority: 1,
        config: { setting3: 'value3' }
      };

      const adapter = await manager.createAdapter('mock', newConfig);

      expect(adapter.id).toBe('adapter3');
      expect(manager.getAdapter('adapter3')).toBe(adapter);
      expect(manager.getAllAdapters()).toHaveLength(3);
    });

    it('should get adapters by type', () => {
      const mockAdapters = manager.getAdaptersByType('mock');

      expect(mockAdapters).toHaveLength(2);
      expect(mockAdapters.every(a => a.type === 'mock')).toBe(true);
    });

    it('should restart specific adapters', async () => {
      await manager.start();

      const adapter = manager.getAdapter('adapter1');
      expect(adapter?.isRunning()).toBe(true);

      await manager.restartAdapter('adapter1');

      expect(adapter?.isRunning()).toBe(true);
    });

    it('should remove adapters', async () => {
      await manager.removeAdapter('adapter1');

      expect(manager.getAdapter('adapter1')).toBeNull();
      expect(manager.getAllAdapters()).toHaveLength(1);
    });

    it('should update adapter configuration', async () => {
      const newConfig = { newSetting: 'newValue' };

      await manager.updateAdapterConfig('adapter1', newConfig);

      // Verify config was updated (would need to check adapter internals)
      expect(manager.getAdapter('adapter1')).not.toBeNull();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);
      await manager.start();
    });

    it('should get health status of specific adapter', async () => {
      const health = await manager.getAdapterHealth('adapter1');

      expect(health).not.toBeNull();
      expect(health?.status).toBe('healthy');
    });

    it('should get health status of all adapters', async () => {
      const allHealth = await manager.getAllAdaptersHealth();

      expect(allHealth.size).toBe(2);
      expect(allHealth.has('adapter1')).toBe(true);
      expect(allHealth.has('adapter2')).toBe(true);
    });

    it('should report overall factory health', async () => {
      const health = await manager.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.metrics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter start failures', async () => {
      manager.registerAdapterType('failing', FailingMockAdapter as AdapterConstructor);

      const failingConfig: AdapterFactoryConfig = {
        adapters: [{
          id: 'failing-adapter',
          type: 'failing',
          name: 'Failing Adapter',
          enabled: true,
          priority: 1,
          config: {}
        }],
        settings: config.settings
      };

      await manager.initialize(failingConfig);

      await expect(manager.start()).rejects.toThrow('Mock adapter start failure');
    });

    it('should handle missing adapter operations gracefully', async () => {
      expect(manager.getAdapter('nonexistent')).toBeNull();
      expect(await manager.getAdapterHealth('nonexistent')).toBeNull();

      await expect(manager.restartAdapter('nonexistent')).rejects.toThrow(
        "Adapter 'nonexistent' not found"
      );
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);
    });

    it('should track factory statistics', () => {
      const stats = manager.getFactoryStats();

      expect(stats.totalAdapterTypes).toBe(1);
      expect(stats.totalAdapterInstances).toBe(2);
      expect(stats.totalCreations).toBe(2);
      expect(stats.totalRemovals).toBe(0);
    });

    it('should update statistics after operations', async () => {
      const newConfig: AdapterConfig = {
        id: 'adapter3',
        type: 'mock',
        name: 'Test Adapter 3',
        enabled: true,
        priority: 1,
        config: {}
      };

      await manager.createAdapter('mock', newConfig);
      await manager.removeAdapter('adapter3');

      const stats = manager.getFactoryStats();
      expect(stats.totalCreations).toBe(3);
      expect(stats.totalRemovals).toBe(1);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      manager.registerAdapterType('mock', MockAdapter as AdapterConstructor);
      await manager.initialize(config);
    });

    it('should update factory configuration', async () => {
      const newConfig: AdapterFactoryConfig = {
        adapters: [
          ...config.adapters,
          {
            id: 'adapter3',
            type: 'mock',
            name: 'New Adapter',
            enabled: true,
            priority: 1,
            config: {}
          }
        ],
        settings: config.settings
      };

      await manager.updateConfig(newConfig);

      expect(manager.getAllAdapters()).toHaveLength(3);
      expect(manager.getAdapter('adapter3')).not.toBeNull();
    });
  });
});