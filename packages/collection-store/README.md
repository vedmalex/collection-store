# Collection Store

Высокопроизводительная, типобезопасная библиотека коллекций с B+ Tree индексацией, валидацией схем, ACID транзакциями и MongoDB-стиль операциями.

## 🚀 Что Нового в v3.0

### ✨ Полная Транзакционная Система (ACID)
- **🔒 ACID Транзакции** - Полная поддержка атомарности, согласованности, изоляции
- **🔄 Two-Phase Commit (2PC)** - Надежная координация ресурсов
- **📊 Copy-on-Write (CoW)** - Эффективная изоляция транзакций
- **🎯 Snapshot Isolation** - MVCC для высокого параллелизма
- **⚡ Автоматический Rollback** - Graceful обработка ошибок

### 🏗️ Улучшенная Архитектура
- **🌳 B+ Tree Индексы** - Полная транзакционная поддержка с CoW
- **📋 Система Схем** - Расширенная валидация и типизация
- **🔧 Composite Keys** - Поддержка составных ключей индексов
- **⚡ Compiled Queries** - До 25x быстрее (по умолчанию)
- **🎯 Type-Safe Updates** - MongoDB-стиль операторы с типобезопасностью

### 🛠️ Новые API
- **TransactionManager** - Управление жизненным циклом транзакций
- **IndexManager** - Транзакционные операции с индексами
- **TypedCollection** - Полностью типизированные коллекции
- **Schema-Aware Queries** - Валидация и оптимизация запросов

## Основные Возможности

- 🚀 **Типобезопасные Коллекции** - Полная поддержка TypeScript с IntelliSense
- 📊 **B+ Tree Индексация** - Высокопроизводительная индексация с транзакционной поддержкой
- 🔍 **MongoDB-стиль Запросы** - Знакомый синтаксис запросов с типобезопасностью
- ✅ **Валидация Схем** - Автоматическая валидация с определениями типов полей
- 🔄 **Операции Обновления** - MongoDB-стиль операторы ($set, $inc, $push, и др.)
- 💾 **Множественные Адаптеры Хранения** - Memory, File, и пользовательские опции
- 🔒 **ACID Транзакции** - Полная поддержка транзакций с откатом
- 📈 **Оптимизированная Производительность** - Скомпилированные запросы и эффективная индексация

## Быстрый Старт

### Установка

```bash
npm install collection-store
# или
bun add collection-store
```

### Базовое Использование с TypedCollection (Рекомендуется)

```typescript
import { createTypedCollection, TypedSchemaDefinition } from 'collection-store'

// Определите интерфейс данных
interface User {
  id: number
  name: string
  email: string
  age: number
  isActive: boolean
  tags: string[]
  createdAt: Date
}

// Определите схему с валидацией и индексами
const userSchema: TypedSchemaDefinition<User> = {
  id: {
    type: 'int',
    required: true,
    index: { unique: true }
  },
  name: {
    type: 'string',
    required: true,
    index: true
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
    validator: (email: string) => email.includes('@')
  },
  age: {
    type: 'int',
    required: true,
    min: 0,
    max: 150
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  tags: {
    type: 'array',
    default: []
  },
  createdAt: {
    type: 'date',
    required: true,
    default: () => new Date()
  }
}

// Создайте типизированную коллекцию
const users = createTypedCollection({
  name: 'users',
  schema: userSchema
})

// Типобезопасные операции с IntelliSense
await users.insert({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  isActive: true,
  tags: ['developer', 'typescript'],
  createdAt: new Date()
})

// Типобезопасные запросы
const activeUsers = await users.find({
  isActive: true,
  age: { $gte: 25 }
})

// Типобезопасные обновления с MongoDB-стиль операторами
await users.updateAtomic({
  filter: { id: 1 },
  update: {
    $set: { age: 31 },
    $push: { tags: 'senior' },
    $currentDate: { lastLogin: true }
  }
})
```

## 🔒 ACID Транзакции

### Базовые Транзакции

```typescript
import { CSDatabase } from 'collection-store'

const db = new CSDatabase('./data')

// Автоматическое управление транзакциями
await db.withTransaction(async (tx) => {
  const users = tx.collection('users')
  const orders = tx.collection('orders')

  // Все операции в одной транзакции
  const user = await users.insert({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com'
  })

  await orders.insert({
    id: 1,
    userId: user.id,
    amount: 100.00,
    status: 'pending'
  })

  // Автоматический commit при успехе
  // Автоматический rollback при ошибке
})
```

### Ручное Управление Транзакциями

```typescript
const db = new CSDatabase('./data')

// Начать транзакцию
const txId = await db.beginTransaction({
  timeout: 30000,
  isolationLevel: 'SNAPSHOT_ISOLATION'
})

try {
  // Выполнить операции
  await db.collection('users').create_in_transaction(txId, userData)
  await db.collection('orders').create_in_transaction(txId, orderData)

  // Зафиксировать изменения
  await db.commitTransaction(txId)
} catch (error) {
  // Откатить изменения
  await db.rollbackTransaction(txId)
  throw error
}
```

### Уведомления об Изменениях

```typescript
// Подписка на изменения
db.addChangeListener((changes) => {
  for (const change of changes) {
    console.log(`${change.type} in ${change.collection}:`, change.newValue)
  }
})

// Выполнение операций с уведомлениями
await db.withTransaction(async (tx) => {
  await tx.collection('users').insert(userData)
  // Уведомления будут отправлены после commit
})
```

## 📊 Продвинутые Индексы

### Составные Ключи (Composite Keys)

```typescript
import { createTypedCollection } from 'collection-store'

interface Order {
  id: number
  userId: number
  productId: number
  quantity: number
  createdAt: Date
}

const orders = createTypedCollection({
  name: 'orders',
  schema: {
    id: { type: 'int', required: true, index: { unique: true } },
    userId: { type: 'int', required: true },
    productId: { type: 'int', required: true },
    quantity: { type: 'int', required: true },
    createdAt: { type: 'date', required: true }
  },
  // Составные индексы
  compositeIndexes: [
    {
      name: 'user_product',
      fields: ['userId', 'productId'],
      unique: true
    },
    {
      name: 'user_date',
      fields: ['userId', 'createdAt'],
      sortOrder: ['asc', 'desc']
    }
  ]
})

// Поиск по составному ключу
const userOrders = await orders.findByComposite('user_product', [123, 456])
const recentUserOrders = await orders.findByComposite('user_date', [123])
```

### Транзакционные Операции с Индексами

```typescript
// Все операции с индексами поддерживают транзакции
await db.withTransaction(async (tx) => {
  const users = tx.collection('users')

  // Вставка с автоматическим обновлением всех индексов
  await users.insert({
    id: 1,
    name: 'John',
    email: 'john@example.com',
    age: 30
  })

  // Обновление с пересчетом индексов
  await users.update(1, {
    age: 31,
    email: 'john.doe@example.com'
  })

  // Все изменения индексов атомарны
})
```

## ⚡ Скомпилированные Запросы

### Автоматическая Компиляция (По Умолчанию)

```typescript
import { query } from 'collection-store'

// По умолчанию: скомпилированный режим (самый быстрый)
const fastQuery = query({
  age: { $gte: 25, $lte: 45 },
  status: 'active',
  tags: { $in: ['developer', 'designer'] }
})

const results = data.filter(fastQuery) // До 25x быстрее!
```

### Режим Отладки

```typescript
// Режим отладки: интерпретируемый (для отладки)
const debugQuery = query({
  age: { $gte: 25 }
}, {
  interpreted: true,
  debug: true
})

// Автоматический fallback при ошибке компиляции
const safeQuery = query(complexQuery) // Пробует скомпилировать, fallback при необходимости
```

### Схемо-Ориентированные Запросы

```typescript
import { createSchemaAwareQuery, SchemaDefinition } from 'collection-store'

// Определите схему с валидацией
const userSchema: SchemaDefinition = {
  'id': { type: 'int', required: true },
  'name': { type: 'string', required: true },
  'age': { type: 'int', coerce: true, validator: (v) => v >= 0 && v <= 150 },
  'email': { type: 'string', validator: (v) => v.includes('@') },
  'tags': { type: 'array' },
  'profile.settings.notifications': { type: 'boolean', default: true }
}

// Создайте схемо-ориентированный построитель запросов
const queryBuilder = createSchemaAwareQuery(userSchema, {
  validateTypes: true,
  coerceValues: true,
  strictMode: false
})

// Постройте валидированные и оптимизированные запросы
const { queryFn, validation } = queryBuilder.buildQuery({
  age: { $gte: "25", $lte: "45" },  // Строки автоматически приводятся к числам
  'profile.settings.notifications': true
})

if (validation.valid) {
  const results = data.filter(queryFn)
} else {
  console.log('Ошибки валидации:', validation.errors)
}
```

## 🔄 MongoDB-стиль Операции Обновления

### Атомарные Обновления

```typescript
// Атомарные обновления с полной типобезопасностью
await users.updateAtomic({
  filter: { age: { $gte: 25 } },
  update: {
    $set: { isActive: true },
    $inc: { age: 1 },
    $addToSet: { tags: 'experienced' },
    $currentDate: { lastLogin: true },
    $push: {
      notifications: {
        $each: [notification1, notification2],
        $slice: -10 // Оставить только последние 10
      }
    }
  },
  options: { multi: true }
})
```

### Массовые Операции

```typescript
// Массовые операции
await users.updateBulk({
  operations: [
    {
      filter: { isActive: false },
      update: { $set: { isActive: true } }
    },
    {
      filter: { age: { $gte: 30 } },
      update: { $addToSet: { tags: 'senior' } }
    }
  ]
})
```

### Поддерживаемые Операторы

```typescript
// Полный набор MongoDB операторов
await collection.updateAtomic({
  filter: { id: 1 },
  update: {
    // Установка значений
    $set: { name: 'New Name', age: 30 },
    $unset: { oldField: '' },

    // Числовые операции
    $inc: { counter: 1, score: -5 },
    $mul: { price: 1.1 },
    $min: { minValue: 10 },
    $max: { maxValue: 100 },

    // Массивы
    $push: { tags: 'new-tag' },
    $addToSet: { categories: 'unique-category' },
    $pull: { tags: 'old-tag' },
    $pullAll: { tags: ['tag1', 'tag2'] },
    $pop: { recentItems: 1 }, // Удалить последний

    // Даты
    $currentDate: {
      lastModified: true,
      timestamp: { $type: 'date' }
    },

    // Переименование полей
    $rename: { oldName: 'newName' }
  }
})
```

## 🎯 Система Типов и Валидация

### BSON-Совместимые Типы

```typescript
import { SchemaDefinition } from 'collection-store'

const schema: SchemaDefinition = {
  // Базовые типы
  'stringField': { type: 'string', required: true },
  'numberField': { type: 'number', min: 0, max: 100 },
  'intField': { type: 'int', coerce: true },
  'boolField': { type: 'boolean', default: false },
  'dateField': { type: 'date', default: () => new Date() },

  // Массивы и объекты
  'arrayField': { type: 'array', default: [] },
  'objectField': { type: 'object' },

  // Специальные типы
  'binaryField': { type: 'binData' },
  'objectIdField': { type: 'objectId' },
  'regexField': { type: 'regex' },

  // Вложенные поля
  'user.profile.name': { type: 'string', required: true },
  'user.settings.notifications': { type: 'boolean', default: true },

  // Пользовательские валидаторы
  'email': {
    type: 'string',
    validator: (email: string) => email.includes('@') && email.includes('.')
  },

  // Автоматическое приведение типов
  'age': {
    type: 'int',
    coerce: true, // "25" → 25
    validator: (age: number) => age >= 0 && age <= 150
  }
}
```

### Автоматическая Валидация

```typescript
// Автоматическая валидация при вставке/обновлении
const validation = users.validateDocument({
  id: 1,
  name: 'Test User',
  email: 'invalid-email', // Не пройдет валидацию
  age: -5 // Не пройдет валидацию
})

if (!validation.valid) {
  console.log('Ошибки валидации:', validation.errors)
  // [
  //   { field: 'email', message: 'Invalid email format' },
  //   { field: 'age', message: 'Value must be between 0 and 150' }
  // ]
}
```

## 📈 Производительность

Collection Store оптимизирован для высокой производительности:

### Бенчмарки

```typescript
// Результаты производительности (операций/сек)
//
// Простые запросы:
// - Скомпилированные: ~2,500,000 ops/sec
// - Интерпретируемые: ~100,000 ops/sec
// - Улучшение: 25x
//
// Сложные запросы:
// - Скомпилированные: ~1,200,000 ops/sec
// - Интерпретируемые: ~50,000 ops/sec
// - Улучшение: 24x
//
// B+ Tree операции:
// - Поиск: O(log n)
// - Вставка: O(log n)
// - Удаление: O(log n)
//
// Транзакции:
// - Overhead: ~5-10% от baseline
// - Memory usage: Минимальный (только изменения)
```

### Оптимизации

- **B+ Tree индексы** для O(log n) поиска
- **Скомпилированные запросы** для повторных операций
- **Эффективное использование памяти** с lazy loading
- **Поддержка транзакций** с минимальным overhead
- **Copy-on-Write** для эффективной изоляции

## 🔧 Расширенные Возможности

### TTL (Time To Live)

```typescript
// Автоматическое удаление устаревших записей
const sessions = createTypedCollection({
  name: 'sessions',
  schema: {
    id: { type: 'string', required: true },
    userId: { type: 'int', required: true },
    createdAt: { type: 'date', required: true },
    ttl: { type: 'int', default: 3600 } // 1 час в секундах
  },
  ttlField: 'ttl' // Поле для TTL
})

// Записи автоматически удаляются через указанное время
await sessions.insert({
  id: 'session-123',
  userId: 1,
  createdAt: new Date(),
  ttl: 1800 // 30 минут
})
```

### Пользовательские Адаптеры

```typescript
import { IAdapter } from 'collection-store'

class CustomAdapter implements IAdapter {
  async load(name: string): Promise<any[]> {
    // Ваша логика загрузки
  }

  async save(name: string, data: any[]): Promise<void> {
    // Ваша логика сохранения
  }

  async remove(name: string): Promise<void> {
    // Ваша логика удаления
  }
}

const db = new CSDatabase('./data', new CustomAdapter())
```

### Миграции Схем

```typescript
// Автоматические миграции при изменении схемы
const users = createTypedCollection({
  name: 'users',
  schema: userSchemaV2,
  migrations: {
    '1.0.0': (doc: any) => {
      // Миграция с версии 1.0.0
      doc.fullName = `${doc.firstName} ${doc.lastName}`
      delete doc.firstName
      delete doc.lastName
      return doc
    }
  }
})
```

## 📚 Документация

- [Руководство по Системе Схем](./integration/SCHEMA_SYSTEM_FINAL_GUIDE.md)
- [Бенчмарки Производительности](./integration/README_BENCHMARK.md)
- [Система Типов Полей](./integration/FIELD_TYPES_SYSTEM_REPORT.md)
- [Типобезопасные Операции Обновления](./integration/TYPE_SAFE_UPDATE_IMPLEMENTATION_REPORT.md)
- [Составные Ключи](./integration/COMPOSITE_KEYS_FINAL_REPORT.md)
- [Скомпилированные Запросы](./integration/COMPILED_BY_DEFAULT_FINAL_SUMMARY.md)

## 🔄 Миграция с v1.x

### Обратная Совместимость

Все существующие API сохранены для плавной миграции:

```typescript
// Старый API (все еще работает)
import { Collection } from 'collection-store'

const collection = Collection.create({
  name: 'users',
  indexList: [
    { key: 'email', unique: true },
    { key: 'age' }
  ]
})

// Новый API (рекомендуется)
import { createTypedCollection } from 'collection-store'

const users = createTypedCollection({
  name: 'users',
  schema: userSchema
})
```

### Пошаговая Миграция

1. **Обновите зависимости**
   ```bash
   npm update collection-store
   ```

2. **Добавьте схемы постепенно**
   ```typescript
   // Начните с базовой схемы
   const basicSchema = {
     id: { type: 'int', required: true }
   }
   ```

3. **Используйте новые возможности**
   ```typescript
   // Добавьте транзакции
   await db.withTransaction(async (tx) => {
     // Ваши операции
   })
   ```

## 🤝 Вклад в Проект

Мы приветствуем вклад в развитие проекта! См. [CONTRIBUTING.md](./CONTRIBUTING.md) для деталей.

## 📄 Лицензия

MIT License - см. файл [LICENSE](./LICENSE) для деталей.

---

## 🎯 Ключевые Преимущества v3.0

- **⚡ Производительность**: До 25x быстрее с скомпилированными запросами
- **🔒 Надежность**: Полная ACID транзакционная поддержка
- **🛡️ Типобезопасность**: MongoDB-совместимая BSON система типов
- **🔄 Совместимость**: Полная обратная совместимость с v1.x
- **📊 Масштабируемость**: B+ Tree индексы с составными ключами
- **🎯 Простота**: Интуитивный API с автоматической валидацией
- **🔧 Расширяемость**: Пользовательские адаптеры и валидаторы
- **📈 Мониторинг**: Встроенные метрики и уведомления об изменениях

**Collection Store v3.0 - Ваше решение для высокопроизводительного хранения данных с полной транзакционной поддержкой!**

