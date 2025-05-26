import { Item } from '../types/Item';
import { ICollectionConfig, ISerializedCollectionConfig } from '../ICollectionConfig';
export declare function deserialize_collection_config<T extends Item>(config: ISerializedCollectionConfig): ICollectionConfig<T>;
