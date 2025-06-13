import { FileStorage } from '../storage/FileStorage'
import { ICollectionConfig } from '../ICollectionConfig'
import { Person } from './Person'
import AdapterFile from '../AdapterFile'

export const collection_config: ICollectionConfig<Person> = {
  root: './data',
  name: 'Person',
  // ttl: '2m',
  list: new FileStorage<Person>(),
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
