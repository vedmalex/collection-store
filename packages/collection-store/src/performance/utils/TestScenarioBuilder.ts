/**
 * TestScenarioBuilder - Fluent API for Building Performance Test Scenarios
 * Phase 6: Performance Testing & Optimization
 *
 * Provides a fluent interface for creating complex test scenarios with
 * pre-built templates, validation, and optimization suggestions.
 */

import {
  LoadTestScenario,
  TestOperation,
  SuccessCriteria,
  ITestScenarioBuilder,
  TestScenarioBuilder as ITestScenarioBuilderInterface,
  AuthScenarioConfig,
  DatabaseScenarioConfig,
  RealtimeScenarioConfig
} from '../testing/interfaces'

export interface ScenarioTemplate {
  name: string
  description: string
  category: 'authentication' | 'database' | 'realtime' | 'stress' | 'endurance' | 'custom'
  operations: TestOperation[]
  defaultUsers: number
  defaultDuration: number
  defaultRampUp: number
  successCriteria: SuccessCriteria
}

export interface ScenarioValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

export interface ScenarioOptimization {
  type: 'performance' | 'reliability' | 'resource_usage'
  description: string
  impact: 'low' | 'medium' | 'high'
  recommendation: string
}

export class TestScenarioBuilder implements ITestScenarioBuilder {
  private templates = new Map<string, ScenarioTemplate>()

  constructor() {
    this.initializeBuiltInTemplates()
  }

  // ============================================================================
  // FLUENT API ENTRY POINTS
  // ============================================================================

  createScenario(name: string): TestScenarioBuilderInstance {
    return new TestScenarioBuilderInstance(name)
  }

  // ============================================================================
  // PRE-BUILT SCENARIO TEMPLATES
  // ============================================================================

  getAuthenticationScenario(config: AuthScenarioConfig): LoadTestScenario {
    const operations: TestOperation[] = [
      {
        type: 'auth',
        weight: config.loginWeight,
        config: { operation: 'login', credentials: 'test_user' },
        expectedResponseTime: 200
      },
      {
        type: 'auth',
        weight: config.validateWeight,
        config: { operation: 'validate_token' },
        expectedResponseTime: 50
      },
      {
        type: 'auth',
        weight: config.refreshWeight,
        config: { operation: 'refresh_token' },
        expectedResponseTime: 100
      },
      {
        type: 'auth',
        weight: config.logoutWeight,
        config: { operation: 'logout' },
        expectedResponseTime: 50
      }
    ]

    return {
      id: `auth-scenario-${Date.now()}`,
      name: 'Authentication Load Test',
      description: 'Tests authentication system under load',
      virtualUsers: config.userCount,
      rampUpTime: Math.max(1, config.userCount / 10), // 10 users per second ramp-up
      testDuration: 60, // 1 minute default
      operations,
      successCriteria: {
        maxResponseTime: 500,
        minThroughput: config.userCount * 0.8, // 80% of users should complete ops
        maxErrorRate: 2, // 2% error rate
        maxMemoryUsage: 1024 * 1024 * 500, // 500MB
        maxCpuUsage: 70 // 70%
      }
    }
  }

  getDatabaseScenario(config: DatabaseScenarioConfig): LoadTestScenario {
    const operations: TestOperation[] = [
      {
        type: 'query',
        weight: config.readWeight,
        config: {
          operation: 'find',
          collection: config.collections[0] || 'test_collection',
          query: { status: 'active' }
        },
        expectedResponseTime: 50
      },
      {
        type: 'query',
        weight: config.writeWeight,
        config: {
          operation: 'insert',
          collection: config.collections[0] || 'test_collection',
          document: { name: 'test', status: 'active' }
        },
        expectedResponseTime: 100
      },
      {
        type: 'query',
        weight: config.updateWeight,
        config: {
          operation: 'update',
          collection: config.collections[0] || 'test_collection',
          query: { status: 'active' },
          update: { $set: { lastModified: new Date() } }
        },
        expectedResponseTime: 80
      },
      {
        type: 'query',
        weight: config.aggregateWeight,
        config: {
          operation: 'aggregate',
          collection: config.collections[0] || 'test_collection',
          pipeline: [{ $group: { _id: '$status', count: { $sum: 1 } } }]
        },
        expectedResponseTime: 200
      }
    ]

    return {
      id: `db-scenario-${Date.now()}`,
      name: 'Database Load Test',
      description: 'Tests database operations under load',
      virtualUsers: config.userCount,
      rampUpTime: Math.max(2, config.userCount / 20), // 20 users per second ramp-up
      testDuration: 120, // 2 minutes default
      operations,
      successCriteria: {
        maxResponseTime: 300,
        minThroughput: config.userCount * 2, // 2 ops per user per second
        maxErrorRate: 1, // 1% error rate
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxCpuUsage: 80 // 80%
      }
    }
  }

  getRealtimeScenario(config: RealtimeScenarioConfig): LoadTestScenario {
    const operations: TestOperation[] = [
      {
        type: 'subscription',
        weight: config.sseWeight,
        config: {
          operation: 'sse_connect',
          channel: config.subscriptionTypes[0] || 'notifications'
        },
        expectedResponseTime: 100
      },
      {
        type: 'real_time',
        weight: config.crossTabWeight,
        config: {
          operation: 'cross_tab_sync',
          data: { type: 'user_action', payload: {} }
        },
        expectedResponseTime: 50
      },
      {
        type: 'real_time',
        weight: config.notificationWeight,
        config: {
          operation: 'push_notification',
          target: 'user_group',
          message: 'Test notification'
        },
        expectedResponseTime: 75
      }
    ]

    return {
      id: `realtime-scenario-${Date.now()}`,
      name: 'Real-time Features Load Test',
      description: 'Tests real-time features under load',
      virtualUsers: config.userCount,
      rampUpTime: Math.max(3, config.userCount / 15), // 15 users per second ramp-up
      testDuration: 180, // 3 minutes default
      operations,
      successCriteria: {
        maxResponseTime: 150,
        minThroughput: config.userCount * 1.5, // 1.5 ops per user per second
        maxErrorRate: 0.5, // 0.5% error rate
        maxMemoryUsage: 1024 * 1024 * 800, // 800MB
        maxCpuUsage: 75 // 75%
      }
    }
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  getAvailableTemplates(): ScenarioTemplate[] {
    return Array.from(this.templates.values())
  }

  getTemplate(name: string): ScenarioTemplate | undefined {
    return this.templates.get(name)
  }

  addCustomTemplate(template: ScenarioTemplate): void {
    this.templates.set(template.name, template)
  }

  // ============================================================================
  // SCENARIO VALIDATION & OPTIMIZATION
  // ============================================================================

  validateScenario(scenario: LoadTestScenario): ScenarioValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Basic validation
    if (!scenario.id || !scenario.name) {
      errors.push('Scenario must have id and name')
    }

    if (scenario.virtualUsers <= 0) {
      errors.push('Virtual users must be greater than 0')
    }

    if (scenario.testDuration <= 0) {
      errors.push('Test duration must be greater than 0')
    }

    if (!scenario.operations || scenario.operations.length === 0) {
      errors.push('Scenario must have at least one operation')
    }

    // Operation weights validation
    if (scenario.operations) {
      const totalWeight = scenario.operations.reduce((sum, op) => sum + op.weight, 0)
      if (Math.abs(totalWeight - 100) > 0.01) {
        errors.push(`Operation weights must sum to 100, got ${totalWeight}`)
      }
    }

    // Performance warnings
    if (scenario.virtualUsers > 1000) {
      warnings.push('High user count may require significant system resources')
    }

    if (scenario.testDuration > 3600) {
      warnings.push('Long test duration may consume significant resources')
    }

    if (scenario.rampUpTime < scenario.virtualUsers / 100) {
      warnings.push('Very fast ramp-up may cause system overload')
    }

    // Success criteria validation
    const criteria = scenario.successCriteria
    if (criteria.maxResponseTime < 10) {
      warnings.push('Very low response time threshold may cause frequent failures')
    }

    if (criteria.maxErrorRate < 0.1) {
      warnings.push('Very low error rate threshold may be unrealistic')
    }

    // Optimization suggestions
    if (scenario.operations.some(op => op.expectedResponseTime > 1000)) {
      suggestions.push('Consider optimizing operations with high expected response times')
    }

    if (scenario.virtualUsers > 500 && scenario.rampUpTime < 30) {
      suggestions.push('Consider longer ramp-up time for high user counts')
    }

    if (criteria.minThroughput > scenario.virtualUsers * 10) {
      suggestions.push('Throughput target may be too aggressive for user count')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  getOptimizationSuggestions(scenario: LoadTestScenario): ScenarioOptimization[] {
    const optimizations: ScenarioOptimization[] = []

    // Performance optimizations
    if (scenario.operations.some(op => op.weight > 70)) {
      optimizations.push({
        type: 'performance',
        description: 'Single operation dominates test scenario',
        impact: 'medium',
        recommendation: 'Consider more balanced operation distribution for realistic load patterns'
      })
    }

    if (scenario.rampUpTime < scenario.testDuration * 0.1) {
      optimizations.push({
        type: 'performance',
        description: 'Ramp-up time is very short compared to test duration',
        impact: 'high',
        recommendation: 'Increase ramp-up time to 10-20% of test duration for gradual load increase'
      })
    }

    // Reliability optimizations
    if (scenario.successCriteria.maxErrorRate < 0.5) {
      optimizations.push({
        type: 'reliability',
        description: 'Very strict error rate threshold',
        impact: 'medium',
        recommendation: 'Consider allowing 0.5-2% error rate for more realistic testing'
      })
    }

    // Resource usage optimizations
    if (scenario.virtualUsers > 1000) {
      optimizations.push({
        type: 'resource_usage',
        description: 'High virtual user count',
        impact: 'high',
        recommendation: 'Monitor system resources closely and consider distributed testing for very high loads'
      })
    }

    if (scenario.testDuration > 1800) { // 30 minutes
      optimizations.push({
        type: 'resource_usage',
        description: 'Long test duration',
        impact: 'medium',
        recommendation: 'Consider shorter focused tests or ensure adequate resource monitoring'
      })
    }

    return optimizations
  }

  // ============================================================================
  // IMPORT/EXPORT FUNCTIONALITY
  // ============================================================================

  exportScenario(scenario: LoadTestScenario, format: 'json' | 'yaml' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(scenario, null, 2)
    } else {
      // Simple YAML-like format
      return this.convertToYaml(scenario)
    }
  }

  importScenario(data: string, format: 'json' | 'yaml' = 'json'): LoadTestScenario {
    if (format === 'json') {
      return JSON.parse(data)
    } else {
      throw new Error('YAML import not implemented yet')
    }
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION
  // ============================================================================

  private initializeBuiltInTemplates(): void {
    // Authentication template
    this.templates.set('authentication', {
      name: 'authentication',
      description: 'Standard authentication flow testing',
      category: 'authentication',
      operations: [
        {
          type: 'auth',
          weight: 40,
          config: { operation: 'login' },
          expectedResponseTime: 200
        },
        {
          type: 'auth',
          weight: 30,
          config: { operation: 'validate_token' },
          expectedResponseTime: 50
        },
        {
          type: 'auth',
          weight: 20,
          config: { operation: 'refresh_token' },
          expectedResponseTime: 100
        },
        {
          type: 'auth',
          weight: 10,
          config: { operation: 'logout' },
          expectedResponseTime: 50
        }
      ],
      defaultUsers: 50,
      defaultDuration: 60,
      defaultRampUp: 10,
      successCriteria: {
        maxResponseTime: 500,
        minThroughput: 40,
        maxErrorRate: 2,
        maxMemoryUsage: 1024 * 1024 * 500,
        maxCpuUsage: 70
      }
    })

    // Database CRUD template
    this.templates.set('database_crud', {
      name: 'database_crud',
      description: 'Database CRUD operations testing',
      category: 'database',
      operations: [
        {
          type: 'query',
          weight: 50,
          config: { operation: 'find' },
          expectedResponseTime: 50
        },
        {
          type: 'query',
          weight: 25,
          config: { operation: 'insert' },
          expectedResponseTime: 100
        },
        {
          type: 'query',
          weight: 20,
          config: { operation: 'update' },
          expectedResponseTime: 80
        },
        {
          type: 'query',
          weight: 5,
          config: { operation: 'delete' },
          expectedResponseTime: 60
        }
      ],
      defaultUsers: 100,
      defaultDuration: 120,
      defaultRampUp: 20,
      successCriteria: {
        maxResponseTime: 300,
        minThroughput: 200,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 1024,
        maxCpuUsage: 80
      }
    })

    // Stress testing template
    this.templates.set('stress_test', {
      name: 'stress_test',
      description: 'High-load stress testing',
      category: 'stress',
      operations: [
        {
          type: 'query',
          weight: 60,
          config: { operation: 'heavy_query' },
          expectedResponseTime: 200
        },
        {
          type: 'query',
          weight: 40,
          config: { operation: 'concurrent_writes' },
          expectedResponseTime: 300
        }
      ],
      defaultUsers: 500,
      defaultDuration: 300,
      defaultRampUp: 60,
      successCriteria: {
        maxResponseTime: 1000,
        minThroughput: 1000,
        maxErrorRate: 5,
        maxMemoryUsage: 1024 * 1024 * 2048, // 2GB
        maxCpuUsage: 90
      }
    })
  }

  private convertToYaml(scenario: LoadTestScenario): string {
    // Simple YAML-like conversion
    return `
id: ${scenario.id}
name: ${scenario.name}
description: ${scenario.description}
virtualUsers: ${scenario.virtualUsers}
rampUpTime: ${scenario.rampUpTime}
testDuration: ${scenario.testDuration}
operations:
${scenario.operations.map(op => `  - type: ${op.type}
    weight: ${op.weight}
    expectedResponseTime: ${op.expectedResponseTime}
    config: ${JSON.stringify(op.config)}`).join('\n')}
successCriteria:
  maxResponseTime: ${scenario.successCriteria.maxResponseTime}
  minThroughput: ${scenario.successCriteria.minThroughput}
  maxErrorRate: ${scenario.successCriteria.maxErrorRate}
  maxMemoryUsage: ${scenario.successCriteria.maxMemoryUsage}
  maxCpuUsage: ${scenario.successCriteria.maxCpuUsage}
`.trim()
  }
}

// ============================================================================
// FLUENT BUILDER IMPLEMENTATION
// ============================================================================

export class TestScenarioBuilderInstance implements ITestScenarioBuilderInterface {
  private scenario: Partial<LoadTestScenario> = {}

  constructor(name: string) {
    this.scenario = {
      id: `scenario-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      description: '',
      virtualUsers: 10,
      rampUpTime: 5,
      testDuration: 60,
      operations: [],
      successCriteria: {
        maxResponseTime: 1000,
        minThroughput: 10,
        maxErrorRate: 5,
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxCpuUsage: 80
      }
    }
  }

  setUsers(count: number): TestScenarioBuilderInstance {
    this.scenario.virtualUsers = count
    return this
  }

  setDuration(seconds: number): TestScenarioBuilderInstance {
    this.scenario.testDuration = seconds
    return this
  }

  setRampUp(seconds: number): TestScenarioBuilderInstance {
    this.scenario.rampUpTime = seconds
    return this
  }

  setDescription(description: string): TestScenarioBuilderInstance {
    this.scenario.description = description
    return this
  }

  addOperation(operation: TestOperation): TestScenarioBuilderInstance {
    if (!this.scenario.operations) {
      this.scenario.operations = []
    }
    this.scenario.operations.push(operation)
    return this
  }

  addAuthOperation(weight: number, config: any = {}, expectedResponseTime: number = 200): TestScenarioBuilderInstance {
    return this.addOperation({
      type: 'auth',
      weight,
      config: { operation: 'authenticate', ...config },
      expectedResponseTime
    })
  }

  addQueryOperation(weight: number, config: any = {}, expectedResponseTime: number = 100): TestScenarioBuilderInstance {
    return this.addOperation({
      type: 'query',
      weight,
      config: { operation: 'query', ...config },
      expectedResponseTime
    })
  }

  addRealtimeOperation(weight: number, config: any = {}, expectedResponseTime: number = 50): TestScenarioBuilderInstance {
    return this.addOperation({
      type: 'real_time',
      weight,
      config: { operation: 'realtime', ...config },
      expectedResponseTime
    })
  }

  setSuccessCriteria(criteria: SuccessCriteria): TestScenarioBuilderInstance {
    this.scenario.successCriteria = criteria
    return this
  }

  build(): LoadTestScenario {
    // Validate required fields
    if (!this.scenario.id || !this.scenario.name || !this.scenario.operations || !this.scenario.successCriteria) {
      throw new Error('Scenario is missing required fields')
    }

    // Validate operation weights
    const totalWeight = this.scenario.operations.reduce((sum, op) => sum + op.weight, 0)
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Operation weights must sum to 100, got ${totalWeight}`)
    }

    return this.scenario as LoadTestScenario
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ScenarioBuilderError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'ScenarioBuilderError'
  }
}