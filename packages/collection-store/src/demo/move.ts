import { ICollectionConfig } from '../async/ICollectionConfig'
import Collection from '../async/collection'
import { do_rotate_log } from '../async/collection/do_rotate_log'
import { Person } from './Person'

export const move = async (config: ICollectionConfig<Person>) => {
  const data = Collection.create<Person>(config)
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
  data.persist()
  return copy
}
