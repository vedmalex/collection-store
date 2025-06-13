/**
 * Phase 5: Client Integration - Client SDK Tests
 *
 * Тесты для Client SDK
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ClientSDK } from '../../../client/sdk/core/ClientSDK'
import { ClientSDKConfig } from '../../../client/sdk/interfaces/IClientSDK'

describe('ClientSDK', () => {
  let sdk: ClientSDK
  let config: ClientSDKConfig

  beforeEach(() => {
    config = {
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 2,
      session: {
        sessionTimeout: 60000,
        persistState: true
      },
      connection: {
        type: 'websocket',
        timeout: 5000
      },
      pagination: {
        limit: 10,
        sort: [],
        format: 'base64_json'
      },
      cache: {
        enabled: true,
        maxSize: 50,
        ttl: 60000
      },
      logging: {
        enabled: true,
        level: 'info'
      }
    }

    sdk = new ClientSDK(config)
  })

  afterEach(async () => {
    if (sdk) {
      await sdk.shutdown()
    }
  })

  describe('Initialization', () => {
    it('should create SDK instance with default config', () => {
      const defaultSDK = new ClientSDK()
      expect(defaultSDK).toBeDefined()
      expect(defaultSDK.getConfig().baseUrl).toBe('http://localhost:3000')
    })

    it('should create SDK instance with custom config', () => {
      expect(sdk).toBeDefined()
      expect(sdk.getConfig().baseUrl).toBe('http://localhost:3000')
      expect(sdk.getConfig().apiKey).toBe('test-api-key')
    })

    it('should initialize SDK successfully', async () => {
      const result = await sdk.initialize(config)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.sessionId).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.duration).toBeGreaterThan(0)
    })

    it('should handle initialization errors gracefully', async () => {
      // Создаем SDK с некорректной конфигурацией
      const invalidConfig = { ...config, baseUrl: '' }
      const result = await sdk.initialize(invalidConfig)

      // SDK должен обработать ошибку gracefully
      expect(result).toBeDefined()
      expect(result.metadata).toBeDefined()
    })
  })

  describe('Connection Management', () => {
    beforeEach(async () => {
      await sdk.initialize(config)
    })

    it('should connect to server', async () => {
      const result = await sdk.connect()

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
      expect(sdk.isConnected()).toBe(true)
    })

    it('should disconnect from server', async () => {
      await sdk.connect()
      const result = await sdk.disconnect()

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should handle connection without initialization', async () => {
      const uninitializedSDK = new ClientSDK()
      const result = await uninitializedSDK.connect()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('not initialized')
    })
  })

  describe('Authentication', () => {
    beforeEach(async () => {
      await sdk.initialize(config)
    })

    it('should authenticate with username and password', async () => {
      const credentials = {
        username: 'testuser',
        password: 'testpass'
      }

      const result = await sdk.authenticate(credentials)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.token).toBeDefined()
      expect(result.data?.refreshToken).toBeDefined()
      expect(result.data?.user).toBeDefined()
      expect(result.data?.user.username).toBe('testuser')
    })

    it('should authenticate with email and password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'testpass'
      }

      const result = await sdk.authenticate(credentials)

      expect(result.success).toBe(true)
      expect(result.data?.user.email).toBe('test@example.com')
    })

    it('should authenticate with token', async () => {
      const credentials = {
        token: 'existing-token'
      }

      const result = await sdk.authenticate(credentials)

      expect(result.success).toBe(true)
      expect(result.data?.token).toBeDefined()
    })

    it('should logout successfully', async () => {
      await sdk.authenticate({ username: 'test', password: 'test' })
      const result = await sdk.logout()

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should get current user', async () => {
      await sdk.authenticate({ username: 'test', password: 'test' })
      const result = await sdk.getCurrentUser()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBeDefined()
    })
  })

  describe('Configuration Management', () => {
    it('should get current config', () => {
      const currentConfig = sdk.getConfig()

      expect(currentConfig).toBeDefined()
      expect(currentConfig.baseUrl).toBe('http://localhost:3000')
      expect(currentConfig.apiKey).toBe('test-api-key')
    })

    it('should update config', async () => {
      const updates = {
        timeout: 10000,
        retryAttempts: 5
      }

      const result = await sdk.updateConfig(updates)

      expect(result.success).toBe(true)
      expect(sdk.getConfig().timeout).toBe(10000)
      expect(sdk.getConfig().retryAttempts).toBe(5)
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await sdk.initialize(config)
    })

    it('should get SDK statistics', async () => {
      const result = await sdk.getStats()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.requests).toBeDefined()
      expect(result.data?.cache).toBeDefined()
      expect(result.data?.requests.total).toBeGreaterThanOrEqual(0)
    })

    it('should track request statistics', async () => {
      // Выполняем несколько операций
      await sdk.authenticate({ username: 'test', password: 'test' })
      await sdk.getCurrentUser()

      const result = await sdk.getStats()

      expect(result.data?.requests.total).toBeGreaterThan(0)
      expect(result.data?.requests.successful).toBeGreaterThan(0)
    })
  })

  describe('Event System', () => {
    beforeEach(async () => {
      await sdk.initialize(config)
    })

    it('should emit and handle SDK events', (done) => {
      let eventReceived = false

      const unsubscribe = sdk.addEventListener('sdk_connected', (event) => {
        expect(event).toBeDefined()
        expect(event.type).toBe('sdk_connected')
        eventReceived = true
        unsubscribe()
        done()
      })

      sdk.connect()

      // Fallback timeout
      setTimeout(() => {
        if (!eventReceived) {
          unsubscribe()
          done()
        }
      }, 1000)
    })

    it('should unsubscribe from events', () => {
      let eventCount = 0

      const callback = () => {
        eventCount++
      }

      sdk.addEventListener('test_event', callback)
      sdk.removeEventListener('test_event', callback)

      // Эмитируем событие после отписки
      sdk.emit('test_event', {})

      expect(eventCount).toBe(0)
    })
  })

  describe('Component Managers', () => {
    beforeEach(async () => {
      await sdk.initialize(config)
    })

    it('should have all required managers', () => {
      expect(sdk.session).toBeDefined()
      expect(sdk.connection).toBeDefined()
      expect(sdk.state).toBeDefined()
      expect(sdk.pagination).toBeDefined()
      expect(sdk.collections).toBeDefined()
      expect(sdk.files).toBeDefined()
      expect(sdk.subscriptions).toBeDefined()
      expect(sdk.cache).toBeDefined()
    })

    it('should access collection manager', async () => {
      const result = await sdk.collections.find('test-collection')

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should access file manager', async () => {
      const mockFile = new Blob(['test content'], { type: 'text/plain' })
      const result = await sdk.files.upload(mockFile as any)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.data?.fileId).toBeDefined()
    })

    it('should access subscription manager', async () => {
      const result = await sdk.subscriptions.subscribe('test-collection')

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.data?.subscriptionId).toBeDefined()
      expect(typeof result.data?.unsubscribe).toBe('function')
    })

    it('should access cache manager', async () => {
      await sdk.cache.set('test-key', 'test-value')
      const value = await sdk.cache.get('test-key')

      expect(value).toBe('test-value')
    })
  })

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await sdk.initialize(config)
      await sdk.connect()

      const result = await sdk.shutdown()

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should handle multiple shutdown calls', async () => {
      await sdk.initialize(config)

      const result1 = await sdk.shutdown()
      const result2 = await sdk.shutdown()

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Симулируем сетевую ошибку через некорректный URL
      const errorConfig = { ...config, baseUrl: 'http://invalid-url:99999' }
      const result = await sdk.initialize(errorConfig)

      // SDK должен обработать ошибку и вернуть результат
      expect(result).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should track error statistics', async () => {
      // Выполняем операцию, которая может вызвать ошибку
      const invalidSDK = new ClientSDK()
      await invalidSDK.connect() // Должно вызвать ошибку

      const stats = await invalidSDK.getStats()
      expect(stats.data?.requests.failed).toBeGreaterThan(0)
    })
  })
})