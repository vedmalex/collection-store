# 🔧 Configuration-Driven Architecture v6.0

## Размещение и интеграция

### Структура проекта
- **Основная реализация**: `@/src/` - продолжение монолитного приложения
- **Конфигурационная система**: `@/src/config/`
- **Адаптеры**: `@/src/adapters/`
- **Документация**: `implementation/v6/`

### Технологические обновления
- **Zod v4**: Использование последней версии для схем валидации
- **ESM модули**: Нативная поддержка ES модулей
- **TypeScript 5.x**: Современные возможности типизации

## 🎯 Принципы конфигурационной архитектуры

### Основная идея
Весь функционал Collection Store v6.0 должен быть доступен через конфигурацию, а не через создание отдельных экземпляров классов. Пользователь описывает желаемое поведение в конфигурации, система автоматически создает и настраивает необходимые компоненты.

---

## 🏗️ Архитектурные компоненты

### 1. Unified Configuration Schema
```typescript
// @/src/config/schemas/CollectionStoreConfig.ts
import { z } from 'zod'; // v4
export interface CollectionStoreConfig {
  // Основные настройки
  core: {
    name: string
    version: string
    environment: 'development' | 'staging' | 'production'
    nodeId?: string
    clusterId?: string
  }

  // Адаптеры хранения
  adapters: {
    [adapterName: string]: AdapterConfig & {
      enabled: boolean
      priority: number // для conflict resolution
      role: 'primary' | 'backup' | 'readonly'
    }
  }

  // Репликация и синхронизация
  replication: {
    enabled: boolean
    strategy: 'multi-source' | 'master-slave' | 'peer-to-peer'
    conflictResolution: 'timestamp' | 'priority' | 'manual' | 'custom'
    syncInterval: number
    batchSize: number
  }

  // Клиентские настройки
  client: {
    browser: BrowserClientConfig
    server: ServerClientConfig
    mobile?: MobileClientConfig
  }

  // Производительность
  performance: {
    caching: CacheConfig
    indexing: IndexConfig
    compression: CompressionConfig
    monitoring: MonitoringConfig
  }

  // Безопасность
  security: {
    authentication: AuthConfig
    authorization: AuthzConfig
    encryption: EncryptionConfig
    audit: AuditConfig
  }

  // Функциональные возможности
  features: {
    realtime: RealtimeConfig
    offline: OfflineConfig
    analytics: AnalyticsConfig
    workflow: WorkflowConfig
  }
}

// Конфигурация адаптеров
export interface AdapterConfig {
  type: 'mongodb' | 'googlesheets' | 'markdown' | 'file' | 'memory'
  enabled: boolean
  priority: number
  role: 'primary' | 'backup' | 'readonly'

  // Подписки на изменения
  subscriptions: {
    enabled: boolean
    mechanism: 'changestream' | 'oplog' | 'polling' | 'webhooks' | 'filewatcher'
    interval?: number // для polling
    batchSize?: number
  }

  // Rate limiting
  rateLimits?: {
    requestsPerSecond?: number
    requestsPerMinute?: number
    requestsPerHour?: number
    quotaPerDay?: number
    batchSize?: number
  }

  // Retry policy
  retryPolicy?: {
    maxAttempts: number
    backoffMs: number
    backoffMultiplier: number
    maxBackoffMs: number
  }

  // Adapter-specific config
  config: MongoDBConfig | GoogleSheetsConfig | MarkdownConfig | FileConfig | MemoryConfig
}
```

### 2. Configuration Manager
```typescript
// @/src/config/ConfigurationManager.ts
export class ConfigurationManager {
  private config: CollectionStoreConfig
  private watchers: Map<string, ConfigWatcher> = new Map()
  private validators: Map<string, ConfigValidator> = new Map()
  private appliers: Map<string, ConfigApplier> = new Map()

  constructor(config: CollectionStoreConfig | string) {
    if (typeof config === 'string') {
      this.config = this.loadConfigFromFile(config)
    } else {
      this.config = config
    }

    this.validateConfig()
    this.setupConfigWatchers()
    this.registerBuiltInValidators()
    this.registerBuiltInAppliers()
  }

  // Валидация конфигурации
  private validateConfig(): void {
    const schema = this.getConfigSchema()
    const result = schema.safeParse(this.config)

    if (!result.success) {
      throw new ConfigurationError('Invalid configuration', result.error.issues)
    }
  }

  // Hot reload конфигурации
  async reloadConfig(newConfig: Partial<CollectionStoreConfig>): Promise<void> {
    const mergedConfig = this.mergeConfigs(this.config, newConfig)

    // Валидируем новую конфигурацию
    await this.validateConfigChange(this.config, mergedConfig)

    // Применяем изменения
    const changes = this.detectConfigChanges(this.config, mergedConfig)
    await this.applyConfigChanges(changes)

    this.config = mergedConfig
    this.emitConfigChanged(changes)
  }

  // Применение изменений конфигурации
  private async applyConfigChanges(changes: ConfigChange[]): Promise<void> {
    // Сортируем изменения по приоритету
    const sortedChanges = this.sortChangesByPriority(changes)

    for (const change of sortedChanges) {
      const applier = this.appliers.get(change.section)
      if (applier) {
        await applier.apply(change)
      } else {
        console.warn(`No applier found for config section: ${change.section}`)
      }
    }
  }

  // Feature toggles
  async toggleFeature(featurePath: string, enabled: boolean): Promise<void> {
    const update = this.createFeatureToggleUpdate(featurePath, enabled)
    await this.reloadConfig(update)
  }

  // Получение конфигурации адаптера
  getAdapterConfig<T extends AdapterConfig>(adapterName: string): T {
    const adapterConfig = this.config.adapters[adapterName]
    if (!adapterConfig) {
      throw new Error(`Adapter ${adapterName} not configured`)
    }
    return adapterConfig as T
  }

  // Получение активных адаптеров
  getActiveAdapters(): string[] {
    return Object.entries(this.config.adapters)
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name)
  }

  // Получение адаптеров по роли
  getAdaptersByRole(role: 'primary' | 'backup' | 'readonly'): string[] {
    return Object.entries(this.config.adapters)
      .filter(([_, config]) => config.enabled && config.role === role)
      .map(([name, _]) => name)
  }

  // Проверка включенности функции
  isFeatureEnabled(featurePath: string): boolean {
    return this.getNestedValue(this.config.features, featurePath + '.enabled') === true
  }

  // Получение конфигурации функции
  getFeatureConfig<T>(featurePath: string): T {
    return this.getNestedValue(this.config.features, featurePath) as T
  }
}
```

### 3. Adapter Factory с конфигурацией
```typescript
// v6/core/adapters/AdapterFactory.ts
export class AdapterFactory {
  private static adapters: Map<string, AdapterConstructor> = new Map()
  private static instances: Map<string, IExternalStorageAdapter<any>> = new Map()
  private configManager: ConfigurationManager

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager
    this.registerBuiltInAdapters()
  }

  // Регистрация адаптеров
  static register(type: string, constructor: AdapterConstructor): void {
    this.adapters.set(type, constructor)
  }

  // Создание адаптера из конфигурации
  async createAdapter<T extends Item>(
    adapterName: string,
    collection: Collection<T>
  ): Promise<IExternalStorageAdapter<T>> {
    const config = this.configManager.getAdapterConfig(adapterName)

    if (!config.enabled) {
      throw new Error(`Adapter ${adapterName} is disabled`)
    }

    const AdapterClass = AdapterFactory.adapters.get(config.type)
    if (!AdapterClass) {
      throw new Error(`Adapter type ${config.type} not registered`)
    }

    // Создаем экземпляр адаптера
    const adapter = new AdapterClass(config)
    await adapter.init(collection)

    // Настраиваем подписки
    await this.setupSubscriptions(adapter, config)

    // Настраиваем rate limiting
    this.setupRateLimiting(adapter, config)

    // Настраиваем retry policy
    this.setupRetryPolicy(adapter, config)

    // Кэшируем экземпляр
    AdapterFactory.instances.set(adapterName, adapter)

    return adapter
  }

  // Настройка подписок на изменения
  private async setupSubscriptions(
    adapter: IExternalStorageAdapter<any>,
    config: AdapterConfig
  ): Promise<void> {
    if (!config.subscriptions.enabled) {
      return
    }

    switch (config.subscriptions.mechanism) {
      case 'changestream':
        await this.setupChangeStream(adapter, config)
        break
      case 'oplog':
        await this.setupOplogWatcher(adapter, config)
        break
      case 'polling':
        await this.setupPolling(adapter, config)
        break
      case 'webhooks':
        await this.setupWebhooks(adapter, config)
        break
      case 'filewatcher':
        await this.setupFileWatcher(adapter, config)
        break
    }
  }

  // Получение всех активных адаптеров
  getActiveAdapters(): Map<string, IExternalStorageAdapter<any>> {
    const activeNames = this.configManager.getActiveAdapters()
    const activeAdapters = new Map()

    for (const name of activeNames) {
      const adapter = AdapterFactory.instances.get(name)
      if (adapter) {
        activeAdapters.set(name, adapter)
      }
    }

    return activeAdapters
  }

  // Получение адаптеров по роли
  getAdaptersByRole(role: 'primary' | 'backup' | 'readonly'): Map<string, IExternalStorageAdapter<any>> {
    const adapterNames = this.configManager.getAdaptersByRole(role)
    const adapters = new Map()

    for (const name of adapterNames) {
      const adapter = AdapterFactory.instances.get(name)
      if (adapter) {
        adapters.set(name, adapter)
      }
    }

    return adapters
  }
}
```

### 4. Collection Store с конфигурацией
```typescript
// v6/core/CollectionStore.ts
export class CollectionStore {
  private configManager: ConfigurationManager
  private adapterFactory: AdapterFactory
  private collections: Map<string, Collection<any>> = new Map()
  private replicationManager?: ReplicationManager
  private featureManagers: Map<string, FeatureManager> = new Map()

  constructor(config: CollectionStoreConfig | string) {
    this.configManager = new ConfigurationManager(config)
    this.adapterFactory = new AdapterFactory(this.configManager)

    // Подписываемся на изменения конфигурации
    this.configManager.on('configChanged', (changes) => {
      this.handleConfigChanges(changes)
    })
  }

  async initialize(): Promise<void> {
    // Инициализируем адаптеры
    await this.initializeAdapters()

    // Инициализируем репликацию
    if (this.configManager.isFeatureEnabled('replication')) {
      await this.initializeReplication()
    }

    // Инициализируем функции
    await this.initializeFeatures()
  }

  // Создание коллекции с автоматической настройкой адаптеров
  async createCollection<T extends Item>(
    name: string,
    options?: CollectionOptions
  ): Promise<Collection<T>> {
    const collection = new Collection<T>({
      name,
      ...options
    })

    // Автоматически настраиваем адаптеры из конфигурации
    const activeAdapters = this.configManager.getActiveAdapters()

    for (const adapterName of activeAdapters) {
      const adapter = await this.adapterFactory.createAdapter(adapterName, collection)
      collection.addAdapter(adapterName, adapter)
    }

    this.collections.set(name, collection)
    return collection
  }

  // Получение коллекции
  collection<T extends Item>(name: string): Collection<T> {
    const collection = this.collections.get(name)
    if (!collection) {
      throw new Error(`Collection ${name} not found`)
    }
    return collection as Collection<T>
  }

  // Проверка наличия адаптера
  hasAdapter(adapterName: string): boolean {
    const config = this.configManager.getAdapterConfig(adapterName)
    return config && config.enabled
  }

  // Проверка наличия функции
  hasFeature(featureName: string): boolean {
    return this.configManager.isFeatureEnabled(featureName)
  }

  // Получение менеджера функции
  getFeatureManager<T extends FeatureManager>(featureName: string): T {
    const manager = this.featureManagers.get(featureName)
    if (!manager) {
      throw new Error(`Feature ${featureName} not enabled`)
    }
    return manager as T
  }

  // Обработка изменений конфигурации
  private async handleConfigChanges(changes: ConfigChange[]): Promise<void> {
    for (const change of changes) {
      switch (change.section) {
        case 'adapters':
          await this.handleAdapterConfigChange(change)
          break
        case 'features':
          await this.handleFeatureConfigChange(change)
          break
        case 'replication':
          await this.handleReplicationConfigChange(change)
          break
      }
    }
  }

  // Инициализация функций на основе конфигурации
  private async initializeFeatures(): Promise<void> {
    const features = this.configManager.config.features

    // Real-time subscriptions
    if (features.realtime?.enabled) {
      const realtimeManager = new RealtimeManager(features.realtime)
      await realtimeManager.initialize()
      this.featureManagers.set('realtime', realtimeManager)
    }

    // Offline support
    if (features.offline?.enabled) {
      const offlineManager = new OfflineManager(features.offline)
      await offlineManager.initialize()
      this.featureManagers.set('offline', offlineManager)
    }

    // Analytics
    if (features.analytics?.enabled) {
      const analyticsManager = new AnalyticsManager(features.analytics)
      await analyticsManager.initialize()
      this.featureManagers.set('analytics', analyticsManager)
    }

    // Workflow
    if (features.workflow?.enabled) {
      const workflowManager = new WorkflowManager(features.workflow)
      await workflowManager.initialize()
      this.featureManagers.set('workflow', workflowManager)
    }
  }
}
```

---

## 🔧 Конфигурационные файлы

### 1. Базовая конфигурация
```yaml
# v6/configs/basic.yaml
core:
  name: "collection-store-basic"
  version: "6.0.0"
  environment: "development"

adapters:
  file:
    enabled: true
    priority: 1
    role: "primary"
    type: "file"
    subscriptions:
      enabled: false
    config:
      directory: "./data"
      format: "json"

features:
  realtime:
    enabled: false
  offline:
    enabled: false
  analytics:
    enabled: false
```

### 2. LMS Pet Project конфигурация
```yaml
# v6/configs/lms-pet-project.yaml
core:
  name: "lms-pet-project"
  version: "6.0.0"
  environment: "development"

adapters:
  file:
    enabled: true
    priority: 1
    role: "primary"
    type: "file"
    subscriptions:
      enabled: false
    config:
      directory: "./lms-data"
      format: "json"
      collections:
        - "courses"
        - "students"
        - "assignments"
        - "grades"

security:
  authentication:
    enabled: false
  authorization:
    enabled: false

features:
  realtime:
    enabled: false
  offline:
    enabled: false
  analytics:
    enabled: false
```

### 3. LMS Enterprise конфигурация
```yaml
# v6/configs/lms-enterprise.yaml
core:
  name: "lms-enterprise"
  version: "6.0.0"
  environment: "production"
  clusterId: "lms-cluster-1"

adapters:
  mongodb:
    enabled: true
    priority: 1
    role: "primary"
    type: "mongodb"
    subscriptions:
      enabled: true
      mechanism: "changestream"
      batchSize: 100
    rateLimits:
      requestsPerSecond: 1000
      requestsPerMinute: 50000
    config:
      connectionString: "mongodb://cluster.example.com:27017/lms"
      database: "lms"
      collections:
        courses: "courses"
        students: "students"
        assignments: "assignments"
        grades: "grades"
        analytics: "analytics"

  googlesheets:
    enabled: true
    priority: 2
    role: "backup"
    type: "googlesheets"
    subscriptions:
      enabled: true
      mechanism: "polling"
      interval: 60000
    rateLimits:
      requestsPerMinute: 100
      quotaPerDay: 100000
      batchSize: 1000
    config:
      credentials:
        type: "service-account"
        serviceAccount: "./service-account.json"
      sheets:
        - id: "grades-sheet-id"
          collection: "grades"
        - id: "students-sheet-id"
          collection: "students"

  markdown:
    enabled: true
    priority: 3
    role: "readonly"
    type: "markdown"
    subscriptions:
      enabled: true
      mechanism: "filewatcher"
    config:
      directory: "./content"
      frontmatterSchema: "course-content"
      filePatterns:
        - "**/*.md"
        - "**/*.mdx"
      gitIntegration: true

replication:
  enabled: true
  strategy: "multi-source"
  conflictResolution: "priority"
  syncInterval: 5000
  batchSize: 100

security:
  authentication:
    enabled: true
    providers:
      - "local"
      - "ldap"
      - "sso"
  authorization:
    enabled: true
    rbac: true
    abac: true
  encryption:
    atRest: true
    inTransit: true
  audit:
    enabled: true
    retention: "1year"

features:
  realtime:
    enabled: true
    websockets: true
    sse: true
    crossTabSync: true

  offline:
    enabled: true
    storage: "indexeddb"
    syncStrategy: "incremental"

  analytics:
    enabled: true
    realtime: true
    aggregations: true
    reporting: true

  workflow:
    enabled: true
    engine: "built-in"
    notifications: true

client:
  browser:
    enabled: true
    partialReplication:
      enabled: true
      collections:
        - "courses"
        - "assignments"
      filters:
        userId: "${currentUser.id}"
    offline:
      enabled: true
      storage: "indexeddb"
    crossTabSync: true

performance:
  caching:
    enabled: true
    strategy: "lru"
    maxSize: "100MB"
    ttl: 300000
  indexing:
    enabled: true
    autoIndex: true
  monitoring:
    enabled: true
    metrics: true
    alerts: true
```

---

## 🚀 Использование конфигурационной архитектуры

### 1. Простое использование
```typescript
// Создание Collection Store из конфигурации
const store = new CollectionStore('./configs/lms-pet-project.yaml')
await store.initialize()

// Все адаптеры и функции настроены автоматически
const courses = await store.createCollection('courses')
const students = await store.createCollection('students')

// Проверка доступности функций
if (store.hasFeature('realtime')) {
  const realtime = store.getFeatureManager('realtime')
  await realtime.subscribe('courses', (changes) => {
    console.log('Course changes:', changes)
  })
}
```

### 2. Динамическое изменение конфигурации
```typescript
// Включение real-time функций
await store.configManager.toggleFeature('realtime', true)

// Добавление нового адаптера
await store.configManager.reloadConfig({
  adapters: {
    newAdapter: {
      enabled: true,
      type: 'mongodb',
      priority: 1,
      role: 'primary',
      config: {
        connectionString: 'mongodb://new-server:27017/db'
      }
    }
  }
})
```

### 3. Условная конфигурация
```typescript
// Конфигурация на основе окружения
const config = {
  core: {
    environment: process.env.NODE_ENV || 'development'
  },
  adapters: {
    mongodb: {
      enabled: process.env.NODE_ENV === 'production',
      config: {
        connectionString: process.env.MONGODB_URL || 'mongodb://localhost:27017/dev'
      }
    },
    file: {
      enabled: process.env.NODE_ENV !== 'production',
      config: {
        directory: process.env.DATA_DIR || './dev-data'
      }
    }
  }
}
```

---

## 🎯 Преимущества конфигурационной архитектуры

### 1. Простота использования
- Нет необходимости создавать и настраивать классы вручную
- Декларативное описание желаемого поведения
- Автоматическая настройка всех компонентов

### 2. Гибкость
- Hot reload конфигурации без перезапуска
- Feature toggles в runtime
- Условная конфигурация на основе окружения

### 3. Масштабируемость
- Легкое добавление новых адаптеров и функций
- Централизованное управление конфигурацией
- Поддержка сложных сценариев развертывания

### 4. Надежность
- Валидация конфигурации при загрузке
- Graceful handling изменений конфигурации
- Rollback при ошибках применения

---

*Конфигурационная архитектура v6.0 обеспечивает максимальную простоту использования при сохранении всей мощности Collection Store*