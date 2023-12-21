// src/Connection.ts
import {
Connection,
EventType,
Utils
} from "@mikro-orm/core";
import {debug} from "debug";
import {CSDatabase} from "collection-store";
var log = debug("connections");

class CollectionStoreConnection extends Connection {
  db;
  constructor(config, options, type = "write") {
    log("constructor", arguments);
    super(config, options, type);
  }
  getDb() {
    log("getDb");
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
    log("connect");
    if (!this.db) {
      this.db = new CSDatabase(this.getClientUrl(), this.options.dbName);
      await this.db.connect();
    }
  }
  async isConnected() {
    log("isConnected");
    return !!this.db;
  }
  checkConnection() {
    log("checkConnection");
    return Promise.resolve({ ok: true });
  }
  getDefaultClientUrl() {
    log("getDefaultClientUrl");
    return "./data";
  }
  getClientUrl() {
    log("getClientUrl");
    const url = this.config.getClientUrl(true);
    return url;
  }
  async first(collection) {
    this.db.first(collection);
  }
  async last(collection) {
    this.db.first(collection);
  }
  async lowest(collection, key) {
    this.db.lowest(collection, key);
  }
  async greatest(collection, key) {
    this.db.greatest(collection, key);
  }
  async oldest(collection) {
    this.db.oldest(collection);
  }
  async latest(collection) {
    this.db.latest(collection);
  }
  async findById(collection, id) {
    this.db.findById(collection, id);
  }
  async findBy(collection, key, id) {
    this.db.findBy(collection, key, id);
  }
  async findFirstBy(collection, key, id) {
    this.db.findFirstBy(collection, key, id);
  }
  async findLastBy(collection, key, id) {
    this.db.findLastBy(collection, key, id);
  }
  execute(query, params, method, ctx) {
    throw new Error(`${this.constructor.name} does not support generic execute method`);
  }
  async close(force) {
    log("close", arguments);
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
import {debug as debug2} from "debug";
var log2 = debug2("generator");

class CollectionStoreSchemaGenerator extends AbstractSchemaGenerator {
  constructor() {
    super(...arguments);
  }
  static register(orm) {
    log2("register");
    orm.config.registerExtension("@mikro-orm/schema-generator", () => new CollectionStoreSchemaGenerator(orm.em));
  }
  async createSchema(options = {}) {
    log2("createSchema");
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
    log2("dropSchema");
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
    log2("updateSchema");
    await this.createSchema(options);
  }
  async ensureDatabase() {
    log2("ensureDatabase");
    return false;
  }
  async refreshDatabase(options = {}) {
    log2("refreshDatabase");
    this.ensureDatabase();
    this.dropSchema();
    this.createSchema(options);
  }
  async ensureIndexes(options = {}) {
    log2("ensureIndexes");
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
    log2("createIndexes");
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
    log2("createUniqueIndexes");
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
    log2("createPropertyIndexes");
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
import {debug as debug3} from "debug";
var log3 = debug3("platform");

class CollectionStorePlatform extends Platform {
  constructor() {
    super(...arguments);
  }
  getSchemaGenerator(driver, em) {
    log3("getSchemaGenerator", arguments);
    return new CollectionStoreSchemaGenerator(em ?? driver);
  }
  lookupExtensions(orm) {
    log3("lookupExtensions", arguments);
    CollectionStoreSchemaGenerator.register(orm);
  }
  supportsTransactions() {
    log3("supportsTransactions", arguments);
    return true;
  }
  getNamingStrategy() {
    log3("getNamingStrategy", arguments);
    return EntityCaseNamingStrategy;
  }
}

// src/Driver.ts
import {debug as debug4} from "debug";
var log4 = debug4("driver");

class CollectionStoreDriver extends DatabaseDriver {
  platform = new CollectionStorePlatform;
  connection = new CollectionStoreConnection(this.config);
  constructor(config) {
    log4("constructor", arguments);
    super(config, ["collection-store"]);
  }
  async find(entityName, where) {
    log4("find", arguments);
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
    log4("findOne", arguments);
    const res = await this.connection.db.collection(entityName)?.findFirst(where);
    if (res) {
      return res;
    } else {
      return null;
    }
  }
  async connect() {
    log4("connect", arguments);
    await this.connection.connect();
    return this.connection;
  }
  async nativeInsert(entityName, data) {
    log4("nativeInsert", arguments);
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
    log4("nativeInsertMany", arguments);
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
    log4("nativeUpdate", arguments);
    const meta = this.metadata.find(entityName);
    const pk = meta?.getPrimaryProps()[0].fieldNames[0] ?? "_id";
    const res = await this.connection.db.collection(entityName)?.update(where, data);
    return {
      insertId: res[0][pk],
      affectedRows: 1
    };
  }
  async nativeDelete(entityName, where) {
    log4("nativeDelete", arguments);
    const meta = this.metadata.find(entityName);
    const pk = meta?.getPrimaryProps()[0].fieldNames[0] ?? "_id";
    const res = await this.connection.db.collection(entityName)?.remove(where);
    return {
      insertId: res[0]?.[pk],
      affectedRows: res.length
    };
  }
  async count(entityName, where) {
    log4("count", arguments);
    const res = await this.find(entityName, where);
    return res.length;
  }
  async findVirtual(entityName, where, options) {
    log4("findVirtual", arguments);
    const meta = this.metadata.find(entityName);
    if (meta.expression instanceof Function) {
      const em = this.createEntityManager();
      return meta.expression(em, where, options);
    }
    return super.findVirtual(entityName, where, options);
  }
  async first(collection) {
    return this.getConnection("read").first(collection);
  }
  async last(collection) {
    return this.getConnection("read").last(collection);
  }
  async lowest(collection, key) {
    return this.getConnection("read").lowest(collection, key);
  }
  async greatest(collection, key) {
    return this.getConnection("read").greatest(collection, key);
  }
  async oldest(collection) {
    return this.getConnection("read").oldest(collection);
  }
  async latest(collection) {
    return this.getConnection("read").latest(collection);
  }
  async findById(collection, id) {
    return this.getConnection("read").findById(collection, id);
  }
  async findBy(collection, key, id) {
    return this.getConnection("read").findBy(collection, key, id);
  }
  async findFirstBy(collection, key, id) {
    return this.getConnection("read").findFirstBy(collection, key, id);
  }
  async findLastBy(collection, key, id) {
    return this.getConnection("read").findLastBy(collection, key, id);
  }
}

// src/index.ts
export * from "@mikro-orm/core";

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
  CollectionStorePlatform,
  CollectionStoreDriver,
  CollectionStoreConnection
};
