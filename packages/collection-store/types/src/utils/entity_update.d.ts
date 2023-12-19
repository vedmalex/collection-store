import { Item } from '../types/Item';
import { IStoredRecord } from '../types/IStoredRecord';
export declare function entity_update<T extends Item>(record: IStoredRecord<T>, item: T): IStoredRecord<T>;
