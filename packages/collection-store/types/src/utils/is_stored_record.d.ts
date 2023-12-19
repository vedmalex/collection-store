import { Item } from '../types/Item';
import { IStoredRecord } from '../types/IStoredRecord';
export declare function is_stored_record<T extends Item>(item: T | IStoredRecord<T>): item is IStoredRecord<T>;
