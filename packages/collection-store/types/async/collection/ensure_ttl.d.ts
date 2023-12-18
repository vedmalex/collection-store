import { Item } from '../../types/Item';
import Collection from '../collection';
export declare function ensure_ttl<T extends Item>(collection: Collection<T>): Promise<void>;
