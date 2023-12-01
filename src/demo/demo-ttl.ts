import Collection from '../async/Collection'
import { FileStorage } from '../async/storage/FileStorage'
import { ICollectionConfig } from '../async/ICollectionConfig'
import AdapterFile from '../async/AdapterFile'

type Person = {
  id?: number
  name: string
  age: number
  ssn: string
  address: {
    appart?:
      | {
          stage: string
          place: string
        }
      | string
    home: string
    city: string
  }
  page: string
}

const collection_config: ICollectionConfig<Person> = {
  name: 'Person',
  ttl: '2m',
  // list: new List(),
  list: new FileStorage<Person, string>(),
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
const persistence = async () => {
  const data = Collection.create<Person>(collection_config)
  await data.load()
  console.log(await data.findBy('id', 7))
}

// не все удаляется
persistence().then((_) => console.log('done'))

// TODO: смотреть TTL
