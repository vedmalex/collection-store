import { Item } from './Item'
import { Paths } from './Paths'

export interface IndexStored<T extends Item> {
  key: string | Paths<T>
  type?: 'btree' | 'vector' | 'fulltext'
  vector?: { dimensions: number; metric?: 'cosine' | 'l2' }
  fulltext?: { tokenizer?: 'simple' | 'porter'; language?: string }
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  text?: boolean
  gen?: string
  process?: string
}
