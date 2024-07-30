import { IStoredRecord } from '../types/IStoredRecord';
import { Item } from '../types/Item';
export declare function is_stored_record<T extends Item>(item: T | IStoredRecord<T>): item is IStoredRecord<T>;
