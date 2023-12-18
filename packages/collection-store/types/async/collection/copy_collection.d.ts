import { Item } from '../../types/Item';
import Collection from '../collection';
export declare function copy_collection<T extends Item>(model: string, source: Collection<T>, dest?: Collection<T>): Promise<Collection<T>>;
