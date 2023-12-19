import { UnaryCondition } from '../query/UnaryCondition'
import { query } from '../query/query'
import { create } from './create'
import { collection_config } from './collection_4'

const run = async () => {
  const data = await create(collection_config)
  await data.load()
  console.log('reload store')

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
          return 0
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
