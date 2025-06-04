/**
 * Phase 5.3: Offline-First Support - Basic Usage Example
 *
 * ✅ IDEA: Demonstrate core offline functionality
 * ✅ IDEA: Show performance monitoring
 * ✅ IDEA: Illustrate event handling
 */

import {
  OfflineManager,
  LocalDataCache,
  StorageOptimizer,
  type OfflineConfig,
  type CacheConfig
} from '../index';

/**
 * Basic offline-first usage example
 */
export class OfflineExample {
  private offlineManager: OfflineManager;
  private cache: LocalDataCache;
  private optimizer: StorageOptimizer;

  constructor() {
    this.offlineManager = new OfflineManager();
    this.cache = new LocalDataCache();
    this.optimizer = new StorageOptimizer();
  }

  /**
   * Initialize offline infrastructure
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing offline-first infrastructure...');
    const startTime = performance.now();

    try {
      // Configure offline manager
      const offlineConfig: Partial<OfflineConfig> = {
        enabled: true,
        maxStorageSize: 50 * 1024 * 1024, // 50MB
        maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        conflictResolution: 'timestamp-based',
        networkDetection: true,
        autoSync: true
      };

      // Configure cache
      const cacheConfig: Partial<CacheConfig> = {
        maxSize: 50 * 1024 * 1024, // 50MB
        compressionEnabled: true,
        optimizationStrategy: 'lru',
        cleanupInterval: 60 * 60 * 1000 // 1 hour
      };

      // Initialize components
      await this.cache.initialize(cacheConfig);
      await this.offlineManager.initialize(offlineConfig);

      // Set up dependencies
      this.offlineManager.setDependencies(this.cache);

      // Set up event listeners
      this.setupEventListeners();

      const duration = performance.now() - startTime;
      console.log(`✅ Offline infrastructure initialized in ${duration.toFixed(2)}ms`);

    } catch (error) {
      console.error('❌ Failed to initialize offline infrastructure:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for offline state changes
   */
  private setupEventListeners(): void {
    this.offlineManager.addEventListener('offline-mode-changed', (event) => {
      console.log(`📡 Offline mode changed: ${event.data.offlineMode ? 'OFFLINE' : 'ONLINE'}`);
    });

    this.offlineManager.addEventListener('network-status-changed', (event) => {
      console.log(`🌐 Network status: ${event.data.status}`);
    });

    this.offlineManager.addEventListener('cache-cleared', (event) => {
      console.log(`🗑️ Cache cleared in ${event.data.duration.toFixed(2)}ms`);
    });
  }

  /**
   * Demonstrate caching operations
   */
  async demonstrateCaching(): Promise<void> {
    console.log('\n📦 Demonstrating caching operations...');

    try {
      // Store user data
      const userData = {
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        preferences: {
          theme: 'dark',
          notifications: true
        },
        lastLogin: Date.now()
      };

      const startTime = performance.now();
      await this.cache.set('users', 'user123', userData);
      const setDuration = performance.now() - startTime;

      console.log(`✅ User data cached in ${setDuration.toFixed(2)}ms`);

      // Retrieve user data
      const retrieveStart = performance.now();
      const cachedUser = await this.cache.get('users', 'user123');
      const getDuration = performance.now() - retrieveStart;

      console.log(`✅ User data retrieved in ${getDuration.toFixed(2)}ms`);
      console.log(`👤 Cached user: ${cachedUser?.data.name}`);

      // Demonstrate batch operations
      const batchStart = performance.now();
      await this.cache.batch([
        { operation: 'set', collection: 'posts', id: 'post1', data: { title: 'First Post', content: 'Hello World' } },
        { operation: 'set', collection: 'posts', id: 'post2', data: { title: 'Second Post', content: 'Offline First' } },
        { operation: 'set', collection: 'settings', id: 'app', data: { version: '1.0.0', debug: false } }
      ]);
      const batchDuration = performance.now() - batchStart;

      console.log(`✅ Batch operations completed in ${batchDuration.toFixed(2)}ms`);

    } catch (error) {
      console.error('❌ Caching demonstration failed:', error);
    }
  }

  /**
   * Demonstrate storage optimization
   */
  async demonstrateOptimization(): Promise<void> {
    console.log('\n🔧 Demonstrating storage optimization...');

    try {
      // Get current cache statistics
      const stats = await this.cache.getStats();
      console.log(`📊 Cache stats: ${stats.entryCount} entries, ${(stats.usedSize / 1024).toFixed(2)}KB used`);

      // Check if optimization is needed
      const needsOptimization = this.optimizer.isOptimizationNeeded(stats);
      console.log(`🔍 Optimization needed: ${needsOptimization ? 'YES' : 'NO'}`);

      if (needsOptimization) {
        // Get all entries for optimization
        const allEntries = await this.cache.export();
        const flatEntries = Object.values(allEntries).flat();

        // Run optimization
        const optimizationStart = performance.now();
        const entriesToRemove = await this.optimizer.optimize(flatEntries, stats);
        const optimizationDuration = performance.now() - optimizationStart;

        console.log(`✅ Optimization completed in ${optimizationDuration.toFixed(2)}ms`);
        console.log(`🗑️ Recommended for removal: ${entriesToRemove.length} entries`);

        // Get optimization statistics
        const optimizationStats = this.optimizer.getOptimizationStats(flatEntries);
        console.log(`📈 Optimization stats:`, {
          totalEntries: optimizationStats.totalEntries,
          totalSize: `${(optimizationStats.totalSize / 1024).toFixed(2)}KB`,
          averageSize: `${(optimizationStats.averageSize / 1024).toFixed(2)}KB`
        });
      }

    } catch (error) {
      console.error('❌ Optimization demonstration failed:', error);
    }
  }

  /**
   * Demonstrate network status monitoring
   */
  async demonstrateNetworkMonitoring(): Promise<void> {
    console.log('\n🌐 Demonstrating network monitoring...');

    try {
      const networkInfo = this.offlineManager.getNetworkInfo();
      console.log(`📡 Current network status: ${networkInfo.status}`);
      console.log(`⏰ Last updated: ${new Date(networkInfo.timestamp).toLocaleTimeString()}`);

      // Simulate offline mode
      console.log('🔄 Simulating offline mode...');
      await this.offlineManager.enableOfflineMode();
      console.log(`📴 Offline mode: ${this.offlineManager.isOfflineMode()}`);

      // Simulate back online
      setTimeout(async () => {
        console.log('🔄 Simulating back online...');
        await this.offlineManager.disableOfflineMode();
        console.log(`📶 Offline mode: ${this.offlineManager.isOfflineMode()}`);
      }, 2000);

    } catch (error) {
      console.error('❌ Network monitoring demonstration failed:', error);
    }
  }

  /**
   * Get comprehensive statistics
   */
  async getStatistics(): Promise<void> {
    console.log('\n📊 Comprehensive Statistics:');

    try {
      const storageStats = await this.offlineManager.getStorageStats();
      const syncStats = await this.offlineManager.getSyncStats();
      const config = this.offlineManager.getConfig();

      console.log('💾 Storage Statistics:', {
        totalSize: `${(storageStats.totalSize / 1024 / 1024).toFixed(2)}MB`,
        usedSize: `${(storageStats.usedSize / 1024).toFixed(2)}KB`,
        entryCount: storageStats.entryCount,
        collections: Object.keys(storageStats.collections).length
      });

      console.log('🔄 Sync Statistics:', {
        pendingOperations: syncStats.pendingOperations,
        syncedOperations: syncStats.syncedOperations,
        failedOperations: syncStats.failedOperations
      });

      console.log('⚙️ Configuration:', {
        enabled: config.enabled,
        maxStorageSize: `${(config.maxStorageSize / 1024 / 1024).toFixed(2)}MB`,
        conflictResolution: config.conflictResolution,
        networkDetection: config.networkDetection
      });

    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...');

    try {
      await this.cache.shutdown();
      await this.offlineManager.shutdown();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

/**
 * Run the complete offline example
 */
export async function runOfflineExample(): Promise<void> {
  console.log('🎯 Phase 5.3 Offline-First Support - Basic Usage Example\n');

  const example = new OfflineExample();

  try {
    // Initialize
    await example.initialize();

    // Demonstrate features
    await example.demonstrateCaching();
    await example.demonstrateOptimization();
    await example.demonstrateNetworkMonitoring();

    // Show statistics
    await example.getStatistics();

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Cleanup
    await example.cleanup();

    console.log('\n🎉 Offline example completed successfully!');

  } catch (error) {
    console.error('❌ Offline example failed:', error);
  }
}

// Export for use in other modules
export default OfflineExample;