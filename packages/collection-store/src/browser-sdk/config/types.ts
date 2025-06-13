/**
 * Defines the structure for browser-specific configuration.
 */
export interface BrowserConfig {
  apiUrl: string;
  debugMode: boolean;
  storageStrategy: string; // e.g., 'IndexedDB', 'LocalStorage', 'Memory'
  syncIntervalMs: number; // Interval for offline sync in milliseconds
  featureToggles?: Record<string, boolean>; // Feature toggle flags
  // Add other browser-specific configurations as needed
}

/**
 * Defines the result of a configuration fetch operation.
 */
export interface ConfigFetchResult {
  success: boolean;
  config?: BrowserConfig;
  error?: string;
}

/**
 * Defines the source of the configuration.
 */
export enum ConfigSource {
  Remote = 'remote',
  LocalCache = 'localCache',
  Default = 'default',
}

/**
 * Callback for configuration change events.
 */
export type ConfigChangeHandler = (newConfig: BrowserConfig) => void;
