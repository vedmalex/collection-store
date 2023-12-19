import { Item } from '../../types/Item';
import Collection from '../collection';
import { TraverseCondition } from '../../types/TraverseCondition';
export declare function first<T extends Item>(collection: Collection<T>, condition: TraverseCondition<T>): AsyncGenerator<T>;
