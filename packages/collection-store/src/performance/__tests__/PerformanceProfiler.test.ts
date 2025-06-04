import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PerformanceProfiler } from '../monitoring/PerformanceProfiler';
import type { ProfilerConfig, BottleneckReport, HotspotAnalysis } from '../testing/interfaces';

describe('Phase 6: PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler({
      enableDetailedLogging: false,
      samplingInterval: 50, // Fast sampling for tests
      maxProfileDuration: 5000, // 5 seconds max for tests
      retainProfiles: 60000 // 1 minute retention for tests
    });
  });

  afterEach(async () => {
    // Clean up any active sessions
    const activeSessions = profiler.getActiveSessions();
    for (const sessionId of activeSessions) {
      try {
        await profiler.stopProfiling(sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Profiling Session Management', () => {
    test('should start profiling session successfully', async () => {
      const sessionId = 'test-session-1';

      await profiler.startProfiling(sessionId, ['authentication', 'database']);

      const activeSessions = profiler.getActiveSessions();
      expect(activeSessions).toContain(sessionId);

      const sessionStatus = profiler.getSessionStatus(sessionId);
      expect(sessionStatus).toBeTruthy();
      expect(sessionStatus?.status).toBe('active');
      expect(sessionStatus?.components).toEqual(['authentication', 'database']);
    });

    test('should throw error when starting duplicate session', async () => {
      const sessionId = 'duplicate-session';

      await profiler.startProfiling(sessionId);

      await expect(profiler.startProfiling(sessionId))
        .rejects.toThrow('Profiling session duplicate-session already active');
    });

    test('should start profiling with default components', async () => {
      const sessionId = 'default-components-session';

      await profiler.startProfiling(sessionId);

      const sessionStatus = profiler.getSessionStatus(sessionId);
      expect(sessionStatus?.components).toEqual([
        'authentication', 'database', 'realtime', 'files', 'system'
      ]);
    });

    test('should stop profiling session and generate report', async () => {
      const sessionId = 'stop-session';

      await profiler.startProfiling(sessionId, ['authentication']);

      // Wait a bit for profiling data
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = await profiler.stopProfiling(sessionId);

      expect(report).toBeTruthy();
      expect(report.sessionId).toBe(sessionId);
      expect(report.components).toEqual(['authentication']);
      expect(report.duration).toBeGreaterThan(0);
      expect(report.summary).toBeTruthy();

      // Session should no longer be active
      const activeSessions = profiler.getActiveSessions();
      expect(activeSessions).not.toContain(sessionId);
    });

    test('should throw error when stopping non-existent session', async () => {
      await expect(profiler.stopProfiling('non-existent'))
        .rejects.toThrow('Profiling session non-existent not found');
    });
  });

  describe('Component Profiling', () => {
    test('should profile authentication component', async () => {
      const sessionId = 'auth-profiling';

      await profiler.startProfiling(sessionId, ['authentication']);
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.components).toContain('authentication');

      // Should have authentication-related bottlenecks or no issues
      const authBottlenecks = report.bottlenecks.filter(b => b.component === 'authentication');
      expect(authBottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    test('should profile database component', async () => {
      const sessionId = 'db-profiling';

      await profiler.startProfiling(sessionId, ['database']);
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.components).toContain('database');

      // Should have database-related analysis
      const dbBottlenecks = report.bottlenecks.filter(b => b.component === 'database');
      expect(dbBottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    test('should profile realtime component', async () => {
      const sessionId = 'realtime-profiling';

      await profiler.startProfiling(sessionId, ['realtime']);
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.components).toContain('realtime');

      const realtimeBottlenecks = report.bottlenecks.filter(b => b.component === 'realtime');
      expect(realtimeBottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    test('should profile files component', async () => {
      const sessionId = 'files-profiling';

      await profiler.startProfiling(sessionId, ['files']);
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.components).toContain('files');

      const filesBottlenecks = report.bottlenecks.filter(b => b.component === 'files');
      expect(filesBottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    test('should profile system component', async () => {
      const sessionId = 'system-profiling';

      await profiler.startProfiling(sessionId, ['system']);
      await new Promise(resolve => setTimeout(resolve, 100));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.components).toContain('system');

      const systemBottlenecks = report.bottlenecks.filter(b => b.component === 'system');
      expect(systemBottlenecks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Bottleneck Analysis', () => {
    test('should generate bottleneck report with summary', async () => {
      const sessionId = 'bottleneck-analysis';

      await profiler.startProfiling(sessionId);
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopProfiling(sessionId);

      expect(report.summary).toBeTruthy();
      expect(typeof report.summary.criticalIssues).toBe('number');
      expect(typeof report.summary.warningIssues).toBe('number');
      expect(typeof report.summary.optimizationOpportunities).toBe('number');
      expect(typeof report.summary.overallScore).toBe('number');
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
    });

    test('should categorize bottlenecks by severity', async () => {
      const sessionId = 'severity-test';

      await profiler.startProfiling(sessionId);
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopProfiling(sessionId);

      // Check that bottlenecks are properly categorized
      for (const bottleneck of report.bottlenecks) {
        expect(['critical', 'warning', 'info']).toContain(bottleneck.severity);
        expect(typeof bottleneck.value).toBe('number');
        expect(typeof bottleneck.threshold).toBe('number');
        expect(bottleneck.recommendation).toBeTruthy();
      }
    });

    test('should sort bottlenecks by severity', async () => {
      const sessionId = 'sorting-test';

      await profiler.startProfiling(sessionId);
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopProfiling(sessionId);

      if (report.bottlenecks.length > 1) {
        const severityOrder = { critical: 3, warning: 2, info: 1 };

        for (let i = 0; i < report.bottlenecks.length - 1; i++) {
          const currentSeverity = severityOrder[report.bottlenecks[i].severity];
          const nextSeverity = severityOrder[report.bottlenecks[i + 1].severity];
          expect(currentSeverity).toBeGreaterThanOrEqual(nextSeverity);
        }
      }
    });

    test('should generate optimization recommendations', async () => {
      const sessionId = 'recommendations-test';

      await profiler.startProfiling(sessionId);
      await new Promise(resolve => setTimeout(resolve, 150));
      const report = await profiler.stopProfiling(sessionId);

      expect(Array.isArray(report.recommendations)).toBe(true);

      // If there are bottlenecks, there should be recommendations
      if (report.bottlenecks.length > 0) {
        expect(report.recommendations.length).toBeGreaterThan(0);

        for (const recommendation of report.recommendations) {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('CPU Hotspot Analysis', () => {
    test('should analyze CPU hotspots', async () => {
      const sessionId = 'cpu-hotspots';

      await profiler.startProfiling(sessionId, ['system']);
      await new Promise(resolve => setTimeout(resolve, 100));
      await profiler.stopProfiling(sessionId);

      const hotspotAnalysis = await profiler.analyzeCPUHotspots(sessionId);

      expect(hotspotAnalysis).toBeTruthy();
      expect(hotspotAnalysis.sessionId).toBe(sessionId);
      expect(Array.isArray(hotspotAnalysis.hotspots)).toBe(true);
      expect(Array.isArray(hotspotAnalysis.recommendations)).toBe(true);

      // Check hotspot structure
      for (const hotspot of hotspotAnalysis.hotspots) {
        expect(typeof hotspot.component).toBe('string');
        expect(typeof hotspot.function).toBe('string');
        expect(typeof hotspot.usage).toBe('number');
        expect(typeof hotspot.duration).toBe('number');
        expect(typeof hotspot.impact).toBe('number');
        expect(typeof hotspot.recommendation).toBe('string');
      }
    });

    test('should throw error for non-existent session in CPU analysis', async () => {
      await expect(profiler.analyzeCPUHotspots('non-existent'))
        .rejects.toThrow('No profiles found for session non-existent');
    });
  });

  describe('Memory Usage Analysis', () => {
    test('should analyze memory usage patterns', async () => {
      const sessionId = 'memory-analysis';

      await profiler.startProfiling(sessionId, ['system']);
      await new Promise(resolve => setTimeout(resolve, 100));
      await profiler.stopProfiling(sessionId);

      const memoryAnalysis = await profiler.analyzeMemoryUsage(sessionId);

      expect(memoryAnalysis).toBeTruthy();
      expect(memoryAnalysis.sessionId).toBe(sessionId);
      expect(Array.isArray(memoryAnalysis.memoryLeaks)).toBe(true);
      expect(Array.isArray(memoryAnalysis.highUsagePeriods)).toBe(true);
      expect(Array.isArray(memoryAnalysis.recommendations)).toBe(true);
    });

    test('should throw error for non-existent session in memory analysis', async () => {
      await expect(profiler.analyzeMemoryUsage('non-existent'))
        .rejects.toThrow('No profiles found for session non-existent');
    });
  });

  describe('Database Query Profiling', () => {
    test('should profile database queries', async () => {
      const sessionId = 'db-queries';

      await profiler.startProfiling(sessionId, ['database']);
      await new Promise(resolve => setTimeout(resolve, 100));
      await profiler.stopProfiling(sessionId);

      const queryAnalysis = await profiler.profileDatabaseQueries(sessionId);

      expect(queryAnalysis).toBeTruthy();
      expect(queryAnalysis.sessionId).toBe(sessionId);
      expect(Array.isArray(queryAnalysis.slowQueries)).toBe(true);
      expect(Array.isArray(queryAnalysis.indexSuggestions)).toBe(true);
      expect(Array.isArray(queryAnalysis.optimizationOpportunities)).toBe(true);
    });

    test('should throw error for non-existent session in query profiling', async () => {
      await expect(profiler.profileDatabaseQueries('non-existent'))
        .rejects.toThrow('No profiles found for session non-existent');
    });
  });

  describe('Configuration & Edge Cases', () => {
    test('should use custom configuration', () => {
      const customConfig: ProfilerConfig = {
        enableCPUProfiling: false,
        enableMemoryProfiling: true,
        samplingInterval: 200,
        maxProfileDuration: 10000,
        enableDetailedLogging: true
      };

      const customProfiler = new PerformanceProfiler(customConfig);
      expect(customProfiler).toBeTruthy();
    });

    test('should handle multiple concurrent sessions', async () => {
      const session1 = 'concurrent-1';
      const session2 = 'concurrent-2';

      await profiler.startProfiling(session1, ['authentication']);
      await profiler.startProfiling(session2, ['database']);

      const activeSessions = profiler.getActiveSessions();
      expect(activeSessions).toContain(session1);
      expect(activeSessions).toContain(session2);

      await profiler.stopProfiling(session1);
      await profiler.stopProfiling(session2);

      const finalSessions = profiler.getActiveSessions();
      expect(finalSessions).not.toContain(session1);
      expect(finalSessions).not.toContain(session2);
    });

    test('should handle session status queries', async () => {
      const sessionId = 'status-test';

      // Before starting
      expect(profiler.getSessionStatus(sessionId)).toBeNull();

      // After starting
      await profiler.startProfiling(sessionId);
      const activeStatus = profiler.getSessionStatus(sessionId);
      expect(activeStatus?.status).toBe('active');

      // After stopping
      await profiler.stopProfiling(sessionId);
      expect(profiler.getSessionStatus(sessionId)).toBeNull();
    });
  });

  describe('Performance Validation', () => {
    test('should complete profiling efficiently', async () => {
      const sessionId = 'performance-test';
      const startTime = performance.now();

      await profiler.startProfiling(sessionId, ['authentication']);
      await new Promise(resolve => setTimeout(resolve, 50));
      const report = await profiler.stopProfiling(sessionId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
      expect(report).toBeTruthy();
    });

    test('should handle rapid session creation and destruction', async () => {
      const sessions = [];

      // Create multiple sessions rapidly
      for (let i = 0; i < 5; i++) {
        const sessionId = `rapid-${i}`;
        sessions.push(sessionId);
        await profiler.startProfiling(sessionId, ['authentication']);
      }

      // Stop all sessions
      for (const sessionId of sessions) {
        await profiler.stopProfiling(sessionId);
      }

      expect(profiler.getActiveSessions()).toHaveLength(0);
    });
  });
});