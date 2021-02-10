import Collection from './collection'
type Person = {
  id: number
  name: string
  age: number
  ssn: string
  page: string
}

let data = new Collection<Person>({
  name: 'Person',
  ttl: '30s',
})

const addPerson = (inp: Person) => data.push(inp)

addPerson({
  id: 0,
  name: 'alex',
  age: 42,
  ssn: '000-0000-000001',
  page: 'http://ya.ru',
})
addPerson({
  id: 1,
  name: 'jame',
  age: 45,
  ssn: '000-0000-000002',
  page: 'http://ya.ru',
})
addPerson({
  id: 2,
  name: 'mark',
  age: 30,
  ssn: '000-0000-000003',
  page: 'http://ya.ru',
})
addPerson({
  id: 3,
  name: 'simon',
  age: 24,
  ssn: '000-0000-00004',
  page: 'http://ya.ru',
})
addPerson({
  id: 4,
  name: 'jason',
  age: 19,
  ssn: '000-0000-000005',
  page: 'http://ya.ru',
})
addPerson({
  id: 5,
  name: 'jim',
  age: 18,
  ssn: '000-0000-000006',
  page: 'http://ya.ru',
})
addPerson({
  id: 6,
  name: 'jach',
  age: 29,
  ssn: '000-0000-000007',
  page: 'http://ya.ru',
})
addPerson({
  id: 7,
  name: 'monika',
  age: 30,
  ssn: '000-0000-000008',
  page: 'http://ya.ru',
})

console.log(data.findBy('id', 7))
