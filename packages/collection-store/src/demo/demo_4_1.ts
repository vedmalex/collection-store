import Collection from '../core/Collection'
import { do_rotate_log } from '../collection/do_rotate_log'
import { Person } from './Person'
import { collection_config } from './collection_4'

export const move = async () => {
  const data = Collection.create<Person>(collection_config)
  await data.load()
  console.log(await data.findBy('id', 7))
  const copy = await do_rotate_log(data)
  // работа с курсорами для перемещения, не совсем то, что надо, нужно удалять и обновлять данные пачками
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
  await data.persist()
  return copy
}

move().then()
