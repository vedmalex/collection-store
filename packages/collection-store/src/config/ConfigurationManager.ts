import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { CollectionStoreConfig, CollectionStoreConfigSchema } from './schemas/CollectionStoreConfig';
import { fromZodError } from 'zod-validation-error';
import { ConfigWatcher } from './watchers/ConfigWatcher';

// Hot Reload callback type
type ConfigChangeCallback = (config: CollectionStoreConfig, previousConfig: CollectionStoreConfig | null) => void;

export class ConfigurationManager {
  private static currentConfig: CollectionStoreConfig | null = null;
  private static currentFilePath: string | null = null;
  private static hotReloadEnabled: boolean = false;
  private static changeCallbacks: Set<ConfigChangeCallback> = new Set();

  /**
   * Loads, validates, and sets the configuration from a file.
   * Supports YAML (.yaml, .yml) and JSON (.json) formats.
   *
   * @param filePath The path to the configuration file.
   * @param enableHotReload Whether to enable hot reload for this configuration file.
   * @returns The validated configuration object.
   * @throws {Error} If the file is not found, cannot be parsed, or is invalid.
   */
  public static loadFromFile(filePath: string, enableHotReload: boolean = false): CollectionStoreConfig {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Configuration file not found at: ${absolutePath}`);
    }

    const fileContents = fs.readFileSync(absolutePath, 'utf8');
    const extension = path.extname(absolutePath).toLowerCase();

    let parsedConfig: unknown;

    try {
      if (extension === '.yaml' || extension === '.yml') {
        parsedConfig = yaml.load(fileContents);
      } else if (extension === '.json') {
        parsedConfig = JSON.parse(fileContents);
      } else {
        throw new Error(`Unsupported configuration file format: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${(error as Error).message}`);
    }

    const validationResult = CollectionStoreConfigSchema.safeParse(parsedConfig);

    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      throw new Error(`Configuration validation failed: ${validationError.message}`);
    }

    const previousConfig = this.currentConfig;
    this.currentConfig = validationResult.data;
    this.currentFilePath = absolutePath;

    // Setup hot reload if requested
    if (enableHotReload && !this.hotReloadEnabled) {
      this.enableHotReload();
    }

    // Notify callbacks about configuration change
    this.notifyConfigChange(this.currentConfig, previousConfig);

    return this.currentConfig;
  }

  /**
   * Gets the currently loaded configuration.
   *
   * @returns The configuration object.
   * @throws {Error} If no configuration has been loaded yet.
   */
  public static getConfig(): CollectionStoreConfig {
    if (!this.currentConfig) {
      throw new Error('Configuration has not been loaded. Call loadFromFile() first.');
    }
    return this.currentConfig;
  }

  /**
   * Enables hot reload for the currently loaded configuration file.
   * Configuration will be automatically reloaded when the file changes.
   */
  public static enableHotReload(): void {
    if (!this.currentFilePath) {
      throw new Error('No configuration file loaded. Call loadFromFile() first.');
    }

    if (this.hotReloadEnabled) {
      console.warn('Hot reload is already enabled');
      return;
    }

    ConfigWatcher.watch(this.currentFilePath, (newConfig) => {
      const previousConfig = this.currentConfig;
      this.currentConfig = newConfig;
      this.notifyConfigChange(newConfig, previousConfig);
    });

    this.hotReloadEnabled = true;
    console.log(`Hot reload enabled for configuration file: ${this.currentFilePath}`);
  }

  /**
   * Disables hot reload for the configuration file.
   */
  public static disableHotReload(): void {
    if (!this.hotReloadEnabled || !this.currentFilePath) {
      return;
    }

    ConfigWatcher.unwatch(this.currentFilePath);
    this.hotReloadEnabled = false;
    console.log('Hot reload disabled');
  }

  /**
   * Registers a callback to be called when configuration changes.
   * Useful for components that need to react to configuration updates.
   *
   * @param callback Function to call when configuration changes
   */
  public static onConfigChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.add(callback);
  }

  /**
   * Unregisters a configuration change callback.
   *
   * @param callback Function to remove from callbacks
   */
  public static offConfigChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.delete(callback);
  }

  /**
   * Manually reload configuration from the current file.
   * Useful for forcing a reload without file system changes.
   */
  public static reloadConfig(): CollectionStoreConfig {
    if (!this.currentFilePath) {
      throw new Error('No configuration file loaded. Call loadFromFile() first.');
    }

    return this.loadFromFile(this.currentFilePath, this.hotReloadEnabled);
  }

  /**
   * Gets the current configuration file path.
   */
  public static getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Checks if hot reload is currently enabled.
   */
  public static isHotReloadEnabled(): boolean {
    return this.hotReloadEnabled;
  }

  /**
   * Gets environment-specific configuration.
   * Merges base configuration with environment-specific overrides.
   */
  public static getEnvironmentConfig(): CollectionStoreConfig {
    const config = this.getConfig();
    const environment = config.core.environment;

    // In the future, this could load environment-specific overrides
    // For now, return the current config
    return config;
  }

  /**
   * Validates a configuration object without loading it.
   *
   * @param config Configuration object to validate
   * @returns Validation result
   */
  public static validateConfig(config: unknown): { valid: boolean; error?: string; data?: CollectionStoreConfig } {
    const validationResult = CollectionStoreConfigSchema.safeParse(config);

    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return { valid: false, error: validationError.message };
    }

    return { valid: true, data: validationResult.data };
  }

  /**
   * Notifies all registered callbacks about configuration changes.
   */
  private static notifyConfigChange(newConfig: CollectionStoreConfig, previousConfig: CollectionStoreConfig | null): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(newConfig, previousConfig);
      } catch (error) {
        console.error('Error in configuration change callback:', error);
      }
    }
  }

  /**
   * Cleanup method to stop all watchers and clear callbacks.
   * Should be called when shutting down the application.
   */
  public static cleanup(): void {
    this.disableHotReload();
    this.changeCallbacks.clear();
    ConfigWatcher.unwatchAll();
    // Clear all state
    this.currentConfig = null;
    this.currentFilePath = null;
    this.hotReloadEnabled = false;
  }
}
