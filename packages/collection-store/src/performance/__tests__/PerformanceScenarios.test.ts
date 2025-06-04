/**
 * PerformanceScenarios Tests
 * Phase 6: Performance Testing & Optimization
 *
 * Following DEVELOPMENT_RULES.md:
 * - High-granularity tests grouped by functionality
 * - Use performance.now() for timing measurements
 * - Ensure test context isolation
 * - Test every feature comprehensively
 */

import { PerformanceScenarios } from '../testing/PerformanceScenarios'
import { LoadTestScenario } from '../testing/interfaces'

describe('Phase 6: PerformanceScenarios', () => {
  let scenarios: PerformanceScenarios

  beforeEach(() => {
    // Create clean state for each test (test context isolation)
    scenarios = new PerformanceScenarios()
  })

  afterEach(() => {
    // Cleanup resources after each test
    scenarios = null as any
  })

  // ============================================================================
  // AUTHENTICATION SCENARIOS
  // ============================================================================

  describe('Authentication Scenarios', () => {
    describe('createAuthenticationScenario', () => {
      it('should create authentication scenario with default config', () => {
        const scenario = scenarios.createAuthenticationScenario()

        expect(scenario.name).toBe('Authentication Performance Test')
        expect(scenario.description).toBe('Tests authentication system performance under load')
        expect(scenario.virtualUsers).toBe(100)
        expect(scenario.testDuration).toBe(300)
        expect(scenario.rampUpTime).toBe(30)
        expect(scenario.operations).toHaveLength(4)

        // Check operation weights sum to 100
        const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
        expect(totalWeight).toBe(100)

        // Check operation types
        expect(scenario.operations.every(op => op.type === 'auth')).toBe(true)

        // Check success criteria
        expect(scenario.successCriteria.maxResponseTime).toBe(500)
        expect(scenario.successCriteria.minThroughput).toBe(200) // userCount * 2
        expect(scenario.successCriteria.maxErrorRate).toBe(1)
      })

      it('should create authentication scenario with custom config', () => {
        const config = {
          userCount: 50,
          duration: 180,
          rampUpTime: 15,
          loginRatio: 60,
          validateRatio: 25,
          refreshRatio: 10,
          logoutRatio: 5,
          sessionDuration: 3600,
          successCriteria: {
            maxResponseTime: 300,
            maxErrorRate: 0.5
          }
        }

        const scenario = scenarios.createAuthenticationScenario(config)

        expect(scenario.virtualUsers).toBe(50)
        expect(scenario.testDuration).toBe(180)
        expect(scenario.rampUpTime).toBe(15)
        expect(scenario.operations[0].weight).toBe(60) // login
        expect(scenario.operations[1].weight).toBe(25) // validate
        expect(scenario.operations[2].weight).toBe(10) // refresh
        expect(scenario.operations[3].weight).toBe(5)  // logout
        expect(scenario.successCriteria.maxResponseTime).toBe(300)
        expect(scenario.successCriteria.maxErrorRate).toBe(0.5)
      })

      it('should include session duration in login operation', () => {
        const config = { sessionDuration: 7200 }
        const scenario = scenarios.createAuthenticationScenario(config)

        const loginOperation = scenario.operations.find(op =>
          op.config.operation === 'login'
        )
        expect(loginOperation).toBeDefined()
        expect(loginOperation!.config.sessionDuration).toBe(7200)
      })
    })

    describe('createAuthenticationStressScenario', () => {
      it('should create high-load authentication scenario', () => {
        const scenario = scenarios.createAuthenticationStressScenario()

        expect(scenario.virtualUsers).toBe(1000)
        expect(scenario.testDuration).toBe(600)
        expect(scenario.rampUpTime).toBe(60)
        expect(scenario.successCriteria.maxResponseTime).toBe(1000)
        expect(scenario.successCriteria.minThroughput).toBe(1500)
        expect(scenario.successCriteria.maxErrorRate).toBe(2)
        expect(scenario.successCriteria.maxMemoryUsage).toBe(1024 * 1024 * 1024) // 1GB
      })

      it('should allow custom config override', () => {
        const config = { userCount: 500, duration: 300 }
        const scenario = scenarios.createAuthenticationStressScenario(config)

        expect(scenario.virtualUsers).toBe(500)
        expect(scenario.testDuration).toBe(300)
        // Should still use stress scenario defaults for other values
        expect(scenario.successCriteria.maxResponseTime).toBe(1000)
      })
    })
  })

  // ============================================================================
  // DATABASE SCENARIOS
  // ============================================================================

  describe('Database Scenarios', () => {
    describe('createDatabaseScenario', () => {
      it('should create database scenario with default config', () => {
        const scenario = scenarios.createDatabaseScenario()

        expect(scenario.name).toBe('Database CRUD Performance Test')
        expect(scenario.description).toBe('Tests database operations performance under load')
        expect(scenario.virtualUsers).toBe(200)
        expect(scenario.testDuration).toBe(300)
        expect(scenario.operations).toHaveLength(5) // read, write, update, delete, aggregate

        // Check operation weights
        const weights = scenario.operations.map(op => op.weight)
        expect(weights).toEqual([60, 20, 15, 3, 2]) // read, write, update, delete, aggregate

        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        expect(totalWeight).toBe(100)

        // Check all operations are query type
        expect(scenario.operations.every(op => op.type === 'query')).toBe(true)
      })

      it('should use first collection from collections array', () => {
        const config = { collections: ['orders', 'products', 'users'] }
        const scenario = scenarios.createDatabaseScenario(config)

        // All operations should use 'orders' collection
        scenario.operations.forEach(op => {
          expect(op.config.collection).toBe('orders')
        })
      })

      it('should use default collection when collections array is empty', () => {
        const config = { collections: [] }
        const scenario = scenarios.createDatabaseScenario(config)

        scenario.operations.forEach(op => {
          expect(op.config.collection).toBe('test_collection')
        })
      })

      it('should configure indexed vs non-indexed queries', () => {
        const indexedScenario = scenarios.createDatabaseScenario({ indexedQueries: true })
        const nonIndexedScenario = scenarios.createDatabaseScenario({ indexedQueries: false })

        const indexedReadOp = indexedScenario.operations.find(op => op.config.operation === 'find')
        const nonIndexedReadOp = nonIndexedScenario.operations.find(op => op.config.operation === 'find')

        expect(indexedReadOp!.config.query).toEqual({ id: { $gte: 1 } })
        expect(nonIndexedReadOp!.config.query).toEqual({ name: { $regex: 'test' } })
      })

      it('should include aggregation pipeline', () => {
        const scenario = scenarios.createDatabaseScenario()

        const aggregateOp = scenario.operations.find(op => op.config.operation === 'aggregate')
        expect(aggregateOp).toBeDefined()
        expect(aggregateOp!.config.pipeline).toEqual([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      })
    })

    describe('createDatabaseStressScenario', () => {
      it('should create high-load database scenario', () => {
        const scenario = scenarios.createDatabaseStressScenario()

        expect(scenario.virtualUsers).toBe(500)
        expect(scenario.testDuration).toBe(900)
        expect(scenario.rampUpTime).toBe(60)
        expect(scenario.successCriteria.maxResponseTime).toBe(500)
        expect(scenario.successCriteria.minThroughput).toBe(1000)
        expect(scenario.successCriteria.maxMemoryUsage).toBe(1024 * 1024 * 1536) // 1.5GB
      })
    })
  })

  // ============================================================================
  // REAL-TIME SCENARIOS
  // ============================================================================

  describe('Real-time Scenarios', () => {
    describe('createRealtimeScenario', () => {
      it('should create realtime scenario with default config', () => {
        const scenario = scenarios.createRealtimeScenario()

        expect(scenario.name).toBe('Real-time Performance Test')
        expect(scenario.description).toBe('Tests real-time subscriptions and messaging performance')
        expect(scenario.virtualUsers).toBe(150)
        expect(scenario.testDuration).toBe(300)
        expect(scenario.operations).toHaveLength(4) // subscribe, publish, unsubscribe, cross_tab_sync

        // Check operation weights
        const weights = scenario.operations.map(op => op.weight)
        expect(weights).toEqual([40, 30, 20, 10]) // subscribe, publish, unsubscribe, cross_tab_sync

        // Check all operations are real_time type
        expect(scenario.operations.every(op => op.type === 'real_time')).toBe(true)
      })

      it('should use first channel from channels array', () => {
        const config = { channels: ['alerts', 'notifications', 'updates'] }
        const scenario = scenarios.createRealtimeScenario(config)

        const subscribeOp = scenario.operations.find(op => op.config.operation === 'subscribe')
        const publishOp = scenario.operations.find(op => op.config.operation === 'publish')
        const unsubscribeOp = scenario.operations.find(op => op.config.operation === 'unsubscribe')

        expect(subscribeOp!.config.channel).toBe('alerts')
        expect(publishOp!.config.channel).toBe('alerts')
        expect(unsubscribeOp!.config.channel).toBe('alerts')
      })

      it('should use default channel when channels array is empty', () => {
        const config = { channels: [] }
        const scenario = scenarios.createRealtimeScenario(config)

        const subscribeOp = scenario.operations.find(op => op.config.operation === 'subscribe')
        expect(subscribeOp!.config.channel).toBe('test_channel')
      })

      it('should include cross-tab sync operation', () => {
        const scenario = scenarios.createRealtimeScenario()

        const crossTabOp = scenario.operations.find(op => op.config.operation === 'cross_tab_sync')
        expect(crossTabOp).toBeDefined()
        expect(crossTabOp!.config.data).toEqual({ action: 'update', entity: 'user' })
      })
    })

    describe('createRealtimeStressScenario', () => {
      it('should create high-concurrency realtime scenario', () => {
        const scenario = scenarios.createRealtimeStressScenario()

        expect(scenario.virtualUsers).toBe(1000)
        expect(scenario.testDuration).toBe(600)
        expect(scenario.rampUpTime).toBe(45)
        expect(scenario.successCriteria.maxResponseTime).toBe(300)
        expect(scenario.successCriteria.minThroughput).toBe(3000)
        expect(scenario.successCriteria.maxMemoryUsage).toBe(1024 * 1024 * 1280) // 1.25GB
      })
    })
  })

  // ============================================================================
  // FILE STORAGE SCENARIOS
  // ============================================================================

  describe('File Storage Scenarios', () => {
    describe('createFileStorageScenario', () => {
      it('should create file storage scenario with default config', () => {
        const scenario = scenarios.createFileStorageScenario()

        expect(scenario.name).toBe('File Storage Performance Test')
        expect(scenario.description).toBe('Tests file storage operations performance')
        expect(scenario.virtualUsers).toBe(100)
        expect(scenario.operations).toHaveLength(4) // upload, download, delete, list

        // Check operation weights
        const weights = scenario.operations.map(op => op.weight)
        expect(weights).toEqual([40, 35, 15, 10]) // upload, download, delete, list

        // Check all operations are query type (file operations use query type)
        expect(scenario.operations.every(op => op.type === 'query')).toBe(true)
      })

      it('should configure file operations correctly', () => {
        const config = {
          fileSizes: ['large' as const],
          compressionEnabled: false,
          thumbnailGeneration: false
        }
        const scenario = scenarios.createFileStorageScenario(config)

        const uploadOp = scenario.operations.find(op => op.config.operation === 'file_upload')
        expect(uploadOp).toBeDefined()
        expect(uploadOp!.config.compression).toBe(false)
        expect(uploadOp!.config.generateThumbnail).toBe(false)
        expect(uploadOp!.config.fileSize).toBe('10MB') // large file size
      })

      it('should include all file operations', () => {
        const scenario = scenarios.createFileStorageScenario()

        const operations = scenario.operations.map(op => op.config.operation)
        expect(operations).toContain('file_upload')
        expect(operations).toContain('file_download')
        expect(operations).toContain('file_delete')
        expect(operations).toContain('file_list')
      })
    })
  })

  // ============================================================================
  // COMPUTED ATTRIBUTES SCENARIOS
  // ============================================================================

  describe('Computed Attributes Scenarios', () => {
    describe('createComputedAttributesScenario', () => {
      it('should create computed attributes scenario with default config', () => {
        const scenario = scenarios.createComputedAttributesScenario()

        expect(scenario.name).toBe('Computed Attributes Performance Test')
        expect(scenario.description).toBe('Tests computed attributes calculation performance')
        expect(scenario.virtualUsers).toBe(80)
        expect(scenario.operations).toHaveLength(3) // simple, complex, dependent

        // Check operation weights
        const weights = scenario.operations.map(op => op.weight)
        expect(weights).toEqual([50, 30, 20]) // simple, complex, dependent
      })

      it('should configure different computation types', () => {
        const scenario = scenarios.createComputedAttributesScenario()

        const simpleOp = scenario.operations.find(op => op.config.type === 'simple')
        const complexOp = scenario.operations.find(op => op.config.type === 'complex')
        const dependentOp = scenario.operations.find(op => op.config.type === 'dependent')

        expect(simpleOp).toBeDefined()
        expect(simpleOp!.config.expression).toBe('field1 + field2')
        expect(simpleOp!.expectedResponseTime).toBe(50)

        expect(complexOp).toBeDefined()
        expect(complexOp!.config.expression).toBe('SUM(related.values) / COUNT(related.items)')
        expect(complexOp!.expectedResponseTime).toBe(200)

        expect(dependentOp).toBeDefined()
        expect(dependentOp!.config.dependencies).toEqual(['computed_field1', 'computed_field2'])
        expect(dependentOp!.expectedResponseTime).toBe(300)
      })

      it('should configure cache hit ratio', () => {
        const scenario = scenarios.createComputedAttributesScenario({ cacheHitRatio: 90 })

        // All operations should have cache configuration
        scenario.operations.forEach(op => {
          expect(op.config).toHaveProperty('cacheEnabled')
          expect(typeof op.config.cacheEnabled).toBe('boolean')
        })
      })
    })
  })

  // ============================================================================
  // STORED FUNCTIONS SCENARIOS
  // ============================================================================

  describe('Stored Functions Scenarios', () => {
    describe('createStoredFunctionsScenario', () => {
      it('should create stored functions scenario with default config', () => {
        const scenario = scenarios.createStoredFunctionsScenario()

        expect(scenario.name).toBe('Stored Functions Performance Test')
        expect(scenario.description).toBe('Tests stored functions execution performance')
        expect(scenario.virtualUsers).toBe(60)
        expect(scenario.operations).toHaveLength(4) // simple, complex, data processing, aggregation

        // Check operation weights
        const weights = scenario.operations.map(op => op.weight)
        expect(weights).toEqual([40, 30, 20, 10])
      })

      it('should configure different function types', () => {
        const scenario = scenarios.createStoredFunctionsScenario()

        const operations = scenario.operations.map(op => ({
          functionName: op.config.functionName,
          expectedTime: op.expectedResponseTime
        }))

        expect(operations).toContainEqual({
          functionName: 'simple_calculation',
          expectedTime: 100
        })
        expect(operations).toContainEqual({
          functionName: 'complex_business_logic',
          expectedTime: 300
        })
        expect(operations).toContainEqual({
          functionName: 'data_transformation',
          expectedTime: 500
        })
        expect(operations).toContainEqual({
          functionName: 'aggregate_reports',
          expectedTime: 800
        })
      })

      it('should include function parameters', () => {
        const scenario = scenarios.createStoredFunctionsScenario()

        const simpleOp = scenario.operations.find(op =>
          op.config.functionName === 'simple_calculation'
        )
        const complexOp = scenario.operations.find(op =>
          op.config.functionName === 'complex_business_logic'
        )

        expect(simpleOp!.config.parameters).toEqual({ value: 100 })
        expect(complexOp!.config.parameters).toEqual({
          userId: 'test_user',
          data: { items: [1, 2, 3] }
        })
      })
    })
  })

  // ============================================================================
  // MIXED WORKLOAD SCENARIOS
  // ============================================================================

  describe('Mixed Workload Scenarios', () => {
    describe('createMixedWorkloadScenario', () => {
      it('should create comprehensive mixed workload scenario', () => {
        const scenario = scenarios.createMixedWorkloadScenario()

        expect(scenario.name).toBe('Mixed Workload Performance Test')
        expect(scenario.description).toBe('Tests mixed workload with all Collection Store features')
        expect(scenario.virtualUsers).toBe(300)
        expect(scenario.testDuration).toBe(600)
        expect(scenario.operations.length).toBeGreaterThan(10) // Multiple operation types

        // Check total weights sum to 100
        const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
        expect(totalWeight).toBe(100)
      })

      it('should include all operation types', () => {
        const scenario = scenarios.createMixedWorkloadScenario()

        const operationTypes = scenario.operations.map(op => op.type)
        expect(operationTypes).toContain('auth')
        expect(operationTypes).toContain('query')
        expect(operationTypes).toContain('real_time')
      })

      it('should distribute workload across features', () => {
        const scenario = scenarios.createMixedWorkloadScenario()

        // Count operations by category
        const authOps = scenario.operations.filter(op => op.type === 'auth')
        const queryOps = scenario.operations.filter(op => op.type === 'query')
        const realtimeOps = scenario.operations.filter(op => op.type === 'real_time')

        expect(authOps.length).toBeGreaterThan(0)
        expect(queryOps.length).toBeGreaterThan(0)
        expect(realtimeOps.length).toBeGreaterThan(0)

        // Auth should be ~20% (2 operations)
        const authWeight = authOps.reduce((sum, op) => sum + op.weight, 0)
        expect(authWeight).toBe(20)

        // Real-time should be ~20% (2 operations)
        const realtimeWeight = realtimeOps.reduce((sum, op) => sum + op.weight, 0)
        expect(realtimeWeight).toBe(20)
      })
    })
  })

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  describe('Utility Methods', () => {
    describe('getAvailableScenarios', () => {
      it('should return all available scenario types', () => {
        const availableScenarios = scenarios.getAvailableScenarios()

        expect(availableScenarios).toContain('authentication')
        expect(availableScenarios).toContain('authentication_stress')
        expect(availableScenarios).toContain('database')
        expect(availableScenarios).toContain('database_stress')
        expect(availableScenarios).toContain('realtime')
        expect(availableScenarios).toContain('realtime_stress')
        expect(availableScenarios).toContain('file_storage')
        expect(availableScenarios).toContain('computed_attributes')
        expect(availableScenarios).toContain('stored_functions')
        expect(availableScenarios).toContain('mixed_workload')

        expect(availableScenarios.length).toBe(10)
      })
    })

    describe('createScenarioByName', () => {
      it('should create scenarios by name', () => {
        const authScenario = scenarios.createScenarioByName('authentication')
        const dbScenario = scenarios.createScenarioByName('database')
        const realtimeScenario = scenarios.createScenarioByName('realtime')

        expect(authScenario.name).toBe('Authentication Performance Test')
        expect(dbScenario.name).toBe('Database CRUD Performance Test')
        expect(realtimeScenario.name).toBe('Real-time Performance Test')
      })

      it('should pass config to scenario creation', () => {
        const config = { userCount: 75, duration: 240 }
        const scenario = scenarios.createScenarioByName('authentication', config)

        expect(scenario.virtualUsers).toBe(75)
        expect(scenario.testDuration).toBe(240)
      })

      it('should throw error for unknown scenario type', () => {
        expect(() => {
          scenarios.createScenarioByName('unknown_scenario')
        }).toThrow('Unknown scenario type: unknown_scenario')
      })

      it('should create all available scenario types', () => {
        const availableScenarios = scenarios.getAvailableScenarios()

        availableScenarios.forEach(scenarioName => {
          expect(() => {
            scenarios.createScenarioByName(scenarioName)
          }).not.toThrow()
        })
      })
    })
  })

  // ============================================================================
  // DATA GENERATION VALIDATION
  // ============================================================================

  describe('Data Generation', () => {
    it('should generate different record sizes', () => {
      const smallScenario = scenarios.createDatabaseScenario({ recordSize: 'small' })
      const mediumScenario = scenarios.createDatabaseScenario({ recordSize: 'medium' })
      const largeScenario = scenarios.createDatabaseScenario({ recordSize: 'large' })

      // All should have insert operations with data
      const smallInsert = smallScenario.operations.find(op => op.config.operation === 'insert')
      const mediumInsert = mediumScenario.operations.find(op => op.config.operation === 'insert')
      const largeInsert = largeScenario.operations.find(op => op.config.operation === 'insert')

      expect(smallInsert!.config.data).toBeDefined()
      expect(mediumInsert!.config.data).toBeDefined()
      expect(largeInsert!.config.data).toBeDefined()

      // Large records should have more properties
      const smallDataStr = JSON.stringify(smallInsert!.config.data)
      const largeDataStr = JSON.stringify(largeInsert!.config.data)
      expect(largeDataStr.length).toBeGreaterThan(smallDataStr.length)
    })

    it('should generate different message sizes', () => {
      const smallScenario = scenarios.createRealtimeScenario({ messageSize: 'small' })
      const largeScenario = scenarios.createRealtimeScenario({ messageSize: 'large' })

      const smallPublish = smallScenario.operations.find(op => op.config.operation === 'publish')
      const largePublish = largeScenario.operations.find(op => op.config.operation === 'publish')

      expect(smallPublish!.config.data).toBeDefined()
      expect(largePublish!.config.data).toBeDefined()

      // Large messages should have more data
      const smallDataStr = JSON.stringify(smallPublish!.config.data)
      const largeDataStr = JSON.stringify(largePublish!.config.data)
      expect(largeDataStr.length).toBeGreaterThan(smallDataStr.length)
    })
  })

  // ============================================================================
  // PERFORMANCE VALIDATION
  // ============================================================================

  describe('Performance Validation', () => {
    it('should create scenarios efficiently', () => {
      const startTime = performance.now()

      // Create multiple scenarios
      for (let i = 0; i < 50; i++) {
        scenarios.createAuthenticationScenario()
        scenarios.createDatabaseScenario()
        scenarios.createRealtimeScenario()
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (less than 100ms for 150 scenarios)
      expect(totalTime).toBeLessThan(100)
    })

    it('should create scenarios by name efficiently', () => {
      const startTime = performance.now()
      const availableScenarios = scenarios.getAvailableScenarios()

      // Create each scenario type multiple times
      for (let i = 0; i < 20; i++) {
        availableScenarios.forEach(scenarioName => {
          scenarios.createScenarioByName(scenarioName)
        })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (less than 200ms for 200 scenarios)
      expect(totalTime).toBeLessThan(200)
    })
  })
})

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

function validateScenarioStructure(scenario: LoadTestScenario): void {
  expect(scenario.id).toBeDefined()
  expect(scenario.name).toBeDefined()
  expect(scenario.virtualUsers).toBeGreaterThan(0)
  expect(scenario.testDuration).toBeGreaterThan(0)
  expect(scenario.rampUpTime).toBeGreaterThanOrEqual(0)
  expect(scenario.operations).toBeInstanceOf(Array)
  expect(scenario.operations.length).toBeGreaterThan(0)
  expect(scenario.successCriteria).toBeDefined()

  // Validate operation weights sum to 100
  const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
  expect(totalWeight).toBe(100)

  // Validate each operation
  scenario.operations.forEach(op => {
    expect(op.type).toMatch(/^(auth|query|real_time)$/)
    expect(op.weight).toBeGreaterThan(0)
    expect(op.config).toBeDefined()
    expect(op.expectedResponseTime).toBeGreaterThan(0)
  })
}