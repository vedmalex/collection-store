/**
 * Phase 5.3: Offline-First Support - SDK Offline E2E (Node-friendly)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ClientSDK } from '../ClientSDK'
import { ClientSDKConfig } from '../../interfaces/IClientSDK'

describe('SDK Offline E2E (Node)', () => {
  let sdk: ClientSDK
  let config: ClientSDKConfig

  beforeEach(async () => {
    config = {
      baseUrl: 'http://localhost:3000',
      apiKey: 'e2e-api-key',
      session: { persistState: true },
      connection: { type: 'websocket' },
      pagination: { limit: 5, sort: [], format: 'base64_json' },
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

  it('should operate offline helpers successfully in Node', async () => {
    // Enable offline mode (internal state)
    await sdk.offline.enableOfflineMode()
    expect(sdk.offline.isOfflineMode()).toBe(true)

    // Cache mock data (graceful in Node)
    const cacheResult = await sdk.collections.cacheForOffline('e2e-collection')
    expect(cacheResult.success).toBe(true)

    // Read cached (likely empty in Node)
    const readResult = await sdk.collections.getCachedData('e2e-collection')
    expect(readResult.success).toBe(true)
    expect(Array.isArray(readResult.data)).toBe(true)

    // Force sync pending changes (graceful)
    const syncResult = await sdk.collections.syncPendingChanges()
    expect(syncResult.success).toBe(true)
    expect(syncResult.data).toBe(true)
  })
})


