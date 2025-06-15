import { ICollectionConfig } from '../types/ICollectionConfig'
import { Person } from './Person'
import AdapterFile from '../storage/adapters/AdapterFile'
import { List } from '../storage/List'

export const collection_config: ICollectionConfig<Person> = {
  root: './data',
  name: 'Person',
  // ttl: '2m',
  list: new List<Person>(),
  adapter: new AdapterFile(),
  indexList: [
    {
      key: 'id',
      unique: true,
    },
    {
      key: 'name',
    },
    {
      key: 'ssn',
      unique: true,
    },
    {
      key: 'age',
    },
    {
      key: 'address.home',
    },
    {
      key: 'address.city',
    },
    {
      key: 'address.appart',
    },
  ],
}
