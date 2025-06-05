# 🔌 ФАЗА 2: External Adapters & Integration (6 недель)

## 🎯 Цель фазы
Реализация адаптеров для внешних источников данных с интеграцией через существующую систему репликации и полным аудитом всех операций.

## 📅 Временные рамки
**Продолжительность**: 6 недель
**Приоритет**: ВЫСОКИЙ (зависит от Фазы 1)
**Зависимости**: Configuration-Driven Architecture (Фаза 1)

---

## 📋 Неделя 7-8: MongoDB & Google Sheets Adapters

### Задачи
- [ ] **MongoDB Adapter** с Change Streams и Oplog monitoring
- [ ] **Google Sheets Adapter** с rate limiting и quota management
- [ ] **Subscription-based updates** через существующие механизмы репликации
- [ ] **Audit logging** для всех внешних обновлений с репликацией

### Файлы для реализации в `src/`
```
src/
├── adapters/
│   ├── external/
│   │   ├── mongodb/
│   │   │   ├── MongoDBAdapter.ts           # Основной MongoDB адаптер
│   │   │   ├── ChangeStreamWatcher.ts      # Change Streams мониторинг
│   │   │   ├── OplogWatcher.ts             # Oplog мониторинг
│   │   │   ├── ConnectionPool.ts           # Пул соединений
│   │   │   └── RateLimiter.ts              # Rate limiting
│   │   ├── googlesheets/
│   │   │   ├── GoogleSheetsAdapter.ts      # Основной Sheets адаптер
│   │   │   ├── BatchOperationManager.ts    # Batch операции
│   │   │   ├── QuotaManager.ts             # Управление квотами
│   │   │   ├── WebhookManager.ts           # Webhook интеграция
│   │   │   └── PollingManager.ts           # Smart polling
│   │   └── base/
│   │       ├── ExternalAdapter.ts          # Базовый внешний адаптер
│   │       ├── SubscriptionManager.ts      # Управление подписками
│   │       └── AuditLogger.ts              # Аудит операций
│   └── coordination/
│       ├── AdapterCoordinator.ts           # Координация адаптеров
│       ├── ReplicationIntegration.ts       # Интеграция с репликацией
│       └── ConflictDetector.ts             # Обнаружение конфликтов
```

### Технические требования

#### MongoDB Adapter
```typescript
interface MongoDBAdapterConfig extends ExternalAdapterConfig {
  type: 'mongodb'
  connection: {
    connectionString: string
    database: string
    collections: Record<string, string>
  }
  subscriptions: {
    enabled: boolean
    mechanism: 'changestream' | 'oplog'
    batchSize: number
  }
  rateLimits: {
    requestsPerSecond: number
    connectionPoolSize: number
  }
}

class MongoDBAdapter extends ExternalAdapter {
  private changeStreamWatcher: ChangeStreamWatcher
  private connectionPool: ConnectionPool

  async initialize(): Promise<void> {
    await this.setupConnectionPool()
    await this.setupChangeStreams()
    await this.integrateWithReplication()
  }

  async setupChangeStreams(): Promise<void> {
    // Настройка Change Streams для real-time обновлений
  }
}
```

#### Google Sheets Adapter
```typescript
interface GoogleSheetsAdapterConfig extends ExternalAdapterConfig {
  type: 'googlesheets'
  connection: {
    credentials: GoogleCredentials
    sheets: SheetMapping[]
  }
  rateLimits: {
    requestsPerMinute: 100
    requestsPerDay: 100000
    batchSize: 1000
  }
  polling: {
    interval: number
    changeDetection: 'hash' | 'timestamp' | 'revision'
  }
}

class GoogleSheetsAdapter extends ExternalAdapter {
  private quotaManager: QuotaManager
  private batchManager: BatchOperationManager

  async fetchData(): Promise<any[]> {
    // Batch операции с учетом квот
    return this.batchManager.executeBatch(operations)
  }

  async setupPolling(): Promise<void> {
    // Smart polling с change detection
  }
}
```

### Тесты (Bun)
```typescript
describe('Phase 2: MongoDB & Google Sheets Adapters', () => {
  describe('MongoDBAdapter', () => {
    beforeEach(async () => {
      // Setup test MongoDB instance
      await setupTestMongoDB()
    })

    afterEach(async () => {
      // Cleanup test data
      await cleanupTestMongoDB()
    })

    it('should connect to MongoDB and setup change streams', async () => {
      // Тест подключения и настройки Change Streams
    })

    it('should handle connection failures with retry', async () => {
      // Тест обработки ошибок подключения
    })

    it('should integrate with replication system', async () => {
      // Тест интеграции с системой репликации
    })
  })

  describe('GoogleSheetsAdapter', () => {
    beforeEach(() => {
      // Mock Google Sheets API
      mock.module('@google-cloud/sheets', () => mockSheetsAPI)
    })

    it('should handle rate limits gracefully', async () => {
      // Тест обработки rate limits
    })

    it('should batch operations efficiently', async () => {
      // Тест batch операций
    })

    it('should detect changes via polling', async () => {
      // Тест обнаружения изменений
    })
  })
})
```

### Критерии успеха
- [ ] MongoDB Change Streams работают в real-time
- [ ] Google Sheets rate limits соблюдаются автоматически
- [ ] Все внешние обновления логируются и реплицируются
- [ ] Интеграция с существующей системой репликации работает

---

## 📋 Неделя 9-10: Markdown & Messenger Adapters

### Задачи
- [ ] **Markdown Adapter** с Git integration и file watching
- [ ] **Telegram Adapter** с file handling и backup mode
- [ ] **Discord/Teams/WhatsApp** базовая поддержка
- [ ] **File processing** с thumbnails, metadata extraction

### Файлы для реализации в `src/`
```
src/
├── adapters/
│   ├── external/
│   │   ├── markdown/
│   │   │   ├── MarkdownAdapter.ts          # Основной Markdown адаптер
│   │   │   ├── GitWatcher.ts               # Git integration
│   │   │   ├── FileWatcher.ts              # File system watching
│   │   │   ├── FrontmatterValidator.ts     # Frontmatter валидация
│   │   │   └── ContentProcessor.ts         # Обработка контента
│   │   ├── messengers/
│   │   │   ├── telegram/
│   │   │   │   ├── TelegramAdapter.ts      # Telegram интеграция
│   │   │   │   ├── FileHandler.ts          # Обработка файлов
│   │   │   │   └── BackupManager.ts        # Backup режим
│   │   │   ├── discord/
│   │   │   │   └── DiscordAdapter.ts       # Discord интеграция
│   │   │   ├── teams/
│   │   │   │   └── TeamsAdapter.ts         # Teams интеграция
│   │   │   └── whatsapp/
│   │   │       └── WhatsAppAdapter.ts      # WhatsApp интеграция
│   │   └── files/
│   │       ├── FileProcessor.ts            # Обработка файлов
│   │       ├── ThumbnailGenerator.ts       # Генерация превью
│   │       ├── MetadataExtractor.ts        # Извлечение метаданных
│   │       └── StorageManager.ts           # Управление хранением
```

### Технические требования

#### Markdown Adapter
```typescript
interface MarkdownAdapterConfig extends ExternalAdapterConfig {
  type: 'markdown'
  connection: {
    directory: string
    filePatterns: string[]
    gitIntegration: boolean
  }
  processing: {
    frontmatterSchema: string
    contentValidation: boolean
    autoIndex: boolean
  }
  watching: {
    enabled: boolean
    debounceMs: number
    gitHooks: boolean
  }
}

class MarkdownAdapter extends ExternalAdapter {
  private gitWatcher: GitWatcher
  private fileWatcher: FileWatcher

  async initialize(): Promise<void> {
    await this.setupFileWatching()
    await this.setupGitIntegration()
    await this.processExistingFiles()
  }
}
```

#### Telegram Adapter
```typescript
interface TelegramAdapterConfig extends ExternalAdapterConfig {
  type: 'telegram'
  connection: {
    apiId: number
    apiHash: string
    session?: string
    targets: TelegramTarget[]
  }
  fileHandling: {
    enabled: boolean
    storage: FileStorageConfig
    processing: FileProcessingConfig
  }
  backupMode: {
    enabled: boolean
    retention: RetentionConfig
  }
}

class TelegramAdapter extends ExternalAdapter {
  private fileHandler: MessengerFileHandler
  private backupManager: BackupManager

  async processMessageWithFiles(message: any): Promise<ProcessedMessage> {
    return this.fileHandler.processMessageWithFiles(message, this.source)
  }
}
```

### Тесты (Bun)
```typescript
describe('Phase 2: Markdown & Messenger Adapters', () => {
  describe('MarkdownAdapter', () => {
    beforeEach(async () => {
      // Setup test markdown files
      await setupTestMarkdownFiles()
    })

    it('should watch file changes', async () => {
      // Тест file watching
    })

    it('should validate frontmatter', () => {
      // Тест валидации frontmatter
    })

    it('should integrate with Git', async () => {
      // Тест Git интеграции
    })
  })

  describe('TelegramAdapter', () => {
    beforeEach(() => {
      // Mock Telegram API
      mock.module('telegram', () => mockTelegramAPI)
    })

    it('should process messages with files', async () => {
      // Тест обработки сообщений с файлами
    })

    it('should handle file downloads', async () => {
      // Тест загрузки файлов
    })

    it('should backup deleted content', async () => {
      // Тест backup режима
    })
  })
})
```

### Критерии успеха
- [ ] Markdown файлы отслеживаются в real-time
- [ ] Git интеграция работает с hooks
- [ ] Telegram файлы обрабатываются и сохраняются
- [ ] Backup режим сохраняет удаленный контент

---

## 📋 Неделя 11-12: Gateway Collections & Coordination

### Задачи
- [ ] **Gateway Collections** (read-only source → writable target)
- [ ] **Multi-source coordination** через существующую репликацию
- [ ] **Flexible schema validation** с auto-recovery
- [ ] **Collection conflict resolution** с изоляцией коллекций

### Файлы для реализации в `src/`
```
src/
├── collections/
│   ├── gateway/
│   │   ├── GatewayCollection.ts            # Gateway коллекции
│   │   ├── MultiSourceGateway.ts           # Multi-source gateway
│   │   ├── GatewayProcessor.ts             # Обработка данных
│   │   └── RoutingManager.ts               # Маршрутизация данных
│   └── validation/
│       ├── FlexibleValidator.ts            # Гибкая валидация
│       ├── SchemaRecovery.ts               # Восстановление схем
│       └── TypeCoercion.ts                 # Приведение типов
├── conflicts/
│   ├── collection/
│   │   ├── CollectionConflictManager.ts    # Управление конфликтами
│   │   ├── ConflictDetector.ts             # Обнаружение конфликтов
│   │   ├── IsolationManager.ts             # Изоляция коллекций
│   │   └── ResolutionStrategies.ts         # Стратегии разрешения
│   └── coordination/
│       ├── SourceCoordinator.ts            # Координация источников
│       ├── PriorityManager.ts              # Управление приоритетами
│       └── MergeStrategies.ts              # Стратегии слияния
```

### Технические требования

#### Gateway Collections
```typescript
interface GatewayCollectionConfig extends CollectionConfig {
  type: 'gateway'
  source: {
    type: 'read-only'
    adapter: ExternalAdapterConfig
  }
  target: {
    type: 'regular' | 'external-adapter'
    config: CollectionConfig | ExternalAdapterConfig
  }
  processing: GatewayProcessingConfig
}

class GatewayCollection extends Collection {
  private sourceAdapter: ExternalAdapter
  private targetCollection: Collection
  private processor: GatewayProcessor

  async startGatewayProcessing(): Promise<void> {
    await this.sourceAdapter.subscribe('data-change', async (data) => {
      await this.processAndForward(data)
    })
  }

  private async processAndForward(sourceData: any[]): Promise<void> {
    let processedData = sourceData

    if (this.config.processing.transformation?.enabled) {
      processedData = await this.processor.transform(processedData)
    }

    if (this.config.processing.filtering?.enabled) {
      processedData = await this.processor.filter(processedData)
    }

    await this.targetCollection.insertMany(processedData)
  }
}
```

#### Collection Conflict Resolution
```typescript
interface CollectionConflict {
  collectionName: string
  database: string
  existingCollections: CollectionDefinition[]
  newCollection: NodeCollectionDefinition
  conflictType: ConflictType
  detectedAt: number
}

class CollectionConflictManager {
  async detectCollectionConflict(
    database: string,
    collectionName: string,
    newCollectionDef: NodeCollectionDefinition
  ): Promise<CollectionConflict | null> {
    // Обнаружение конфликтов имен коллекций
  }

  async resolveCollectionConflict(
    conflict: CollectionConflict
  ): Promise<ConflictResolution> {
    // Разрешение конфликтов с изоляцией
  }

  private async isolateCollectionFromSync(
    collection: CollectionDefinition
  ): Promise<void> {
    // Изоляция коллекции от синхронизации
  }
}
```

### Тесты (Bun)
```typescript
describe('Phase 2: Gateway Collections & Coordination', () => {
  describe('GatewayCollection', () => {
    beforeEach(async () => {
      // Setup gateway test environment
      await setupGatewayTestEnv()
    })

    it('should process data from source to target', async () => {
      // Тест обработки данных
    })

    it('should handle transformation and filtering', async () => {
      // Тест трансформации и фильтрации
    })
  })

  describe('CollectionConflictManager', () => {
    it('should detect collection name conflicts', async () => {
      // Тест обнаружения конфликтов
    })

    it('should isolate conflicting collections', async () => {
      // Тест изоляции конфликтующих коллекций
    })

    it('should resolve conflicts by priority', async () => {
      // Тест разрешения по приоритету
    })
  })

  describe('FlexibleValidator', () => {
    it('should recover from validation errors', async () => {
      // Тест восстановления от ошибок валидации
    })

    it('should coerce types automatically', () => {
      // Тест автоматического приведения типов
    })
  })
})
```

### Критерии успеха
- [ ] Gateway коллекции обрабатывают данные из read-only источников
- [ ] Multi-source координация работает через репликацию
- [ ] Конфликты коллекций разрешаются автоматически
- [ ] Flexible validation восстанавливается от ошибок

---

## 🎯 Общие критерии успеха Фазы 2

### Функциональные критерии
- [ ] **Все адаптеры интегрированы через существующую систему репликации**
- [ ] **Полный аудит всех внешних обновлений с репликацией**
- [ ] **Read-only коллекции участвуют во всех операциях как полноправные**
- [ ] **Автоматическое разрешение конфликтов коллекций с изоляцией**

### Технические критерии
- [ ] **MongoDB Change Streams работают в real-time**
- [ ] **Google Sheets rate limits соблюдаются автоматически**
- [ ] **Messenger файлы обрабатываются с metadata extraction**
- [ ] **Gateway коллекции обеспечивают data flow между источниками**

### Интеграционные критерии
- [ ] **Координация внешних адаптеров через существующую репликацию**
- [ ] **Flexible schema validation с auto-recovery**
- [ ] **Collection conflict resolution с приоритетами**
- [ ] **Backup режим для messenger источников**

---

## 📝 Примеры конфигураций

### MongoDB + Google Sheets
```yaml
# examples/configurations/mongodb-sheets.yaml
adapters:
  mongodb_primary:
    enabled: true
    priority: 1
    role: "primary"
    type: "mongodb"
    subscriptions:
      enabled: true
      mechanism: "changestream"
    config:
      connectionString: "mongodb://localhost:27017/lms"
      collections:
        students: "students"
        courses: "courses"

  sheets_backup:
    enabled: true
    priority: 2
    role: "backup"
    type: "googlesheets"
    subscriptions:
      enabled: true
      mechanism: "polling"
      interval: 60000
    config:
      credentials: "./service-account.json"
      sheets:
        - id: "students-sheet-id"
          collection: "students"
```

### Gateway Collection
```yaml
# examples/configurations/gateway.yaml
collections:
  telegram_to_crm:
    type: "gateway"
    source:
      type: "read-only"
      adapter:
        type: "telegram"
        connection:
          targets:
            - type: "channel"
              identifier: "@support_channel"
    target:
      type: "external-adapter"
      config:
        type: "googlesheets"
        config:
          sheets:
            - id: "crm-sheet-id"
              collection: "support_requests"
    processing:
      transformation:
        enabled: true
        transformFunction: "telegramToCrmTransform"
      filtering:
        enabled: true
        filterFunction: "filterSupportMessages"
```

---

## 🔄 Интеграция с Фазой 1

### Использование Configuration System
- **Все адаптеры** регистрируются через AdapterFactory
- **Конфигурация адаптеров** валидируется через ConfigurationManager
- **Feature toggles** управляют включением/выключением адаптеров
- **Hot reload** позволяет изменять настройки адаптеров без перезапуска

### Интеграция с существующей репликацией
- **External adapters** используют существующие механизмы репликации
- **Audit logging** интегрируется с существующей системой логирования
- **Conflict resolution** расширяет существующие стратегии
- **Subscription system** переиспользует существующую инфраструктуру

---

*Фаза 2 обеспечивает интеграцию с внешними источниками данных через унифицированную архитектуру*