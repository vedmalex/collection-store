# Интеграция Savepoint с MikroORM Connection

## 📋 Phase 3: Интеграция с MikroORM

### 1. Обновление Platform для поддержки savepoint

```typescript
// Изменить в packages/collection-store-mikro-orm/src/Platform.ts

export class CollectionStorePlatform extends Platform {
  // ... существующие методы ...
  override getSchemaGenerator(
    driver: IDatabaseDriver,
    em?: EntityManager,
  ): CollectionStoreSchemaGenerator {
    return new CollectionStoreSchemaGenerator(em ?? (driver as any))
  }

  override lookupExtensions(orm: MikroORM): void {
    CollectionStoreSchemaGenerator.register(orm)
  }

  override supportsTransactions(): boolean {
    return true
  }

  // ✅ ИЗМЕНЕНИЕ: Включаем поддержку savepoint
  override supportsSavePoints(): boolean {
    return true; // Было: false
  }

  override getNamingStrategy(): { new (): NamingStrategy } {
    return EntityCaseNamingStrategy
  }

  // ... остальные методы без изменений ...
}
```

### 2. Расширение CollectionStoreConnection с savepoint методами

```typescript
// Добавить в packages/collection-store-mikro-orm/src/Connection.ts

export class CollectionStoreConnection extends Connection {
  // ... существующие поля и методы ...
  db!: CSDatabase

  constructor(config: Configuration, options?: ConnectionOptions, type: ConnectionType = 'write') {
    super(config, options, type)
  }

  // ... существующие методы ...

  // ✅ НОВЫЕ МЕТОДЫ: Savepoint support
  async createSavepoint(ctx: CSTransaction, name: string): Promise<string> {
    await this.ensureConnection()

    try {
      const savepointId = await ctx.createSavepoint(name)
      this.logQuery(`SAVEPOINT ${name}; -- ${savepointId}`)
      return savepointId
    } catch (error) {
      this.logQuery(`SAVEPOINT ${name}; -- FAILED: ${error.message}`)
      throw error
    }
  }

  async rollbackToSavepoint(ctx: CSTransaction, savepointId: string): Promise<void> {
    await this.ensureConnection()

    try {
      await ctx.rollbackToSavepoint(savepointId)
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId};`)
    } catch (error) {
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId}; -- FAILED: ${error.message}`)
      throw error
    }
  }

  async releaseSavepoint(ctx: CSTransaction, savepointId: string): Promise<void> {
    await this.ensureConnection()

    try {
      await ctx.releaseSavepoint(savepointId)
      this.logQuery(`RELEASE SAVEPOINT ${savepointId};`)
    } catch (error) {
      this.logQuery(`RELEASE SAVEPOINT ${savepointId}; -- FAILED: ${error.message}`)
      throw error
    }
  }

  // ✅ РАСШИРЕННЫЙ МЕТОД: transactional с поддержкой вложенных транзакций
  override async transactional<T>(
    cb: (trx: Transaction<CSTransaction>) => Promise<T>,
    options: {
      isolationLevel?: IsolationLevel
      ctx?: Transaction<CSTransaction>
      eventBroadcaster?: TransactionEventBroadcaster
    } & TransactionOptions = {},
  ): Promise<T> {
    await this.ensureConnection()

    // Если есть родительская транзакция, создаем savepoint вместо новой транзакции
    if (options.ctx) {
      const savepointName = `nested_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      try {
        // Создаем savepoint в существующей транзакции
        const savepointId = await this.createSavepoint(options.ctx, savepointName)

        console.log(`[CollectionStoreConnection] Created savepoint '${savepointName}' for nested transaction`)

        try {
          const ret = await cb(options.ctx)

          // Успешное выполнение - release savepoint
          await this.releaseSavepoint(options.ctx, savepointId)
          console.log(`[CollectionStoreConnection] Released savepoint '${savepointName}' after successful nested transaction`)

          return ret
        } catch (error) {
          // Ошибка - rollback к savepoint
          await this.rollbackToSavepoint(options.ctx, savepointId)
          console.log(`[CollectionStoreConnection] Rolled back to savepoint '${savepointName}' after nested transaction error`)
          throw error
        }
      } catch (savepointError) {
        console.error(`[CollectionStoreConnection] Failed to manage savepoint for nested transaction:`, savepointError)
        throw savepointError
      }
    } else {
      // Обычная транзакция (корневая)
      const session = await this.begin(options)

      try {
        const ret = await cb(session)
        await this.commit(session, options?.eventBroadcaster)
        return ret
      } catch (error) {
        await this.rollback(session, options?.eventBroadcaster)
        throw error
      } finally {
        await session.endSession()
      }
    }
  }

  // ✅ РАСШИРЕННЫЙ МЕТОД: begin с поддержкой вложенных транзакций
  override async begin(
    options: {
      isolationLevel?: IsolationLevel
      ctx?: Transaction<CSTransaction>
      eventBroadcaster?: TransactionEventBroadcaster
    } & TransactionOptions = {},
  ): Promise<CSTransaction> {
    await this.ensureConnection()
    const { ctx, isolationLevel, eventBroadcaster, ...txOptions } = options

    // Если есть родительская транзакция, возвращаем её (savepoint будет создан в transactional)
    if (ctx) {
      console.log(`[CollectionStoreConnection] Using existing transaction context for nested transaction`)
      return ctx
    }

    // Создаем новую корневую транзакцию
    if (!ctx) {
      await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionStart)
    }

    const session = await this.db.startSession()
    session.startTransaction(txOptions)
    this.logQuery('db.begin();')
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionStart, session)

    return session
  }

  // ... остальные методы без изменений ...
}
```

### 3. Создание типов для savepoint операций

```typescript
// Создать файл: packages/collection-store-mikro-orm/src/types.ts

import type { CSTransaction } from 'collection-store'

// ✅ НОВЫЕ ТИПЫ: Savepoint операции
export interface SavepointConnection {
  createSavepoint(ctx: CSTransaction, name: string): Promise<string>
  rollbackToSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>
  releaseSavepoint(ctx: CSTransaction, savepointId: string): Promise<void>
}

export interface SavepointInfo {
  savepointId: string
  name: string
  timestamp: number
  transactionId: string
  collectionsCount: number
  btreeContextsCount: number
}

// ✅ НОВЫЕ ТИПЫ: Расширенные опции транзакций
export interface NestedTransactionOptions {
  isolationLevel?: IsolationLevel
  ctx?: Transaction<CSTransaction>
  eventBroadcaster?: TransactionEventBroadcaster
  savepointName?: string // Опциональное имя для savepoint
}
```

### 4. Обновление экспортов

```typescript
// Обновить packages/collection-store-mikro-orm/src/index.ts

export { CollectionStoreConnection } from './Connection'
export { CollectionStoreDriver } from './Driver'
export { CollectionStoreEntityManager } from './EntityManager'
export { CollectionStoreEntityRepository } from './EntityRepository'
export { CollectionStoreMikroORM } from './MikroORM'
export { CollectionStorePlatform } from './Platform'
export { CollectionStoreSchemaGenerator } from './SchemaGenerator'

// ✅ НОВЫЕ ЭКСПОРТЫ: Savepoint типы
export type {
  SavepointConnection,
  SavepointInfo,
  NestedTransactionOptions
} from './types'
```

## 🧪 Тесты для MikroORM Savepoint Integration

### Создать файл: packages/collection-store-mikro-orm/test/savepoint.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { MikroORM } from '@mikro-orm/core'
import { CollectionStoreMikroORM } from '../src/MikroORM'
import { TestUser, TestPost } from './entities'
import { initTestORM } from './setup'

describe('CollectionStore MikroORM - Savepoint Support', () => {
  let orm: MikroORM

  beforeEach(async () => {
    orm = await initTestORM([TestUser, TestPost])
  })

  afterEach(async () => {
    await orm.close()
  })

  describe('Platform Savepoint Support', () => {
    it('should report savepoint support', () => {
      const platform = orm.config.getPlatform()
      expect(platform.supportsSavePoints()).toBe(true)
    })
  })

  describe('Nested Transactions with Savepoints', () => {
    it('should handle nested transaction commit', async () => {
      const em = orm.em.fork()

      await em.transactional(async (em) => {
        const user1 = new TestUser()
        user1.name = 'Outer User'
        user1.email = 'outer@example.com'

        em.persist(user1)
        await em.flush()

        // Вложенная транзакция (должна использовать savepoint)
        await em.transactional(async (em) => {
          const user2 = new TestUser()
          user2.name = 'Inner User'
          user2.email = 'inner@example.com'

          em.persist(user2)
          await em.flush()
        })
      })

      // Проверяем что оба пользователя сохранены
      const users = await em.find(TestUser, {})
      expect(users).toHaveLength(2)
      expect(users.map(u => u.name).sort()).toEqual(['Inner User', 'Outer User'])
    })

    it('should rollback nested transaction on inner error', async () => {
      const em = orm.em.fork()

      try {
        await em.transactional(async (em) => {
          const user1 = new TestUser()
          user1.name = 'Outer User'
          user1.email = 'outer@example.com'

          em.persist(user1)
          await em.flush()

          // Вложенная транзакция с ошибкой
          await em.transactional(async (em) => {
            const user2 = new TestUser()
            user2.name = 'Inner User'
            user2.email = 'inner@example.com'

            em.persist(user2)
            await em.flush()

            // Симулируем ошибку во вложенной транзакции
            throw new Error('Inner transaction error')
          })
        })
      } catch (error) {
        expect(error.message).toBe('Inner transaction error')
      }

      // Проверяем что никто не сохранен (вся транзакция откатилась)
      const users = await em.find(TestUser, {})
      expect(users).toHaveLength(0)
    })

    it('should handle multiple nested levels', async () => {
      const em = orm.em.fork()

      await em.transactional(async (em) => {
        const user1 = new TestUser()
        user1.name = 'Level 1'
        user1.email = 'level1@example.com'
        em.persist(user1)
        await em.flush()

        await em.transactional(async (em) => {
          const user2 = new TestUser()
          user2.name = 'Level 2'
          user2.email = 'level2@example.com'
          em.persist(user2)
          await em.flush()

          await em.transactional(async (em) => {
            const user3 = new TestUser()
            user3.name = 'Level 3'
            user3.email = 'level3@example.com'
            em.persist(user3)
            await em.flush()
          })
        })
      })

      const users = await em.find(TestUser, {})
      expect(users).toHaveLength(3)
      expect(users.map(u => u.name).sort()).toEqual(['Level 1', 'Level 2', 'Level 3'])
    })

    it('should rollback to specific savepoint level', async () => {
      const em = orm.em.fork()

      try {
        await em.transactional(async (em) => {
          const user1 = new TestUser()
          user1.name = 'Level 1'
          user1.email = 'level1@example.com'
          em.persist(user1)
          await em.flush()

          await em.transactional(async (em) => {
            const user2 = new TestUser()
            user2.name = 'Level 2'
            user2.email = 'level2@example.com'
            em.persist(user2)
            await em.flush()

            // Эта вложенная транзакция упадет
            await em.transactional(async (em) => {
              const user3 = new TestUser()
              user3.name = 'Level 3'
              user3.email = 'level3@example.com'
              em.persist(user3)
              await em.flush()

              throw new Error('Level 3 error')
            })
          })
        })
      } catch (error) {
        expect(error.message).toBe('Level 3 error')
      }

      // Проверяем что все откатилось
      const users = await em.find(TestUser, {})
      expect(users).toHaveLength(0)
    })
  })

  describe('Mixed Entity Operations', () => {
    it('should handle nested transactions with different entities', async () => {
      const em = orm.em.fork()

      await em.transactional(async (em) => {
        const user = new TestUser()
        user.name = 'Author'
        user.email = 'author@example.com'
        em.persist(user)
        await em.flush()

        await em.transactional(async (em) => {
          const post = new TestPost()
          post.title = 'Test Post'
          post.content = 'Content'
          post.author = user
          em.persist(post)
          await em.flush()
        })
      })

      const users = await em.find(TestUser, {})
      const posts = await em.find(TestPost, {})

      expect(users).toHaveLength(1)
      expect(posts).toHaveLength(1)
      expect(posts[0].author.name).toBe('Author')
    })

    it('should rollback nested entity operations', async () => {
      const em = orm.em.fork()

      try {
        await em.transactional(async (em) => {
          const user = new TestUser()
          user.name = 'Author'
          user.email = 'author@example.com'
          em.persist(user)
          await em.flush()

          await em.transactional(async (em) => {
            const post = new TestPost()
            post.title = 'Test Post'
            post.content = 'Content'
            post.author = user
            em.persist(post)
            await em.flush()

            throw new Error('Post creation failed')
          })
        })
      } catch (error) {
        expect(error.message).toBe('Post creation failed')
      }

      const users = await em.find(TestUser, {})
      const posts = await em.find(TestPost, {})

      expect(users).toHaveLength(0)
      expect(posts).toHaveLength(0)
    })
  })

  describe('Connection Savepoint Methods', () => {
    it('should expose savepoint methods on connection', async () => {
      const connection = orm.em.getConnection()

      // Проверяем что методы существуют
      expect(typeof connection.createSavepoint).toBe('function')
      expect(typeof connection.rollbackToSavepoint).toBe('function')
      expect(typeof connection.releaseSavepoint).toBe('function')
    })

    it('should handle direct savepoint operations', async () => {
      const em = orm.em.fork()
      const connection = em.getConnection()

      await em.transactional(async (trx) => {
        const user1 = new TestUser()
        user1.name = 'Before Savepoint'
        user1.email = 'before@example.com'
        em.persist(user1)
        await em.flush()

        // Создаем savepoint напрямую
        const savepointId = await connection.createSavepoint(trx, 'manual_savepoint')

        const user2 = new TestUser()
        user2.name = 'After Savepoint'
        user2.email = 'after@example.com'
        em.persist(user2)
        await em.flush()

        // Откатываемся к savepoint
        await connection.rollbackToSavepoint(trx, savepointId)

        // Проверяем что второй пользователь исчез
        const users = await em.find(TestUser, {})
        expect(users).toHaveLength(1)
        expect(users[0].name).toBe('Before Savepoint')
      })
    })
  })
})
```

### Обновить существующий файл: packages/collection-store-mikro-orm/test/transactions.test.ts

```typescript
// Добавить в конец файла packages/collection-store-mikro-orm/test/transactions.test.ts

describe('Enhanced Nested Transactions with Savepoints', () => {
  it('should handle complex nested transaction scenarios', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    let savedUsers = 0

    try {
      await em.transactional(async (em) => {
        // Level 1: Создаем пользователя
        const user1 = new TestUser()
        user1.name = 'User 1'
        user1.email = 'user1@example.com'
        em.persist(user1)
        await em.flush()
        savedUsers++

        await em.transactional(async (em) => {
          // Level 2: Создаем еще пользователя
          const user2 = new TestUser()
          user2.name = 'User 2'
          user2.email = 'user2@example.com'
          em.persist(user2)
          await em.flush()
          savedUsers++

          await em.transactional(async (em) => {
            // Level 3: Создаем пост (успешно)
            const post = new TestPost()
            post.title = 'Successful Post'
            post.content = 'This should be saved'
            post.author = user1
            em.persist(post)
            await em.flush()
          })

          // Level 2 продолжается: создаем еще пользователя
          const user3 = new TestUser()
          user3.name = 'User 3'
          user3.email = 'user3@example.com'
          em.persist(user3)
          await em.flush()
          savedUsers++
        })
      })
    } catch (error) {
      // Не должно быть ошибок
      expect(error).toBeUndefined()
    }

    // Проверяем результат
    const users = await em.find(TestUser, {})
    const posts = await em.find(TestPost, {})

    expect(users).toHaveLength(3)
    expect(posts).toHaveLength(1)
    expect(savedUsers).toBe(3)
  })

  it('should handle partial rollback in nested transactions', async () => {
    const orm = await initTestORM([TestUser, TestPost])
    const em = orm.em.fork()

    try {
      await em.transactional(async (em) => {
        // Level 1: Создаем пользователя (должен остаться)
        const user1 = new TestUser()
        user1.name = 'Persistent User'
        user1.email = 'persistent@example.com'
        em.persist(user1)
        await em.flush()

        try {
          await em.transactional(async (em) => {
            // Level 2: Создаем временного пользователя
            const user2 = new TestUser()
            user2.name = 'Temporary User'
            user2.email = 'temp@example.com'
            em.persist(user2)
            await em.flush()

            // Эта операция упадет
            throw new Error('Simulated error in nested transaction')
          })
        } catch (nestedError) {
          // Ловим ошибку вложенной транзакции
          expect(nestedError.message).toBe('Simulated error in nested transaction')

          // Продолжаем выполнение основной транзакции
          const user3 = new TestUser()
          user3.name = 'Recovery User'
          user3.email = 'recovery@example.com'
          em.persist(user3)
          await em.flush()
        }
      })
    } catch (error) {
      // Основная транзакция не должна упасть
      expect(error).toBeUndefined()
    }

    // Проверяем что сохранились только пользователи из успешных частей
    const users = await em.find(TestUser, {})
    expect(users).toHaveLength(2)
    expect(users.map(u => u.name).sort()).toEqual(['Persistent User', 'Recovery User'])
  })
})
```

## 📋 Статус реализации Phase 3

### ✅ Готово к реализации
- [x] Обновлен Platform.supportsSavePoints() → true
- [x] Добавлены savepoint методы в CollectionStoreConnection
- [x] Реализована поддержка вложенных транзакций через savepoints
- [x] Создана логика автоматического создания savepoints для nested transactions
- [x] Добавлены типы для savepoint операций
- [x] Создан comprehensive план тестирования

### ⏳ Следующие шаги
1. Реализовать изменения в packages/collection-store-mikro-orm/src/Platform.ts
2. Расширить packages/collection-store-mikro-orm/src/Connection.ts
3. Добавить типы в packages/collection-store-mikro-orm/src/types.ts
4. Добавить end-to-end тесты
5. Переходить к Phase 4 - валидация и оптимизация

---

*Документ создан в соответствии с DEVELOPMENT_RULES.md - фазовый подход к разработке*