# Расширения CSDatabase для поддержки Savepoint

## 📋 Необходимые изменения в CSDatabase

### 1. Расширение CSTransaction интерфейса

```typescript
// Добавить в packages/collection-store/src/types.ts

export interface CSTransaction {
  // ... существующие методы ...
  startTransaction(options?: TransactionOptions): Promise<void>;
  commitTransaction(): Promise<void>;
  abortTransaction(): Promise<void>;
  endSession(): Promise<void>;
  getCurrentTransactionId(): string | undefined;
  getCurrentTransaction(): CollectionStoreTransaction | undefined;
  activeTransactionCount: number;

  // ✅ НОВЫЕ МЕТОДЫ: Savepoint support
  createSavepoint(name: string): Promise<string>;
  rollbackToSavepoint(savepointId: string): Promise<void>;
  releaseSavepoint(savepointId: string): Promise<void>;
  listSavepoints(): string[];
  getSavepointInfo(savepointId: string): SavepointInfo | undefined;
}

// ✅ НОВЫЙ ИНТЕРФЕЙС: Информация о savepoint на уровне CSDatabase
export interface SavepointInfo {
  savepointId: string;
  name: string;
  timestamp: number;
  transactionId: string;
  collectionsCount: number;
  btreeContextsCount: number;
}

// ✅ НОВЫЙ ИНТЕРФЕЙС: Snapshot данных savepoint для CSDatabase
export interface CSDBSavepointData {
  savepointId: string;
  name: string;
  timestamp: number;
  transactionId: string;
  collectionsSnapshot: Map<string, any[]>;
  btreeContextSnapshots: Map<string, string>; // collection name -> savepoint ID в B+ Tree
}
```

### 2. Расширение CSDatabase класса

```typescript
// Добавить в packages/collection-store/src/CSDatabase.ts

export class CSDatabase implements CSTransaction {
  // ... существующие поля ...
  private root: string;
  private name: string;
  private inTransaction = false;
  private collections: Map<string, Collection<any>>;
  private transactionManager: TransactionManager;
  private currentTransactionId?: string;
  private transactionSnapshots: Map<string, Map<string, any[]>> = new Map();

  // ✅ НОВЫЕ ПОЛЯ: Savepoint support
  private transactionSavepoints: Map<string, Map<string, CSDBSavepointData>> = new Map();
  private savepointCounter: number = 0;
  private savepointNameToId: Map<string, Map<string, string>> = new Map(); // txId -> name -> savepointId

  constructor(root: string, name?: string) {
    // ... существующая инициализация ...
    this.root = root;
    this.name = name || 'default';
    this.collections = new Map();
    this.transactionManager = new TransactionManager();
  }

  // ✅ НОВЫЙ МЕТОД: Создание savepoint
  async createSavepoint(name: string): Promise<string> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.');
    }

    // Проверяем уникальность имени в рамках текущей транзакции
    const txSavepointNames = this.savepointNameToId.get(this.currentTransactionId);
    if (txSavepointNames?.has(name)) {
      throw new Error(`Savepoint with name '${name}' already exists in transaction ${this.currentTransactionId}`);
    }

    // Генерируем уникальный ID
    const savepointId = `csdb-sp-${this.currentTransactionId}-${++this.savepointCounter}-${Date.now()}`;

    console.log(`[CSDatabase] Creating savepoint '${name}' (${savepointId}) for transaction ${this.currentTransactionId}`);

    // Создаем snapshot всех коллекций
    const collectionsSnapshot = new Map<string, any[]>();
    for (const [collectionName, collection] of this.collections) {
      const data = await collection.find({});
      collectionsSnapshot.set(collectionName, JSON.parse(JSON.stringify(data))); // Deep clone
    }

    // Создаем savepoints в B+ Tree контекстах для каждой коллекции
    const btreeContextSnapshots = new Map<string, string>();
    for (const [collectionName, collection] of this.collections) {
      // Получаем TransactionContext для этой коллекции (если есть)
      const btreeContext = (collection as any)._transactionContext;
      if (btreeContext && typeof btreeContext.createSavepoint === 'function') {
        try {
          const btreeSavepointId = await btreeContext.createSavepoint(`${name}-${collectionName}`);
          btreeContextSnapshots.set(collectionName, btreeSavepointId);
          console.log(`[CSDatabase] Created B+ Tree savepoint for collection '${collectionName}': ${btreeSavepointId}`);
        } catch (error) {
          console.warn(`[CSDatabase] Failed to create B+ Tree savepoint for collection '${collectionName}':`, error);
        }
      }
    }

    // Сохраняем данные savepoint
    const savepointData: CSDBSavepointData = {
      savepointId,
      name,
      timestamp: Date.now(),
      transactionId: this.currentTransactionId,
      collectionsSnapshot,
      btreeContextSnapshots
    };

    // Инициализируем Maps если нужно
    if (!this.transactionSavepoints.has(this.currentTransactionId)) {
      this.transactionSavepoints.set(this.currentTransactionId, new Map());
    }
    if (!this.savepointNameToId.has(this.currentTransactionId)) {
      this.savepointNameToId.set(this.currentTransactionId, new Map());
    }

    // Сохраняем savepoint
    this.transactionSavepoints.get(this.currentTransactionId)!.set(savepointId, savepointData);
    this.savepointNameToId.get(this.currentTransactionId)!.set(name, savepointId);

    console.log(`[CSDatabase] Created savepoint '${name}' (${savepointId}) with ${collectionsSnapshot.size} collections and ${btreeContextSnapshots.size} B+ Tree contexts`);
    return savepointId;
  }

  // ✅ НОВЫЙ МЕТОД: Rollback к savepoint
  async rollbackToSavepoint(savepointId: string): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.');
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
    if (!txSavepoints) {
      throw new Error(`No savepoints found for transaction ${this.currentTransactionId}`);
    }

    const savepointData = txSavepoints.get(savepointId);
    if (!savepointData) {
      throw new Error(`Savepoint ${savepointId} not found in transaction ${this.currentTransactionId}`);
    }

    console.log(`[CSDatabase] Rolling back to savepoint '${savepointData.name}' (${savepointId})`);

    try {
      // 1. Rollback B+ Tree contexts сначала
      for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
        const collection = this.collections.get(collectionName);
        if (collection) {
          const btreeContext = (collection as any)._transactionContext;
          if (btreeContext && typeof btreeContext.rollbackToSavepoint === 'function') {
            try {
              await btreeContext.rollbackToSavepoint(btreeSavepointId);
              console.log(`[CSDatabase] Rolled back B+ Tree context for collection '${collectionName}' to savepoint ${btreeSavepointId}`);
            } catch (error) {
              console.error(`[CSDatabase] Failed to rollback B+ Tree context for collection '${collectionName}':`, error);
              throw error;
            }
          }
        }
      }

      // 2. Восстанавливаем данные коллекций
      for (const [collectionName, snapshotData] of savepointData.collectionsSnapshot) {
        const collection = this.collections.get(collectionName);
        if (collection) {
          // Очищаем текущие данные
          await collection.reset();

          // Восстанавливаем из snapshot
          for (const item of snapshotData) {
            await collection.push(item);
          }
          console.log(`[CSDatabase] Restored collection '${collectionName}' with ${snapshotData.length} items`);
        }
      }

      // 3. Удаляем все savepoints созданные после этого
      const savePointsToRemove: string[] = [];
      for (const [spId, sp] of txSavepoints) {
        if (sp.timestamp > savepointData.timestamp) {
          savePointsToRemove.push(spId);
        }
      }

      const txSavepointNames = this.savepointNameToId.get(this.currentTransactionId);
      for (const spId of savePointsToRemove) {
        const sp = txSavepoints.get(spId);
        if (sp) {
          // Удаляем B+ Tree savepoints
          for (const [collectionName, btreeSavepointId] of sp.btreeContextSnapshots) {
            const collection = this.collections.get(collectionName);
            if (collection) {
              const btreeContext = (collection as any)._transactionContext;
              if (btreeContext && typeof btreeContext.releaseSavepoint === 'function') {
                try {
                  await btreeContext.releaseSavepoint(btreeSavepointId);
                } catch (error) {
                  console.warn(`[CSDatabase] Failed to release B+ Tree savepoint for collection '${collectionName}':`, error);
                }
              }
            }
          }

          // Очищаем snapshot данные
          sp.collectionsSnapshot.clear();
          sp.btreeContextSnapshots.clear();

          // Удаляем из Maps
          txSavepoints.delete(spId);
          txSavepointNames?.delete(sp.name);
          console.log(`[CSDatabase] Removed savepoint '${sp.name}' (${spId}) created after rollback point`);
        }
      }

      console.log(`[CSDatabase] Rollback to savepoint '${savepointData.name}' completed successfully`);

    } catch (error) {
      console.error(`[CSDatabase] Failed to rollback to savepoint '${savepointData.name}':`, error);
      throw error;
    }
  }

  // ✅ НОВЫЙ МЕТОД: Release savepoint
  async releaseSavepoint(savepointId: string): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction. Call startTransaction() first.');
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
    if (!txSavepoints) {
      throw new Error(`No savepoints found for transaction ${this.currentTransactionId}`);
    }

    const savepointData = txSavepoints.get(savepointId);
    if (!savepointData) {
      throw new Error(`Savepoint ${savepointId} not found in transaction ${this.currentTransactionId}`);
    }

    console.log(`[CSDatabase] Releasing savepoint '${savepointData.name}' (${savepointId})`);

    try {
      // Release B+ Tree savepoints
      for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
        const collection = this.collections.get(collectionName);
        if (collection) {
          const btreeContext = (collection as any)._transactionContext;
          if (btreeContext && typeof btreeContext.releaseSavepoint === 'function') {
            try {
              await btreeContext.releaseSavepoint(btreeSavepointId);
              console.log(`[CSDatabase] Released B+ Tree savepoint for collection '${collectionName}': ${btreeSavepointId}`);
            } catch (error) {
              console.warn(`[CSDatabase] Failed to release B+ Tree savepoint for collection '${collectionName}':`, error);
            }
          }
        }
      }

      // Очищаем snapshot данные
      savepointData.collectionsSnapshot.clear();
      savepointData.btreeContextSnapshots.clear();

      // Удаляем savepoint
      txSavepoints.delete(savepointId);
      const txSavepointNames = this.savepointNameToId.get(this.currentTransactionId);
      txSavepointNames?.delete(savepointData.name);

      console.log(`[CSDatabase] Released savepoint '${savepointData.name}' (${savepointId}) successfully`);

    } catch (error) {
      console.error(`[CSDatabase] Failed to release savepoint '${savepointData.name}':`, error);
      throw error;
    }
  }

  // ✅ НОВЫЙ МЕТОД: Список savepoints
  listSavepoints(): string[] {
    if (!this.inTransaction || !this.currentTransactionId) {
      return [];
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
    if (!txSavepoints) {
      return [];
    }

    const savepoints: string[] = [];
    for (const savepointData of txSavepoints.values()) {
      savepoints.push(`${savepointData.name} (${savepointData.savepointId}) - ${new Date(savepointData.timestamp).toISOString()}`);
    }
    return savepoints.sort();
  }

  // ✅ НОВЫЙ МЕТОД: Информация о savepoint
  getSavepointInfo(savepointId: string): SavepointInfo | undefined {
    if (!this.inTransaction || !this.currentTransactionId) {
      return undefined;
    }

    const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
    if (!txSavepoints) {
      return undefined;
    }

    const savepointData = txSavepoints.get(savepointId);
    if (!savepointData) {
      return undefined;
    }

    return {
      savepointId: savepointData.savepointId,
      name: savepointData.name,
      timestamp: savepointData.timestamp,
      transactionId: savepointData.transactionId,
      collectionsCount: savepointData.collectionsSnapshot.size,
      btreeContextsCount: savepointData.btreeContextSnapshots.size
    };
  }

  // ✅ РАСШИРЕННЫЙ МЕТОД: commitTransaction с очисткой savepoints
  async commitTransaction(): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction to commit');
    }

    try {
      // Очищаем savepoints перед commit
      const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
      if (txSavepoints) {
        console.log(`[CSDatabase] Clearing ${txSavepoints.size} savepoints before commit`);

        for (const savepointData of txSavepoints.values()) {
          // Release B+ Tree savepoints
          for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
            const collection = this.collections.get(collectionName);
            if (collection) {
              const btreeContext = (collection as any)._transactionContext;
              if (btreeContext && typeof btreeContext.releaseSavepoint === 'function') {
                try {
                  await btreeContext.releaseSavepoint(btreeSavepointId);
                } catch (error) {
                  console.warn(`[CSDatabase] Failed to release B+ Tree savepoint during commit:`, error);
                }
              }
            }
          }

          // Очищаем snapshot данные
          savepointData.collectionsSnapshot.clear();
          savepointData.btreeContextSnapshots.clear();
        }

        // Очищаем Maps
        txSavepoints.clear();
        this.transactionSavepoints.delete(this.currentTransactionId);
        this.savepointNameToId.delete(this.currentTransactionId);
      }

      // Выполняем обычный commit
      await this.transactionManager.commitTransaction(this.currentTransactionId);
      await this.persist();
    } finally {
      this.transactionSnapshots.delete(this.currentTransactionId);
      this.currentTransactionId = undefined;
      this.inTransaction = false;
    }
  }

  // ✅ РАСШИРЕННЫЙ МЕТОД: abortTransaction с очисткой savepoints
  async abortTransaction(): Promise<void> {
    if (!this.inTransaction || !this.currentTransactionId) {
      throw new Error('No active transaction to abort');
    }

    try {
      // Очищаем savepoints перед abort
      const txSavepoints = this.transactionSavepoints.get(this.currentTransactionId);
      if (txSavepoints) {
        console.log(`[CSDatabase] Clearing ${txSavepoints.size} savepoints before abort`);

        for (const savepointData of txSavepoints.values()) {
          // Release B+ Tree savepoints
          for (const [collectionName, btreeSavepointId] of savepointData.btreeContextSnapshots) {
            const collection = this.collections.get(collectionName);
            if (collection) {
              const btreeContext = (collection as any)._transactionContext;
              if (btreeContext && typeof btreeContext.releaseSavepoint === 'function') {
                try {
                  await btreeContext.releaseSavepoint(btreeSavepointId);
                } catch (error) {
                  console.warn(`[CSDatabase] Failed to release B+ Tree savepoint during abort:`, error);
                }
              }
            }
          }

          // Очищаем snapshot данные
          savepointData.collectionsSnapshot.clear();
          savepointData.btreeContextSnapshots.clear();
        }

        // Очищаем Maps
        txSavepoints.clear();
        this.transactionSavepoints.delete(this.currentTransactionId);
        this.savepointNameToId.delete(this.currentTransactionId);
      }

      // Восстанавливаем данные из основного snapshot
      const snapshot = this.transactionSnapshots.get(this.currentTransactionId);
      if (snapshot) {
        for (const [collectionName, snapshotData] of snapshot) {
          const collection = this.collections.get(collectionName);
          if (collection) {
            await collection.reset();
            for (const item of snapshotData) {
              await collection.push(item);
            }
          }
        }
      }

      await this.transactionManager.rollbackTransaction(this.currentTransactionId);
    } finally {
      this.transactionSnapshots.delete(this.currentTransactionId);
      this.currentTransactionId = undefined;
      this.inTransaction = false;
    }
  }

  // ✅ РАСШИРЕННЫЙ МЕТОД: endSession с очисткой savepoints
  async endSession(): Promise<void> {
    if (this.inTransaction && this.currentTransactionId) {
      console.log(`[CSDatabase] Ending session with active transaction ${this.currentTransactionId}, performing rollback`);
      await this.abortTransaction();
    }
  }
}
```

## 🧪 Тесты для CSDatabase Savepoint

### Создать файл: packages/collection-store/src/__test__/CSDatabase.savepoint.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CSDatabase } from '../CSDatabase';
import { promises as fs } from 'fs';
import path from 'path';

describe('CSDatabase Savepoint Integration', () => {
  let database: CSDatabase;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(process.cwd(), 'test-data', `db-savepoint-${Date.now()}`);
    database = new CSDatabase(testDbPath, 'test-savepoint-db');
    await database.connect();
  });

  afterEach(async () => {
    await database.close();
    try {
      await fs.rm(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Savepoint Lifecycle', () => {
    it('should create savepoint in active transaction', async () => {
      await database.startTransaction();

      const savepointId = await database.createSavepoint('test-savepoint');

      expect(savepointId).toMatch(/^csdb-sp-tx-\d+-\w+-1-\d+$/);
      expect(database.listSavepoints()).toHaveLength(1);
      expect(database.listSavepoints()[0]).toContain('test-savepoint');
    });

    it('should reject savepoint creation without transaction', async () => {
      await expect(database.createSavepoint('no-tx')).rejects.toThrow(
        'No active transaction'
      );
    });

    it('should reject duplicate savepoint names', async () => {
      await database.startTransaction();

      await database.createSavepoint('duplicate-name');
      await expect(database.createSavepoint('duplicate-name')).rejects.toThrow(
        "Savepoint with name 'duplicate-name' already exists"
      );
    });

    it('should handle multiple savepoints', async () => {
      await database.startTransaction();

      const sp1 = await database.createSavepoint('savepoint-1');
      const sp2 = await database.createSavepoint('savepoint-2');
      const sp3 = await database.createSavepoint('savepoint-3');

      expect(database.listSavepoints()).toHaveLength(3);
      expect(sp1).not.toBe(sp2);
      expect(sp2).not.toBe(sp3);
    });
  });

  describe('Collection Operations with Savepoints', () => {
    it('should rollback collection changes to savepoint', async () => {
      // Создаем коллекцию и добавляем начальные данные
      const collection = await database.createCollection('users');
      await collection.push({ id: 1, name: 'Alice' });
      await collection.push({ id: 2, name: 'Bob' });

      await database.startTransaction();

      // Создаем savepoint
      const savepointId = await database.createSavepoint('before-changes');

      // Делаем изменения
      await collection.push({ id: 3, name: 'Charlie' });
      await collection.push({ id: 4, name: 'Diana' });

      let users = await collection.find({});
      expect(users).toHaveLength(4);

      // Rollback к savepoint
      await database.rollbackToSavepoint(savepointId);

      // Проверяем что изменения отменены
      users = await collection.find({});
      expect(users).toHaveLength(2);
      expect(users.map(u => u.name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('should handle multiple collections in savepoint', async () => {
      // Создаем несколько коллекций
      const users = await database.createCollection('users');
      const posts = await database.createCollection('posts');

      await users.push({ id: 1, name: 'Alice' });
      await posts.push({ id: 1, title: 'First Post' });

      await database.startTransaction();

      const savepointId = await database.createSavepoint('multi-collection');

      // Изменяем обе коллекции
      await users.push({ id: 2, name: 'Bob' });
      await posts.push({ id: 2, title: 'Second Post' });

      expect(await users.find({})).toHaveLength(2);
      expect(await posts.find({})).toHaveLength(2);

      // Rollback
      await database.rollbackToSavepoint(savepointId);

      // Проверяем обе коллекции
      expect(await users.find({})).toHaveLength(1);
      expect(await posts.find({})).toHaveLength(1);
    });

    it('should handle nested savepoints correctly', async () => {
      const collection = await database.createCollection('items');
      await collection.push({ id: 1, value: 'initial' });

      await database.startTransaction();

      // Создаем цепочку savepoints
      const sp1 = await database.createSavepoint('level-1');
      await collection.push({ id: 2, value: 'level-1' });

      const sp2 = await database.createSavepoint('level-2');
      await collection.push({ id: 3, value: 'level-2' });

      const sp3 = await database.createSavepoint('level-3');
      await collection.push({ id: 4, value: 'level-3' });

      expect(await collection.find({})).toHaveLength(4);

      // Rollback к level-2
      await database.rollbackToSavepoint(sp2);

      const items = await collection.find({});
      expect(items).toHaveLength(3);
      expect(items.map(i => i.value)).toEqual(['initial', 'level-1', 'level-2']);

      // Проверяем что savepoint level-3 удален
      expect(database.listSavepoints()).toHaveLength(2);
    });
  });

  describe('Savepoint Information', () => {
    it('should provide savepoint information', async () => {
      const collection = await database.createCollection('test');
      await collection.push({ id: 1 });

      await database.startTransaction();

      const savepointId = await database.createSavepoint('info-test');
      const info = database.getSavepointInfo(savepointId);

      expect(info).toBeDefined();
      expect(info!.name).toBe('info-test');
      expect(info!.savepointId).toBe(savepointId);
      expect(info!.collectionsCount).toBe(1);
      expect(info!.timestamp).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent savepoint', () => {
      const info = database.getSavepointInfo('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('Transaction Cleanup', () => {
    it('should clear savepoints on commit', async () => {
      await database.startTransaction();

      await database.createSavepoint('sp1');
      await database.createSavepoint('sp2');
      expect(database.listSavepoints()).toHaveLength(2);

      await database.commitTransaction();
      expect(database.listSavepoints()).toHaveLength(0);
    });

    it('should clear savepoints on abort', async () => {
      await database.startTransaction();

      await database.createSavepoint('sp1');
      await database.createSavepoint('sp2');
      expect(database.listSavepoints()).toHaveLength(2);

      await database.abortTransaction();
      expect(database.listSavepoints()).toHaveLength(0);
    });

    it('should clear savepoints on endSession', async () => {
      await database.startTransaction();

      await database.createSavepoint('sp1');
      expect(database.listSavepoints()).toHaveLength(1);

      await database.endSession();
      expect(database.listSavepoints()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rollback to non-existent savepoint', async () => {
      await database.startTransaction();

      await expect(database.rollbackToSavepoint('non-existent')).rejects.toThrow(
        'Savepoint non-existent not found'
      );
    });

    it('should handle release of non-existent savepoint', async () => {
      await database.startTransaction();

      await expect(database.releaseSavepoint('non-existent')).rejects.toThrow(
        'Savepoint non-existent not found'
      );
    });

    it('should handle savepoint operations without transaction', async () => {
      await expect(database.rollbackToSavepoint('any')).rejects.toThrow(
        'No active transaction'
      );

      await expect(database.releaseSavepoint('any')).rejects.toThrow(
        'No active transaction'
      );

      expect(database.listSavepoints()).toHaveLength(0);
    });
  });
});
```

## 📋 Статус реализации Phase 2

### ✅ Готово к реализации
- [x] Спроектирован API для savepoint в CSDatabase
- [x] Определены интерфейсы CSDBSavepointData и SavepointInfo
- [x] Создана координация с B+ Tree savepoints
- [x] Создан план тестирования для интеграционных тестов
- [x] Учтены требования cleanup и error handling

### ⏳ Следующие шаги
1. Реализовать изменения в packages/collection-store/src/CSDatabase.ts
2. Добавить интерфейсы в packages/collection-store/src/types.ts
3. Добавить интеграционные тесты
4. Проверить координацию с B+ Tree savepoints
5. Переходить к Phase 3 - интеграция с MikroORM

---

*Документ создан в соответствии с DEVELOPMENT_RULES.md - фазовый подход к разработке*