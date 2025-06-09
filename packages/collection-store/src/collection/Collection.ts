import { IStorageAdapter } from '../storage/IStorageAdapter';
import { IIndexManager } from './IIndexManager';
import { v4 as uuidv4 } from 'uuid';
import { QueryEngine } from '../query/QueryEngine';

export class Collection<T extends { id: string }> {
  private readonly storage: IStorageAdapter<T>;
  public readonly indexManager: IIndexManager<T>;
  private readonly queryEngine: QueryEngine<T>;
  public readonly name: string;

  constructor(name: string, storageAdapter: IStorageAdapter<T>, indexManager: IIndexManager<T>) {
    this.name = name;
    this.storage = storageAdapter;
    this.indexManager = indexManager;
    this.queryEngine = new QueryEngine<T>();
  }

  async insert(doc: Omit<T, 'id'>): Promise<T> {
    const newDoc = { ...doc, id: uuidv4() } as T;

    // In a real implementation, this would be a transactional operation.
    // For now, we perform steps sequentially.

    // 1. Add to storage
    await this.storage.set(newDoc.id, newDoc);

    // 2. Update indexes
    try {
      const indexedFields = Object.keys(doc) as (keyof T)[];
      for (const field of indexedFields) {
        // We need a way to know which fields are indexed.
        // For now, we assume all fields passed to add might be indexed.
        // The indexManager will ignore fields that don't have an index.
        await this.indexManager.add(field, newDoc[field], newDoc.id);
      }
    } catch (e) {
      // Rollback storage if indexing fails
      await this.storage.delete(newDoc.id);
      throw e;
    }

    return newDoc;
  }

  async findById(id: string): Promise<T | null> {
    return this.storage.get(id);
  }

  async find(query: any): Promise<T[]> {
    const queryFields = Object.keys(query);
    let initialDocIds: string[] | null = null;
    let primaryQueryField: string | null = null;

    // A simple strategy: find the first field in the query that is indexed
    // and can be used for an exact match.
    // A more advanced strategy would analyze query operators ($gt, $lt)
    // and choose the most selective index.
    for (const field of queryFields) {
        // We need a way to check if an index exists for a field.
        // I'll assume the indexManager can tell us this.
        // For now, let's pretend it can't, and we just try to use it.
        const queryValue = query[field];
        if (typeof queryValue !== 'object') {
            try {
                // Attempt to use index for simple equality
                initialDocIds = await this.indexManager.find(field as keyof T, queryValue);
                primaryQueryField = field;
                break; // Use the first indexable field we find
            } catch (e) {
                // This will fail if no index exists on the field. We can ignore this.
            }
        }
    }

    let docsToFilter: T[];

    if (initialDocIds) {
      // We got a list of IDs from an index. Fetch these specific docs.
      const docsPromises = initialDocIds.map(id => this.storage.get(id));
      const resolvedDocs = await Promise.all(docsPromises);
      docsToFilter = resolvedDocs.reduce((acc, doc) => {
        if (doc) {
          acc.push(doc);
        }
        return acc;
      }, [] as T[]);
    } else {
      // No suitable index found, fall back to full scan.
      const allDocIds = await this.storage.keys();
      const allDocs: T[] = [];
      for (const id of allDocIds) {
        const doc = await this.storage.get(id);
        if (doc) {
          allDocs.push(doc);
        }
      }
      docsToFilter = allDocs;
    }

    // Even if we used an index, we still need to run the full query
    // to handle other conditions in the query object.
    return this.queryEngine.execute(docsToFilter, query);
  }

  async update(id: string, partialDoc: Partial<Omit<T, 'id'>>): Promise<T> {
    const existingDoc = await this.storage.get(id);
    if (!existingDoc) {
      throw new Error(`Document with id "${id}" not found.`);
    }

    const updatedDoc = { ...existingDoc, ...partialDoc };

    // This is complex. We need to update indexes for changed fields.
    // This involves removing old values and adding new ones.
    // For now, let's keep it simple and just update storage.
    // A proper implementation would require a transaction.

    await this.storage.set(id, updatedDoc);

    return updatedDoc;
  }

  async delete(id: string): Promise<void> {
    const docToDelete = await this.storage.get(id);
    if (!docToDelete) {
      return; // Or throw an error
    }

    // 1. Remove from indexes
    const indexedFields = Object.keys(docToDelete) as (keyof T)[];
    for (const field of indexedFields) {
        await this.indexManager.remove(field, docToDelete[field], id);
    }

    // 2. Remove from storage
    await this.storage.delete(id);
  }
}