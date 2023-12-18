import { Item } from '../../types/Item'
import { ISerializedCollectionConfig } from '../ICollectionConfig'
import Collection, { serializeIndex } from '../collection'

export function serialize_collection_config<T extends Item>(
  collection: Collection<T>,
): ISerializedCollectionConfig {
  const res: ISerializedCollectionConfig = {} as ISerializedCollectionConfig
  res.audit = collection.audit ? true : undefined
  res.root = collection.root
  res.rotate = collection.rotate ?? undefined
  res.ttl = collection.ttl ? collection.ttl : undefined
  res.name = collection.name
  res.adapter = collection.storage.name
  res.list = collection.list.name
  res.id = collection.id
  res.auto = collection.auto ?? undefined
  // добавить сериализацию схемы
  // или использоваь ajv??
  res.indexList = Object.keys(collection.indexDefs).map((name) => {
    const res = collection.indexDefs[name]
    return serializeIndex<T>(res)
  })
  return res
}
