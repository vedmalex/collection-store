import { ValueType } from 'b-pl-tree';
export type ProcessUpdates<T> = (ov: T | Partial<T>, nv: T | Partial<T>, index_payload: ValueType) => void;
