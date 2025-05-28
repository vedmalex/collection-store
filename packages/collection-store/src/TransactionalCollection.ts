/**
 * TransactionalCollection - Transaction-aware wrapper for Collection
 * Provides ACID compliance for all Collection operations
 */

import Collection from './collection'
import { IndexManager, IndexChange } from './IndexManager'
import { ITransactionResource } from './TransactionManager'
import { Item } from './types/Item'
import { ValueType } from 'b-pl-tree'
import { Paths } from './types/Paths'
import { IList } from './IList'

export interface CollectionChange {
  type: 'insert' | 'update' | 'remove'
  id: any
  oldValue?: any
  newValue?: any
  timestamp: number
}

export interface ITransactionalList<T extends Item> extends ITransactionResource {
  // Transactional operations
  set_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>
  update_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined>
  delete_in_transaction(transactionId: string, id: any): Promise<T | undefined>
  get_in_transaction(transactionId: string, id: any): Promise<T | undefined>

  // Basic IList operations
  get(id: any): Promise<T | undefined>
  set(id: any, item: T): Promise<T | undefined>
  update(id: any, item: T): Promise<T | undefined>
  delete(id: any): Promise<T | undefined>
}

/**
 * Transaction-aware wrapper for IList
 */
export class TransactionalListWrapper<T extends Item> implements ITransactionalList<T> {
  private transactionChanges = new Map<string, CollectionChange[]>()
  private preparedTransactions = new Set<string>()
  private list: IList<T>
  private collection: Collection<T>

  constructor(list: IList<T>, collection?: Collection<T>) {
    this.list = list
    this.collection = collection!
  }

  // ITransactionResource implementation
  async prepareCommit(transactionId: string): Promise<boolean> {
    try {
      const changes = this.transactionChanges.get(transactionId) || []

      // Validate all changes can be applied
      for (const change of changes) {
        if (change.type === 'insert' || change.type === 'update') {
          if (!change.newValue) {
            return false
          }
        }
      }

      this.preparedTransactions.add(transactionId)
      return true
    } catch (error) {
      console.error(`Failed to prepare transaction ${transactionId}:`, error)
      return false
    }
  }

  async finalizeCommit(transactionId: string): Promise<void> {
    if (!this.preparedTransactions.has(transactionId)) {
      throw new Error(`Transaction ${transactionId} not prepared`)
    }

    const changes = this.transactionChanges.get(transactionId) || []

    // Apply all changes using Collection methods instead of direct List access
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'insert':
            // Use Collection.push for inserts to ensure proper validation and indexing
            await this.collection.push(change.newValue!)
            break
          case 'update':
            // Use Collection.updateWithId for updates
            await this.collection.updateWithId(change.id, change.newValue!, false)
            break
          case 'remove':
            // Use Collection.removeWithId for removes
            await this.collection.removeWithId(change.id)
            break
        }
      } catch (error) {
        console.error(`Failed to apply change in transaction ${transactionId}:`, error)
        throw error
      }
    }

    this.cleanupTransaction(transactionId)
  }

  async rollback(transactionId: string): Promise<void> {
    if (!this.transactionChanges.has(transactionId)) {
      // Transaction doesn't exist, nothing to rollback
      return
    }

    const changes = this.transactionChanges.get(transactionId)!

    // Rollback changes in reverse order
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i]

      try {
        switch (change.type) {
          case 'insert':
            // Remove the inserted item
            if (this.collection) {
              await this.collection.removeWithId(change.id)
            } else {
              await this.list.delete(change.id)
            }
            break
          case 'update':
            // Restore the old value
            if (change.oldValue) {
              if (this.collection) {
                await this.collection.updateWithId(change.id, change.oldValue, false)
              } else {
                await this.list.set(change.id, change.oldValue)
              }
            } else {
              // If there was no old value, remove the item
              if (this.collection) {
                await this.collection.removeWithId(change.id)
              } else {
                await this.list.delete(change.id)
              }
            }
            break
          case 'remove':
            // Restore the removed item
            if (change.oldValue) {
              if (this.collection) {
                await this.collection.push(change.oldValue)
              } else {
                await this.list.set(change.id, change.oldValue)
              }
            }
            break
        }
      } catch (error) {
        console.error(`Failed to rollback change in transaction ${transactionId}:`, error)
        // Continue with other rollback operations
      }
    }

    this.cleanupTransaction(transactionId)
  }

  private cleanupTransaction(transactionId: string): void {
    this.transactionChanges.delete(transactionId)
    this.preparedTransactions.delete(transactionId)
  }

  // Transactional operations
  async set_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined> {
    this.ensureTransactionExists(transactionId)

    const changes = this.transactionChanges.get(transactionId)!
    const oldValue = await this.get_in_transaction(transactionId, id)

    changes.push({
      type: oldValue ? 'update' : 'insert',
      id,
      oldValue,
      newValue: item,
      timestamp: Date.now()
    })

    return item
  }

  async update_in_transaction(transactionId: string, id: any, item: T): Promise<T | undefined> {
    return this.set_in_transaction(transactionId, id, item)
  }

  async delete_in_transaction(transactionId: string, id: any): Promise<T | undefined> {
    this.ensureTransactionExists(transactionId)

    const oldValue = await this.get_in_transaction(transactionId, id)
    if (!oldValue) {
      return undefined
    }

    const changes = this.transactionChanges.get(transactionId)!
    changes.push({
      type: 'remove',
      id,
      oldValue,
      timestamp: Date.now()
    })

    return oldValue
  }

  async get_in_transaction(transactionId: string, id: any): Promise<T | undefined> {
    // Check transaction changes first
    const changes = this.transactionChanges.get(transactionId) || []

    // Find the latest change for this id
    let latestChange: CollectionChange | undefined
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i].id === id) {
        latestChange = changes[i]
        break
      }
    }

    if (latestChange) {
      if (latestChange.type === 'remove') {
        return undefined
      } else {
        return latestChange.newValue
      }
    }

    // Fall back to committed data
    return this.list.get(id)
  }

  private ensureTransactionExists(transactionId: string): void {
    if (!this.transactionChanges.has(transactionId)) {
      this.transactionChanges.set(transactionId, [])
    }
  }

  // IList implementation (delegate to underlying list for non-transactional operations)
  async get(id: any): Promise<T | undefined> {
    return this.list.get(id)
  }

  async set(id: any, item: T): Promise<T | undefined> {
    return this.list.set(id, item)
  }

  async update(id: any, item: T): Promise<T | undefined> {
    return this.list.update(id, item)
  }

  async delete(id: any): Promise<T | undefined> {
    return this.list.delete(id)
  }

  getTransactionChanges(transactionId: string): CollectionChange[] {
    return [...(this.transactionChanges.get(transactionId) || [])]
  }
}

/**
 * Transaction-aware Collection wrapper
 */
export class TransactionalCollection<T extends Item> implements ITransactionResource {
  private indexManagers = new Map<string, IndexManager>()
  private transactionalList: TransactionalListWrapper<T>
  private collection: Collection<T>

  constructor(collection: Collection<T>) {
    this.collection = collection
    // Wrap the list with transactional capabilities
    this.transactionalList = new TransactionalListWrapper(collection.list, collection)

    // Create IndexManager for each index
    for (const [indexName, btree] of Object.entries(collection.indexes)) {
      this.indexManagers.set(indexName, new IndexManager(btree))
    }
  }

  // ITransactionResource implementation
  async prepareCommit(transactionId: string): Promise<boolean> {
    try {
      // Prepare list changes
      const listReady = await this.transactionalList.prepareCommit(transactionId)
      if (!listReady) {
        return false
      }

      // Prepare all index changes
      for (const indexManager of this.indexManagers.values()) {
        const indexReady = await indexManager.prepareCommit(transactionId)
        if (!indexReady) {
          return false
        }
      }

      return true
    } catch (error) {
      console.error(`Failed to prepare collection transaction ${transactionId}:`, error)
      return false
    }
  }

  async finalizeCommit(transactionId: string): Promise<void> {
    // Commit list changes first
    await this.transactionalList.finalizeCommit(transactionId)

    // Then commit all index changes
    for (const indexManager of this.indexManagers.values()) {
      await indexManager.finalizeCommit(transactionId)
    }
  }

  async rollback(transactionId: string): Promise<void> {
    // Rollback list changes
    await this.transactionalList.rollback(transactionId)

    // Rollback all index changes
    for (const indexManager of this.indexManagers.values()) {
      await indexManager.rollback(transactionId)
    }
  }

  // Transactional CRUD operations
  async create_in_transaction(transactionId: string, item: T): Promise<T | undefined> {
    // Generate ID if needed
    const id = item[this.collection.id]

    // Validate item
    const validation = this.collection.validator(item)
    if (!validation.success) {
      const errorMessage = 'errors' in validation ? validation.errors.toString() : 'Validation failed'
      throw new Error(`Validation failed: ${errorMessage}`)
    }

    // Insert into list
    const result = await this.transactionalList.set_in_transaction(transactionId, id, item)

    // Update all indexes
    for (const [indexName, indexManager] of this.indexManagers.entries()) {
      const indexDef = this.collection.indexDefs[indexName]
      if (indexDef) {
        let indexValue: any
        if (indexDef.process && typeof indexDef.process === 'function') {
          // Apply process function to the full item
          indexValue = indexDef.process(item)
        } else {
          // Extract value manually
          indexValue = this.getIndexValue(item, indexDef)
        }
        await indexManager.insert_in_transaction(transactionId, indexValue, id)
      }
    }

    return result
  }

  async update_in_transaction(transactionId: string, id: ValueType, update: Partial<T>, merge: boolean = true): Promise<T | undefined> {
    // Get current item
    const currentItem = await this.findById_in_transaction(transactionId, id)
    if (!currentItem) {
      return undefined
    }

    // Create updated item
    const updatedItem = merge
      ? { ...currentItem, ...update } as T
      : { ...currentItem, ...update } as T

    // Validate updated item
    const validation = this.collection.validator(updatedItem)
    if (!validation.success) {
      const errorMessage = 'errors' in validation ? validation.errors.toString() : 'Validation failed'
      throw new Error(`Validation failed: ${errorMessage}`)
    }

    // Update in list
    const result = await this.transactionalList.update_in_transaction(transactionId, id, updatedItem)

    // Update all indexes
    for (const [indexName, indexManager] of this.indexManagers.entries()) {
      const indexDef = this.collection.indexDefs[indexName]
      if (indexDef) {
        // Remove old index entry
        let oldIndexValue: any
        if (indexDef.process && typeof indexDef.process === 'function') {
          oldIndexValue = indexDef.process(currentItem)
        } else {
          oldIndexValue = this.getIndexValue(currentItem, indexDef)
        }
        await indexManager.remove_in_transaction(transactionId, oldIndexValue, id)

        // Add new index entry
        let newIndexValue: any
        if (indexDef.process && typeof indexDef.process === 'function') {
          newIndexValue = indexDef.process(updatedItem)
        } else {
          newIndexValue = this.getIndexValue(updatedItem, indexDef)
        }
        await indexManager.insert_in_transaction(transactionId, newIndexValue, id)
      }
    }

    return result
  }

  async remove_in_transaction(transactionId: string, id: ValueType): Promise<T | undefined> {
    // Get current item
    const currentItem = await this.findById_in_transaction(transactionId, id)
    if (!currentItem) {
      return undefined
    }

    // Remove from list
    const result = await this.transactionalList.delete_in_transaction(transactionId, id)

    // Remove from all indexes
    for (const [indexName, indexManager] of this.indexManagers.entries()) {
      const indexDef = this.collection.indexDefs[indexName]
      if (indexDef) {
        let indexValue: any
        if (indexDef.process && typeof indexDef.process === 'function') {
          indexValue = indexDef.process(currentItem)
        } else {
          indexValue = this.getIndexValue(currentItem, indexDef)
        }
        await indexManager.remove_in_transaction(transactionId, indexValue, id)
      }
    }

    return result
  }

  async findById_in_transaction(transactionId: string, id: ValueType): Promise<T | undefined> {
    // For findById, we don't need to process the ID - we search by the raw ID value
    // The process function is used when creating index values from items, not for searching
    const result = await this.transactionalList.get_in_transaction(transactionId, id)
    return result
  }

  async findBy_in_transaction(transactionId: string, key: Paths<T>, value: ValueType): Promise<Array<T>> {
    const indexManager = this.indexManagers.get(key as string)
    if (!indexManager) {
      throw new Error(`Index for ${key} not found`)
    }

    // For search, we use the raw value - process function is only for creating index values from items
    const ids = await indexManager.get_all_in_transaction(transactionId, value)

    const results: T[] = []

    for (const id of ids) {
      const item = await this.transactionalList.get_in_transaction(transactionId, id)
      if (item) {
        results.push(item)
      }
    }

    return results
  }

  // Helper methods
  private getIndexValue(item: T, indexDef: any): any {
    if (indexDef.keys && indexDef.keys.length > 1) {
      // Composite index
      const values = indexDef.keys.map((keyInfo: any) => {
        const key = typeof keyInfo === 'string' ? keyInfo : keyInfo.key
        return item[key as keyof T]
      })
      return values.join(indexDef.separator || '|')
    } else {
      // Single key index
      const key = indexDef.key || indexDef.keys?.[0]?.key || indexDef.keys?.[0]
      const value = item[key as keyof T]
      return value
    }
  }

  // Delegate non-transactional operations to original collection
  get originalCollection(): Collection<T> {
    return this.collection
  }

  getTransactionChanges(transactionId: string): {
    list: CollectionChange[]
    indexes: { [indexName: string]: IndexChange[] }
  } {
    const listChanges = this.transactionalList.getTransactionChanges(transactionId)
    const indexChanges: { [indexName: string]: IndexChange[] } = {}

    for (const [indexName, indexManager] of this.indexManagers.entries()) {
      indexChanges[indexName] = [...indexManager.getTransactionChanges(transactionId)]
    }

    return {
      list: listChanges,
      indexes: indexChanges
    }
  }
}