// GitManager - Comprehensive Git integration with smart resource management
// Based on Creative Phase Decision: Full Git integration с intelligent limits

import { simpleGit, SimpleGit, StatusResult, LogResult, BranchSummary } from 'simple-git';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface GitIntegrationConfig {
  enabled: boolean;
  features: {
    statusMonitoring: boolean;
    historyTracking: boolean;
    branchWatching: boolean;
    conflictDetection: boolean;
  };
  limits: {
    maxHistoryEntries: number;
    maxCacheSize: number;
    historyDepthDays: number;
    refreshInterval: number;
  };
  performance: {
    lazyLoading: boolean;
    backgroundRefresh: boolean;
    cacheStrategy: 'memory' | 'disk' | 'hybrid';
  };
}

export interface GitFileStatus {
  path: string;
  status: 'clean' | 'modified' | 'staged' | 'untracked' | 'deleted' | 'conflict';
  branch: string;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}

export interface GitEvent {
  type: 'status' | 'branch' | 'commit' | 'conflict';
  data: any;
  timestamp: Date;
}

export class GitManager extends EventEmitter {
  private config: GitIntegrationConfig;
  private git: SimpleGit;
  private repositoryPath: string;
  private statusMonitor: GitStatusMonitor;
  private historyTracker: GitHistoryTracker;
  private branchWatcher: GitBranchWatcher;
  private conflictDetector: GitConflictDetector;
  private resourceManager: ResourceManager;
  private isInitialized = false;

  constructor(repositoryPath: string, config: Partial<GitIntegrationConfig> = {}) {
    super();

    this.repositoryPath = repositoryPath;
    this.config = this.mergeConfig(config);

    try {
      this.git = simpleGit(repositoryPath);

      // Initialize components
      this.resourceManager = new ResourceManager(this.config.limits, this.config.performance);
      this.statusMonitor = new GitStatusMonitor(this.git, this.config, this.resourceManager);
      this.historyTracker = new GitHistoryTracker(this.git, this.config, this.resourceManager);
      this.branchWatcher = new GitBranchWatcher(this.git, this.config, this.resourceManager);
      this.conflictDetector = new GitConflictDetector(this.git, this.config, this.resourceManager);

      this.setupEventForwarding();
    } catch (error) {
      // If git initialization fails (e.g., invalid path), disable git features
      this.config.enabled = false;
      this.git = null as any; // Will be handled by enabled check
      this.resourceManager = new ResourceManager(this.config.limits, this.config.performance);

      // Create dummy components to prevent undefined errors
      this.statusMonitor = null as any;
      this.historyTracker = null as any;
      this.branchWatcher = null as any;
      this.conflictDetector = null as any;

      // Emit error but don't throw - allow adapter to continue without git
      process.nextTick(() => {
        this.emit('error', error);
      });
    }
  }

  private mergeConfig(userConfig: Partial<GitIntegrationConfig>): GitIntegrationConfig {
    return {
      enabled: userConfig.enabled ?? true,
      features: {
        statusMonitoring: userConfig.features?.statusMonitoring ?? true,
        historyTracking: userConfig.features?.historyTracking ?? true,
        branchWatching: userConfig.features?.branchWatching ?? true,
        conflictDetection: userConfig.features?.conflictDetection ?? true,
      },
      limits: {
        maxHistoryEntries: userConfig.limits?.maxHistoryEntries ?? 1000,
        maxCacheSize: userConfig.limits?.maxCacheSize ?? 50 * 1024 * 1024, // 50MB
        historyDepthDays: userConfig.limits?.historyDepthDays ?? 30,
        refreshInterval: userConfig.limits?.refreshInterval ?? 5000, // 5 seconds
      },
      performance: {
        lazyLoading: userConfig.performance?.lazyLoading ?? true,
        backgroundRefresh: userConfig.performance?.backgroundRefresh ?? true,
        cacheStrategy: userConfig.performance?.cacheStrategy ?? 'memory',
      },
    };
  }

  private setupEventForwarding(): void {
    this.statusMonitor.on('status', (data) => {
      this.emit('git-event', { type: 'status', data, timestamp: new Date() });
    });

    this.historyTracker.on('commit', (data) => {
      this.emit('git-event', { type: 'commit', data, timestamp: new Date() });
    });

    this.branchWatcher.on('branch', (data) => {
      this.emit('git-event', { type: 'branch', data, timestamp: new Date() });
    });

    this.conflictDetector.on('conflict', (data) => {
      this.emit('git-event', { type: 'conflict', data, timestamp: new Date() });
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.git) {
      return;
    }

    try {
      // Check if directory is a Git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Directory is not a Git repository: ${this.repositoryPath}`);
      }

      // Initialize components based on enabled features
      if (this.config.features.statusMonitoring) {
        await this.statusMonitor.initialize();
      }

      if (this.config.features.historyTracking) {
        await this.historyTracker.initialize();
      }

      if (this.config.features.branchWatching) {
        await this.branchWatcher.initialize();
      }

      if (this.config.features.conflictDetection) {
        await this.conflictDetector.initialize();
      }

      this.isInitialized = true;
      this.emit('initialized');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getFileStatus(filePath: string): Promise<GitFileStatus> {
    if (!this.isInitialized) {
      throw new Error('GitManager not initialized');
    }

    const relativePath = path.relative(this.repositoryPath, filePath);
    const status = await this.statusMonitor.getFileStatus(relativePath);
    const branch = await this.branchWatcher.getCurrentBranch();
    const lastCommit = await this.historyTracker.getLastCommitForFile(relativePath);

    return {
      path: relativePath,
      status: this.mapGitStatus(status),
      branch,
      lastCommit,
    };
  }

  private mapGitStatus(gitStatus: string): GitFileStatus['status'] {
    switch (gitStatus) {
      case 'M': return 'modified';
      case 'A': return 'staged';
      case '??': return 'untracked';
      case 'D': return 'deleted';
      case 'UU': return 'conflict';
      default: return 'clean';
    }
  }

  async getRepositoryStatus(): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    modified: string[];
    untracked: string[];
    conflicts: string[];
  }> {
    if (!this.isInitialized) {
      throw new Error('GitManager not initialized');
    }

    const [status, branch] = await Promise.all([
      this.statusMonitor.getFullStatus(),
      this.branchWatcher.getCurrentBranch(),
    ]);

    return {
      branch,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      conflicts: status.conflicted,
    };
  }

  async getFileHistory(filePath: string, limit = 10): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: Date;
    changes: string[];
  }>> {
    if (!this.isInitialized) {
      throw new Error('GitManager not initialized');
    }

    const relativePath = path.relative(this.repositoryPath, filePath);
    return this.historyTracker.getFileHistory(relativePath, limit);
  }

  async startMonitoring(): Promise<void> {
    if (!this.config.enabled || !this.git) {
      return; // Silently return if git is not available
    }

    if (!this.isInitialized) {
      throw new Error('GitManager not initialized');
    }

    if (this.config.features.statusMonitoring && this.statusMonitor) {
      this.statusMonitor.startMonitoring();
    }

    if (this.config.features.branchWatching && this.branchWatcher) {
      this.branchWatcher.startMonitoring();
    }

    if (this.config.features.conflictDetection && this.conflictDetector) {
      this.conflictDetector.startMonitoring();
    }
  }

  async stopMonitoring(): Promise<void> {
    if (this.statusMonitor) {
      this.statusMonitor.stopMonitoring();
    }
    if (this.branchWatcher) {
      this.branchWatcher.stopMonitoring();
    }
    if (this.conflictDetector) {
      this.conflictDetector.stopMonitoring();
    }
  }

  getStatus(): {
    isInitialized: boolean;
    repositoryPath: string;
    features: GitIntegrationConfig['features'];
    cacheStats: {
      size: number;
      entries: number;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      repositoryPath: this.repositoryPath,
      features: this.config.features,
      cacheStats: this.resourceManager.getCacheStats(),
    };
  }
}

// GitStatusMonitor - Monitors Git status changes
class GitStatusMonitor extends EventEmitter {
  private git: SimpleGit;
  private config: GitIntegrationConfig;
  private resourceManager: ResourceManager;
  private statusCache: Map<string, any> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastStatus: StatusResult | null = null;

  constructor(git: SimpleGit, config: GitIntegrationConfig, resourceManager: ResourceManager) {
    super();
    this.git = git;
    this.config = config;
    this.resourceManager = resourceManager;
  }

  async initialize(): Promise<void> {
    // Initial status fetch
    await this.refreshStatus();
  }

  async getFileStatus(filePath: string): Promise<string> {
    const cached = this.statusCache.get(filePath);
    if (cached && this.resourceManager.isCacheValid(cached.timestamp)) {
      return cached.status;
    }

    // Refresh if not cached or expired
    await this.refreshStatus();
    const updated = this.statusCache.get(filePath);
    return updated?.status || '';
  }

  async getFullStatus(): Promise<StatusResult> {
    if (this.lastStatus && this.resourceManager.isCacheValid((this.lastStatus as any).timestamp)) {
      return this.lastStatus;
    }

    await this.refreshStatus();
    return this.lastStatus!;
  }

  private async refreshStatus(): Promise<void> {
    try {
      const status = await this.git.status();
      this.lastStatus = { ...status, timestamp: Date.now() } as any;

      // Update file status cache
      this.statusCache.clear();

      // Process all file statuses
      [...status.files].forEach(file => {
        this.statusCache.set(file.path, {
          status: file.index + file.working_dir,
          timestamp: Date.now(),
        });
      });

      this.emit('status', status);
    } catch (error) {
      this.emit('error', error);
    }
  }

  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      await this.refreshStatus();
    }, this.config.limits.refreshInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// GitHistoryTracker - Tracks Git history and commits
class GitHistoryTracker extends EventEmitter {
  private git: SimpleGit;
  private config: GitIntegrationConfig;
  private resourceManager: ResourceManager;
  private historyCache: Map<string, any> = new Map();

  constructor(git: SimpleGit, config: GitIntegrationConfig, resourceManager: ResourceManager) {
    super();
    this.git = git;
    this.config = config;
    this.resourceManager = resourceManager;
  }

  async initialize(): Promise<void> {
    if (this.config.performance.lazyLoading) {
      // Don't preload history, load on demand
      return;
    }

    // Preload recent history
    await this.loadRecentHistory();
  }

  async getLastCommitForFile(filePath: string): Promise<{
    hash: string;
    message: string;
    author: string;
    date: Date;
  } | undefined> {
    const cacheKey = `last-commit:${filePath}`;
    const cached = this.historyCache.get(cacheKey);

    if (cached && this.resourceManager.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const log = await this.git.log({
        file: filePath,
        maxCount: 1,
      });

      if (log.latest) {
        const result = {
          hash: log.latest.hash,
          message: log.latest.message,
          author: log.latest.author_name,
          date: new Date(log.latest.date),
        };

        this.historyCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        return result;
      }
    } catch (error) {
      this.emit('error', error);
    }

    return undefined;
  }

  async getFileHistory(filePath: string, limit: number): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: Date;
    changes: string[];
  }>> {
    const cacheKey = `history:${filePath}:${limit}`;
    const cached = this.historyCache.get(cacheKey);

    if (cached && this.resourceManager.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const log = await this.git.log({
        file: filePath,
        maxCount: Math.min(limit, this.config.limits.maxHistoryEntries),
      });

      const history = log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: new Date(commit.date),
        changes: [], // Would need additional git show call for detailed changes
      }));

      this.historyCache.set(cacheKey, {
        data: history,
        timestamp: Date.now(),
      });

      return history;
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  private async loadRecentHistory(): Promise<void> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - this.config.limits.historyDepthDays);

      const log = await this.git.log({
        since: since.toISOString(),
        maxCount: this.config.limits.maxHistoryEntries,
      });

      this.emit('commit', { recentCommits: log.all.length });
    } catch (error) {
      this.emit('error', error);
    }
  }
}

// GitBranchWatcher - Monitors branch changes
class GitBranchWatcher extends EventEmitter {
  private git: SimpleGit;
  private config: GitIntegrationConfig;
  private resourceManager: ResourceManager;
  private currentBranch: string = '';
  private branchCache: Map<string, any> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(git: SimpleGit, config: GitIntegrationConfig, resourceManager: ResourceManager) {
    super();
    this.git = git;
    this.config = config;
    this.resourceManager = resourceManager;
  }

  async initialize(): Promise<void> {
    await this.refreshBranchInfo();
  }

  async getCurrentBranch(): Promise<string> {
    const cached = this.branchCache.get('current');
    if (cached && this.resourceManager.isCacheValid(cached.timestamp)) {
      return cached.branch;
    }

    await this.refreshBranchInfo();
    return this.currentBranch;
  }

  private async refreshBranchInfo(): Promise<void> {
    try {
      const branch = await this.git.branch();
      const newBranch = branch.current;

      if (newBranch !== this.currentBranch) {
        const oldBranch = this.currentBranch;
        this.currentBranch = newBranch;

        this.emit('branch', {
          from: oldBranch,
          to: newBranch,
          branches: branch.all,
        });
      }

      this.branchCache.set('current', {
        branch: newBranch,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.emit('error', error);
    }
  }

  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      await this.refreshBranchInfo();
    }, this.config.limits.refreshInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// GitConflictDetector - Detects and monitors merge conflicts
class GitConflictDetector extends EventEmitter {
  private git: SimpleGit;
  private config: GitIntegrationConfig;
  private resourceManager: ResourceManager;
  private conflictCache: Map<string, any> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(git: SimpleGit, config: GitIntegrationConfig, resourceManager: ResourceManager) {
    super();
    this.git = git;
    this.config = config;
    this.resourceManager = resourceManager;
  }

  async initialize(): Promise<void> {
    await this.checkForConflicts();
  }

  private async checkForConflicts(): Promise<void> {
    try {
      const status = await this.git.status();
      const conflicts = status.conflicted;

      if (conflicts.length > 0) {
        this.emit('conflict', {
          files: conflicts,
          count: conflicts.length,
        });
      }

      this.conflictCache.set('current', {
        conflicts,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.emit('error', error);
    }
  }

  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      await this.checkForConflicts();
    }, this.config.limits.refreshInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// ResourceManager - Manages caching and resource limits
class ResourceManager {
  private limits: GitIntegrationConfig['limits'];
  private performance: GitIntegrationConfig['performance'];
  private cacheSize = 0;
  private cacheEntries = 0;

  constructor(limits: GitIntegrationConfig['limits'], performance: GitIntegrationConfig['performance']) {
    this.limits = limits;
    this.performance = performance;
  }

  isCacheValid(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < this.limits.refreshInterval;
  }

  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cacheSize,
      entries: this.cacheEntries,
    };
  }

  // Additional resource management methods would be implemented here
}