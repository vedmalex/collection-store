# Collection Store v6.0 - План разработки

## Обзор

Collection Store v6.0 представляет собой эволюцию от pet-проекта к enterprise-решению с конфигурационно-управляемой архитектурой и внешними адаптерами хранения.

## Ключевые изменения в архитектуре

### Размещение проекта
- **Основная реализация**: `@/src` - продолжение монолитного приложения
- **Документация**: `implementation/v6/` - все документы по фазам разработки
- **Интеграция**: Полная совместимость с существующей кодовой базой

### Конфигурационно-управляемая архитектура
- Вся функциональность доступна через конфигурацию
- Отсутствие необходимости создания отдельных экземпляров классов
- Горячая перезагрузка конфигурации
- Единая точка управления всеми адаптерами

### Внешние адаптеры хранения (по приоритету)
1. **MongoDB Adapter** - Change Streams, Oplog, пулинг соединений
2. **Google Sheets Adapter** - API лимиты (100 req/min), batch операции
3. **Markdown Adapter** - File watching, Git интеграция, frontmatter

### Браузерная версия как нода репликации
- **Полноценный участник репликации**: Браузерные клиенты могут выступать как равноправные ноды
- **Условная активация**: Если не сконфигурированы подписки, браузер автоматически становится нодой репликации
- **P2P синхронизация**: WebRTC для прямого обмена данными между браузерами
- **Offline-first**: Полная функциональность без подключения к серверу

### Технологические обновления
- **Zod v4**: Обновление схем валидации до последней версии
- **Modern Browser APIs**: Service Workers, IndexedDB, WebRTC
- **ESM модули**: Нативная поддержка ES модулей

## Фазы разработки (22 недели)

### Фаза 1: Конфигурационная архитектура (Недели 1-6)
**Цель**: Создание единой системы конфигурации

**Основные компоненты**:
- `@/src/config/ConfigurationManager.ts` - Центральный менеджер конфигурации
- `@/src/adapters/AdapterFactory.ts` - Фабрика адаптеров
- `@/src/config/schemas/` - Zod v4 схемы конфигурации
- `@/src/config/hot-reload/` - Система горячей перезагрузки

**Deliverables**:
- Unified Configuration Schema (YAML/JSON)
- Hot reload система
- Feature toggles
- Базовая документация в `implementation/v6/phase1/`

### Фаза 2: Внешние адаптеры (Недели 7-12)
**Цель**: Реализация адаптеров для внешних источников данных

**MongoDB Adapter** (`@/src/adapters/mongodb/`):
- Change Streams интеграция
- Connection pooling
- Rate limiting (настраиваемый)
- Subscription механизмы

**Google Sheets Adapter** (`@/src/adapters/google-sheets/`):
- API limits handling (100 req/min, 100K requests/day)
- Batch operations
- Smart polling с экспоненциальным backoff
- OAuth2 аутентификация

**Markdown Adapter** (`@/src/adapters/markdown/`):
- File watching с chokidar
- Git hooks интеграция
- Frontmatter validation с Zod v4
- Markdown parsing и serialization

### Фаза 3: Браузерная версия и репликация (Недели 13-18)
**Цель**: Полноценная браузерная версия с возможностью репликации

**Браузерная реализация** (`@/src/browser/`):
- ESBuild конфигурация для браузера
- IndexedDB storage adapter
- Service Worker для offline режима
- WebRTC для P2P репликации

**Репликационная логика** (`@/src/replication/browser/`):
- Автоматическое определение роли (клиент/нода)
- Conflict resolution для браузерных нод
- Cross-tab синхронизация
- Partial replication для оптимизации

**Условная активация репликации**:
```typescript
// @/src/replication/ReplicationManager.ts
if (!hasConfiguredSubscriptions() && isBrowserEnvironment()) {
  activateBrowserReplicationNode();
}
```

### Фаза 4: LMS Demo Evolution (Недели 19-22)
**Цель**: Демонстрация эволюции от pet-проекта к enterprise

**Стадии эволюции** (`@/src/demo/lms-evolution/`):
1. **Pet Project**: Файловое хранение, один преподаватель
2. **Small Team**: Google Sheets, несколько преподавателей
3. **Department**: MongoDB, RBAC, Markdown CMS
4. **Enterprise**: Multi-tenant, аналитика, внешние интеграции

## Технические спецификации

### Конфигурационная схема (Zod v4)
```typescript
// @/src/config/schemas/ConfigSchema.ts
import { z } from 'zod'; // v4

const ConfigSchema = z.object({
  adapters: z.object({
    primary: z.enum(['mongodb', 'google-sheets', 'markdown', 'file']),
    replication: z.array(z.enum(['mongodb', 'google-sheets', 'markdown'])),
    browser: z.object({
      enableReplication: z.boolean().default(true),
      autoActivateAsNode: z.boolean().default(true),
      p2pEnabled: z.boolean().default(true)
    })
  }),
  features: z.object({
    hotReload: z.boolean().default(true),
    subscriptions: z.boolean().default(true),
    browserReplication: z.boolean().default(true)
  })
});
```

### Браузерная репликация
```typescript
// @/src/replication/browser/BrowserReplicationNode.ts
export class BrowserReplicationNode implements ReplicationNode {
  private webrtcManager: WebRTCManager;
  private indexedDBAdapter: IndexedDBAdapter;

  async initialize() {
    if (!this.hasConfiguredSubscriptions()) {
      await this.activateAsReplicationNode();
    }
  }

  private hasConfiguredSubscriptions(): boolean {
    return this.config.subscriptions?.length > 0;
  }
}
```

### Структура проекта
```
@/src/
├── config/
│   ├── ConfigurationManager.ts
│   ├── schemas/ (Zod v4)
│   └── hot-reload/
├── adapters/
│   ├── mongodb/
│   ├── google-sheets/
│   ├── markdown/
│   └── AdapterFactory.ts
├── browser/
│   ├── BrowserCollectionStore.ts
│   ├── IndexedDBAdapter.ts
│   └── ServiceWorkerManager.ts
├── replication/
│   ├── browser/
│   ├── ReplicationManager.ts
│   └── ConflictResolver.ts
└── demo/
    └── lms-evolution/

implementation/v6/
├── phase1/
├── phase2/
├── phase3/
├── phase4/
├── architecture/
├── api-docs/
└── migration-guides/
```

## Критерии успеха

### Техническая производительность
- **Конфигурация**: 100% функциональности через конфигурацию
- **Rate Limits**: Соблюдение всех API лимитов (Google Sheets: 100 req/min)
- **Браузерная производительность**: <100KB bundle, <1s загрузка
- **Репликация**: <500ms синхронизация между нодами

### Функциональные требования
- **Горячая перезагрузка**: Изменения конфигурации без перезапуска
- **Offline-first**: Полная функциональность в браузере без сервера
- **P2P репликация**: Прямая синхронизация между браузерами
- **Автоматическая активация**: Браузер как нода при отсутствии подписок

### Совместимость
- **Обратная совместимость**: 100% с существующим API
- **Zod v4**: Полная миграция схем валидации
- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+

## Риски и митигация

### Технические риски
1. **Производительность браузерной репликации**
   - Митигация: Partial replication, lazy loading
2. **Сложность P2P синхронизации**
   - Митигация: Поэтапная реализация, fallback на server-side
3. **API лимиты внешних сервисов**
   - Митигация: Intelligent batching, exponential backoff

### Проектные риски
1. **Сложность конфигурационной системы**
   - Митигация: Пошаговая миграция, обширное тестирование
2. **Интеграция с существующим кодом**
   - Митигация: Adapter pattern, постепенная миграция

## Заключение

Collection Store v6.0 представляет собой значительную эволюцию архитектуры с фокусом на:
- **Конфигурационное управление** всей функциональностью
- **Браузерную репликацию** как равноправного участника
- **Внешние адаптеры** для интеграции с популярными сервисами
- **Современные технологии** (Zod v4, WebRTC, Service Workers)

Проект сохраняет полную обратную совместимость при добавлении мощных новых возможностей для enterprise-использования.

---
*Response generated using Claude Sonnet 4*