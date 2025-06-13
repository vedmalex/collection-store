import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { MikroORM, Entity, PrimaryKey, Property, EntityManager } from '@mikro-orm/core'
import { CollectionStorePlatform } from '../src/Platform'
import { initTestORM, closeTestORM, cleanupTestData } from './setup'
import path from 'path'
import fs from 'fs-extra'

@Entity()
class User {
  @PrimaryKey()
  id!: number

  @Property()
  name!: string

  @Property()
  email!: string

  @Property({ nullable: true })
  status?: string
}

@Entity()
class Order {
  @PrimaryKey()
  id!: number

  @Property()
  userId!: number

  @Property()
  total!: number

  @Property({ nullable: true })
  status?: string
}

describe('MikroORM Savepoint Support', () => {
  let orm: MikroORM
  let em: EntityManager

  beforeEach(async () => {
    cleanupTestData()
    orm = await initTestORM([User, Order], 'savepoint-test-db')
    em = orm.em.fork()
  })

  afterEach(async () => {
    await closeTestORM()
    cleanupTestData()
  })

  describe('Platform savepoint support', () => {
    it('should report savepoint support', () => {
      const platform = orm.config.getPlatform() as CollectionStorePlatform
      expect(platform.supportsSavePoints()).toBe(true)
    })
  })

  describe('Connection savepoint methods', () => {
    it('should have savepoint methods available', () => {
      const connection = orm.em.getConnection()
      expect(typeof (connection as any).createSavepoint).toBe('function')
      expect(typeof (connection as any).rollbackToSavepoint).toBe('function')
      expect(typeof (connection as any).releaseSavepoint).toBe('function')
    })

    it('should create and release savepoint manually', async () => {
      await em.transactional(async (em) => {
        const connection = em.getConnection() as any
        const ctx = em.getTransactionContext()

        // Создаем savepoint
        const savepointId = await connection.createSavepoint(ctx, 'manual-test')
        expect(savepointId).toMatch(/^csdb-sp-/)

        // Release savepoint
        await connection.releaseSavepoint(ctx, savepointId)
      })
    })
  })

  describe('Nested transactions with savepoints', () => {
    it('should handle simple nested transaction', async () => {
      // Создаем начальные данные
      const user = new User()
      user.id = 1
      user.name = 'Bob'
      user.email = 'bob@example.com'
      em.persist(user)
      await em.flush()

      await em.transactional(async (em) => {
        // Outer transaction
        const userOuter = await em.findOneOrFail(User, 1)
        userOuter.status = 'active'
        await em.flush()

        // Nested transaction (должна создать savepoint)
        await em.transactional(async (em) => {
          const userInner = await em.findOneOrFail(User, 1)
          userInner.name = 'Bob Updated'
          await em.flush()

          // Проверяем что изменения видны
          const updatedUser = await em.findOneOrFail(User, 1)
          expect(updatedUser.name).toBe('Bob Updated')
          expect(updatedUser.status).toBe('active')
        })

        // После успешной nested transaction изменения должны остаться
        const finalUser = await em.findOneOrFail(User, 1)
        expect(finalUser.name).toBe('Bob Updated')
        expect(finalUser.status).toBe('active')
      })

      // Проверяем что изменения сохранились после commit
      const committedUser = await em.findOneOrFail(User, 1)
      expect(committedUser.name).toBe('Bob Updated')
      expect(committedUser.status).toBe('active')
    })

    it('should rollback nested transaction on error', async () => {
      // Создаем начальные данные
      const user = new User()
      user.id = 2
      user.name = 'Charlie'
      user.email = 'charlie@example.com'
      em.persist(user)
      await em.flush()

      await em.transactional(async (em) => {
        // Outer transaction
        const userOuter = await em.findOneOrFail(User, 2)
        userOuter.status = 'pending'
        await em.flush()

        // Nested transaction с ошибкой
        await expect(em.transactional(async (em) => {
          const userInner = await em.findOneOrFail(User, 2)
          userInner.name = 'Charlie Error'
          await em.flush()

          // Симулируем ошибку
          throw new Error('Nested transaction error')
        })).rejects.toThrow('Nested transaction error')

        // После rollback nested transaction изменения должны быть отменены
        const restoredUser = await em.findOneOrFail(User, 2)
        expect(restoredUser.name).toBe('Charlie') // Имя не изменилось
        expect(restoredUser.status).toBe('pending') // Статус из outer transaction остался
      })

      // Проверяем что outer transaction изменения сохранились
      const finalUser = await em.findOneOrFail(User, 2)
      expect(finalUser.name).toBe('Charlie')
      expect(finalUser.status).toBe('pending')
    })
  })
})