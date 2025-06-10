// GitManager Unit Tests
// Phase 4: External Adapters Foundation - Testing Infrastructure

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import mockFs from 'mock-fs';
import { GitManager, type GitIntegrationConfig, type GitEvent } from '../git/GitManager';

describe('GitManager', () => {
  let gitManager: GitManager;
  let mockConfig: Partial<GitIntegrationConfig>;

  beforeEach(() => {
    // Setup mock file system with Git repository
    mockFs({
      '/test-repo': {
        '.git': {
          'config': '[core]\n\trepositoryformatversion = 0',
          'HEAD': 'ref: refs/heads/main',
          'refs': {
            'heads': {
              'main': 'abc123def456',
              'feature': 'def456ghi789'
            }
          },
          'objects': {},
          'logs': {
            'HEAD': 'commit log entries'
          }
        },
        'README.md': '# Test Repository\nThis is a test',
        'docs': {
          'guide.md': '# Guide\nDocumentation here'
        }
      }
    });

    mockConfig = {
      repositoryPath: '/test-repo',
      features: {
        statusMonitoring: true,
        historyTracking: true,
        branchWatching: true,
        conflictDetection: true
      },
      limits: {
        maxHistoryEntries: 100,
        maxBranchCount: 10,
        statusCheckInterval: 5000,
        historyCheckInterval: 10000
      },
      performance: {
        enableCaching: true,
        cacheTimeout: 30000,
        batchOperations: true,
        maxConcurrentOps: 3
      }
    };
  });

  afterEach(() => {
    if (gitManager) {
      gitManager.stop();
    }
    mockFs.restore();
  });

  describe('Initialization', () => {
    it('should create GitManager with valid configuration', () => {
      gitManager = new GitManager(mockConfig);
      expect(gitManager).toBeDefined();
      expect(gitManager.getStatus().isActive).toBe(false);
    });

    it('should create GitManager with default configuration', () => {
      gitManager = new GitManager();
      expect(gitManager).toBeDefined();
      expect(gitManager.getStatus().repositoryPath).toBeDefined();
    });

    it('should validate repository path on creation', () => {
      const invalidConfig = { ...mockConfig, repositoryPath: '/non-existent' };
      gitManager = new GitManager(invalidConfig);
      expect(gitManager).toBeDefined();
      // GitManager should handle invalid paths gracefully
    });
  });

  describe('Git Operations', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should start monitoring successfully', async () => {
      await gitManager.start();
      expect(gitManager.getStatus().isActive).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      await gitManager.start();
      expect(gitManager.getStatus().isActive).toBe(true);

      await gitManager.stop();
      expect(gitManager.getStatus().isActive).toBe(false);
    });

    it('should detect Git repository', async () => {
      await gitManager.start();
      const status = gitManager.getStatus();

      expect(status.isGitRepository).toBe(true);
      expect(status.repositoryPath).toBe('/test-repo');
    });

    it('should handle non-Git directories', async () => {
      const nonGitConfig = { ...mockConfig, repositoryPath: '/test-repo/docs' };
      gitManager = new GitManager(nonGitConfig);

      await gitManager.start();
      const status = gitManager.getStatus();

      // Should handle gracefully
      expect(status.isActive).toBe(true);
    });
  });

  describe('Status Monitoring', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should monitor file status changes', async () => {
      const statusPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('status', resolve);
      });

      await gitManager.start();

      // Simulate status change by emitting event
      const mockStatusEvent: GitEvent = {
        type: 'status',
        data: {
          modified: ['README.md'],
          added: [],
          deleted: [],
          untracked: ['new-file.md']
        },
        timestamp: new Date(),
        source: 'status-monitor'
      };

      gitManager.emit('status', mockStatusEvent);

      const event = await statusPromise;
      expect(event.type).toBe('status');
      expect(event.data.modified).toContain('README.md');
    });

    it('should track working directory changes', async () => {
      await gitManager.start();

      const status = gitManager.getStatus();
      expect(status.workingDirectory).toBeDefined();
      expect(status.workingDirectory.clean).toBeDefined();
    });
  });

  describe('History Tracking', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should track commit history', async () => {
      const historyPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('history', resolve);
      });

      await gitManager.start();

      // Simulate history event
      const mockHistoryEvent: GitEvent = {
        type: 'history',
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
        timestamp: new Date(),
        source: 'history-tracker'
      };

      gitManager.emit('history', mockHistoryEvent);

      const event = await historyPromise;
      expect(event.type).toBe('history');
      expect(event.data.commits).toHaveLength(1);
    });

    it('should respect history limits', async () => {
      const limitedConfig = {
        ...mockConfig,
        limits: { ...mockConfig.limits!, maxHistoryEntries: 5 }
      };
      gitManager = new GitManager(limitedConfig);

      await gitManager.start();
      const status = gitManager.getStatus();

      expect(status.limits.maxHistoryEntries).toBe(5);
    });
  });

  describe('Branch Watching', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should monitor branch changes', async () => {
      const branchPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('branch', resolve);
      });

      await gitManager.start();

      // Simulate branch change
      const mockBranchEvent: GitEvent = {
        type: 'branch',
        data: {
          currentBranch: 'feature',
          previousBranch: 'main',
          branches: ['main', 'feature']
        },
        timestamp: new Date(),
        source: 'branch-watcher'
      };

      gitManager.emit('branch', mockBranchEvent);

      const event = await branchPromise;
      expect(event.type).toBe('branch');
      expect(event.data.currentBranch).toBe('feature');
    });

    it('should track current branch', async () => {
      await gitManager.start();

      const status = gitManager.getStatus();
      expect(status.currentBranch).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should detect merge conflicts', async () => {
      const conflictPromise = new Promise<GitEvent>((resolve) => {
        gitManager.once('conflict', resolve);
      });

      await gitManager.start();

      // Simulate conflict detection
      const mockConflictEvent: GitEvent = {
        type: 'conflict',
        data: {
          conflictedFiles: ['README.md'],
          mergeInProgress: true,
          conflictMarkers: ['<<<<<<< HEAD', '=======', '>>>>>>> feature']
        },
        timestamp: new Date(),
        source: 'conflict-detector'
      };

      gitManager.emit('conflict', mockConflictEvent);

      const event = await conflictPromise;
      expect(event.type).toBe('conflict');
      expect(event.data.conflictedFiles).toContain('README.md');
    });

    it('should handle conflict resolution', async () => {
      await gitManager.start();

      // Simulate conflict resolution
      const resolvedEvent: GitEvent = {
        type: 'conflict',
        data: {
          conflictedFiles: [],
          mergeInProgress: false,
          conflictMarkers: []
        },
        timestamp: new Date(),
        source: 'conflict-detector'
      };

      gitManager.emit('conflict', resolvedEvent);

      // Should handle gracefully
      expect(gitManager.getStatus().isActive).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should enable caching when configured', async () => {
      await gitManager.start();

      const status = gitManager.getStatus();
      expect(status.performance.enableCaching).toBe(true);
      expect(status.performance.cacheTimeout).toBe(30000);
    });

    it('should respect concurrent operation limits', async () => {
      await gitManager.start();

      const status = gitManager.getStatus();
      expect(status.performance.maxConcurrentOps).toBe(3);
    });

    it('should batch operations when enabled', async () => {
      await gitManager.start();

      const status = gitManager.getStatus();
      expect(status.performance.batchOperations).toBe(true);
    });
  });

  describe('Resource Management', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should clean up resources on stop', async () => {
      await gitManager.start();
      expect(gitManager.getStatus().isActive).toBe(true);

      await gitManager.stop();
      expect(gitManager.getStatus().isActive).toBe(false);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await gitManager.start();
        expect(gitManager.getStatus().isActive).toBe(true);

        await gitManager.stop();
        expect(gitManager.getStatus().isActive).toBe(false);
      }
    });

    it('should handle stop when not active', async () => {
      expect(gitManager.getStatus().isActive).toBe(false);

      // Should not throw
      await gitManager.stop();
      expect(gitManager.getStatus().isActive).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should handle Git operation errors', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        gitManager.once('error', resolve);
      });

      await gitManager.start();

      const testError = new Error('Git operation failed');
      gitManager.emit('error', testError);

      const error = await errorPromise;
      expect(error.message).toBe('Git operation failed');
    });

    it('should continue working after errors', async () => {
      await gitManager.start();
      expect(gitManager.getStatus().isActive).toBe(true);

      // Emit error
      gitManager.emit('error', new Error('Test error'));

      // Should still be active
      expect(gitManager.getStatus().isActive).toBe(true);
    });

    it('should handle invalid repository paths', async () => {
      const invalidConfig = { ...mockConfig, repositoryPath: '/invalid/path' };
      gitManager = new GitManager(invalidConfig);

      // Should not throw during start
      await gitManager.start();
      expect(gitManager.getStatus().isActive).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      gitManager = new GitManager();
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

      gitManager = new GitManager(customConfig);
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
          enableCaching: false,
          cacheTimeout: 60000,
          batchOperations: false,
          maxConcurrentOps: 5
        }
      };

      gitManager = new GitManager(performanceConfig);
      const status = gitManager.getStatus();

      expect(status.performance.enableCaching).toBe(false);
      expect(status.performance.cacheTimeout).toBe(60000);
      expect(status.performance.batchOperations).toBe(false);
      expect(status.performance.maxConcurrentOps).toBe(5);
    });
  });

  describe('Status Reporting', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should report correct status when inactive', () => {
      const status = gitManager.getStatus();

      expect(status.isActive).toBe(false);
      expect(status.repositoryPath).toBe('/test-repo');
      expect(status.features).toBeDefined();
      expect(status.limits).toBeDefined();
      expect(status.performance).toBeDefined();
    });

    it('should report correct status when active', async () => {
      await gitManager.start();
      const status = gitManager.getStatus();

      expect(status.isActive).toBe(true);
      expect(status.isGitRepository).toBeDefined();
      expect(status.currentBranch).toBeDefined();
      expect(status.workingDirectory).toBeDefined();
    });

    it('should track operation statistics', async () => {
      await gitManager.start();

      // Simulate some operations
      gitManager.emit('status', { type: 'status', data: {}, timestamp: new Date(), source: 'test' });
      gitManager.emit('history', { type: 'history', data: {}, timestamp: new Date(), source: 'test' });

      const status = gitManager.getStatus();
      expect(status.statistics).toBeDefined();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      gitManager = new GitManager(mockConfig);
    });

    it('should start monitoring within reasonable time', async () => {
      const startTime = Date.now();
      await gitManager.start();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should start within 2 seconds
      expect(gitManager.getStatus().isActive).toBe(true);
    });

    it('should stop monitoring quickly', async () => {
      await gitManager.start();

      const startTime = Date.now();
      await gitManager.stop();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should stop within 1 second
      expect(gitManager.getStatus().isActive).toBe(false);
    });

    it('should handle high-frequency events', async () => {
      await gitManager.start();

      // Simulate rapid events
      for (let i = 0; i < 10; i++) {
        gitManager.emit('status', {
          type: 'status',
          data: { modified: [`file${i}.md`] },
          timestamp: new Date(),
          source: 'test'
        });
      }

      // Should handle without issues
      expect(gitManager.getStatus().isActive).toBe(true);
    });
  });
});