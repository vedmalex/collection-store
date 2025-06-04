/**
 * Phase 5.3: Offline-First Support - Day 3 Sync Management Usage Example
 *
 * ✅ IDEA: Comprehensive demonstration of sync management system
 * ✅ IDEA: Real-world usage patterns and best practices
 * ✅ IDEA: Performance monitoring and optimization
 */

import {
  SyncManager,
  OperationQueue,
  NetworkDetector
} from '../index';

import {
  ConflictDetector,
  ClientWinsStrategy,
  ServerWinsStrategy,
  TimestampBasedStrategy,
  MergeStrategy,
  StrategyFactory
} from '../../conflict';

import type {
  QueuedOperation,
  SyncManagerConfig,
  NetworkInfo,
  SyncProgress,
  SyncEvent
} from '../../interfaces';

/**
 * Comprehensive Day 3 Sync Management Example
 */
export class SyncUsageExample {
  private syncManager: SyncManager;
  private operationQueue: OperationQueue;
  private networkDetector: NetworkDetector;
  private conflictDetector: ConflictDetector;

  private stats = {
    operationsProcessed: 0,
    conflictsResolved: 0,
    networkChanges: 0,
    totalSyncTime: 0,
    averageOperationTime: 0
  };

  constructor() {
    this.syncManager = new SyncManager();
    this.operationQueue = new OperationQueue();
    this.networkDetector = new NetworkDetector();
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Initialize the complete sync management system
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Day 3 Sync Management System...');
    const startTime = performance.now();

    // 1. Initialize Operation Queue
    console.log('📋 Initializing Operation Queue...');
    await this.operationQueue.initialize({
      maxSize: 1000,
      persistToDisk: true,
      priorityEnabled: true,
      batchingEnabled: true,
      compressionEnabled: false,
      encryptionEnabled: false,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    });

    // 2. Initialize Network Detector
    console.log('🌐 Initializing Network Detector...');
    await this.networkDetector.initialize({
      enabled: true,
      checkInterval: 30000, // 30 seconds
      timeoutDuration: 5000, // 5 seconds
      testUrls: [
        'https://www.google.com/favicon.ico',
        'https://httpbin.org/status/200'
      ],
      qualityTestEnabled: true,
      bandwidthTestEnabled: false, // Disabled to save bandwidth
      latencyTestEnabled: true
    });

    // 3. Initialize Sync Manager
    console.log('⚡ Initializing Sync Manager...');
    const syncConfig: SyncManagerConfig = {
      syncConfig: {
        enabled: true,
        strategy: 'adaptive',
        batchSize: 10,
        maxRetries: 3,
        retryStrategy: 'exponential',
        syncInterval: 30000, // 30 seconds
        maxQueueSize: 1000,
        priorityThreshold: 5,
        networkQualityThreshold: 'poor',
        autoResolveConflicts: true,
        compressionEnabled: false,
        encryptionEnabled: false,
        backgroundSync: true,
        adaptiveStrategy: true
      },
      queueConfig: {
        maxSize: 1000,
        persistToDisk: true,
        priorityEnabled: true,
        batchingEnabled: true,
        compressionEnabled: false,
        encryptionEnabled: false,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000,
        cleanupInterval: 60 * 60 * 1000
      },
      networkConfig: {
        enabled: true,
        checkInterval: 30000,
        timeoutDuration: 5000,
        testUrls: ['https://www.google.com/favicon.ico'],
        qualityTestEnabled: true,
        bandwidthTestEnabled: false,
        latencyTestEnabled: true
      },
      performanceTargets: {
        maxSyncTime: 5000,
        maxOperationTime: 100,
        maxQueueProcessingTime: 1000,
        targetThroughput: 500
      }
    };

    await this.syncManager.initialize(syncConfig);

    // 4. Set up dependencies
    console.log('🔗 Setting up component dependencies...');

    // Create a mock conflict resolver for demonstration
    const mockConflictResolver = {
      resolveConflict: async (conflict: any) => ({
        conflictId: conflict.id,
        strategy: 'timestamp-based' as const,
        resolvedData: conflict.localData,
        timestamp: Date.now(),
        duration: 10,
        success: true
      }),
      detectConflict: async () => null,
      getPendingConflicts: async () => [],
      setDefaultStrategy: () => {},
      getDefaultStrategy: () => 'timestamp-based' as const,
      registerStrategy: () => {},
      unregisterStrategy: () => {},
      getAvailableStrategies: () => ['timestamp-based' as const],
      getStrategy: () => null,
      getStats: async () => ({
        totalConflicts: 0,
        resolvedConflicts: 0,
        pendingConflicts: 0,
        failedResolutions: 0,
        averageResolutionTime: 0,
        averageDetectionTime: 0,
        strategiesUsed: {
          'client-wins': 0,
          'server-wins': 0,
          'manual': 0,
          'timestamp-based': 0,
          'custom': 0,
          'merge': 0
        },
        conflictTypes: {
          'timestamp': 0,
          'data': 0,
          'delete': 0,
          'schema': 0,
          'field': 0
        },
        severityDistribution: { low: 0, medium: 0, high: 0 }
      }),
      clearConflicts: async () => {},
      setDetector: () => {},
      setStorage: () => {},
      initialize: async () => {},
      shutdown: async () => {},
      processQueue: async () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      resolveConflicts: async () => ({
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        results: [],
        errors: []
      })
    };

    this.syncManager.setDependencies(
      this.operationQueue,
      this.networkDetector,
      mockConflictResolver
    );

    // 5. Set up event listeners
    this.setupEventListeners();

    const duration = performance.now() - startTime;
    console.log(`✅ Sync Management System initialized in ${duration.toFixed(2)}ms`);
  }

  /**
   * Set up comprehensive event listeners
   */
  private setupEventListeners(): void {
    console.log('📡 Setting up event listeners...');

    // Network change events
    this.networkDetector.addEventListener('network-changed', (networkInfo: NetworkInfo) => {
      this.stats.networkChanges++;
      console.log(`🌐 Network changed: ${networkInfo.quality} (${networkInfo.isOnline ? 'online' : 'offline'})`);

      if (networkInfo.latency) {
        console.log(`   Latency: ${networkInfo.latency}ms`);
      }
      if (networkInfo.bandwidth) {
        console.log(`   Bandwidth: ${networkInfo.bandwidth}Mbps`);
      }
    });

    // Sync events
    this.syncManager.addEventListener('sync-started', (event: SyncEvent) => {
      console.log('🔄 Sync started');
    });

    this.syncManager.addEventListener('sync-completed', (event: SyncEvent) => {
      const duration = event.data.duration || 0;
      this.stats.totalSyncTime += duration;
      console.log(`✅ Sync completed in ${duration.toFixed(2)}ms`);
    });

    this.syncManager.addEventListener('sync-failed', (event: SyncEvent) => {
      console.log(`❌ Sync failed: ${event.data.error}`);
    });

    this.syncManager.addEventListener('operation-completed', (event: SyncEvent) => {
      this.stats.operationsProcessed++;
      console.log(`✅ Operation completed: ${event.data.operationId}`);
    });

    this.syncManager.addEventListener('operation-failed', (event: SyncEvent) => {
      console.log(`❌ Operation failed: ${event.data.operationId} - ${event.data.error}`);
    });

    this.syncManager.addEventListener('sync-progress', (event: SyncEvent) => {
      const progress = event.data.progress as SyncProgress;
      if (progress) {
        const percentage = (progress.completedOperations / progress.totalOperations) * 100;
        console.log(`📊 Sync progress: ${percentage.toFixed(1)}% (${progress.completedOperations}/${progress.totalOperations})`);
      }
    });

    this.syncManager.addEventListener('network-changed', (event: SyncEvent) => {
      const networkInfo = event.data.networkInfo as NetworkInfo;
      console.log(`🌐 Sync manager detected network change: ${networkInfo.quality}`);
    });
  }

  /**
   * Start the sync management system
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Sync Management System...');

    // Start network monitoring
    await this.networkDetector.startMonitoring();

    // Start sync manager
    await this.syncManager.start();

    console.log('✅ Sync Management System started successfully');
  }

  /**
   * Demonstrate queuing various types of operations
   */
  async demonstrateOperationQueuing(): Promise<void> {
    console.log('\n📋 Demonstrating Operation Queuing...');

    const operations: QueuedOperation[] = [
      {
        id: 'create-user-1',
        type: 'create',
        collection: 'users',
        operation: {
          id: 'user-op-1',
          type: 'create',
          collection: 'users',
          data: { name: 'Alice', email: 'alice@example.com', age: 28 },
          timestamp: Date.now(),
          status: 'pending',
          priority: 'high',
          retryCount: 0,
          maxRetries: 3
        },
        status: 'pending',
        priority: 8, // High priority
        retryCount: 0,
        maxRetries: 3,
        retryStrategy: 'exponential',
        createdAt: Date.now()
      },
      {
        id: 'update-user-2',
        type: 'update',
        collection: 'users',
        operation: {
          id: 'user-op-2',
          type: 'update',
          collection: 'users',
          data: { id: 'user-123', name: 'Bob Updated', age: 31 },
          timestamp: Date.now(),
          status: 'pending',
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3
        },
        status: 'pending',
        priority: 5, // Normal priority
        retryCount: 0,
        maxRetries: 3,
        retryStrategy: 'exponential',
        createdAt: Date.now()
      },
      {
        id: 'delete-user-3',
        type: 'delete',
        collection: 'users',
        operation: {
          id: 'user-op-3',
          type: 'delete',
          collection: 'users',
          data: { id: 'user-456' },
          timestamp: Date.now(),
          status: 'pending',
          priority: 'low',
          retryCount: 0,
          maxRetries: 3
        },
        status: 'pending',
        priority: 2, // Low priority
        retryCount: 0,
        maxRetries: 3,
        retryStrategy: 'linear',
        createdAt: Date.now()
      }
    ];

    // Queue operations with performance monitoring
    const startTime = performance.now();

    for (const operation of operations) {
      await this.syncManager.queueOperation(operation);
      console.log(`📝 Queued ${operation.type} operation: ${operation.id} (priority: ${operation.priority})`);
    }

    const duration = performance.now() - startTime;
    console.log(`⚡ Queued ${operations.length} operations in ${duration.toFixed(2)}ms`);

    // Check queue status
    const pendingCount = await this.syncManager.getPendingOperationsCount();
    console.log(`📊 Pending operations: ${pendingCount}`);
  }

  /**
   * Demonstrate network quality monitoring
   */
  async demonstrateNetworkMonitoring(): Promise<void> {
    console.log('\n🌐 Demonstrating Network Monitoring...');

    // Get current network info
    const networkInfo = await this.networkDetector.getNetworkInfo();
    console.log('📊 Current Network Status:');
    console.log(`   Online: ${networkInfo.isOnline}`);
    console.log(`   Quality: ${networkInfo.quality}`);
    if (networkInfo.latency) {
      console.log(`   Latency: ${networkInfo.latency}ms`);
    }
    if (networkInfo.bandwidth) {
      console.log(`   Bandwidth: ${networkInfo.bandwidth}Mbps`);
    }
    console.log(`   Connection Type: ${networkInfo.connectionType}`);

    // Test network quality
    const startTime = performance.now();
    const quality = await this.networkDetector.testNetworkQuality();
    const testDuration = performance.now() - startTime;

    console.log(`🧪 Network quality test completed in ${testDuration.toFixed(2)}ms: ${quality}`);

    // Get recommended sync strategy
    const recommendedStrategy = await this.networkDetector.getRecommendedSyncStrategy();
    console.log(`💡 Recommended sync strategy: ${recommendedStrategy}`);

    // Get efficiency score
    const efficiencyScore = await this.networkDetector.getEfficiencyScore();
    console.log(`📈 Network efficiency score: ${efficiencyScore}/100`);

    // Check if suitable for sync
    const suitableForSync = await this.networkDetector.isSuitableForSync();
    console.log(`✅ Suitable for sync: ${suitableForSync}`);
  }

  /**
   * Demonstrate sync strategies and adaptation
   */
  async demonstrateSyncStrategies(): Promise<void> {
    console.log('\n⚡ Demonstrating Sync Strategies...');

    // Get current strategy
    const currentConfig = await this.syncManager.getConfig();
    console.log(`📋 Current sync strategy: ${currentConfig.strategy}`);

    // Test different strategies
    const strategies = ['immediate', 'batched', 'scheduled', 'adaptive'] as const;

    for (const strategy of strategies) {
      console.log(`\n🔄 Testing ${strategy} strategy...`);

      await this.syncManager.setSyncStrategy(strategy);

      // Queue a test operation
      const testOperation: QueuedOperation = {
        id: `test-${strategy}-${Date.now()}`,
        type: 'create',
        collection: 'test',
        operation: {
          id: `test-op-${strategy}`,
          type: 'create',
          collection: 'test',
          data: { strategy, timestamp: Date.now() },
          timestamp: Date.now(),
          status: 'pending',
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3
        },
        status: 'pending',
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        retryStrategy: 'exponential',
        createdAt: Date.now()
      };

      const startTime = performance.now();
      await this.syncManager.queueOperation(testOperation);

      if (strategy === 'immediate') {
        // For immediate strategy, sync should happen automatically
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const duration = performance.now() - startTime;
      console.log(`   ⏱️  ${strategy} strategy processed in ${duration.toFixed(2)}ms`);
    }

    // Reset to adaptive strategy
    await this.syncManager.setSyncStrategy('adaptive');
  }

  /**
   * Demonstrate batch processing
   */
  async demonstrateBatchProcessing(): Promise<void> {
    console.log('\n📦 Demonstrating Batch Processing...');

    // Create multiple operations for batching
    const batchOperations: QueuedOperation[] = [];

    for (let i = 0; i < 15; i++) {
      batchOperations.push({
        id: `batch-op-${i}`,
        type: 'create',
        collection: 'batch-test',
        operation: {
          id: `batch-test-${i}`,
          type: 'create',
          collection: 'batch-test',
          data: { index: i, value: `Item ${i}`, timestamp: Date.now() },
          timestamp: Date.now(),
          status: 'pending',
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3
        },
        status: 'pending',
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        retryStrategy: 'exponential',
        createdAt: Date.now()
      });
    }

    // Queue all operations
    console.log(`📝 Queuing ${batchOperations.length} operations for batch processing...`);

    const queueStartTime = performance.now();
    for (const operation of batchOperations) {
      await this.syncManager.queueOperation(operation);
    }
    const queueDuration = performance.now() - queueStartTime;

    console.log(`⚡ Queued ${batchOperations.length} operations in ${queueDuration.toFixed(2)}ms`);

    // Create and process batch
    console.log('📦 Creating and processing batch...');

    const batchStartTime = performance.now();
    const batch = await this.syncManager.createAndProcessBatch(10); // Process 10 at a time
    const batchDuration = performance.now() - batchStartTime;

    if (batch) {
      console.log(`✅ Processed batch ${batch.id} with ${batch.operations.length} operations in ${batchDuration.toFixed(2)}ms`);
      console.log(`📊 Estimated duration: ${batch.estimatedDuration}ms, Actual: ${batchDuration.toFixed(2)}ms`);
    }

    // Check remaining operations
    const remainingCount = await this.syncManager.getPendingOperationsCount();
    console.log(`📋 Remaining pending operations: ${remainingCount}`);
  }

  /**
   * Demonstrate performance monitoring and optimization
   */
  async demonstratePerformanceMonitoring(): Promise<void> {
    console.log('\n📊 Demonstrating Performance Monitoring...');

    // Get sync statistics
    const syncStats = await this.syncManager.getStats();
    console.log('📈 Sync Statistics:');
    console.log(`   Total Operations: ${syncStats.totalOperations}`);
    console.log(`   Completed: ${syncStats.completedOperations}`);
    console.log(`   Failed: ${syncStats.failedOperations}`);
    console.log(`   Success Rate: ${(syncStats.successRate * 100).toFixed(1)}%`);
    console.log(`   Average Operation Time: ${syncStats.averageOperationTime.toFixed(2)}ms`);
    console.log(`   Network Efficiency: ${syncStats.networkEfficiency}/100`);

    // Get queue statistics
    const queueStats = await this.operationQueue.getStats();
    console.log('\n📋 Queue Statistics:');
    console.log(`   Total Operations: ${queueStats.totalOperations}`);
    console.log(`   Pending: ${queueStats.pendingOperations}`);
    console.log(`   In Progress: ${queueStats.inProgressOperations}`);
    console.log(`   Completed: ${queueStats.completedOperations}`);
    console.log(`   Failed: ${queueStats.failedOperations}`);
    console.log(`   Average Wait Time: ${queueStats.averageWaitTime.toFixed(2)}ms`);

    // Get network statistics
    const networkStats = await this.networkDetector.getStats();
    console.log('\n🌐 Network Statistics:');
    console.log(`   Total Checks: ${networkStats.totalChecks}`);
    console.log(`   Average Latency: ${networkStats.averageLatency.toFixed(2)}ms`);
    console.log(`   Average Bandwidth: ${networkStats.averageBandwidth.toFixed(2)}Mbps`);
    console.log(`   Quality Distribution:`);
    console.log(`     Excellent: ${networkStats.qualityDistribution.excellent}`);
    console.log(`     Good: ${networkStats.qualityDistribution.good}`);
    console.log(`     Poor: ${networkStats.qualityDistribution.poor}`);
    console.log(`     Offline: ${networkStats.qualityDistribution.offline}`);

    // Perform optimization
    console.log('\n🔧 Performing optimization...');
    const optimizationStartTime = performance.now();
    await this.syncManager.optimizePerformance();
    const optimizationDuration = performance.now() - optimizationStartTime;

    console.log(`✅ Optimization completed in ${optimizationDuration.toFixed(2)}ms`);

    // Health check
    const healthCheck = await this.syncManager.healthCheck();
    console.log('\n🏥 Health Check:');
    console.log(`   Healthy: ${healthCheck.isHealthy}`);
    if (healthCheck.issues.length > 0) {
      console.log(`   Issues: ${healthCheck.issues.join(', ')}`);
    }
    console.log(`   Performance:`);
    console.log(`     Average Operation Time: ${healthCheck.performance.averageOperationTime.toFixed(2)}ms`);
    console.log(`     Success Rate: ${(healthCheck.performance.successRate * 100).toFixed(1)}%`);
    console.log(`     Queue Size: ${healthCheck.performance.queueSize}`);
  }

  /**
   * Display comprehensive statistics
   */
  displayStatistics(): void {
    console.log('\n📊 Day 3 Sync Management System Statistics:');
    console.log('=' .repeat(50));
    console.log(`Operations Processed: ${this.stats.operationsProcessed}`);
    console.log(`Conflicts Resolved: ${this.stats.conflictsResolved}`);
    console.log(`Network Changes: ${this.stats.networkChanges}`);
    console.log(`Total Sync Time: ${this.stats.totalSyncTime.toFixed(2)}ms`);

    if (this.stats.operationsProcessed > 0) {
      this.stats.averageOperationTime = this.stats.totalSyncTime / this.stats.operationsProcessed;
      console.log(`Average Operation Time: ${this.stats.averageOperationTime.toFixed(2)}ms`);
    }

    console.log('=' .repeat(50));
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down Sync Management System...');

    await this.syncManager.stop();
    await this.networkDetector.shutdown();
    await this.operationQueue.shutdown();

    console.log('✅ Sync Management System shut down successfully');
  }
}

/**
 * Run the comprehensive Day 3 demonstration
 */
export async function runSyncUsageExample(): Promise<void> {
  const example = new SyncUsageExample();

  try {
    // Initialize system
    await example.initialize();
    await example.start();

    // Run demonstrations
    await example.demonstrateOperationQueuing();
    await example.demonstrateNetworkMonitoring();
    await example.demonstrateSyncStrategies();
    await example.demonstrateBatchProcessing();
    await example.demonstratePerformanceMonitoring();

    // Display final statistics
    example.displayStatistics();

    // Cleanup
    await example.shutdown();

  } catch (error) {
    console.error('❌ Error in sync usage example:', error);
  }
}

// Export for use in other modules
export default SyncUsageExample;