import { Item } from '../../types/Item'
import {
  ICollectionConfig,
  ISerializedCollectionConfig,
} from '../ICollectionConfig'
import { List } from '../storage/List'
import AdapterMemory from '../AdapterMemory'
import AdapterFile from '../AdapterFile'
import { FileStorage } from '../storage/FileStorage'
import { deserializeIndex } from '../collection'

export function deserialize_collection_config<T extends Item>(
  config: ISerializedCollectionConfig,
) {
  const res = {} as ICollectionConfig<T>
  res.name = config.name
  res.root = config.root
  res.rotate = config.rotate
  res.ttl = config.ttl
  res.audit = config?.audit ?? false
  res.id = config.id
  res.auto = config.auto
  res.indexList = config.indexList.map((index) => deserializeIndex<T>(index))
  res.adapter =
    config.adapter === 'AdapterMemory' ? new AdapterMemory() : new AdapterFile()
  res.list =
    config.list === 'List' ? new List<T>() : new FileStorage<T, string>()
  return res
}
