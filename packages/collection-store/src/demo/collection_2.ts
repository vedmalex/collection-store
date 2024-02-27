import { FileStorage } from '../async/storage/FileStorage'
import { ICollectionConfig } from '../async/ICollectionConfig'
import { Person } from './Person'
import AdapterFile from '../async/AdapterFile'

export const collection_config: ICollectionConfig<Person> = {
  root: './data',
  name: 'Person',
  // ttl: '2m',
  list: new FileStorage<Person>(),
  adapter: new AdapterFile(),
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
