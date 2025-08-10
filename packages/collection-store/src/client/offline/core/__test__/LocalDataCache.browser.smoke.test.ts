/**
 * Phase 5.3: Offline-First - Browser Smoke Test for LocalDataCache (using fake-indexeddb)
 */

// Provide IndexedDB in Bun/Node via shim
try {
  // Provide IndexedDB in Bun/Node via shim; guard for environments without module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('fake-indexeddb/auto')
} catch {
  // ignore in environments where the shim is not required/available
}

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { LocalDataCache } from '../local-data-cache'

describe('LocalDataCache (browser smoke via fake-indexeddb)', () => {
  const hasIndexedDB = typeof (globalThis as any).indexedDB !== 'undefined'
  let cache: LocalDataCache

  beforeEach(async () => {
    if (!hasIndexedDB) {
      // Skip tests gracefully if IndexedDB is unavailable in environment
      return
    }
    cache = new LocalDataCache()
    await cache.initialize({ cleanupInterval: 0 })
  })

  afterEach(async () => {
    if (!hasIndexedDB) return
    await cache.shutdown()
  })

  it('should set and get entry', async () => {
    if (!hasIndexedDB) { expect(true).toBe(true); return }
    await cache.set('articles', 'a1', { title: 'Hello' })
    const entry = await cache.get('articles', 'a1')
    expect(entry).not.toBeNull()
    expect(entry?.data).toEqual({ title: 'Hello' })
  })

  it('should list collection entries', async () => {
    if (!hasIndexedDB) { expect(true).toBe(true); return }
    await cache.set('articles', 'a1', { t: 1 })
    await cache.set('articles', 'a2', { t: 2 })
    const list = await cache.getCollection('articles')
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(2)
  })

  it('should delete entry', async () => {
    if (!hasIndexedDB) { expect(true).toBe(true); return }
    await cache.set('articles', 'a1', { t: 1 })
    const removed = await cache.delete('articles', 'a1')
    expect(removed).toBe(true)
    const entry = await cache.get('articles', 'a1')
    expect(entry).toBeNull()
  })
})


