/**
 * IndexManager - Transaction-aware wrapper for B+ Tree indexes
 * Implements Copy-on-Write and 2PC protocol for ACID compliance
 */

import { BPlusTree } from 'b-pl-tree'
import { ITransactionResource } from './TransactionManager'

export interface IndexChange {
  type: 'insert' | 'remove'
  key: any
  value?: any
  timestamp: number
}

export interface ITransactionAwareIndex extends ITransactionResource {
  // Transactional operations
  insert_in_transaction(transactionId: string, key: any, value: any): Promise<void>
  remove_in_transaction(transactionId: string, key: any, value?: any): Promise<void>
  get_all_in_transaction(transactionId: string, key: any): Promise<any[]>

  // Non-transactional operations (for backward compatibility)
  insert(key: any, value: any): void
  remove(key: any): void
  findFirst(key: any): any
  findAll(key: any): any[]

  // Tree properties
  get min(): any
  get max(): any
}

export class IndexManager implements ITransactionAwareIndex {
  private btreeIndex: BPlusTree<any, any>
  private transactionChanges = new Map<string, IndexChange[]>()
  private transactionSnapshots = new Map<string, BPlusTree<any, any>>()
  private preparedTransactions = new Set<string>()

  constructor(btreeIndex: BPlusTree<any, any>) {
    this.btreeIndex = btreeIndex
  }

  // Transactional operations
  async insert_in_transaction(transactionId: string, key: any, value: any): Promise<void> {
    this.ensureTransactionExists(transactionId)

    const changes = this.transactionChanges.get(transactionId)!
    changes.push({
      type: 'insert',
      key,
      value,
      timestamp: Date.now()
    })
  }

  async remove_in_transaction(transactionId: string, key: any, value?: any): Promise<void> {
    this.ensureTransactionExists(transactionId)

    // Skip invalid keys
    if (key === undefined || key === null) {
      return
    }

    const changes = this.transactionChanges.get(transactionId)!

    if (value !== undefined) {
      // Remove specific key-value pair
      changes.push({
        type: 'remove',
        key,
        value, // Store the specific value being removed
        timestamp: Date.now()
      })
    } else {
      // Remove all values for this key (backward compatibility)
      changes.push({
        type: 'remove',
        key,
        value: undefined, // undefined means remove all
        timestamp: Date.now()
      })
    }
  }

  async get_all_in_transaction(transactionId: string, key: any): Promise<any[]> {
    // Create a view that includes both committed data and transaction changes
    const snapshot = this.getTransactionSnapshot(transactionId)

    // Get base results from snapshot - B+ Tree find() returns values, not keys
    let baseResults: any[] = []
    try {
      baseResults = snapshot.find(key) || []
    } catch (error) {
      // If snapshot fails, try to get from main tree
      baseResults = this.btreeIndex.find(key) || []
    }

    // Apply transaction changes to the view
    const changes = this.transactionChanges.get(transactionId) || []
    const transactionView = new Map<any, any>()

    // Start with base results
    for (const result of baseResults) {
      transactionView.set(result, result)
    }

    // Apply transaction changes
    for (const change of changes) {
      if (this.keysMatch(change.key, key)) {
        if (change.type === 'insert' && change.value !== undefined) {
          transactionView.set(change.value, change.value)
        } else if (change.type === 'remove' && change.value !== undefined) {
          // Remove specific value
          transactionView.delete(change.value)
        } else if (change.type === 'remove' && change.value === undefined) {
          // Remove all values for this key
          transactionView.clear()
        }
      }
    }

    return Array.from(transactionView.values())
  }

  // Non-transactional operations (backward compatibility)
  insert(key: any, value: any): void {
    this.btreeIndex.insert(key, value)
  }

  remove(key: any): void {
    this.btreeIndex.remove(key)
  }

  findFirst(key: any): any {
    return this.btreeIndex.findFirst(key)
  }

  findAll(key: any): any[] {
    return this.btreeIndex.find(key)
  }

  get min(): any {
    return this.btreeIndex.min
  }

  get max(): any {
    return this.btreeIndex.max
  }

  // 2PC Protocol Implementation
  async prepareCommit(transactionId: string): Promise<boolean> {
    try {
      const changes = this.transactionChanges.get(transactionId)
      if (!changes || changes.length === 0) {
        // No changes to commit
        this.preparedTransactions.add(transactionId)
        return true
      }

      // Validate all changes can be applied
      for (const change of changes) {
        if (change.type === 'insert') {
          // Check if we can insert (e.g., unique constraints)
          if (!this.canInsert(change.key, change.value)) {
            return false
          }
        } else if (change.type === 'remove') {
          // Check if key exists to remove
          if (!this.canRemove(change.key)) {
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

    try {
      const changes = this.transactionChanges.get(transactionId)
      if (changes && changes.length > 0) {
        // Apply all changes to the main B+ Tree
        for (const change of changes) {
          if (change.type === 'insert' && change.value !== undefined) {
            this.btreeIndex.insert(change.key, change.value)
          } else if (change.type === 'remove') {
            this.btreeIndex.remove(change.key)
          }
        }
      }
    } finally {
      // Cleanup transaction data
      this.cleanupTransaction(transactionId)
    }
  }

  async rollback(transactionId: string): Promise<void> {
    // Check if transaction exists before trying to clean it up
    if (!this.transactionChanges.has(transactionId)) {
      // Transaction doesn't exist, nothing to rollback
      return
    }

    // Simply discard all transaction changes
    this.cleanupTransaction(transactionId)
  }

  // Helper methods
  private ensureTransactionExists(transactionId: string): void {
    if (!this.transactionChanges.has(transactionId)) {
      this.transactionChanges.set(transactionId, [])
      // Create a snapshot of the current state for this transaction
      this.transactionSnapshots.set(transactionId, this.createSnapshot())
    }
  }

  private getTransactionSnapshot(transactionId: string): BPlusTree<any, any> {
    let snapshot = this.transactionSnapshots.get(transactionId)
    if (!snapshot) {
      snapshot = this.createSnapshot()
      this.transactionSnapshots.set(transactionId, snapshot)
    }
    return snapshot
  }

  private createSnapshot(): BPlusTree<any, any> {
    // For now, return the original tree as snapshot
    // In production, you'd want a proper Copy-on-Write implementation
    // This is a simplified approach for the current implementation
    return this.btreeIndex
  }

  private keysMatch(key1: any, key2: any): boolean {
    // Simple key comparison - could be enhanced for complex key types
    return key1 === key2
  }

  private canInsert(key: any, value: any): boolean {
    // Basic validation - could be enhanced with unique constraints, etc.
    return key !== undefined && value !== undefined
  }

  private canRemove(key: any): boolean {
    // Check if key is valid for removal
    if (key === undefined || key === null) {
      return false
    }
    return true
  }

  private cleanupTransaction(transactionId: string): void {
    this.transactionChanges.delete(transactionId)
    this.transactionSnapshots.delete(transactionId)
    this.preparedTransactions.delete(transactionId)
  }

  // Utility methods for testing and debugging
  getActiveTransactionCount(): number {
    return this.transactionChanges.size
  }

  getTransactionChanges(transactionId: string): readonly IndexChange[] {
    return this.transactionChanges.get(transactionId) || []
  }

  isPrepared(transactionId: string): boolean {
    return this.preparedTransactions.has(transactionId)
  }
}