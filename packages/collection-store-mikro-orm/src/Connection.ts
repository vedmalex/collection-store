import {
  Configuration,
  Connection,
  ConnectionOptions,
  ConnectionType,
  EntityName,
  EventType,
  IsolationLevel,
  Transaction,
  TransactionEventBroadcaster,
  TransactionOptions as MikroTransactionOptions,
  Utils,
} from '@mikro-orm/core'

import { CSDatabase, Item, type TransactionOptions } from 'collection-store'
import type { CSTransaction } from 'collection-store'
import type { SavepointConnection } from './types'

export class CollectionStoreConnection extends Connection implements SavepointConnection {
  db!: CSDatabase

  constructor(config: Configuration, options?: ConnectionOptions, type: ConnectionType = 'write') {
    super(config, options, type)
    // придумать что тут нужно сделать, а пока для тестов хватит
  }

  getDb() {
    return this.db
  }

  getCollection<T extends Item>(name: EntityName<T>) {
    return this.db.collection<T>(this.getCollectionName(name))
  }

  private getCollectionName<T>(_name: EntityName<T>): string {
    const name = Utils.className(_name)
    const meta = this.metadata.find(Utils.className(name))

    return meta ? meta.collection : name
  }
  override async connect(): Promise<void> {
    if (!this.db) {
      this.db = new CSDatabase(this.getClientUrl(), this.options.dbName)
      await this.db.connect()
    }
  }

  override async isConnected(): Promise<boolean> {
    return !!this.db
  }

  override checkConnection(): Promise<{ ok: true } | { ok: false; reason: string; error?: Error }> {
    return Promise.resolve({ ok: true })
  }

  override getDefaultClientUrl(): string {
    return './data'
  }

  override getClientUrl() {
    const url = this.config.getClientUrl(true)
    return url
  }

  async first(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.db.first(collection)
  }

  async last(entityName: EntityName<any>): Promise<any> {
    const collection = Utils.className(entityName)
    return this.db.last(collection)
  }

  async lowest(entityName: EntityName<any>, key: string) {
    const collection = Utils.className(entityName)
    return this.db.lowest(collection, key)
  }
  async greatest(entityName: EntityName<any>, key: string) {
    const collection = Utils.className(entityName)
    return this.db.greatest(collection, key)
  }
  async oldest(entityName: EntityName<any>) {
    const collection = Utils.className(entityName)
    return this.db.oldest(collection)
  }
  async latest(entityName: EntityName<any>) {
    const collection = Utils.className(entityName)
    return this.db.latest(collection)
  }
  async findById(entityName: EntityName<any>, id: any) {
    const collection = Utils.className(entityName)
    return this.db.findById(collection, id)
  }
  async findBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
    return this.db.findBy(collection, key, id)
  }
  async findFirstBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
    return this.db.findFirstBy(collection, key, id)
  }
  async findLastBy(entityName: EntityName<any>, key: string, id: any) {
    const collection = Utils.className(entityName)
    return this.db.findLastBy(collection, key, id)
  }

  override execute<T>(
    query: string,
    params?: any[] | undefined,
    method?: 'all' | 'get' | 'run' | undefined,
    ctx?: any,
  ): Promise<any> {
    throw new Error(`${this.constructor.name} does not support generic execute method`)
  }

  override async close(force?: boolean) {
    await this.db.close()
  }

  override async ensureConnection() {
    await this.connect()
  }

  // transaction support
  override async transactional<T>(
    cb: (trx: Transaction<CSTransaction>) => Promise<T>,
    options: {
      isolationLevel?: IsolationLevel
      ctx?: Transaction<CSTransaction>
      eventBroadcaster?: TransactionEventBroadcaster
    } & TransactionOptions = {},
  ): Promise<T> {
    await this.ensureConnection()

    // ✅ НОВОЕ: Если есть родительская транзакция, создаем savepoint вместо новой транзакции
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
  override async begin(
    options: {
      isolationLevel?: IsolationLevel
      ctx?: Transaction<CSTransaction>
      eventBroadcaster?: TransactionEventBroadcaster
    } & TransactionOptions = {},
  ): Promise<CSTransaction> {
    await this.ensureConnection()
    const { ctx, isolationLevel, eventBroadcaster, ...txOptions } = options

    // ✅ НОВОЕ: Если есть родительская транзакция, возвращаем её (savepoint будет создан в transactional)
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

  override async commit(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void> {
    await this.ensureConnection()
    await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionCommit, ctx)
    await ctx.commitTransaction()
    this.logQuery('db.commit();')
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionCommit, ctx)
  }

  override async rollback(ctx: CSTransaction, eventBroadcaster?: TransactionEventBroadcaster): Promise<void> {
    await this.ensureConnection()

    await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionRollback, ctx)
    await ctx.abortTransaction()
    this.logQuery('db.rollback();')
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionRollback, ctx)
  }

  // ✅ НОВЫЕ МЕТОДЫ: Savepoint support
  async createSavepoint(ctx: CSTransaction, name: string): Promise<string> {
    await this.ensureConnection()

    try {
      const savepointId = await ctx.createSavepoint(name)
      this.logQuery(`SAVEPOINT ${name}; -- ${savepointId}`)
      return savepointId
    } catch (error) {
      this.logQuery(`SAVEPOINT ${name}; -- FAILED: ${(error as Error).message}`)
      throw error
    }
  }

  async rollbackToSavepoint(ctx: CSTransaction, savepointId: string): Promise<void> {
    await this.ensureConnection()

    try {
      await ctx.rollbackToSavepoint(savepointId)
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId};`)
    } catch (error) {
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId}; -- FAILED: ${(error as Error).message}`)
      throw error
    }
  }

  async releaseSavepoint(ctx: CSTransaction, savepointId: string): Promise<void> {
    await this.ensureConnection()

    try {
      await ctx.releaseSavepoint(savepointId)
      this.logQuery(`RELEASE SAVEPOINT ${savepointId};`)
    } catch (error) {
      this.logQuery(`RELEASE SAVEPOINT ${savepointId}; -- FAILED: ${(error as Error).message}`)
      throw error
    }
  }
}
