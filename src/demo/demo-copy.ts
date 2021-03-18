import Collection from '../collection'
import { FileStorage } from '../adapters/FileStorage'
import { CollectionConfig } from '../CollectionConfig'
import { copy_collection } from '../collection/copy_collection'
import AdapterFile from '../adapter-file'

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

const collection_config: CollectionConfig<Person> = {
  name: 'Person',
  // ttl: '2m',
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
  const data = await Collection.create<Person>(collection_config)
  await data.load()
  console.log(await data.findBy('id', 7))
  const copy = await copy_collection('Person-backup', data)
  // работа с курсорами для перемещения, не совсем то, что надо, нужно удалять и обновлять данные пачками
  await copy.persist()
}

// не все удаляется
persistence().then((_) => console.log('done'))

// TODO: смотреть TTL
