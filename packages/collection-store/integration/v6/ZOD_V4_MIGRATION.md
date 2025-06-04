# 🔄 Zod v4 Migration Guide для Collection Store v6.0

## Обзор миграции

Collection Store v6.0 использует Zod v4 для валидации схем конфигурации, данных и API. Этот документ описывает миграцию с предыдущих версий и использование новых возможностей.

## Новые возможности Zod v4

### 1. Улучшенная производительность
- Более быстрая валидация больших объектов
- Оптимизированная память для схем
- Lazy evaluation для сложных схем

### 2. Новые типы валидации
- `z.brand()` для branded types
- `z.readonly()` для readonly объектов
- `z.catch()` для fallback значений
- Улучшенные `z.discriminatedUnion()`

### 3. Лучшие сообщения об ошибках
- Более детальные пути к ошибкам
- Кастомизируемые сообщения
- Контекстная информация

## Структура схем в v6.0

### Базовые схемы конфигурации

```typescript
// @/src/config/schemas/BaseSchemas.ts
import { z } from 'zod'; // v4

// Базовые типы с брендингом
export const NodeId = z.string().uuid().brand('NodeId');
export const CollectionName = z.string().min(1).max(100).brand('CollectionName');
export const AdapterType = z.enum(['mongodb', 'google-sheets', 'markdown', 'file', 'memory']).brand('AdapterType');

// Временные метки с валидацией
export const Timestamp = z.number().int().positive().brand('Timestamp');
export const Duration = z.number().int().nonnegative().brand('Duration');

// Конфигурация с fallback значениями
export const RateLimitConfig = z.object({
  requestsPerSecond: z.number().int().positive().catch(100),
  requestsPerMinute: z.number().int().positive().catch(6000),
  requestsPerHour: z.number().int().positive().catch(360000),
  quotaPerDay: z.number().int().positive().catch(8640000),
  batchSize: z.number().int().positive().catch(100)
}).readonly();

// Retry policy с умолчаниями
export const RetryPolicyConfig = z.object({
  maxAttempts: z.number().int().min(1).max(10).catch(3),
  backoffMs: z.number().int().positive().catch(1000),
  backoffMultiplier: z.number().positive().catch(2),
  maxBackoffMs: z.number().int().positive().catch(30000),
  jitter: z.boolean().catch(true)
}).readonly();
```

### Схемы адаптеров с дискриминированными union

```typescript
// @/src/adapters/schemas/AdapterSchemas.ts
import { z } from 'zod'; // v4

// Базовая схема адаптера
const BaseAdapterConfig = z.object({
  enabled: z.boolean().catch(true),
  priority: z.number().int().min(1).max(10).catch(5),
  role: z.enum(['primary', 'backup', 'readonly']).catch('backup'),
  rateLimits: RateLimitConfig.optional(),
  retryPolicy: RetryPolicyConfig.optional()
});

// MongoDB конфигурация
const MongoDBAdapterConfig = BaseAdapterConfig.extend({
  type: z.literal('mongodb'),
  config: z.object({
    connectionString: z.string().url(),
    database: z.string().min(1),
    collection: z.string().min(1),
    changeStream: z.boolean().catch(true),
    oplog: z.boolean().catch(false),
    pooling: z.object({
      minPoolSize: z.number().int().min(1).catch(5),
      maxPoolSize: z.number().int().min(1).catch(50),
      maxIdleTimeMS: z.number().int().positive().catch(30000)
    }).readonly().optional()
  }).readonly()
});

// Google Sheets конфигурация
const GoogleSheetsAdapterConfig = BaseAdapterConfig.extend({
  type: z.literal('google-sheets'),
  config: z.object({
    credentials: z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      refreshToken: z.string().min(1)
    }).readonly(),
    spreadsheetId: z.string().min(1),
    sheetName: z.string().min(1).catch('Sheet1'),
    polling: z.object({
      interval: z.number().int().min(1000).catch(30000),
      enabled: z.boolean().catch(true),
      smartPolling: z.boolean().catch(true)
    }).readonly().optional(),
    batching: z.object({
      enabled: z.boolean().catch(true),
      maxBatchSize: z.number().int().min(1).max(1000).catch(100),
      batchTimeout: z.number().int().min(100).catch(5000)
    }).readonly().optional()
  }).readonly()
});

// Markdown конфигурация
const MarkdownAdapterConfig = BaseAdapterConfig.extend({
  type: z.literal('markdown'),
  config: z.object({
    directory: z.string().min(1),
    filePattern: z.string().catch('**/*.md'),
    frontmatter: z.boolean().catch(true),
    git: z.object({
      enabled: z.boolean().catch(false),
      autoCommit: z.boolean().catch(false),
      commitMessage: z.string().catch('Auto-commit from Collection Store')
    }).readonly().optional(),
    watching: z.object({
      enabled: z.boolean().catch(true),
      debounceMs: z.number().int().min(100).catch(1000),
      recursive: z.boolean().catch(true)
    }).readonly().optional()
  }).readonly()
});

// Дискриминированный union для всех адаптеров
export const AdapterConfig = z.discriminatedUnion('type', [
  MongoDBAdapterConfig,
  GoogleSheetsAdapterConfig,
  MarkdownAdapterConfig
]);

// Тип для TypeScript
export type AdapterConfig = z.infer<typeof AdapterConfig>;
```

### Схема браузерной конфигурации

```typescript
// @/src/browser/schemas/BrowserSchemas.ts
import { z } from 'zod'; // v4

// Браузерные возможности
export const BrowserCapabilities = z.object({
  indexedDB: z.boolean(),
  serviceWorker: z.boolean(),
  webRTC: z.boolean(),
  broadcastChannel: z.boolean(),
  webWorkers: z.boolean(),
  localStorage: z.boolean(),
  sessionStorage: z.boolean()
}).readonly();

// Конфигурация браузерной репликации
export const BrowserReplicationConfig = z.object({
  enabled: z.boolean().catch(true),
  autoActivateAsNode: z.boolean().catch(true),
  p2pEnabled: z.boolean().catch(true),

  // WebRTC настройки
  webrtc: z.object({
    iceServers: z.array(z.object({
      urls: z.union([z.string(), z.array(z.string())]),
      username: z.string().optional(),
      credential: z.string().optional()
    })).catch([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]),
    dataChannelConfig: z.object({
      ordered: z.boolean().catch(true),
      maxRetransmits: z.number().int().min(0).catch(3),
      maxPacketLifeTime: z.number().int().positive().optional()
    }).readonly().optional()
  }).readonly().optional(),

  // Хранение в браузере
  storage: z.object({
    primary: z.enum(['indexeddb', 'localstorage']).catch('indexeddb'),
    quota: z.string().regex(/^\d+[KMGT]?B$/).catch('50MB'),
    compression: z.boolean().catch(true),
    encryption: z.boolean().catch(false)
  }).readonly().optional(),

  // Синхронизация между табами
  crossTab: z.object({
    enabled: z.boolean().catch(true),
    channel: z.string().catch('collection-store-sync'),
    heartbeatInterval: z.number().int().min(1000).catch(30000)
  }).readonly().optional()
}).readonly();

// Конфигурация Service Worker
export const ServiceWorkerConfig = z.object({
  enabled: z.boolean().catch(true),
  scriptUrl: z.string().catch('/sw.js'),
  scope: z.string().catch('/'),
  updateViaCache: z.enum(['imports', 'all', 'none']).catch('imports'),

  // Кэширование
  caching: z.object({
    strategy: z.enum(['cache-first', 'network-first', 'stale-while-revalidate']).catch('stale-while-revalidate'),
    maxAge: z.number().int().positive().catch(86400000), // 24 hours
    maxEntries: z.number().int().positive().catch(100)
  }).readonly().optional(),

  // Offline поддержка
  offline: z.object({
    enabled: z.boolean().catch(true),
    fallbackPage: z.string().optional(),
    networkTimeout: z.number().int().positive().catch(5000)
  }).readonly().optional()
}).readonly();
```

### Главная схема конфигурации

```typescript
// @/src/config/schemas/ConfigSchema.ts
import { z } from 'zod'; // v4

export const CollectionStoreConfig = z.object({
  // Основные настройки
  core: z.object({
    name: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    environment: z.enum(['development', 'staging', 'production']).catch('development'),
    nodeId: NodeId.optional(),
    clusterId: z.string().optional()
  }).readonly(),

  // Адаптеры хранения
  adapters: z.record(z.string(), AdapterConfig).catch({}),

  // Репликация
  replication: z.object({
    enabled: z.boolean().catch(true),
    strategy: z.enum(['multi-source', 'master-slave', 'peer-to-peer']).catch('multi-source'),
    conflictResolution: z.enum(['timestamp', 'priority', 'manual', 'custom']).catch('timestamp'),
    syncInterval: Duration.catch(5000),
    batchSize: z.number().int().min(1).max(1000).catch(100),

    // Браузерная репликация
    browser: BrowserReplicationConfig.optional()
  }).readonly(),

  // Клиентские настройки
  client: z.object({
    browser: z.object({
      enabled: z.boolean().catch(true),
      build: z.object({
        target: z.array(z.string()).catch(['chrome90', 'firefox88', 'safari14']),
        format: z.enum(['esm', 'cjs', 'umd']).catch('esm'),
        minify: z.boolean().catch(true),
        sourcemap: z.boolean().catch(true)
      }).readonly().optional(),
      serviceWorker: ServiceWorkerConfig.optional()
    }).readonly().optional(),

    server: z.object({
      enabled: z.boolean().catch(true),
      port: z.number().int().min(1).max(65535).catch(3000),
      host: z.string().catch('localhost')
    }).readonly().optional()
  }).readonly(),

  // Функциональные возможности
  features: z.object({
    hotReload: z.boolean().catch(true),
    subscriptions: z.boolean().catch(true),
    browserReplication: z.boolean().catch(true),
    analytics: z.boolean().catch(false),
    monitoring: z.boolean().catch(true)
  }).readonly(),

  // Производительность
  performance: z.object({
    caching: z.object({
      enabled: z.boolean().catch(true),
      maxSize: z.string().regex(/^\d+[KMGT]?B$/).catch('100MB'),
      ttl: Duration.catch(3600000) // 1 hour
    }).readonly().optional(),

    indexing: z.object({
      enabled: z.boolean().catch(true),
      strategy: z.enum(['btree', 'hash', 'fulltext']).catch('btree')
    }).readonly().optional()
  }).readonly().optional()

}).readonly();

// Экспорт типа для TypeScript
export type CollectionStoreConfig = z.infer<typeof CollectionStoreConfig>;
```

## Заключение

Миграция на Zod v4 в Collection Store v6.0 обеспечивает:

1. **Улучшенную производительность** валидации
2. **Более точную типизацию** с branded types
3. **Лучшие сообщения об ошибках** для отладки
4. **Fallback значения** для устойчивости конфигурации
5. **Дискриминированные unions** для типобезопасности
6. **Readonly объекты** для иммутабельности
7. **Автоматическую миграцию** с предыдущих версий

Все схемы размещены в `@/src/config/schemas/` и используют современные возможности Zod v4 для максимальной типобезопасности и производительности.

---
*Response generated using Claude Sonnet 4*