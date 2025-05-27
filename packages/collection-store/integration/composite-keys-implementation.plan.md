# План реализации составных ключей индекса

## 📋 Оглавление

- [Анализ текущего состояния](#-анализ-текущего-состояния)
- [Фазы разработки](#-фазы-разработки)
- [Техническая архитектура](#-техническая-архитектура)
- [Тестирование](#-тестирование)

---

## 🔍 Анализ текущего состояния

### Текущая архитектура индексов
- **IndexDef**: Поддерживает только одиночные ключи `key: string | Paths<T>`
- **B+ Tree**: Использует `ValueType = number | string | boolean | Date | bigint | valueOf | null | undefined`
- **Ограничения**: Нет поддержки составных ключей из нескольких полей

### Требования для составных ключей
- Поддержка индексов по нескольким полям: `{ name: 'composite_idx', keys: ['field1', 'field2', 'field3'] }`
- Сериализация составных ключей в ValueType для B+ Tree
- Правильное сравнение составных ключей
- Обратная совместимость с существующими индексами

---

## 🎯 Фазы разработки

### Phase 1: Extend Core Types ✅
1. Расширить `IndexDef` для поддержки составных ключей
2. Создать `CompositeKey` тип и утилиты сериализации
3. Добавить функции сравнения составных ключей
4. Обновить типы в `ICollectionConfig`

### Phase 2: Update Index Operations ✅
5. Обновить `create_index` для составных ключей
6. Модифицировать `get_indexed_value` для извлечения составных значений
7. Обновить `prepare_index_insert`, `update_index`, `remove_index`
8. Добавить валидацию составных ключей

### Phase 3: Query System Integration ⏳
9. Обновить методы поиска (`findBy`, `findFirstBy`, `findLastBy`)
10. Добавить поддержку составных ключей в query system
11. Обновить range queries для составных ключей

### Phase 4: Testing & Documentation ⏳
12. Написать comprehensive тесты
13. Добавить performance тесты
14. Обновить документацию и примеры

---

## 🏗️ Техническая архитектура

### CompositeKey Implementation
```typescript
// Новый тип для составных ключей
export type CompositeKeyDef<T extends Item> = {
  keys: Array<string | Paths<T>>
  separator?: string // По умолчанию '\u0000'
}

// Расширенный IndexDef
export interface IndexDef<T extends Item> {
  key?: string | Paths<T>           // Для одиночных ключей
  keys?: Array<string | Paths<T>>   // Для составных ключей
  composite?: CompositeKeyDef<T>      // Альтернативный синтаксис
  auto?: boolean
  unique?: boolean
  sparse?: boolean
  required?: boolean
  ignoreCase?: boolean
  gen?: IdGeneratorFunction<T>
  process?: (value: any) => any
}
```

### Composite Key Serialization
```typescript
// Утилиты для работы с составными ключами
export class CompositeKeyUtils {
  static serialize(values: any[], separator: string = '\u0000'): string
  static deserialize(serialized: string, separator: string = '\u0000'): any[]
  static compare(a: string, b: string): number
  static extractValues<T extends Item>(item: T, keyPaths: Array<string | Paths<T>>): any[]
}
```

### Index Creation Strategy
```typescript
// Обновленная логика создания индекса
function create_composite_index<T extends Item>(
  collection: Collection<T>,
  indexName: string,
  indexDef: IndexDef<T>
): void {
  if (indexDef.keys || indexDef.composite) {
    // Создание составного индекса
    const keyPaths = indexDef.keys || indexDef.composite?.keys || []
    const separator = indexDef.composite?.separator || '\u0000'

    // Создать B+ Tree с составными ключами как строками
    collection.indexes[indexName] = new BPlusTree<any, string>(3, indexDef.unique)

    // Настроить функции извлечения и сериализации
    collection.indexDefs[indexName] = {
      ...indexDef,
      process: (item: T) => CompositeKeyUtils.serialize(
        CompositeKeyUtils.extractValues(item, keyPaths),
        separator
      )
    }
  } else {
    // Существующая логика для одиночных ключей
    // ...
  }
}
```

---

## 🧪 Тестирование

### Test Categories

#### 1. Unit Tests - CompositeKeyUtils
```typescript
describe('CompositeKeyUtils', () => {
  describe('serialize', () => {
    it('should serialize simple values', () => {
      expect(CompositeKeyUtils.serialize(['a', 'b', 'c'])).toBe('a\u0000b\u0000c')
    })

    it('should handle null/undefined values', () => {
      expect(CompositeKeyUtils.serialize(['a', null, 'c'])).toBe('a\u0000\u0000c')
    })

    it('should use custom separator', () => {
      expect(CompositeKeyUtils.serialize(['a', 'b'], '|')).toBe('a|b')
    })
  })

  describe('compare', () => {
    it('should compare composite keys lexicographically', () => {
      const key1 = CompositeKeyUtils.serialize(['a', 'b'])
      const key2 = CompositeKeyUtils.serialize(['a', 'c'])
      expect(CompositeKeyUtils.compare(key1, key2)).toBeLessThan(0)
    })
  })
})
```

#### 2. Integration Tests - Index Operations
```typescript
describe('Composite Index Operations', () => {
  let collection: Collection<TestItem>

  beforeEach(async () => {
    collection = Collection.create({
      name: 'test',
      indexList: [
        {
          keys: ['category', 'priority', 'createdAt'],
          unique: false,
          sparse: false
        }
      ]
    })
  })

  it('should create composite index correctly', () => {
    expect(collection.indexes['category,priority,createdAt']).toBeDefined()
  })

  it('should insert items with composite keys', async () => {
    const item = { id: 1, category: 'bug', priority: 'high', createdAt: new Date() }
    await collection.create(item)

    const found = await collection.findBy('category,priority,createdAt',
      CompositeKeyUtils.serialize(['bug', 'high', item.createdAt]))
    expect(found).toHaveLength(1)
  })
})
```

#### 3. Performance Tests
```typescript
describe('Composite Index Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const startTime = performance.now()

    // Insert 10,000 items with composite keys
    for (let i = 0; i < 10000; i++) {
      await collection.create({
        id: i,
        category: `cat_${i % 10}`,
        priority: `pri_${i % 5}`,
        value: i
      })
    }

    const insertTime = performance.now() - startTime
    expect(insertTime).toBeLessThan(5000) // 5 seconds max

    // Test query performance
    const queryStart = performance.now()
    const results = await collection.findBy('category,priority',
      CompositeKeyUtils.serialize(['cat_1', 'pri_2']))
    const queryTime = performance.now() - queryStart

    expect(queryTime).toBeLessThan(100) // 100ms max
    expect(results.length).toBeGreaterThan(0)
  })
})
```

#### 4. Edge Cases Tests
```typescript
describe('Composite Index Edge Cases', () => {
  it('should handle empty values in composite keys', () => { /* ... */ })
  it('should handle special characters in values', () => { /* ... */ })
  it('should handle different data types', () => { /* ... */ })
  it('should maintain uniqueness constraints', () => { /* ... */ })
  it('should handle sparse indexes correctly', () => { /* ... */ })
})
```

---

## 📝 Implementation Checklist

### Phase 1: Core Types ✅
- [x] Создать `CompositeKeyUtils` класс
- [x] Расширить `IndexDef` интерфейс
- [x] Добавить типы для составных ключей
- [x] Написать unit тесты для утилит

### Phase 2: Index Operations ✅
- [x] Обновить `create_index` функцию
- [x] Модифицировать `get_indexed_value`
- [x] Обновить insert/update/remove операции
- [x] Добавить валидацию
- [x] Исправить findBy/findFirstBy/findLastBy для составных индексов

### Phase 3: Query Integration ✅
- [x] Обновить поисковые методы
- [x] Интегрировать с query system
- [x] Добавить range query поддержку

### Phase 4: Sort Order Support ✅ (NEW)
- [x] Добавить типы `SortOrder` и `CompositeKeyField`
- [x] Реализовать `normalizeCompositeKeys` метод
- [x] Создать `createComparator` для порядка сортировки
- [x] Добавить `extractValuesWithOrder` и `createKeyWithOrder`
- [x] Обновить `create_index` для поддержки порядка сортировки
- [x] Написать comprehensive тесты (26 тестов)

### Phase 5: Testing ✅
- [x] Написать integration тесты
- [x] Добавить performance тесты
- [x] Тестировать edge cases
- [x] Проверить обратную совместимость

---

## 🎯 Success Criteria

1. **Функциональность**: Составные индексы работают корректно для всех CRUD операций
2. **Производительность**: Не более 10% снижения производительности для существующих индексов
3. **Совместимость**: Полная обратная совместимость с существующим API
4. **Тестирование**: 100% покрытие новой функциональности тестами
5. **Документация**: Полная документация с примерами использования

---

---

## 🔄 Sort Order Support (Phase 4)

### Новая функциональность порядка сортировки

Добавлена поддержка указания порядка сортировки для каждого поля в составном индексе, основанная на возможностях B+ Tree библиотеки.

#### Новые типы
```typescript
export type SortOrder = 'asc' | 'desc'

export interface CompositeKeyField<T extends Item> {
  key: string | Paths<T>
  order?: SortOrder  // Default: 'asc'
}

export interface CompositeKeyDef<T extends Item> {
  keys: Array<string | Paths<T> | CompositeKeyField<T>>
  separator?: string
}
```

#### Примеры использования
```typescript
// Смешанный порядок сортировки
{
  composite: {
    keys: [
      { key: 'department', order: 'asc' },
      { key: 'salary', order: 'desc' },
      { key: 'level', order: 'asc' }
    ]
  }
}

// Все поля по убыванию
{
  composite: {
    keys: [
      { key: 'isActive', order: 'desc' },
      { key: 'joinDate', order: 'desc' }
    ]
  }
}
```

#### Новые методы CompositeKeyUtils
- `normalizeCompositeKeys()` - нормализация ключей с порядком сортировки
- `extractValuesWithOrder()` - извлечение значений с учетом порядка
- `createComparator()` - создание компаратора для сортировки
- `createKeyWithOrder()` - создание ключа с учетом порядка сортировки
- `validateCompositeKeyFields()` - валидация полей с порядком
- `generateIndexNameFromFields()` - генерация имени индекса с порядком

#### Автоматическая генерация имен индексов
Индексы с порядком сортировки получают имена вида:
- `department,salary:desc,level` - для смешанного порядка
- `isActive:desc,joinDate:desc` - для убывающего порядка
- `department,name` - для возрастающего порядка (`:asc` опускается)

#### Тестирование
- 26 новых unit тестов для функциональности порядка сортировки
- Тестирование всех комбинаций порядка сортировки
- Edge cases с null/undefined значениями
- Интеграционные тесты с Date, boolean и числовыми типами

---

## 💡 Идеи для будущих улучшений

- Поддержка частичных составных ключей в запросах
- Оптимизация сериализации для производительности
- Поддержка custom comparators для составных ключей
- Интеграция с существующей системой query планирования
- Поддержка null-first/null-last для порядка сортировки
- Оптимизация для больших составных ключей