# 🔧 ФАЗА 1: Configuration-Driven Foundation (6 недель)

## 🎯 Цель фазы
Создание унифицированной системы конфигурации, которая позволит управлять всей функциональностью Collection Store через YAML/JSON конфигурацию без изменения кода.

## 📅 Временные рамки
**Продолжительность**: 6 недель
**Приоритет**: КРИТИЧЕСКИЙ (блокирует все остальные фазы)

---

## 📋 Неделя 1-2: Core Configuration System

### Задачи
- [ ] **ConfigurationManager** с hot reload функциональностью
- [ ] **Unified Configuration Schema** с использованием Zod v4
- [ ] **Environment-based configuration** (dev/staging/prod)
- [ ] **Configuration validation** с детальными сообщениями об ошибках

### Файлы для реализации в `src/`
```
src/
├── config/
│   ├── ConfigurationManager.ts         # Основной менеджер конфигурации
│   ├── schemas/
│   │   ├── CollectionStoreConfig.ts    # Zod схемы конфигурации
│   │   ├── AdapterConfig.ts            # Схемы для адаптеров
│   │   └── FeatureConfig.ts            # Схемы для функций
│   ├── watchers/
│   │   ├── ConfigWatcher.ts            # Hot reload watcher
│   │   └── FileWatcher.ts              # Файловый watcher
│   └── validators/
│       ├── ConfigValidator.ts          # Валидация конфигурации
│       └── SchemaValidator.ts          # Zod валидация
```

### Технические требования
```typescript
// Основной интерфейс конфигурации
interface CollectionStoreConfig {
  core: {
    name: string
    version: string
    environment: 'development' | 'staging' | 'production'
    nodeId?: string
    clusterId?: string
  }

  adapters: {
    [adapterName: string]: AdapterConfig & {
      enabled: boolean
      priority: number
      role: 'primary' | 'backup' | 'readonly'
    }
  }

  features: {
    replication: ReplicationConfig
    realtime: RealtimeConfig
    offline: OfflineConfig
    analytics: AnalyticsConfig
  }
}
```

### Тесты (Bun)
```typescript
describe('Phase 1: Configuration System', () => {
  describe('ConfigurationManager', () => {
    beforeEach(() => {
      // Очистка конфигурации между тестами
    })

    it('should load configuration from YAML file', () => {
      // Тест загрузки из файла
    })

    it('should support hot reload', async () => {
      // Тест hot reload функциональности
    })

    it('should validate configuration with Zod', () => {
      // Тест валидации схемы
    })
  })
})
```

### Критерии успеха
- [ ] Конфигурация загружается из YAML/JSON файлов
- [ ] Hot reload работает без перезапуска приложения
- [ ] Валидация показывает понятные ошибки
- [ ] Environment-specific конфигурации работают корректно

---

## 📋 Неделя 3-4: Database & Collection Configuration

### Задачи
- [ ] **Database-level configuration** с наследованием для коллекций
- [ ] **Node role hierarchy** (PRIMARY, SECONDARY, CLIENT, BROWSER, ADAPTER)
- [ ] **Cross-database transactions** в едином пространстве данных
- [ ] **Browser quota management** с автоматическими fallback стратегиями

### Файлы для реализации в `src/`
```
src/
├── config/
│   ├── database/
│   │   ├── DatabaseConfig.ts           # Конфигурация БД
│   │   ├── CollectionConfig.ts         # Конфигурация коллекций
│   │   └── NodeRoleManager.ts          # Управление ролями узлов
│   ├── nodes/
│   │   ├── NodeConfig.ts               # Конфигурация узлов
│   │   ├── BrowserNodeConfig.ts        # Специфика браузерных узлов
│   │   └── QuotaManager.ts             # Управление квотами
│   └── transactions/
│       ├── CrossDatabaseConfig.ts      # Кросс-БД транзакции
│       └── TransactionManager.ts       # Менеджер транзакций
```

### Технические требования
```typescript
// Конфигурация базы данных
interface DatabaseConfig {
  name: string
  collections: CollectionConfig[]
  replication: DatabaseReplicationConfig
  transactions: TransactionConfig
  subscriptions: SubscriptionConfig
}

// Роли узлов
enum NodeRole {
  PRIMARY = 'primary',     // Авторитетные источники данных
  SECONDARY = 'secondary', // Реплицированные данные
  CLIENT = 'client',       // Потребители, не авторитетные
  BROWSER = 'browser',     // Специальные клиентские узлы
  ADAPTER = 'adapter'      // Мосты к внешним системам
}

// Управление квотами браузера
interface BrowserQuotaConfig {
  indexedDBLimit: number
  localStorageLimit: number
  fallbackStrategies: {
    'cache-mode': QuotaCacheStrategy
    'subscription-mode': QuotaSubscriptionStrategy
    'offline-mode': QuotaOfflineStrategy
  }
}
```

### Тесты (Bun)
```typescript
describe('Phase 1: Database & Collection Configuration', () => {
  describe('DatabaseConfig', () => {
    it('should inherit collection settings from database', () => {
      // Тест наследования настроек
    })

    it('should support collection-specific overrides', () => {
      // Тест переопределения настроек коллекций
    })
  })

  describe('NodeRoleManager', () => {
    it('should enforce role-based restrictions', () => {
      // Тест ограничений по ролям
    })

    it('should handle browser node limitations', () => {
      // Тест ограничений браузерных узлов
    })
  })

  describe('QuotaManager', () => {
    it('should detect quota exceeded', async () => {
      // Тест обнаружения превышения квот
    })

    it('should switch to fallback mode', async () => {
      // Тест переключения в fallback режим
    })
  })
})
```

### Критерии успеха
- [ ] База данных и коллекции используют одни и те же инструменты
- [ ] Клиенты автоматически работают как вторичные источники
- [ ] Браузерные узлы ограничены без специальных адаптеров
- [ ] Cross-database операции работают в едином пространстве данных

---

## 📋 Неделя 5-6: Adapter Factory & Feature System

### Задачи
- [ ] **AdapterFactory** с registration system для динамической регистрации
- [ ] **Feature toggles** и dynamic configuration changes
- [ ] **Read-only collections** (только для внешних источников)
- [ ] **Conflict resolution strategies** для всех типов узлов

### Файлы для реализации в `src/`
```
src/
├── adapters/
│   ├── AdapterFactory.ts               # Фабрика адаптеров
│   ├── AdapterRegistry.ts              # Реестр адаптеров
│   └── base/
│       ├── BaseAdapter.ts              # Базовый класс адаптера
│       └── ReadOnlyAdapter.ts          # Read-only адаптер
├── features/
│   ├── FeatureManager.ts               # Менеджер функций
│   ├── FeatureToggle.ts                # Feature toggles
│   └── DynamicConfiguration.ts         # Динамическая конфигурация
├── collections/
│   ├── ReadOnlyCollection.ts           # Read-only коллекции
│   └── CollectionFactory.ts            # Фабрика коллекций
└── conflicts/
    ├── ConflictResolver.ts             # Разрешение конфликтов
    ├── strategies/
    │   ├── TimestampStrategy.ts        # По времени
    │   ├── PriorityStrategy.ts         # По приоритету
    │   └── NodeTypeStrategy.ts         # По типу узла
    └── NodeConflictManager.ts          # Управление конфликтами узлов
```

### Технические требования
```typescript
// Фабрика адаптеров
class AdapterFactory {
  private static adapters: Map<string, AdapterConstructor> = new Map()

  static register(type: string, constructor: AdapterConstructor): void

  async createAdapter<T extends Item>(
    adapterName: string,
    collection: Collection<T>
  ): Promise<IExternalStorageAdapter<T>>
}

// Read-only коллекции
class ReadOnlyCollection extends Collection {
  async insert(document: any): Promise<never> {
    throw new Error('Insert operations not allowed on read-only collections')
  }

  async updateFromExternalSource(data: any[]): Promise<void> {
    // Единственный способ обновления read-only коллекций
  }
}

// Feature toggles
interface FeatureToggleConfig {
  enabled: boolean
  rolloutPercentage?: number
  conditions?: FeatureCondition[]
}
```

### Тесты (Bun)
```typescript
describe('Phase 1: Adapter Factory & Features', () => {
  describe('AdapterFactory', () => {
    beforeEach(() => {
      // Очистка реестра адаптеров
    })

    it('should register and create adapters', async () => {
      // Тест регистрации и создания адаптеров
    })

    it('should handle adapter configuration', async () => {
      // Тест конфигурации адаптеров
    })
  })

  describe('ReadOnlyCollection', () => {
    it('should prevent write operations', async () => {
      // Тест блокировки операций записи
    })

    it('should allow external updates', async () => {
      // Тест обновлений от внешних источников
    })
  })

  describe('FeatureToggle', () => {
    it('should toggle features dynamically', async () => {
      // Тест динамического переключения функций
    })

    it('should support rollout percentage', () => {
      // Тест постепенного развертывания
    })
  })
})
```

### Критерии успеха
- [ ] Адаптеры регистрируются и создаются динамически
- [ ] Read-only коллекции защищены от операций записи
- [ ] Feature toggles работают в runtime
- [ ] Conflict resolution работает для всех типов узлов

---

## 🎯 Общие критерии успеха Фазы 1

### Функциональные критерии
- [ ] **Вся функциональность доступна через YAML/JSON конфигурацию**
- [ ] **Hot reload конфигурации без перезапуска приложения**
- [ ] **Валидация конфигурации с детальными ошибками**
- [ ] **База данных и коллекции используют одни и те же инструменты**
- [ ] **Клиенты автоматически работают как вторичные источники**
- [ ] **Браузерные узлы ограничены без специальных адаптеров**

### Технические критерии
- [ ] **Все тесты проходят с использованием Bun**
- [ ] **Test coverage >= 90% для новой функциональности**
- [ ] **Performance.now() используется для всех измерений времени**
- [ ] **Collision-resistant ID generation реализован**
- [ ] **Proper test cleanup между тестами**

### Интеграционные критерии
- [ ] **Существующие 1985 тестов продолжают проходить**
- [ ] **Новая конфигурационная система интегрирована с существующим кодом**
- [ ] **Backward compatibility сохранена для существующих API**

---

## 📝 Примеры конфигураций

### Базовая конфигурация
```yaml
# examples/configurations/basic.yaml
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
    config:
      directory: "./data"
      format: "json"

features:
  replication:
    enabled: false
  realtime:
    enabled: false
```

### Enterprise конфигурация
```yaml
# examples/configurations/enterprise.yaml
core:
  name: "collection-store-enterprise"
  version: "6.0.0"
  environment: "production"

adapters:
  mongodb:
    enabled: true
    priority: 1
    role: "primary"
    type: "mongodb"
    config:
      connectionString: "mongodb://cluster:27017/db"

  googlesheets:
    enabled: true
    priority: 2
    role: "backup"
    type: "googlesheets"
    config:
      credentials: "./service-account.json"

features:
  replication:
    enabled: true
    strategy: "multi-source"
  realtime:
    enabled: true
    websockets: true
```

---

## 🔄 Интеграция с существующим кодом

### Миграционная стратегия
1. **Создать новые компоненты** в `src/config/` без изменения существующих
2. **Добавить configuration layer** поверх существующих классов
3. **Постепенно мигрировать** существующую функциональность
4. **Сохранить backward compatibility** для существующих API

### Точки интеграции
- **CollectionStore** - добавить конфигурационный конструктор
- **Collection** - добавить поддержку конфигурационного создания
- **Adapters** - интегрировать с AdapterFactory
- **Replication** - добавить конфигурационное управление

---

*Фаза 1 создает фундамент для всех последующих фаз разработки v6.0*