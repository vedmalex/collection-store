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
  TransactionOptions,
  Utils,
} from '@mikro-orm/core'

//@ts-ignore
import { CSDatabase, Item } from 'collection-store'
//@ts-ignore
import type { CSTransaction } from 'collection-store'

export class CollectionStoreConnection extends Connection {
  db!: CSDatabase

  constructor(
    config: Configuration,
    options?: ConnectionOptions,
    type: ConnectionType = 'write',
  ) {
    super(config, options, type)
    // придумать что тут нужно сделать, а пока для тестов хватит
  }

  getDb() {
    return this.db
  }

  getCollection<T extends Item>(name: EntityName<T>) {
    return this.db.collection<T>(this.getCollectionName(name))
  }

  private getCollectionName<T>(name: EntityName<T>): string {
    name = Utils.className(name)
    const meta = this.metadata.find(name)

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

  override checkConnection(): Promise<{
    ok: boolean
    reason?: string | undefined
    error?: Error | undefined
  }> {
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
    return this.db.first(collection)
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
    throw new Error(
      `${this.constructor.name} does not support generic execute method`,
    )
  }

  override async close(force?: boolean) {
    this.db.close()
  }

  override async ensureConnection() {
    this.connect()
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
  override async begin(
    options: {
      isolationLevel?: IsolationLevel
      ctx?: Transaction<CSTransaction>
      eventBroadcaster?: TransactionEventBroadcaster
    } & TransactionOptions = {},
  ): Promise<CSTransaction> {
    await this.ensureConnection()
    const { ctx, isolationLevel, eventBroadcaster, ...txOptions } = options

    if (!ctx) {
      await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionStart)
    }
    const session = ctx || (await this.db.startSession())
    session.startTransaction(txOptions)
    this.logQuery('db.begin();')
    await eventBroadcaster?.dispatchEvent(
      EventType.afterTransactionStart,
      session,
    )

    return session
  }

  override async commit(
    ctx: CSTransaction,
    eventBroadcaster?: TransactionEventBroadcaster,
  ): Promise<void> {
    await this.ensureConnection()
    await eventBroadcaster?.dispatchEvent(
      EventType.beforeTransactionCommit,
      ctx,
    )
    await ctx.commitTransaction()
    this.logQuery('db.commit();')
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionCommit, ctx)
  }

  override async rollback(
    ctx: CSTransaction,
    eventBroadcaster?: TransactionEventBroadcaster,
  ): Promise<void> {
    await this.ensureConnection()

    await eventBroadcaster?.dispatchEvent(
      EventType.beforeTransactionRollback,
      ctx,
    )
    await ctx.abortTransaction()
    this.logQuery('db.rollback();')
    await eventBroadcaster?.dispatchEvent(
      EventType.afterTransactionRollback,
      ctx,
    )
  }
}
