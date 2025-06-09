// Basic tests for External Adapters Foundation
// Tests compilation and basic functionality of the adapter system

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AdapterRegistry, AdapterRegistryConfig } from '../registry/core/AdapterRegistry';
import { AdapterCoordinator, CoordinationConfig } from '../registry/core/AdapterCoordinator';
import { AdapterType, AdapterState } from '../base/types/AdapterTypes';
import { MongoDBAdapterConfigSchema, AdapterSchemaFactory } from '../../config/schemas/AdapterConfig';

// Mock adapter for testing
class MockAdapter {
  public id: string;
  public type: string;
  public config: any;
  public state: AdapterState = AdapterState.INACTIVE;
  public metrics = {
    operationsCount: 0,
    errorCount: 0,
    lastOperation: null,
    lastError: null,
    averageResponseTime: 0,
    uptime: 0
  };

  constructor(id: string, type: string, config: any) {
    this.id = id;
    this.type = type;
    this.config = config;
  }

  async initialize() {
    this.state = AdapterState.INACTIVE;
  }

  async start() {
    this.state = AdapterState.ACTIVE;
  }

  async stop() {
    this.state = AdapterState.INACTIVE;
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  async getHealth() {
    return {
      status: this.state === AdapterState.ACTIVE ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
      details: {}
    };
  }

  isHealthy() {
    return this.state === AdapterState.ACTIVE;
  }

  async validateConfig() {
    return true;
  }

  async updateConfig() {
    // Mock implementation
  }

  async ping() {
    return this.state === AdapterState.ACTIVE;
  }

  getMetrics() {
    return this.metrics;
  }

  resetMetrics() {
    this.metrics = {
      operationsCount: 0,
      errorCount: 0,
      lastOperation: null,
      lastError: null,
      averageResponseTime: 0,
      uptime: 0
    };
  }

  // Mock event emitter methods
  on() {}
  off() {}
  emit() {}

  // Mock data operations
  async query() {
    return { success: true, data: [] };
  }

  async insert() {
    return { success: true, data: {} };
  }

  async update() {
    return { success: true, data: {} };
  }

  async delete() {
    return { success: true, data: {} };
  }

  async batchInsert() {
    return [{ success: true, data: {} }];
  }

  async batchUpdate() {
    return [{ success: true, data: {} }];
  }

  async batchDelete() {
    return [{ success: true, data: {} }];
  }

  async subscribe() {
    return {
      id: 'mock-subscription',
      adapterId: this.id,
      callback: () => {},
      active: true
    };
  }

  async unsubscribe() {
    // Mock implementation
  }

  async beginTransaction() {
    return {
      id: 'mock-transaction',
      adapterId: this.id,
      state: 'ACTIVE' as const,
      operations: [],
      startTime: new Date()
    };
  }

  async prepareTransaction() {
    return true;
  }

  async commitTransaction() {
    // Mock implementation
  }

  async rollbackTransaction() {
    // Mock implementation
  }
}

describe('External Adapters Foundation', () => {
  let registry: AdapterRegistry;
  let coordinator: AdapterCoordinator;

  const registryConfig: AdapterRegistryConfig = {
    maxAdapters: 10,
    healthCheckInterval: 5000,
    autoStart: false,
    retryAttempts: 3,
    retryDelay: 1000
  };

  const coordinationConfig: CoordinationConfig = {
    parallelOperations: true,
    timeoutMs: 5000,
    retryAttempts: 3,
    retryDelayMs: 1000
  };

  beforeEach(() => {
    registry = new AdapterRegistry(registryConfig);
    coordinator = new AdapterCoordinator(registry, coordinationConfig);
  });

  afterEach(async () => {
    await registry.shutdown();
    await coordinator.shutdown();
  });

  describe('AdapterRegistry', () => {
    it('should create registry with correct configuration', () => {
      expect(registry).toBeDefined();
      const stats = registry.getRegistryStats();
      expect(stats.totalAdapters).toBe(0);
    });

    it('should register and unregister adapters', async () => {
      const mockAdapter = new MockAdapter('test-adapter', 'mongodb', {
        id: 'test-adapter',
        type: 'mongodb',
        enabled: true,
        tags: [],
        lifecycle: { autoStart: false, startupTimeout: 30000, shutdownTimeout: 10000, healthCheckInterval: 30000 },
        capabilities: { read: true, write: true, realtime: true, transactions: true, batch: true }
      }) as any;

      await registry.register(mockAdapter);

      const stats = registry.getRegistryStats();
      expect(stats.totalAdapters).toBe(1);
      expect(stats.adaptersByType.mongodb).toBe(1);

      const retrievedAdapter = registry.getAdapter('test-adapter');
      expect(retrievedAdapter).toBeDefined();
      expect(retrievedAdapter?.id).toBe('test-adapter');

      await registry.unregister('test-adapter');

      const statsAfterUnregister = registry.getRegistryStats();
      expect(statsAfterUnregister.totalAdapters).toBe(0);
    });

    it('should start and stop adapters', async () => {
      const mockAdapter = new MockAdapter('test-adapter', 'mongodb', {
        id: 'test-adapter',
        type: 'mongodb',
        enabled: true,
        tags: [],
        lifecycle: { autoStart: false, startupTimeout: 30000, shutdownTimeout: 10000, healthCheckInterval: 30000 },
        capabilities: { read: true, write: true, realtime: true, transactions: true, batch: true }
      }) as any;

      await registry.register(mockAdapter);

      expect(mockAdapter.state).toBe(AdapterState.INACTIVE);

      await registry.start('test-adapter');
      expect(mockAdapter.state).toBe(AdapterState.ACTIVE);

      await registry.stop('test-adapter');
      expect(mockAdapter.state).toBe(AdapterState.INACTIVE);
    });

    it('should check adapter health', async () => {
      const mockAdapter = new MockAdapter('test-adapter', 'mongodb', {
        id: 'test-adapter',
        type: 'mongodb',
        enabled: true,
        tags: [],
        lifecycle: { autoStart: false, startupTimeout: 30000, shutdownTimeout: 10000, healthCheckInterval: 30000 },
        capabilities: { read: true, write: true, realtime: true, transactions: true, batch: true }
      }) as any;

      await registry.register(mockAdapter);
      await registry.start('test-adapter');

      const healthResults = await registry.checkHealth('test-adapter');
      expect(healthResults.has('test-adapter')).toBe(true);

      const health = healthResults.get('test-adapter');
      expect(health.status).toBe('healthy');
    });
  });

  describe('AdapterCoordinator', () => {
    it('should create coordinator with correct configuration', () => {
      expect(coordinator).toBeDefined();
    });

    it('should execute single adapter operations', async () => {
      const mockAdapter = new MockAdapter('test-adapter', 'mongodb', {
        id: 'test-adapter',
        type: 'mongodb',
        enabled: true,
        tags: [],
        lifecycle: { autoStart: false, startupTimeout: 30000, shutdownTimeout: 10000, healthCheckInterval: 30000 },
        capabilities: { read: true, write: true, realtime: true, transactions: true, batch: true }
      }) as any;

      await registry.register(mockAdapter);
      await registry.start('test-adapter');

      const queryResult = await coordinator.executeQuery('test-adapter', { collection: 'test' });
      expect(queryResult.success).toBe(true);

      const insertResult = await coordinator.executeInsert('test-adapter', {
        collection: 'test',
        documents: [{ name: 'test' }]
      });
      expect(insertResult.success).toBe(true);
    });

    it('should ping adapters', async () => {
      const mockAdapter = new MockAdapter('test-adapter', 'mongodb', {
        id: 'test-adapter',
        type: 'mongodb',
        enabled: true,
        tags: [],
        lifecycle: { autoStart: false, startupTimeout: 30000, shutdownTimeout: 10000, healthCheckInterval: 30000 },
        capabilities: { read: true, write: true, realtime: true, transactions: true, batch: true }
      }) as any;

      await registry.register(mockAdapter);
      await registry.start('test-adapter');

      const pingResult = await coordinator.ping('test-adapter');
      expect(pingResult).toBe(true);

      const pingAllResults = await coordinator.pingAll();
      expect(pingAllResults.has('test-adapter')).toBe(true);
      expect(pingAllResults.get('test-adapter')).toBe(true);
    });
  });

  describe('Configuration Schemas', () => {
    it('should validate MongoDB adapter configuration', () => {
      const validConfig = {
        id: 'test-mongodb',
        type: 'mongodb' as const,
        enabled: true,
        description: 'Test MongoDB adapter',
        tags: ['test'],
        lifecycle: {
          autoStart: true,
          startupTimeout: 30000,
          shutdownTimeout: 10000,
          healthCheckInterval: 30000
        },
        capabilities: {
          read: true,
          write: true,
          realtime: true,
          transactions: true,
          batch: true
        },
        config: {
          connectionString: 'mongodb://localhost:27017',
          database: 'test',
          maxPoolSize: 10,
          minPoolSize: 0,
          maxIdleTimeMS: 30000,
          changeStreams: {
            enabled: true,
            fullDocument: 'updateLookup' as const,
            batchSize: 100
          },
          transactions: {
            readConcern: 'majority' as const,
            writeConcern: {
              w: 'majority' as const,
              j: true,
              wtimeout: 10000
            },
            readPreference: 'primary' as const
          },
          collections: {},
          ssl: {
            enabled: false,
            allowInvalidCertificates: false
          }
        }
      };

      const result = MongoDBAdapterConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid MongoDB adapter configuration', () => {
      const invalidConfig = {
        id: '',
        type: 'mongodb',
        config: {
          connectionString: 'invalid-url',
          database: ''
        }
      };

      const result = MongoDBAdapterConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should create schema using factory', () => {
      const schema = AdapterSchemaFactory.createSchema('mongodb', 'development');
      expect(schema).toBeDefined();

      const validConfig = {
        id: 'test',
        type: 'mongodb',
        config: {
          connectionString: 'mongodb://localhost:27017',
          database: 'test'
        }
      };

      const result = schema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('Type System', () => {
    it('should have correct adapter types', () => {
      expect(AdapterType.MONGODB).toBe(AdapterType.MONGODB);
      expect(AdapterType.GOOGLE_SHEETS).toBe(AdapterType.GOOGLE_SHEETS);
      expect(AdapterType.MARKDOWN).toBe(AdapterType.MARKDOWN);
    });

    it('should have correct adapter states', () => {
      expect(AdapterState.INACTIVE).toBe(AdapterState.INACTIVE);
      expect(AdapterState.INITIALIZING).toBe(AdapterState.INITIALIZING);
      expect(AdapterState.ACTIVE).toBe(AdapterState.ACTIVE);
      expect(AdapterState.ERROR).toBe(AdapterState.ERROR);
      expect(AdapterState.STOPPING).toBe(AdapterState.STOPPING);
    });
  });
});