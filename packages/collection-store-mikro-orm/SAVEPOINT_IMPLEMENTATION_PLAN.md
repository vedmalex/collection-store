# План реализации поддержки Savepoint в @collection-store-mikro-orm

## 📋 Документирование текущих размышлений и идей

### ✅ Анализ текущего состояния
- **Проблема:** MikroORM требует поддержку savepoint для вложенных транзакций
- **Текущее состояние:** `supportsSavePoints(): boolean { return false }` в Platform.ts
- **Архитектура:** CSDatabase поддерживает только одну активную транзакцию
- **B+ Tree:** TransactionContext поддерживает 2PC, но не вложенные транзакции

### 🎯 Цель реализации
Реализовать полную поддержку savepoint для:
1. Вложенных транзакций в MikroORM
2. Rollback к конкретному savepoint
3. Release savepoint
4. Координация между CSDatabase и B+ Tree TransactionContext

---

## 🔧 Phase 1: Расширение B+ Tree TransactionContext для поддержки Savepoint ✅

### 1.1 Необходимые изменения в B+ Tree API

#### ✅ Идея: Добавить поддержку savepoint в ITransactionContext
**Статус:** Спроектировано в `B_PLUS_TREE_SAVEPOINT_EXTENSION.md`

**Требуется реализация в B+ Tree библиотеке:**
- Расширить `ITransactionContext` интерфейс с savepoint методами
- Добавить `SavepointSnapshot<T, K>` и `SavepointInfo` интерфейсы
- Реализовать savepoint логику в `TransactionContext` классе
- Добавить тесты для savepoint функциональности

**API для реализации:**
```typescript
// Новые методы в ITransactionContext
createSavepoint(name: string): Promise<string>;
rollbackToSavepoint(savepointId: string): Promise<void>;
releaseSavepoint(savepointId: string): Promise<void>;
listSavepoints(): string[];
getSavepointInfo(savepointId: string): SavepointInfo | undefined;
```

---

## 🔧 Phase 2: Расширение CSDatabase для поддержки Savepoint ✅

### 2.1 Необходимые изменения в CSDatabase

#### ✅ Идея: Добавить savepoint методы в CSTransaction интерфейс
**Статус:** Спроектировано в `CSDATABASE_SAVEPOINT_EXTENSION.md`

**Требуется реализация:**
- Расширить `CSTransaction` интерфейс с savepoint методами
- Добавить `CSDBSavepointData` и `SavepointInfo` интерфейсы
- Реализовать координацию с B+ Tree savepoints
- Добавить интеграционные тесты

**Ключевые особенности:**
- Snapshot всех коллекций при создании savepoint
- Координация с B+ Tree TransactionContext для каждой коллекции
- Автоматическая очистка savepoints при commit/abort
- Поддержка вложенных savepoints с правильным порядком rollback

---

## 🔧 Phase 3: Интеграция с MikroORM Connection ✅

### 3.1 Необходимые изменения в CollectionStoreConnection

#### ✅ Идея: Добавить savepoint методы в Connection
**Статус:** Спроектировано в `MIKROORM_SAVEPOINT_INTEGRATION.md`

**Требуется реализация:**
- Обновить `Platform.supportsSavePoints()` → `true`
- Добавить savepoint методы в `CollectionStoreConnection`
- Реализовать автоматическое создание savepoints для вложенных транзакций
- Добавить end-to-end тесты

**Ключевые особенности:**
- Автоматическое определение вложенных транзакций через `options.ctx`
- Создание уникальных имен savepoints для nested transactions
- Правильная обработка ошибок с rollback к savepoint
- Логирование savepoint операций для отладки

---

## 🧪 Phase 4: Тестирование (в соответствии с DEVELOPMENT_RULES.md) ✅

### 4.1 Высокогранулированные тесты созданы

#### ✅ B+ Tree TransactionContext тесты
- `TransactionContext.savepoint.test.ts` - 15+ тестов для savepoint функциональности
- Покрытие: создание, rollback, release, nested savepoints, cleanup

#### ✅ CSDatabase интеграционные тесты
- `CSDatabase.savepoint.test.ts` - 12+ тестов для координации с B+ Tree
- Покрытие: multiple collections, nested savepoints, error handling

#### ✅ MikroORM end-to-end тесты
- `savepoint.test.ts` - 10+ тестов для вложенных транзакций
- `transactions.test.ts` - расширенные тесты для complex scenarios
- Покрытие: nested transactions, partial rollback, mixed entities

---

## 🔄 Phase 5: Реализация (в соответствии с DEVELOPMENT_WORKFLOW_RULES.md)

### 5.1 Последовательность реализации

#### ❌ Шаг 1: Расширить B+ Tree TransactionContext
**Статус:** Требует изменений в B+ Tree библиотеке

**Необходимые действия:**
1. ⚠️ **КРИТИЧНО:** B+ Tree библиотека должна быть расширена с savepoint API
2. Реализовать методы из `B_PLUS_TREE_SAVEPOINT_EXTENSION.md`
3. Добавить тесты для savepoint функциональности
4. Обновить экспорты в collection-store

**Файлы для изменения в B+ Tree:**
- `packages/collection-store/src/TransactionContext.ts`
- `packages/collection-store/src/types.ts`
- `packages/collection-store/src/index.ts`
- `packages/collection-store/src/__test__/TransactionContext.savepoint.test.ts`

#### ⏳ Шаг 2: Расширить CSDatabase
**Статус:** Готов к реализации после Шага 1

**Необходимые действия:**
1. Добавить savepoint методы в CSTransaction интерфейс
2. Реализовать savepoint логику в CSDatabase
3. Интегрировать с B+ Tree savepoints
4. Добавить интеграционные тесты

**Файлы для изменения:**
- `packages/collection-store/src/CSDatabase.ts`
- `packages/collection-store/src/types.ts`
- `packages/collection-store/src/__test__/CSDatabase.savepoint.test.ts`

#### ⏳ Шаг 3: Обновить MikroORM интеграцию
**Статус:** Готов к реализации после Шага 2

**Необходимые действия:**
1. Обновить Platform.supportsSavePoints() → true
2. Добавить savepoint методы в Connection
3. Обновить транзакционную логику для поддержки вложенности
4. Добавить end-to-end тесты

**Файлы для изменения:**
- `packages/collection-store-mikro-orm/src/Platform.ts`
- `packages/collection-store-mikro-orm/src/Connection.ts`
- `packages/collection-store-mikro-orm/src/types.ts`
- `packages/collection-store-mikro-orm/src/index.ts`
- `packages/collection-store-mikro-orm/test/savepoint.test.ts`

#### ⏳ Шаг 4: Валидация и оптимизация
**Статус:** После завершения Шагов 1-3

**Необходимые действия:**
1. Запустить полный набор тестов (651+ тестов)
2. Проверить производительность savepoint операций
3. Оптимизировать memory usage для savepoint snapshots
4. Документировать API и примеры использования

---

## 📚 Техническая архитектура

### Координация между компонентами

```typescript
// Поток создания savepoint:
// 1. MikroORM → Connection.createSavepoint()
// 2. Connection → CSDatabase.createSavepoint()
// 3. CSDatabase → TransactionContext.createSavepoint() для каждого B+ Tree
// 4. Возврат savepoint ID через всю цепочку

// Поток rollback к savepoint:
// 1. MikroORM → Connection.rollbackToSavepoint()
// 2. Connection → CSDatabase.rollbackToSavepoint()
// 3. CSDatabase восстанавливает collection snapshots
// 4. CSDatabase → TransactionContext.rollbackToSavepoint() для каждого B+ Tree
// 5. TransactionContext восстанавливает working nodes и deleted nodes
```

### Управление памятью

#### ✅ Идея: Оптимизация savepoint snapshots
- Использовать Copy-on-Write для savepoint snapshots
- Автоматическая очистка старых savepoints при commit
- Лимиты на количество savepoints в транзакции
- Compression для больших snapshots

---

## 🎯 Критерии успеха

### Функциональные требования
- [ ] ✅ Поддержка создания именованных savepoints
- [ ] ✅ Rollback к любому savepoint в транзакции
- [ ] ✅ Release savepoint для освобождения памяти
- [ ] ✅ Вложенные транзакции в MikroORM работают корректно
- [ ] ✅ Координация между CSDatabase и B+ Tree savepoints

### Нефункциональные требования
- [ ] ✅ Все существующие тесты проходят (651 тест)
- [ ] ✅ Производительность savepoint операций < 10ms
- [ ] ✅ Memory overhead для savepoint < 20% от transaction size
- [ ] ✅ Поддержка до 10 savepoints в одной транзакции
- [ ] ✅ Graceful handling ошибок и edge cases

---

## 🚨 Критическое требование: Расширение B+ Tree API

### ⚠️ ВАЖНО: Необходимы изменения в B+ Tree библиотеке

Для реализации поддержки savepoint в `@collection-store-mikro-orm` **ОБЯЗАТЕЛЬНО** требуется расширение B+ Tree API с savepoint методами.

**Необходимые изменения в B+ Tree:**

1. **Расширить ITransactionContext интерфейс:**
   ```typescript
   createSavepoint(name: string): Promise<string>;
   rollbackToSavepoint(savepointId: string): Promise<void>;
   releaseSavepoint(savepointId: string): Promise<void>;
   listSavepoints(): string[];
   getSavepointInfo(savepointId: string): SavepointInfo | undefined;
   ```

2. **Добавить новые интерфейсы:**
   ```typescript
   interface SavepointInfo { ... }
   interface SavepointSnapshot<T, K extends ValueType> { ... }
   ```

3. **Реализовать savepoint логику в TransactionContext:**
   - Snapshot working nodes и deleted nodes
   - Restore состояния при rollback
   - Memory management для snapshots

4. **Добавить comprehensive тесты:**
   - Unit тесты для каждого savepoint метода
   - Integration тесты с B+ Tree операциями
   - Edge cases и error handling

**Без этих изменений в B+ Tree невозможно реализовать полноценную поддержку savepoint в MikroORM интеграции.**

---

## 📋 Готовые документы для реализации

1. **`B_PLUS_TREE_SAVEPOINT_EXTENSION.md`** - Детальный план расширения B+ Tree API
2. **`CSDATABASE_SAVEPOINT_EXTENSION.md`** - План расширения CSDatabase с координацией
3. **`MIKROORM_SAVEPOINT_INTEGRATION.md`** - План интеграции с MikroORM Connection
4. **Comprehensive тесты** - 35+ тестов для всех уровней архитектуры

---

## 🚀 Следующие действия

1. **Приоритет 1:** Реализовать расширения B+ Tree API согласно `B_PLUS_TREE_SAVEPOINT_EXTENSION.md`
2. **Приоритет 2:** Реализовать CSDatabase savepoint согласно `CSDATABASE_SAVEPOINT_EXTENSION.md`
3. **Приоритет 3:** Реализовать MikroORM интеграцию согласно `MIKROORM_SAVEPOINT_INTEGRATION.md`
4. **Приоритет 4:** Запустить полный набор тестов и оптимизировать производительность

---

*План создан в соответствии с DEVELOPMENT_PROMPT_RULES.md, DEVELOPMENT_RULES.md, DEVELOPMENT_WORKFLOW_RULES.md*
*Версия: 2.0 | Дата: Январь 2025*