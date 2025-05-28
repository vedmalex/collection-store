# Collection Store MikroORM

MikroORM драйвер для Collection Store - файловой базы данных TypeScript.

## Установка

```bash
npm install collection-store-mikro-orm @mikro-orm/core
# или
bun add collection-store-mikro-orm @mikro-orm/core
```

## Быстрый старт

```typescript
import { MikroORM, Entity, PrimaryKey, Property } from 'collection-store-mikro-orm'

@Entity()
class User {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  name!: string

  @Property({ type: 'string' })
  email!: string
}

// Инициализация ORM
const orm = await MikroORM.init({
  entities: [User],
  dbName: 'my-database',
  clientUrl: './data', // путь к папке с данными
})

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

## Конфигурация

```typescript
import { defineConfig } from 'collection-store-mikro-orm'

export default defineConfig({
  entities: ['./src/entities/**/*.ts'],
  dbName: 'my-app-db',
  clientUrl: './data',
  debug: true,
})
```

## Поддерживаемые функции

### ✅ Базовые операции
- ✅ Create, Read, Update, Delete (CRUD)
- ✅ Поиск по условиям
- ✅ Подсчет записей
- ✅ Пагинация

### ✅ Связи
- ✅ OneToMany / ManyToOne
- ✅ Загрузка связанных данных (populate)
- ⚠️ ManyToMany (ограниченная поддержка)

### ✅ Транзакции
- ✅ Базовые транзакции
- ✅ Rollback при ошибках
- ⚠️ Вложенные транзакции (экспериментально)

### ✅ Схема
- ✅ Создание/удаление схемы
- ✅ Обновление схемы
- ✅ Индексы

### ✅ Дополнительные методы Collection Store
- ✅ `first()` / `last()` - первая/последняя запись
- ✅ `oldest()` / `latest()` - по дате создания
- ✅ `lowest()` / `greatest()` - по значению поля
- ✅ `findById()` / `findBy()` - поиск по ID/полю

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

## Ограничения

1. **Производительность**: Collection Store оптимизирован для небольших и средних объемов данных
2. **Сложные запросы**: Ограниченная поддержка сложных JOIN операций
3. **Конкурентность**: Базовая поддержка многопользовательского доступа
4. **Индексы**: Простые индексы, без составных индексов

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