import { ICollectionConfig } from '../ICollectionConfig'
import Collection from '../collection'
import { Person } from './Person'

export const create = async (config: ICollectionConfig<Person>) => {
  const data = Collection.create<Person>(config)
  const addPerson = async (inp: Person) => data.push(inp)

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

  data.persist()
  return data
}
