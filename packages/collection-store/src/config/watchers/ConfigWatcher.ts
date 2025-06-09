import * as fs from 'fs';
import { CollectionStoreConfig } from '../schemas/CollectionStoreConfig';
import { ConfigurationManager } from '../ConfigurationManager';

type ConfigChangeCallback = (config: CollectionStoreConfig) => void;

export class ConfigWatcher {
  private static watchers: Map<string, fs.FSWatcher> = new Map();

  /**
   * Watches a configuration file for changes and reloads it automatically.
   *
   * @param filePath The path to the configuration file.
   * @param callback An optional callback to execute when the config is successfully reloaded.
   */
  public static watch(filePath: string, callback?: ConfigChangeCallback): void {
    if (this.watchers.has(filePath)) {
      console.warn(`Already watching file: ${filePath}`);
      return;
    }

    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        try {
          console.log(`Configuration file changed: ${filePath}. Reloading...`);
          const newConfig = ConfigurationManager.loadFromFile(filePath);
          if (callback) {
            callback(newConfig);
          }
        } catch (error) {
          console.error(`Error reloading configuration from ${filePath}:`, error);
        }
      }
    });

    this.watchers.set(filePath, watcher);
    console.log(`Started watching configuration file: ${filePath}`);
  }

  /**
   * Stops watching a specific configuration file.
   *
   * @param filePath The path to the configuration file.
   */
  public static unwatch(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
      console.log(`Stopped watching configuration file: ${filePath}`);
    }
  }

  /**
   * Stops all active file watchers.
   */
  public static unwatchAll(): void {
    for (const filePath of this.watchers.keys()) {
      this.unwatch(filePath);
    }
  }
}
