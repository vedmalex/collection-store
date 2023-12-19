import { Item } from '../types/Item';
import { ValueType } from 'b-pl-tree';
import { IStoredRecord } from '../types/IStoredRecord';
import { ZodType } from 'zod';
export declare function entity_create<T extends Item>(id: ValueType, item: T, schema?: ZodType<T>): IStoredRecord<T>;
