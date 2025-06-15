import fs from 'fs'
import path from 'path'
import fse from 'fs-extra'
import { ICollectionConfig, ISerializedCollectionConfig } from '../types/ICollectionConfig'
import { IDataCollection } from '../types/IDataCollection'
import Collection from './Collection'
import { Item } from '../types/Item'

import AdapterFile from '../storage/adapters/AdapterFile'
import AdapterMemory from '../storage/adapters/AdapterMemory'
import { deserialize_collection_config } from '../collection/deserialize_collection_config'
import { serialize_collection_config } from '../collection/serialize_collection_config'
import { FileStorage } from '../storage/FileStorage'
import { List } from '../storage/List'
import { IndexDef } from '../types/IndexDef'
import {
  TransactionManager,
  TransactionOptions,
  ChangeRecord,
  CollectionStoreTransaction,
  CSTransaction,
  SavepointInfo,
  CSDBSavepointData
} from '../transactions/TransactionManager'

// biome-ignore lint/complexity/noBannedTypes: будет обновлен
export type { TransactionOptions }

export class CSDatabase implements CSTransaction {
  private root: string
  private name: string
  private inTransaction = false
  private collections: Map<string, Collection<any>>
  private transactionManager: TransactionManager
  private currentTransactionId?: string
  private transactionSnapshots: Map<string, Map<string, any[]>> = new Map()

  // ✅ НОВЫЕ ПОЛЯ: Savepoint support
  private transactionSavepoints: Map<string, Map<string, CSDBSavepointData>> = new Map()
  private savepointCounter: number = 0
  private savepointNameToId: Map<string, Map<string, string>> = new Map() // txId -> name -> savepointId

  constructor(root: string, name?: string) {
    this.root = root
    this.name = name || 'default'
    this.collections = new Map()
    this.transactionManager = new TransactionManager()
  }

  private async writeSchema() {
    if (this.root === ':memory:') {
      return // Skip file operations for in-memory databases
    }

    const result = {} as Record<string, ISerializedCollectionConfig>
    this.collections.forEach((collection, name) => {
      result[name] = serialize_collection_config(collection)
    })
    await fse.ensureDir(this.root)
    fs.writeFileSync(path.join(this.root, `${this.name}.json`), JSON.stringify(result, null, 2))
  }

  async connect() {
    await this.load()
  }

  async load() {
    if (this.root === ':memory:') {
      return // Skip file operations for in-memory databases
    }

    const exists = fs.existsSync(path.join(this.root, `${this.name}.json`))
    if (!exists) {
      fse.ensureDirSync(this.root)
    } else {
      const result = fse.readJSONSync(path.join(this.root, `${this.name}.json`)) as Record<
        string,
        ISerializedCollectionConfig
      >

      this.collections.clear()
      for (const name in result) {
        const config = result[name]
        const collection = Collection.create(deserialize_collection_config(config))
        await collection.load()
        this.registerCollection(collection)
      }
    }
  }

  async close() {}

  collectionList: Map<string, ICollectionConfig<any>> = new Map()

  private registerCollection(collection: Collection<any>) {
    // For testing purposes, allow overwriting collections
    if (this.collections.has(collection.name)) {
      console.warn(`[CSDatabase] Overwriting existing collection: ${collection.name}`)
      const existingCollection = this.collections.get(collection.name)
      if (existingCollection) {
        // Clean up existing collection
        existingCollection.reset().catch(err => console.warn('Failed to reset existing collection:', err))
      }
    }
    this.collections.set(collection.name, collection)
  }

  async createCollection<T extends Item>(name: string): Promise<IDataCollection<T>> {
    const [, collectionType = 'List'] = name.split(':')

    // Determine adapter based on root path (MikroORM convention)
    const adapter = this.root === ':memory:'
      ? new AdapterMemory<T>()
      : new AdapterFile<T>()

    const collection = Collection.create({
      name,
      list: collectionType === 'List' ? new List<T>() : new FileStorage<T>(),
      adapter,
      root: this.root === ':memory:' ? ':memory:' : path.join(this.root, this.name),
      dbName: this.root === ':memory:' ? ':memory:' : undefined,
    })

    this.registerCollection(collection)
    await this.writeSchema()
    return collection
  }

  listCollections(): Array<IDataCollection<any>> {
    const result: Array<IDataCollection<any>> = []
    this.collections.forEach((collection) => {
      result.push(collection)
    })
    return result
  }

  async dropCollection(name: string): Promise<boolean> {
    let result = false
    if (this.collections.has(name)) {
      const collection = this.collections.get(name)!
      await collection.reset()
      result = this.collections.delete(name)
      await this.writeSchema()
    }
    return result
  }

  collection<T extends Item>(name: string): IDataCollection<T> | undefined {
    if (this.collections.has(name)) {
      return this.collections.get(name)
    }
    throw new Error(`collection ${name} not found`)
  }

  async createIndex(collection: string, name: string, def: IndexDef<any>) {
    if (this.collections.has(collection)) {
      const col = this.collections.get(collection)!
      if (col.listIndexes(name)) {
        col.dropIndex(name)
        await col.createIndex(name, def)
      }
      await this.writeSchema()
      return
    }
    throw new Error(`collection ${collection} not found`)
  }

  async dropIndex(collection: string, name: string) {
    if (this.collections.has(collection)) {
      this.collections.get(collection)?.dropIndex(name)
      await this.writeSchema()
      return
    }
    throw new Error(`collection ${collection} not found`)
  }

  async persist() {
    // ✅ ИСПРАВЛЕНИЕ: Не сохраняем in-memory коллекции на диск
    if (this.root === ':memory:') {
      return Promise.resolve([]) // Skip persistence for in-memory databases
    }

    const res: Array<Promise<void>> = []
    this.collections.forEach((collection) => {
      res.push(collection.persist())
    })
    return Promise.all(res)
  }

  async startSession(): Promise<CSTransaction> {
    if (!this.inTransaction) {
      await this.persist()
    }
    return this
  }

  async endSession(): Promise<void> {
    if (this.currentTransactionId) {
      try {
        await this.transactionManager.rollbackTransaction(this.currentTransactionId)
      } catch (error) {
        console.error('Error rolling back transaction during endSession:', error)
      }
      this.transactionSnapshots.delete(this.currentTransactionId)
      this.currentTransactionId = undefined
    }
    this.inTransaction = false
  }

  async startTransaction(options: TransactionOptions = {}): Promise<void> {
    if (this.inTransaction && this.currentTransactionId) {
      throw new Error('Transaction already active. Call commitTransaction() or abortTransaction() first.')
    }

    this.currentTransactionId = await this.transactionManager.beginTransaction(options)
    this.inTransaction = true

    // Create snapshot of all collections
    const snapshot = new Map<string, any[]>()
    for (const [name, collection] of this.collections) {
      const data = await collection.find({})
      snapshot.set(name, JSON.parse(JSON.stringify(data))) // Deep clone
    }
    this.transactionSnapshots.set(this.currentTransactionId, snapshot)
  }

  async abortTransaction(): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction to abort')
    }

    try {
      // ✅ НОВОЕ: Очищаем savepoints перед abort
      console.log(`[CSDatabase] Clearing ${this.transactionSavepoints.get(this.currentTransactionId)?.size || 0} savepoints before abort`)
      this.clearTransactionSavepoints(this.currentTransactionId)

      // Restore data from snapshot
      const snapshot = this.transactionSnapshots.get(this.currentTransactionId)
      if (snapshot) {
        for (const [collectionName, snapshotData] of snapshot) {
          const collection = this.collections.get(collectionName)
          if (collection) {
            // Clear current data
            await collection.reset()

            // Restore from snapshot
            for (const item of snapshotData) {
              await collection.push(item)
            }
          }
        }
      }

      await this.transactionManager.rollbackTransaction(this.currentTransactionId)
    } finally {
      this.transactionSnapshots.delete(this.currentTransactionId)
      this.currentTransactionId = undefined
      this.inTransaction = false
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction to commit')
    }

    try {
      // ✅ НОВОЕ: Очищаем savepoints перед commit
      console.log(`[CSDatabase] Clearing ${this.transactionSavepoints.get(this.currentTransactionId)?.size || 0} savepoints before commit`)
      this.clearTransactionSavepoints(this.currentTransactionId)

      await this.transactionManager.commitTransaction(this.currentTransactionId)
      await this.persist()
    } finally {
      this.transactionSnapshots.delete(this.currentTransactionId)
      this.currentTransactionId = undefined
      this.inTransaction = false
    }
  }

  // ✅ НОВЫЙ ПРИВАТНЫЙ МЕТОД: Очистка savepoints для транзакции
  private clearTransactionSavepoints(transactionId: string): void {
    const txSavepoints = this.transactionSavepoints.get(transactionId)
    if (txSavepoints) {
      // Освобождаем память от snapshot данных
      for (const savepointData of txSavepoints.values()) {
        savepointData.collectionsSnapshot.clear()
        savepointData.btreeContextSnapshots.clear()
      }
      txSavepoints.clear()
    }

    // Очищаем name mapping
    const txNameMapping = this.savepointNameToId.get(transactionId)
    if (txNameMapping) {
      txNameMapping.clear()
    }

    // Удаляем Maps для этой транзакции
    this.transactionSavepoints.delete(transactionId)
    this.savepointNameToId.delete(transactionId)
  }

  getCurrentTransaction(): CollectionStoreTransaction | undefined {
    if (this.currentTransactionId) {
      return this.transactionManager.getTransaction(this.currentTransactionId)
    }
    return undefined
  }

  getCurrentTransactionId(): string | undefined {
    return this.currentTransactionId
  }

  addChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void {
    this.transactionManager.addChangeListener(listener)
  }

  removeChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void {
    this.transactionManager.removeChangeListener(listener)
  }

  async cleanupTransactions(): Promise<void> {
    await this.transactionManager.cleanup()
  }

  async forceResetTransactionState(): Promise<void> {
    this.inTransaction = false
    this.currentTransactionId = undefined
    this.transactionSnapshots.clear()
    await this.transactionManager.cleanup()
  }

  // ✅ НОВЫЙ МЕТОД: Очистка коллекций для тестирования
  async clearCollections(): Promise<void> {
    // Очищаем все коллекции
    for (const [name, collection] of this.collections) {
      try {
        await collection.reset()
      } catch (error) {
        console.warn(`Failed to reset collection ${name}:`, error)
      }
    }

    // Очищаем Map коллекций
    this.collections.clear()

    // Очищаем список конфигураций коллекций
    this.collectionList.clear()

    // Сбрасываем состояние транзакций
    this.inTransaction = false
    this.currentTransactionId = undefined
    this.transactionSnapshots.clear()
    this.transactionSavepoints.clear()
    this.savepointNameToId.clear()
    this.savepointCounter = 0
  }

  get activeTransactionCount(): number {
    return this.transactionManager.activeTransactionCount
  }

  // extra operations

  async first(collection: string): Promise<any> {
    return this.collections.get(collection)!.first()
  }
  async last(collection: string): Promise<any> {
    return this.collections.get(collection)!.last()
  }
  async lowest(collection: string, key: string): Promise<any> {
    return this.collections.get(collection)!.lowest(key)
  }
  async greatest(collection: string, key: string): Promise<any> {
    return this.collections.get(collection)!.greatest(key)
  }
  async oldest(collection: string): Promise<any> {
    return this.collections.get(collection)!.oldest()
  }
  async latest(collection: string): Promise<any> {
    return this.collections.get(collection)!.latest()
  }
  async findById(collection: string, id: any) {
    return this.collections.get(collection)!.findById(id)
  }
  async findBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)!.findBy(key, id)
  }
  async findFirstBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)!.findFirstBy(key, id)
  }
  async findLastBy(collection: string, key: string, id: any) {
    return this.collections.get(collection)?.findLastBy(key, id)
  }

  // ✅ НОВЫЕ МЕТОДЫ: Savepoint support
  async createSavepoint(name: string): Promise<string> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.')
    }

    // Проверяем уникальность имени в рамках текущей транзакции
    const txSavepointNames = this.savepointNameToId.get(this.currentTransactionId)
    if (txSavepointNames?.has(name)) {
      throw new Error(`Savepoint with name '${name}' already exists in transaction ${this.currentTransactionId}`)
    }

    // Генерируем уникальный ID
    const savepointId = `csdb-sp-${this.currentTransactionId}-${++this.savepointCounter}-${Date.now()}`

    console.log(`[CSDatabase] Creating savepoint '${name}' (${savepointId}) for transaction ${this.currentTransactionId}`)

    // Создаем snapshot всех коллекций
    const collectionsSnapshot = new Map<string, any[]>()
    for (const [collectionName, collection] of this.collections) {
      const data = await collection.find({})
      collectionsSnapshot.set(collectionName, JSON.parse(JSON.stringify(data))) // Deep clone
    }

    // Создаем savepoints в B+ Tree контекстах для каждой коллекции
    const btreeContextSnapshots = new Map<string, string>()
    for (const [collectionName, collection] of this.collections) {
      // Получаем TransactionContext для этой коллекции (если есть)
      const btreeContext = (collection as any)._transactionContext
      if (btreeContext && typeof btreeContext.createSavepoint === 'function') {
        try {
          const btreeSavepointId = await btreeContext.createSavepoint(`${name}-${collectionName}`)
          btreeContextSnapshots.set(collectionName, btreeSavepointId)
          console.log(`[CSDatabase] Created B+ Tree savepoint for collection '${collectionName}': ${btreeSavepointId}`)
        } catch (error) {
          console.warn(`[CSDatabase] Failed to create B+ Tree savepoint for collection '${collectionName}':`, error)
        }
      }
    }

    // Сохраняем данные savepoint
    const savepointData: CSDBSavepointData = {
      savepointId,
      name,
      timestamp: Date.now(),
      transactionId: this.currentTransactionId,
      collectionsSnapshot,
      btreeContextSnapshots
    }

    // Инициализируем Maps если нужно
    if (!this.transactionSavepoints.has(this.currentTransactionId)) {
      this.transactionSavepoints.set(this.currentTransactionId, new Map())
    }
    if (!this.savepointNameToId.has(this.currentTransactionId)) {
      this.savepointNameToId.set(this.currentTransactionId, new Map())
    }

    // Сохраняем savepoint
    this.transactionSavepoints.get(this.currentTransactionId)!.set(savepointId, savepointData)
    this.savepointNameToId.get(this.currentTransactionId)!.set(name, savepointId)

    console.log(`[CSDatabase] Created savepoint '${name}' (${savepointId}) with ${collectionsSnapshot.size} collections and ${btreeContextSnapshots.size} B+ Tree contexts`)
    return savepointId
  }

  async rollbackToSavepoint(savepointId: string): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.')
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId)
    if (!txSavepoints) {
      throw new Error(`No savepoints found for transaction ${this.currentTransactionId}`)
    }

    const savepointData = txSavepoints.get(savepointId)
    if (!savepointData) {
      throw new Error(`Savepoint ${savepointId} not found in transaction ${this.currentTransactionId}`)
    }

    console.log(`[CSDatabase] Rolling back to savepoint '${savepointData.name}' (${savepointId})`)

    try {
      // 1. Rollback B+ Tree contexts сначала
      for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
        const collection = this.collections.get(collectionName)
        if (collection) {
          const btreeContext = (collection as any)._transactionContext
          if (btreeContext && typeof btreeContext.rollbackToSavepoint === 'function') {
            try {
              await btreeContext.rollbackToSavepoint(btreeSavepointId)
              console.log(`[CSDatabase] Rolled back B+ Tree context for collection '${collectionName}' to savepoint ${btreeSavepointId}`)
            } catch (error) {
              console.error(`[CSDatabase] Failed to rollback B+ Tree context for collection '${collectionName}':`, error)
              throw error
            }
          }
        }
      }

      // 2. Восстанавливаем данные коллекций
      for (const [collectionName, snapshotData] of savepointData.collectionsSnapshot) {
        const collection = this.collections.get(collectionName)
        if (collection) {
          // Очищаем текущие данные
          await collection.reset()

          // Восстанавливаем из snapshot
          for (const item of snapshotData) {
            await collection.push(item)
          }
          console.log(`[CSDatabase] Restored collection '${collectionName}' with ${snapshotData.length} items`)
        }
      }

      // 3. Удаляем все savepoints созданные после этого
      const savePointsToRemove: string[] = []
      for (const [spId, sp] of txSavepoints) {
        if (sp.timestamp > savepointData.timestamp) {
          savePointsToRemove.push(spId)
        }
      }

      for (const spId of savePointsToRemove) {
        const sp = txSavepoints.get(spId)
        if (sp) {
          this.savepointNameToId.get(this.currentTransactionId)?.delete(sp.name)
          txSavepoints.delete(spId)
          console.log(`[CSDatabase] Removed savepoint '${sp.name}' (${spId}) created after rollback point`)
        }
      }

      console.log(`[CSDatabase] Rollback completed. Restored ${savepointData.collectionsSnapshot.size} collections`)
    } catch (error) {
      console.error(`[CSDatabase] Error during rollback to savepoint ${savepointId}:`, error)
      throw error
    }
  }

  async releaseSavepoint(savepointId: string): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.')
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId)
    if (!txSavepoints) {
      throw new Error(`No savepoints found for transaction ${this.currentTransactionId}`)
    }

    const savepointData = txSavepoints.get(savepointId)
    if (!savepointData) {
      throw new Error(`Savepoint ${savepointId} not found in transaction ${this.currentTransactionId}`)
    }

    console.log(`[CSDatabase] Releasing savepoint '${savepointData.name}' (${savepointId})`)

    // Release B+ Tree savepoints
    for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
      const collection = this.collections.get(collectionName)
      if (collection) {
        const btreeContext = (collection as any)._transactionContext
        if (btreeContext && typeof btreeContext.releaseSavepoint === 'function') {
          try {
            await btreeContext.releaseSavepoint(btreeSavepointId)
            console.log(`[CSDatabase] Released B+ Tree savepoint for collection '${collectionName}': ${btreeSavepointId}`)
          } catch (error) {
            console.warn(`[CSDatabase] Failed to release B+ Tree savepoint for collection '${collectionName}':`, error)
          }
        }
      }
    }

    // Удаляем savepoint
    txSavepoints.delete(savepointId)
    this.savepointNameToId.get(this.currentTransactionId)?.delete(savepointData.name)

    // Освобождаем память от snapshot данных
    savepointData.collectionsSnapshot.clear()
    savepointData.btreeContextSnapshots.clear()

    console.log(`[CSDatabase] Released savepoint '${savepointData.name}' (${savepointId})`)
  }

  listSavepoints(): string[] {
    if (!this.inTransaction || !this.currentTransactionId) {
      return []
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId)
    if (!txSavepoints) {
      return []
    }

    const savepoints: string[] = []
    for (const savepointData of txSavepoints.values()) {
      savepoints.push(`${savepointData.name} (${savepointData.savepointId}) - ${new Date(savepointData.timestamp).toISOString()}`)
    }
    return savepoints.sort()
  }

  getSavepointInfo(savepointId: string): SavepointInfo | undefined {
    if (!this.inTransaction || !this.currentTransactionId) {
      return undefined
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId)
    if (!txSavepoints) {
      return undefined
    }

    const savepointData = txSavepoints.get(savepointId)
    if (!savepointData) {
      return undefined
    }

    return {
      savepointId: savepointData.savepointId,
      name: savepointData.name,
      timestamp: savepointData.timestamp,
      transactionId: savepointData.transactionId,
      collectionsCount: savepointData.collectionsSnapshot.size,
      btreeContextsCount: savepointData.btreeContextSnapshots.size
    }
  }
}
