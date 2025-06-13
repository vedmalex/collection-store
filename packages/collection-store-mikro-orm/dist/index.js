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
  CollectionStoreValidationError: () => CollectionStoreValidationError,
  CollectionStoreTransactionError: () => CollectionStoreTransactionError,
  CollectionStoreSchemaGenerator: () => CollectionStoreSchemaGenerator,
  CollectionStoreSavepointError: () => CollectionStoreSavepointError,
  CollectionStorePlatform: () => CollectionStorePlatform,
  CollectionStoreNotFoundError: () => CollectionStoreNotFoundError,
  CollectionStoreMikroORM: () => CollectionStoreMikroORM,
  CollectionStoreError: () => CollectionStoreError,
  CollectionStoreEntityRepository: () => CollectionStoreEntityRepository,
  CollectionStoreEntityManager: () => CollectionStoreEntityManager,
  CollectionStoreDriver: () => CollectionStoreDriver,
  CollectionStoreConnectionError: () => CollectionStoreConnectionError,
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
      row: res
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
    console.log(`[nativeInsertMany] final result:`, JSON.stringify(result, null, 2));
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
// src/types.ts
var exports_types = {};
// src/errors.ts
var exports_errors = {};
__export(exports_errors, {
  CollectionStoreValidationError: () => CollectionStoreValidationError,
  CollectionStoreTransactionError: () => CollectionStoreTransactionError,
  CollectionStoreSavepointError: () => CollectionStoreSavepointError,
  CollectionStoreNotFoundError: () => CollectionStoreNotFoundError,
  CollectionStoreError: () => CollectionStoreError,
  CollectionStoreConnectionError: () => CollectionStoreConnectionError
});

class CollectionStoreError extends Error {
  code;
  constructor(message, code) {
    super(message);
    this.name = "CollectionStoreError";
    this.code = code;
  }
}

class CollectionStoreValidationError extends CollectionStoreError {
  violations;
  constructor(message, violations) {
    super(message, "VALIDATION_ERROR");
    this.name = "CollectionStoreValidationError";
    this.violations = violations;
  }
}

class CollectionStoreNotFoundError extends CollectionStoreError {
  constructor(entityName, where) {
    super(`${entityName} not found for criteria ${JSON.stringify(where)}`, "NOT_FOUND");
    this.name = "CollectionStoreNotFoundError";
  }
}

class CollectionStoreConnectionError extends CollectionStoreError {
  constructor(message) {
    super(message, "CONNECTION_ERROR");
    this.name = "CollectionStoreConnectionError";
  }
}

class CollectionStoreTransactionError extends CollectionStoreError {
  constructor(message) {
    super(message, "TRANSACTION_ERROR");
    this.name = "CollectionStoreTransactionError";
  }
}

class CollectionStoreSavepointError extends CollectionStoreError {
  savepointId;
  constructor(message, savepointId) {
    super(message, "SAVEPOINT_ERROR");
    this.name = "CollectionStoreSavepointError";
    this.savepointId = savepointId;
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
function defineCollectionStoreConfig(options = {}) {
  const config = {
    driver: CollectionStoreDriver,
    dbName: options.dbName || ":memory:",
    debug: options.debug ?? true,
    entities: options.entities || [],
    entitiesTs: options.entitiesTs || ["src/**/*.entity.ts"],
    cache: {
      enabled: true,
      adapter: "memory",
      ...options.cache
    },
    forceEntityConstructor: true,
    forceUndefined: false,
    validate: options.validate ?? true,
    strict: options.strict ?? true,
    ...options
  };
  return import_core7.defineConfig(config);
}

//# debugId=FDC1770042258ACC64756E2164756E21
