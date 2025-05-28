var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __reExport = (target, mod, secondTarget) => {
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(target, key) && key !== "default")
      __defProp(target, key, {
        get: () => mod[key],
        enumerable: true
      });
  if (secondTarget) {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(secondTarget, key) && key !== "default")
        __defProp(secondTarget, key, {
          get: () => mod[key],
          enumerable: true
        });
    return secondTarget;
  }
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  defineConfig: () => defineCollectionStoreConfig,
  MikroORM: () => CollectionStoreMikroORM,
  EntityRepository: () => CollectionStoreEntityRepository,
  EntityManager: () => CollectionStoreEntityManager,
  CollectionStoreSchemaGenerator: () => CollectionStoreSchemaGenerator,
  CollectionStorePlatform: () => CollectionStorePlatform,
  CollectionStoreDriver: () => CollectionStoreDriver,
  CollectionStoreConnection: () => CollectionStoreConnection
});
module.exports = __toCommonJS(exports_src);

// src/Connection.ts
var exports_Connection = {};
__export(exports_Connection, {
  CollectionStoreConnection: () => CollectionStoreConnection
});
var import_core = require("@mikro-orm/core");
var import_collection_store = require("collection-store");

class CollectionStoreConnection extends import_core.Connection {
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
  getCollectionName(_name) {
    const name = import_core.Utils.className(_name);
    const meta = this.metadata.find(import_core.Utils.className(name));
    return meta ? meta.collection : name;
  }
  async connect() {
    if (!this.db) {
      this.db = new import_collection_store.CSDatabase(this.getClientUrl(), this.options.dbName);
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
    const collection = import_core.Utils.className(entityName);
    return this.db.first(collection);
  }
  async last(entityName) {
    const collection = import_core.Utils.className(entityName);
    return this.db.last(collection);
  }
  async lowest(entityName, key) {
    const collection = import_core.Utils.className(entityName);
    return this.db.lowest(collection, key);
  }
  async greatest(entityName, key) {
    const collection = import_core.Utils.className(entityName);
    return this.db.greatest(collection, key);
  }
  async oldest(entityName) {
    const collection = import_core.Utils.className(entityName);
    return this.db.oldest(collection);
  }
  async latest(entityName) {
    const collection = import_core.Utils.className(entityName);
    return this.db.latest(collection);
  }
  async findById(entityName, id) {
    const collection = import_core.Utils.className(entityName);
    return this.db.findById(collection, id);
  }
  async findBy(entityName, key, id) {
    const collection = import_core.Utils.className(entityName);
    return this.db.findBy(collection, key, id);
  }
  async findFirstBy(entityName, key, id) {
    const collection = import_core.Utils.className(entityName);
    return this.db.findFirstBy(collection, key, id);
  }
  async findLastBy(entityName, key, id) {
    const collection = import_core.Utils.className(entityName);
    return this.db.findLastBy(collection, key, id);
  }
  execute(query, params, method, ctx) {
    throw new Error(`${this.constructor.name} does not support generic execute method`);
  }
  async close(force) {
    await this.db.close();
  }
  async ensureConnection() {
    await this.connect();
  }
  async transactional(cb, options = {}) {
    await this.ensureConnection();
    if (options.ctx) {
      const savepointName = `nested_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        const savepointId = await this.createSavepoint(options.ctx, savepointName);
        console.log(`[CollectionStoreConnection] Created savepoint '${savepointName}' for nested transaction`);
        try {
          const ret = await cb(options.ctx);
          await this.releaseSavepoint(options.ctx, savepointId);
          console.log(`[CollectionStoreConnection] Released savepoint '${savepointName}' after successful nested transaction`);
          return ret;
        } catch (error) {
          await this.rollbackToSavepoint(options.ctx, savepointId);
          console.log(`[CollectionStoreConnection] Rolled back to savepoint '${savepointName}' after nested transaction error`);
          throw error;
        }
      } catch (savepointError) {
        console.error(`[CollectionStoreConnection] Failed to manage savepoint for nested transaction:`, savepointError);
        throw savepointError;
      }
    } else {
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
  }
  async begin(options = {}) {
    await this.ensureConnection();
    const { ctx, isolationLevel, eventBroadcaster, ...txOptions } = options;
    if (ctx) {
      console.log(`[CollectionStoreConnection] Using existing transaction context for nested transaction`);
      return ctx;
    }
    if (!ctx) {
      await eventBroadcaster?.dispatchEvent(import_core.EventType.beforeTransactionStart);
    }
    const session = await this.db.startSession();
    session.startTransaction(txOptions);
    this.logQuery("db.begin();");
    await eventBroadcaster?.dispatchEvent(import_core.EventType.afterTransactionStart, session);
    return session;
  }
  async commit(ctx, eventBroadcaster) {
    await this.ensureConnection();
    await eventBroadcaster?.dispatchEvent(import_core.EventType.beforeTransactionCommit, ctx);
    await ctx.commitTransaction();
    this.logQuery("db.commit();");
    await eventBroadcaster?.dispatchEvent(import_core.EventType.afterTransactionCommit, ctx);
  }
  async rollback(ctx, eventBroadcaster) {
    await this.ensureConnection();
    await eventBroadcaster?.dispatchEvent(import_core.EventType.beforeTransactionRollback, ctx);
    await ctx.abortTransaction();
    this.logQuery("db.rollback();");
    await eventBroadcaster?.dispatchEvent(import_core.EventType.afterTransactionRollback, ctx);
  }
  async createSavepoint(ctx, name) {
    await this.ensureConnection();
    try {
      const savepointId = await ctx.createSavepoint(name);
      this.logQuery(`SAVEPOINT ${name}; -- ${savepointId}`);
      return savepointId;
    } catch (error) {
      this.logQuery(`SAVEPOINT ${name}; -- FAILED: ${error.message}`);
      throw error;
    }
  }
  async rollbackToSavepoint(ctx, savepointId) {
    await this.ensureConnection();
    try {
      await ctx.rollbackToSavepoint(savepointId);
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId};`);
    } catch (error) {
      this.logQuery(`ROLLBACK TO SAVEPOINT ${savepointId}; -- FAILED: ${error.message}`);
      throw error;
    }
  }
  async releaseSavepoint(ctx, savepointId) {
    await this.ensureConnection();
    try {
      await ctx.releaseSavepoint(savepointId);
      this.logQuery(`RELEASE SAVEPOINT ${savepointId};`);
    } catch (error) {
      this.logQuery(`RELEASE SAVEPOINT ${savepointId}; -- FAILED: ${error.message}`);
      throw error;
    }
  }
}
// src/Driver.ts
var exports_Driver = {};
__export(exports_Driver, {
  CollectionStoreDriver: () => CollectionStoreDriver
});
var import_core6 = require("@mikro-orm/core");

// src/Platform.ts
var exports_Platform = {};
__export(exports_Platform, {
  CollectionStorePlatform: () => CollectionStorePlatform
});
var import_core3 = require("@mikro-orm/core");

// src/SchemaGenerator.ts
var exports_SchemaGenerator = {};
__export(exports_SchemaGenerator, {
  CollectionStoreSchemaGenerator: () => CollectionStoreSchemaGenerator
});
var import_core2 = require("@mikro-orm/core");

class CollectionStoreSchemaGenerator extends import_core2.AbstractSchemaGenerator {
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
    await Promise.all(metadata.filter((meta) => !existing.includes(meta.collection)).map((meta) => this.connection.db.createCollection(meta.collection)));
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
    await Promise.all(metadata.filter((meta) => existing.includes(meta.collection)).map((meta) => this.connection.db.dropCollection(meta.collection)));
  }
  async updateSchema(options = {}) {
    await this.createSchema(options);
  }
  async ensureDatabase() {
    return false;
  }
  async refreshDatabase(options = {}) {
    await this.ensureDatabase();
    await this.dropSchema();
    await this.createSchema(options);
  }
  async ensureIndexes(options = {}) {
    options.ensureCollections ??= true;
    if (options.ensureCollections) {
      await this.createSchema({ ensureIndexes: false });
    }
    for (const meta of this.getOrderedMetadata()) {
      await this.createIndexes(meta);
      this.createUniqueIndexes(meta);
      for (const prop of meta.props) {
        this.createPropertyIndexes(meta, prop, "index");
        this.createPropertyIndexes(meta, prop, "unique");
        await this.createAutoIndexes(meta, prop);
      }
    }
  }
  async createIndexes(meta) {
    for (const index of meta.indexes) {
      const properties = import_core2.Utils.flatten(import_core2.Utils.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames));
      const db = this.connection.getDb();
      const fieldOrSpec = properties[0];
      await db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: false,
        ...index.options || {}
      });
    }
  }
  async createUniqueIndexes(meta) {
    for (const index of meta.uniques) {
      const properties = import_core2.Utils.flatten(import_core2.Utils.asArray(index.properties).map((prop) => meta.properties[prop].fieldNames));
      const fieldOrSpec = properties[0];
      const db = this.connection.getDb();
      await db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: true,
        ...index.options || {}
      });
    }
  }
  async createPropertyIndexes(meta, prop, type) {
    if (!prop[type] || !meta.collection) {
      return;
    }
    const db = this.connection.getDb();
    const fieldOrSpec = prop.embeddedPath ? prop.embeddedPath.join(".") : prop.fieldNames[0];
    await db.createIndex(meta.className, fieldOrSpec, {
      key: fieldOrSpec,
      unique: type === "unique",
      sparse: prop.nullable === true,
      required: !prop.nullable
    });
  }
  async createAutoIndexes(meta, prop) {
    if (prop.index || prop.unique || !meta.collection) {
      return;
    }
    if (prop.primary) {
      return;
    }
    if (prop.kind && (prop.kind.toString().includes("m:") || prop.kind.toString().includes("1:") || prop.kind.toString().includes("embedded"))) {
      return;
    }
    const db = this.connection.getDb();
    const fieldOrSpec = prop.embeddedPath ? prop.embeddedPath.join(".") : prop.fieldNames[0];
    try {
      await db.createIndex(meta.className, fieldOrSpec, {
        key: fieldOrSpec,
        unique: false,
        sparse: prop.nullable === true,
        required: !prop.nullable
      });
    } catch (error) {
      console.warn(`Failed to create auto-index for ${meta.className}.${fieldOrSpec}:`, error.message);
    }
  }
}

// src/Platform.ts
class CollectionStorePlatform extends import_core3.Platform {
  getSchemaGenerator(driver, em) {
    return new CollectionStoreSchemaGenerator(em ?? driver);
  }
  lookupExtensions(orm) {
    CollectionStoreSchemaGenerator.register(orm);
  }
  supportsTransactions() {
    return true;
  }
  supportsSavePoints() {
    return true;
  }
  getNamingStrategy() {
    return import_core3.EntityCaseNamingStrategy;
  }
  getIdentifierQuoteCharacter() {
    return "";
  }
  getParameterPlaceholder(index) {
    return "?";
  }
  usesReturningStatement() {
    return false;
  }
  usesPivotTable() {
    return false;
  }
  normalizePrimaryKey(data) {
    return data;
  }
  denormalizePrimaryKey(data) {
    return data;
  }
  getSerializedPrimaryKeyField(field) {
    return field;
  }
}

// src/EntityManager.ts
var exports_EntityManager = {};
__export(exports_EntityManager, {
  CollectionStoreEntityManager: () => CollectionStoreEntityManager
});
var import_core4 = require("@mikro-orm/core");

class CollectionStoreEntityManager extends import_core4.EntityManager {
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
var exports_EntityRepository = {};
__export(exports_EntityRepository, {
  CollectionStoreEntityRepository: () => CollectionStoreEntityRepository
});
var import_core5 = require("@mikro-orm/core");

class CollectionStoreEntityRepository extends import_core5.EntityRepository {
  constructor(em, entityName) {
    super(em, entityName);
  }
  getEntityManager() {
    return this.em;
  }
  async first() {
    return this.getEntityManager().first(this.entityName);
  }
  async last() {
    return this.getEntityManager().last(this.entityName);
  }
  async lowest(key) {
    return this.getEntityManager().lowest(this.entityName, key);
  }
  async greatest(key) {
    return this.getEntityManager().greatest(this.entityName, key);
  }
  async oldest() {
    return this.getEntityManager().oldest(this.entityName);
  }
  async latest() {
    return this.getEntityManager().latest(this.entityName);
  }
  async findById(id) {
    return this.getEntityManager().findById(this.entityName, id);
  }
  async findBy(key, id) {
    return this.getEntityManager().findBy(this.entityName, key, id);
  }
  async findFirstBy(key, id) {
    return this.getEntityManager().findFirstBy(this.entityName, key, id);
  }
  async findLastBy(key, id) {
    return this.getEntityManager().findLastBy(this.entityName, key, id);
  }
  getCollection() {
    return this.getEntityManager().getCollection(this.entityName);
  }
}

// src/Driver.ts
class CollectionStoreDriver extends import_core6.DatabaseDriver {
  [import_core6.EntityManagerType];
  platform = new CollectionStorePlatform;
  connection = new CollectionStoreConnection(this.config);
  constructor(config) {
    super(config, ["collection-store"]);
  }
  getRepositoryClass() {
    return CollectionStoreEntityRepository;
  }
  createEntityManager(useContext) {
    return new CollectionStoreEntityManager(this.config, this, this.metadata, useContext);
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
    }
    return [];
  }
  async findOne(entityName, where) {
    if (this.metadata.find(entityName)?.virtual) {
      const [item] = await this.findVirtual(entityName, where, {});
      return item ?? null;
    }
    const res = await this.connection.db.collection(entityName)?.findFirst(where);
    if (res) {
      return res;
    }
    return null;
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
      } else {}
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
__reExport(exports_src, require("@mikro-orm/core"), module.exports);

// src/MikroORM.ts
var exports_MikroORM = {};
__export(exports_MikroORM, {
  defineCollectionStoreConfig: () => defineCollectionStoreConfig,
  CollectionStoreMikroORM: () => CollectionStoreMikroORM
});
var import_core7 = require("@mikro-orm/core");
class CollectionStoreMikroORM extends import_core7.MikroORM {
  static DRIVER = CollectionStoreDriver;
  static async init(options) {
    return super.init(options);
  }
  static initSync(options) {
    return super.initSync(options);
  }
}
function defineCollectionStoreConfig(options) {
  return import_core7.defineConfig({ driver: CollectionStoreDriver, ...options });
}

//# debugId=1D4BBB0391DF297364756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL0Nvbm5lY3Rpb24udHMiLCAiLi4vc3JjL0RyaXZlci50cyIsICIuLi9zcmMvUGxhdGZvcm0udHMiLCAiLi4vc3JjL1NjaGVtYUdlbmVyYXRvci50cyIsICIuLi9zcmMvRW50aXR5TWFuYWdlci50cyIsICIuLi9zcmMvRW50aXR5UmVwb3NpdG9yeS50cyIsICIuLi9zcmMvaW5kZXgudHMiLCAiLi4vc3JjL01pa3JvT1JNLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImltcG9ydCB7XG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbm5lY3Rpb24sXG4gIENvbm5lY3Rpb25PcHRpb25zLFxuICBDb25uZWN0aW9uVHlwZSxcbiAgRW50aXR5TmFtZSxcbiAgRXZlbnRUeXBlLFxuICBJc29sYXRpb25MZXZlbCxcbiAgVHJhbnNhY3Rpb24sXG4gIFRyYW5zYWN0aW9uRXZlbnRCcm9hZGNhc3RlcixcbiAgVHJhbnNhY3Rpb25PcHRpb25zIGFzIE1pa3JvVHJhbnNhY3Rpb25PcHRpb25zLFxuICBVdGlscyxcbn0gZnJvbSAnQG1pa3JvLW9ybS9jb3JlJ1xuXG5pbXBvcnQgeyBDU0RhdGFiYXNlLCBJdGVtLCB0eXBlIFRyYW5zYWN0aW9uT3B0aW9ucyB9IGZyb20gJ2NvbGxlY3Rpb24tc3RvcmUnXG5pbXBvcnQgdHlwZSB7IENTVHJhbnNhY3Rpb24gfSBmcm9tICdjb2xsZWN0aW9uLXN0b3JlJ1xuaW1wb3J0IHR5cGUgeyBTYXZlcG9pbnRDb25uZWN0aW9uIH0gZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGNsYXNzIENvbGxlY3Rpb25TdG9yZUNvbm5lY3Rpb24gZXh0ZW5kcyBDb25uZWN0aW9uIGltcGxlbWVudHMgU2F2ZXBvaW50Q29ubmVjdGlvbiB7XG4gIGRiITogQ1NEYXRhYmFzZVxuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQ29uZmlndXJhdGlvbiwgb3B0aW9ucz86IENvbm5lY3Rpb25PcHRpb25zLCB0eXBlOiBDb25uZWN0aW9uVHlwZSA9ICd3cml0ZScpIHtcbiAgICBzdXBlcihjb25maWcsIG9wdGlvbnMsIHR5cGUpXG4gICAgLy8g0L/RgNC40LTRg9C80LDRgtGMINGH0YLQviDRgtGD0YIg0L3Rg9C20L3QviDRgdC00LXQu9Cw0YLRjCwg0LAg0L/QvtC60LAg0LTQu9GPINGC0LXRgdGC0L7QsiDRhdCy0LDRgtC40YJcbiAgfVxuXG4gIGdldERiKCkge1xuICAgIHJldHVybiB0aGlzLmRiXG4gIH1cblxuICBnZXRDb2xsZWN0aW9uPFQgZXh0ZW5kcyBJdGVtPihuYW1lOiBFbnRpdHlOYW1lPFQ+KSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuY29sbGVjdGlvbjxUPih0aGlzLmdldENvbGxlY3Rpb25OYW1lKG5hbWUpKVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb2xsZWN0aW9uTmFtZTxUPihfbmFtZTogRW50aXR5TmFtZTxUPik6IHN0cmluZyB7XG4gICAgY29uc3QgbmFtZSA9IFV0aWxzLmNsYXNzTmFtZShfbmFtZSlcbiAgICBjb25zdCBtZXRhID0gdGhpcy5tZXRhZGF0YS5maW5kKFV0aWxzLmNsYXNzTmFtZShuYW1lKSlcblxuICAgIHJldHVybiBtZXRhID8gbWV0YS5jb2xsZWN0aW9uIDogbmFtZVxuICB9XG4gIG92ZXJyaWRlIGFzeW5jIGNvbm5lY3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLmRiKSB7XG4gICAgICB0aGlzLmRiID0gbmV3IENTRGF0YWJhc2UodGhpcy5nZXRDbGllbnRVcmwoKSwgdGhpcy5vcHRpb25zLmRiTmFtZSlcbiAgICAgIGF3YWl0IHRoaXMuZGIuY29ubmVjdCgpXG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgaXNDb25uZWN0ZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuICEhdGhpcy5kYlxuICB9XG5cbiAgb3ZlcnJpZGUgY2hlY2tDb25uZWN0aW9uKCk6IFByb21pc2U8eyBvazogdHJ1ZSB9IHwgeyBvazogZmFsc2U7IHJlYXNvbjogc3RyaW5nOyBlcnJvcj86IEVycm9yIH0+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgb2s6IHRydWUgfSlcbiAgfVxuXG4gIG92ZXJyaWRlIGdldERlZmF1bHRDbGllbnRVcmwoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJy4vZGF0YSdcbiAgfVxuXG4gIG92ZXJyaWRlIGdldENsaWVudFVybCgpIHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmNvbmZpZy5nZXRDbGllbnRVcmwodHJ1ZSlcbiAgICByZXR1cm4gdXJsXG4gIH1cblxuICBhc3luYyBmaXJzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5maXJzdChjb2xsZWN0aW9uKVxuICB9XG5cbiAgYXN5bmMgbGFzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5sYXN0KGNvbGxlY3Rpb24pXG4gIH1cblxuICBhc3luYyBsb3dlc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5sb3dlc3QoY29sbGVjdGlvbiwga2V5KVxuICB9XG4gIGFzeW5jIGdyZWF0ZXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Piwga2V5OiBzdHJpbmcpIHtcbiAgICBjb25zdCBjb2xsZWN0aW9uID0gVXRpbHMuY2xhc3NOYW1lKGVudGl0eU5hbWUpXG4gICAgcmV0dXJuIHRoaXMuZGIuZ3JlYXRlc3QoY29sbGVjdGlvbiwga2V5KVxuICB9XG4gIGFzeW5jIG9sZGVzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4pIHtcbiAgICBjb25zdCBjb2xsZWN0aW9uID0gVXRpbHMuY2xhc3NOYW1lKGVudGl0eU5hbWUpXG4gICAgcmV0dXJuIHRoaXMuZGIub2xkZXN0KGNvbGxlY3Rpb24pXG4gIH1cbiAgYXN5bmMgbGF0ZXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Pikge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5sYXRlc3QoY29sbGVjdGlvbilcbiAgfVxuICBhc3luYyBmaW5kQnlJZChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4sIGlkOiBhbnkpIHtcbiAgICBjb25zdCBjb2xsZWN0aW9uID0gVXRpbHMuY2xhc3NOYW1lKGVudGl0eU5hbWUpXG4gICAgcmV0dXJuIHRoaXMuZGIuZmluZEJ5SWQoY29sbGVjdGlvbiwgaWQpXG4gIH1cbiAgYXN5bmMgZmluZEJ5KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Piwga2V5OiBzdHJpbmcsIGlkOiBhbnkpIHtcbiAgICBjb25zdCBjb2xsZWN0aW9uID0gVXRpbHMuY2xhc3NOYW1lKGVudGl0eU5hbWUpXG4gICAgcmV0dXJuIHRoaXMuZGIuZmluZEJ5KGNvbGxlY3Rpb24sIGtleSwgaWQpXG4gIH1cbiAgYXN5bmMgZmluZEZpcnN0QnkoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZywgaWQ6IGFueSkge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5maW5kRmlyc3RCeShjb2xsZWN0aW9uLCBrZXksIGlkKVxuICB9XG4gIGFzeW5jIGZpbmRMYXN0QnkoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZywgaWQ6IGFueSkge1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBVdGlscy5jbGFzc05hbWUoZW50aXR5TmFtZSlcbiAgICByZXR1cm4gdGhpcy5kYi5maW5kTGFzdEJ5KGNvbGxlY3Rpb24sIGtleSwgaWQpXG4gIH1cblxuICBvdmVycmlkZSBleGVjdXRlPFQ+KFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgcGFyYW1zPzogYW55W10gfCB1bmRlZmluZWQsXG4gICAgbWV0aG9kPzogJ2FsbCcgfCAnZ2V0JyB8ICdydW4nIHwgdW5kZWZpbmVkLFxuICAgIGN0eD86IGFueSxcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBkb2VzIG5vdCBzdXBwb3J0IGdlbmVyaWMgZXhlY3V0ZSBtZXRob2RgKVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgY2xvc2UoZm9yY2U/OiBib29sZWFuKSB7XG4gICAgYXdhaXQgdGhpcy5kYi5jbG9zZSgpXG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBlbnN1cmVDb25uZWN0aW9uKCkge1xuICAgIGF3YWl0IHRoaXMuY29ubmVjdCgpXG4gIH1cblxuICAvLyB0cmFuc2FjdGlvbiBzdXBwb3J0XG4gIG92ZXJyaWRlIGFzeW5jIHRyYW5zYWN0aW9uYWw8VD4oXG4gICAgY2I6ICh0cng6IFRyYW5zYWN0aW9uPENTVHJhbnNhY3Rpb24+KSA9PiBQcm9taXNlPFQ+LFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIGlzb2xhdGlvbkxldmVsPzogSXNvbGF0aW9uTGV2ZWxcbiAgICAgIGN0eD86IFRyYW5zYWN0aW9uPENTVHJhbnNhY3Rpb24+XG4gICAgICBldmVudEJyb2FkY2FzdGVyPzogVHJhbnNhY3Rpb25FdmVudEJyb2FkY2FzdGVyXG4gICAgfSAmIFRyYW5zYWN0aW9uT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFQ+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUNvbm5lY3Rpb24oKVxuXG4gICAgLy8g4pyFINCd0J7QktCe0JU6INCV0YHQu9C4INC10YHRgtGMINGA0L7QtNC40YLQtdC70YzRgdC60LDRjyDRgtGA0LDQvdC30LDQutGG0LjRjywg0YHQvtC30LTQsNC10Lwgc2F2ZXBvaW50INCy0LzQtdGB0YLQviDQvdC+0LLQvtC5INGC0YDQsNC90LfQsNC60YbQuNC4XG4gICAgaWYgKG9wdGlvbnMuY3R4KSB7XG4gICAgICBjb25zdCBzYXZlcG9pbnROYW1lID0gYG5lc3RlZF90eF8ke0RhdGUubm93KCl9XyR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDkpfWBcblxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g0KHQvtC30LTQsNC10Lwgc2F2ZXBvaW50INCyINGB0YPRidC10YHRgtCy0YPRjtGJ0LXQuSDRgtGA0LDQvdC30LDQutGG0LjQuFxuICAgICAgICBjb25zdCBzYXZlcG9pbnRJZCA9IGF3YWl0IHRoaXMuY3JlYXRlU2F2ZXBvaW50KG9wdGlvbnMuY3R4LCBzYXZlcG9pbnROYW1lKVxuXG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ29sbGVjdGlvblN0b3JlQ29ubmVjdGlvbl0gQ3JlYXRlZCBzYXZlcG9pbnQgJyR7c2F2ZXBvaW50TmFtZX0nIGZvciBuZXN0ZWQgdHJhbnNhY3Rpb25gKVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmV0ID0gYXdhaXQgY2Iob3B0aW9ucy5jdHgpXG5cbiAgICAgICAgICAvLyDQo9GB0L/QtdGI0L3QvtC1INCy0YvQv9C+0LvQvdC10L3QuNC1IC0gcmVsZWFzZSBzYXZlcG9pbnRcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlbGVhc2VTYXZlcG9pbnQob3B0aW9ucy5jdHgsIHNhdmVwb2ludElkKVxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQ29sbGVjdGlvblN0b3JlQ29ubmVjdGlvbl0gUmVsZWFzZWQgc2F2ZXBvaW50ICcke3NhdmVwb2ludE5hbWV9JyBhZnRlciBzdWNjZXNzZnVsIG5lc3RlZCB0cmFuc2FjdGlvbmApXG5cbiAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgLy8g0J7RiNC40LHQutCwIC0gcm9sbGJhY2sg0Logc2F2ZXBvaW50XG4gICAgICAgICAgYXdhaXQgdGhpcy5yb2xsYmFja1RvU2F2ZXBvaW50KG9wdGlvbnMuY3R4LCBzYXZlcG9pbnRJZClcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0NvbGxlY3Rpb25TdG9yZUNvbm5lY3Rpb25dIFJvbGxlZCBiYWNrIHRvIHNhdmVwb2ludCAnJHtzYXZlcG9pbnROYW1lfScgYWZ0ZXIgbmVzdGVkIHRyYW5zYWN0aW9uIGVycm9yYClcbiAgICAgICAgICB0aHJvdyBlcnJvclxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChzYXZlcG9pbnRFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbQ29sbGVjdGlvblN0b3JlQ29ubmVjdGlvbl0gRmFpbGVkIHRvIG1hbmFnZSBzYXZlcG9pbnQgZm9yIG5lc3RlZCB0cmFuc2FjdGlvbjpgLCBzYXZlcG9pbnRFcnJvcilcbiAgICAgICAgdGhyb3cgc2F2ZXBvaW50RXJyb3JcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8g0J7QsdGL0YfQvdCw0Y8g0YLRgNCw0L3Qt9Cw0LrRhtC40Y8gKNC60L7RgNC90LXQstCw0Y8pXG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5iZWdpbihvcHRpb25zKVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXQgPSBhd2FpdCBjYihzZXNzaW9uKVxuICAgICAgICBhd2FpdCB0aGlzLmNvbW1pdChzZXNzaW9uLCBvcHRpb25zPy5ldmVudEJyb2FkY2FzdGVyKVxuICAgICAgICByZXR1cm4gcmV0XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBhd2FpdCB0aGlzLnJvbGxiYWNrKHNlc3Npb24sIG9wdGlvbnM/LmV2ZW50QnJvYWRjYXN0ZXIpXG4gICAgICAgIHRocm93IGVycm9yXG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBhd2FpdCBzZXNzaW9uLmVuZFNlc3Npb24oKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBvdmVycmlkZSBhc3luYyBiZWdpbihcbiAgICBvcHRpb25zOiB7XG4gICAgICBpc29sYXRpb25MZXZlbD86IElzb2xhdGlvbkxldmVsXG4gICAgICBjdHg/OiBUcmFuc2FjdGlvbjxDU1RyYW5zYWN0aW9uPlxuICAgICAgZXZlbnRCcm9hZGNhc3Rlcj86IFRyYW5zYWN0aW9uRXZlbnRCcm9hZGNhc3RlclxuICAgIH0gJiBUcmFuc2FjdGlvbk9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxDU1RyYW5zYWN0aW9uPiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVDb25uZWN0aW9uKClcbiAgICBjb25zdCB7IGN0eCwgaXNvbGF0aW9uTGV2ZWwsIGV2ZW50QnJvYWRjYXN0ZXIsIC4uLnR4T3B0aW9ucyB9ID0gb3B0aW9uc1xuXG4gICAgLy8g4pyFINCd0J7QktCe0JU6INCV0YHQu9C4INC10YHRgtGMINGA0L7QtNC40YLQtdC70YzRgdC60LDRjyDRgtGA0LDQvdC30LDQutGG0LjRjywg0LLQvtC30LLRgNCw0YnQsNC10Lwg0LXRkSAoc2F2ZXBvaW50INCx0YPQtNC10YIg0YHQvtC30LTQsNC9INCyIHRyYW5zYWN0aW9uYWwpXG4gICAgaWYgKGN0eCkge1xuICAgICAgY29uc29sZS5sb2coYFtDb2xsZWN0aW9uU3RvcmVDb25uZWN0aW9uXSBVc2luZyBleGlzdGluZyB0cmFuc2FjdGlvbiBjb250ZXh0IGZvciBuZXN0ZWQgdHJhbnNhY3Rpb25gKVxuICAgICAgcmV0dXJuIGN0eFxuICAgIH1cblxuICAgIC8vINCh0L7Qt9C00LDQtdC8INC90L7QstGD0Y4g0LrQvtGA0L3QtdCy0YPRjiDRgtGA0LDQvdC30LDQutGG0LjRjlxuICAgIGlmICghY3R4KSB7XG4gICAgICBhd2FpdCBldmVudEJyb2FkY2FzdGVyPy5kaXNwYXRjaEV2ZW50KEV2ZW50VHlwZS5iZWZvcmVUcmFuc2FjdGlvblN0YXJ0KVxuICAgIH1cblxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLmRiLnN0YXJ0U2Vzc2lvbigpXG4gICAgc2Vzc2lvbi5zdGFydFRyYW5zYWN0aW9uKHR4T3B0aW9ucylcbiAgICB0aGlzLmxvZ1F1ZXJ5KCdkYi5iZWdpbigpOycpXG4gICAgYXdhaXQgZXZlbnRCcm9hZGNhc3Rlcj8uZGlzcGF0Y2hFdmVudChFdmVudFR5cGUuYWZ0ZXJUcmFuc2FjdGlvblN0YXJ0LCBzZXNzaW9uKVxuXG4gICAgcmV0dXJuIHNlc3Npb25cbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIGNvbW1pdChjdHg6IENTVHJhbnNhY3Rpb24sIGV2ZW50QnJvYWRjYXN0ZXI/OiBUcmFuc2FjdGlvbkV2ZW50QnJvYWRjYXN0ZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUNvbm5lY3Rpb24oKVxuICAgIGF3YWl0IGV2ZW50QnJvYWRjYXN0ZXI/LmRpc3BhdGNoRXZlbnQoRXZlbnRUeXBlLmJlZm9yZVRyYW5zYWN0aW9uQ29tbWl0LCBjdHgpXG4gICAgYXdhaXQgY3R4LmNvbW1pdFRyYW5zYWN0aW9uKClcbiAgICB0aGlzLmxvZ1F1ZXJ5KCdkYi5jb21taXQoKTsnKVxuICAgIGF3YWl0IGV2ZW50QnJvYWRjYXN0ZXI/LmRpc3BhdGNoRXZlbnQoRXZlbnRUeXBlLmFmdGVyVHJhbnNhY3Rpb25Db21taXQsIGN0eClcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHJvbGxiYWNrKGN0eDogQ1NUcmFuc2FjdGlvbiwgZXZlbnRCcm9hZGNhc3Rlcj86IFRyYW5zYWN0aW9uRXZlbnRCcm9hZGNhc3Rlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlQ29ubmVjdGlvbigpXG5cbiAgICBhd2FpdCBldmVudEJyb2FkY2FzdGVyPy5kaXNwYXRjaEV2ZW50KEV2ZW50VHlwZS5iZWZvcmVUcmFuc2FjdGlvblJvbGxiYWNrLCBjdHgpXG4gICAgYXdhaXQgY3R4LmFib3J0VHJhbnNhY3Rpb24oKVxuICAgIHRoaXMubG9nUXVlcnkoJ2RiLnJvbGxiYWNrKCk7JylcbiAgICBhd2FpdCBldmVudEJyb2FkY2FzdGVyPy5kaXNwYXRjaEV2ZW50KEV2ZW50VHlwZS5hZnRlclRyYW5zYWN0aW9uUm9sbGJhY2ssIGN0eClcbiAgfVxuXG4gIC8vIOKchSDQndCe0JLQq9CVINCc0JXQotCe0JTQqzogU2F2ZXBvaW50IHN1cHBvcnRcbiAgYXN5bmMgY3JlYXRlU2F2ZXBvaW50KGN0eDogQ1NUcmFuc2FjdGlvbiwgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUNvbm5lY3Rpb24oKVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNhdmVwb2ludElkID0gYXdhaXQgY3R4LmNyZWF0ZVNhdmVwb2ludChuYW1lKVxuICAgICAgdGhpcy5sb2dRdWVyeShgU0FWRVBPSU5UICR7bmFtZX07IC0tICR7c2F2ZXBvaW50SWR9YClcbiAgICAgIHJldHVybiBzYXZlcG9pbnRJZFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ1F1ZXJ5KGBTQVZFUE9JTlQgJHtuYW1lfTsgLS0gRkFJTEVEOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gKVxuICAgICAgdGhyb3cgZXJyb3JcbiAgICB9XG4gIH1cblxuICBhc3luYyByb2xsYmFja1RvU2F2ZXBvaW50KGN0eDogQ1NUcmFuc2FjdGlvbiwgc2F2ZXBvaW50SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlQ29ubmVjdGlvbigpXG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgY3R4LnJvbGxiYWNrVG9TYXZlcG9pbnQoc2F2ZXBvaW50SWQpXG4gICAgICB0aGlzLmxvZ1F1ZXJ5KGBST0xMQkFDSyBUTyBTQVZFUE9JTlQgJHtzYXZlcG9pbnRJZH07YClcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dRdWVyeShgUk9MTEJBQ0sgVE8gU0FWRVBPSU5UICR7c2F2ZXBvaW50SWR9OyAtLSBGQUlMRUQ6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApXG4gICAgICB0aHJvdyBlcnJvclxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlbGVhc2VTYXZlcG9pbnQoY3R4OiBDU1RyYW5zYWN0aW9uLCBzYXZlcG9pbnRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVDb25uZWN0aW9uKClcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBjdHgucmVsZWFzZVNhdmVwb2ludChzYXZlcG9pbnRJZClcbiAgICAgIHRoaXMubG9nUXVlcnkoYFJFTEVBU0UgU0FWRVBPSU5UICR7c2F2ZXBvaW50SWR9O2ApXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nUXVlcnkoYFJFTEVBU0UgU0FWRVBPSU5UICR7c2F2ZXBvaW50SWR9OyAtLSBGQUlMRUQ6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApXG4gICAgICB0aHJvdyBlcnJvclxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQge1xuICBDb25maWd1cmF0aW9uLFxuICBEYXRhYmFzZURyaXZlcixcbiAgRW50aXR5RGF0YSxcbiAgRW50aXR5RGljdGlvbmFyeSxcbiAgRW50aXR5TmFtZSxcbiAgRmlsdGVyUXVlcnksXG4gIEZpbmRPcHRpb25zLFxuICBRdWVyeVJlc3VsdCxcbiAgRW50aXR5TWFuYWdlclR5cGUsXG4gIEVudGl0eVJlcG9zaXRvcnksXG4gIENvbnN0cnVjdG9yLFxufSBmcm9tICdAbWlrcm8tb3JtL2NvcmUnXG4vL0B0cy1pZ25vcmVcbmltcG9ydCB7IEl0ZW0gfSBmcm9tICdjb2xsZWN0aW9uLXN0b3JlJ1xuaW1wb3J0IHsgQ29sbGVjdGlvblN0b3JlQ29ubmVjdGlvbiB9IGZyb20gJy4vQ29ubmVjdGlvbidcbmltcG9ydCB7IENvbGxlY3Rpb25TdG9yZVBsYXRmb3JtIH0gZnJvbSAnLi9QbGF0Zm9ybSdcbmltcG9ydCB7IENvbGxlY3Rpb25TdG9yZUVudGl0eU1hbmFnZXIgfSBmcm9tICcuL0VudGl0eU1hbmFnZXInXG5pbXBvcnQgeyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlSZXBvc2l0b3J5IH0gZnJvbSAnLi9FbnRpdHlSZXBvc2l0b3J5J1xuXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvblN0b3JlRHJpdmVyIGV4dGVuZHMgRGF0YWJhc2VEcml2ZXI8Q29sbGVjdGlvblN0b3JlQ29ubmVjdGlvbj4ge1xuICBvdmVycmlkZSBbRW50aXR5TWFuYWdlclR5cGVdITogQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlcjx0aGlzPlxuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgcGxhdGZvcm0gPSBuZXcgQ29sbGVjdGlvblN0b3JlUGxhdGZvcm0oKVxuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgY29ubmVjdGlvbiA9IG5ldyBDb2xsZWN0aW9uU3RvcmVDb25uZWN0aW9uKHRoaXMuY29uZmlnKVxuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQ29uZmlndXJhdGlvbikge1xuICAgIHN1cGVyKGNvbmZpZywgWydjb2xsZWN0aW9uLXN0b3JlJ10pXG4gIH1cblxuICBnZXRSZXBvc2l0b3J5Q2xhc3MoKTogQ29uc3RydWN0b3I8RW50aXR5UmVwb3NpdG9yeTxhbnk+PiB7XG4gICAgcmV0dXJuIENvbGxlY3Rpb25TdG9yZUVudGl0eVJlcG9zaXRvcnkgYXMgYW55XG4gIH1cblxuICBvdmVycmlkZSBjcmVhdGVFbnRpdHlNYW5hZ2VyPFQgZXh0ZW5kcyBvYmplY3QgPSBvYmplY3Q+KHVzZUNvbnRleHQ/OiBib29sZWFuKTogQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlciB7XG4gICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlNYW5hZ2VyKHRoaXMuY29uZmlnLCB0aGlzLCB0aGlzLm1ldGFkYXRhLCB1c2VDb250ZXh0KVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZmluZDxUIGV4dGVuZHMgb2JqZWN0PihlbnRpdHlOYW1lOiBzdHJpbmcsIHdoZXJlOiBGaWx0ZXJRdWVyeTxUPik6IFByb21pc2U8RW50aXR5RGF0YTxUPltdPiB7XG4gICAgaWYgKHRoaXMubWV0YWRhdGEuZmluZChlbnRpdHlOYW1lKT8udmlydHVhbCkge1xuICAgICAgcmV0dXJuIHRoaXMuZmluZFZpcnR1YWwoZW50aXR5TmFtZSwgd2hlcmUsIHt9KVxuICAgIH1cblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuY29ubmVjdGlvbi5kYi5jb2xsZWN0aW9uPFQ+KGVudGl0eU5hbWUpPy5maW5kKHdoZXJlIGFzIGFueSlcbiAgICBpZiAocmVzKSB7XG4gICAgICAvL0B0cy1pZ25vcmVcbiAgICAgIHJldHVybiByZXMucmVkdWNlKChyZXMsIGN1cikgPT4ge1xuICAgICAgICByZXMucHVzaChjdXIpXG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH0sIFtdIGFzIEVudGl0eURhdGE8VD5bXSlcbiAgICB9XG4gICAgcmV0dXJuIFtdXG4gIH1cbiAgb3ZlcnJpZGUgYXN5bmMgZmluZE9uZTxUIGV4dGVuZHMgb2JqZWN0PihlbnRpdHlOYW1lOiBzdHJpbmcsIHdoZXJlOiBGaWx0ZXJRdWVyeTxUPik6IFByb21pc2U8RW50aXR5RGF0YTxUPiB8IG51bGw+IHtcbiAgICBpZiAodGhpcy5tZXRhZGF0YS5maW5kKGVudGl0eU5hbWUpPy52aXJ0dWFsKSB7XG4gICAgICBjb25zdCBbaXRlbV0gPSBhd2FpdCB0aGlzLmZpbmRWaXJ0dWFsKGVudGl0eU5hbWUsIHdoZXJlLCB7fSBhcyBGaW5kT3B0aW9uczxULCBhbnksIGFueSwgYW55PilcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm4gaXRlbSA/PyBudWxsXG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuY29ubmVjdGlvbi5kYi5jb2xsZWN0aW9uPFQ+KGVudGl0eU5hbWUpPy5maW5kRmlyc3Qod2hlcmUgYXMgYW55KVxuICAgIGlmIChyZXMpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIGNvbm5lY3QoKTogUHJvbWlzZTxDb2xsZWN0aW9uU3RvcmVDb25uZWN0aW9uPiB7XG4gICAgYXdhaXQgdGhpcy5jb25uZWN0aW9uLmNvbm5lY3QoKVxuICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25cbiAgfVxuICBvdmVycmlkZSBhc3luYyBuYXRpdmVJbnNlcnQ8VCBleHRlbmRzIEl0ZW0+KGVudGl0eU5hbWU6IHN0cmluZywgZGF0YTogRW50aXR5RGljdGlvbmFyeTxUPik6IFByb21pc2U8UXVlcnlSZXN1bHQ8VD4+IHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5tZXRhZGF0YS5maW5kKGVudGl0eU5hbWUpXG4gICAgY29uc3QgcGsgPSBtZXRhPy5nZXRQcmltYXJ5UHJvcHMoKVswXS5maWVsZE5hbWVzWzBdID8/ICdpZCdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmNvbm5lY3Rpb24uZGIuY29sbGVjdGlvbjxUPihlbnRpdHlOYW1lKT8uY3JlYXRlKGRhdGEpXG4gICAgcmV0dXJuIHtcbiAgICAgIGluc2VydElkOiByZXM/Lltwa10sXG4gICAgICBhZmZlY3RlZFJvd3M6IDEsXG4gICAgICByb3c6IHsgW3BrXTogcmVzPy5bcGtdIH0sXG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgbmF0aXZlSW5zZXJ0TWFueTxUIGV4dGVuZHMgSXRlbT4oXG4gICAgZW50aXR5TmFtZTogc3RyaW5nLFxuICAgIGRhdGE6IEVudGl0eURpY3Rpb25hcnk8VD5bXSxcbiAgKTogUHJvbWlzZTxRdWVyeVJlc3VsdDxUPj4ge1xuICAgIGNvbnN0IHJlcyA9IGRhdGEubWFwKChkKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5uYXRpdmVJbnNlcnQoZW50aXR5TmFtZSwgZClcbiAgICB9KVxuICAgIGNvbnN0IHJlc3VsdCA9IChhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQocmVzKSkucmVkdWNlKFxuICAgICAgKHJlcywgY3VyKSA9PiB7XG4gICAgICAgIGlmIChjdXIuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xuICAgICAgICAgIHJlcy5hZmZlY3RlZFJvd3MgKz0gMVxuICAgICAgICAgIHJlcy5pbnNlcnRlZElkcz8ucHVzaChjdXIudmFsdWUuaW5zZXJ0SWQpXG4gICAgICAgICAgcmVzLnJvd3MhLnB1c2goY3VyLnZhbHVlLnJvdyEpXG4gICAgICAgICAgcmVzLmluc2VydElkID0gY3VyLnZhbHVlLmluc2VydElkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfSxcbiAgICAgIHsgaW5zZXJ0SWRzOiBbXSwgYWZmZWN0ZWRSb3dzOiAwLCByb3dzOiBbXSB9IGFzIHVua25vd24gYXMgUXVlcnlSZXN1bHQ8VD4sXG4gICAgKVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIG5hdGl2ZVVwZGF0ZTxUIGV4dGVuZHMgSXRlbT4oXG4gICAgZW50aXR5TmFtZTogc3RyaW5nLFxuICAgIHdoZXJlOiBGaWx0ZXJRdWVyeTxUPixcbiAgICBkYXRhOiBFbnRpdHlEaWN0aW9uYXJ5PFQ+LFxuICApOiBQcm9taXNlPFF1ZXJ5UmVzdWx0PFQ+PiB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMubWV0YWRhdGEuZmluZChlbnRpdHlOYW1lKVxuICAgIGNvbnN0IHBrID0gbWV0YT8uZ2V0UHJpbWFyeVByb3BzKClbMF0uZmllbGROYW1lc1swXSA/PyAnX2lkJ1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuY29ubmVjdGlvbi5kYi5jb2xsZWN0aW9uPFQ+KGVudGl0eU5hbWUpPy51cGRhdGUod2hlcmUgYXMgYW55LCBkYXRhKSFcbiAgICByZXR1cm4ge1xuICAgICAgaW5zZXJ0SWQ6IHJlc1swXVtwa10sXG4gICAgICBhZmZlY3RlZFJvd3M6IDEsXG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgbmF0aXZlRGVsZXRlPFQgZXh0ZW5kcyBJdGVtPihlbnRpdHlOYW1lOiBzdHJpbmcsIHdoZXJlOiBGaWx0ZXJRdWVyeTxUPik6IFByb21pc2U8UXVlcnlSZXN1bHQ8VD4+IHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5tZXRhZGF0YS5maW5kKGVudGl0eU5hbWUpXG4gICAgY29uc3QgcGsgPSBtZXRhPy5nZXRQcmltYXJ5UHJvcHMoKVswXS5maWVsZE5hbWVzWzBdID8/ICdfaWQnXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5jb25uZWN0aW9uLmRiLmNvbGxlY3Rpb248VD4oZW50aXR5TmFtZSk/LnJlbW92ZSh3aGVyZSBhcyBhbnkpIVxuICAgIHJldHVybiB7XG4gICAgICBpbnNlcnRJZDogcmVzWzBdPy5bcGtdLFxuICAgICAgYWZmZWN0ZWRSb3dzOiByZXMubGVuZ3RoLFxuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIGNvdW50PFQgZXh0ZW5kcyBJdGVtPihlbnRpdHlOYW1lOiBzdHJpbmcsIHdoZXJlOiBGaWx0ZXJRdWVyeTxUPik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5maW5kKGVudGl0eU5hbWUsIHdoZXJlKVxuICAgIHJldHVybiByZXMubGVuZ3RoXG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBmaW5kVmlydHVhbDxUIGV4dGVuZHMgb2JqZWN0PihcbiAgICBlbnRpdHlOYW1lOiBzdHJpbmcsXG4gICAgd2hlcmU6IEZpbHRlclF1ZXJ5PFQ+LFxuICAgIG9wdGlvbnM6IEZpbmRPcHRpb25zPFQsIGFueSwgYW55LCBhbnk+LFxuICApOiBQcm9taXNlPEVudGl0eURhdGE8VD5bXT4ge1xuICAgIGNvbnN0IG1ldGEgPSB0aGlzLm1ldGFkYXRhLmZpbmQoZW50aXR5TmFtZSkhXG5cbiAgICBpZiAobWV0YS5leHByZXNzaW9uIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IGVtID0gdGhpcy5jcmVhdGVFbnRpdHlNYW5hZ2VyKClcbiAgICAgIHJldHVybiBtZXRhLmV4cHJlc3Npb24oZW0sIHdoZXJlLCBvcHRpb25zIGFzIGFueSkgYXMgYW55XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLmZpbmRWaXJ0dWFsKGVudGl0eU5hbWUsIHdoZXJlLCBvcHRpb25zKVxuICB9XG4gIC8vIGV4dHJhIG9wZXJhdGlvbnNcbiAgYXN5bmMgZmlyc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+KTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb25uZWN0aW9uKCdyZWFkJykuZmlyc3QoZW50aXR5TmFtZSlcbiAgfVxuICBhc3luYyBsYXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Pik6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmxhc3QoZW50aXR5TmFtZSlcbiAgfVxuICBhc3luYyBsb3dlc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmxvd2VzdChlbnRpdHlOYW1lLCBrZXkpXG4gIH1cbiAgYXN5bmMgZ3JlYXRlc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmdyZWF0ZXN0KGVudGl0eU5hbWUsIGtleSlcbiAgfVxuICBhc3luYyBvbGRlc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+KTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb25uZWN0aW9uKCdyZWFkJykub2xkZXN0KGVudGl0eU5hbWUpXG4gIH1cbiAgYXN5bmMgbGF0ZXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Pik6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmxhdGVzdChlbnRpdHlOYW1lKVxuICB9XG4gIGFzeW5jIGZpbmRCeUlkKGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55PiwgaWQ6IGFueSkge1xuICAgIHJldHVybiB0aGlzLmdldENvbm5lY3Rpb24oJ3JlYWQnKS5maW5kQnlJZChlbnRpdHlOYW1lLCBpZClcbiAgfVxuICBhc3luYyBmaW5kQnkoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZywgaWQ6IGFueSkge1xuICAgIHJldHVybiB0aGlzLmdldENvbm5lY3Rpb24oJ3JlYWQnKS5maW5kQnkoZW50aXR5TmFtZSwga2V5LCBpZClcbiAgfVxuICBhc3luYyBmaW5kRmlyc3RCeShlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4sIGtleTogc3RyaW5nLCBpZDogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmZpbmRGaXJzdEJ5KGVudGl0eU5hbWUsIGtleSwgaWQpXG4gIH1cbiAgYXN5bmMgZmluZExhc3RCeShlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4sIGtleTogc3RyaW5nLCBpZDogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigncmVhZCcpLmZpbmRMYXN0QnkoZW50aXR5TmFtZSwga2V5LCBpZClcbiAgfVxufVxuIiwKICAgICJpbXBvcnQge1xuICBFbnRpdHlDYXNlTmFtaW5nU3RyYXRlZ3ksXG4gIEVudGl0eU1hbmFnZXIsXG4gIElEYXRhYmFzZURyaXZlcixcbiAgTWlrcm9PUk0sXG4gIE5hbWluZ1N0cmF0ZWd5LFxuICBQbGF0Zm9ybSxcbiAgSVByaW1hcnlLZXksXG59IGZyb20gJ0BtaWtyby1vcm0vY29yZSdcbmltcG9ydCB7IENvbGxlY3Rpb25TdG9yZVNjaGVtYUdlbmVyYXRvciB9IGZyb20gJy4vU2NoZW1hR2VuZXJhdG9yJ1xuXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvblN0b3JlUGxhdGZvcm0gZXh0ZW5kcyBQbGF0Zm9ybSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0OiBrZXB0IGZvciB0eXBlIGluZmVyZW5jZSBvbmx5ICovXG4gIG92ZXJyaWRlIGdldFNjaGVtYUdlbmVyYXRvcihcbiAgICBkcml2ZXI6IElEYXRhYmFzZURyaXZlcixcbiAgICBlbT86IEVudGl0eU1hbmFnZXIsXG4gICk6IENvbGxlY3Rpb25TdG9yZVNjaGVtYUdlbmVyYXRvciB7XG4gICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uU3RvcmVTY2hlbWFHZW5lcmF0b3IoZW0gPz8gKGRyaXZlciBhcyBhbnkpKVxuICB9XG4gIC8qKiBAaW5oZXJpdERvYyAqL1xuICBvdmVycmlkZSBsb29rdXBFeHRlbnNpb25zKG9ybTogTWlrcm9PUk0pOiB2b2lkIHtcbiAgICBDb2xsZWN0aW9uU3RvcmVTY2hlbWFHZW5lcmF0b3IucmVnaXN0ZXIob3JtKVxuICB9XG5cbiAgb3ZlcnJpZGUgc3VwcG9ydHNUcmFuc2FjdGlvbnMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIHN1cHBvcnRzU2F2ZVBvaW50cygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0TmFtaW5nU3RyYXRlZ3koKTogeyBuZXcgKCk6IE5hbWluZ1N0cmF0ZWd5IH0ge1xuICAgIHJldHVybiBFbnRpdHlDYXNlTmFtaW5nU3RyYXRlZ3lcbiAgfVxuXG4gIGdldElkZW50aWZpZXJRdW90ZUNoYXJhY3RlcigpOiBzdHJpbmcge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgZ2V0UGFyYW1ldGVyUGxhY2Vob2xkZXIoaW5kZXg/OiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiAnPydcbiAgfVxuXG4gIG92ZXJyaWRlIHVzZXNSZXR1cm5pbmdTdGF0ZW1lbnQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBvdmVycmlkZSB1c2VzUGl2b3RUYWJsZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIG92ZXJyaWRlIG5vcm1hbGl6ZVByaW1hcnlLZXk8VCA9IG51bWJlciB8IHN0cmluZz4oZGF0YTogSVByaW1hcnlLZXkpOiBUIHtcbiAgICByZXR1cm4gZGF0YSBhcyBUXG4gIH1cblxuICBvdmVycmlkZSBkZW5vcm1hbGl6ZVByaW1hcnlLZXkoZGF0YTogSVByaW1hcnlLZXkpOiBJUHJpbWFyeUtleSB7XG4gICAgcmV0dXJuIGRhdGFcbiAgfVxuXG4gIG92ZXJyaWRlIGdldFNlcmlhbGl6ZWRQcmltYXJ5S2V5RmllbGQoZmllbGQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGZpZWxkXG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHtcbiAgQWJzdHJhY3RTY2hlbWFHZW5lcmF0b3IsXG4gIHR5cGUgRW50aXR5TWV0YWRhdGEsXG4gIHR5cGUgRW50aXR5UHJvcGVydHksXG4gIHR5cGUgTWlrcm9PUk0sXG4gIFV0aWxzLFxufSBmcm9tICdAbWlrcm8tb3JtL2NvcmUnXG5pbXBvcnQgdHlwZSB7IENvbGxlY3Rpb25TdG9yZURyaXZlciB9IGZyb20gJy4vRHJpdmVyJ1xuXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvblN0b3JlU2NoZW1hR2VuZXJhdG9yIGV4dGVuZHMgQWJzdHJhY3RTY2hlbWFHZW5lcmF0b3I8Q29sbGVjdGlvblN0b3JlRHJpdmVyPiB7XG4gIHN0YXRpYyByZWdpc3Rlcihvcm06IE1pa3JvT1JNKTogdm9pZCB7XG4gICAgb3JtLmNvbmZpZy5yZWdpc3RlckV4dGVuc2lvbignQG1pa3JvLW9ybS9zY2hlbWEtZ2VuZXJhdG9yJywgKCkgPT4gbmV3IENvbGxlY3Rpb25TdG9yZVNjaGVtYUdlbmVyYXRvcihvcm0uZW0gYXMgYW55KSlcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIGNyZWF0ZVNjaGVtYShvcHRpb25zOiBDcmVhdGVTY2hlbWFPcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLmVuc3VyZUluZGV4ZXMgPz89IHRydWVcbiAgICBjb25zdCBkYiA9IHRoaXMuY29ubmVjdGlvbi5nZXREYigpXG4gICAgY29uc3QgY29sbGVjdGlvbnMgPSBkYi5saXN0Q29sbGVjdGlvbnMoKVxuICAgIC8vQHRzLWlnbm9yZVxuICAgIGNvbnN0IGV4aXN0aW5nID0gY29sbGVjdGlvbnMubWFwKChjKSA9PiBjLm5hbWUpXG4gICAgY29uc3QgbWV0YWRhdGEgPSB0aGlzLmdldE9yZGVyZWRNZXRhZGF0YSgpXG4gICAgbWV0YWRhdGEucHVzaCh7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbmZpZy5nZXQoJ21pZ3JhdGlvbnMnKS50YWJsZU5hbWUsXG4gICAgfSBhcyBhbnkpXG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIG1ldGFkYXRhXG4gICAgICAgIC5maWx0ZXIoKG1ldGEpID0+ICFleGlzdGluZy5pbmNsdWRlcyhtZXRhLmNvbGxlY3Rpb24pKVxuICAgICAgICAubWFwKChtZXRhKSA9PiB0aGlzLmNvbm5lY3Rpb24uZGIuY3JlYXRlQ29sbGVjdGlvbihtZXRhLmNvbGxlY3Rpb24pKSxcbiAgICApXG5cbiAgICBpZiAob3B0aW9ucy5lbnN1cmVJbmRleGVzKSB7XG4gICAgICBhd2FpdCB0aGlzLmVuc3VyZUluZGV4ZXMoeyBlbnN1cmVDb2xsZWN0aW9uczogZmFsc2UgfSlcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBkcm9wU2NoZW1hKG9wdGlvbnM6IHsgZHJvcE1pZ3JhdGlvbnNUYWJsZT86IGJvb2xlYW4gfSA9IHt9KSB7XG4gICAgY29uc3QgZGIgPSB0aGlzLmNvbm5lY3Rpb24uZ2V0RGIoKVxuICAgIGNvbnN0IGNvbGxlY3Rpb25zID0gZGIubGlzdENvbGxlY3Rpb25zKClcbiAgICAvL0B0cy1pZ25vcmVcbiAgICBjb25zdCBleGlzdGluZyA9IGNvbGxlY3Rpb25zLm1hcCgoYykgPT4gYy5uYW1lKVxuICAgIGNvbnN0IG1ldGFkYXRhID0gdGhpcy5nZXRPcmRlcmVkTWV0YWRhdGEoKVxuXG4gICAgaWYgKG9wdGlvbnMuZHJvcE1pZ3JhdGlvbnNUYWJsZSkge1xuICAgICAgbWV0YWRhdGEucHVzaCh7XG4gICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29uZmlnLmdldCgnbWlncmF0aW9ucycpLnRhYmxlTmFtZSxcbiAgICAgIH0gYXMgYW55KVxuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgbWV0YWRhdGFcbiAgICAgICAgLmZpbHRlcigobWV0YSkgPT4gZXhpc3RpbmcuaW5jbHVkZXMobWV0YS5jb2xsZWN0aW9uKSlcbiAgICAgICAgLm1hcCgobWV0YSkgPT4gdGhpcy5jb25uZWN0aW9uLmRiLmRyb3BDb2xsZWN0aW9uKG1ldGEuY29sbGVjdGlvbikpLFxuICAgIClcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHVwZGF0ZVNjaGVtYShvcHRpb25zOiBDcmVhdGVTY2hlbWFPcHRpb25zID0ge30pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmNyZWF0ZVNjaGVtYShvcHRpb25zKVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZW5zdXJlRGF0YWJhc2UoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBvdmVycmlkZSBhc3luYyByZWZyZXNoRGF0YWJhc2Uob3B0aW9uczogQ3JlYXRlU2NoZW1hT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVEYXRhYmFzZSgpXG4gICAgYXdhaXQgdGhpcy5kcm9wU2NoZW1hKClcbiAgICBhd2FpdCB0aGlzLmNyZWF0ZVNjaGVtYShvcHRpb25zKVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZW5zdXJlSW5kZXhlcyhvcHRpb25zOiBFbnN1cmVJbmRleGVzT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgb3B0aW9ucy5lbnN1cmVDb2xsZWN0aW9ucyA/Pz0gdHJ1ZVxuXG4gICAgaWYgKG9wdGlvbnMuZW5zdXJlQ29sbGVjdGlvbnMpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlU2NoZW1hKHsgZW5zdXJlSW5kZXhlczogZmFsc2UgfSlcbiAgICB9XG5cbiAgICAvLyDQs9C00LUt0YLQviDRgtGD0YIg0L3Rg9C20L3QviDRg9C00LDQu9C40YLRjCDQvdC10L3Rg9C20L3Ri9C1INC40L3QtNC10LrRgdGLXG4gICAgLy8g0LPQtNC1LdGC0L4g0YLRg9GCINC90YPQttC90L4g0YHQutCw0LfQsNGC0YwsINGH0YLQviDRgdC70L7QttC90YvQtSDQuNC90LTQtdC60YHRiyDQvdC1INC40YHQv9C+0LvRjNC30YPQtdC8XG4gICAgZm9yIChjb25zdCBtZXRhIG9mIHRoaXMuZ2V0T3JkZXJlZE1ldGFkYXRhKCkpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlSW5kZXhlcyhtZXRhKVxuICAgICAgdGhpcy5jcmVhdGVVbmlxdWVJbmRleGVzKG1ldGEpXG5cbiAgICAgIGZvciAoY29uc3QgcHJvcCBvZiBtZXRhLnByb3BzKSB7XG4gICAgICAgIHRoaXMuY3JlYXRlUHJvcGVydHlJbmRleGVzKG1ldGEsIHByb3AsICdpbmRleCcpXG4gICAgICAgIHRoaXMuY3JlYXRlUHJvcGVydHlJbmRleGVzKG1ldGEsIHByb3AsICd1bmlxdWUnKVxuXG4gICAgICAgIC8vIENyZWF0ZSBpbmRleGVzIGZvciBhbGwgcHJvcGVydGllcyB0byBzdXBwb3J0IGZpbmRCeSwgbG93ZXN0LCBncmVhdGVzdCBtZXRob2RzXG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlQXV0b0luZGV4ZXMobWV0YSwgcHJvcClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUluZGV4ZXMobWV0YTogRW50aXR5TWV0YWRhdGEpIHtcbiAgICBmb3IgKGNvbnN0IGluZGV4IG9mIG1ldGEuaW5kZXhlcykge1xuICAgICAgY29uc3QgcHJvcGVydGllcyA9IFV0aWxzLmZsYXR0ZW4oVXRpbHMuYXNBcnJheShpbmRleC5wcm9wZXJ0aWVzKS5tYXAoKHByb3ApID0+IG1ldGEucHJvcGVydGllc1twcm9wXS5maWVsZE5hbWVzKSlcbiAgICAgIGNvbnN0IGRiID0gdGhpcy5jb25uZWN0aW9uLmdldERiKClcblxuICAgICAgY29uc3QgZmllbGRPclNwZWMgPSBwcm9wZXJ0aWVzWzBdXG5cbiAgICAgIGF3YWl0IGRiLmNyZWF0ZUluZGV4KG1ldGEuY2xhc3NOYW1lLCBmaWVsZE9yU3BlYywge1xuICAgICAgICBrZXk6IGZpZWxkT3JTcGVjLFxuICAgICAgICB1bmlxdWU6IGZhbHNlLFxuICAgICAgICAuLi4oaW5kZXgub3B0aW9ucyB8fCB7fSksXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlVW5pcXVlSW5kZXhlcyhtZXRhOiBFbnRpdHlNZXRhZGF0YSkge1xuICAgIGZvciAoY29uc3QgaW5kZXggb2YgbWV0YS51bmlxdWVzKSB7XG4gICAgICBjb25zdCBwcm9wZXJ0aWVzID0gVXRpbHMuZmxhdHRlbihVdGlscy5hc0FycmF5KGluZGV4LnByb3BlcnRpZXMpLm1hcCgocHJvcCkgPT4gbWV0YS5wcm9wZXJ0aWVzW3Byb3BdLmZpZWxkTmFtZXMpKVxuXG4gICAgICBjb25zdCBmaWVsZE9yU3BlYyA9IHByb3BlcnRpZXNbMF1cblxuICAgICAgY29uc3QgZGIgPSB0aGlzLmNvbm5lY3Rpb24uZ2V0RGIoKVxuICAgICAgYXdhaXQgZGIuY3JlYXRlSW5kZXgobWV0YS5jbGFzc05hbWUsIGZpZWxkT3JTcGVjLCB7XG4gICAgICAgIGtleTogZmllbGRPclNwZWMsXG4gICAgICAgIHVuaXF1ZTogdHJ1ZSxcbiAgICAgICAgLi4uKGluZGV4Lm9wdGlvbnMgfHwge30pLFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZVByb3BlcnR5SW5kZXhlcyhtZXRhOiBFbnRpdHlNZXRhZGF0YSwgcHJvcDogRW50aXR5UHJvcGVydHksIHR5cGU6ICdpbmRleCcgfCAndW5pcXVlJykge1xuICAgIGlmICghcHJvcFt0eXBlXSB8fCAhbWV0YS5jb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBkYiA9IHRoaXMuY29ubmVjdGlvbi5nZXREYigpXG4gICAgY29uc3QgZmllbGRPclNwZWMgPSBwcm9wLmVtYmVkZGVkUGF0aCA/IHByb3AuZW1iZWRkZWRQYXRoLmpvaW4oJy4nKSA6IHByb3AuZmllbGROYW1lc1swXVxuXG4gICAgYXdhaXQgZGIuY3JlYXRlSW5kZXgobWV0YS5jbGFzc05hbWUsIGZpZWxkT3JTcGVjLCB7XG4gICAgICBrZXk6IGZpZWxkT3JTcGVjLFxuICAgICAgdW5pcXVlOiB0eXBlID09PSAndW5pcXVlJyxcbiAgICAgIHNwYXJzZTogcHJvcC5udWxsYWJsZSA9PT0gdHJ1ZSxcbiAgICAgIHJlcXVpcmVkOiAhcHJvcC5udWxsYWJsZSxcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBdXRvSW5kZXhlcyhtZXRhOiBFbnRpdHlNZXRhZGF0YSwgcHJvcDogRW50aXR5UHJvcGVydHkpIHtcbiAgICAvLyBTa2lwIGlmIGFscmVhZHkgaGFzIGV4cGxpY2l0IGluZGV4IG9yIHVuaXF1ZSBjb25zdHJhaW50XG4gICAgaWYgKHByb3AuaW5kZXggfHwgcHJvcC51bmlxdWUgfHwgIW1ldGEuY29sbGVjdGlvbikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gU2tpcCBwcmltYXJ5IGtleXMgYXMgdGhleSBhbHJlYWR5IGhhdmUgaW5kZXhlc1xuICAgIGlmIChwcm9wLnByaW1hcnkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIFNraXAgcmVsYXRpb25zIGFuZCBlbWJlZGRlZCBwcm9wZXJ0aWVzXG4gICAgaWYgKHByb3Aua2luZCAmJiAocHJvcC5raW5kLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ206JykgfHwgcHJvcC5raW5kLnRvU3RyaW5nKCkuaW5jbHVkZXMoJzE6JykgfHwgcHJvcC5raW5kLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ2VtYmVkZGVkJykpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBkYiA9IHRoaXMuY29ubmVjdGlvbi5nZXREYigpXG4gICAgY29uc3QgZmllbGRPclNwZWMgPSBwcm9wLmVtYmVkZGVkUGF0aCA/IHByb3AuZW1iZWRkZWRQYXRoLmpvaW4oJy4nKSA6IHByb3AuZmllbGROYW1lc1swXVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGRiLmNyZWF0ZUluZGV4KG1ldGEuY2xhc3NOYW1lLCBmaWVsZE9yU3BlYywge1xuICAgICAgICBrZXk6IGZpZWxkT3JTcGVjLFxuICAgICAgICB1bmlxdWU6IGZhbHNlLFxuICAgICAgICBzcGFyc2U6IHByb3AubnVsbGFibGUgPT09IHRydWUsXG4gICAgICAgIHJlcXVpcmVkOiAhcHJvcC5udWxsYWJsZSxcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIElnbm9yZSBlcnJvcnMgaWYgaW5kZXggYWxyZWFkeSBleGlzdHNcbiAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGNyZWF0ZSBhdXRvLWluZGV4IGZvciAke21ldGEuY2xhc3NOYW1lfS4ke2ZpZWxkT3JTcGVjfTpgLCBlcnJvci5tZXNzYWdlKVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZVNjaGVtYU9wdGlvbnMge1xuICAvKiogY3JlYXRlIGluZGV4ZXM/IGRlZmF1bHRzIHRvIHRydWUgKi9cbiAgZW5zdXJlSW5kZXhlcz86IGJvb2xlYW5cbiAgLyoqIG5vdCB2YWxpZCBmb3IgbW9uZ28gZHJpdmVyICovXG4gIHdyYXA/OiBib29sZWFuXG4gIC8qKiBub3QgdmFsaWQgZm9yIG1vbmdvIGRyaXZlciAqL1xuICBzY2hlbWE/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbnN1cmVJbmRleGVzT3B0aW9ucyB7XG4gIGVuc3VyZUNvbGxlY3Rpb25zPzogYm9vbGVhblxuICByZXRyeT86IGJvb2xlYW4gfCBzdHJpbmdbXVxuICByZXRyeUxpbWl0PzogbnVtYmVyXG59XG4iLAogICAgImltcG9ydCB7XG4gIEVudGl0eU1hbmFnZXIsXG4gIHR5cGUgRW50aXR5TmFtZSxcbiAgdHlwZSBFbnRpdHlSZXBvc2l0b3J5LFxuICB0eXBlIEdldFJlcG9zaXRvcnksXG4gIEZvcmtPcHRpb25zLFxufSBmcm9tICdAbWlrcm8tb3JtL2NvcmUnXG5pbXBvcnQgdHlwZSB7IENvbGxlY3Rpb25TdG9yZURyaXZlciB9IGZyb20gJy4vRHJpdmVyJ1xuaW1wb3J0IHR5cGUgeyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlSZXBvc2l0b3J5IH0gZnJvbSAnLi9FbnRpdHlSZXBvc2l0b3J5J1xuLy9AdHMtaWdub3JlXG5pbXBvcnQgeyBJdGVtIH0gZnJvbSAnY29sbGVjdGlvbi1zdG9yZSdcblxuLyoqXG4gKiBAaW5oZXJpdERvY1xuICovXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlcjxcbiAgRCBleHRlbmRzIENvbGxlY3Rpb25TdG9yZURyaXZlciA9IENvbGxlY3Rpb25TdG9yZURyaXZlcixcbj4gZXh0ZW5kcyBFbnRpdHlNYW5hZ2VyPEQ+IHtcbiAgb3ZlcnJpZGUgZm9yayhcbiAgICBvcHRpb25zPzogRm9ya09wdGlvbnMgfCB1bmRlZmluZWQsXG4gICk6IHRoaXMge1xuICAgIHJldHVybiBzdXBlci5mb3JrKG9wdGlvbnMpIGFzIHRoaXNcbiAgfVxuICBhc3luYyBmaXJzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4pOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmdldERyaXZlcigpLmZpcnN0KGVudGl0eU5hbWUpXG4gIH1cbiAgYXN5bmMgbGFzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4pOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiB0aGlzLmdldERyaXZlcigpLmxhc3QoZW50aXR5TmFtZSlcbiAgfVxuICBhc3luYyBsb3dlc3QoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBrZXk6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RHJpdmVyKCkubG93ZXN0KGVudGl0eU5hbWUsIGtleSlcbiAgfVxuICBhc3luYyBncmVhdGVzdChlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4sIGtleTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5nZXREcml2ZXIoKS5ncmVhdGVzdChlbnRpdHlOYW1lLCBrZXkpXG4gIH1cbiAgYXN5bmMgb2xkZXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Pik6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RHJpdmVyKCkub2xkZXN0KGVudGl0eU5hbWUpXG4gIH1cbiAgYXN5bmMgbGF0ZXN0KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Pik6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RHJpdmVyKCkubGF0ZXN0KGVudGl0eU5hbWUpXG4gIH1cbiAgYXN5bmMgZmluZEJ5SWQoZW50aXR5TmFtZTogRW50aXR5TmFtZTxhbnk+LCBpZDogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RHJpdmVyKCkuZmluZEJ5SWQoZW50aXR5TmFtZSwgaWQpXG4gIH1cbiAgYXN5bmMgZmluZEJ5KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Piwga2V5OiBzdHJpbmcsIGlkOiBhbnkpIHtcbiAgICByZXR1cm4gdGhpcy5nZXREcml2ZXIoKS5maW5kQnkoZW50aXR5TmFtZSwga2V5LCBpZClcbiAgfVxuICBhc3luYyBmaW5kRmlyc3RCeShlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPGFueT4sIGtleTogc3RyaW5nLCBpZDogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RHJpdmVyKCkuZmluZEZpcnN0QnkoZW50aXR5TmFtZSwga2V5LCBpZClcbiAgfVxuICBhc3luYyBmaW5kTGFzdEJ5KGVudGl0eU5hbWU6IEVudGl0eU5hbWU8YW55Piwga2V5OiBzdHJpbmcsIGlkOiBhbnkpIHtcbiAgICByZXR1cm4gdGhpcy5nZXREcml2ZXIoKS5maW5kTGFzdEJ5KGVudGl0eU5hbWUsIGtleSwgaWQpXG4gIH1cblxuICBnZXRDb2xsZWN0aW9uPFQgZXh0ZW5kcyBJdGVtPihlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPFQ+KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29ubmVjdGlvbigpLmdldENvbGxlY3Rpb24oZW50aXR5TmFtZSlcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW5oZXJpdERvY1xuICAgKi9cbiAgb3ZlcnJpZGUgZ2V0UmVwb3NpdG9yeTxcbiAgICBUIGV4dGVuZHMgb2JqZWN0LFxuICAgIFUgZXh0ZW5kcyBFbnRpdHlSZXBvc2l0b3J5PFQ+ID0gQ29sbGVjdGlvblN0b3JlRW50aXR5UmVwb3NpdG9yeTxUPixcbiAgPihlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPFQ+KTogR2V0UmVwb3NpdG9yeTxULCBVPiB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFJlcG9zaXRvcnk8VCwgVT4oZW50aXR5TmFtZSlcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBFbnRpdHlSZXBvc2l0b3J5LCBFbnRpdHlOYW1lIH0gZnJvbSAnQG1pa3JvLW9ybS9jb3JlJ1xuaW1wb3J0IHR5cGUgeyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlNYW5hZ2VyIH0gZnJvbSAnLi9FbnRpdHlNYW5hZ2VyJ1xuLy9AdHMtaWdub3JlXG5pbXBvcnQgeyBJdGVtIH0gZnJvbSAnY29sbGVjdGlvbi1zdG9yZSdcblxuZXhwb3J0IGNsYXNzIENvbGxlY3Rpb25TdG9yZUVudGl0eVJlcG9zaXRvcnk8XG4gIFQgZXh0ZW5kcyBJdGVtLFxuPiBleHRlbmRzIEVudGl0eVJlcG9zaXRvcnk8VD4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbTogQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlcixcbiAgICBlbnRpdHlOYW1lOiBFbnRpdHlOYW1lPFQ+LFxuICApIHtcbiAgICBzdXBlcihlbSwgZW50aXR5TmFtZSlcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW5oZXJpdERvY1xuICAgKi9cbiAgb3ZlcnJpZGUgZ2V0RW50aXR5TWFuYWdlcigpOiBDb2xsZWN0aW9uU3RvcmVFbnRpdHlNYW5hZ2VyIHtcbiAgICByZXR1cm4gdGhpcy5lbSBhcyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlNYW5hZ2VyXG4gIH1cblxuICAvLyBDb2xsZWN0aW9uIFN0b3JlIGN1c3RvbSBtZXRob2RzXG4gIGFzeW5jIGZpcnN0KCk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmdldEVudGl0eU1hbmFnZXIoKS5maXJzdCh0aGlzLmVudGl0eU5hbWUpXG4gIH1cblxuICBhc3luYyBsYXN0KCk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmdldEVudGl0eU1hbmFnZXIoKS5sYXN0KHRoaXMuZW50aXR5TmFtZSlcbiAgfVxuXG4gIGFzeW5jIGxvd2VzdChrZXk6IHN0cmluZyk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmdldEVudGl0eU1hbmFnZXIoKS5sb3dlc3QodGhpcy5lbnRpdHlOYW1lLCBrZXkpXG4gIH1cblxuICBhc3luYyBncmVhdGVzdChrZXk6IHN0cmluZyk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmdldEVudGl0eU1hbmFnZXIoKS5ncmVhdGVzdCh0aGlzLmVudGl0eU5hbWUsIGtleSlcbiAgfVxuXG4gIGFzeW5jIG9sZGVzdCgpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRFbnRpdHlNYW5hZ2VyKCkub2xkZXN0KHRoaXMuZW50aXR5TmFtZSlcbiAgfVxuXG4gIGFzeW5jIGxhdGVzdCgpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRFbnRpdHlNYW5hZ2VyKCkubGF0ZXN0KHRoaXMuZW50aXR5TmFtZSlcbiAgfVxuXG4gIGFzeW5jIGZpbmRCeUlkKGlkOiBhbnkpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRFbnRpdHlNYW5hZ2VyKCkuZmluZEJ5SWQodGhpcy5lbnRpdHlOYW1lLCBpZClcbiAgfVxuXG4gIGFzeW5jIGZpbmRCeShrZXk6IHN0cmluZywgaWQ6IGFueSk6IFByb21pc2U8VFtdPiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RW50aXR5TWFuYWdlcigpLmZpbmRCeSh0aGlzLmVudGl0eU5hbWUsIGtleSwgaWQpXG4gIH1cblxuICBhc3luYyBmaW5kRmlyc3RCeShrZXk6IHN0cmluZywgaWQ6IGFueSk6IFByb21pc2U8VCB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmdldEVudGl0eU1hbmFnZXIoKS5maW5kRmlyc3RCeSh0aGlzLmVudGl0eU5hbWUsIGtleSwgaWQpXG4gIH1cblxuICBhc3luYyBmaW5kTGFzdEJ5KGtleTogc3RyaW5nLCBpZDogYW55KTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RW50aXR5TWFuYWdlcigpLmZpbmRMYXN0QnkodGhpcy5lbnRpdHlOYW1lLCBrZXksIGlkKVxuICB9XG5cbiAgZ2V0Q29sbGVjdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRFbnRpdHlNYW5hZ2VyKCkuZ2V0Q29sbGVjdGlvbih0aGlzLmVudGl0eU5hbWUpXG4gIH1cbn1cbiIsCiAgICAiLyogaXN0YW5idWwgaWdub3JlIGZpbGUgKi9cbmV4cG9ydCAqIGZyb20gJy4vQ29ubmVjdGlvbidcbmV4cG9ydCAqIGZyb20gJy4vRHJpdmVyJ1xuZXhwb3J0ICogZnJvbSAnLi9QbGF0Zm9ybSdcbmV4cG9ydCB7IENvbGxlY3Rpb25TdG9yZVNjaGVtYUdlbmVyYXRvciB9IGZyb20gJy4vU2NoZW1hR2VuZXJhdG9yJ1xuZXhwb3J0ICogZnJvbSAnQG1pa3JvLW9ybS9jb3JlJ1xuZXhwb3J0IHsgQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlciBhcyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSAnLi9FbnRpdHlNYW5hZ2VyJ1xuZXhwb3J0IHsgQ29sbGVjdGlvblN0b3JlRW50aXR5UmVwb3NpdG9yeSBhcyBFbnRpdHlSZXBvc2l0b3J5IH0gZnJvbSAnLi9FbnRpdHlSZXBvc2l0b3J5J1xuZXhwb3J0IHtcbiAgQ29sbGVjdGlvblN0b3JlTWlrcm9PUk0gYXMgTWlrcm9PUk0sXG4gIHR5cGUgQ29sbGVjdGlvblN0b3JlT3B0aW9ucyBhcyBPcHRpb25zLFxuICBkZWZpbmVDb2xsZWN0aW9uU3RvcmVDb25maWcgYXMgZGVmaW5lQ29uZmlnLFxufSBmcm9tICcuL01pa3JvT1JNJ1xuIiwKICAgICJpbXBvcnQge1xuICBkZWZpbmVDb25maWcsXG4gIE1pa3JvT1JNLFxuICB0eXBlIE9wdGlvbnMsXG4gIHR5cGUgSURhdGFiYXNlRHJpdmVyLFxuICBFbnRpdHlNYW5hZ2VyVHlwZSxcbiAgRW50aXR5TWFuYWdlcixcbn0gZnJvbSAnQG1pa3JvLW9ybS9jb3JlJ1xuaW1wb3J0IHsgQ29sbGVjdGlvblN0b3JlRHJpdmVyIH0gZnJvbSAnLi9Ecml2ZXInXG5pbXBvcnQgeyBDb2xsZWN0aW9uU3RvcmVFbnRpdHlNYW5hZ2VyIH0gZnJvbSAnLi9FbnRpdHlNYW5hZ2VyJ1xuXG4vKipcbiAqIEBpbmhlcml0RG9jXG4gKi9cbmV4cG9ydCBjbGFzcyBDb2xsZWN0aW9uU3RvcmVNaWtyb09STTxcbiAgRU0gZXh0ZW5kcyBFbnRpdHlNYW5hZ2VyID0gQ29sbGVjdGlvblN0b3JlRW50aXR5TWFuYWdlcixcbj4gZXh0ZW5kcyBNaWtyb09STTxDb2xsZWN0aW9uU3RvcmVEcml2ZXIsIEVNPiB7XG4gIC8vIEB0cy1pZ25vcmVcbiAgcHJpdmF0ZSBzdGF0aWMgRFJJVkVSID0gQ29sbGVjdGlvblN0b3JlRHJpdmVyXG5cbiAgLyoqXG4gICAqIEBpbmhlcml0RG9jXG4gICAqL1xuICBzdGF0aWMgb3ZlcnJpZGUgYXN5bmMgaW5pdDxcbiAgICBEIGV4dGVuZHMgSURhdGFiYXNlRHJpdmVyID0gQ29sbGVjdGlvblN0b3JlRHJpdmVyLFxuICAgIEVNIGV4dGVuZHMgRW50aXR5TWFuYWdlciA9IERbdHlwZW9mIEVudGl0eU1hbmFnZXJUeXBlXSAmIEVudGl0eU1hbmFnZXIsXG4gID4ob3B0aW9ucz86IE9wdGlvbnM8RCwgRU0+KTogUHJvbWlzZTxNaWtyb09STTxELCBFTT4+IHtcbiAgICByZXR1cm4gc3VwZXIuaW5pdChvcHRpb25zKVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbmhlcml0RG9jXG4gICAqL1xuICBzdGF0aWMgb3ZlcnJpZGUgaW5pdFN5bmM8XG4gICAgRCBleHRlbmRzIElEYXRhYmFzZURyaXZlciA9IENvbGxlY3Rpb25TdG9yZURyaXZlcixcbiAgICBFTSBleHRlbmRzIEVudGl0eU1hbmFnZXIgPSBEW3R5cGVvZiBFbnRpdHlNYW5hZ2VyVHlwZV0gJiBFbnRpdHlNYW5hZ2VyLFxuICA+KG9wdGlvbnM6IE9wdGlvbnM8RCwgRU0+KTogTWlrcm9PUk08RCwgRU0+IHtcbiAgICByZXR1cm4gc3VwZXIuaW5pdFN5bmMob3B0aW9ucylcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBDb2xsZWN0aW9uU3RvcmVPcHRpb25zID0gT3B0aW9uczxDb2xsZWN0aW9uU3RvcmVEcml2ZXI+XG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5leHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29sbGVjdGlvblN0b3JlQ29uZmlnKG9wdGlvbnM6IENvbGxlY3Rpb25TdG9yZU9wdGlvbnMpIHtcbiAgcmV0dXJuIGRlZmluZUNvbmZpZyh7IGRyaXZlcjogQ29sbGVjdGlvblN0b3JlRHJpdmVyLCAuLi5vcHRpb25zIH0pXG59XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBWU8sSUFaUDtBQWMwRCxJQUExRDtBQUFBO0FBSU8sTUFBTSxrQ0FBa0MsdUJBQTBDO0FBQUEsRUFDdkY7QUFBQSxFQUVBLFdBQVcsQ0FBQyxRQUF1QixTQUE2QixPQUF1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QU87QUFBQTtBQUFBLE9BRy9DLE1BQUssQ0FBQyxZQUEyQztBQUFBLElBQ3JELE9BQU8sS0FBSyxjQUFjLE1BQU0sRUFBRSxNQUFNLFVBQVU7QUFBQTtBQUFBLE9BRTlDLEtBQUksQ0FBQyxZQUEyQztBQUFBLElBQ3BELE9BQU8sS0FBSyxjQUFjLE1BQU0sRUFBRSxLQUFLLFVBQVU7QUFBQTtBQUFBLE9BRTdDLE9BQU0sQ0FBQyxZQUE2QixLQUEyQjtBQUFBLElBQ25FLE9BQU8sS0FBSyxjQUFjLE1BQU0sRUFBRSxPQUFPLFlBQVksR0FBRztBQUFBO0FBQUEsT0FFcEQsU0FBUSxDQUFDLFlBQTZCLEtBQTJCO0FBQUEsSUFDckUsT0FBTyxLQUFLLGNBQWMsTUFBTSxFQUFFLFNBQVMsWUFBWSxHQUFHO0FBQUE7QUFBQSxPQUV0RCxPQUFNLENBQUMsWUFBMkM7QUFBQSxJQUN0RCxPQUFPLEtBQUssY0FBYyxNQUFNLEVBQUUsT0FBTyxVQUFVO0FBQUE7QUFBQSxPQUUvQyxPQUFNLENBQUMsWUFBMkM7QUFBQSxJQUN0RCxPQUFPLEtBQUssY0FBYyxNQUFNLEVBQUUsT0FBTyxVQUFVO0FBQUE7QUFBQSxPQUUvQyxTQUFRLENBQUMsWUFBNkIsSUFBUztBQUFBLElBQ25ELE9BQU8sS0FBSyxjQUFjLE1BQU0sRUFBRSxTQUFTLFlBQVksRUFBRTtBQUFBO0FBQUEsT0FFckQsT0FBTSxDQUFDLFlBQTZCLEtBQWEsSUFBUztBQUFBLElBQzlELE9BQU8sS0FBSyxjQUFjLE1BQU0sRUFBRSxPQUFPLFlBQVksS0FBSyxFQUFFO0FBQUE7QUFBQSxPQUV4RCxZQUFXLENBQUMsWUFBNkIsS0FBYSxJQUFTO0FBQUEsSUFDbkUsT0FBTyxLQUFLLGNBQWMsTUFBTSxFQUFFLFlBQVksWUFBWSxLQUFLLEVBQUU7QUFBQTtBQUFBLE9BRTdELFdBQVUsQ0FBQyxZQUE2QixLQUFhLElBQVM7QUFBQSxJQUNsRSxPQUFPLEtBQUssY0FBYyxNQUFNLEVBQUUsV0FBVyxZQUFZLEtBQUssRUFBRTtBQUFBO0FBRXBFOzs7QUs1S0E7Ozs7Ozs7O0FDRU8sSUFQUDtBQWNPLE1BQU0sZ0NBRUgsc0JBQW9DO0FBQUEsU0FFN0IsU0FBUztBQUFBLGNBS0YsS0FHckIsQ0FBQyxTQUFvRDtBQUFBLElBQ3BELE9BQU8sTUFBTSxLQUFLLE9BQU87QUFBQTtBQUFBLFNBTVgsUUFHZixDQUFDLFNBQTBDO0FBQUEsSUFDMUMsT0FBTyxNQUFNLFNBQVMsT0FBTztBQUFBO0FBRWpDO0FBS08sU0FBUywyQkFBMkIsQ0FBQyxTQUFpQztBQUFBLEVBQzNFLE9BQU8sMEJBQWEsRUFBRSxRQUFRLDBCQUEwQixRQUFRLENBQUM7QUFBQTsiLAogICJkZWJ1Z0lkIjogIjFENEJCQjAzOTFERjI5NzM2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
