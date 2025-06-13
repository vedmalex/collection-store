import { describe, test, expect } from 'bun:test'
import type {
  // Dependency types
  AttributeDependencyDetailed,
  DependencyGraph,
  DependencyChangeEvent,
  DependencyValidationResult,
  IDependencyResolver,

  // Error types
  ComputedAttributeErrorDetailed,
  ErrorHandlingConfig,
  ErrorStatistics,
  IErrorHandler,

  // Monitoring types
  ComputedAttributeMetrics,
  PerformanceMonitor,
  HealthCheckResult,
  MonitoringConfig,
  IMonitoringService
} from '../types'

import {
  ComputedAttributeErrorFactory,
  ComputedAttributeErrorCodeDetailed,
  ErrorCategory,
  ErrorSeverity
} from '../types/ErrorTypes'

describe('Computed Attributes Types - Day 2', () => {
  describe('Dependency Types', () => {
    test('should have proper AttributeDependencyDetailed structure', () => {
      const mockDependency: AttributeDependencyDetailed = {
        id: 'dep-1',
        attributeId: 'attr-1',
        type: 'field',
        source: 'user.email',
        invalidateOnChange: true,
        priority: 'high',
        cacheable: true,
        changeFrequency: 'occasional'
      }

      expect(mockDependency.id).toBe('dep-1')
      expect(mockDependency.type).toBe('field')
      expect(mockDependency.priority).toBe('high')
      expect(mockDependency.cacheable).toBe(true)
    })

    test('should have proper DependencyGraph structure', () => {
      const mockGraph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
        circularDependencies: [],
        maxDepth: 5,
        lastUpdated: new Date()
      }

      expect(mockGraph.nodes).toBeInstanceOf(Map)
      expect(Array.isArray(mockGraph.edges)).toBe(true)
      expect(Array.isArray(mockGraph.circularDependencies)).toBe(true)
      expect(typeof mockGraph.maxDepth).toBe('number')
    })

    test('should have proper DependencyChangeEvent structure', () => {
      const mockEvent: DependencyChangeEvent = {
        type: 'field_changed',
        attributeId: 'attr-1',
        source: 'user.email',
        targetType: 'user',
        targetId: 'user-123',
        changeType: 'update',
        timestamp: Date.now(),
        nodeId: 'node-1',
        affectedAttributes: ['user-profile'],
        invalidationRequired: true
      }

      expect(mockEvent.type).toBe('field_changed')
      expect(mockEvent.targetType).toBe('user')
      expect(mockEvent.changeType).toBe('update')
      expect(mockEvent.invalidationRequired).toBe(true)
    })

    test('should have proper IDependencyResolver interface structure', () => {
      const mockResolver: Partial<IDependencyResolver> = {
        resolveDependencies: async () => [],
        getComputationOrder: async () => [],
        checkCircularDependencies: async () => [],
        getAffectedAttributes: async () => []
      }

      expect(typeof mockResolver.resolveDependencies).toBe('function')
      expect(typeof mockResolver.getComputationOrder).toBe('function')
      expect(typeof mockResolver.checkCircularDependencies).toBe('function')
      expect(typeof mockResolver.getAffectedAttributes).toBe('function')
    })
  })

  describe('Error Types', () => {
    test('should have proper ComputedAttributeErrorDetailed structure', () => {
      const mockError: ComputedAttributeErrorDetailed = {
        name: 'ComputedAttributeError',
        message: 'Test error',
        code: ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
        category: ErrorCategory.COMPUTATION,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        recoverable: true
      }

      expect(mockError.name).toBe('ComputedAttributeError')
      expect(mockError.code).toBe(ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED)
      expect(mockError.category).toBe(ErrorCategory.COMPUTATION)
      expect(mockError.severity).toBe(ErrorSeverity.HIGH)
      expect(mockError.recoverable).toBe(true)
    })

    test('should have proper error code enumeration', () => {
      expect(ComputedAttributeErrorCodeDetailed.ATTRIBUTE_NOT_FOUND).toBeDefined()
      expect(ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED).toBeDefined()
      expect(ComputedAttributeErrorCodeDetailed.CIRCULAR_DEPENDENCY).toBeDefined()
      expect(ComputedAttributeErrorCodeDetailed.SECURITY_VIOLATION).toBeDefined()
    })

    test('should have proper error categories', () => {
      expect(ErrorCategory.VALIDATION).toBeDefined()
      expect(ErrorCategory.COMPUTATION).toBeDefined()
      expect(ErrorCategory.CACHE).toBeDefined()
      expect(ErrorCategory.DEPENDENCY).toBeDefined()
      expect(ErrorCategory.SECURITY).toBeDefined()
    })

    test('should have proper error severity levels', () => {
      expect(ErrorSeverity.LOW).toBeDefined()
      expect(ErrorSeverity.MEDIUM).toBeDefined()
      expect(ErrorSeverity.HIGH).toBeDefined()
      expect(ErrorSeverity.CRITICAL).toBeDefined()
    })

    test('should create errors using ComputedAttributeErrorFactory', () => {
      const error = ComputedAttributeErrorFactory.create(
        'Test computation failed',
        ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED,
        'computation',
        {
          attributeId: 'test-attr',
          targetId: 'user-123',
          recoverable: true
        }
      )

      expect(error.name).toBe('ComputedAttributeError')
      expect(error.code).toBe(ComputedAttributeErrorCodeDetailed.COMPUTATION_FAILED)
      expect(error.message).toBe('Test computation failed')
      expect(error.attributeId).toBe('test-attr')
      expect(error.targetId).toBe('user-123')
      expect(error.recoverable).toBe(true)
      expect(error.category).toBe(ErrorCategory.COMPUTATION)
    })

    test('should have proper IErrorHandler interface structure', () => {
      const mockHandler: Partial<IErrorHandler> = {
        handleError: async () => ({
          handled: true,
          recovered: false,
          strategy: 'retry',
          retryCount: 1,
          fallbackUsed: false,
          executionTime: 100
        }),
        registerRecoveryStrategy: () => {},
        getErrorStatistics: async () => ({} as ErrorStatistics),
        onError: () => {}
      }

      expect(typeof mockHandler.handleError).toBe('function')
      expect(typeof mockHandler.registerRecoveryStrategy).toBe('function')
      expect(typeof mockHandler.getErrorStatistics).toBe('function')
      expect(typeof mockHandler.onError).toBe('function')
    })
  })

  describe('Monitoring Types', () => {
    test('should have proper ComputedAttributeMetrics structure', () => {
      const mockMetrics: ComputedAttributeMetrics = {
        totalComputations: 1000,
        successfulComputations: 950,
        failedComputations: 50,
        averageComputeTime: 25.5,
        medianComputeTime: 20.0,
        p95ComputeTime: 45.0,
        p99ComputeTime: 80.0,
        cacheHitRate: 0.85,
        cacheMissRate: 0.15,
        cacheSize: 500,
        cacheMemoryUsage: 1024 * 1024,
        averageCacheRetrievalTime: 2.5,
        averageDependencyDepth: 3.2,
        circularDependencies: 0,
        dependencyResolutionTime: 5.0,
        errorRate: 0.05,
        timeoutRate: 0.01,
        recoveryRate: 0.8,
        memoryUsage: 50 * 1024 * 1024,
        cpuUsage: 0.15,
        networkRequests: 25,
        lastUpdated: new Date(),
        measurementPeriod: 300
      }

      expect(mockMetrics.totalComputations).toBe(1000)
      expect(mockMetrics.cacheHitRate).toBe(0.85)
      expect(mockMetrics.errorRate).toBe(0.05)
      expect(typeof mockMetrics.lastUpdated).toBe('object')
    })

    test('should have proper PerformanceMonitor structure', () => {
      const mockMonitor: PerformanceMonitor = {
        activeComputations: 5,
        queuedComputations: 2,
        systemLoad: 0.3,
        recentComputeTime: [20, 25, 30, 22, 28],
        recentErrorRate: 0.02,
        recentThroughput: 15.5,
        activeAlerts: [],
        alertHistory: [],
        healthScore: 95,
        healthStatus: 'healthy',
        lastHealthCheck: new Date()
      }

      expect(mockMonitor.activeComputations).toBe(5)
      expect(mockMonitor.systemLoad).toBe(0.3)
      expect(mockMonitor.healthStatus).toBe('healthy')
      expect(Array.isArray(mockMonitor.recentComputeTime)).toBe(true)
    })

    test('should have proper HealthCheckResult structure', () => {
      const mockHealthCheck: HealthCheckResult = {
        healthy: true,
        score: 95,
        status: 'healthy',
        components: {
          engine: {
            healthy: true,
            score: 98,
            status: 'healthy',
            lastCheck: new Date(),
            issues: []
          },
          cache: {
            healthy: true,
            score: 92,
            status: 'healthy',
            lastCheck: new Date(),
            issues: []
          },
          dependencies: {
            healthy: true,
            score: 95,
            status: 'healthy',
            lastCheck: new Date(),
            issues: []
          },
          external: {
            healthy: true,
            score: 90,
            status: 'healthy',
            lastCheck: new Date(),
            issues: []
          },
          database: {
            healthy: true,
            score: 97,
            status: 'healthy',
            lastCheck: new Date(),
            issues: []
          }
        },
        issues: [],
        recommendations: [],
        timestamp: new Date(),
        checkDuration: 150,
        nodeId: 'node-1'
      }

      expect(mockHealthCheck.healthy).toBe(true)
      expect(mockHealthCheck.score).toBe(95)
      expect(mockHealthCheck.status).toBe('healthy')
      expect(mockHealthCheck.components.engine.healthy).toBe(true)
    })

    test('should have proper IMonitoringService interface structure', () => {
      const mockService: Partial<IMonitoringService> = {
        start: async () => {},
        stop: async () => {},
        getMetrics: async () => ({} as ComputedAttributeMetrics),
        getPerformanceMonitor: async () => ({} as PerformanceMonitor),
        performHealthCheck: async () => ({} as HealthCheckResult),
        getActiveAlerts: async () => [],
        startTrace: () => ({
          traceId: 'trace-1',
          attributeId: 'attr-1',
          targetId: 'target-1',
          startTime: new Date(),
          steps: [],
          context: { nodeId: 'node-1' },
          success: false,
          memoryUsage: 0,
          cpuTime: 0,
          networkCalls: 0
        }),
        endTrace: () => {},
        onEvent: () => {},
        configure: async () => {}
      }

      expect(typeof mockService.start).toBe('function')
      expect(typeof mockService.getMetrics).toBe('function')
      expect(typeof mockService.performHealthCheck).toBe('function')
      expect(typeof mockService.startTrace).toBe('function')
    })
  })

  describe('Type Safety and Validation', () => {
    test('should enforce correct dependency types', () => {
      const validTypes: Array<AttributeDependencyDetailed['type']> = [
        'field',
        'collection',
        'external_api',
        'system',
        'computed_attribute'
      ]

      validTypes.forEach(type => {
        const dependency: Partial<AttributeDependencyDetailed> = { type }
        expect(dependency.type).toBe(type)
      })
    })

    test('should enforce correct priority levels', () => {
      const validPriorities: Array<AttributeDependencyDetailed['priority']> = [
        'low',
        'medium',
        'high',
        'critical'
      ]

      validPriorities.forEach(priority => {
        const dependency: Partial<AttributeDependencyDetailed> = { priority }
        expect(dependency.priority).toBe(priority)
      })
    })

    test('should enforce correct health status values', () => {
      const validStatuses: Array<HealthCheckResult['status']> = [
        'healthy',
        'degraded',
        'unhealthy',
        'critical'
      ]

      validStatuses.forEach(status => {
        const health: Partial<HealthCheckResult> = { status }
        expect(health.status).toBe(status)
      })
    })
  })
})

describe('Computed Attributes Module Export - Day 2', () => {
  test('should export all new types and interfaces', async () => {
    const module = await import('../types')

    // Check that new types are exported
    expect(module).toBeDefined()

    // Verify specific exports exist (they should be undefined since they're types)
    expect(typeof module.ComputedAttributeErrorFactory).toBe('function')
  })

  test('should export error factory class', () => {
    expect(ComputedAttributeErrorFactory).toBeDefined()
    expect(typeof ComputedAttributeErrorFactory.create).toBe('function')
  })
})