import { ICollectionConfig } from '../ICollectionConfig';
import Collection from '../collection';
import { Person } from './Person';
export declare const create: (config: ICollectionConfig<Person>) => Promise<Collection<Person>>;
