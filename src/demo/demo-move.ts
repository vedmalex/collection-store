import Collection from '../collection'
import { FileStorage } from '../adapters/FileStorage'
import { CollectionConfig } from '../types/CollectionConfig'
import { do_rotate_log } from '../collection/do_rotate_log'
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
  const copy = await do_rotate_log(data)
  // работа с курсорами для перемещения, не совсем то, что надо, нужно удалять и обновлять данные пачками
  await copy.persist()
  data.push({
    // id: 0,
    name: 'alex',
    age: 42,
    ssn: '000-0000-000001',
    page: 'http://ya.ru',
    address: {
      appart: '1a',
      home: '3481',
      city: 'Los Angeles',
    },
  })
}

// не все удаляется
persistence().then((_) => console.log('done'))

// TODO: смотреть TTL
