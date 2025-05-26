import { Item } from '../types/Item';
import { ISerializedCollectionConfig } from '../ICollectionConfig';
import Collection from '../collection';
export declare function serialize_collection_config<T extends Item>(collection: Collection<T>): ISerializedCollectionConfig;
