# Тесты для Collection Store

Этот каталог содержит тесты для библиотеки Collection Store.

## Структура тестов

### `collection.node.test.ts`
Основные тесты функциональности коллекций:
- Клонирование коллекций
- Ротация логов
- Работа со списками
- Загрузка индексов
- TTL (Time To Live) функциональность
- Автоинкремент
- Уникальные индексы
- CRUD операции (создание, чтение, обновление, удаление)
- Работа с индексами

### `demo-simple.test.ts`
Тесты демо-функциональности на основе типа `Person`:

#### Валидация типов
- Проверка структуры типа `Person`
- Обработка опциональных полей (например, `apartment`)
- Поддержка различных типов данных для полей

#### Создание демо-данных
- Создание коллекции с FileStorage и демо-данными
- Создание коллекции с List storage и демо-данными
- Проверка уникальности SSN

#### Базовые операции с коллекцией
- Создание пустой коллекции и добавление записей
- Выполнение запросов к демо-данным
- Обработка уникальных ограничений

#### Граничные случаи
- Обработка записей без опциональных полей
- Запросы с пустыми результатами

## Демо-данные

Тесты используют демо-данные типа `Person` со следующей структурой:

```typescript
interface Person {
  id?: number
  name: string
  age: number
  ssn: string
  address: {
    appart?: string | { stage: string; place: string }
    home: string
    city: string
  }
  page: string
}
```

## Запуск тестов

```bash
# Запуск всех тестов
bun test src/__test__/

# Запуск конкретного файла тестов
bun test src/__test__/demo-simple.test.ts
bun test src/__test__/collection.node.test.ts
```

## Конфигурация

Тесты используют две основные конфигурации хранения:
- **FileStorage**: Хранение данных в файлах
- **List Storage**: Хранение данных в памяти

Каждый тест создает изолированные директории для данных, чтобы избежать конфликтов между тестами.

# Test Data Cleanup System

Эта система обеспечивает автоматическую очистку тестовых данных после выполнения тестов, предотвращая накопление мусорных файлов в проекте.

## Компоненты системы

### 1. test-utils.ts
Содержит утилиты для управления тестовыми данными:

- `cleanupTestDirectory(dirPath)` - удаляет одну тестовую директорию
- `cleanupTestDirectories(dirPaths)` - удаляет несколько тестовых директорий
- `createTestDir(baseName)` - создает уникальную тестовую директорию
- `cleanupAllTestData()` - удаляет все известные тестовые директории

### 2. Паттерны использования в тестах

#### Для новых тестов (рекомендуется):
```typescript
import { cleanupTestDirectory, createTestDir } from './test-utils'

describe('My Test', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir('my-test')
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  // ... тесты используют testDir вместо статических путей
})
```

#### Для существующих тестов:
```typescript
import { cleanupTestDirectories } from './test-utils'

// В конце файла
afterAll(async () => {
  await cleanupTestDirectories([
    './test-data-specific-1',
    './test-data-specific-2'
  ])
})
```

### 3. global-cleanup.test.ts
Глобальный cleanup тест, который запускается последним и удаляет все оставшиеся тестовые данные.

## Скрипты в package.json

- `npm test` - запускает все тесты + глобальный cleanup
- `npm run test:clean` - запускает тесты с предварительной и финальной очисткой
- `npm run test:cleanup:before` - очищает test-data перед тестами
- `npm run test:cleanup:after` - запускает глобальный cleanup

## Исправленные тесты

Следующие тесты были обновлены для правильной очистки:

1. ✅ `autoinc-and-default-index.test.ts` - использует уникальные директории
2. ✅ `typed-collection.test.ts` - добавлен глобальный cleanup
3. ✅ `typed-collection-updates.test.ts` - использует уникальные директории
4. ✅ `TransactionalCollection.test.ts` - использует уникальные директории
5. ✅ `memory-adapter-selection.test.ts` - добавлен глобальный cleanup

## Тесты, которые уже имели правильный cleanup

- `CSDatabase.transaction.test.ts`
- `CSDatabase.savepoint.test.ts`
- `wal-storage-integration.test.ts`
- `wal-basic.test.ts`
- `wal-transaction-coordination.test.ts`
- `advanced-features.test.ts`
- `performance-benchmarks.test.ts`
- `stress-testing.test.ts`
- `raft-log-manager.test.ts`
- `raft-log-replication.test.ts`
- `raft-state-machine.test.ts`
- `replication-wal-streaming.test.ts`

## Рекомендации

1. **Для новых тестов**: всегда используйте `createTestDir()` и `cleanupTestDirectory()`
2. **Избегайте статических путей**: не используйте `./test-data` напрямую
3. **Используйте уникальные имена**: каждый тест должен иметь свою директорию
4. **Добавляйте cleanup**: всегда добавляйте `afterEach` или `afterAll` с cleanup
5. **Тестируйте cleanup**: после запуска тестов проверяйте, что папки удалились

## Проверка работы

После запуска тестов в корневой директории проекта не должно остаться папок `test-data*`:

```bash
bun test
ls -la | grep test-data  # Не должно ничего показать
```