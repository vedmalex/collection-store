import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigurationManager } from '../ConfigurationManager';
import { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';

describe('ConfigurationManager Hot Reload', () => {
  let tempDir: string;
  let configPath: string;
  let originalConfig: any;
  let updatedConfig: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    configPath = path.join(tempDir, 'test-config.yaml');

    // Base configuration for testing
    originalConfig = {
      core: {
        name: 'test-store',
        version: '1.0.0',
        environment: 'development',
        nodeId: 'test-node-1',
        hotReload: {
          enabled: true,
          debounceMs: 50,
        },
      },
      adapters: {},
      features: {
        replication: { enabled: false },
        realtime: { enabled: false },
        offline: { enabled: false },
        analytics: { enabled: false },
      },
      indexManager: {
        enabled: true,
        btreeOptions: { degree: 3 },
        performance: { cacheSize: 1000 },
        transactions: { enabled: true },
      },
    };

    updatedConfig = {
      ...originalConfig,
      core: {
        ...originalConfig.core,
        name: 'updated-test-store',
        version: '2.0.0',
      },
    };

    // Write initial config file
    fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));

    // Clear any existing configuration
    ConfigurationManager.cleanup();
  });

  afterEach(() => {
    // Cleanup
    ConfigurationManager.cleanup();

    // Remove temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Hot Reload Functionality', () => {
    it('should load configuration with hot reload enabled', () => {
      const config = ConfigurationManager.loadFromFile(configPath, true);

      expect(config.core.name).toBe('test-store');
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(true);
      expect(ConfigurationManager.getCurrentFilePath()).toBe(configPath);
    });

    it('should load configuration without hot reload by default', () => {
      const config = ConfigurationManager.loadFromFile(configPath);

      expect(config.core.name).toBe('test-store');
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(false);
    });

    it('should enable hot reload after loading', () => {
      ConfigurationManager.loadFromFile(configPath);
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(false);

      ConfigurationManager.enableHotReload();
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(true);
    });

    it('should disable hot reload', () => {
      ConfigurationManager.loadFromFile(configPath, true);
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(true);

      ConfigurationManager.disableHotReload();
      expect(ConfigurationManager.isHotReloadEnabled()).toBe(false);
    });
  });

  describe('Configuration Change Detection', () => {
    it('should detect file changes and reload configuration', async () => {
      // Load initial configuration with hot reload
      ConfigurationManager.loadFromFile(configPath, true);

      let changeDetected = false;
      let newConfig: CollectionStoreConfig | null = null;
      let previousConfig: CollectionStoreConfig | null = null;

            // Register change callback
      const callback = (config: CollectionStoreConfig, prev: CollectionStoreConfig | null) => {
        changeDetected = true;
        newConfig = config;
        previousConfig = prev;
      };

      ConfigurationManager.onConfigChange(callback);

      // Wait a bit to ensure watcher is set up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the configuration file
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      // Wait for file change detection and processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(changeDetected).toBe(true);
      expect(newConfig!.core.name).toBe('updated-test-store');
      expect(newConfig!.core.version).toBe('2.0.0');
      // Previous config should be the original config
      expect(previousConfig).toBeTruthy();

      // Cleanup callback
      ConfigurationManager.offConfigChange(callback);
    });

    it('should handle multiple change callbacks', async () => {
      ConfigurationManager.loadFromFile(configPath, true);

      let callback1Called = false;
      let callback2Called = false;

      const callback1 = () => { callback1Called = true; };
      const callback2 = () => { callback2Called = true; };

      ConfigurationManager.onConfigChange(callback1);
      ConfigurationManager.onConfigChange(callback2);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Update configuration
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);

      // Cleanup callbacks
      ConfigurationManager.offConfigChange(callback1);
      ConfigurationManager.offConfigChange(callback2);
    });

    it('should remove specific callbacks', async () => {
      ConfigurationManager.loadFromFile(configPath, true);

      let callback1Called = false;
      let callback2Called = false;

      const callback1 = () => { callback1Called = true; };
      const callback2 = () => { callback2Called = true; };

      ConfigurationManager.onConfigChange(callback1);
      ConfigurationManager.onConfigChange(callback2);

      // Remove only callback1
      ConfigurationManager.offConfigChange(callback1);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Update configuration
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(callback1Called).toBe(false);
      expect(callback2Called).toBe(true);

      // Cleanup remaining callback
      ConfigurationManager.offConfigChange(callback2);
    });
  });

  describe('Manual Reload', () => {
    it('should manually reload configuration', () => {
      ConfigurationManager.loadFromFile(configPath);

      let initialConfig = ConfigurationManager.getConfig();
      expect(initialConfig.core.name).toBe('test-store');

      // Update file
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      // Manual reload
      const reloadedConfig = ConfigurationManager.reloadConfig();
      expect(reloadedConfig.core.name).toBe('updated-test-store');
      expect(reloadedConfig.core.version).toBe('2.0.0');
    });

    it('should trigger callbacks on manual reload', () => {
      ConfigurationManager.loadFromFile(configPath);

      let callbackTriggered = false;
      let newConfig: CollectionStoreConfig | null = null;

      ConfigurationManager.onConfigChange((config) => {
        callbackTriggered = true;
        newConfig = config;
      });

      // Update file
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      // Manual reload
      ConfigurationManager.reloadConfig();

      expect(callbackTriggered).toBe(true);
             expect(newConfig!.core.name).toBe('updated-test-store');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration during hot reload', async () => {
      ConfigurationManager.loadFromFile(configPath, true);

      let errorOccurred = false;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        errorOccurred = true;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Write invalid configuration
      const invalidConfig = { invalid: 'config' };
      fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2));

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorOccurred).toBe(true);

      // Configuration should remain unchanged
      const currentConfig = ConfigurationManager.getConfig();
      expect(currentConfig.core.name).toBe('test-store');

      consoleSpy.mockRestore();
    });

    it('should throw error when enabling hot reload without loaded config', () => {
      // Create a fresh ConfigurationManager instance without loading config
      ConfigurationManager.cleanup();

      expect(() => {
        ConfigurationManager.enableHotReload();
      }).toThrow('No configuration file loaded');
    });

    it('should throw error when manually reloading without loaded config', () => {
      // Create a fresh ConfigurationManager instance without loading config
      ConfigurationManager.cleanup();

      expect(() => {
        ConfigurationManager.reloadConfig();
      }).toThrow('No configuration file loaded');
    });
  });

  describe('Environment Configuration Integration', () => {
    it('should handle environment-specific configuration changes', async () => {
      const envConfig = {
        ...originalConfig,
        environment: {
          environment: 'development',
          development: {
            debug: true,
            logLevel: 'debug',
            hotReload: true,
          },
        },
      };

      fs.writeFileSync(configPath, JSON.stringify(envConfig, null, 2));
      ConfigurationManager.loadFromFile(configPath, true);

      let changeDetected = false;
      ConfigurationManager.onConfigChange(() => {
        changeDetected = true;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Update environment configuration
      const updatedEnvConfig = {
        ...envConfig,
        environment: {
          ...envConfig.environment,
          development: {
            ...envConfig.environment.development,
            debug: false,
            logLevel: 'info',
          },
        },
      };

      fs.writeFileSync(configPath, JSON.stringify(updatedEnvConfig, null, 2));
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(changeDetected).toBe(true);

      const currentConfig = ConfigurationManager.getConfig();
      expect(currentConfig.environment?.development?.debug).toBe(false);
      expect(currentConfig.environment?.development?.logLevel).toBe('info');
    });
  });

  describe('IndexManager Integration', () => {
    it('should handle IndexManager configuration changes', async () => {
      ConfigurationManager.loadFromFile(configPath, true);

      let changeDetected = false;
      let newConfig: CollectionStoreConfig | null = null;

      ConfigurationManager.onConfigChange((config) => {
        changeDetected = true;
        newConfig = config;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Update IndexManager configuration
      const updatedIndexManagerConfig = {
        ...originalConfig,
        indexManager: {
          enabled: true,
          btreeOptions: { degree: 5, unique: true },
          performance: { cacheSize: 2000, enableProfiling: true },
          transactions: { enabled: true, timeout: 10000 },
        },
      };

      fs.writeFileSync(configPath, JSON.stringify(updatedIndexManagerConfig, null, 2));
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(changeDetected).toBe(true);
      expect(newConfig!.indexManager.btreeOptions?.degree).toBe(5);
      expect(newConfig!.indexManager.btreeOptions?.unique).toBe(true);
      expect(newConfig!.indexManager.performance?.cacheSize).toBe(2000);
      expect(newConfig!.indexManager.performance?.enableProfiling).toBe(true);
      expect(newConfig!.indexManager.transactions?.timeout).toBe(10000);
    });
  });
});