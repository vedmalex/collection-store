import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CSDatabase } from '../../core/Database'
import path from 'path'
import fs from 'fs-extra'

describe('CSDatabase Savepoint Support', () => {
  let db: CSDatabase
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../test-data', `db-savepoint-${Date.now()}`)
    await fs.ensureDir(testDir)
    db = new CSDatabase(testDir, 'test-savepoint-db')
    await db.connect()
  })

  afterEach(async () => {
    await db.close()
    await fs.remove(testDir)
  })

  describe('createSavepoint', () => {
    it('should require active transaction', async () => {
      await expect(db.createSavepoint('test-savepoint')).rejects.toThrow(
        'No active transaction. Call startTransaction() first.'
      )
    })

    it('should create savepoint with unique ID', async () => {
      await db.startTransaction()

      const savepointId = await db.createSavepoint('test-savepoint')

      expect(savepointId).toMatch(/^csdb-sp-[\w-]+-\d+-\d+$/)
      expect(db.listSavepoints()).toHaveLength(1)
      expect(db.listSavepoints()[0]).toContain('test-savepoint')

      await db.commitTransaction()
    })

    it('should snapshot collection data', async () => {
      // Создаем коллекцию и добавляем данные
      const collection = await db.createCollection('users')
      await collection.push({ id: 1, name: 'Alice' })
      await collection.push({ id: 2, name: 'Bob' })

      await db.startTransaction()

      const savepointId = await db.createSavepoint('with-data')
      const info = db.getSavepointInfo(savepointId)

      expect(info).toBeDefined()
      expect(info!.name).toBe('with-data')
      expect(info!.collectionsCount).toBe(1)

      await db.commitTransaction()
    })

    it('should handle multiple savepoints', async () => {
      await db.startTransaction()

      const sp1 = await db.createSavepoint('savepoint-1')
      const sp2 = await db.createSavepoint('savepoint-2')
      const sp3 = await db.createSavepoint('savepoint-3')

      expect(db.listSavepoints()).toHaveLength(3)
      expect(sp1).not.toBe(sp2)
      expect(sp2).not.toBe(sp3)

      await db.commitTransaction()
    })

    it('should reject duplicate savepoint names', async () => {
      await db.startTransaction()

      await db.createSavepoint('duplicate-name')

      await expect(db.createSavepoint('duplicate-name')).rejects.toThrow(
        "Savepoint with name 'duplicate-name' already exists"
      )

      await db.commitTransaction()
    })
  })

  describe('rollbackToSavepoint', () => {
    it('should require active transaction', async () => {
      await expect(db.rollbackToSavepoint('non-existent')).rejects.toThrow(
        'No active transaction. Call startTransaction() first.'
      )
    })

    it('should restore collection data', async () => {
      // Создаем коллекцию и добавляем начальные данные
      const collection = await db.createCollection('products')
      await collection.push({ id: 1, name: 'Product A', price: 100 })
      await collection.push({ id: 2, name: 'Product B', price: 200 })

      await db.startTransaction()

      // Создаем savepoint
      const savepointId = await db.createSavepoint('before-changes')

      // Делаем изменения
      await collection.push({ id: 3, name: 'Product C', price: 300 })
      await collection.push({ id: 4, name: 'Product D', price: 400 })

      let data = await collection.find({})
      expect(data).toHaveLength(4)

      // Rollback к savepoint
      await db.rollbackToSavepoint(savepointId)

      // Проверяем что данные восстановлены
      data = await collection.find({})
      expect(data).toHaveLength(2)
      expect(data.map(p => p.name)).toEqual(['Product A', 'Product B'])

      await db.commitTransaction()
    })

    it('should handle nested savepoints correctly', async () => {
      const collection = await db.createCollection('orders')
      await collection.push({ id: 1, status: 'pending' })

      await db.startTransaction()

      // Создаем цепочку savepoints с небольшими задержками
      const sp1 = await db.createSavepoint('level-1')
      await new Promise(resolve => setTimeout(resolve, 5)) // 5ms delay
      await collection.push({ id: 2, status: 'processing' })

      const sp2 = await db.createSavepoint('level-2')
      await new Promise(resolve => setTimeout(resolve, 5)) // 5ms delay
      await collection.push({ id: 3, status: 'shipped' })

      const sp3 = await db.createSavepoint('level-3')
      await new Promise(resolve => setTimeout(resolve, 5)) // 5ms delay
      await collection.push({ id: 4, status: 'delivered' })

      // Проверяем что у нас 3 savepoints
      expect(db.listSavepoints()).toHaveLength(3)

      // Rollback к level-2
      await db.rollbackToSavepoint(sp2)

      // Проверяем состояние - должно быть 2 записи (pending + processing)
      const data = await collection.find({})
      expect(data).toHaveLength(2) // 1 + 1 запись до level-2
      expect(data.map(o => o.status)).toEqual(['pending', 'processing'])

      // Проверяем что savepoint level-3 удален, остались только level-1 и level-2
      expect(db.listSavepoints()).toHaveLength(2)

      await db.commitTransaction()
    })

    it('should throw error for non-existent savepoint', async () => {
      await db.startTransaction()

      await expect(db.rollbackToSavepoint('non-existent')).rejects.toThrow(
        'No savepoints found for transaction'
      )

      await db.commitTransaction()
    })
  })

  describe('releaseSavepoint', () => {
    it('should require active transaction', async () => {
      await expect(db.releaseSavepoint('non-existent')).rejects.toThrow(
        'No active transaction. Call startTransaction() first.'
      )
    })

    it('should remove savepoint data', async () => {
      await db.startTransaction()

      const savepointId = await db.createSavepoint('to-release')
      expect(db.listSavepoints()).toHaveLength(1)

      await db.releaseSavepoint(savepointId)
      expect(db.listSavepoints()).toHaveLength(0)

      await db.commitTransaction()
    })

    it('should handle release of non-existent savepoint', async () => {
      await db.startTransaction()

      await expect(db.releaseSavepoint('non-existent')).rejects.toThrow(
        'No savepoints found for transaction'
      )

      await db.commitTransaction()
    })

    it('should not affect collection state', async () => {
      const collection = await db.createCollection('inventory')
      await collection.push({ id: 1, item: 'Widget A', quantity: 100 })

      await db.startTransaction()

      // Делаем изменения
      await collection.push({ id: 2, item: 'Widget B', quantity: 200 })

      const savepointId = await db.createSavepoint('test-release')

      // Делаем еще изменения
      await collection.push({ id: 3, item: 'Widget C', quantity: 300 })

      // Release savepoint
      await db.releaseSavepoint(savepointId)

      // Проверяем что данные остались
      const data = await collection.find({})
      expect(data).toHaveLength(3)
      expect(data.map(i => i.item)).toEqual(['Widget A', 'Widget B', 'Widget C'])

      await db.commitTransaction()
    })
  })

  describe('listSavepoints and getSavepointInfo', () => {
    it('should return empty list when no transaction', () => {
      expect(db.listSavepoints()).toEqual([])
      expect(db.getSavepointInfo('any-id')).toBeUndefined()
    })

    it('should list savepoints with timestamps', async () => {
      await db.startTransaction()

      await db.createSavepoint('first')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await db.createSavepoint('second')

      const savepoints = db.listSavepoints()
      expect(savepoints).toHaveLength(2)
      expect(savepoints[0]).toContain('first')
      expect(savepoints[1]).toContain('second')

      await db.commitTransaction()
    })

    it('should provide detailed savepoint info', async () => {
      const collection = await db.createCollection('metrics')
      await collection.push({ metric: 'cpu', value: 85 })

      await db.startTransaction()

      const savepointId = await db.createSavepoint('metrics-checkpoint')
      const info = db.getSavepointInfo(savepointId)

      expect(info).toBeDefined()
      expect(info!.savepointId).toBe(savepointId)
      expect(info!.name).toBe('metrics-checkpoint')
      expect(info!.collectionsCount).toBe(1)
      expect(info!.transactionId).toBe(db.getCurrentTransactionId()!)
      expect(typeof info!.timestamp).toBe('number')

      await db.commitTransaction()
    })
  })

  describe('transaction cleanup', () => {
    it('should clear savepoints on commit', async () => {
      await db.startTransaction()

      await db.createSavepoint('sp1')
      await db.createSavepoint('sp2')
      expect(db.listSavepoints()).toHaveLength(2)

      await db.commitTransaction()
      expect(db.listSavepoints()).toHaveLength(0)
    })

    it('should clear savepoints on abort', async () => {
      await db.startTransaction()

      await db.createSavepoint('sp1')
      await db.createSavepoint('sp2')
      expect(db.listSavepoints()).toHaveLength(2)

      await db.abortTransaction()
      expect(db.listSavepoints()).toHaveLength(0)
    })

    it('should handle multiple collections in savepoint', async () => {
      // Создаем несколько коллекций
      const users = await db.createCollection('users')
      const orders = await db.createCollection('orders')

      await users.push({ id: 1, name: 'Alice' })
      await orders.push({ id: 1, userId: 1, total: 100 })

      await db.startTransaction()

      const savepointId = await db.createSavepoint('multi-collection')
      const info = db.getSavepointInfo(savepointId)

      expect(info!.collectionsCount).toBe(2)

      // Делаем изменения в обеих коллекциях
      await users.push({ id: 2, name: 'Bob' })
      await orders.push({ id: 2, userId: 2, total: 200 })

      // Rollback
      await db.rollbackToSavepoint(savepointId)

      // Проверяем что обе коллекции восстановлены
      const usersData = await users.find({})
      const ordersData = await orders.find({})

      expect(usersData).toHaveLength(1)
      expect(ordersData).toHaveLength(1)
      expect(usersData[0].name).toBe('Alice')
      expect(ordersData[0].total).toBe(100)

      await db.commitTransaction()
    })
  })

  describe('error handling', () => {
    it('should handle rollback errors gracefully', async () => {
      await db.startTransaction()

      const savepointId = await db.createSavepoint('error-test')

      // Симулируем ошибку путем повреждения savepoint данных
      const txSavepoints = (db as any).transactionSavepoints.get(db.getCurrentTransactionId())
      const savepointData = txSavepoints.get(savepointId)
      savepointData.collectionsSnapshot.set('non-existent-collection', [])

      // Rollback должен обработать ошибку gracefully (не бросать исключение)
      await db.rollbackToSavepoint(savepointId)

      // Проверяем что rollback завершился успешно
      expect(db.listSavepoints()).toHaveLength(1)

      await db.abortTransaction()
    })

    it('should handle concurrent savepoint operations', async () => {
      await db.startTransaction()

      // Создаем savepoints параллельно
      const promises = [
        db.createSavepoint('concurrent-1'),
        db.createSavepoint('concurrent-2'),
        db.createSavepoint('concurrent-3')
      ]

      const savepointIds = await Promise.all(promises)

      expect(savepointIds).toHaveLength(3)
      expect(new Set(savepointIds).size).toBe(3) // Все ID уникальны
      expect(db.listSavepoints()).toHaveLength(3)

      await db.commitTransaction()
    })
  })
})