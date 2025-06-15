import Collection from '../core/Collection'
import { ICollectionConfig } from '../types/ICollectionConfig'
import { Person } from './Person'

export const load_ttl = async (config: ICollectionConfig<Person>) => {
  const data = Collection.create<Person>(config)
  await data.load()
  console.log(await data.findBy('id', 7))
}
