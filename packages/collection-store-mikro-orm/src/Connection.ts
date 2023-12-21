import {
  Configuration,
  Connection,
  ConnectionOptions,
  ConnectionType,
  EventType,
  IsolationLevel,
  Transaction,
  TransactionEventBroadcaster,
  TransactionOptions,
} from '@mikro-orm/core'

import { debug } from 'debug'
const log = debug('connections')

import { CSDatabase } from 'collection-store'
import { CSTransaction } from 'collection-store/src/CSDatabase'

export class CollectionStoreConnection extends Connection {
  db!: CSDatabase

  constructor(
    config: Configuration,
    options?: ConnectionOptions,
    type: ConnectionType = 'write',
  ) {
    log('constructor', arguments)
    super(config, options, type)
    // придумать что тут нужно сделать, а пока для тестов хватит
  }

  getDb() {
    log('getDb')
    return this.db
  }

  override async connect(): Promise<void> {
    log('connect')
    if (!this.db) {
      this.db = new CSDatabase(this.getClientUrl(), this.options.dbName)
      await this.db.connect()
    }
  }

  override async isConnected(): Promise<boolean> {
    log('isConnected')
    return !!this.db
  }

  override checkConnection(): Promise<{
    ok: boolean
    reason?: string | undefined
    error?: Error | undefined
  }> {
    log('checkConnection')
    return Promise.resolve({ ok: true })
  }

  override getDefaultClientUrl(): string {
    log('getDefaultClientUrl')
    return './data'
  }

  override getClientUrl() {
    log('getClientUrl')
    const url = this.config.getClientUrl(true)
    return url
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
    log('close', arguments)
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
