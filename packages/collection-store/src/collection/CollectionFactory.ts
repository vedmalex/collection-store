import { Collection } from './Collection';
import { IStorageAdapter } from '../storage/IStorageAdapter';
import { IIndexManager, IndexDefinition } from './IIndexManager';
import { AdapterMemory } from '../storage/AdapterMemory';
import { IndexManager } from './IndexManager';

export class CollectionFactory<T extends { id: string }> {
  private readonly storageAdapter: IStorageAdapter<T>;
  private readonly collections: Map<string, Collection<T>> = new Map();

  constructor(storageAdapter?: IStorageAdapter<T>) {
    this.storageAdapter = storageAdapter || new AdapterMemory<T>();
  }

  public async getCollection(
    name: string,
    indexDefs: IndexDefinition<T>[] = []
  ): Promise<Collection<T>> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    const indexManager = new IndexManager<T>();
    for (const def of indexDefs) {
      await indexManager.createIndex(def.field, def.unique);
    }

    const collection = new Collection<T>(name, this.storageAdapter, indexManager);
    this.collections.set(name, collection);

    return collection;
  }
}