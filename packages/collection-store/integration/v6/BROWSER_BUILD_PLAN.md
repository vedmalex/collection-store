# 🌐 Browser Build & Testing Plan v6.0

## Размещение и интеграция

### Структура браузерной версии
- **Базовая директория**: `@/src/browser/`
- **Основной класс**: `@/src/browser/BrowserCollectionStore.ts`
- **IndexedDB адаптер**: `@/src/browser/adapters/IndexedDBAdapter.ts`
- **Service Worker**: `@/src/browser/workers/ServiceWorkerManager.ts`
- **Репликация**: `@/src/replication/browser/`

### Браузер как нода репликации
- **Условная активация**: Если не сконфигурированы подписки, браузер автоматически становится нодой репликации
- **P2P синхронизация**: WebRTC для прямого обмена данными между браузерами
- **Равноправное участие**: Браузерные клиенты как полноценные участники репликации

### Технологические обновления
- **Zod v4**: Валидация данных в браузере
- **Modern APIs**: Service Workers, IndexedDB, WebRTC, BroadcastChannel
- **ESM модули**: Нативная поддержка ES модулей

## 🎯 Цели браузерной поддержки

### Современные браузеры (Chrome 90+, Firefox 88+, Safari 14+)
- **ESM modules** нативная поддержка
- **Dynamic imports** для lazy loading
- **Web Workers** для фоновых операций
- **Service Workers** для offline capabilities
- **IndexedDB** для локального хранения
- **BroadcastChannel** для cross-tab sync

---

## 🏗️ Build Configuration

### Modern Browser Build Setup
```typescript
// @/src/browser/build/browser.config.ts
export const browserBuildConfig = {
  // Target browsers
  target: {
    chrome: '90',
    firefox: '88',
    safari: '14',
    edge: '90'
  },

  // Modern features we can use
  features: {
    esModules: true,
    dynamicImports: true,
    webWorkers: true,
    serviceWorkers: true,
    indexedDB: true,
    broadcastChannel: true,
    webSockets: true,
    fetch: true,
    streams: true,
    webAssembly: false // Not needed for v6.0
  },

  // Minimal polyfills
  polyfills: {
    required: [],
    optional: ['web-streams-polyfill'] // Only if needed for older Safari
  },

  // Build optimization
  optimization: {
    treeshaking: true,
    minification: true,
    compression: 'gzip',
    bundleSplitting: true,
    lazyLoading: true,
    codeElimination: true
  },

  // Output configuration
  output: {
    format: 'esm',
    directory: './dist/browser',
    entryPoints: {
      'collection-store': './src/browser/index.ts',
      'collection-store-worker': './src/browser/worker.ts'
    },
    chunks: {
      vendor: ['external-deps'],
      core: ['core-functionality'],
      adapters: ['adapters/*'],
      features: ['features/*']
    }
  }
}
```

### ESBuild Configuration
```typescript
// @/src/browser/build/esbuild.browser.ts
import { build } from 'esbuild'
import { browserBuildConfig } from './browser.config'

export async function buildBrowser(): Promise<void> {
  const commonConfig = {
    bundle: true,
    format: 'esm' as const,
    target: Object.entries(browserBuildConfig.target)
      .map(([browser, version]) => `${browser}${version}`),
    platform: 'browser' as const,

    // Modern browser optimizations
    treeShaking: true,
    minify: true,
    sourcemap: true,

    // External dependencies (CDN)
    external: [
      'react', 'react-dom', // If used in demos
      'vue', 'svelte' // Framework adapters
    ],

    // Define environment
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.BROWSER': 'true',
      '__COLLECTION_STORE_VERSION__': '"6.0.0"'
    }
  }

  // Main bundle
  await build({
    ...commonConfig,
    entryPoints: ['./src/browser/index.ts'],
    outfile: './dist/browser/collection-store.js',

    // Bundle splitting for better caching
    splitting: true,
    outdir: './dist/browser',
    entryNames: '[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]'
  })

  // Web Worker bundle
  await build({
    ...commonConfig,
    entryPoints: ['./src/browser/worker.ts'],
    outfile: './dist/browser/collection-store-worker.js'
  })

  // Service Worker
  await build({
    ...commonConfig,
    entryPoints: ['./src/browser/sw.ts'],
    outfile: './dist/browser/sw.js'
  })

  console.log('✅ Browser build completed')
}
```

---

## 🌐 Browser-Specific Implementation

### Browser Collection Store
```typescript
// @/src/browser/BrowserCollectionStore.ts
export class BrowserCollectionStore extends CollectionStore {
  private serviceWorker?: ServiceWorkerRegistration
  private broadcastChannel?: BroadcastChannel
  private indexedDB?: IDBDatabase
  private webWorker?: Worker

  constructor(config: BrowserCollectionStoreConfig) {
    super({
      ...config,

      // Browser-specific defaults
      storage: {
        primary: 'indexeddb',
        fallback: 'localstorage',
        quota: '50MB',
        ...config.storage
      },

      networking: {
        websockets: true,
        sse: true,
        fetch: true,
        ...config.networking
      },

      // Browser features
      browser: {
        crossTabSync: true,
        offline: true,
        partialReplication: true,
        webWorkers: true,
        serviceWorker: true,
        ...config.browser
      }
    })
  }

  async initialize(): Promise<void> {
    await super.initialize()

    // Initialize browser-specific features
    await this.initializeIndexedDB()
    await this.initializeServiceWorker()
    await this.initializeCrossTabSync()
    await this.initializeWebWorker()
    await this.initializePartialReplication()

    // Условная активация репликации
    await this.conditionallyActivateReplication()
  }

  private async conditionallyActivateReplication(): Promise<void> {
    // Если не сконфигурированы подписки, браузер становится нодой репликации
    if (!this.hasConfiguredSubscriptions()) {
      console.log('No subscriptions configured, activating browser as replication node')
      await this.activateAsReplicationNode()
    }
  }

  private hasConfiguredSubscriptions(): boolean {
    return this.config.subscriptions && this.config.subscriptions.length > 0
  }

  private async activateAsReplicationNode(): Promise<void> {
    // Инициализируем P2P репликацию
    await this.initializeP2PReplication()

    // Регистрируем браузер как полноценную ноду
    await this.registerAsReplicationNode()

    // Начинаем участвовать в репликации
    await this.startReplicationParticipation()
  }

  private async initializeIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported, falling back to localStorage')
      return
    }

    const dbName = this.config.storage.dbName || 'collection-store'
    const version = this.config.storage.version || 1

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.indexedDB = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        this.setupIndexedDBSchema(db)
      }
    })
  }

  private setupIndexedDBSchema(db: IDBDatabase): void {
    // Collections store
    if (!db.objectStoreNames.contains('collections')) {
      const collectionsStore = db.createObjectStore('collections', { keyPath: 'id' })
      collectionsStore.createIndex('name', 'name', { unique: true })
      collectionsStore.createIndex('lastModified', 'lastModified')
    }

    // Documents store
    if (!db.objectStoreNames.contains('documents')) {
      const documentsStore = db.createObjectStore('documents', { keyPath: 'id' })
      documentsStore.createIndex('collection', 'collection')
      documentsStore.createIndex('lastModified', 'lastModified')
    }

    // Sync metadata
    if (!db.objectStoreNames.contains('sync_metadata')) {
      const syncStore = db.createObjectStore('sync_metadata', { keyPath: 'id' })
      syncStore.createIndex('collection', 'collection')
    }
  }

  private async initializeServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported')
      return
    }

    try {
      this.serviceWorker = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      console.log('✅ Service Worker registered')

      // Setup message handling
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data)
      })

      // Handle updates
      this.serviceWorker.addEventListener('updatefound', () => {
        console.log('🔄 Service Worker update found')
      })

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error)
    }
  }

  private initializeCrossTabSync(): void {
    if (!('BroadcastChannel' in window)) {
      console.warn('BroadcastChannel not supported')
      return
    }

    this.broadcastChannel = new BroadcastChannel('collection-store-sync')

    this.broadcastChannel.onmessage = (event) => {
      this.handleCrossTabMessage(event.data)
    }

    // Notify other tabs when data changes
    this.on('dataChanged', (change) => {
      this.broadcastChannel?.postMessage({
        type: 'dataChanged',
        change,
        tabId: this.getTabId()
      })
    })
  }

  private async initializeWebWorker(): Promise<void> {
    if (!this.config.browser.webWorkers) {
      return
    }

    try {
      this.webWorker = new Worker('/collection-store-worker.js', {
        type: 'module'
      })

      this.webWorker.onmessage = (event) => {
        this.handleWorkerMessage(event.data)
      }

      this.webWorker.onerror = (error) => {
        console.error('Web Worker error:', error)
      }

      // Initialize worker with configuration
      this.webWorker.postMessage({
        type: 'init',
        config: this.config
      })

      console.log('✅ Web Worker initialized')

    } catch (error) {
      console.error('❌ Web Worker initialization failed:', error)
    }
  }

  private async initializePartialReplication(): Promise<void> {
    if (!this.config.browser.partialReplication?.enabled) {
      return
    }

    const { collections, filters } = this.config.browser.partialReplication

    for (const collectionName of collections) {
      const collection = this.collection(collectionName)

      // Setup filtered subscription
      await collection.subscribe({
        filters: this.resolveFilters(filters),
        partial: true,
        cacheLocally: true,
        syncStrategy: 'incremental'
      })
    }

    console.log('✅ Partial replication initialized')
  }
}
```

### Web Worker Implementation
```typescript
// v6/src/browser/worker.ts
import { CollectionStore } from '../core/CollectionStore'

class CollectionStoreWorker {
  private store?: CollectionStore

  constructor() {
    self.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'init':
        await this.initialize(message.config)
        break

      case 'query':
        await this.handleQuery(message)
        break

      case 'sync':
        await this.handleSync(message)
        break

      case 'compute':
        await this.handleComputation(message)
        break
    }
  }

  private async initialize(config: any): Promise<void> {
    this.store = new CollectionStore(config)
    await this.store.initialize()

    this.postMessage({
      type: 'initialized',
      success: true
    })
  }

  private async handleQuery(message: any): Promise<void> {
    try {
      const collection = this.store!.collection(message.collection)
      const result = await collection.query(message.query)

      this.postMessage({
        type: 'queryResult',
        id: message.id,
        result
      })
    } catch (error) {
      this.postMessage({
        type: 'queryError',
        id: message.id,
        error: error.message
      })
    }
  }

  private async handleSync(message: any): Promise<void> {
    try {
      // Perform background sync
      await this.store!.sync()

      this.postMessage({
        type: 'syncComplete',
        id: message.id
      })
    } catch (error) {
      this.postMessage({
        type: 'syncError',
        id: message.id,
        error: error.message
      })
    }
  }

  private async handleComputation(message: any): Promise<void> {
    try {
      // Heavy computations in worker
      const result = await this.performComputation(message.computation)

      this.postMessage({
        type: 'computationResult',
        id: message.id,
        result
      })
    } catch (error) {
      this.postMessage({
        type: 'computationError',
        id: message.id,
        error: error.message
      })
    }
  }

  private postMessage(message: any): void {
    (self as any).postMessage(message)
  }
}

new CollectionStoreWorker()
```

### Service Worker Implementation
```typescript
// v6/src/browser/sw.ts
const CACHE_NAME = 'collection-store-v6'
const STATIC_CACHE = 'collection-store-static-v6'

const STATIC_ASSETS = [
  '/',
  '/collection-store.js',
  '/collection-store-worker.js'
]

// Install event
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => (self as any).skipWaiting())
  )
})

// Activate event
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName =>
              cacheName.startsWith('collection-store-') &&
              cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE
            )
            .map(cacheName => caches.delete(cacheName))
        )
      })
      .then(() => (self as any).clients.claim())
  )
})

// Fetch event
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(event.request))
    return
  }

  // Handle static assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response
        }

        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone))
            }

            return response
          })
      })
      .catch(() => {
        // Return offline fallback
        return caches.match('/offline.html')
      })
  )
})

async function handleAPIRequest(request: Request): Promise<Response> {
  try {
    // Try network first
    const response = await fetch(request)

    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }

    return response

  } catch (error) {
    // Try cache fallback
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return error response
    return new Response(
      JSON.stringify({ error: 'Network unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Background sync
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'collection-store-sync') {
    event.waitUntil(performBackgroundSync())
  }
})

async function performBackgroundSync(): Promise<void> {
  // Implement background sync logic
  console.log('Performing background sync...')
}
```

---

## 🧪 Browser Testing Strategy

### Test Environment Setup
```typescript
// v6/tests/browser/setup.ts
import { chromium, firefox, webkit } from 'playwright'

export const browserTestConfig = {
  browsers: [
    { name: 'chromium', version: '90+' },
    { name: 'firefox', version: '88+' },
    { name: 'webkit', version: '14+' }
  ],

  viewports: [
    { width: 1920, height: 1080 }, // Desktop
    { width: 1366, height: 768 },  // Laptop
    { width: 768, height: 1024 },  // Tablet
    { width: 375, height: 667 }    // Mobile
  ],

  features: [
    'indexeddb',
    'serviceworker',
    'webworkers',
    'broadcastchannel',
    'websockets',
    'fetch',
    'esmodules'
  ]
}

export async function setupBrowserTest(browserName: string) {
  const browser = await {
    chromium: () => chromium.launch(),
    firefox: () => firefox.launch(),
    webkit: () => webkit.launch()
  }[browserName]()

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  // Inject Collection Store
  await page.addScriptTag({
    path: './dist/browser/collection-store.js',
    type: 'module'
  })

  return { browser, context, page }
}
```

### Feature Detection Tests
```typescript
// v6/tests/browser/feature-detection.test.ts
import { test, expect } from '@playwright/test'
import { setupBrowserTest } from './setup'

test.describe('Browser Feature Detection', () => {
  test('should detect required modern browser features', async ({ browserName }) => {
    const { page } = await setupBrowserTest(browserName)

    // Test IndexedDB
    const hasIndexedDB = await page.evaluate(() => 'indexedDB' in window)
    expect(hasIndexedDB).toBe(true)

    // Test Service Workers
    const hasServiceWorker = await page.evaluate(() => 'serviceWorker' in navigator)
    expect(hasServiceWorker).toBe(true)

    // Test Web Workers
    const hasWebWorker = await page.evaluate(() => typeof Worker !== 'undefined')
    expect(hasWebWorker).toBe(true)

    // Test BroadcastChannel
    const hasBroadcastChannel = await page.evaluate(() => 'BroadcastChannel' in window)
    expect(hasBroadcastChannel).toBe(true)

    // Test ES Modules
    const hasESModules = await page.evaluate(() => {
      try {
        new Function('import("")')
        return true
      } catch {
        return false
      }
    })
    expect(hasESModules).toBe(true)
  })
})
```

### Collection Store Browser Tests
```typescript
// v6/tests/browser/collection-store.test.ts
import { test, expect } from '@playwright/test'

test.describe('Collection Store Browser Integration', () => {
  test('should initialize Collection Store in browser', async ({ page }) => {
    await page.goto('/test-page.html')

    const result = await page.evaluate(async () => {
      const { BrowserCollectionStore } = window.CollectionStore

      const store = new BrowserCollectionStore({
        adapters: {
          indexeddb: {
            enabled: true,
            type: 'indexeddb'
          }
        }
      })

      await store.initialize()
      return store.isInitialized()
    })

    expect(result).toBe(true)
  })

  test('should create and query collections', async ({ page }) => {
    await page.goto('/test-page.html')

    const result = await page.evaluate(async () => {
      const { BrowserCollectionStore } = window.CollectionStore

      const store = new BrowserCollectionStore({
        adapters: {
          indexeddb: { enabled: true, type: 'indexeddb' }
        }
      })

      await store.initialize()

      const collection = await store.createCollection('test')

      // Create items
      await collection.create({ id: '1', name: 'Test Item 1' })
      await collection.create({ id: '2', name: 'Test Item 2' })

      // Query items
      const items = await collection.find({})

      return {
        count: items.length,
        names: items.map(item => item.name)
      }
    })

    expect(result.count).toBe(2)
    expect(result.names).toEqual(['Test Item 1', 'Test Item 2'])
  })

  test('should handle cross-tab synchronization', async ({ context }) => {
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await page1.goto('/test-page.html')
    await page2.goto('/test-page.html')

    // Initialize stores in both tabs
    await page1.evaluate(async () => {
      window.store = new window.CollectionStore.BrowserCollectionStore({
        adapters: { indexeddb: { enabled: true, type: 'indexeddb' } },
        browser: { crossTabSync: true }
      })
      await window.store.initialize()
    })

    await page2.evaluate(async () => {
      window.store = new window.CollectionStore.BrowserCollectionStore({
        adapters: { indexeddb: { enabled: true, type: 'indexeddb' } },
        browser: { crossTabSync: true }
      })
      await window.store.initialize()
    })

    // Create item in tab 1
    await page1.evaluate(async () => {
      const collection = await window.store.createCollection('sync-test')
      await collection.create({ id: '1', name: 'Cross-tab item' })
    })

    // Wait for sync and check in tab 2
    await page2.waitForTimeout(1000)

    const result = await page2.evaluate(async () => {
      const collection = window.store.collection('sync-test')
      const items = await collection.find({})
      return items.length
    })

    expect(result).toBe(1)
  })

  test('should work offline with Service Worker', async ({ page }) => {
    await page.goto('/test-page.html')

    // Initialize with Service Worker
    await page.evaluate(async () => {
      const store = new window.CollectionStore.BrowserCollectionStore({
        adapters: { indexeddb: { enabled: true, type: 'indexeddb' } },
        browser: { serviceWorker: true, offline: true }
      })

      await store.initialize()
      window.store = store
    })

    // Go offline
    await page.context().setOffline(true)

    // Should still work with cached data
    const result = await page.evaluate(async () => {
      try {
        const collection = await window.store.createCollection('offline-test')
        await collection.create({ id: '1', name: 'Offline item' })
        return true
      } catch (error) {
        return false
      }
    })

    expect(result).toBe(true)
  })
})
```

### Performance Tests
```typescript
// v6/tests/browser/performance.test.ts
import { test, expect } from '@playwright/test'

test.describe('Browser Performance', () => {
  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/test-page.html')

    const result = await page.evaluate(async () => {
      const store = new window.CollectionStore.BrowserCollectionStore({
        adapters: { indexeddb: { enabled: true, type: 'indexeddb' } }
      })

      await store.initialize()
      const collection = await store.createCollection('performance-test')

      // Create 10,000 items
      const startTime = performance.now()

      const items = Array.from({ length: 10000 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        value: Math.random()
      }))

      await collection.createMany(items)

      const createTime = performance.now() - startTime

      // Query performance
      const queryStartTime = performance.now()
      const results = await collection.find({ value: { $gt: 0.5 } })
      const queryTime = performance.now() - queryStartTime

      return {
        createTime,
        queryTime,
        resultCount: results.length
      }
    })

    // Performance expectations
    expect(result.createTime).toBeLessThan(5000) // 5 seconds
    expect(result.queryTime).toBeLessThan(1000)  // 1 second
    expect(result.resultCount).toBeGreaterThan(0)
  })

  test('should have minimal memory footprint', async ({ page }) => {
    await page.goto('/test-page.html')

    const memoryUsage = await page.evaluate(async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      const store = new window.CollectionStore.BrowserCollectionStore({
        adapters: { indexeddb: { enabled: true, type: 'indexeddb' } }
      })

      await store.initialize()

      const afterInitMemory = (performance as any).memory?.usedJSHeapSize || 0

      return {
        initial: initialMemory,
        afterInit: afterInitMemory,
        increase: afterInitMemory - initialMemory
      }
    })

    // Memory increase should be reasonable (less than 10MB)
    expect(memoryUsage.increase).toBeLessThan(10 * 1024 * 1024)
  })
})
```

---

## 📦 Build Scripts

### Package.json Scripts
```json
{
  "scripts": {
    "build:browser": "bun run v6/build/esbuild.browser.ts",
    "test:browser": "playwright test v6/tests/browser/",
    "test:browser:headed": "playwright test v6/tests/browser/ --headed",
    "test:browser:debug": "playwright test v6/tests/browser/ --debug",
    "serve:browser": "bun run v6/build/serve.ts",
    "dev:browser": "bun run v6/build/dev.ts"
  }
}
```

### Development Server
```typescript
// v6/build/serve.ts
import { serve } from 'bun'

const server = serve({
  port: 3000,

  async fetch(request) {
    const url = new URL(request.url)

    // Serve static files
    if (url.pathname.startsWith('/dist/')) {
      const file = Bun.file('.' + url.pathname)
      return new Response(file)
    }

    // Serve test page
    if (url.pathname === '/test-page.html') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Collection Store Browser Test</title>
        </head>
        <body>
          <h1>Collection Store Browser Test</h1>
          <script type="module" src="/dist/browser/collection-store.js"></script>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    return new Response('Not found', { status: 404 })
  }
})

console.log(`🌐 Browser test server running at http://localhost:${server.port}`)
```

---

## 🎯 Критерии успеха браузерной поддержки

### Функциональные критерии:
- [ ] **Modern browsers only** (Chrome 90+, Firefox 88+, Safari 14+)
- [ ] **ESM modules** нативная поддержка
- [ ] **IndexedDB storage** работает надежно
- [ ] **Cross-tab sync** через BroadcastChannel
- [ ] **Offline capabilities** через Service Workers
- [ ] **Web Workers** для фоновых операций

### Производительные критерии:
- [ ] **Bundle size** < 100KB gzipped
- [ ] **Initial load** < 2 seconds
- [ ] **Memory usage** < 10MB increase
- [ ] **Query performance** < 1 second для 10K items
- [ ] **Sync latency** < 500ms cross-tab

### Совместимость критерии:
- [ ] **No polyfills** для target browsers
- [ ] **Progressive enhancement** для older browsers
- [ ] **Graceful degradation** при отсутствии features
- [ ] **Framework agnostic** работает с React/Vue/Svelte

---

*Browser Build v6.0 обеспечивает современную браузерную поддержку с максимальной производительностью*