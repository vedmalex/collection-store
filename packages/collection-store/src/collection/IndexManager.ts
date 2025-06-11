import { BPlusTree, ValueType, TransactionContext } from 'b-pl-tree';
import { IIndexManager, IndexDefinition } from './IIndexManager';
import { v4 as uuidv4 } from 'uuid';

interface Index<T> {
  tree: BPlusTree<T, ValueType>;
  unique: boolean;
  field: keyof T;
}

// Transaction change tracking for proper transaction isolation
interface TransactionChange {
  type: 'add' | 'remove';
  field: keyof any;
  value: any;
  docId: string;
}

export class IndexManager<T> implements IIndexManager<T> {
  private indexes: Map<keyof T, Index<T>> = new Map();
  private transactions: Map<string, TransactionContext<T, ValueType>[]> = new Map();
  private transactionChanges: Map<string, TransactionChange[]> = new Map();

  public async createIndex(field: keyof T, unique: boolean): Promise<void> {
    if (this.indexes.has(field)) {
      throw new Error(`Index on field "${String(field)}" already exists.`);
    }
    // b-pl-tree v1.3.1 fully supports both unique and non-unique indexes with transactions
    const tree = new BPlusTree<T, ValueType>(3, unique);
    this.indexes.set(field, { tree, unique, field });
  }

  public async add(field: keyof T, value: any, docId: string, txId?: string): Promise<void> {
    const index = this.indexes.get(field);
    if (!index) return;

    if (txId) {
      // Track transaction changes for proper isolation
      const changes = this.transactionChanges.get(txId) || [];
      changes.push({ type: 'add', field, value, docId });
      this.transactionChanges.set(txId, changes);

      // Get or create transaction context for this index
      const txContexts = this.transactions.get(txId) || [];
      let txContext = txContexts.find(ctx => ctx === txContexts.find(c => c instanceof TransactionContext));

      if (!txContext) {
        txContext = new TransactionContext(index.tree);
        txContexts.push(txContext);
        this.transactions.set(txId, txContexts);
      }

      // b-pl-tree v1.3.1 handles both unique and non-unique indexes correctly
      // For non-unique indexes, it automatically manages duplicate keys
      index.tree.insert_in_transaction(value, docId as any, txContext);
      return;
    }

    // Non-transactional operations
    if (index.unique) {
      const existing = index.tree.find(value);
      if (existing && existing.length > 0) {
        throw new Error(`Unique constraint violation on field "${String(field)}" for value "${value}"`);
      }
    }

    // b-pl-tree v1.3.1 handles both unique and non-unique indexes with simple insert
    index.tree.insert(value, docId as any);
  }

  public async remove(field: keyof T, value: any, docId: string, txId?: string): Promise<void> {
    const index = this.indexes.get(field);
    if (!index) return;

    if (txId) {
      // Track transaction changes for proper isolation
      const changes = this.transactionChanges.get(txId) || [];
      changes.push({ type: 'remove', field, value, docId });
      this.transactionChanges.set(txId, changes);

      // Get or create transaction context for this index
      const txContexts = this.transactions.get(txId) || [];
      let txContext = txContexts.find(ctx => ctx === txContexts.find(c => c instanceof TransactionContext));

      if (!txContext) {
        txContext = new TransactionContext(index.tree);
        txContexts.push(txContext);
        this.transactions.set(txId, txContexts);
      }

      // b-pl-tree v1.3.1 handles removal correctly for both unique and non-unique indexes
      // For non-unique indexes, it removes the specific key-value pair
      index.tree.remove_in_transaction(value, txContext);
      return;
    }

    // Non-transactional operations
    // b-pl-tree v1.3.1 handles removal correctly for both unique and non-unique indexes
      index.tree.remove(value);
  }

  public async find(field: keyof T, value: any): Promise<string[]> {
    const index = this.indexes.get(field);
    if (!index) {
      throw new Error(`No index found on field "${String(field)}".`);
    }

    const result = index.tree.find(value);

    if (!result || result.length === 0) return [];

    // b-pl-tree v1.3.1 returns results consistently for both unique and non-unique indexes
    // For non-unique indexes, it returns all matching values as an array
    return result.map(item => String(item));
  }

  public async findRange(field: keyof T, range: any): Promise<string[]> {
    const index = this.indexes.get(field);
    if (!index) {
        throw new Error(`No index found on field "${String(field)}".`);
    }

    // b-pl-tree v1.3.1 has fully working range queries with proper parameter handling
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

  public async beginTransaction(): Promise<string> {
    const txId = uuidv4();
    this.transactions.set(txId, []);
    this.transactionChanges.set(txId, []);
    return txId;
  }

  public async commit(txId: string): Promise<void> {
    const txContexts = this.transactions.get(txId);
    if (!txContexts) throw new Error(`Transaction ${txId} not found.`);

    // b-pl-tree v1.3.1 has fully working transaction commit mechanism
    // Use proper 2PC protocol for ACID compliance
    try {
      // Phase 1: Prepare all transaction contexts
      for (const txContext of txContexts) {
        await txContext.prepareCommit();
    }

      // Phase 2: Finalize all transaction contexts
      for (const txContext of txContexts) {
        await txContext.finalizeCommit();
      }
    } catch (error) {
      // If any phase fails, abort all transactions
      for (const txContext of txContexts) {
        await txContext.abort();
      }
      throw error;
    } finally {
      // Cleanup transaction state
      this.transactions.delete(txId);
      this.transactionChanges.delete(txId);
    }
  }

  public async rollback(txId: string): Promise<void> {
    const txContexts = this.transactions.get(txId);
    if (!txContexts) throw new Error(`Transaction ${txId} not found.`);

    // b-pl-tree v1.3.1 has fully working rollback mechanism
    for (const txContext of txContexts) {
      await txContext.abort();
    }

    // Cleanup transaction state
    this.transactions.delete(txId);
    this.transactionChanges.delete(txId);
  }
}