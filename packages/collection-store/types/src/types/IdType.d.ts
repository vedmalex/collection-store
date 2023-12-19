import { Item } from './Item';
import { IdGeneratorFunction } from './IdGeneratorFunction';
export interface IdType<T extends Item> {
    name: string;
    auto: boolean;
    gen: IdGeneratorFunction<T> | string;
}
