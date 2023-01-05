import Collection from '../collection'
import { UnaryCondition } from 'src/query/UnaryCondition'
import { query } from 'src/query/query'
import { FileStorage } from '../adapters/FileStorage'
import { CollectionConfig } from '../types/CollectionConfig'
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

const run = async () => {
  const addPerson = async (inp: Person) => data.push(inp)
  const data = await Collection.create<Person>(collection_config)

  await addPerson({
    id: 0,
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
  await addPerson({
    id: 1,
    name: 'jame',
    age: 45,
    ssn: '000-0000-000002',
    page: 'http://ya.ru',
    address: {
      appart: '1a',
      home: '3481',
      city: 'Los Angeles',
    },
  })
  await addPerson({
    id: 2,
    name: 'mark',
    age: 30,
    ssn: '000-0000-000003',
    page: 'http://ya.ru',
    address: {
      appart: '1a',
      home: '3481',
      city: 'New York',
    },
  })
  await addPerson({
    id: 3,
    name: 'simon',
    age: 24,
    ssn: '000-0000-00004',
    page: 'http://ya.ru',
    address: {
      appart: '1a',
      home: '3481',
      city: 'New York',
    },
  })
  await addPerson({
    id: 4,
    name: 'jason',
    age: 19,
    ssn: '000-0000-000005',
    page: 'http://ya.ru',
    address: {
      home: '3481',
      city: 'New York',
    },
  })
  await addPerson({
    id: 5,
    name: 'jim',
    age: 18,
    ssn: '000-0000-000006',
    page: 'http://ya.ru',
    address: {
      appart: 'penthouse',
      home: '23310',
      city: 'Los Angeles',
    },
  })
  await addPerson({
    id: 6,
    name: 'jach',
    age: 29,
    ssn: '000-0000-000007',
    page: 'http://ya.ru',
    address: {
      appart: '3f',
      home: '5431',
      city: 'Los Angeles',
    },
  })
  await addPerson({
    id: 7,
    name: 'monika',
    age: 30,
    ssn: '000-0000-000008',
    page: 'http://ya.ru',
    address: {
      appart: '5c',
      home: '54481',
      city: 'Los Angeles',
    },
  })

  console.log(await data.findBy('id', 7))

  // смотреть формирование запроса

  const q = {
    age: { $in: [30, 29] },
    address: { home: '54481', appart: '5c', city: 'Los Angeles' },
  }

  const q1 = query(q)

  console.log(await data.find(q))
  console.log(await data.find(q1))

  const q2 = query(
    {
      age: { $in: [30, 29] },
      address: { home: '54481', appart: '20' },
    },
    {
      $and: (cond: Array<{ [key: string]: UnaryCondition }>) => {
        cond.sort((a, b) => {
          const a_list = Object.keys(a)
          const b_list = Object.keys(b)
          if (a_list.length > 1) throw new Error('nonsence')
          if (b_list.length > 1) throw new Error('nonsence')
          if (data.indexDefs[a_list[0]] && data.indexDefs[b_list[0]]) return 0
          if (data.indexDefs[a_list[0]] && !data.indexDefs[b_list[0]]) return 1
          if (!data.indexDefs[a_list[0]] && data.indexDefs[b_list[0]]) return -1
        })

        return () => true
      },
      // $or: () => () => true,
    },
  )
  /**
   * отсортировать операции $or и $and по наличию индекса
   * берем значения по индексу там где он есть,
   * а там где нет берем полный обход
   * создаем план обхода базы данных и можно вывести его в консоль
   */

  debugger
  await data.persist()
}

run().then((_) => console.log('done'))
