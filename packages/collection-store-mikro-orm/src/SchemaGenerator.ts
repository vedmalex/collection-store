import {
  AbstractSchemaGenerator,
  type EntityMetadata,
  type EntityProperty,
  type MikroORM,
  Utils,
} from '@mikro-orm/core'
import type { CollectionStoreDriver } from './Driver'

export class CollectionStoreSchemaGenerator extends AbstractSchemaGenerator<CollectionStoreDriver> {
  static register(orm: MikroORM): void {
    orm.config.registerExtension('@mikro-orm/schema-generator', () => new CollectionStoreSchemaGenerator(orm.em))
  }

  override async createSchema(options: CreateSchemaOptions = {}) {
    options.ensureIndexes ??= true
    const db = this.connection.getDb()
    const collections = db.listCollections()
    //@ts-ignore
    const existing = collections.map((c) => c.name)
    const metadata = this.getOrderedMetadata()
    metadata.push({
      collection: this.config.get('migrations').tableName,
    } as any)

    await Promise.all(
      metadata
        .filter((meta) => !existing.includes(meta.collection))
        .map((meta) => this.connection.db.createCollection(meta.collection)),
    )

    if (options.ensureIndexes) {
      await this.ensureIndexes({ ensureCollections: false })
    }
  }

  override async dropSchema(options: { dropMigrationsTable?: boolean } = {}) {
    const db = this.connection.getDb()
    const collections = db.listCollections()
    //@ts-ignore
    const existing = collections.map((c) => c.name)
    const metadata = this.getOrderedMetadata()

    if (options.dropMigrationsTable) {
      metadata.push({
        collection: this.config.get('migrations').tableName,
      } as any)
    }

    await Promise.all(
      metadata
        .filter((meta) => existing.includes(meta.collection))
        .map((meta) => this.connection.db.dropCollection(meta.collection)),
    )
  }

  override async updateSchema(options: CreateSchemaOptions = {}): Promise<void> {
    await this.createSchema(options)
  }

  override async ensureDatabase(): Promise<boolean> {
    return false
  }

  override async refreshDatabase(options: CreateSchemaOptions = {}): Promise<void> {
    await this.ensureDatabase()
    await this.dropSchema()
    await this.createSchema(options)
  }

  override async ensureIndexes(options: EnsureIndexesOptions = {}): Promise<void> {
    options.ensureCollections ??= true

    if (options.ensureCollections) {
      await this.createSchema({ ensureIndexes: false })
    }

    // где-то тут нужно удалить ненужные индексы
    // где-то тут нужно сказать, что сложные индексы не используем
    for (const meta of this.getOrderedMetadata()) {
      await this.createIndexes(meta)
      this.createUniqueIndexes(meta)

      for (const prop of meta.props) {
        this.createPropertyIndexes(meta, prop, 'index')
        this.createPropertyIndexes(meta, prop, 'unique')
      }
    }
  }

  private async createIndexes(meta: EntityMetadata) {
    for (const index of meta.indexes) {
      const properties = Utils.flatten(Utils.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames))
      const db = this.connection.getDb()

      const fieldOrSpec = properties[0]

      await db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: false,
        ...(index.options || {}),
      })
    }
  }

  private async createUniqueIndexes(meta: EntityMetadata) {
    for (const index of meta.uniques) {
      const properties = Utils.flatten(Utils.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames))

      const fieldOrSpec = properties[0]

      const db = this.connection.getDb()
      await db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: true,
        ...(index.options || {}),
      })
    }
  }

  private async createPropertyIndexes(meta: EntityMetadata, prop: EntityProperty, type: 'index' | 'unique') {
    if (!prop[type] || !meta.collection) {
      return
    }

    const db = this.connection.getDb()
    const fieldOrSpec = prop.embeddedPath ? prop.embeddedPath.join('.') : prop.fieldNames[0]

    await db.createIndex(meta.className, fieldOrSpec, {
      key: fieldOrSpec,
      unique: type === 'unique',
      sparse: prop.nullable === true,
      required: !prop.nullable,
    })
  }
}

export interface CreateSchemaOptions {
  /** create indexes? defaults to true */
  ensureIndexes?: boolean
  /** not valid for mongo driver */
  wrap?: boolean
  /** not valid for mongo driver */
  schema?: string
}

export interface EnsureIndexesOptions {
  ensureCollections?: boolean
  retry?: boolean | string[]
  retryLimit?: number
}
