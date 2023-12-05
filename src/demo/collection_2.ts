import { FileStorage } from '../async/storage/FileStorage'
import { ICollectionConfig } from '../async/ICollectionConfig'
import { Person } from './Person'
import AdapterFS from 'src/async/AdapterFS'

export const collection_config: ICollectionConfig<Person> = {
  root: './data',
  name: 'Person',
  // ttl: '2m',
  list: new FileStorage<Person, string>(),
  adapter: new AdapterFS(),
  indexList: [
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
