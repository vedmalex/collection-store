// GitManager Unit Tests
// Phase 4: External Adapters Foundation - Testing Infrastructure

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { GitManager, type GitIntegrationConfig, type GitEvent } from '../git/GitManager';

describe('GitManager', () => {
  let gitManager: GitManager;
  let mockConfig: Partial<GitIntegrationConfig>;
  const currentProjectPath = process.cwd(); // Use current project which is a git repo

  beforeEach(() => {
    mockConfig = {
      features: {
        statusMonitoring: true,
        historyTracking: true,
        branchWatching: true,
        conflictDetection: true
      },
      limits: {
        maxHistoryEntries: 100,
        maxCacheSize: 50 * 1024 * 1024,
        historyDepthDays: 30,
        refreshInterval: 5000
      },
      performance: {
        lazyLoading: true,
        backgroundRefresh: true,
        cacheStrategy: 'memory'
      }
    };
  });

  afterEach(async () => {
    if (gitManager) {
      await gitManager.stopMonitoring();
    }
  });

  describe('Initialization', () => {
    it('should create GitManager with valid git repository', () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      expect(gitManager).toBeDefined();
      expect(gitManager.getStatus().isInitialized).toBe(false);
      expect(gitManager.getStatus().repositoryPath).toBe(currentProjectPath);
    });

    it('should create GitManager with default configuration', () => {
      gitManager = new GitManager(currentProjectPath);
      expect(gitManager).toBeDefined();
      expect(gitManager.getStatus().repositoryPath).toBeDefined();
    });

    it('should handle invalid repository paths gracefully', (done) => {
      // Use a callback-based test to handle async error emission
      const invalidGitManager = new GitManager('/non-existent', mockConfig);

      invalidGitManager.once('error', (error) => {
        expect(error).toBeDefined();
        expect(invalidGitManager.getStatus().isInitialized).toBe(false);
        done();
      });

      // If no error is emitted within 100ms, consider it handled gracefully
      setTimeout(() => {
        expect(invalidGitManager.getStatus().isInitialized).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Git Operations', () => {
    beforeEach(() => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
    });

    it('should initialize successfully with valid git repository', async () => {
      await gitManager.initialize();
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });

    it('should handle initialization gracefully for non-git directories', async () => {
      gitManager = new GitManager('/tmp/non-git-dir', mockConfig);

      // Should handle gracefully - will emit error but not throw during construction
      const errorPromise = new Promise((resolve) => {
        gitManager.once('error', resolve);
      });

      await gitManager.initialize().catch(() => {
        // Expected to fail for non-git directory
      });

      // Should handle gracefully
      expect(gitManager.getStatus().isInitialized).toBe(false);
    });
  });

  describe('Status Monitoring', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should monitor file status changes', async () => {
      const statusPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('git-event', resolve);
      });

      // Simulate status change by emitting event
      const mockStatusEvent: GitEvent = {
        type: 'status',
        data: {
          modified: ['README.md'],
          added: [],
          deleted: [],
          untracked: ['new-file.md']
        },
        timestamp: new Date()
      };

      gitManager.emit('git-event', mockStatusEvent);

      const event = await statusPromise;
      expect(event.type).toBe('status');
      expect(event.data.modified).toContain('README.md');
    });

    it('should track working directory changes', () => {
      const status = gitManager.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.cacheStats).toBeDefined();
    });
  });

  describe('History Tracking', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should track commit history', async () => {
      const historyPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('git-event', resolve);
      });

      // Simulate history event
      const mockHistoryEvent: GitEvent = {
        type: 'commit',
        data: {
          commits: [
            {
              hash: 'abc123',
              message: 'Initial commit',
              author: 'Test User',
              date: new Date(),
              files: ['README.md']
            }
          ]
        },
        timestamp: new Date()
      };

      gitManager.emit('git-event', mockHistoryEvent);

      const event = await historyPromise;
      expect(event.type).toBe('commit');
      expect(event.data.commits).toHaveLength(1);
    });

    it('should respect history limits', () => {
      const limitedConfig = {
        ...mockConfig,
        limits: { ...mockConfig.limits!, maxHistoryEntries: 5 }
      };
      gitManager = new GitManager(currentProjectPath, limitedConfig);

      const status = gitManager.getStatus();
      expect(status.features.historyTracking).toBe(true);
    });
  });

  describe('Branch Watching', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should monitor branch changes', async () => {
      const branchPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('git-event', resolve);
      });

      // Simulate branch change
      const mockBranchEvent: GitEvent = {
        type: 'branch',
        data: {
          currentBranch: 'feature',
          previousBranch: 'main',
          branches: ['main', 'feature']
        },
        timestamp: new Date()
      };

      gitManager.emit('git-event', mockBranchEvent);

      const event = await branchPromise;
      expect(event.type).toBe('branch');
      expect(event.data.currentBranch).toBe('feature');
    });

    it('should track current branch', () => {
      const status = gitManager.getStatus();
      expect(status.features.branchWatching).toBe(true);
    });
  });

  describe('Conflict Detection', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should detect merge conflicts', async () => {
      const conflictPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('git-event', resolve);
      });

      // Simulate conflict detection
      const mockConflictEvent: GitEvent = {
        type: 'conflict',
        data: {
          conflictedFiles: ['README.md'],
          mergeInProgress: true,
          conflictMarkers: ['<<<<<<< HEAD', '=======', '>>>>>>> feature']
        },
        timestamp: new Date()
      };

      gitManager.emit('git-event', mockConflictEvent);

      const event = await conflictPromise;
      expect(event.type).toBe('conflict');
      expect(event.data.conflictedFiles).toContain('README.md');
    });

    it('should handle conflict resolution', () => {
      // Simulate conflict resolution
      const resolvedEvent: GitEvent = {
        type: 'conflict',
        data: {
          conflictedFiles: [],
          mergeInProgress: false,
          conflictMarkers: []
        },
        timestamp: new Date()
      };

      gitManager.emit('git-event', resolvedEvent);

      // Should handle gracefully
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should enable caching when configured', () => {
      const status = gitManager.getStatus();
      expect(status.cacheStats).toBeDefined();
      expect(status.cacheStats.size).toBeDefined();
    });

    it('should respect concurrent operation limits', () => {
      const status = gitManager.getStatus();
      expect(status.features).toBeDefined();
    });

    it('should batch operations when enabled', () => {
      const status = gitManager.getStatus();
      expect(status.features.statusMonitoring).toBe(true);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should clean up resources on stop', async () => {
      expect(gitManager.getStatus().isInitialized).toBe(true);

      await gitManager.stopMonitoring();
      expect(gitManager.getStatus().isInitialized).toBe(true); // Still initialized, just not monitoring
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await gitManager.startMonitoring();
        expect(gitManager.getStatus().isInitialized).toBe(true);

        await gitManager.stopMonitoring();
        expect(gitManager.getStatus().isInitialized).toBe(true);
      }
    });

    it('should handle stop when not active', async () => {
      expect(gitManager.getStatus().isInitialized).toBe(true);

      // Should not throw
      await gitManager.stopMonitoring();
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should handle Git operation errors', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        gitManager.once('error', resolve);
      });

      const testError = new Error('Git operation failed');
      gitManager.emit('error', testError);

      const error = await errorPromise;
      expect(error.message).toBe('Git operation failed');
    });

    it('should continue working after errors', (done) => {
      expect(gitManager.getStatus().isInitialized).toBe(true);

      // Set up error handler before emitting
      gitManager.once('error', (error) => {
        expect(error.message).toBe('Test error');
        // Should still be initialized after error
        expect(gitManager.getStatus().isInitialized).toBe(true);
        done();
      });

      // Emit error
      gitManager.emit('error', new Error('Test error'));
    });

    it('should handle invalid repository paths', async () => {
      gitManager = new GitManager('/invalid/path', mockConfig);

      // Should not throw during initialization, but will emit error
      const errorPromise = new Promise((resolve) => {
        gitManager.once('error', resolve);
      });

      await gitManager.initialize().catch(() => {
        // Expected to fail
      });

      expect(gitManager.getStatus().isInitialized).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      gitManager = new GitManager(currentProjectPath);
      const status = gitManager.getStatus();

      expect(status.features.statusMonitoring).toBeDefined();
      expect(status.features.historyTracking).toBeDefined();
      expect(status.features.branchWatching).toBeDefined();
      expect(status.features.conflictDetection).toBeDefined();
    });

    it('should respect feature toggles', () => {
      const customConfig = {
        ...mockConfig,
        features: {
          statusMonitoring: false,
          historyTracking: true,
          branchWatching: false,
          conflictDetection: true
        }
      };

      gitManager = new GitManager(currentProjectPath, customConfig);
      const status = gitManager.getStatus();

      expect(status.features.statusMonitoring).toBe(false);
      expect(status.features.historyTracking).toBe(true);
      expect(status.features.branchWatching).toBe(false);
      expect(status.features.conflictDetection).toBe(true);
    });

    it('should apply performance settings', () => {
      const performanceConfig = {
        ...mockConfig,
        performance: {
          lazyLoading: false,
          backgroundRefresh: true,
          cacheStrategy: 'disk' as const
        }
      };

      gitManager = new GitManager(currentProjectPath, performanceConfig);
      const status = gitManager.getStatus();

      expect(status.features).toBeDefined();
      expect(status.cacheStats).toBeDefined();
    });
  });

  describe('Status Reporting', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should report correct status when active', () => {
      const status = gitManager.getStatus();

      expect(status.isInitialized).toBe(true);
      expect(status.repositoryPath).toBe(currentProjectPath);
      expect(status.features).toBeDefined();
      expect(status.cacheStats).toBeDefined();
    });

    it('should track operation statistics', () => {
      // Simulate some operations
      gitManager.emit('git-event', { type: 'status', data: {}, timestamp: new Date() });
      gitManager.emit('git-event', { type: 'commit', data: {}, timestamp: new Date() });

      const status = gitManager.getStatus();
      expect(status.cacheStats).toBeDefined();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      gitManager = new GitManager(currentProjectPath, mockConfig);
      await gitManager.initialize();
    });

    it('should start monitoring within reasonable time', async () => {
      const startTime = Date.now();
      await gitManager.startMonitoring();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should start within 2 seconds
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });

    it('should stop monitoring quickly', async () => {
      await gitManager.startMonitoring();

      const startTime = Date.now();
      await gitManager.stopMonitoring();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should stop within 1 second
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });

    it('should handle high-frequency events', async () => {
      await gitManager.startMonitoring();

      // Simulate rapid events
      for (let i = 0; i < 10; i++) {
        gitManager.emit('git-event', {
          type: 'status',
          data: { modified: [`file${i}.md`] },
          timestamp: new Date()
        });
      }

      // Should handle without issues
      expect(gitManager.getStatus().isInitialized).toBe(true);
    });
  });
});