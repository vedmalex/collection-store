import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigurationManager } from '../ConfigurationManager';
import { NodeRoleManager, NodeRole } from '../nodes/NodeRoleManager';
import { CrossDatabaseConfig } from '../transactions/CrossDatabaseConfig';
import { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';

describe('Configuration-Driven Architecture Integration', () => {
  let tempDir: string;
  let configPath: string;
  let testConfig: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-integration-test-'));
    configPath = path.join(tempDir, 'integration-config.json');

    // Comprehensive test configuration
    testConfig = {
      core: {
        name: 'integration-test-store',
        version: '1.0.0',
        environment: 'development',
        nodeId: 'test-node-integration',
        clusterId: 'test-cluster',
        hotReload: {
          enabled: true,
          debounceMs: 50,
        },
      },
      adapters: {
        mongodb: {
          enabled: true,
          priority: 1,
          role: 'backup',
          type: 'mongodb',
          config: {
            connectionString: 'mongodb://localhost:27017/test',
          },
        },
        googlesheets: {
          enabled: true,
          priority: 2,
          role: 'readonly',
          type: 'googlesheets',
          config: {
            apiKey: 'test-api-key',
            spreadsheetId: 'test-sheet-id',
          },
        },
      },
      features: {
        replication: { enabled: true },
        realtime: { enabled: true },
        offline: { enabled: true },
        analytics: { enabled: false },
      },
      indexManager: {
        enabled: true,
        btreeOptions: { degree: 5 },
        performance: { cacheSize: 2000, enableProfiling: true },
        transactions: { enabled: true, timeout: 15000, maxConcurrent: 50 },
      },
      environment: {
        environment: 'development',
        development: {
          debug: true,
          logLevel: 'debug',
          hotReload: true,
          performance: {
            enableProfiling: true,
            slowQueryThreshold: 200,
          },
        },
      },
    };

    // Write test configuration
    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

    // Clean up all managers
    ConfigurationManager.cleanup();
    NodeRoleManager.cleanup();
    CrossDatabaseConfig.cleanup();
  });

  afterEach(() => {
    // Cleanup all managers
    ConfigurationManager.cleanup();
    NodeRoleManager.cleanup();
    CrossDatabaseConfig.cleanup();

    // Remove temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Full System Integration', () => {
    it('should initialize complete configuration-driven architecture', () => {
      // Step 1: Load configuration with hot reload
      const config = ConfigurationManager.loadFromFile(configPath, true);

      expect(config.core.name).toBe('integration-test-store');
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(true);

      // Step 2: Initialize node role manager
      const nodeInfo = NodeRoleManager.initialize(config);

      expect(nodeInfo.nodeId).toBe('test-node-integration');
      expect(nodeInfo.role).toBe(NodeRole.PRIMARY); // Development environment
      expect(nodeInfo.clusterId).toBe('test-cluster');
      expect(nodeInfo.capabilities.canWrite).toBe(true);
      expect(nodeInfo.capabilities.canTransaction).toBe(true);

      // Step 3: Initialize cross-database configuration
      CrossDatabaseConfig.initialize(config);

      const transactionConfig = CrossDatabaseConfig.getConfig();
      expect(transactionConfig.timeout).toBe(15000);
      expect(transactionConfig.enableDistributed).toBe(true);
      expect(transactionConfig.coordinatorNodeId).toBe('test-node-integration');

      // Step 4: Verify database connections
      const databases = CrossDatabaseConfig.getDatabases();
      expect(databases).toHaveLength(3); // primary + 2 adapters

      const primaryDb = CrossDatabaseConfig.getDatabase('primary');
      expect(primaryDb?.type).toBe('primary');
      expect(primaryDb?.role).toBe('coordinator');

      const mongoDb = CrossDatabaseConfig.getDatabase('mongodb');
      expect(mongoDb?.type).toBe('external');
      expect(mongoDb?.adapterType).toBe('mongodb');
    });

    it('should handle configuration changes across all components', async () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath, true);
      NodeRoleManager.initialize();
      CrossDatabaseConfig.initialize();

      let configChangeDetected = false;
      let nodeRoleChanged = false;
      let transactionConfigChanged = false;

      // Register change callbacks
      ConfigurationManager.onConfigChange(() => {
        configChangeDetected = true;
      });

      NodeRoleManager.onRoleChange(() => {
        nodeRoleChanged = true;
      });

      CrossDatabaseConfig.onTransactionChange(() => {
        transactionConfigChanged = true;
      });

      // Wait for watchers to be set up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update configuration
      const updatedConfig = {
        ...testConfig,
        core: {
          ...testConfig.core,
          environment: 'production', // This should trigger role change
        },
        indexManager: {
          ...testConfig.indexManager,
          transactions: {
            ...testConfig.indexManager.transactions,
            timeout: 30000, // This should update transaction config
          },
        },
      };

      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      // Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(configChangeDetected).toBe(true);

      // Verify node role changed due to environment change
      const currentNode = NodeRoleManager.getCurrentNode();
      expect(currentNode?.environment).toBe('production');

      // Verify transaction config updated
      const transactionConfig = CrossDatabaseConfig.getConfig();
      expect(transactionConfig.timeout).toBe(30000);
    });

    it('should support node role transitions with capability updates', () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath);
      const nodeInfo = NodeRoleManager.initialize();

      // Verify initial PRIMARY role capabilities
      expect(nodeInfo.role).toBe(NodeRole.PRIMARY);
      expect(NodeRoleManager.canPerformOperation('canWrite')).toBe(true);
      expect(NodeRoleManager.canPerformOperation('canTransaction')).toBe(true);

      // Demote to SECONDARY
      const demoted = NodeRoleManager.demoteNode(NodeRole.SECONDARY);
      expect(demoted).toBe(true);

      const updatedNode = NodeRoleManager.getCurrentNode();
      expect(updatedNode?.role).toBe(NodeRole.SECONDARY);
      expect(NodeRoleManager.canPerformOperation('canWrite')).toBe(false);
      expect(NodeRoleManager.canPerformOperation('canRead')).toBe(true);
      expect(NodeRoleManager.canPerformOperation('canTransaction')).toBe(false);

      // Try invalid promotion (SECONDARY -> BROWSER should fail)
      const invalidPromotion = NodeRoleManager.promoteNode(NodeRole.BROWSER);
      expect(invalidPromotion).toBe(false);

      // Valid promotion back to PRIMARY
      const promoted = NodeRoleManager.promoteNode(NodeRole.PRIMARY);
      expect(promoted).toBe(true);
      expect(NodeRoleManager.getCurrentNode()?.role).toBe(NodeRole.PRIMARY);
    });

    it('should manage cross-database transactions with 2PC', async () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath);
      NodeRoleManager.initialize();
      CrossDatabaseConfig.initialize();

      // Start a cross-database transaction
      const transaction = CrossDatabaseConfig.startTransaction(['primary', 'mongodb']);

      expect(transaction.status).toBe('PENDING');
      expect(transaction.databases).toEqual(['primary', 'mongodb']);
      expect(transaction.coordinatorNodeId).toBe('test-node-integration');

      // Add operations to transaction
      const operation1 = CrossDatabaseConfig.addOperation(transaction.id, {
        databaseId: 'primary',
        type: 'INSERT',
        collection: 'users',
        data: { name: 'John Doe', email: 'john@example.com' },
      });

      const operation2 = CrossDatabaseConfig.addOperation(transaction.id, {
        databaseId: 'mongodb',
        type: 'INSERT',
        collection: 'audit_log',
        data: { action: 'user_created', userId: 'john-doe' },
      });

      expect(transaction.operations).toHaveLength(2);
      expect(operation1.status).toBe('PENDING');
      expect(operation2.status).toBe('PENDING');

      // Phase 1: Prepare transaction
      const prepared = await CrossDatabaseConfig.prepareTransaction(transaction.id);
      expect(prepared).toBe(true);

      const preparedTransaction = CrossDatabaseConfig.getTransaction(transaction.id);
      expect(preparedTransaction?.status).toBe('PREPARED');

      // Phase 2: Commit transaction
      const committed = await CrossDatabaseConfig.commitTransaction(transaction.id);
      expect(committed).toBe(true);

      const committedTransaction = CrossDatabaseConfig.getTransaction(transaction.id);
      expect(committedTransaction?.status).toBe('COMMITTED');
      expect(committedTransaction?.operations.every(op => op.status === 'COMMITTED')).toBe(true);
    });

    it('should handle transaction failures and rollback', async () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath);
      NodeRoleManager.initialize();
      CrossDatabaseConfig.initialize();

      // Start transaction
      const transaction = CrossDatabaseConfig.startTransaction(['primary', 'mongodb']);

      // Add operation
      CrossDatabaseConfig.addOperation(transaction.id, {
        databaseId: 'primary',
        type: 'INSERT',
        collection: 'users',
        data: { name: 'Jane Doe' },
      });

      // Abort transaction
      await CrossDatabaseConfig.abortTransaction(transaction.id);

      const abortedTransaction = CrossDatabaseConfig.getTransaction(transaction.id);
      expect(abortedTransaction?.status).toBe('ABORTED');
      expect(abortedTransaction?.operations.every(op => op.status === 'ABORTED')).toBe(true);
    });

    it('should validate environment-specific configurations', () => {
      // Initialize with development config
      const config = ConfigurationManager.loadFromFile(configPath);

      expect(config.environment?.development?.debug).toBe(true);
      expect(config.environment?.development?.logLevel).toBe('debug');
      expect(config.environment?.development?.performance?.enableProfiling).toBe(true);

      // Verify IndexManager integration
      expect(config.indexManager.enabled).toBe(true);
      expect(config.indexManager.btreeOptions?.degree).toBe(5);
      expect(config.indexManager.performance?.cacheSize).toBe(2000);
      expect(config.indexManager.transactions?.timeout).toBe(15000);
    });

    it('should support cluster health monitoring', () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath);
      NodeRoleManager.initialize();

      // Register additional nodes
      NodeRoleManager.registerNode({
        nodeId: 'secondary-node-1',
        role: NodeRole.SECONDARY,
        capabilities: {
          canWrite: false,
          canRead: true,
          canReplicate: true,
          canIndex: true,
          canTransaction: false,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: 50,
        },
        clusterId: 'test-cluster',
        environment: 'development',
        version: '1.0.0',
        startTime: new Date(),
        lastHeartbeat: new Date(),
        metadata: {},
      });

      NodeRoleManager.registerNode({
        nodeId: 'client-node-1',
        role: NodeRole.CLIENT,
        capabilities: {
          canWrite: false,
          canRead: true,
          canReplicate: false,
          canIndex: false,
          canTransaction: false,
          canCache: true,
          canOffline: true,
          canRealtime: true,
          maxConnections: 10,
        },
        clusterId: 'test-cluster',
        environment: 'development',
        version: '1.0.0',
        startTime: new Date(),
        lastHeartbeat: new Date(),
        metadata: {},
      });

      // Check cluster health
      const health = NodeRoleManager.getClusterHealth();
      expect(health.totalNodes).toBe(2); // Registered nodes (current node is not in cluster map)
      expect(health.primaryNodes).toBe(0); // Current node is primary but not in cluster map
      expect(health.secondaryNodes).toBe(1);
      expect(health.clientNodes).toBe(1);
      expect(health.healthyNodes).toBe(2); // All nodes have recent heartbeats
    });

    it('should cleanup all components properly', () => {
      // Initialize system
      ConfigurationManager.loadFromFile(configPath, true);
      NodeRoleManager.initialize();
      CrossDatabaseConfig.initialize();

      // Verify components are initialized
      expect(ConfigurationManager.getCurrentFilePath()).toBeTruthy();
      expect(NodeRoleManager.getCurrentNode()).toBeTruthy();
      expect(CrossDatabaseConfig.getDatabases().length).toBeGreaterThan(0);

      // Cleanup all components
      ConfigurationManager.cleanup();
      NodeRoleManager.cleanup();
      CrossDatabaseConfig.cleanup();

      // Verify cleanup
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(false);
      expect(NodeRoleManager.getCurrentNode()).toBeNull();
      expect(CrossDatabaseConfig.getDatabases()).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing configuration gracefully', () => {
      expect(() => {
        NodeRoleManager.initialize();
      }).toThrow('Configuration has not been loaded');

      expect(() => {
        CrossDatabaseConfig.initialize();
      }).toThrow('Configuration has not been loaded');
    });

    it('should handle invalid node operations', () => {
      ConfigurationManager.loadFromFile(configPath);

      // Try operations without initialization
      expect(() => {
        NodeRoleManager.canPerformOperation('canWrite');
      }).toThrow('Node not initialized');

      expect(() => {
        NodeRoleManager.promoteNode(NodeRole.SECONDARY);
      }).toThrow('Node not initialized');
    });

    it('should handle invalid transaction operations', () => {
      ConfigurationManager.loadFromFile(configPath);
      NodeRoleManager.initialize();
      CrossDatabaseConfig.initialize();

      // Try to start transaction with non-existent database
      expect(() => {
        CrossDatabaseConfig.startTransaction(['non-existent-db']);
      }).toThrow('Database not found: non-existent-db');

      // Try to add operation to non-existent transaction
      expect(() => {
        CrossDatabaseConfig.addOperation('non-existent-tx', {
          databaseId: 'primary',
          type: 'INSERT',
          collection: 'test',
          data: {},
        });
      }).toThrow('Transaction not found: non-existent-tx');
    });
  });
});