import { ICollectionConfig } from '../async/ICollectionConfig'
import Collection from '../async/collection'
import { copy_collection } from '../async/collection/copy_collection'
import { Person } from './Person'

export const copy = async (config: ICollectionConfig<Person>) => {
  const data = Collection.create<Person>(config)
  await data.load()
  console.log(await data.findBy('id', 7))
  const copy = await copy_collection('Person-backup', data)
  console.log(await copy.findBy('id', 7))
  // работа с курсорами для перемещения, не совсем то, что надо, нужно удалять и обновлять данные пачками
  await copy.persist()
}
