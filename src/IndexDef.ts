import { IdGeneratorFunction } from './IdGeneratorFunction';
import { Item } from './Item';

export interface IndexDef<T extends Item> {
  key: string;
  auto?: boolean;
  unique?: boolean;
  sparse?: boolean;
  required?: boolean;
  ignoreCase?: boolean;
  gen?: IdGeneratorFunction<T>;
  process?: (value: any) => any
}

export interface IndexStored {
  key: string;
  auto?: boolean;
  unique?: boolean;
  sparse?: boolean;
  required?: boolean;
  ignoreCase?: boolean;
  gen?: string;
  process?: string
}
