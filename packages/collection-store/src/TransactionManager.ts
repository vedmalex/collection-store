/**
 * Transaction Manager for Collection Store
 * Coordinates transactions across collections and indexes using 2PC protocol
 */

import { randomUUID } from 'crypto'

export interface TransactionOptions {
  timeout?: number
  isolationLevel?: 'READ_COMMITTED' | 'SNAPSHOT_ISOLATION'
}

export interface ChangeRecord {
  type: 'insert' | 'update' | 'delete'
  collection: string
  key: any
  oldValue?: any
  newValue?: any
  timestamp: number
}

export interface ITransactionResource {
  prepareCommit(transactionId: string): Promise<boolean>
  finalizeCommit(transactionId: string): Promise<void>
  rollback(transactionId: string): Promise<void>
}

export class CollectionStoreTransaction {
  public readonly transactionId: string
  public readonly startTime: number
  public readonly options: TransactionOptions

  private _affectedResources = new Set<ITransactionResource>()
  private _changes: ChangeRecord[] = []
  private _status: 'ACTIVE' | 'PREPARING' | 'PREPARED' | 'COMMITTED' | 'ABORTED' = 'ACTIVE'

  constructor(transactionId: string, options: TransactionOptions = {}) {
    this.transactionId = transactionId
    this.startTime = Date.now()
    this.options = {
      timeout: 30000, // 30 seconds default
      isolationLevel: 'SNAPSHOT_ISOLATION',
      ...options
    }
  }

  get status() {
    return this._status
  }

  get changes(): readonly ChangeRecord[] {
    return this._changes
  }

  get affectedResources(): ReadonlySet<ITransactionResource> {
    return this._affectedResources
  }

  addAffectedResource(resource: ITransactionResource): void {
    if (this._status !== 'ACTIVE') {
      throw new Error(`Cannot add resource to transaction in ${this._status} state`)
    }
    this._affectedResources.add(resource)
  }

  recordChange(change: ChangeRecord): void {
    if (this._status !== 'ACTIVE') {
      throw new Error(`Cannot record change in transaction in ${this._status} state`)
    }
    this._changes.push(change)
  }

  async prepare(): Promise<boolean> {
    if (this._status !== 'ACTIVE') {
      throw new Error(`Cannot prepare transaction in ${this._status} state`)
    }

    this._status = 'PREPARING'

    try {
      // Check timeout
      if (Date.now() - this.startTime > this.options.timeout!) {
        this._status = 'ABORTED'
        return false
      }

      // Prepare all resources using 2PC
      const prepareResults = await Promise.all(
        Array.from(this._affectedResources).map(resource =>
          resource.prepareCommit(this.transactionId)
        )
      )

      const canCommit = prepareResults.every(result => result === true)

      if (canCommit) {
        this._status = 'PREPARED'
        return true
      } else {
        this._status = 'ABORTED'
        return false
      }
    } catch (error) {
      this._status = 'ABORTED'
      throw error
    }
  }

  async commit(): Promise<void> {
    if (this._status !== 'PREPARED') {
      throw new Error(`Cannot commit transaction in ${this._status} state`)
    }

    try {
      // Finalize commit for all resources
      await Promise.all(
        Array.from(this._affectedResources).map(resource =>
          resource.finalizeCommit(this.transactionId)
        )
      )

      this._status = 'COMMITTED'
    } catch (error) {
      this._status = 'ABORTED'
      throw error
    }
  }

  async rollback(): Promise<void> {
    if (this._status === 'COMMITTED') {
      throw new Error('Cannot rollback committed transaction')
    }

    try {
      // Rollback all resources
      await Promise.all(
        Array.from(this._affectedResources).map(resource =>
          resource.rollback(this.transactionId)
        )
      )

      this._status = 'ABORTED'
    } catch (error) {
      // Even if rollback fails, mark as aborted
      this._status = 'ABORTED'
      throw error
    }
  }
}

export class TransactionManager {
  private _activeTransactions = new Map<string, CollectionStoreTransaction>()
  private _changeListeners: Array<(changes: readonly ChangeRecord[]) => void> = []

  async beginTransaction(options: TransactionOptions = {}): Promise<string> {
    const transactionId = randomUUID()
    const transaction = new CollectionStoreTransaction(transactionId, options)

    this._activeTransactions.set(transactionId, transaction)

    return transactionId
  }

  getTransaction(transactionId: string): CollectionStoreTransaction {
    const transaction = this._activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }
    return transaction
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.getTransaction(transactionId)

    try {
      // Phase 1: Prepare
      const canCommit = await transaction.prepare()

      if (!canCommit) {
        await transaction.rollback()
        throw new Error(`Transaction ${transactionId} failed to prepare`)
      }

      // Phase 2: Commit
      await transaction.commit()

      // Notify change listeners
      if (transaction.changes.length > 0) {
        this._notifyChanges(transaction.changes)
      }

    } finally {
      this._activeTransactions.delete(transactionId)
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.getTransaction(transactionId)

    try {
      await transaction.rollback()
    } finally {
      this._activeTransactions.delete(transactionId)
    }
  }

  addChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void {
    this._changeListeners.push(listener)
  }

  removeChangeListener(listener: (changes: readonly ChangeRecord[]) => void): void {
    const index = this._changeListeners.indexOf(listener)
    if (index !== -1) {
      this._changeListeners.splice(index, 1)
    }
  }

  private _notifyChanges(changes: readonly ChangeRecord[]): void {
    for (const listener of this._changeListeners) {
      try {
        listener(changes)
      } catch (error) {
        console.error('Error in change listener:', error)
      }
    }
  }

  // Cleanup expired transactions
  async cleanup(): Promise<void> {
    const now = Date.now()
    const expiredTransactions: string[] = []

    for (const [txId, transaction] of this._activeTransactions) {
      const timeout = transaction.options.timeout || 30000
      if (now - transaction.startTime > timeout) {
        expiredTransactions.push(txId)
      }
    }

    // Rollback expired transactions
    for (const txId of expiredTransactions) {
      try {
        await this.rollbackTransaction(txId)
      } catch (error) {
        console.error(`Failed to rollback expired transaction ${txId}:`, error)
      }
    }
  }

  get activeTransactionCount(): number {
    return this._activeTransactions.size
  }

  getActiveTransactionIds(): string[] {
    return Array.from(this._activeTransactions.keys())
  }
}