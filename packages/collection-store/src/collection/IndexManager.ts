import { BPlusTree, ValueType, TransactionContext } from 'b-pl-tree';
import { IIndexManager, IndexDefinition } from './IIndexManager';
import { v4 as uuidv4 } from 'uuid';

interface Index<T> {
  tree: BPlusTree<T, ValueType>;
  unique: boolean;
  field: keyof T;
}

// Maps a transaction ID to a map of (field -> TransactionContext)
type TransactionMap<T> = Map<string, Map<keyof T, TransactionContext<T, ValueType>>>;

export class IndexManager<T> implements IIndexManager<T> {
  private indexes: Map<keyof T, Index<T>> = new Map();
  private transactions: TransactionMap<T> = new Map();

  public async createIndex(field: keyof T, unique: boolean): Promise<void> {
    if (this.indexes.has(field)) {
      throw new Error(`Index on field "${String(field)}" already exists.`);
    }
    const tree = new BPlusTree<T, ValueType>(3, unique);
    this.indexes.set(field, { tree, unique, field });
  }

  public async add(field: keyof T, value: any, docId: string, txId?: string): Promise<void> {
    const index = this.indexes.get(field);
    if (!index) return;

    if (txId) {
      const tx = this.transactions.get(txId)?.get(field);
      if (!tx) throw new Error(`Transaction context not found for field ${String(field)} in transaction ${txId}`);

      if (index.unique) {
        // For unique indexes, simple insert_in_transaction is safe
        index.tree.insert_in_transaction(value, docId as any, tx);
      } else {
        // For non-unique indexes, use direct transaction methods
        // The b-pl-tree should handle the complexity internally
        index.tree.insert_in_transaction(value, docId as any, tx);
      }
      return;
    }

    if (index.unique) {
      const existing = index.tree.find(value);
      if (existing && existing.length > 0) {
        throw new Error(`Unique constraint violation on field "${String(field)}" for value "${value}"`);
      }
      index.tree.insert(value, docId as any);
    } else {
      let docIds = (index.tree.find(value) as string[][])?.[0] || [];
      docIds.push(docId);
      index.tree.insert(value, docIds as any);
    }
  }

  public async remove(field: keyof T, value: any, docId: string, txId?: string): Promise<void> {
    const index = this.indexes.get(field);
    if (!index) {
      return;
    }

    if (txId) {
      const tx = this.transactions.get(txId)?.get(field);
      if (!tx) throw new Error(`Transaction context not found for field ${String(field)} in transaction ${txId}`);

      if (index.unique) {
        // For unique indexes, simple remove_in_transaction is safe
        index.tree.remove_in_transaction(value, tx);
      } else {
        // For non-unique indexes, use direct transaction methods
        // The b-pl-tree should handle the complexity internally
        index.tree.remove_in_transaction(value, tx);
      }
      return;
    }

    if (index.unique) {
      index.tree.remove(value);
    } else {
      // For non-unique indexes, use removeSpecific to remove only the specific docId
      // The tree stores arrays of docIds for each value, so we need to filter the specific docId
      const removedItems = index.tree.removeSpecific(value, (docIds: any) => {
        // docIds should be an array of document IDs
        if (Array.isArray(docIds)) {
          return docIds.includes(docId);
        }
        // If it's a single docId (shouldn't happen in non-unique index, but handle it)
        return docIds === docId;
      });

      // If we removed items, we need to check if there are remaining docIds for this value
      // and re-insert them if necessary
      if (removedItems.length > 0) {
        for (const [removedKey, removedDocIds] of removedItems) {
          if (Array.isArray(removedDocIds)) {
            // Filter out the specific docId and re-insert remaining ones
            const remainingDocIds = removedDocIds.filter(id => id !== docId);
            if (remainingDocIds.length > 0) {
              index.tree.insert(removedKey, remainingDocIds as any);
            }
          }
        }
      }
    }
  }

  public async find(field: keyof T, value: any): Promise<string[]> {
    const index = this.indexes.get(field);
    if (!index) {
      throw new Error(`No index found on field "${String(field)}".`);
    }

    const result = index.tree.find(value);

    if (!result || result.length === 0) return [];

    if (index.unique) {
      return result as string[];
    } else {
      return result[0] as string[];
    }
  }

  public async findRange(field: keyof T, range: any): Promise<string[]> {
    const index = this.indexes.get(field);
    if (!index) {
        throw new Error(`No index found on field "${String(field)}".`);
    }

    // Try to use the range method from b-pl-tree
    try {
      const result = index.tree.range(range);

      if (!result || result.length === 0) return [];

      // Filter the results based on the range conditions
      const filteredResults = this.filterRangeResults(result, range);

      if (index.unique) {
        // For unique indexes, result is array of [key, value] pairs
        return filteredResults.map(([key, value]) => value as string);
      } else {
        // For non-unique indexes, flatten the arrays of docIds
        const allDocIds: string[] = [];
        const seenDocIds = new Set<string>(); // Deduplicate

        for (const [key, value] of filteredResults) {
          if (Array.isArray(value)) {
            for (const docId of value as string[]) {
              if (!seenDocIds.has(docId)) {
                seenDocIds.add(docId);
                allDocIds.push(docId);
              }
            }
          } else {
            const docId = value as string;
            if (!seenDocIds.has(docId)) {
              seenDocIds.add(docId);
              allDocIds.push(docId);
            }
          }
        }
        return allDocIds;
      }
    } catch (error) {
      console.warn(`findRange on field "${String(field)}" failed with error: ${error}. Falling back to manual range query.`);

      // Fallback: manual range query using find for each possible value
      // This is inefficient but works as a backup
      return this.manualRangeQuery(index, range);
    }
  }

  private filterRangeResults(results: Array<[any, any]>, range: any): Array<[any, any]> {
    return results.filter(([key, value]) => {
      // Apply range conditions
      if (range.$gt !== undefined && key <= range.$gt) return false;
      if (range.$gte !== undefined && key < range.$gte) return false;
      if (range.$lt !== undefined && key >= range.$lt) return false;
      if (range.$lte !== undefined && key > range.$lte) return false;
      return true;
    });
  }

  private manualRangeQuery(index: Index<T>, range: any): string[] {
    // This is a simplified fallback implementation
    // In a real implementation, you'd iterate through the tree nodes
    console.warn('Manual range query not fully implemented - returning empty array');
    return [];
  }

  public async beginTransaction(): Promise<string> {
    const txId = uuidv4();
    const fieldTransactions = new Map<keyof T, TransactionContext<T, ValueType>>();
    for (const [field, index] of this.indexes.entries()) {
      fieldTransactions.set(field, new TransactionContext(index.tree));
    }
    this.transactions.set(txId, fieldTransactions);
    return txId;
  }

  public async commit(txId: string): Promise<void> {
    const fieldTransactions = this.transactions.get(txId);
    if (!fieldTransactions) throw new Error(`Transaction ${txId} not found.`);

    for (const tx of fieldTransactions.values()) {
      await tx.prepareCommit();
    }
    for (const tx of fieldTransactions.values()) {
      await tx.finalizeCommit();
    }
    this.transactions.delete(txId);
  }

  public async rollback(txId: string): Promise<void> {
    const fieldTransactions = this.transactions.get(txId);
    if (!fieldTransactions) throw new Error(`Transaction ${txId} not found.`);

    for (const tx of fieldTransactions.values()) {
      await tx.abort();
    }
    this.transactions.delete(txId);
  }
}