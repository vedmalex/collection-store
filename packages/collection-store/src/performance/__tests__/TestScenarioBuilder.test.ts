/**
 * TestScenarioBuilder Tests
 * Phase 6: Performance Testing & Optimization
 *
 * Following DEVELOPMENT_RULES.md:
 * - High-granularity tests grouped by functionality
 * - Use performance.now() for timing measurements
 * - Ensure test context isolation
 * - Test every feature comprehensively
 */

import {
  TestScenarioBuilder,
  TestScenarioBuilderInstance,
  ScenarioTemplate,
  ScenarioValidationResult,
  ScenarioOptimization
} from '../utils/TestScenarioBuilder'
import {
  LoadTestScenario,
  AuthScenarioConfig,
  DatabaseScenarioConfig,
  RealtimeScenarioConfig,
  SuccessCriteria
} from '../testing/interfaces'

describe('Phase 6: TestScenarioBuilder', () => {
  let builder: TestScenarioBuilder

  beforeEach(() => {
    // Create clean state for each test (test context isolation)
    builder = new TestScenarioBuilder()
  })

  afterEach(() => {
    // Cleanup resources after each test
    builder = null as any
  })

  // ============================================================================
  // FLUENT API TESTS
  // ============================================================================

  describe('Fluent API', () => {
    describe('createScenario', () => {
      it('should create scenario builder instance', () => {
        const scenarioBuilder = builder.createScenario('Test Scenario')

        expect(scenarioBuilder).toBeInstanceOf(TestScenarioBuilderInstance)
      })

      it('should set scenario name correctly', () => {
        const scenario = builder.createScenario('Test Scenario')
          .addAuthOperation(100)
          .build()

        expect(scenario.name).toBe('Test Scenario')
        expect(scenario.id).toMatch(/^scenario-\d+-\d+$/)
      })
    })

    describe('Fluent Builder Chain', () => {
      it('should build complete scenario with fluent API', () => {
        const scenario = builder.createScenario('Complete Test')
          .setDescription('A complete test scenario')
          .setUsers(50)
          .setDuration(120)
          .setRampUp(20)
          .addAuthOperation(40, { operation: 'login' }, 200)
          .addQueryOperation(60, { operation: 'find' }, 100)
          .setSuccessCriteria({
            maxResponseTime: 500,
            minThroughput: 100,
            maxErrorRate: 2,
            maxMemoryUsage: 1024 * 1024 * 500,
            maxCpuUsage: 70
          })
          .build()

        expect(scenario.name).toBe('Complete Test')
        expect(scenario.description).toBe('A complete test scenario')
        expect(scenario.virtualUsers).toBe(50)
        expect(scenario.testDuration).toBe(120)
        expect(scenario.rampUpTime).toBe(20)
        expect(scenario.operations).toHaveLength(2)
        expect(scenario.operations[0].type).toBe('auth')
        expect(scenario.operations[1].type).toBe('query')
        expect(scenario.successCriteria.maxResponseTime).toBe(500)
      })

      it('should validate operation weights sum to 100', () => {
        expect(() => {
          builder.createScenario('Invalid Weights')
            .addAuthOperation(40)
            .addQueryOperation(40) // Total: 80, should fail
            .build()
        }).toThrow('Operation weights must sum to 100')
      })

      it('should validate required fields', () => {
        expect(() => {
          const scenarioBuilder = builder.createScenario('Empty Scenario')
          // Clear operations to make it invalid
          ;(scenarioBuilder as any).scenario.operations = []
          scenarioBuilder.build()
        }).toThrow('Operation weights must sum to 100, got 0')
      })
    })

    describe('Operation Builders', () => {
      it('should add auth operations correctly', () => {
        const scenario = builder.createScenario('Auth Test')
          .addAuthOperation(100, { operation: 'login', user: 'test' }, 250)
          .build()

        expect(scenario.operations).toHaveLength(1)
        expect(scenario.operations[0].type).toBe('auth')
        expect(scenario.operations[0].weight).toBe(100)
        expect(scenario.operations[0].expectedResponseTime).toBe(250)
        expect(scenario.operations[0].config.operation).toBe('login')
        expect(scenario.operations[0].config.user).toBe('test')
      })

      it('should add query operations correctly', () => {
        const scenario = builder.createScenario('Query Test')
          .addQueryOperation(100, { collection: 'users', query: { active: true } }, 150)
          .build()

        expect(scenario.operations).toHaveLength(1)
        expect(scenario.operations[0].type).toBe('query')
        expect(scenario.operations[0].weight).toBe(100)
        expect(scenario.operations[0].expectedResponseTime).toBe(150)
        expect(scenario.operations[0].config.operation).toBe('query')
        expect(scenario.operations[0].config.collection).toBe('users')
      })

      it('should add realtime operations correctly', () => {
        const scenario = builder.createScenario('Realtime Test')
          .addRealtimeOperation(100, { channel: 'notifications', type: 'sse' }, 75)
          .build()

        expect(scenario.operations).toHaveLength(1)
        expect(scenario.operations[0].type).toBe('real_time')
        expect(scenario.operations[0].weight).toBe(100)
        expect(scenario.operations[0].expectedResponseTime).toBe(75)
        expect(scenario.operations[0].config.operation).toBe('realtime')
        expect(scenario.operations[0].config.channel).toBe('notifications')
      })

      it('should handle mixed operations', () => {
        const scenario = builder.createScenario('Mixed Test')
          .addAuthOperation(30)
          .addQueryOperation(50)
          .addRealtimeOperation(20)
          .build()

        expect(scenario.operations).toHaveLength(3)
        expect(scenario.operations[0].type).toBe('auth')
        expect(scenario.operations[1].type).toBe('query')
        expect(scenario.operations[2].type).toBe('real_time')

        const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
        expect(totalWeight).toBe(100)
      })
    })
  })

  // ============================================================================
  // PRE-BUILT SCENARIO TEMPLATES
  // ============================================================================

  describe('Pre-built Scenario Templates', () => {
    describe('getAuthenticationScenario', () => {
      it('should create authentication scenario correctly', () => {
        const config: AuthScenarioConfig = {
          userCount: 50,
          loginWeight: 40,
          validateWeight: 30,
          refreshWeight: 20,
          logoutWeight: 10
        }

        const scenario = builder.getAuthenticationScenario(config)

        expect(scenario.name).toBe('Authentication Load Test')
        expect(scenario.virtualUsers).toBe(50)
        expect(scenario.operations).toHaveLength(4)
        expect(scenario.operations[0].weight).toBe(40) // login
        expect(scenario.operations[1].weight).toBe(30) // validate
        expect(scenario.operations[2].weight).toBe(20) // refresh
        expect(scenario.operations[3].weight).toBe(10) // logout

        const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
        expect(totalWeight).toBe(100)
      })

      it('should calculate ramp-up time based on user count', () => {
        const smallConfig: AuthScenarioConfig = {
          userCount: 5,
          loginWeight: 100,
          validateWeight: 0,
          refreshWeight: 0,
          logoutWeight: 0
        }

        const largeConfig: AuthScenarioConfig = {
          userCount: 200,
          loginWeight: 100,
          validateWeight: 0,
          refreshWeight: 0,
          logoutWeight: 0
        }

        const smallScenario = builder.getAuthenticationScenario(smallConfig)
        const largeScenario = builder.getAuthenticationScenario(largeConfig)

        expect(smallScenario.rampUpTime).toBe(1) // Minimum 1 second
        expect(largeScenario.rampUpTime).toBe(20) // 200/10 = 20 seconds
      })
    })

    describe('getDatabaseScenario', () => {
      it('should create database scenario correctly', () => {
        const config: DatabaseScenarioConfig = {
          userCount: 100,
          readWeight: 50,
          writeWeight: 25,
          updateWeight: 20,
          aggregateWeight: 5,
          collections: ['users', 'orders']
        }

        const scenario = builder.getDatabaseScenario(config)

        expect(scenario.name).toBe('Database Load Test')
        expect(scenario.virtualUsers).toBe(100)
        expect(scenario.testDuration).toBe(120) // 2 minutes
        expect(scenario.operations).toHaveLength(4)
        expect(scenario.operations[0].weight).toBe(50) // read
        expect(scenario.operations[1].weight).toBe(25) // write
        expect(scenario.operations[2].weight).toBe(20) // update
        expect(scenario.operations[3].weight).toBe(5)  // aggregate

        // Should use first collection
        expect(scenario.operations[0].config.collection).toBe('users')
      })

      it('should handle empty collections array', () => {
        const config: DatabaseScenarioConfig = {
          userCount: 50,
          readWeight: 100,
          writeWeight: 0,
          updateWeight: 0,
          aggregateWeight: 0,
          collections: []
        }

        const scenario = builder.getDatabaseScenario(config)

        // Should use default collection
        expect(scenario.operations[0].config.collection).toBe('test_collection')
      })
    })

    describe('getRealtimeScenario', () => {
      it('should create realtime scenario correctly', () => {
        const config: RealtimeScenarioConfig = {
          userCount: 75,
          sseWeight: 50,
          crossTabWeight: 30,
          notificationWeight: 20,
          subscriptionTypes: ['notifications', 'updates']
        }

        const scenario = builder.getRealtimeScenario(config)

        expect(scenario.name).toBe('Real-time Features Load Test')
        expect(scenario.virtualUsers).toBe(75)
        expect(scenario.testDuration).toBe(180) // 3 minutes
        expect(scenario.operations).toHaveLength(3)
        expect(scenario.operations[0].weight).toBe(50) // sse
        expect(scenario.operations[1].weight).toBe(30) // cross-tab
        expect(scenario.operations[2].weight).toBe(20) // notification

        // Should use first subscription type
        expect(scenario.operations[0].config.channel).toBe('notifications')
      })

      it('should handle empty subscription types', () => {
        const config: RealtimeScenarioConfig = {
          userCount: 25,
          sseWeight: 100,
          crossTabWeight: 0,
          notificationWeight: 0,
          subscriptionTypes: []
        }

        const scenario = builder.getRealtimeScenario(config)

        // Should use default channel
        expect(scenario.operations[0].config.channel).toBe('notifications')
      })
    })
  })

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  describe('Template Management', () => {
    describe('getAvailableTemplates', () => {
      it('should return built-in templates', () => {
        const templates = builder.getAvailableTemplates()

        expect(templates.length).toBeGreaterThanOrEqual(3)

        const templateNames = templates.map(t => t.name)
        expect(templateNames).toContain('authentication')
        expect(templateNames).toContain('database_crud')
        expect(templateNames).toContain('stress_test')
      })

      it('should return template with correct structure', () => {
        const templates = builder.getAvailableTemplates()
        const authTemplate = templates.find(t => t.name === 'authentication')

        expect(authTemplate).toBeDefined()
        expect(authTemplate!.description).toBeDefined()
        expect(authTemplate!.category).toBe('authentication')
        expect(authTemplate!.operations).toBeInstanceOf(Array)
        expect(authTemplate!.defaultUsers).toBeGreaterThan(0)
        expect(authTemplate!.defaultDuration).toBeGreaterThan(0)
        expect(authTemplate!.successCriteria).toBeDefined()
      })
    })

    describe('getTemplate', () => {
      it('should return specific template', () => {
        const template = builder.getTemplate('authentication')

        expect(template).toBeDefined()
        expect(template!.name).toBe('authentication')
        expect(template!.category).toBe('authentication')
      })

      it('should return undefined for non-existent template', () => {
        const template = builder.getTemplate('non-existent')

        expect(template).toBeUndefined()
      })
    })

    describe('addCustomTemplate', () => {
      it('should add custom template', () => {
        const customTemplate: ScenarioTemplate = {
          name: 'custom_test',
          description: 'Custom test template',
          category: 'custom',
          operations: [
            {
              type: 'auth',
              weight: 100,
              config: { operation: 'custom_auth' },
              expectedResponseTime: 100
            }
          ],
          defaultUsers: 25,
          defaultDuration: 90,
          defaultRampUp: 15,
          successCriteria: {
            maxResponseTime: 200,
            minThroughput: 50,
            maxErrorRate: 1,
            maxMemoryUsage: 1024 * 1024 * 256,
            maxCpuUsage: 60
          }
        }

        builder.addCustomTemplate(customTemplate)

        const retrieved = builder.getTemplate('custom_test')
        expect(retrieved).toEqual(customTemplate)

        const allTemplates = builder.getAvailableTemplates()
        expect(allTemplates.some(t => t.name === 'custom_test')).toBe(true)
      })
    })
  })

  // ============================================================================
  // SCENARIO VALIDATION
  // ============================================================================

  describe('Scenario Validation', () => {
    describe('validateScenario', () => {
      it('should validate correct scenario', () => {
        const validScenario = createValidTestScenario()

        const result = builder.validateScenario(validScenario)

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should detect missing required fields', () => {
        const invalidScenario = createValidTestScenario()
        invalidScenario.id = ''
        invalidScenario.name = ''

        const result = builder.validateScenario(invalidScenario)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Scenario must have id and name')
      })

      it('should detect invalid virtual users', () => {
        const invalidScenario = createValidTestScenario()
        invalidScenario.virtualUsers = 0

        const result = builder.validateScenario(invalidScenario)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Virtual users must be greater than 0')
      })

      it('should detect invalid test duration', () => {
        const invalidScenario = createValidTestScenario()
        invalidScenario.testDuration = -1

        const result = builder.validateScenario(invalidScenario)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Test duration must be greater than 0')
      })

      it('should detect missing operations', () => {
        const invalidScenario = createValidTestScenario()
        invalidScenario.operations = []

        const result = builder.validateScenario(invalidScenario)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Scenario must have at least one operation')
      })

      it('should detect incorrect operation weights', () => {
        const invalidScenario = createValidTestScenario()
        invalidScenario.operations = [
          {
            type: 'auth',
            weight: 60,
            config: { operation: 'login' },
            expectedResponseTime: 100
          },
          {
            type: 'query',
            weight: 30,
            config: { operation: 'find' },
            expectedResponseTime: 50
          }
          // Total: 90, should fail
        ]

        const result = builder.validateScenario(invalidScenario)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Operation weights must sum to 100, got 90')
      })

      it('should generate warnings for high resource usage', () => {
        const highResourceScenario = createValidTestScenario()
        highResourceScenario.virtualUsers = 1500 // High user count
        highResourceScenario.testDuration = 7200 // 2 hours
        highResourceScenario.rampUpTime = 1 // Very fast ramp-up

        const result = builder.validateScenario(highResourceScenario)

        expect(result.warnings).toContain('High user count may require significant system resources')
        expect(result.warnings).toContain('Long test duration may consume significant resources')
        expect(result.warnings).toContain('Very fast ramp-up may cause system overload')
      })

      it('should generate warnings for strict success criteria', () => {
        const strictScenario = createValidTestScenario()
        strictScenario.successCriteria.maxResponseTime = 5 // Very low
        strictScenario.successCriteria.maxErrorRate = 0.05 // Very strict

        const result = builder.validateScenario(strictScenario)

        expect(result.warnings).toContain('Very low response time threshold may cause frequent failures')
        expect(result.warnings).toContain('Very low error rate threshold may be unrealistic')
      })

      it('should generate optimization suggestions', () => {
        const suboptimalScenario = createValidTestScenario()
        suboptimalScenario.operations = [
          {
            type: 'auth',
            weight: 100,
            config: { operation: 'slow_operation' },
            expectedResponseTime: 2000 // Very slow
          }
        ]
        suboptimalScenario.virtualUsers = 600
        suboptimalScenario.rampUpTime = 10 // Short for high user count
        suboptimalScenario.successCriteria.minThroughput = 7000 // Very high

        const result = builder.validateScenario(suboptimalScenario)

        expect(result.suggestions).toContain('Consider optimizing operations with high expected response times')
        expect(result.suggestions).toContain('Consider longer ramp-up time for high user counts')
        expect(result.suggestions).toContain('Throughput target may be too aggressive for user count')
      })
    })
  })

  // ============================================================================
  // OPTIMIZATION SUGGESTIONS
  // ============================================================================

  describe('Optimization Suggestions', () => {
    describe('getOptimizationSuggestions', () => {
      it('should suggest performance optimizations', () => {
        const scenario = createValidTestScenario()
        scenario.operations = [
          {
            type: 'auth',
            weight: 80, // Dominates scenario
            config: { operation: 'login' },
            expectedResponseTime: 100
          },
          {
            type: 'query',
            weight: 20,
            config: { operation: 'find' },
            expectedResponseTime: 50
          }
        ]
        scenario.rampUpTime = 5 // Short compared to 120s duration

        const optimizations = builder.getOptimizationSuggestions(scenario)

        const performanceOpts = optimizations.filter(opt => opt.type === 'performance')
        expect(performanceOpts.length).toBeGreaterThan(0)
        expect(performanceOpts.some(opt => opt.description.includes('Single operation dominates'))).toBe(true)
        expect(performanceOpts.some(opt => opt.description.includes('Ramp-up time is very short'))).toBe(true)
      })

      it('should suggest reliability optimizations', () => {
        const scenario = createValidTestScenario()
        scenario.successCriteria.maxErrorRate = 0.1 // Very strict

        const optimizations = builder.getOptimizationSuggestions(scenario)

        const reliabilityOpts = optimizations.filter(opt => opt.type === 'reliability')
        expect(reliabilityOpts.length).toBeGreaterThan(0)
        expect(reliabilityOpts.some(opt => opt.description.includes('Very strict error rate'))).toBe(true)
      })

      it('should suggest resource usage optimizations', () => {
        const scenario = createValidTestScenario()
        scenario.virtualUsers = 1200 // High user count
        scenario.testDuration = 2400 // 40 minutes

        const optimizations = builder.getOptimizationSuggestions(scenario)

        const resourceOpts = optimizations.filter(opt => opt.type === 'resource_usage')
        expect(resourceOpts.length).toBeGreaterThan(0)
        expect(resourceOpts.some(opt => opt.description.includes('High virtual user count'))).toBe(true)
        expect(resourceOpts.some(opt => opt.description.includes('Long test duration'))).toBe(true)
      })

      it('should include impact levels and recommendations', () => {
        const scenario = createValidTestScenario()
        scenario.virtualUsers = 1500

        const optimizations = builder.getOptimizationSuggestions(scenario)

        optimizations.forEach(opt => {
          expect(opt.type).toMatch(/^(performance|reliability|resource_usage)$/)
          expect(opt.impact).toMatch(/^(low|medium|high)$/)
          expect(opt.description).toBeDefined()
          expect(opt.recommendation).toBeDefined()
          expect(opt.recommendation.length).toBeGreaterThan(10) // Should have meaningful recommendation
        })
      })
    })
  })

  // ============================================================================
  // IMPORT/EXPORT FUNCTIONALITY
  // ============================================================================

  describe('Import/Export Functionality', () => {
    describe('exportScenario', () => {
      it('should export scenario in JSON format', () => {
        const scenario = createValidTestScenario()

        const exported = builder.exportScenario(scenario, 'json')

        expect(typeof exported).toBe('string')
        expect(() => JSON.parse(exported)).not.toThrow()

        const parsed = JSON.parse(exported)
        expect(parsed.id).toBe(scenario.id)
        expect(parsed.name).toBe(scenario.name)
        expect(parsed.operations).toEqual(scenario.operations)
      })

      it('should export scenario in YAML format', () => {
        const scenario = createValidTestScenario()

        const exported = builder.exportScenario(scenario, 'yaml')

        expect(typeof exported).toBe('string')
        expect(exported).toContain(`id: ${scenario.id}`)
        expect(exported).toContain(`name: ${scenario.name}`)
        expect(exported).toContain(`virtualUsers: ${scenario.virtualUsers}`)
        expect(exported).toContain('operations:')
        expect(exported).toContain('successCriteria:')
      })

      it('should default to JSON format', () => {
        const scenario = createValidTestScenario()

        const exported = builder.exportScenario(scenario)

        expect(() => JSON.parse(exported)).not.toThrow()
      })
    })

    describe('importScenario', () => {
      it('should import scenario from JSON', () => {
        const originalScenario = createValidTestScenario()
        const exported = builder.exportScenario(originalScenario, 'json')

        const imported = builder.importScenario(exported, 'json')

        expect(imported).toEqual(originalScenario)
      })

      it('should handle invalid JSON gracefully', () => {
        expect(() => {
          builder.importScenario('invalid json', 'json')
        }).toThrow()
      })

      it('should throw error for YAML import (not implemented)', () => {
        expect(() => {
          builder.importScenario('yaml: content', 'yaml')
        }).toThrow('YAML import not implemented yet')
      })
    })
  })

  // ============================================================================
  // PERFORMANCE VALIDATION
  // ============================================================================

  describe('Performance Validation', () => {
    it('should validate scenarios efficiently', () => {
      const scenario = createValidTestScenario()
      const startTime = performance.now()

      // Validate multiple times
      for (let i = 0; i < 100; i++) {
        builder.validateScenario(scenario)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (less than 100ms for 100 validations)
      expect(totalTime).toBeLessThan(100)
    })

    it('should generate optimizations efficiently', () => {
      const scenario = createValidTestScenario()
      const startTime = performance.now()

      // Generate optimizations multiple times
      for (let i = 0; i < 50; i++) {
        builder.getOptimizationSuggestions(scenario)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (less than 50ms for 50 generations)
      expect(totalTime).toBeLessThan(50)
    })
  })
})

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

function createValidTestScenario(): LoadTestScenario {
  return {
    id: 'test-scenario-123',
    name: 'Test Scenario',
    description: 'A test scenario for validation',
    virtualUsers: 50,
    rampUpTime: 10,
    testDuration: 120,
    operations: [
      {
        type: 'auth',
        weight: 60,
        config: { operation: 'login' },
        expectedResponseTime: 200
      },
      {
        type: 'query',
        weight: 40,
        config: { operation: 'find' },
        expectedResponseTime: 100
      }
    ],
    successCriteria: {
      maxResponseTime: 500,
      minThroughput: 100,
      maxErrorRate: 2,
      maxMemoryUsage: 1024 * 1024 * 500, // 500MB
      maxCpuUsage: 70
    }
  }
}

function createTestSuccessCriteria(overrides: Partial<SuccessCriteria> = {}): SuccessCriteria {
  return {
    maxResponseTime: 1000,
    minThroughput: 50,
    maxErrorRate: 5,
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    maxCpuUsage: 80,
    ...overrides
  }
}