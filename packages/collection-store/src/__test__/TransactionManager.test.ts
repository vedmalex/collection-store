/**
 * Tests for TransactionManager
 * Verifies basic transaction functionality and 2PC protocol
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import {
  TransactionManager,
  CollectionStoreTransaction,
  ITransactionResource,
  ChangeRecord
} from '../TransactionManager'

// Mock resource for testing
class MockResource implements ITransactionResource {
  private _prepareResult = true
  private _shouldFailCommit = false
  private _shouldFailRollback = false

  public prepareCallCount = 0
  public commitCallCount = 0
  public rollbackCallCount = 0
  public lastTransactionId?: string

  setPrepareResult(result: boolean) {
    this._prepareResult = result
  }

  setShouldFailCommit(fail: boolean) {
    this._shouldFailCommit = fail
  }

  setShouldFailRollback(fail: boolean) {
    this._shouldFailRollback = fail
  }

  async prepareCommit(transactionId: string): Promise<boolean> {
    this.prepareCallCount++
    this.lastTransactionId = transactionId
    return this._prepareResult
  }

  async finalizeCommit(transactionId: string): Promise<void> {
    this.commitCallCount++
    this.lastTransactionId = transactionId
    if (this._shouldFailCommit) {
      throw new Error('Commit failed')
    }
  }

  async rollback(transactionId: string): Promise<void> {
    this.rollbackCallCount++
    this.lastTransactionId = transactionId
    if (this._shouldFailRollback) {
      throw new Error('Rollback failed')
    }
  }

  reset() {
    this.prepareCallCount = 0
    this.commitCallCount = 0
    this.rollbackCallCount = 0
    this.lastTransactionId = undefined
    this._prepareResult = true
    this._shouldFailCommit = false
    this._shouldFailRollback = false
  }
}

describe('TransactionManager', () => {
  let transactionManager: TransactionManager
  let mockResource1: MockResource
  let mockResource2: MockResource

  beforeEach(() => {
    transactionManager = new TransactionManager()
    mockResource1 = new MockResource()
    mockResource2 = new MockResource()
  })

  describe('Basic Transaction Lifecycle', () => {
    it('should create and manage transactions', async () => {
      const txId = await transactionManager.beginTransaction()

      expect(txId).toBeDefined()
      expect(typeof txId).toBe('string')
      expect(transactionManager.activeTransactionCount).toBe(1)
      expect(transactionManager.getActiveTransactionIds()).toContain(txId)
    })

    it('should get transaction by ID', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      expect(transaction).toBeInstanceOf(CollectionStoreTransaction)
      expect(transaction.transactionId).toBe(txId)
      expect(transaction.status).toBe('ACTIVE')
    })

    it('should throw error for non-existent transaction', () => {
      expect(() => {
        transactionManager.getTransaction('non-existent')
      }).toThrow('Transaction non-existent not found')
    })
  })

  describe('Successful Transaction Commit', () => {
    it('should commit transaction with single resource', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)

      await transactionManager.commitTransaction(txId)

      expect(mockResource1.prepareCallCount).toBe(1)
      expect(mockResource1.commitCallCount).toBe(1)
      expect(mockResource1.rollbackCallCount).toBe(0)
      expect(mockResource1.lastTransactionId).toBe(txId)
      expect(transactionManager.activeTransactionCount).toBe(0)
    })

    it('should commit transaction with multiple resources', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      transaction.addAffectedResource(mockResource2)

      await transactionManager.commitTransaction(txId)

      // Both resources should be prepared and committed
      expect(mockResource1.prepareCallCount).toBe(1)
      expect(mockResource1.commitCallCount).toBe(1)
      expect(mockResource2.prepareCallCount).toBe(1)
      expect(mockResource2.commitCallCount).toBe(1)

      expect(transactionManager.activeTransactionCount).toBe(0)
    })
  })

  describe('Transaction Rollback', () => {
    it('should rollback when prepare fails', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      transaction.addAffectedResource(mockResource2)

      // Make second resource fail prepare
      mockResource2.setPrepareResult(false)

      await expect(transactionManager.commitTransaction(txId)).rejects.toThrow()

      // Both resources should be prepared, but rolled back
      expect(mockResource1.prepareCallCount).toBe(1)
      expect(mockResource2.prepareCallCount).toBe(1)
      expect(mockResource1.commitCallCount).toBe(0)
      expect(mockResource2.commitCallCount).toBe(0)
      expect(mockResource1.rollbackCallCount).toBe(1)
      expect(mockResource2.rollbackCallCount).toBe(1)

      expect(transactionManager.activeTransactionCount).toBe(0)
    })

    it('should rollback explicitly', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)

      await transactionManager.rollbackTransaction(txId)

      expect(mockResource1.prepareCallCount).toBe(0)
      expect(mockResource1.commitCallCount).toBe(0)
      expect(mockResource1.rollbackCallCount).toBe(1)
      expect(transactionManager.activeTransactionCount).toBe(0)
    })
  })

  describe('Change Tracking', () => {
    it('should record and notify changes', async () => {
      const changes: ChangeRecord[] = []
      const listener = (changeList: readonly ChangeRecord[]) => {
        changes.push(...changeList)
      }

      transactionManager.addChangeListener(listener)

      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      transaction.recordChange({
        type: 'insert',
        collection: 'users',
        key: 'user1',
        newValue: { name: 'Alice' },
        timestamp: Date.now()
      })

      await transactionManager.commitTransaction(txId)

      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('insert')
      expect(changes[0].collection).toBe('users')
      expect(changes[0].key).toBe('user1')

      transactionManager.removeChangeListener(listener)
    })

    it('should not notify changes on rollback', async () => {
      const changes: ChangeRecord[] = []
      const listener = (changeList: readonly ChangeRecord[]) => {
        changes.push(...changeList)
      }

      transactionManager.addChangeListener(listener)

      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      transaction.recordChange({
        type: 'insert',
        collection: 'users',
        key: 'user1',
        newValue: { name: 'Alice' },
        timestamp: Date.now()
      })

      await transactionManager.rollbackTransaction(txId)

      expect(changes).toHaveLength(0)

      transactionManager.removeChangeListener(listener)
    })
  })

  describe('Transaction Options', () => {
    it('should respect transaction timeout', async () => {
      const txId = await transactionManager.beginTransaction({ timeout: 100 })
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      await expect(transactionManager.commitTransaction(txId)).rejects.toThrow()
      expect(transactionManager.activeTransactionCount).toBe(0)
    })

    it('should set default isolation level', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      expect(transaction.options.isolationLevel).toBe('SNAPSHOT_ISOLATION')
    })
  })

  describe('Error Handling', () => {
    it('should handle commit failure gracefully', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      mockResource1.setShouldFailCommit(true)

      await expect(transactionManager.commitTransaction(txId)).rejects.toThrow()
      expect(transactionManager.activeTransactionCount).toBe(0)
    })

    it('should handle rollback failure gracefully', async () => {
      const txId = await transactionManager.beginTransaction()
      const transaction = transactionManager.getTransaction(txId)

      transaction.addAffectedResource(mockResource1)
      mockResource1.setShouldFailRollback(true)

      await expect(transactionManager.rollbackTransaction(txId)).rejects.toThrow()
      expect(transactionManager.activeTransactionCount).toBe(0)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup expired transactions', async () => {
      const txId1 = await transactionManager.beginTransaction({ timeout: 50 })
      const txId2 = await transactionManager.beginTransaction({ timeout: 1000 })

      expect(transactionManager.activeTransactionCount).toBe(2)

      // Wait for first transaction to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      await transactionManager.cleanup()

      expect(transactionManager.activeTransactionCount).toBe(1)
      expect(transactionManager.getActiveTransactionIds()).toContain(txId2)
      expect(transactionManager.getActiveTransactionIds()).not.toContain(txId1)
    })
  })
})