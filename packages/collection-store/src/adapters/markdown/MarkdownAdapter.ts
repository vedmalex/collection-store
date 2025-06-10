// MarkdownAdapter - Main adapter integrating all components
// Integrates: MarkdownWatcher, GitManager, MarkdownParser

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs-extra';
import { MarkdownWatcher, FileChangeEvent, FileWatchingConfig } from './watcher/MarkdownWatcher';
import { GitManager, GitIntegrationConfig, GitFileStatus } from './git/GitManager';
import { MarkdownParser, MarkdownDocument, ParsingConfig } from './parser/MarkdownParser';

export interface MarkdownAdapterConfig {
  name: string;
  rootPath: string;
  fileWatching: Partial<FileWatchingConfig>;
  gitIntegration: Partial<GitIntegrationConfig>;
  parsing: Partial<ParsingConfig>;
  features: {
    autoSync: boolean;
    realTimeUpdates: boolean;
    gitIntegration: boolean;
    fullTextSearch: boolean;
  };
  limits: {
    maxFileSize: number; // bytes
    maxFiles: number;
    syncInterval: number; // milliseconds
  };
}

export interface MarkdownAdapterStatus {
  isInitialized: boolean;
  isWatching: boolean;
  documentsCount: number;
  lastSync: Date | null;
  gitStatus?: {
    isRepository: boolean;
    branch: string;
    hasChanges: boolean;
  };
  performance: {
    watcherEvents: number;
    parseOperations: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

export interface MarkdownQuery {
  text?: string;
  path?: string;
  tags?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  gitStatus?: GitFileStatus['status'][];
  limit?: number;
  offset?: number;
}

export interface MarkdownQueryResult {
  documents: MarkdownDocument[];
  total: number;
  hasMore: boolean;
  searchTime: number;
}

export class MarkdownAdapter extends EventEmitter {
  private config: MarkdownAdapterConfig;
  private watcher: MarkdownWatcher;
  private gitManager: GitManager | null = null;
  private parser: MarkdownParser;
  private documents: Map<string, MarkdownDocument> = new Map();
  private isInitialized = false;
  private isWatching = false;
  private lastSync: Date | null = null;
  private performance = {
    watcherEvents: 0,
    parseOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: Partial<MarkdownAdapterConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);

    // Initialize components
    this.watcher = new MarkdownWatcher(this.config.fileWatching);
    this.parser = new MarkdownParser(this.config.parsing);

    if (this.config.features.gitIntegration) {
      this.gitManager = new GitManager(this.config.rootPath, this.config.gitIntegration);
    }

    this.setupEventHandlers();
  }

  private mergeConfig(userConfig: Partial<MarkdownAdapterConfig>): MarkdownAdapterConfig {
    return {
      name: userConfig.name || 'markdown-adapter',
      rootPath: userConfig.rootPath || process.cwd(),
      fileWatching: userConfig.fileWatching || {},
      gitIntegration: userConfig.gitIntegration || {},
      parsing: userConfig.parsing || {},
      features: {
        autoSync: userConfig.features?.autoSync ?? true,
        realTimeUpdates: userConfig.features?.realTimeUpdates ?? true,
        gitIntegration: userConfig.features?.gitIntegration ?? true,
        fullTextSearch: userConfig.features?.fullTextSearch ?? true,
      },
      limits: {
        maxFileSize: userConfig.limits?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
        maxFiles: userConfig.limits?.maxFiles ?? 10000,
        syncInterval: userConfig.limits?.syncInterval ?? 1000, // 1 second
      },
    };
  }

  private setupEventHandlers(): void {
    // File watcher events
    this.watcher.on('change', async (event: FileChangeEvent) => {
      this.performance.watcherEvents++;
      await this.handleFileChange(event);
    });

    this.watcher.on('error', (error: Error) => {
      this.emit('error', { source: 'watcher', error });
    });

    this.watcher.on('fallback', (data: any) => {
      this.emit('fallback', { source: 'watcher', data });
    });

    // Git manager events
    if (this.gitManager) {
      this.gitManager.on('git-event', (event: any) => {
        this.emit('git-event', event);
      });

      this.gitManager.on('error', (error: Error) => {
        this.emit('error', { source: 'git', error });
      });
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Validate root path
      if (!(await fs.pathExists(this.config.rootPath))) {
        throw new Error(`Root path does not exist: ${this.config.rootPath}`);
      }

      // Initialize Git manager if enabled
      if (this.gitManager) {
        try {
          await this.gitManager.initialize();
        } catch (error) {
          // Git initialization failed, continue without Git features
          this.gitManager = null;
          this.emit('warning', {
            message: 'Git integration disabled due to initialization failure',
            error
          });
        }
      }

      // Perform initial scan
      await this.performInitialScan();

      this.isInitialized = true;
      this.emit('initialized', {
        documentsCount: this.documents.size,
        gitEnabled: !!this.gitManager,
      });

    } catch (error) {
      this.emit('error', { source: 'initialization', error });
      throw error;
    }
  }

  private async performInitialScan(): Promise<void> {
    const startTime = Date.now();
    const markdownFiles = await this.findMarkdownFiles(this.config.rootPath);

    let processedCount = 0;
    const batchSize = 10; // Process files in batches to avoid overwhelming the system

    for (let i = 0; i < markdownFiles.length; i += batchSize) {
      const batch = markdownFiles.slice(i, i + batchSize);

      await Promise.all(batch.map(async (filePath) => {
        try {
          await this.processFile(filePath, 'add');
          processedCount++;
        } catch (error) {
          this.emit('error', {
            source: 'initial-scan',
            filePath,
            error
          });
        }
      }));

      // Emit progress
      this.emit('scan-progress', {
        processed: processedCount,
        total: markdownFiles.length,
        percentage: Math.round((processedCount / markdownFiles.length) * 100),
      });
    }

    this.lastSync = new Date();

    this.emit('scan-complete', {
      documentsCount: this.documents.size,
      duration: Date.now() - startTime,
      filesProcessed: processedCount,
    });
  }

  private async findMarkdownFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const scan = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            // Skip hidden directories and node_modules
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.md' || ext === '.markdown') {
              // Check file size limit
              const stats = await fs.stat(fullPath);
              if (stats.size <= this.config.limits.maxFileSize) {
                files.push(fullPath);
              } else {
                this.emit('warning', {
                  message: `File exceeds size limit: ${fullPath}`,
                  size: stats.size,
                  limit: this.config.limits.maxFileSize,
                });
              }
            }
          }
        }
      } catch (error) {
        this.emit('error', { source: 'file-scan', path: currentPath, error });
      }
    };

    await scan(dirPath);

    // Respect file count limit
    if (files.length > this.config.limits.maxFiles) {
      this.emit('warning', {
        message: `File count exceeds limit, processing first ${this.config.limits.maxFiles} files`,
        found: files.length,
        limit: this.config.limits.maxFiles,
      });
      return files.slice(0, this.config.limits.maxFiles);
    }

    return files;
  }

  async startWatching(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    if (this.isWatching) {
      return;
    }

    await this.watcher.watch(this.config.rootPath);

    if (this.gitManager) {
      await this.gitManager.startMonitoring();
    }

    this.isWatching = true;
    this.emit('watching-started');
  }

  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    await this.watcher.stop();

    if (this.gitManager) {
      await this.gitManager.stopMonitoring();
    }

    this.isWatching = false;
    this.emit('watching-stopped');
  }

  private async handleFileChange(event: FileChangeEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'add':
        case 'change':
          await this.processFile(event.path, event.type);
          break;
        case 'unlink':
          await this.removeFile(event.path);
          break;
      }

      if (this.config.features.realTimeUpdates) {
        this.emit('document-updated', {
          type: event.type,
          path: event.path,
          timestamp: event.timestamp,
        });
      }

    } catch (error) {
      this.emit('error', {
        source: 'file-change',
        event,
        error
      });
    }
  }

  private async processFile(filePath: string, changeType: 'add' | 'change'): Promise<void> {
    this.performance.parseOperations++;

    // Get Git metadata if available
    let gitMetadata;
    if (this.gitManager) {
      try {
        const gitStatus = await this.gitManager.getFileStatus(filePath);
        gitMetadata = gitStatus;
      } catch (error) {
        // Git metadata not available, continue without it
      }
    }

    // Parse the document
    const document = await this.parser.parseFile(filePath, gitMetadata?.git);

    // Store in documents map
    const documentKey = this.getDocumentKey(filePath);
    this.documents.set(documentKey, document);

    this.emit('document-processed', {
      type: changeType,
      document,
      path: filePath,
    });
  }

  private async removeFile(filePath: string): Promise<void> {
    const documentKey = this.getDocumentKey(filePath);
    const removed = this.documents.delete(documentKey);

    if (removed) {
      this.emit('document-removed', {
        path: filePath,
      });
    }
  }

  private getDocumentKey(filePath: string): string {
    return path.relative(this.config.rootPath, filePath);
  }

  // Query interface
  async query(query: MarkdownQuery): Promise<MarkdownQueryResult> {
    const startTime = Date.now();
    let results = Array.from(this.documents.values());

    // Apply filters
    if (query.path) {
      results = results.filter(doc =>
        doc.path.includes(query.path!)
      );
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(doc =>
        query.tags!.some(tag => doc.index.tags.includes(tag))
      );
    }

    if (query.dateRange) {
      results = results.filter(doc => {
        const modTime = doc.timestamps.modified;
        return modTime >= query.dateRange!.from && modTime <= query.dateRange!.to;
      });
    }

    if (query.gitStatus && query.gitStatus.length > 0) {
      results = results.filter(doc =>
        query.gitStatus!.includes(doc.metadata.git.status)
      );
    }

    // Full-text search
    if (query.text && this.config.features.fullTextSearch) {
      const searchResults = await this.parser.search(results, query.text);
      results = searchResults.map(result => result.document);
    }

    // Apply pagination
    const total = results.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      documents: paginatedResults,
      total,
      hasMore,
      searchTime: Date.now() - startTime,
    };
  }

  // CRUD operations
  async getDocument(filePath: string): Promise<MarkdownDocument | null> {
    const documentKey = this.getDocumentKey(filePath);
    const document = this.documents.get(documentKey);

    if (document) {
      this.performance.cacheHits++;
      return document;
    }

    this.performance.cacheMisses++;

    // Try to load from file if not in cache
    if (await fs.pathExists(filePath)) {
      await this.processFile(filePath, 'add');
      return this.documents.get(documentKey) || null;
    }

    return null;
  }

  async getAllDocuments(): Promise<MarkdownDocument[]> {
    return Array.from(this.documents.values());
  }

  async getDocumentCount(): Promise<number> {
    return this.documents.size;
  }

  // Status and diagnostics
  getStatus(): MarkdownAdapterStatus {
    const gitStatus = this.gitManager ? {
      isRepository: this.gitManager.getStatus().isInitialized,
      branch: '', // Would need to fetch current branch
      hasChanges: false, // Would need to check for changes
    } : undefined;

    return {
      isInitialized: this.isInitialized,
      isWatching: this.isWatching,
      documentsCount: this.documents.size,
      lastSync: this.lastSync,
      gitStatus,
      performance: { ...this.performance },
    };
  }

  async refresh(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    // Clear current documents
    this.documents.clear();
    this.parser.clearCache();

    // Perform fresh scan
    await this.performInitialScan();
  }

  async dispose(): Promise<void> {
    await this.stopWatching();

    this.documents.clear();
    this.parser.clearCache();

    this.isInitialized = false;
    this.emit('disposed');
  }
}