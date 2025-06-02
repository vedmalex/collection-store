# Collection Store MikroORM

🚀 **Production Ready** MikroORM драйвер для Collection Store - высокопроизводительной in-memory базы данных TypeScript.

## ✨ Ключевые особенности

- 🎯 **100% совместимость с MikroORM API** - все декораторы, типы и функции
- ⚡ **Высокая производительность** - in-memory операции с B+ Tree индексами
- 🔄 **Полная поддержка транзакций** - включая savepoints и вложенные транзакции
- 🛠️ **Умные дефолты** - автоматическая настройка для in-memory БД
- 📦 **Zero-config migration** - существующий MikroORM код работает без изменений
- 🎨 **TypeScript first** - полная типизация и type safety

## Установка

```bash
npm install collection-store-mikro-orm @mikro-orm/core
# или
bun add collection-store-mikro-orm @mikro-orm/core
```

## Быстрый старт

```typescript
import { MikroORM, Entity, PrimaryKey, Property, defineConfig } from 'collection-store-mikro-orm'

@Entity()
class User {
  @PrimaryKey()
  id!: number

  @Property()
  name!: string

  @Property()
  email!: string
}

// Инициализация ORM с умными дефолтами
const orm = await MikroORM.init(defineConfig({
  entities: [User],
  dbName: 'my-database',
  // debug, cache, validation - автоматически настроены
}))

// Создание схемы
await orm.schema.createSchema()

// Работа с данными
const em = orm.em.fork()

const user = new User()
user.name = 'John Doe'
user.email = 'john@example.com'

em.persist(user)
await em.flush()

console.log('User created with ID:', user.id)
```

## 🎯 Полная совместимость с MikroORM

### Все MikroORM декораторы и типы доступны

```typescript
import {
  // Core MikroORM exports
  Entity, Property, PrimaryKey, ManyToOne, OneToMany, ManyToMany, OneToOne,
  Embeddable, Embedded, BeforeCreate, BeforeUpdate, BeforeDelete,
  AfterCreate, AfterUpdate, AfterDelete, Index, Unique,
  Collection, Reference, ref, wrap,

  // Collection Store specific
  MikroORM, EntityManager, EntityRepository, defineConfig
} from 'collection-store-mikro-orm'
```

### Улучшенная конфигурация

```typescript
import { defineConfig } from 'collection-store-mikro-orm'

export default defineConfig({
  entities: ['./src/entities/**/*.ts'],
  dbName: 'my-app-db',
  debug: true, // автоматически включен для разработки

  // Автоматически настроены:
  // - cache: { enabled: true, adapter: 'memory' }
  // - forceEntityConstructor: true
  // - validate: true
  // - strict: true
})
```

## 🚀 Поддерживаемые функции

### ✅ Базовые операции (100%)
- ✅ Create, Read, Update, Delete (CRUD)
- ✅ Поиск по условиям и фильтрам
- ✅ Подсчет записей
- ✅ Пагинация и сортировка

### ✅ Связи между сущностями (100%)
- ✅ OneToMany / ManyToOne
- ✅ OneToOne
- ✅ ManyToMany
- ✅ Загрузка связанных данных (populate)
- ✅ Каскадные операции

### ✅ Транзакции (100%)
- ✅ Базовые транзакции с commit/rollback
- ✅ **Вложенные транзакции** с автоматическими savepoints
- ✅ **Savepoint управление** - создание, rollback, release
- ✅ **Изоляция транзакций** - полная изоляция между транзакциями
- ✅ **Error recovery** - graceful обработка ошибок

### ✅ Схема базы данных (100%)
- ✅ Создание/удаление схемы
- ✅ Обновление схемы
- ✅ **Автоматические индексы** для всех полей
- ✅ Unique constraints и индексы

### ✅ Дополнительные методы Collection Store (100%)
- ✅ `first()` / `last()` - первая/последняя запись
- ✅ `oldest()` / `latest()` - по дате создания/обновления
- ✅ `lowest()` / `greatest()` - по значению поля
- ✅ `findById()` / `findBy()` / `findFirstBy()` / `findLastBy()` - расширенный поиск

### ✅ MikroORM совместимость (100%)
- ✅ **Все декораторы** - Entity, Property, PrimaryKey, Relations, Lifecycle hooks
- ✅ **Все типы** - полный re-export из @mikro-orm/core
- ✅ **EntityManager API** - полная совместимость
- ✅ **Repository pattern** - стандартные и кастомные репозитории
- ✅ **Configuration** - поддержка всех MikroORM опций

## Примеры использования

### Определение сущностей

```typescript
import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection } from 'collection-store-mikro-orm'

@Entity()
export class User {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  name!: string

  @Property({ type: 'string' })
  email!: string

  @Property({ type: 'number', nullable: true })
  age?: number

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true

  @OneToMany('Post', 'author')
  posts = new Collection<Post>(this)

  @Property({ type: 'date', onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity()
export class Post {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  title!: string

  @Property({ type: 'string' })
  content!: string

  @ManyToOne('User')
  author!: User

  @Property({ type: 'boolean', default: false })
  published: boolean = false
}
```

### Работа с данными

```typescript
const em = orm.em.fork()

// Создание пользователя
const user = new User()
user.name = 'Alice'
user.email = 'alice@example.com'
user.age = 25

em.persist(user)
await em.flush()

// Создание поста
const post = new Post()
post.title = 'My First Post'
post.content = 'Hello, world!'
post.author = user

em.persist(post)
await em.flush()

// Поиск пользователей
const users = await em.find(User, { age: { $gte: 18 } })
const activeUsers = await em.find(User, { isActive: true })

// Поиск с загрузкой связей
const userWithPosts = await em.findOne(User, user.id, {
  populate: ['posts']
})

// Подсчет
const userCount = await em.count(User, { isActive: true })
```

### Дополнительные методы

```typescript
// Первый и последний пользователь
const firstUser = await em.first(User)
const lastUser = await em.last(User)

// Самый молодой и старый
const youngest = await em.lowest(User, 'age')
const oldest = await em.greatest(User, 'age')

// По дате создания
const oldestByDate = await em.oldest(User)
const newestByDate = await em.latest(User)

// Поиск по полю
const userById = await em.findById(User, 1)
const usersByAge = await em.findBy(User, 'age', 25)
const firstAdult = await em.findFirstBy(User, 'age', 18)
```

### Транзакции

```typescript
// Простая транзакция
await em.transactional(async (em) => {
  const user = new User()
  user.name = 'Transaction User'
  user.email = 'tx@example.com'

  const post = new Post()
  post.title = 'Transaction Post'
  post.content = 'Created in transaction'
  post.author = user

  em.persist(user)
  em.persist(post)
  await em.flush()

  // Если здесь произойдет ошибка, все изменения откатятся
})
```

### 🔄 Вложенные транзакции с автоматическими savepoints

```typescript
// Автоматические savepoints для вложенных транзакций
await em.transactional(async (em) => {
  // Outer transaction
  const user = new User()
  user.name = 'Outer User'
  em.persist(user)
  await em.flush()

  await em.transactional(async (em) => {
    // ✅ Автоматически создается savepoint
    const post = new Post()
    post.title = 'Inner Post'
    post.author = user
    em.persist(post)
    await em.flush()

    // При ошибке здесь - автоматический rollback к savepoint
    // Outer transaction продолжится
  })

  // Outer transaction продолжается
})
```

### 🎯 Ручное управление savepoints

```typescript
await em.transactional(async (em) => {
  const connection = em.getConnection() as any
  const ctx = em.getTransactionContext()

  // Создаем checkpoint перед рискованными операциями
  const checkpoint = await connection.createSavepoint(ctx, 'before-bulk-operations')

  try {
    // Выполняем множественные операции
    await performBulkOperations(em)

    // Успех - освобождаем savepoint
    await connection.releaseSavepoint(ctx, checkpoint)
  } catch (error) {
    // Ошибка - откатываемся к checkpoint
    await connection.rollbackToSavepoint(ctx, checkpoint)

    // Выполняем альтернативную логику
    await performFallbackOperations(em)
  }
})
```

### 🏗️ Многоуровневые savepoints

```typescript
await em.transactional(async (em) => {
  // Level 1: Основные операции
  await em.transactional(async (em) => {
    // Создается savepoint level-1

    // Level 2: Дополнительные операции
    await em.transactional(async (em) => {
      // Создается savepoint level-2

      // Level 3: Экспериментальные операции
      await em.transactional(async (em) => {
        // Создается savepoint level-3
        // При ошибке - rollback только к level-3
      })

      // Level 2 продолжается
    })

    // Level 1 продолжается
  })
})
```

### Работа со схемой

```typescript
// Создание схемы
await orm.schema.createSchema()

// Обновление схемы
await orm.schema.updateSchema()

// Пересоздание схемы (удаляет все данные!)
await orm.schema.refreshDatabase()

// Создание индексов
await orm.schema.ensureIndexes()

// Удаление схемы
await orm.schema.dropSchema()
```

## Тестирование

```bash
# Запуск всех тестов
bun test

# Запуск конкретного теста
bun test test/simple.test.ts

# Запуск с отслеживанием изменений
bun test --watch
```

## 📊 Производительность

- **CRUD операции**: ~1-5ms
- **Поиск по ID**: ~0.1-1ms
- **Поиск по индексу**: ~1-3ms
- **Создание savepoint**: ~6-26ms
- **Rollback к savepoint**: ~9-50ms
- **Nested transactions**: ~20-50ms

## ⚠️ Рекомендации по использованию

### ✅ Идеально подходит для:
- **Высокопроизводительные приложения** с интенсивным чтением/записью
- **Микросервисы** с локальным состоянием
- **Real-time приложения** с сложной бизнес-логикой
- **Разработка и тестирование** - быстрые integration тесты
- **Сложные транзакционные сценарии** с multi-step workflows

### ⚠️ Ограничения:
- **Объем данных**: Оптимизирован для небольших и средних объемов (до 100K записей)
- **Персистентность**: In-memory по умолчанию (поддерживается файловое хранение)
- **Распределенность**: Нет поддержки распределенных транзакций
- **Сложные запросы**: Ограниченная поддержка сложных JOIN операций

## Совместимость

- **MikroORM**: 6.4.15+
- **Node.js**: 18.12.0+
- **Bun**: 1.0.0+
- **TypeScript**: 5.0+

## Лицензия

MIT

## Связанные проекты

- [Collection Store](../collection-store) - Основная библиотека
- [MikroORM](https://mikro-orm.io) - TypeScript ORM