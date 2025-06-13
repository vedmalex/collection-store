import * as fs from 'fs';
import * as path from 'path';

export interface FileWatcherOptions {
  debounceMs?: number;
  recursive?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: fs.Stats;
}

export type FileChangeCallback = (event: FileChangeEvent) => void;

export class FileWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: Map<string, Set<FileChangeCallback>> = new Map();

  /**
   * Watch a file or directory for changes.
   *
   * @param targetPath Path to file or directory to watch
   * @param callback Function to call when changes occur
   * @param options Watch options
   */
  public watch(
    targetPath: string,
    callback: FileChangeCallback,
    options: FileWatcherOptions = {}
  ): void {
    const {
      debounceMs = 100,
      recursive = false,
      ignoreInitial = true,
      followSymlinks = false,
    } = options;

    const absolutePath = path.resolve(targetPath);

    // Check if path exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }

    // Initialize callback set for this path
    if (!this.callbacks.has(absolutePath)) {
      this.callbacks.set(absolutePath, new Set());
    }
    this.callbacks.get(absolutePath)!.add(callback);

    // If already watching this path, just add the callback
    if (this.watchers.has(absolutePath)) {
      return;
    }

    try {
      const watcher = fs.watch(
        absolutePath,
        { recursive, persistent: true },
        (eventType, filename) => {
          if (!filename) return;

          const fullPath = path.join(absolutePath, filename);
          const watchKey = `${absolutePath}:${filename}`;

          // Clear existing debounce timer
          const existingTimer = this.debounceTimers.get(watchKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Set new debounce timer
          const timer = setTimeout(() => {
            this.handleFileChange(absolutePath, fullPath, eventType, followSymlinks);
            this.debounceTimers.delete(watchKey);
          }, debounceMs);

          this.debounceTimers.set(watchKey, timer);
        }
      );

      watcher.on('error', (error) => {
        console.error(`File watcher error for ${absolutePath}:`, error);
        this.unwatch(absolutePath);
      });

      this.watchers.set(absolutePath, watcher);
      console.log(`Started watching: ${absolutePath}`);

    } catch (error) {
      throw new Error(`Failed to watch ${absolutePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Stop watching a specific path.
   *
   * @param targetPath Path to stop watching
   * @param callback Optional specific callback to remove
   */
  public unwatch(targetPath: string, callback?: FileChangeCallback): void {
    const absolutePath = path.resolve(targetPath);

    if (callback) {
      // Remove specific callback
      const callbacks = this.callbacks.get(absolutePath);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(absolutePath);
          this.stopWatching(absolutePath);
        }
      }
    } else {
      // Remove all callbacks and stop watching
      this.callbacks.delete(absolutePath);
      this.stopWatching(absolutePath);
    }
  }

  /**
   * Stop watching all paths.
   */
  public unwatchAll(): void {
    for (const path of this.watchers.keys()) {
      this.stopWatching(path);
    }
    this.callbacks.clear();
  }

  /**
   * Get list of currently watched paths.
   */
  public getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Check if a path is currently being watched.
   */
  public isWatching(targetPath: string): boolean {
    const absolutePath = path.resolve(targetPath);
    return this.watchers.has(absolutePath);
  }

  private stopWatching(absolutePath: string): void {
    const watcher = this.watchers.get(absolutePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(absolutePath);
      console.log(`Stopped watching: ${absolutePath}`);
    }

    // Clear any pending debounce timers for this path
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(absolutePath + ':')) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
  }

  private handleFileChange(
    watchedPath: string,
    filePath: string,
    eventType: string,
    followSymlinks: boolean
  ): void {
    try {
      let stats: fs.Stats | undefined;
      let changeType: FileChangeEvent['type'];

      // Determine change type and get stats if file exists
      if (fs.existsSync(filePath)) {
        stats = fs.statSync(filePath, { throwIfNoEntry: false });

        if (stats) {
          if (stats.isSymbolicLink() && !followSymlinks) {
            return; // Skip symlinks if not following them
          }

          if (eventType === 'rename') {
            changeType = stats.isDirectory() ? 'addDir' : 'add';
          } else {
            changeType = stats.isDirectory() ? 'addDir' : 'change';
          }
        } else {
          changeType = 'change'; // File exists but can't stat
        }
      } else {
        // File was deleted
        changeType = eventType === 'rename' ? 'unlink' : 'unlink';
        // Try to determine if it was a directory (this is a best guess)
        if (path.extname(filePath) === '') {
          changeType = 'unlinkDir';
        }
      }

      const event: FileChangeEvent = {
        type: changeType,
        path: filePath,
        stats,
      };

      // Call all callbacks for this watched path
      const callbacks = this.callbacks.get(watchedPath);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback(event);
          } catch (error) {
            console.error(`Error in file change callback for ${filePath}:`, error);
          }
        }
      }

    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
    }
  }

  /**
   * Cleanup method to stop all watchers and clear timers.
   */
  public cleanup(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Stop all watchers
    this.unwatchAll();
  }
}
