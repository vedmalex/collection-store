// src/Connection.ts
import {
Connection,
EventType,
Utils
} from "@mikro-orm/core";
import {CSDatabase} from "collection-store";

class CollectionStoreConnection extends Connection {
  db;
  constructor(config, options, type = "write") {
    super(config, options, type);
  }
  getDb() {
    return this.db;
  }
  getCollection(name) {
    return this.db.collection(this.getCollectionName(name));
  }
  getCollectionName(name) {
    name = Utils.className(name);
    const meta = this.metadata.find(name);
    return meta ? meta.collection : name;
  }
  async connect() {
    if (!this.db) {
      this.db = new CSDatabase(this.getClientUrl(), this.options.dbName);
      await this.db.connect();
    }
  }
  async isConnected() {
    return !!this.db;
  }
  checkConnection() {
    return Promise.resolve({ ok: true });
  }
  getDefaultClientUrl() {
    return "./data";
  }
  getClientUrl() {
    const url = this.config.getClientUrl(true);
    return url;
  }
  async first(entityName) {
    const collection = Utils.className(entityName);
    return this.db.first(collection);
  }
  async last(entityName) {
    const collection = Utils.className(entityName);
    return this.db.first(collection);
  }
  async lowest(entityName, key) {
    const collection = Utils.className(entityName);
    return this.db.lowest(collection, key);
  }
  async greatest(entityName, key) {
    const collection = Utils.className(entityName);
    return this.db.greatest(collection, key);
  }
  async oldest(entityName) {
    const collection = Utils.className(entityName);
    return this.db.oldest(collection);
  }
  async latest(entityName) {
    const collection = Utils.className(entityName);
    return this.db.latest(collection);
  }
  async findById(entityName, id) {
    const collection = Utils.className(entityName);
    return this.db.findById(collection, id);
  }
  async findBy(entityName, key, id) {
    const collection = Utils.className(entityName);
    return this.db.findBy(collection, key, id);
  }
  async findFirstBy(entityName, key, id) {
    const collection = Utils.className(entityName);
    return this.db.findFirstBy(collection, key, id);
  }
  async findLastBy(entityName, key, id) {
    const collection = Utils.className(entityName);
    return this.db.findLastBy(collection, key, id);
  }
  execute(query, params, method, ctx) {
    throw new Error(`${this.constructor.name} does not support generic execute method`);
  }
  async close(force) {
    this.db.close();
  }
  async ensureConnection() {
    this.connect();
  }
  async transactional(cb, options = {}) {
    await this.ensureConnection();
    const session = await this.begin(options);
    try {
      const ret = await cb(session);
      await this.commit(session, options?.eventBroadcaster);
      return ret;
    } catch (error) {
      await this.rollback(session, options?.eventBroadcaster);
      throw error;
    } finally {
      await session.endSession();
    }
  }
  async begin(options = {}) {
    await this.ensureConnection();
    const { ctx, isolationLevel, eventBroadcaster, ...txOptions } = options;
    if (!ctx) {
      await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionStart);
    }
    const session = ctx || await this.db.startSession();
    session.startTransaction(txOptions);
    this.logQuery("db.begin();");
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionStart, session);
    return session;
  }
  async commit(ctx, eventBroadcaster) {
    await this.ensureConnection();
    await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionCommit, ctx);
    await ctx.commitTransaction();
    this.logQuery("db.commit();");
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionCommit, ctx);
  }
  async rollback(ctx, eventBroadcaster) {
    await this.ensureConnection();
    await eventBroadcaster?.dispatchEvent(EventType.beforeTransactionRollback, ctx);
    await ctx.abortTransaction();
    this.logQuery("db.rollback();");
    await eventBroadcaster?.dispatchEvent(EventType.afterTransactionRollback, ctx);
  }
}
// src/Driver.ts
import {
DatabaseDriver
} from "@mikro-orm/core";

// src/Platform.ts
import {
EntityCaseNamingStrategy,
Platform
} from "@mikro-orm/core";

// src/SchemaGenerator.ts
import {
AbstractSchemaGenerator,
Utils as Utils2
} from "@mikro-orm/core";

class CollectionStoreSchemaGenerator extends AbstractSchemaGenerator {
  constructor() {
    super(...arguments);
  }
  static register(orm) {
    orm.config.registerExtension("@mikro-orm/schema-generator", () => new CollectionStoreSchemaGenerator(orm.em));
  }
  async createSchema(options = {}) {
    options.ensureIndexes ??= true;
    const db = this.connection.getDb();
    const collections = db.listCollections();
    const existing = collections.map((c) => c.name);
    const metadata = this.getOrderedMetadata();
    metadata.push({
      collection: this.config.get("migrations").tableName
    });
    metadata.filter((meta) => !existing.includes(meta.collection)).forEach((meta) => this.connection.db.createCollection(meta.collection));
    if (options.ensureIndexes) {
      await this.ensureIndexes({ ensureCollections: false });
    }
  }
  async dropSchema(options = {}) {
    const db = this.connection.getDb();
    const collections = db.listCollections();
    const existing = collections.map((c) => c.name);
    const metadata = this.getOrderedMetadata();
    if (options.dropMigrationsTable) {
      metadata.push({
        collection: this.config.get("migrations").tableName
      });
    }
    metadata.filter((meta) => existing.includes(meta.collection)).forEach((meta) => this.connection.db.dropCollection(meta.collection));
  }
  async updateSchema(options = {}) {
    await this.createSchema(options);
  }
  async ensureDatabase() {
    return false;
  }
  async refreshDatabase(options = {}) {
    this.ensureDatabase();
    this.dropSchema();
    this.createSchema(options);
  }
  async ensureIndexes(options = {}) {
    options.ensureCollections ??= true;
    if (options.ensureCollections) {
      await this.createSchema({ ensureIndexes: false });
    }
    for (const meta of this.getOrderedMetadata()) {
      this.createIndexes(meta);
      this.createUniqueIndexes(meta);
      for (const prop of meta.props) {
        this.createPropertyIndexes(meta, prop, "index");
        this.createPropertyIndexes(meta, prop, "unique");
      }
    }
  }
  createIndexes(meta) {
    meta.indexes.forEach((index) => {
      let fieldOrSpec;
      const properties = Utils2.flatten(Utils2.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames));
      const db = this.connection.getDb();
      fieldOrSpec = properties[0];
      db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: false,
        ...index.options || {}
      });
    });
  }
  createUniqueIndexes(meta) {
    meta.uniques.forEach((index) => {
      const properties = Utils2.flatten(Utils2.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames));
      const fieldOrSpec = properties[0];
      const db = this.connection.getDb();
      db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: true,
        ...index.options || {}
      });
    });
  }
  createPropertyIndexes(meta, prop, type) {
    if (!prop[type] || !meta.collection) {
      return;
    }
    const db = this.connection.getDb();
    const fieldOrSpec = prop.embeddedPath ? prop.embeddedPath.join(".") : prop.fieldNames[0];
    db.createIndex(meta.className, fieldOrSpec, {
      key: fieldOrSpec,
      unique: type === "unique",
      sparse: prop.nullable === true,
      required: !prop.nullable
    });
  }
}

// src/Platform.ts
class CollectionStorePlatform extends Platform {
  constructor() {
    super(...arguments);
  }
  getSchemaGenerator(driver, em) {
    return new CollectionStoreSchemaGenerator(em ?? driver);
  }
  lookupExtensions(orm) {
    CollectionStoreSchemaGenerator.register(orm);
  }
  supportsTransactions() {
    return true;
  }
  getNamingStrategy() {
    return EntityCaseNamingStrategy;
  }
}

// src/Driver.ts
class CollectionStoreDriver extends DatabaseDriver {
  platform = new CollectionStorePlatform;
  connection = new CollectionStoreConnection(this.config);
  constructor(config) {
    super(config, ["collection-store"]);
  }
  async find(entityName, where) {
    if (this.metadata.find(entityName)?.virtual) {
      return this.findVirtual(entityName, where, {});
    }
    const res = await this.connection.db.collection(entityName)?.find(where);
    if (res) {
      return res.reduce((res2, cur) => {
        res2.push(cur);
        return res2;
      }, []);
    } else {
      return [];
    }
  }
  async findOne(entityName, where) {
    if (this.metadata.find(entityName)?.virtual) {
      const [item] = await this.findVirtual(entityName, where, {});
      return item ?? null;
    }
    const res = await this.connection.db.collection(entityName)?.findFirst(where);
    if (res) {
      return res;
    } else {
      return null;
    }
  }
  async connect() {
    await this.connection.connect();
    return this.connection;
  }
  async nativeInsert(entityName, data) {
    const meta = this.metadata.find(entityName);
    const pk = meta?.getPrimaryProps()[0].fieldNames[0] ?? "id";
    const res = await this.connection.db.collection(entityName)?.create(data);
    return {
      insertId: res?.[pk],
      affectedRows: 1,
      row: { [pk]: res?.[pk] }
    };
  }
  async nativeInsertMany(entityName, data) {
    const res = data.map((d) => {
      return this.nativeInsert(entityName, d);
    });
    const result = (await Promise.allSettled(res)).reduce((res2, cur) => {
      if (cur.status === "fulfilled") {
        res2.affectedRows += 1;
        res2.insertedIds?.push(cur.value.insertId);
        res2.rows.push(cur.value.row);
        res2.insertId = cur.value.insertId;
      } else {
      }
      return res2;
    }, { insertIds: [], affectedRows: 0, rows: [] });
    return result;
  }
  async nativeUpdate(entityName, where, data) {
    const meta = this.metadata.find(entityName);
    const pk = meta?.getPrimaryProps()[0].fieldNames[0] ?? "_id";
    const res = await this.connection.db.collection(entityName)?.update(where, data);
    return {
      insertId: res[0][pk],
      affectedRows: 1
    };
  }
  async nativeDelete(entityName, where) {
    const meta = this.metadata.find(entityName);
    const pk = meta?.getPrimaryProps()[0].fieldNames[0] ?? "_id";
    const res = await this.connection.db.collection(entityName)?.remove(where);
    return {
      insertId: res[0]?.[pk],
      affectedRows: res.length
    };
  }
  async count(entityName, where) {
    const res = await this.find(entityName, where);
    return res.length;
  }
  async findVirtual(entityName, where, options) {
    const meta = this.metadata.find(entityName);
    if (meta.expression instanceof Function) {
      const em = this.createEntityManager();
      return meta.expression(em, where, options);
    }
    return super.findVirtual(entityName, where, options);
  }
  async first(entityName) {
    return this.getConnection("read").first(entityName);
  }
  async last(entityName) {
    return this.getConnection("read").last(entityName);
  }
  async lowest(entityName, key) {
    return this.getConnection("read").lowest(entityName, key);
  }
  async greatest(entityName, key) {
    return this.getConnection("read").greatest(entityName, key);
  }
  async oldest(entityName) {
    return this.getConnection("read").oldest(entityName);
  }
  async latest(entityName) {
    return this.getConnection("read").latest(entityName);
  }
  async findById(entityName, id) {
    return this.getConnection("read").findById(entityName, id);
  }
  async findBy(entityName, key, id) {
    return this.getConnection("read").findBy(entityName, key, id);
  }
  async findFirstBy(entityName, key, id) {
    return this.getConnection("read").findFirstBy(entityName, key, id);
  }
  async findLastBy(entityName, key, id) {
    return this.getConnection("read").findLastBy(entityName, key, id);
  }
}

// src/index.ts
export * from "@mikro-orm/core";

// src/EntityManager.ts
import {
EntityManager as EntityManager2
} from "@mikro-orm/core";

class CollectionStoreEntityManager extends EntityManager2 {
  constructor() {
    super(...arguments);
  }
  fork(options) {
    return super.fork(options);
  }
  async first(entityName) {
    return this.getDriver().first(entityName);
  }
  async last(entityName) {
    return this.getDriver().last(entityName);
  }
  async lowest(entityName, key) {
    return this.getDriver().lowest(entityName, key);
  }
  async greatest(entityName, key) {
    return this.getDriver().greatest(entityName, key);
  }
  async oldest(entityName) {
    return this.getDriver().oldest(entityName);
  }
  async latest(entityName) {
    return this.getDriver().latest(entityName);
  }
  async findById(entityName, id) {
    return this.getDriver().findById(entityName, id);
  }
  async findBy(entityName, key, id) {
    return this.getDriver().findBy(entityName, key, id);
  }
  async findFirstBy(entityName, key, id) {
    return this.getDriver().findFirstBy(entityName, key, id);
  }
  async findLastBy(entityName, key, id) {
    return this.getDriver().findLastBy(entityName, key, id);
  }
  getCollection(entityName) {
    return this.getConnection().getCollection(entityName);
  }
  getRepository(entityName) {
    return super.getRepository(entityName);
  }
}
// src/EntityRepository.ts
import {EntityRepository} from "@mikro-orm/core";

class CollectionStoreEntityRepository extends EntityRepository {
  em;
  constructor(em, entityName) {
    super(em, entityName);
    this.em = em;
  }
  async first(entityName) {
    return this.getEntityManager().first(entityName);
  }
  async last(entityName) {
    return this.getEntityManager().last(entityName);
  }
  async lowest(entityName, key) {
    return this.getEntityManager().lowest(entityName, key);
  }
  async greatest(entityName, key) {
    return this.getEntityManager().greatest(entityName, key);
  }
  async oldest(entityName) {
    return this.getEntityManager().oldest(entityName);
  }
  async latest(entityName) {
    return this.getEntityManager().latest(entityName);
  }
  async findById(entityName, id) {
    return this.getEntityManager().findById(entityName, id);
  }
  async findBy(entityName, key, id) {
    return this.getEntityManager().findBy(entityName, key, id);
  }
  async findFirstBy(entityName, key, id) {
    return this.getEntityManager().findFirstBy(entityName, key, id);
  }
  async findLastBy(entityName, key, id) {
    return this.getEntityManager().findLastBy(entityName, key, id);
  }
  getCollection() {
    return this.getEntityManager().getCollection(this.entityName);
  }
  getEntityManager() {
    return this.em;
  }
}
// src/MikroORM.ts
import {
defineConfig,
MikroORM as MikroORM2
} from "@mikro-orm/core";
function defineCollectionStoreConfig(options) {
  return defineConfig({ driver: CollectionStoreDriver, ...options });
}

class CollectionStoreMikroORM extends MikroORM2 {
  constructor() {
    super(...arguments);
  }
  static DRIVER = CollectionStoreDriver;
  static async init(options) {
    return super.init(options);
  }
  static initSync(options) {
    return super.initSync(options);
  }
}
export {
  defineCollectionStoreConfig as defineConfig,
  CollectionStoreMikroORM as MikroORM,
  CollectionStoreEntityRepository as EntityRepository,
  CollectionStoreEntityManager as EntityManager,
  CollectionStorePlatform,
  CollectionStoreDriver,
  CollectionStoreConnection
};
