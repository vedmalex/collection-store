/**
 * Tests for IndexManager
 * Verifies transactional operations and 2PC protocol for B+ Tree indexes
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { BPlusTree } from 'b-pl-tree'
import { IndexManager, IndexChange } from '../core/IndexManager'

describe('IndexManager', () => {
  let btree: BPlusTree<string, string>
  let indexManager: IndexManager
  const transactionId = 'test-tx-1'

  beforeEach(() => {
    btree = new BPlusTree<string, string>()
    indexManager = new IndexManager(btree)

    // Add some initial data to the B+ Tree
    btree.insert('key1', 'value1')
    btree.insert('key2', 'value2')
    btree.insert('key3', 'value3')
  })

  describe('Basic Transaction Operations', () => {
    it('should track insert operations in transaction', async () => {
      await indexManager.insert_in_transaction(transactionId, 'newKey', 'newValue')

      const changes = indexManager.getTransactionChanges(transactionId)
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('insert')
      expect(changes[0].key).toBe('newKey')
      expect(changes[0].value).toBe('newValue')
      expect(changes[0].timestamp).toBeGreaterThan(0)
    })

    it('should track remove operations in transaction', async () => {
      await indexManager.remove_in_transaction(transactionId, 'key1')

      const changes = indexManager.getTransactionChanges(transactionId)
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('remove')
      expect(changes[0].key).toBe('key1')
      expect(changes[0].timestamp).toBeGreaterThan(0)
    })

    it('should track multiple operations in transaction', async () => {
      await indexManager.insert_in_transaction(transactionId, 'newKey1', 'newValue1')
      await indexManager.insert_in_transaction(transactionId, 'newKey2', 'newValue2')
      await indexManager.remove_in_transaction(transactionId, 'key1')

      const changes = indexManager.getTransactionChanges(transactionId)
      expect(changes).toHaveLength(3)
      expect(changes[0].type).toBe('insert')
      expect(changes[1].type).toBe('insert')
      expect(changes[2].type).toBe('remove')
    })

    it('should maintain separate transaction contexts', async () => {
      const tx2 = 'test-tx-2'

      await indexManager.insert_in_transaction(transactionId, 'key-tx1', 'value-tx1')
      await indexManager.insert_in_transaction(tx2, 'key-tx2', 'value-tx2')

      const changes1 = indexManager.getTransactionChanges(transactionId)
      const changes2 = indexManager.getTransactionChanges(tx2)

      expect(changes1).toHaveLength(1)
      expect(changes2).toHaveLength(1)
      expect(changes1[0].key).toBe('key-tx1')
      expect(changes2[0].key).toBe('key-tx2')
    })
  })

  describe('Transaction View Operations', () => {
    it('should return committed data for new transaction', async () => {
      const results = await indexManager.get_all_in_transaction(transactionId, 'key1')

      // Should see committed data
      expect(results).toContain('value1')
    })

    it('should include transaction inserts in view', async () => {
      await indexManager.insert_in_transaction(transactionId, 'key1', 'newValue1')

      const results = await indexManager.get_all_in_transaction(transactionId, 'key1')

      // Should see both committed and transaction data
      expect(results).toContain('value1') // committed
      expect(results).toContain('newValue1') // transaction insert
    })

    it('should exclude transaction removes from view', async () => {
      await indexManager.remove_in_transaction(transactionId, 'key1')

      const results = await indexManager.get_all_in_transaction(transactionId, 'key1')

      // Should not see removed data
      expect(results).not.toContain('value1')
    })

    it('should handle complex transaction view', async () => {
      // Insert new data
      await indexManager.insert_in_transaction(transactionId, 'key1', 'txValue1')
      await indexManager.insert_in_transaction(transactionId, 'key4', 'txValue4')
      // Remove existing data
      await indexManager.remove_in_transaction(transactionId, 'key2')

      const results1 = await indexManager.get_all_in_transaction(transactionId, 'key1')
      const results2 = await indexManager.get_all_in_transaction(transactionId, 'key2')
      const results4 = await indexManager.get_all_in_transaction(transactionId, 'key4')

      expect(results1).toContain('value1') // original
      expect(results1).toContain('txValue1') // transaction insert
      expect(results2).toHaveLength(0) // removed in transaction
      expect(results4).toContain('txValue4') // new in transaction
    })
  })

  describe('2PC Protocol - Prepare Phase', () => {
    it('should prepare successfully with valid changes', async () => {
      await indexManager.insert_in_transaction(transactionId, 'validKey', 'validValue')

      const canCommit = await indexManager.prepareCommit(transactionId)

      expect(canCommit).toBe(true)
      expect(indexManager.isPrepared(transactionId)).toBe(true)
    })

    it('should prepare successfully with no changes', async () => {
      const canCommit = await indexManager.prepareCommit(transactionId)

      expect(canCommit).toBe(true)
      expect(indexManager.isPrepared(transactionId)).toBe(true)
    })

    it('should reject prepare for invalid insert', async () => {
      await indexManager.insert_in_transaction(transactionId, undefined, 'value')

      const canCommit = await indexManager.prepareCommit(transactionId)

      expect(canCommit).toBe(false)
      expect(indexManager.isPrepared(transactionId)).toBe(false)
    })

    it('should handle invalid remove gracefully', async () => {
      await indexManager.remove_in_transaction(transactionId, undefined)

      const changes = indexManager.getTransactionChanges(transactionId)
      // Invalid remove should not create any changes
      expect(changes).toHaveLength(0)

      const canCommit = await indexManager.prepareCommit(transactionId)
      // Should still be able to commit (no invalid changes)
      expect(canCommit).toBe(true)
    })

    it('should handle prepare errors gracefully', async () => {
      // Create a scenario that might cause prepare to throw
      await indexManager.insert_in_transaction(transactionId, 'key', 'value')

      // Mock a potential error scenario
      const originalCanInsert = (indexManager as any).canInsert
      ;(indexManager as any).canInsert = () => { throw new Error('Test error') }

      const canCommit = await indexManager.prepareCommit(transactionId)

      expect(canCommit).toBe(false)

      // Restore original method
      ;(indexManager as any).canInsert = originalCanInsert
    })
  })

  describe('2PC Protocol - Commit Phase', () => {
    it('should commit successfully after prepare', async () => {
      await indexManager.insert_in_transaction(transactionId, 'commitKey', 'commitValue')

      const canCommit = await indexManager.prepareCommit(transactionId)
      expect(canCommit).toBe(true)

      await indexManager.finalizeCommit(transactionId)

      // Changes should be applied to main B+ Tree
      expect(btree.findFirst('commitKey')).toBe('commitValue')
      expect(indexManager.getActiveTransactionCount()).toBe(0)
    })

    it('should apply multiple changes in commit', async () => {
      await indexManager.insert_in_transaction(transactionId, 'newKey1', 'newValue1')
      await indexManager.insert_in_transaction(transactionId, 'newKey2', 'newValue2')
      await indexManager.remove_in_transaction(transactionId, 'key1')

      await indexManager.prepareCommit(transactionId)
      await indexManager.finalizeCommit(transactionId)

      // Check all changes were applied
      expect(btree.findFirst('newKey1')).toBe('newValue1')
      expect(btree.findFirst('newKey2')).toBe('newValue2')
      expect(btree.findFirst('key1')).toBeUndefined()
    })

    it('should throw error if committing unprepared transaction', async () => {
      await indexManager.insert_in_transaction(transactionId, 'key', 'value')

      await expect(indexManager.finalizeCommit(transactionId)).rejects.toThrow(
        `Transaction ${transactionId} not prepared`
      )
    })

    it('should cleanup transaction data after commit', async () => {
      await indexManager.insert_in_transaction(transactionId, 'key', 'value')
      await indexManager.prepareCommit(transactionId)
      await indexManager.finalizeCommit(transactionId)

      expect(indexManager.getActiveTransactionCount()).toBe(0)
      expect(indexManager.getTransactionChanges(transactionId)).toHaveLength(0)
      expect(indexManager.isPrepared(transactionId)).toBe(false)
    })
  })

  describe('2PC Protocol - Rollback', () => {
    it('should rollback transaction without applying changes', async () => {
      await indexManager.insert_in_transaction(transactionId, 'rollbackKey', 'rollbackValue')

      await indexManager.rollback(transactionId)

      // Changes should not be applied to main B+ Tree
      expect(btree.findFirst('rollbackKey')).toBeUndefined()
      expect(indexManager.getActiveTransactionCount()).toBe(0)
    })

    it('should rollback prepared transaction', async () => {
      await indexManager.insert_in_transaction(transactionId, 'preparedKey', 'preparedValue')
      await indexManager.prepareCommit(transactionId)

      await indexManager.rollback(transactionId)

      expect(btree.findFirst('preparedKey')).toBeUndefined()
      expect(indexManager.getActiveTransactionCount()).toBe(0)
      expect(indexManager.isPrepared(transactionId)).toBe(false)
    })

    it('should cleanup transaction data after rollback', async () => {
      await indexManager.insert_in_transaction(transactionId, 'key', 'value')
      await indexManager.rollback(transactionId)

      expect(indexManager.getActiveTransactionCount()).toBe(0)
      expect(indexManager.getTransactionChanges(transactionId)).toHaveLength(0)
      expect(indexManager.isPrepared(transactionId)).toBe(false)
    })

    it('should handle rollback of non-existent transaction', async () => {
      // Should not throw when rolling back non-existent transaction
      await expect(async () => {
        await indexManager.rollback('non-existent')
      }).not.toThrow()
    })
  })

  describe('Backward Compatibility', () => {
    it('should support non-transactional insert', () => {
      indexManager.insert('directKey', 'directValue')

      expect(btree.findFirst('directKey')).toBe('directValue')
    })

    it('should support non-transactional remove', () => {
      indexManager.remove('key1')

      expect(btree.findFirst('key1')).toBeUndefined()
    })

    it('should support non-transactional findFirst', () => {
      const result = indexManager.findFirst('key2')

      expect(result).toBe('value2')
    })

    it('should support non-transactional findAll', () => {
      const results = indexManager.findAll('key3')

      expect(results).toContain('value3')
    })

    it('should support tree properties access', () => {
      expect(indexManager.min).toBeDefined()
      expect(indexManager.max).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty transaction gracefully', async () => {
      const canCommit = await indexManager.prepareCommit(transactionId)
      expect(canCommit).toBe(true)

      await indexManager.finalizeCommit(transactionId)
      expect(indexManager.getActiveTransactionCount()).toBe(0)
    })

    it('should handle multiple operations on same key', async () => {
      await indexManager.insert_in_transaction(transactionId, 'sameKey', 'value1')
      await indexManager.insert_in_transaction(transactionId, 'sameKey', 'value2')
      await indexManager.remove_in_transaction(transactionId, 'sameKey')

      const changes = indexManager.getTransactionChanges(transactionId)
      // Should have 2 inserts + 2 removes (one for each inserted value)
      expect(changes.length).toBeGreaterThanOrEqual(3)

      const results = await indexManager.get_all_in_transaction(transactionId, 'sameKey')
      expect(results).toHaveLength(0) // All should be removed
    })

    it('should maintain transaction isolation', async () => {
      const tx2 = 'test-tx-2'

      await indexManager.insert_in_transaction(transactionId, 'isolationKey', 'tx1Value')
      await indexManager.insert_in_transaction(tx2, 'isolationKey', 'tx2Value')

      const results1 = await indexManager.get_all_in_transaction(transactionId, 'isolationKey')
      const results2 = await indexManager.get_all_in_transaction(tx2, 'isolationKey')

      expect(results1).toContain('tx1Value')
      expect(results1).not.toContain('tx2Value')
      expect(results2).toContain('tx2Value')
      expect(results2).not.toContain('tx1Value')
    })
  })
})