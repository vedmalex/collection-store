import { ICollectionConfig } from './async/ICollectionConfig'
import Collection from './async/collection'

export interface Database {
  createCollection<T>(config: ICollectionConfig<T>): Collection<T>
  dropCollection<T>(config: ICollectionConfig<T>): Collection<T>
  // find<T>(
  //   collection: string,
  //   where: FilterQuery<T>,
  //   populate?: string[],
  //   orderBy?: Record<string, QueryOrder>,
  //   limit?: number,
  //   offset?: number,
  // ): Promise<T[]>
  // findOne<T>(
  //   collection: string,
  //   where: FilterQuery<T> | string,
  //   populate: string[],
  // ): Promise<T | null>
  // nativeInsert<T>(collection: string, data: EntityData<T>): Promise<QueryResult>
  // nativeUpdate(
  //   collection: string,
  //   where: FilterQuery<T> | IPrimaryKey,
  //   data: EntityData<T>,
  // ): Promise<QueryResult>
  // nativeDelete<T>(
  //   collection: string,
  //   where: FilterQuery<T> | IPrimaryKey,
  // ): Promise<QueryResult>
  // count(collection: string, where: FilterQuery<T>): Promise<number>
}
