// MarkdownWatcher - File watching implementation with Chokidar + intelligent fallback
// Based on Creative Phase Decision: Chokidar library с polling fallback для edge cases

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';

export interface FileWatchingConfig {
  strategy: 'chokidar' | 'polling' | 'auto';
  chokidar: {
    ignored: (string | RegExp)[];
    persistent: boolean;
    ignoreInitial: boolean;
    followSymlinks: boolean;
    depth: number;
    awaitWriteFinish: {
      stabilityThreshold: number;
      pollInterval: number;
    };
  };
  polling: {
    interval: number;
    binaryInterval: number;
  };
  debounce: {
    delay: number;
    maxWait: number;
  };
  fallback: {
    enabled: boolean;
    timeout: number;
  };
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: fs.Stats;
  timestamp: Date;
  source: 'chokidar' | 'polling';
}

export class MarkdownWatcher extends EventEmitter {
  private config: FileWatchingConfig;
  private watchPaths: string[] = [];
  private chokidarWrapper: ChokidarWrapper | null = null;
  private pollingWatcher: PollingWatcher | null = null;
  private fallbackDetector: FallbackDetector;
  private eventBuffer: EventBuffer;
  private isWatching = false;
  private currentStrategy: 'chokidar' | 'polling' = 'chokidar';

  constructor(config: Partial<FileWatchingConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.fallbackDetector = new FallbackDetector(this.config.fallback);
    this.eventBuffer = new EventBuffer(this.config.debounce);

    // Setup event forwarding
    this.eventBuffer.on('event', (event: FileChangeEvent) => {
      this.emit('change', event);
    });

    this.fallbackDetector.on('fallback', () => {
      this.handleFallback();
    });
  }

  private mergeConfig(userConfig: Partial<FileWatchingConfig>): FileWatchingConfig {
    return {
      strategy: userConfig.strategy || 'auto',
      chokidar: {
        ignored: userConfig.chokidar?.ignored || [/(^|[\/\\])\../, /node_modules/],
        persistent: userConfig.chokidar?.persistent ?? true,
        ignoreInitial: userConfig.chokidar?.ignoreInitial ?? true,
        followSymlinks: userConfig.chokidar?.followSymlinks ?? false,
        depth: userConfig.chokidar?.depth ?? 10,
        awaitWriteFinish: {
          stabilityThreshold: userConfig.chokidar?.awaitWriteFinish?.stabilityThreshold ?? 100,
          pollInterval: userConfig.chokidar?.awaitWriteFinish?.pollInterval ?? 50,
        },
      },
      polling: {
        interval: userConfig.polling?.interval ?? 1000,
        binaryInterval: userConfig.polling?.binaryInterval ?? 5000,
      },
      debounce: {
        delay: userConfig.debounce?.delay ?? 100,
        maxWait: userConfig.debounce?.maxWait ?? 1000,
      },
      fallback: {
        enabled: userConfig.fallback?.enabled ?? true,
        timeout: userConfig.fallback?.timeout ?? 5000,
      },
    };
  }

  async watch(paths: string | string[]): Promise<void> {
    this.watchPaths = Array.isArray(paths) ? paths : [paths];

    // Validate paths exist
    for (const watchPath of this.watchPaths) {
      if (!(await fs.pathExists(watchPath))) {
        throw new Error(`Watch path does not exist: ${watchPath}`);
      }
    }

    await this.startWatching();
  }

  private async startWatching(): Promise<void> {
    if (this.isWatching) {
      await this.stop();
    }

    this.isWatching = true;

    try {
      if (this.config.strategy === 'polling') {
        await this.startPollingWatcher();
      } else {
        await this.startChokidarWatcher();
      }
    } catch (error) {
      this.emit('error', error);
      if (this.config.fallback.enabled && this.currentStrategy === 'chokidar') {
        await this.handleFallback();
      }
    }
  }

  private async startChokidarWatcher(): Promise<void> {
    this.currentStrategy = 'chokidar';
    this.chokidarWrapper = new ChokidarWrapper(this.config.chokidar);

    this.chokidarWrapper.on('event', (event: FileChangeEvent) => {
      this.fallbackDetector.recordActivity();
      this.eventBuffer.addEvent(event);
    });

    this.chokidarWrapper.on('error', (error: Error) => {
      this.emit('error', error);
      if (this.config.fallback.enabled) {
        this.fallbackDetector.recordError();
      }
    });

    await this.chokidarWrapper.watch(this.watchPaths);
    this.fallbackDetector.start();
  }

  private async startPollingWatcher(): Promise<void> {
    this.currentStrategy = 'polling';
    this.pollingWatcher = new PollingWatcher(this.config.polling);

    this.pollingWatcher.on('event', (event: FileChangeEvent) => {
      this.eventBuffer.addEvent(event);
    });

    this.pollingWatcher.on('error', (error: Error) => {
      this.emit('error', error);
    });

    await this.pollingWatcher.watch(this.watchPaths);
  }

  private async handleFallback(): Promise<void> {
    if (this.currentStrategy === 'chokidar') {
      this.emit('fallback', { from: 'chokidar', to: 'polling' });

      if (this.chokidarWrapper) {
        await this.chokidarWrapper.stop();
        this.chokidarWrapper = null;
      }

      await this.startPollingWatcher();
    }
  }

  async stop(): Promise<void> {
    this.isWatching = false;
    this.fallbackDetector.stop();

    if (this.chokidarWrapper) {
      await this.chokidarWrapper.stop();
      this.chokidarWrapper = null;
    }

    if (this.pollingWatcher) {
      await this.pollingWatcher.stop();
      this.pollingWatcher = null;
    }

    this.eventBuffer.clear();
  }

  getStatus(): {
    isWatching: boolean;
    strategy: string;
    watchPaths: string[];
    eventCount: number;
  } {
    return {
      isWatching: this.isWatching,
      strategy: this.currentStrategy,
      watchPaths: [...this.watchPaths],
      eventCount: this.eventBuffer.getEventCount(),
    };
  }
}

// ChokidarWrapper - Wraps chokidar functionality
class ChokidarWrapper extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private config: FileWatchingConfig['chokidar'];

  constructor(config: FileWatchingConfig['chokidar']) {
    super();
    this.config = config;
  }

  async watch(paths: string[]): Promise<void> {
    const watchOptions = {
      ignored: this.config.ignored,
      persistent: this.config.persistent,
      ignoreInitial: this.config.ignoreInitial,
      followSymlinks: this.config.followSymlinks,
      depth: this.config.depth,
      awaitWriteFinish: this.config.awaitWriteFinish,
    };

    this.watcher = chokidar.watch(paths, watchOptions);

    this.watcher.on('add', (filePath, stats) => {
      if (this.isMarkdownFile(filePath)) {
        this.emit('event', {
          type: 'add',
          path: filePath,
          stats,
          timestamp: new Date(),
          source: 'chokidar',
        });
      }
    });

    this.watcher.on('change', (filePath, stats) => {
      if (this.isMarkdownFile(filePath)) {
        this.emit('event', {
          type: 'change',
          path: filePath,
          stats,
          timestamp: new Date(),
          source: 'chokidar',
        });
      }
    });

    this.watcher.on('unlink', (filePath) => {
      if (this.isMarkdownFile(filePath)) {
        this.emit('event', {
          type: 'unlink',
          path: filePath,
          timestamp: new Date(),
          source: 'chokidar',
        });
      }
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });

    return new Promise((resolve, reject) => {
      this.watcher!.on('ready', () => resolve());
      this.watcher!.on('error', reject);
    });
  }

  private isMarkdownFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

// PollingWatcher - Fallback polling implementation
class PollingWatcher extends EventEmitter {
  private config: FileWatchingConfig['polling'];
  private watchPaths: string[] = [];
  private fileStates = new Map<string, fs.Stats>();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: FileWatchingConfig['polling']) {
    super();
    this.config = config;
  }

  async watch(paths: string[]): Promise<void> {
    this.watchPaths = paths;
    await this.scanInitialState();
    this.startPolling();
  }

  private async scanInitialState(): Promise<void> {
    for (const watchPath of this.watchPaths) {
      await this.scanDirectory(watchPath);
    }
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (this.isMarkdownFile(fullPath)) {
          const stats = await fs.stat(fullPath);
          this.fileStates.set(fullPath, stats);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private startPolling(): void {
    this.intervalId = setInterval(async () => {
      await this.checkForChanges();
    }, this.config.interval);
  }

  private async checkForChanges(): Promise<void> {
    const currentFiles = new Set<string>();

    for (const watchPath of this.watchPaths) {
      await this.checkDirectory(watchPath, currentFiles);
    }

    // Check for deleted files
    for (const [filePath] of this.fileStates) {
      if (!currentFiles.has(filePath)) {
        this.fileStates.delete(filePath);
        this.emit('event', {
          type: 'unlink',
          path: filePath,
          timestamp: new Date(),
          source: 'polling',
        });
      }
    }
  }

  private async checkDirectory(dirPath: string, currentFiles: Set<string>): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.checkDirectory(fullPath, currentFiles);
        } else if (this.isMarkdownFile(fullPath)) {
          currentFiles.add(fullPath);

          try {
            const stats = await fs.stat(fullPath);
            const previousStats = this.fileStates.get(fullPath);

            if (!previousStats) {
              // New file
              this.fileStates.set(fullPath, stats);
              this.emit('event', {
                type: 'add',
                path: fullPath,
                stats,
                timestamp: new Date(),
                source: 'polling',
              });
            } else if (stats.mtime > previousStats.mtime) {
              // Modified file
              this.fileStates.set(fullPath, stats);
              this.emit('event', {
                type: 'change',
                path: fullPath,
                stats,
                timestamp: new Date(),
                source: 'polling',
              });
            }
          } catch (error) {
            // File might be temporarily inaccessible
            continue;
          }
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private isMarkdownFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.fileStates.clear();
  }
}

// FallbackDetector - Monitors chokidar health and triggers fallback
class FallbackDetector extends EventEmitter {
  private config: FileWatchingConfig['fallback'];
  private lastActivity = Date.now();
  private errorCount = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: FileWatchingConfig['fallback']) {
    super();
    this.config = config;
  }

  start(): void {
    if (!this.config.enabled) return;

    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, this.config.timeout / 2);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
    this.errorCount = 0;
  }

  recordError(): void {
    this.errorCount++;
    if (this.errorCount >= 3) {
      this.emit('fallback');
    }
  }

  private checkHealth(): void {
    const timeSinceActivity = Date.now() - this.lastActivity;
    if (timeSinceActivity > this.config.timeout) {
      this.emit('fallback');
    }
  }
}

// EventBuffer - Debounces and buffers file events
class EventBuffer extends EventEmitter {
  private config: FileWatchingConfig['debounce'];
  private eventQueue = new Map<string, FileChangeEvent>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private eventCount = 0;

  constructor(config: FileWatchingConfig['debounce']) {
    super();
    this.config = config;
  }

  addEvent(event: FileChangeEvent): void {
    this.eventCount++;
    const key = event.path;

    // Clear existing timer for this path
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Update event in queue
    this.eventQueue.set(key, event);

    // Set new debounce timer
    const timer = setTimeout(() => {
      const queuedEvent = this.eventQueue.get(key);
      if (queuedEvent) {
        this.eventQueue.delete(key);
        this.debounceTimers.delete(key);
        this.emit('event', queuedEvent);
      }
    }, this.config.delay);

    this.debounceTimers.set(key, timer);
  }

  clear(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    this.eventQueue.clear();
    this.debounceTimers.clear();
  }

  getEventCount(): number {
    return this.eventCount;
  }
}