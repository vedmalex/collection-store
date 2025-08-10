/**
 * Phase 5.3: Offline-First Support - CollectionManager Offline API Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ClientSDK } from '../ClientSDK'
import { ClientSDKConfig } from '../../interfaces/IClientSDK'

describe('CollectionManager - Offline API (Node environment)', () => {
  let sdk: ClientSDK
  let config: ClientSDKConfig

  beforeEach(async () => {
    config = {
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      session: { persistState: true },
      connection: { type: 'websocket' },
      pagination: { limit: 10, sort: [], format: 'base64_json' },
      cache: { enabled: true, maxSize: 50, ttl: 60000 },
      logging: { enabled: false, level: 'error' }
    }

    sdk = new ClientSDK(config)
    await sdk.initialize(config)
  })

  afterEach(async () => {
    if (sdk) {
      await sdk.shutdown()
    }
  })

  it('should expose offline manager on SDK', () => {
    expect(sdk.offline).toBeDefined()
    expect(typeof sdk.offline.isOfflineMode).toBe('function')
  })

  it('cacheForOffline should succeed (graceful no-op in Node)', async () => {
    const result = await sdk.collections.cacheForOffline('test-collection')

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })

  it('getCachedData should return success and array (possibly empty) in Node', async () => {
    const result = await sdk.collections.getCachedData('test-collection')

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('syncPendingChanges should succeed', async () => {
    const result = await sdk.collections.syncPendingChanges()

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.data).toBe(true)
  })
})


