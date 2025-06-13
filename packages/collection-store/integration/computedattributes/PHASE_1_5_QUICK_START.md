# 🚀 Phase 1.5 Quick Start Guide - Computed Attributes System

## ⚡ Быстрый старт (5 минут)

### **Статус:** ✅ ГОТОВ К СТАРТУ
### **Цель:** Создать систему вычисляемых атрибутов для схем и авторизации

---

## 🎯 Что мы реализуем

**Computed Attributes System** - система вычисляемых атрибутов, которая позволяет:
- Вычислять атрибуты на основе данных коллекции/БД
- Делать внешние API запросы в контексте вычислений
- Кэшировать результаты с автоматической инвалидацией
- Использовать в правилах авторизации для динамических разрешений

---

## 📋 Готовность к старту

### ✅ **Все готово:**
- **Phase 1 завершена** (120/120 тестов проходят)
- **Auth система работает** (UserManager, TokenManager, RoleManager, etc.)
- **CSDatabase интеграция готова**
- **TypeScript strict mode включен**
- **Тестовая инфраструктура настроена**

### 🎯 **Первые шаги:**
1. Создать структуру `src/auth/computed/`
2. Реализовать базовые интерфейсы
3. Создать ComputedAttributeEngine
4. Настроить кэширование
5. Интегрировать с авторизацией

---

## 📁 Структура для создания

```
src/auth/computed/
├── interfaces/
│   ├── IComputedAttributeEngine.ts    # Основной интерфейс
│   ├── IComputedAttributeCache.ts     # Интерфейс кэширования
│   └── index.ts
├── types/
│   ├── ComputedAttributeTypes.ts      # Основные типы
│   ├── CacheTypes.ts                  # Типы кэширования
│   ├── ContextTypes.ts                # Типы контекста
│   └── index.ts
├── core/
│   ├── ComputedAttributeEngine.ts     # Основная реализация
│   ├── AttributeRegistry.ts           # Реестр атрибутов
│   ├── ComputationExecutor.ts         # Выполнение вычислений
│   └── SecurityValidator.ts           # Валидация безопасности
├── cache/
│   ├── ComputedAttributeCache.ts      # Основной кэш
│   ├── CacheInvalidator.ts            # Система инвалидации
│   ├── DependencyTracker.ts           # Отслеживание зависимостей
│   └── CacheStatistics.ts             # Статистика кэша
├── schema/
│   ├── SchemaExtensions.ts            # Расширения схем
│   ├── AttributeValidator.ts          # Валидация атрибутов
│   ├── SchemaIntegration.ts           # Интеграция с коллекциями
│   └── BuiltInAttributes.ts           # Встроенные атрибуты
├── authorization/
│   ├── AuthorizationIntegration.ts    # Интеграция с auth
│   ├── ComputedAttributeRules.ts      # Правила на основе атрибутов
│   ├── DynamicPermissions.ts          # Динамические разрешения
│   └── PermissionEvaluator.ts         # Оценка разрешений
├── external/
│   ├── HttpClient.ts                  # HTTP клиент
│   ├── SecuritySandbox.ts             # Песочница безопасности
│   ├── RateLimiter.ts                 # Ограничение запросов
│   └── ExternalServiceManager.ts      # Управление внешними сервисами
├── utils/
│   └── index.ts                       # Утилиты
├── tests/
│   ├── ComputedAttributeEngine.test.ts
│   ├── CacheSystem.test.ts
│   ├── SchemaIntegration.test.ts
│   ├── AuthorizationIntegration.test.ts
│   ├── ExternalServices.test.ts
│   ├── Performance.test.ts
│   └── Integration.test.ts
└── index.ts                           # Главный экспорт
```

---

## 🔧 Команды для старта

### **1. Проверить готовность:**
```bash
cd packages/collection-store

# Убедиться что Phase 1 работает
bun test src/auth/tests/
# Должно быть: 120 pass, 0 fail

# Проверить зависимости
bun install
```

### **2. Создать структуру:**
```bash
# Создать базовую структуру папок
mkdir -p src/auth/computed/{interfaces,types,core,cache,schema,authorization,external,utils,tests}

# Создать index файлы
touch src/auth/computed/{interfaces,types,core,cache,schema,authorization,external,utils,tests}/index.ts
touch src/auth/computed/index.ts
```

### **3. Начать разработку:**
```bash
# Запуск тестов в watch mode
bun test src/auth/computed/tests/ --watch

# Проверка типов
bun run tsc --noEmit

# Линтинг
bun run lint
```

---

## 🎯 Week 1 План (7 дней)

### **Day 1-2: Core Interfaces & Types**
- Создать `IComputedAttributeEngine` интерфейс
- Реализовать `ComputedAttributeDefinition` типы
- Создать `ComputationContext` типы
- Настроить базовые error types

### **Day 3-4: Core Engine Implementation**
- Реализовать `ComputedAttributeEngine` класс
- Создать attribute registration system
- Реализовать basic computation execution
- Интегрировать с CSDatabase

### **Day 5-7: Caching System**
- Реализовать `ComputedAttributeCache` класс
- Создать dependency-based invalidation
- Интегрировать с CSDatabase change events
- Реализовать cache statistics

---

## 📊 Success Criteria

### **Функциональные требования:**
- ✅ Computed attributes registration и management
- ✅ Context-aware computation с доступом к данным
- ✅ Dependency-based caching с автоматической инвалидацией
- ✅ Integration с auth system для dynamic permissions
- ✅ External API support с security sandbox

### **Performance требования:**
- 🎯 Attribute computation: <50ms per request
- 🎯 Cache hit rate: >90% для frequently accessed attributes
- 🎯 Memory usage: <10MB для 1000 cached attributes
- 🎯 Support 100+ concurrent computations

### **Security требования:**
- 🎯 Sandboxed execution для external requests
- 🎯 Memory и CPU limits для computations
- 🎯 Input validation и sanitization
- 🎯 Audit trail для всех computations

---

## 💡 Примеры использования

### **1. User Access Level (на основе данных):**
```typescript
const userAccessLevel: ComputedAttributeDefinition = {
  id: 'user-access-level',
  name: 'User Access Level',
  targetType: 'user',

  computeFunction: async (context) => {
    const user = context.target
    const department = user.department
    const roles = user.roles || []

    // Запрос к коллекции департаментов
    const deptCollection = context.database.collection('departments')
    const deptInfo = await deptCollection.findOne({ name: department })

    if (roles.includes('admin')) return 'high'
    if (deptInfo?.securityLevel === 'restricted') return 'medium'
    return 'low'
  },

  dependencies: [
    { type: 'field', source: 'department', invalidateOnChange: true },
    { type: 'field', source: 'roles', invalidateOnChange: true },
    { type: 'collection', source: 'departments', invalidateOnChange: true }
  ],

  caching: {
    enabled: true,
    ttl: 300, // 5 minutes
    invalidateOn: [
      { type: 'field_change', source: 'department' },
      { type: 'field_change', source: 'roles' },
      { type: 'collection_change', source: 'departments' }
    ]
  }
}
```

### **2. Credit Score (внешний API):**
```typescript
const creditScore: ComputedAttributeDefinition = {
  id: 'user-credit-score',
  name: 'User Credit Score',
  targetType: 'user',

  computeFunction: async (context) => {
    const user = context.target
    const response = await context.httpClient.get(
      `https://credit-api.example.com/score/${user.id}`,
      { timeout: 3000 }
    )
    return response.data.score
  },

  caching: {
    enabled: true,
    ttl: 86400, // 24 hours
    invalidateOn: [
      { type: 'time_based', source: 'daily' }
    ]
  },

  security: {
    allowExternalRequests: true,
    timeout: 5000,
    maxMemoryUsage: 512 * 1024 // 512KB
  }
}
```

### **3. Использование в авторизации:**
```typescript
const computedAttributeRule: DynamicRule = {
  id: 'computed-access-level-rule',
  name: 'Access Level Based Rule',
  priority: 90,
  type: 'allow',

  evaluator: async (user, resource, context) => {
    // Получаем вычисляемый атрибут
    const accessLevel = await context.computedAttributeEngine.computeAttribute(
      'user-access-level',
      {
        target: user,
        targetId: user.id,
        targetType: 'user',
        database: context.database,
        timestamp: Date.now(),
        currentUser: user,
        authContext: context
      }
    )

    // Проверяем доступ на основе вычисляемого атрибута
    if (resource.securityLevel === 'high' && accessLevel !== 'high') {
      return false
    }

    return true
  }
}
```

---

## 🚀 Готов к старту!

**Все готово для начала реализации Phase 1.5!**

### **Следующие шаги:**
1. **Создать базовую структуру** папок и файлов
2. **Реализовать основные интерфейсы** и типы
3. **Создать ComputedAttributeEngine** класс
4. **Настроить тестирование** для новых компонентов

### **Ожидаемый результат:**
- Полнофункциональная система computed attributes
- Интеграция с существующей auth системой
- 100% test coverage
- Performance targets достигнуты

---

**Время начать! 🎯**

*Версия: 1.0 | Дата: Декабрь 2024*