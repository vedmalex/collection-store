import { IdGeneratorFunction } from './IdGeneratorFunction';
import { Item } from './Item';

export interface IndexDef<T extends Item> {
  key: keyof T;
  auto?: boolean;
  unique?: boolean;
  sparse?: boolean;
  required?: boolean;
  ignoreCase?: boolean;
  gen?: IdGeneratorFunction<T>;
  process?: (value: any) => any
}

export interface IndexStored<T extends Item> {
  key: keyof T;
  auto?: boolean;
  unique?: boolean;
  sparse?: boolean;
  required?: boolean;
  ignoreCase?: boolean;
  gen?: string;
  process?: string
}
