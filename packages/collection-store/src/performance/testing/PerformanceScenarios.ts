/**
 * Performance Scenarios for Collection Store
 * Phase 6: Performance Testing & Optimization
 *
 * Provides specific test scenarios for Collection Store operations:
 * - Authentication scenarios
 * - Database CRUD scenarios
 * - Real-time subscription scenarios
 * - File storage scenarios
 * - Computed attributes scenarios
 * - Stored functions scenarios
 */

import { LoadTestScenario, TestOperation, SuccessCriteria } from './interfaces'
import { TestScenarioBuilder } from '../utils/TestScenarioBuilder'

export interface ScenarioConfig {
  userCount?: number
  duration?: number
  rampUpTime?: number
  successCriteria?: Partial<SuccessCriteria>
}

export interface AuthenticationScenarioConfig extends ScenarioConfig {
  loginRatio?: number
  validateRatio?: number
  refreshRatio?: number
  logoutRatio?: number
  sessionDuration?: number
}

export interface DatabaseScenarioConfig extends ScenarioConfig {
  collections?: string[]
  readRatio?: number
  writeRatio?: number
  updateRatio?: number
  deleteRatio?: number
  aggregateRatio?: number
  recordSize?: 'small' | 'medium' | 'large'
  indexedQueries?: boolean
}

export interface RealtimeScenarioConfig extends ScenarioConfig {
  channels?: string[]
  subscriptionRatio?: number
  publishRatio?: number
  unsubscribeRatio?: number
  messageSize?: 'small' | 'medium' | 'large'
  concurrentConnections?: number
}

export interface FileStorageScenarioConfig extends ScenarioConfig {
  uploadRatio?: number
  downloadRatio?: number
  deleteRatio?: number
  listRatio?: number
  fileSizes?: ('small' | 'medium' | 'large')[]
  compressionEnabled?: boolean
  thumbnailGeneration?: boolean
}

export interface ComputedAttributesScenarioConfig extends ScenarioConfig {
  simpleComputations?: number
  complexComputations?: number
  dependentComputations?: number
  cacheHitRatio?: number
}

export interface StoredFunctionsScenarioConfig extends ScenarioConfig {
  simpleFunctions?: number
  complexFunctions?: number
  dataProcessingFunctions?: number
  aggregationFunctions?: number
}

/**
 * Performance Scenarios for Collection Store Operations
 */
export class PerformanceScenarios {
  private builder: TestScenarioBuilder

  constructor() {
    this.builder = new TestScenarioBuilder()
  }

  // ============================================================================
  // AUTHENTICATION SCENARIOS
  // ============================================================================

  /**
   * Creates authentication performance test scenario
   */
  createAuthenticationScenario(config: AuthenticationScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 100,
      duration = 300, // 5 minutes
      rampUpTime = 30,
      loginRatio = 40,
      validateRatio = 30,
      refreshRatio = 20,
      logoutRatio = 10,
      sessionDuration = 1800, // 30 minutes
      successCriteria = {}
    } = config

    return this.builder.createScenario('Authentication Performance Test')
      .setDescription('Tests authentication system performance under load')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addAuthOperation(loginRatio, {
        operation: 'login',
        credentials: { username: 'test_user', password: 'test_password' },
        sessionDuration
      }, 200)
      .addAuthOperation(validateRatio, {
        operation: 'validate',
        token: 'session_token'
      }, 50)
      .addAuthOperation(refreshRatio, {
        operation: 'refresh',
        refreshToken: 'refresh_token'
      }, 100)
      .addAuthOperation(logoutRatio, {
        operation: 'logout',
        token: 'session_token'
      }, 75)
      .setSuccessCriteria({
        maxResponseTime: 500,
        minThroughput: userCount * 2,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 512, // 512MB
        maxCpuUsage: 60,
        ...successCriteria
      })
      .build()
  }

  /**
   * Creates high-load authentication scenario
   */
  createAuthenticationStressScenario(config: AuthenticationScenarioConfig = {}): LoadTestScenario {
    return this.createAuthenticationScenario({
      userCount: 1000,
      duration: 600, // 10 minutes
      rampUpTime: 60,
      successCriteria: {
        maxResponseTime: 1000,
        minThroughput: 1500,
        maxErrorRate: 2,
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxCpuUsage: 80
      },
      ...config
    })
  }

  // ============================================================================
  // DATABASE SCENARIOS
  // ============================================================================

  /**
   * Creates database CRUD performance test scenario
   */
  createDatabaseScenario(config: DatabaseScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 200,
      duration = 300,
      rampUpTime = 30,
      collections = ['users', 'orders', 'products'],
      readRatio = 60,
      writeRatio = 20,
      updateRatio = 15,
      deleteRatio = 3,
      aggregateRatio = 2,
      recordSize = 'medium',
      indexedQueries = true,
      successCriteria = {}
    } = config

    const collection = collections[0] || 'test_collection'
    const recordData = this.generateRecordData(recordSize)

    return this.builder.createScenario('Database CRUD Performance Test')
      .setDescription('Tests database operations performance under load')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addQueryOperation(readRatio, {
        operation: 'find',
        collection,
        query: indexedQueries ? { id: { $gte: 1 } } : { name: { $regex: 'test' } },
        limit: 100
      }, 100)
      .addQueryOperation(writeRatio, {
        operation: 'insert',
        collection,
        data: recordData
      }, 150)
      .addQueryOperation(updateRatio, {
        operation: 'update',
        collection,
        query: { id: { $gte: 1 } },
        data: { $set: { updated_at: new Date() } }
      }, 120)
      .addQueryOperation(deleteRatio, {
        operation: 'delete',
        collection,
        query: { temp: true }
      }, 80)
      .addQueryOperation(aggregateRatio, {
        operation: 'aggregate',
        collection,
        pipeline: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      }, 300)
      .setSuccessCriteria({
        maxResponseTime: 200,
        minThroughput: userCount * 3,
        maxErrorRate: 0.5,
        maxMemoryUsage: 1024 * 1024 * 768, // 768MB
        maxCpuUsage: 70,
        ...successCriteria
      })
      .build()
  }

  /**
   * Creates database stress test scenario
   */
  createDatabaseStressScenario(config: DatabaseScenarioConfig = {}): LoadTestScenario {
    return this.createDatabaseScenario({
      userCount: 500,
      duration: 900, // 15 minutes
      rampUpTime: 60,
      recordSize: 'large',
      indexedQueries: false,
      successCriteria: {
        maxResponseTime: 500,
        minThroughput: 1000,
        maxErrorRate: 2,
        maxMemoryUsage: 1024 * 1024 * 1536, // 1.5GB
        maxCpuUsage: 85
      },
      ...config
    })
  }

  // ============================================================================
  // REAL-TIME SCENARIOS
  // ============================================================================

  /**
   * Creates real-time subscriptions performance test scenario
   */
  createRealtimeScenario(config: RealtimeScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 150,
      duration = 300,
      rampUpTime = 20,
      channels = ['notifications', 'updates', 'alerts'],
      subscriptionRatio = 40,
      publishRatio = 30,
      unsubscribeRatio = 20,
      messageSize = 'medium',
      concurrentConnections = userCount,
      successCriteria = {}
    } = config

    const channel = channels[0] || 'test_channel'
    const messageData = this.generateMessageData(messageSize)

    return this.builder.createScenario('Real-time Performance Test')
      .setDescription('Tests real-time subscriptions and messaging performance')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addRealtimeOperation(subscriptionRatio, {
        operation: 'subscribe',
        channel,
        type: 'sse'
      }, 100)
      .addRealtimeOperation(publishRatio, {
        operation: 'publish',
        channel,
        data: messageData
      }, 75)
      .addRealtimeOperation(unsubscribeRatio, {
        operation: 'unsubscribe',
        channel
      }, 50)
      .addRealtimeOperation(10, {
        operation: 'cross_tab_sync',
        data: { action: 'update', entity: 'user' }
      }, 25)
      .setSuccessCriteria({
        maxResponseTime: 150,
        minThroughput: userCount * 4,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 640, // 640MB
        maxCpuUsage: 65,
        ...successCriteria
      })
      .build()
  }

  /**
   * Creates high-concurrency real-time scenario
   */
  createRealtimeStressScenario(config: RealtimeScenarioConfig = {}): LoadTestScenario {
    return this.createRealtimeScenario({
      userCount: 1000,
      duration: 600,
      rampUpTime: 45,
      concurrentConnections: 1000,
      messageSize: 'large',
      successCriteria: {
        maxResponseTime: 300,
        minThroughput: 3000,
        maxErrorRate: 2,
        maxMemoryUsage: 1024 * 1024 * 1280, // 1.25GB
        maxCpuUsage: 80
      },
      ...config
    })
  }

  // ============================================================================
  // FILE STORAGE SCENARIOS
  // ============================================================================

  /**
   * Creates file storage performance test scenario
   */
  createFileStorageScenario(config: FileStorageScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 100,
      duration = 300,
      rampUpTime = 20,
      uploadRatio = 40,
      downloadRatio = 35,
      deleteRatio = 15,
      listRatio = 10,
      fileSizes = ['small', 'medium'],
      compressionEnabled = true,
      thumbnailGeneration = true,
      successCriteria = {}
    } = config

    return this.builder.createScenario('File Storage Performance Test')
      .setDescription('Tests file storage operations performance')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addQueryOperation(uploadRatio, {
        operation: 'file_upload',
        fileSize: this.getRandomFileSize(fileSizes),
        compression: compressionEnabled,
        generateThumbnail: thumbnailGeneration
      }, 500)
      .addQueryOperation(downloadRatio, {
        operation: 'file_download',
        fileId: 'test_file_id'
      }, 200)
      .addQueryOperation(deleteRatio, {
        operation: 'file_delete',
        fileId: 'test_file_id'
      }, 100)
      .addQueryOperation(listRatio, {
        operation: 'file_list',
        limit: 50
      }, 150)
      .setSuccessCriteria({
        maxResponseTime: 1000,
        minThroughput: userCount,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxCpuUsage: 75,
        ...successCriteria
      })
      .build()
  }

  // ============================================================================
  // COMPUTED ATTRIBUTES SCENARIOS
  // ============================================================================

  /**
   * Creates computed attributes performance test scenario
   */
  createComputedAttributesScenario(config: ComputedAttributesScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 80,
      duration = 300,
      rampUpTime = 15,
      simpleComputations = 50,
      complexComputations = 30,
      dependentComputations = 20,
      cacheHitRatio = 70,
      successCriteria = {}
    } = config

    return this.builder.createScenario('Computed Attributes Performance Test')
      .setDescription('Tests computed attributes calculation performance')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addQueryOperation(simpleComputations, {
        operation: 'compute_attribute',
        type: 'simple',
        expression: 'field1 + field2',
        cacheEnabled: Math.random() < (cacheHitRatio / 100)
      }, 50)
      .addQueryOperation(complexComputations, {
        operation: 'compute_attribute',
        type: 'complex',
        expression: 'SUM(related.values) / COUNT(related.items)',
        cacheEnabled: Math.random() < (cacheHitRatio / 100)
      }, 200)
      .addQueryOperation(dependentComputations, {
        operation: 'compute_attribute',
        type: 'dependent',
        dependencies: ['computed_field1', 'computed_field2'],
        cacheEnabled: Math.random() < (cacheHitRatio / 100)
      }, 300)
      .setSuccessCriteria({
        maxResponseTime: 400,
        minThroughput: userCount * 2,
        maxErrorRate: 0.5,
        maxMemoryUsage: 1024 * 1024 * 512, // 512MB
        maxCpuUsage: 80,
        ...successCriteria
      })
      .build()
  }

  // ============================================================================
  // STORED FUNCTIONS SCENARIOS
  // ============================================================================

  /**
   * Creates stored functions performance test scenario
   */
  createStoredFunctionsScenario(config: StoredFunctionsScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 60,
      duration = 300,
      rampUpTime = 15,
      simpleFunctions = 40,
      complexFunctions = 30,
      dataProcessingFunctions = 20,
      aggregationFunctions = 10,
      successCriteria = {}
    } = config

    return this.builder.createScenario('Stored Functions Performance Test')
      .setDescription('Tests stored functions execution performance')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      .addQueryOperation(simpleFunctions, {
        operation: 'execute_function',
        functionName: 'simple_calculation',
        parameters: { value: 100 }
      }, 100)
      .addQueryOperation(complexFunctions, {
        operation: 'execute_function',
        functionName: 'complex_business_logic',
        parameters: { userId: 'test_user', data: { items: [1, 2, 3] } }
      }, 300)
      .addQueryOperation(dataProcessingFunctions, {
        operation: 'execute_function',
        functionName: 'data_transformation',
        parameters: { dataset: 'large_dataset', format: 'json' }
      }, 500)
      .addQueryOperation(aggregationFunctions, {
        operation: 'execute_function',
        functionName: 'aggregate_reports',
        parameters: { dateRange: '30days', groupBy: 'category' }
      }, 800)
      .setSuccessCriteria({
        maxResponseTime: 1000,
        minThroughput: userCount,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 768, // 768MB
        maxCpuUsage: 85,
        ...successCriteria
      })
      .build()
  }

  // ============================================================================
  // COMPREHENSIVE SCENARIOS
  // ============================================================================

  /**
   * Creates comprehensive mixed workload scenario
   */
  createMixedWorkloadScenario(config: ScenarioConfig = {}): LoadTestScenario {
    const {
      userCount = 300,
      duration = 600, // 10 minutes
      rampUpTime = 60,
      successCriteria = {}
    } = config

    return this.builder.createScenario('Mixed Workload Performance Test')
      .setDescription('Tests mixed workload with all Collection Store features')
      .setUsers(userCount)
      .setDuration(duration)
      .setRampUp(rampUpTime)
      // Authentication (20%)
      .addAuthOperation(10, { operation: 'login' }, 200)
      .addAuthOperation(10, { operation: 'validate' }, 50)
      // Database operations (40%)
      .addQueryOperation(25, { operation: 'find', collection: 'users' }, 100)
      .addQueryOperation(10, { operation: 'insert', collection: 'orders' }, 150)
      .addQueryOperation(5, { operation: 'update', collection: 'products' }, 120)
      // Real-time (20%)
      .addRealtimeOperation(15, { operation: 'subscribe', channel: 'notifications' }, 100)
      .addRealtimeOperation(5, { operation: 'publish', channel: 'updates' }, 75)
      // File operations (10%)
      .addQueryOperation(7, { operation: 'file_download' }, 200)
      .addQueryOperation(3, { operation: 'file_upload' }, 500)
      // Computed attributes (5%)
      .addQueryOperation(3, { operation: 'compute_attribute', type: 'simple' }, 50)
      .addQueryOperation(2, { operation: 'compute_attribute', type: 'complex' }, 200)
      // Stored functions (5%)
      .addQueryOperation(3, { operation: 'execute_function', functionName: 'simple_calculation' }, 100)
      .addQueryOperation(2, { operation: 'execute_function', functionName: 'complex_business_logic' }, 300)
      .setSuccessCriteria({
        maxResponseTime: 500,
        minThroughput: userCount * 2,
        maxErrorRate: 1,
        maxMemoryUsage: 1024 * 1024 * 1536, // 1.5GB
        maxCpuUsage: 75,
        ...successCriteria
      })
      .build()
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generates test record data based on size
   */
  private generateRecordData(size: 'small' | 'medium' | 'large'): any {
    const baseData = {
      id: Math.floor(Math.random() * 1000000),
      name: `Test Record ${Date.now()}`,
      created_at: new Date(),
      active: true
    }

    switch (size) {
      case 'small':
        return baseData

      case 'medium':
        return {
          ...baseData,
          description: 'A'.repeat(500), // 500 chars
          metadata: {
            category: 'test',
            tags: ['tag1', 'tag2', 'tag3'],
            properties: { prop1: 'value1', prop2: 'value2' }
          }
        }

      case 'large':
        return {
          ...baseData,
          description: 'A'.repeat(5000), // 5KB
          content: 'B'.repeat(10000), // 10KB
          metadata: {
            category: 'test',
            tags: Array.from({ length: 50 }, (_, i) => `tag${i}`),
            properties: Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [`prop${i}`, `value${i}`])
            ),
            history: Array.from({ length: 20 }, (_, i) => ({
              timestamp: new Date(Date.now() - i * 86400000),
              action: `action${i}`,
              user: `user${i}`
            }))
          }
        }

      default:
        return baseData
    }
  }

  /**
   * Generates test message data based on size
   */
  private generateMessageData(size: 'small' | 'medium' | 'large'): any {
    const baseMessage = {
      id: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
      type: 'notification'
    }

    switch (size) {
      case 'small':
        return {
          ...baseMessage,
          message: 'Test notification'
        }

      case 'medium':
        return {
          ...baseMessage,
          message: 'Test notification with more content',
          data: {
            userId: 'user123',
            action: 'update',
            details: 'A'.repeat(200)
          }
        }

      case 'large':
        return {
          ...baseMessage,
          message: 'Large test notification with extensive data',
          data: {
            userId: 'user123',
            action: 'bulk_update',
            details: 'A'.repeat(2000),
            payload: Array.from({ length: 50 }, (_, i) => ({
              id: i,
              value: `item${i}`,
              metadata: { prop: `value${i}` }
            }))
          }
        }

      default:
        return baseMessage
    }
  }

  /**
   * Gets random file size from available options
   */
  private getRandomFileSize(sizes: ('small' | 'medium' | 'large')[]): string {
    const sizeMap = {
      small: '1KB',
      medium: '100KB',
      large: '10MB'
    }

    const randomSize = sizes[Math.floor(Math.random() * sizes.length)]
    return sizeMap[randomSize] || sizeMap.medium
  }

  /**
   * Gets all available scenario types
   */
  getAvailableScenarios(): string[] {
    return [
      'authentication',
      'authentication_stress',
      'database',
      'database_stress',
      'realtime',
      'realtime_stress',
      'file_storage',
      'computed_attributes',
      'stored_functions',
      'mixed_workload'
    ]
  }

  /**
   * Creates scenario by name with default configuration
   */
  createScenarioByName(name: string, config: any = {}): LoadTestScenario {
    switch (name) {
      case 'authentication':
        return this.createAuthenticationScenario(config)
      case 'authentication_stress':
        return this.createAuthenticationStressScenario(config)
      case 'database':
        return this.createDatabaseScenario(config)
      case 'database_stress':
        return this.createDatabaseStressScenario(config)
      case 'realtime':
        return this.createRealtimeScenario(config)
      case 'realtime_stress':
        return this.createRealtimeStressScenario(config)
      case 'file_storage':
        return this.createFileStorageScenario(config)
      case 'computed_attributes':
        return this.createComputedAttributesScenario(config)
      case 'stored_functions':
        return this.createStoredFunctionsScenario(config)
      case 'mixed_workload':
        return this.createMixedWorkloadScenario(config)
      default:
        throw new Error(`Unknown scenario type: ${name}`)
    }
  }
}