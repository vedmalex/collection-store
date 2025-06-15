import Collection from '../core/Collection';
import { IStorageAdapter } from '../types/IStorageAdapter';
import { IIndexManager, IndexDefinition } from './IIndexManager';
import AdapterMemory from '../storage/adapters/AdapterMemory';
import { IndexManager } from './IndexManager';
import { Item } from '../types/Item';

export class CollectionFactory<T extends Item> {
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

    const collection = Collection.create<T>({
      name,
      adapter: this.storageAdapter,
      indexList: indexDefs.map(def => ({ key: def.field, unique: def.unique }))
    });
    this.collections.set(name, collection);

    return collection;
  }
}