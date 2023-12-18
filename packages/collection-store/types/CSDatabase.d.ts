import { ICollectionConfig } from './async/ICollectionConfig';
import { IDataCollection } from './async/IDataCollection';
import { Item } from './types/Item';
export declare class CSDatabase {
    private root;
    private collections;
    constructor(root: string);
    connect(): Promise<void>;
    collectionList: Map<string, ICollectionConfig<any>>;
    private registerCollection;
    private persistSchema;
    createCollection<T extends Item>(config?: ICollectionConfig<T>): Promise<IDataCollection<T>>;
    listCollections(): Promise<Array<IDataCollection<any>>>;
    dropCollection(name: string): Promise<boolean>;
    collection<T extends Item>(name: string): IDataCollection<T> | undefined;
}
