/// <reference lib="dom" />
// src/browser-sdk/config/ConfigLoader.ts

import { BrowserConfig, ConfigFetchResult, ConfigSource, ConfigChangeHandler } from './types';
import { BrowserStorageManager } from '../storage/BrowserStorageManager';

/**
 * Manages loading and caching of browser-specific configurations.
 */
export class ConfigLoader {
  private browserStorageManager: BrowserStorageManager;
  private remoteConfigUrl: string;
  private configCacheKey: string = 'browser_config_cache';
  private currentConfig: BrowserConfig | null = null;
  private changeHandlers: ConfigChangeHandler[] = [];

  constructor(browserStorageManager: BrowserStorageManager, remoteConfigUrl: string) {
    this.browserStorageManager = browserStorageManager;
    this.remoteConfigUrl = remoteConfigUrl;
  }

  /**
   * Initializes the config loader by attempting to load from cache, then remote.
   * @returns A promise that resolves with the loaded configuration.
   */
  async initialize(): Promise<BrowserConfig> {
    await this.browserStorageManager.initialize(); // Ensure storage is ready

    const cachedConfig = await this.loadLocalCache();
    if (cachedConfig) {
      this.currentConfig = cachedConfig;
      console.log('Configuration loaded from local cache.', cachedConfig);
      return cachedConfig;
    }

    const remoteConfigResult = await this.fetchRemoteConfig();
    if (remoteConfigResult.success && remoteConfigResult.config) {
      this.currentConfig = remoteConfigResult.config;
      await this.saveLocalCache(remoteConfigResult.config);
      console.log('Configuration loaded from remote.', remoteConfigResult.config);
      return remoteConfigResult.config;
    }

    // Fallback to a default configuration if neither cache nor remote is available
    const defaultConfig = this.getDefaultConfig();
    this.currentConfig = defaultConfig;
    console.warn('Failed to load configuration. Using default config.', defaultConfig);
    return defaultConfig;
  }

  /**
   * Fetches the configuration from a remote URL.
   * @returns A promise that resolves with the fetch result.
   */
  async fetchRemoteConfig(): Promise<ConfigFetchResult> {
    try {
      const response = await fetch(this.remoteConfigUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const config: BrowserConfig = await response.json();
      return { success: true, config };
    } catch (e: any) {
      console.error('Error fetching remote config:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Loads the configuration from local storage cache.
   * @returns A promise that resolves with the cached configuration, or null if not found.
   */
  private async loadLocalCache(): Promise<BrowserConfig | null> {
    try {
      const config = await this.browserStorageManager.read<BrowserConfig>(this.configCacheKey);
      return config;
    } catch (e) {
      console.error('Error loading config from local cache:', e);
      return null;
    }
  }

  /**
   * Saves the configuration to local storage cache.
   * @param config The configuration to save.
   * @returns A promise that resolves when the configuration has been saved.
   */
  private async saveLocalCache(config: BrowserConfig): Promise<void> {
    try {
      await this.browserStorageManager.write(this.configCacheKey, config);
    } catch (e) {
      console.error('Error saving config to local cache:', e);
    }
  }

  /**
   * Returns a default configuration.
   * @returns The default browser configuration.
   */
  private getDefaultConfig(): BrowserConfig {
    return {
      apiUrl: '/api/v6/config',
      debugMode: false,
      storageStrategy: 'IndexedDB',
      syncIntervalMs: 60000, // 1 minute
      featureToggles: {},
    };
  }

  /**
   * Gets the currently active configuration.
   * @returns The current BrowserConfig, or null if not initialized.
   */
  getCurrentConfig(): BrowserConfig | null {
    return this.currentConfig;
  }

  /**
   * Registers a handler for configuration changes.
   * @param handler The function to call when configuration changes.
   */
  onConfigChange(handler: ConfigChangeHandler): void {
    this.changeHandlers.push(handler);
  }

  /**
   * Unregisters a configuration change handler.
   * @param handler The handler to remove.
   */
  offConfigChange(handler: ConfigChangeHandler): void {
    this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
  }

  private emitConfigChange(newConfig: BrowserConfig): void {
    this.changeHandlers.forEach(handler => handler(newConfig));
  }

  /**
   * Updates the current configuration and notifies listeners.
   * This method could be called after a successful remote fetch or a manual update.
   * @param newConfig The new configuration to apply.
   * @param source The source of the new configuration (e.g., Remote, LocalCache).
   */
  async updateConfig(newConfig: BrowserConfig, source: ConfigSource = ConfigSource.Default): Promise<void> {
    const oldConfig = this.currentConfig;
    this.currentConfig = newConfig;
    await this.saveLocalCache(newConfig);

    // Only emit if config has actually changed (deep comparison might be needed for complex objects)
    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      this.emitConfigChange(newConfig);
      console.log(`Configuration updated from ${source} source.`, newConfig);
    }
  }

  /**
   * Triggers a refresh of the configuration from the remote source.
   * @returns A promise that resolves with the refreshed configuration, or null on error.
   */
  async refreshConfig(): Promise<BrowserConfig | null> {
    const remoteConfigResult = await this.fetchRemoteConfig();
    if (remoteConfigResult.success && remoteConfigResult.config) {
      await this.updateConfig(remoteConfigResult.config, ConfigSource.Remote);
      return remoteConfigResult.config;
    }
    console.warn('Failed to refresh configuration from remote.', remoteConfigResult.error);
    return null;
  }
}