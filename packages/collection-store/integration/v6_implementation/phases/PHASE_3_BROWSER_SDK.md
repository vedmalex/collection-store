# 🌐 ФАЗА 3: Browser & Client SDK (6 недель)

## 🎯 Цель фазы
Создание современной браузерной поддержки и унифицированных SDK для различных фреймворков с максимально единым API.

## 📅 Временные рамки
**Продолжительность**: 6 недель
**Приоритет**: ВЫСОКИЙ (зависит от Фаз 1-2)
**Зависимости**: Configuration-Driven Architecture (Фаза 1), External Adapters (Фаза 2)

---

## 📋 Неделя 13-14: Browser Build & Replication Node

### Задачи
- [ ] **Modern browser build** (Chrome 90+, Firefox 88+, Safari 14+)
- [ ] **Browser as replication node** с условной активацией
- [ ] **P2P синхронизация** через WebRTC
- [ ] **Service Workers** для offline capabilities

### Файлы для реализации в `src/`
```
src/
├── browser/
│   ├── BrowserCollectionStore.ts          # Основной браузерный класс
│   ├── adapters/
│   │   ├── IndexedDBAdapter.ts             # IndexedDB адаптер
│   │   ├── LocalStorageAdapter.ts          # LocalStorage fallback
│   │   └── WebSQLAdapter.ts                # WebSQL fallback
│   ├── workers/
│   │   ├── ServiceWorkerManager.ts         # Service Worker управление
│   │   ├── WebWorkerManager.ts             # Web Worker управление
│   │   └── sw.ts                           # Service Worker код
│   ├── replication/
│   │   ├── BrowserReplicationNode.ts       # Браузер как нода репликации
│   │   ├── WebRTCManager.ts                # WebRTC P2P
│   │   ├── PeerDiscovery.ts                # Обнаружение пиров
│   │   └── ConditionalActivation.ts        # Условная активация
│   ├── storage/
│   │   ├── QuotaManager.ts                 # Управление квотами
│   │   ├── StorageEstimator.ts             # Оценка доступного места
│   │   └── FallbackStrategy.ts             # Fallback стратегии
│   └── sync/
│       ├── CrossTabSync.ts                 # Синхронизация между вкладками
│       ├── BroadcastChannelManager.ts      # BroadcastChannel
│       └── OfflineManager.ts               # Offline режим
├── build/
│   ├── browser/
│   │   ├── esbuild.browser.ts              # ESBuild конфигурация
│   │   ├── browser.config.ts               # Браузерная конфигурация
│   │   └── serve.ts                        # Dev server
│   └── targets/
│       ├── modern.ts                       # Modern browsers
│       └── legacy.ts                       # Legacy support
```

### Технические требования

#### Browser Collection Store
```typescript
interface BrowserCollectionStoreConfig extends CollectionStoreConfig {
  browser: {
    // Storage configuration
    storage: {
      primary: 'indexeddb' | 'localstorage' | 'websql'
      fallback: 'localstorage' | 'memory'
      quota: string // e.g., '50MB'
    }

    // Browser features
    features: {
      crossTabSync: boolean
      offline: boolean
      partialReplication: boolean
      webWorkers: boolean
      serviceWorker: boolean
    }

    // Replication node settings
    replicationNode: {
      autoActivate: boolean
      conditions: ActivationCondition[]
      p2p: P2PConfig
    }
  }
}

class BrowserCollectionStore extends CollectionStore {
  private serviceWorker?: ServiceWorkerRegistration
  private broadcastChannel?: BroadcastChannel
  private indexedDB?: IDBDatabase
  private webWorker?: Worker
  private quotaManager: QuotaManager

  async initialize(): Promise<void> {
    await super.initialize()

    // Initialize browser-specific features
    await this.initializeIndexedDB()
    await this.initializeServiceWorker()
    await this.initializeCrossTabSync()
    await this.initializeWebWorker()

    // Conditional replication activation
    await this.conditionallyActivateReplication()
  }

  private async conditionallyActivateReplication(): Promise<void> {
    if (!this.hasConfiguredSubscriptions()) {
      console.log('No subscriptions configured, activating browser as replication node')
      await this.activateAsReplicationNode()
    }
  }
}
```

#### Browser Replication Node
```typescript
class BrowserReplicationNode implements ReplicationNode {
  private nodeId: string
  private webrtcManager: WebRTCManager
  private p2pConnections: Map<string, RTCPeerConnection> = new Map()

  async initialize(): Promise<void> {
    if (!this.shouldActivateAsNode()) {
      return
    }

    await this.webrtcManager.initialize()
    await this.registerInReplicationNetwork()
    await this.startReplicationParticipation()
  }

  private shouldActivateAsNode(): boolean {
    return !this.hasConfiguredSubscriptions() &&
           this.isBrowserSupported() &&
           this.config.browser?.autoActivateAsNode !== false
  }
}
```

### Тесты (Bun + Playwright)
```typescript
describe('Phase 3: Browser Build & Replication', () => {
  describe('BrowserCollectionStore', () => {
    beforeEach(async () => {
      // Setup browser test environment
      await setupBrowserTestEnv()
    })

    it('should initialize in modern browsers', async ({ page }) => {
      await page.goto('/test-page.html')
      const result = await page.evaluate(async () => {
        const store = new window.CollectionStore.BrowserCollectionStore({
          adapters: { indexeddb: { enabled: true, type: 'indexeddb' } }
        })
        await store.initialize()
        return store.isInitialized()
      })
      expect(result).toBe(true)
    })

    it('should handle quota exceeded gracefully', async ({ page }) => {
      // Тест обработки превышения квот
    })
  })

  describe('WebRTC P2P Replication', () => {
    it('should establish P2P connections', async () => {
      // Тест P2P соединений
    })

    it('should sync data between browsers', async () => {
      // Тест синхронизации между браузерами
    })
  })
})
```

### Критерии успеха
- [ ] Браузерная сборка работает в современных браузерах
- [ ] IndexedDB интеграция работает надежно
- [ ] P2P репликация устанавливает соединения
- [ ] Service Workers обеспечивают offline режим

---

## 📋 Неделя 15-16: React & Qwik SDK

### Задачи
- [ ] **React SDK** с hooks для реактивности
- [ ] **Qwik SDK** с server/client signals
- [ ] **Unified API design** для всех фреймворков
- [ ] **Automatic subscription management**

### Файлы для реализации в `src/`
```
src/
├── sdk/
│   ├── core/
│   │   ├── UnifiedSDK.ts                   # Базовый SDK
│   │   ├── SDKAdapter.ts                   # Адаптер для фреймворков
│   │   └── SubscriptionManager.ts          # Управление подписками
│   ├── react/
│   │   ├── index.ts                        # React SDK экспорт
│   │   ├── hooks/
│   │   │   ├── useCollection.ts            # Хук коллекции
│   │   │   ├── useDocument.ts              # Хук документа
│   │   │   ├── useQuery.ts                 # Хук запросов
│   │   │   ├── useReplication.ts           # Хук репликации
│   │   │   ├── useSubscription.ts          # Хук подписок
│   │   │   └── useOfflineState.ts          # Хук offline состояния
│   │   ├── components/
│   │   │   ├── CollectionProvider.tsx      # Provider компонент
│   │   │   ├── QueryProvider.tsx           # Query provider
│   │   │   └── ErrorBoundary.tsx           # Error boundary
│   │   └── adapters/
│   │       └── ReactAdapter.ts             # React адаптер
│   ├── qwik/
│   │   ├── index.ts                        # Qwik SDK экспорт
│   │   ├── signals/
│   │   │   ├── useCollectionSignal.ts      # Сигнал коллекции
│   │   │   ├── useDocumentSignal.ts        # Сигнал документа
│   │   │   ├── useQuerySignal.ts           # Сигнал запросов
│   │   │   └── useReplicationSignal.ts     # Сигнал репликации
│   │   ├── components/
│   │   │   ├── CollectionProvider.tsx      # Qwik provider
│   │   │   └── QueryProvider.tsx           # Query provider
│   │   └── adapters/
│   │       └── QwikAdapter.ts              # Qwik адаптер
│   └── shared/
│       ├── types/                          # Общие типы
│       ├── utils/                          # Утилиты
│       └── errors/                         # Обработка ошибок
```

### Технические требования

#### React SDK
```typescript
// Core collection hook
function useCollection<T extends Item>(
  name: string,
  options?: CollectionOptions
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const sdk = useContext(CollectionStoreContext)

  useEffect(() => {
    const subscription = sdk.subscribe(name, {
      onData: setData,
      onError: setError,
      onLoading: setLoading
    })

    return () => subscription.unsubscribe()
  }, [name, sdk])

  const operations = useMemo(() => ({
    create: (doc: Partial<T>) => sdk.collection(name).create(doc),
    update: (id: string, update: Partial<T>) => sdk.collection(name).update(id, update),
    delete: (id: string) => sdk.collection(name).delete(id),
    query: (query: MongoQuery) => sdk.collection(name).find(query)
  }), [name, sdk])

  return { data, loading, error, ...operations }
}

// Replication hook
function useReplication(config: ReplicationConfig): UseReplicationResult {
  const [status, setStatus] = useState<ReplicationStatus>('disconnected')
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  // Implementation

  return { status, conflicts, start, stop, resolve }
}
```

#### Qwik SDK
```typescript
// Server-side collection signal
export const useCollectionSignal = (name: string) => {
  const signal = useSignal<any[]>([])

  // Server-side data fetching
  useTask$(async ({ track }) => {
    track(() => name)
    const sdk = useContext(CollectionStoreContext)
    const data = await sdk.collection(name).find()
    signal.value = data
  })

  // Client-side real-time updates
  useVisibleTask$(({ cleanup }) => {
    const sdk = useContext(CollectionStoreContext)
    const subscription = sdk.subscribe(name, (data) => {
      signal.value = data
    })

    cleanup(() => subscription.unsubscribe())
  })

  return signal
}

// Computed signal example
export const useFilteredCollection = (
  collectionName: string,
  filter: (item: any) => boolean
) => {
  const collection = useCollectionSignal(collectionName)

  return useComputed$(() => {
    return collection.value.filter(filter)
  })
}
```

### Тесты (Bun + Testing Library)
```typescript
describe('Phase 3: React & Qwik SDK', () => {
  describe('React SDK', () => {
    beforeEach(() => {
      // Setup React testing environment
      setupReactTestEnv()
    })

    it('should provide collection data via useCollection hook', async () => {
      const { result } = renderHook(() => useCollection('test'), {
        wrapper: CollectionStoreProvider
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.data).toHaveLength(0)
      })
    })

    it('should handle real-time updates', async () => {
      // Тест real-time обновлений
    })

    it('should manage subscriptions automatically', () => {
      // Тест автоматического управления подписками
    })
  })

  describe('Qwik SDK', () => {
    it('should provide server-side signals', async () => {
      // Тест server-side сигналов
    })

    it('should handle client-side hydration', async () => {
      // Тест клиентской гидратации
    })

    it('should support computed signals', () => {
      // Тест computed сигналов
    })
  })
})
```

### Критерии успеха
- [ ] React hooks обеспечивают реактивность
- [ ] Qwik signals работают на сервере и клиенте
- [ ] Автоматическое управление подписками
- [ ] Unified API между фреймворками

---

## 📋 Неделя 17-18: ExtJS SDK & Testing

### Задачи
- [ ] **ExtJS 4.2/6.6 SDK** с Ext.data.Store адаптерами
- [ ] **Cross-framework testing**
- [ ] **Performance benchmarks**
- [ ] **Comprehensive documentation**

### Файлы для реализации в `src/`
```
src/
├── sdk/
│   ├── extjs/
│   │   ├── index.js                        # ExtJS SDK экспорт
│   │   ├── v4/
│   │   │   ├── CollectionStore.js          # ExtJS 4.2 Store
│   │   │   ├── Proxy.js                    # Collection Store Proxy
│   │   │   ├── Model.js                    # Base Model
│   │   │   └── RealtimeStore.js            # Real-time Store
│   │   ├── v6/
│   │   │   ├── CollectionStore.js          # ExtJS 6.6 Store
│   │   │   ├── ChainedStore.js             # Chained Store
│   │   │   ├── BufferedStore.js            # Buffered Store
│   │   │   └── ViewModel.js                # ViewModel integration
│   │   ├── components/
│   │   │   ├── ConflictResolutionPanel.js  # UI для разрешения конфликтов
│   │   │   ├── SyncStatusPanel.js          # Статус синхронизации
│   │   │   └── OfflineIndicator.js         # Индикатор offline
│   │   └── adapters/
│   │       ├── ExtJS4Adapter.js            # ExtJS 4.2 адаптер
│   │       └── ExtJS6Adapter.js            # ExtJS 6.6 адаптер
│   └── testing/
│       ├── cross-framework/
│       │   ├── APICompatibility.test.ts    # Тесты совместимости API
│       │   ├── PerformanceTests.ts         # Performance тесты
│       │   └── IntegrationTests.ts         # Интеграционные тесты
│       └── benchmarks/
│           ├── ReactBenchmark.ts           # React бенчмарки
│           ├── QwikBenchmark.ts            # Qwik бенчмарки
│           └── ExtJSBenchmark.js           # ExtJS бенчмарки
```

### Технические требования

#### ExtJS 4.2 Store
```javascript
// ExtJS 4.2 Store
Ext.define('CollectionStore.data.Store', {
  extend: 'Ext.data.Store',
  requires: ['CollectionStore.data.Proxy'],

  proxy: {
    type: 'collectionstore',
    collection: null // Set dynamically
  },

  // Real-time updates
  enableRealTime: true,
  autoSync: true,

  constructor: function(config) {
    this.callParent([config])

    if (this.enableRealTime) {
      this.setupRealTimeUpdates()
    }
  },

  setupRealTimeUpdates: function() {
    var me = this

    // Subscribe to collection changes
    this.subscription = CollectionStore.subscribe(this.proxy.collection, {
      onUpdate: function(data) {
        me.loadData(data, false)
        me.fireEvent('realtimeupdate', me, data)
      },
      onConflict: function(conflict) {
        me.fireEvent('conflict', me, conflict)
      }
    })
  }
})

// ExtJS 4.2 Proxy
Ext.define('CollectionStore.data.Proxy', {
  extend: 'Ext.data.proxy.Memory',
  alias: 'proxy.collectionstore',

  collection: null,

  read: function(operation, callback, scope) {
    var me = this

    CollectionStore.collection(me.collection).find(operation.params || {})
      .then(function(data) {
        operation.setSuccessful()
        operation.setResultSet(Ext.create('Ext.data.ResultSet', {
          records: data,
          total: data.length,
          loaded: true
        }))

        if (callback) {
          callback.call(scope || me, operation)
        }
      })
      .catch(function(error) {
        operation.setException(error.message)
        if (callback) {
          callback.call(scope || me, operation)
        }
      })
  }
})
```

#### ExtJS 6.6 Store
```javascript
// ExtJS 6.6 Store with modern features
Ext.define('CollectionStore.data.ChainedStore', {
  extend: 'Ext.data.ChainedStore',

  // Advanced filtering and sorting
  remoteFilter: true,
  remoteSort: true,

  // Buffered rendering support
  buffered: true,
  pageSize: 100,

  // Real-time conflict resolution
  conflictResolution: 'auto', // 'auto', 'manual', 'last-wins'

  onConflictDetected: function(conflict) {
    switch (this.conflictResolution) {
      case 'auto':
        this.resolveConflictAuto(conflict)
        break
      case 'manual':
        this.showConflictDialog(conflict)
        break
      case 'last-wins':
        this.acceptRemoteChanges(conflict)
        break
    }
  }
})
```

### Тесты (Bun + Cross-framework)
```typescript
describe('Phase 3: ExtJS SDK & Cross-framework Testing', () => {
  describe('ExtJS 4.2 Integration', () => {
    beforeEach(() => {
      // Setup ExtJS 4.2 test environment
      setupExtJS4TestEnv()
    })

    it('should create ExtJS 4.2 store with Collection Store proxy', () => {
      // Тест создания ExtJS 4.2 store
    })

    it('should handle real-time updates in ExtJS 4.2', () => {
      // Тест real-time обновлений
    })
  })

  describe('Cross-framework API Compatibility', () => {
    const frameworks = ['react', 'qwik', 'extjs4', 'extjs6']

    test.each(frameworks)('should have consistent API in %s', (framework) => {
      // Тест совместимости API между фреймворками
      const sdk = createSDK(framework)

      expect(sdk).toHaveProperty('collection')
      expect(sdk).toHaveProperty('subscribe')
      expect(sdk).toHaveProperty('query')
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet performance requirements across frameworks', async () => {
      const benchmarks = await runCrossFrameworkBenchmarks()

      // React performance
      expect(benchmarks.react.renderTime).toBeLessThan(100) // ms
      expect(benchmarks.react.memoryUsage).toBeLessThan(10) // MB

      // Qwik performance
      expect(benchmarks.qwik.hydrationTime).toBeLessThan(50) // ms
      expect(benchmarks.qwik.bundleSize).toBeLessThan(5) // KB

      // ExtJS performance
      expect(benchmarks.extjs.storeLoadTime).toBeLessThan(200) // ms
    })
  })
})
```

### Критерии успеха
- [ ] ExtJS 4.2/6.6 интеграция работает
- [ ] Cross-framework API совместимость 95%+
- [ ] Performance benchmarks соответствуют требованиям
- [ ] Comprehensive documentation готова

---

## 🎯 Общие критерии успеха Фазы 3

### Функциональные критерии
- [ ] **Единый API для всех фреймворков (95% совпадение)**
- [ ] **Полная реактивность во всех SDK**
- [ ] **Автоматическое управление подписками**
- [ ] **Production-ready documentation**

### Браузерные критерии
- [ ] **Modern browsers only** (Chrome 90+, Firefox 88+, Safari 14+)
- [ ] **ESM modules** нативная поддержка
- [ ] **IndexedDB storage** работает надежно
- [ ] **Cross-tab sync** через BroadcastChannel
- [ ] **Offline capabilities** через Service Workers

### Производительные критерии
- [ ] **Bundle size** < 100KB gzipped
- [ ] **Initial load** < 2 seconds
- [ ] **Memory usage** < 10MB increase
- [ ] **Query performance** < 1 second для 10K items
- [ ] **Sync latency** < 500ms cross-tab

---

## 📝 Примеры использования

### React Example
```tsx
// React component example
function StudentList() {
  const { data: students, loading, create } = useCollection('students')
  const { status } = useReplication()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <div>Sync Status: {status}</div>
      {students.map(student => (
        <div key={student.id}>{student.name}</div>
      ))}
      <button onClick={() => create({ name: 'New Student' })}>
        Add Student
      </button>
    </div>
  )
}
```

### Qwik Example
```tsx
// Qwik component example
export const StudentList = component$(() => {
  const students = useCollectionSignal('students')
  const replicationStatus = useReplicationSignal()

  return (
    <div>
      <div>Sync Status: {replicationStatus.value}</div>
      {students.value.map(student => (
        <div key={student.id}>{student.name}</div>
      ))}
    </div>
  )
})
```

### ExtJS Example
```javascript
// ExtJS 6.6 example
Ext.create('Ext.grid.Panel', {
  store: {
    type: 'collectionstore',
    collection: 'students',
    enableRealTime: true
  },

  columns: [
    { text: 'Name', dataIndex: 'name' },
    { text: 'Email', dataIndex: 'email' }
  ],

  listeners: {
    realtimeupdate: function(store, data) {
      console.log('Real-time update received:', data)
    },

    conflict: function(store, conflict) {
      this.showConflictResolutionDialog(conflict)
    }
  }
})
```

---

## 🔄 Интеграция с предыдущими фазами

### Использование Configuration System (Фаза 1)
- **Browser configuration** через ConfigurationManager
- **Feature toggles** для браузерных функций
- **Adaptive configuration** на основе browser capabilities

### Использование External Adapters (Фаза 2)
- **Browser adapters** интегрируются с external adapters
- **Offline sync** с external sources при восстановлении соединения
- **Conflict resolution** между browser и external sources

---

*Фаза 3 обеспечивает современную браузерную поддержку и унифицированные SDK для всех популярных фреймворков*