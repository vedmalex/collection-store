# Правила разработки на основе опыта B+ Tree проекта

## 📋 Оглавление

- [Правила планирования](#-правила-планирования)
- [Правила реализации](#-правила-реализации)
- [Правила тестирования](#-правила-тестирования)
- [Правила отладки](#-правила-отладки)
- [Правила документирования](#-правила-документирования)
- [Правила рефакторинга](#-правила-рефакторинга)

---

## 🎯 Правила планирования

### 1. **Фазовый подход к разработке**
```markdown
## Phase 1: Stabilize Core & Fix Bugs ✅
1. Fix critical memory/performance issue
2. Implement basic functionality with CoW
3. Fix parent-child relationship corruption
4. Implement commit() logic

## Phase 2: Complete Transaction Logic ✅
5. Implement transactional operations
6. Implement 2PC API
7. Add complex scenarios support

## Phase 3: Fix Advanced Operations ✅
8. Fix CoW Node Operations
9. Handle edge cases and boundary conditions
10. Implement conflict detection

## Phase 4: Refactor & Test ✅
11. Write comprehensive tests
12. Implement garbage collection
13. Performance optimization
```

### 2. **Документирование прогресса**
```markdown
# Rules для отслеживания прогресса

- Текущие размышления и идеи записывай в implementation файл
- Удачные идеи помечай ✅, неудачные идеи помечай ❌
- Идеи не удаляй, чтобы не возвращаться к ним в будущих сессиях
- После успешного этапа фиксируй изменения и переходи к следующему
```

### 3. **Приоритизация проблем**
```typescript
// ✅ ПРАВИЛЬНО: Решаем критические проблемы первыми
enum ProblemPriority {
  CRITICAL = 'critical',    // Блокирует основной функционал
  HIGH = 'high',           // Влияет на производительность
  MEDIUM = 'medium',       // Улучшения UX
  LOW = 'low'             // Nice to have
}

// Пример приоритизации из проекта:
// CRITICAL: RangeError: Out of memory в transactional remove
// HIGH: Parent-child relationship corruption в CoW
// MEDIUM: Улучшение производительности merge операций
// LOW: Дополнительные utility функции
```

---

## 🔧 Правила реализации

### 4. **Проверка зависимостей тестов**
```typescript
// ✅ ПРАВИЛЬНО: Проверяем что новые изменения не ломают другие тесты
function validateTestDependencies() {
  // При проверке тестов учитывай, что тесты могут быть зависимыми друг от друга
  // Чтобы не ломать один тест, не ломай другой
  // Строй карту зависимостей и последовательности выполнения тестов
}

// Пример из проекта:
// Исправление merge функций сломало тесты borrow операций
// Потребовалось координировать обновления separator keys
```

### 5. **Избегание заглушек в продакшене**
```typescript
// ❌ НЕПРАВИЛЬНО: Заглушки остаются в финальном коде
function merge_with_left_cow<T, K extends ValueType>(/* ... */) {
  // TODO: Implement real merge logic
  return originalNode // Заглушка
}

// ✅ ПРАВИЛЬНО: Полная реализация
function merge_with_left_cow<T, K extends ValueType>(/* ... */) {
  // Реальная логика merge с CoW
  const workingCopy = Node.forceCopy(originalNode, transactionContext)
  // ... полная реализация
  return workingCopy
}

// Правило: Проверяй что тесты обращаются к новым функциям,
// а не используют заглушки для прохождения
```

### 6. **Robust поиск и навигация**
```typescript
// ✅ ПРАВИЛЬНО: Robust поиск с fallback
function findChildIndex<T, K extends ValueType>(
  parent: Node<T, K>,
  childOriginalId: number,
  txCtx: TransactionContext<T, K>
): number {
  // Сначала ищем по working copy ID
  const workingChild = txCtx.workingNodes.get(childOriginalId)
  if (workingChild) {
    const workingIndex = parent.pointers.indexOf(workingChild.id)
    if (workingIndex !== -1) return workingIndex
  }

  // Fallback: ищем по original ID
  const originalIndex = parent.pointers.indexOf(childOriginalId)
  if (originalIndex !== -1) return originalIndex

  throw new Error(`Child ${childOriginalId} not found in parent ${parent.id}`)
}

// Урок из проекта: Простой поиск по ID часто не работает в CoW системах
```

### 7. **Координация между системами**
```typescript
// ✅ ПРАВИЛЬНО: Флаговая система для координации
function borrow_from_left_cow<T, K extends ValueType>(/* ... */) {
  // Устанавливаем флаг чтобы избежать двойного обновления
  (fNode as any)._skipParentSeparatorUpdate = true
  (fLeftSibling as any)._skipParentSeparatorUpdate = true

  // Выполняем операцию
  const result = performBorrow(/* ... */)

  // Ручное обновление separator keys
  updateParentSeparators(/* ... */)

  return result
}

// Урок: В сложных системах нужна координация между автоматическими и ручными операциями
```

---

## 🧪 Правила тестирования

### 8. **Высокогранулированные тесты**
```typescript
// ✅ ПРАВИЛЬНО: Создавай высокогранулированные тесты и объединяй их по функционалу
describe('Merge Operations', () => {
  describe('merge_with_left_cow', () => {
    it('should merge leaf nodes correctly', () => { /* ... */ })
    it('should update parent pointers', () => { /* ... */ })
    it('should handle separator keys', () => { /* ... */ })
    it('should work with working copies', () => { /* ... */ })
  })

  describe('merge_with_right_cow', () => {
    it('should merge internal nodes correctly', () => { /* ... */ })
    it('should preserve tree structure', () => { /* ... */ })
  })
})

// Группируй связанные тесты, но тестируй каждый аспект отдельно
```

### 9. **Изоляция контекста между тестами**
```typescript
// ✅ ПРАВИЛЬНО: Обеспечивай очистку контекста между тестами
describe('Transaction Tests', () => {
  let tree: BPlusTree<User, number>
  let txCtx: TransactionContext<User, number>

  beforeEach(() => {
    // Создаем чистое состояние для каждого теста
    tree = new BPlusTree<User, number>(3, false)
    txCtx = new TransactionContext(tree)
  })

  afterEach(() => {
    // Очищаем ресурсы после каждого теста
    if (txCtx) {
      txCtx.cleanup()
    }
    tree = null
    txCtx = null
  })

  it('should handle transaction isolation', () => {
    // Тест работает с чистым состоянием
    tree.insert_in_transaction(1, { name: 'Alice' }, txCtx)
    expect(tree.size).toBe(1)
  })
})

// ❌ НЕПРАВИЛЬНО: Переиспользование состояния между тестами
// Это может привести к зависимостям и ложным результатам
```

### 10. **Обязательное тестирование каждой фичи**
```typescript
// ✅ ПРАВИЛЬНО: Каждая новая функция должна иметь тесты
// Правило: Нет фичи без тестов

// Новая функция
function findOptimalMergeCandidate<T, K extends ValueType>(
  node: Node<T, K>,
  txCtx: TransactionContext<T, K>
): Node<T, K> | null {
  // Реализация функции
}

// Обязательные тесты для новой функции
describe('findOptimalMergeCandidate', () => {
  it('should return null for nodes without siblings', () => { /* ... */ })
  it('should prefer left sibling when both available', () => { /* ... */ })
  it('should handle edge cases with minimum capacity', () => { /* ... */ })
  it('should work correctly in transaction context', () => { /* ... */ })
})

// Правило: Функция не считается завершенной без тестов
```

### 11. **Проверка покрытия функционала на каждом этапе**
```typescript
// ✅ ПРАВИЛЬНО: Проверяй покрытие в конце каждого этапа
// coverage-check.ts
interface PhaseRequirements {
  phase: string
  requiredFunctions: string[]
  requiredTestCoverage: number
  integrationPoints: string[]
}

const phase1Requirements: PhaseRequirements = {
  phase: "Core Operations",
  requiredFunctions: [
    "insert_in_transaction",
    "remove_in_transaction",
    "find_in_transaction"
  ],
  requiredTestCoverage: 95, // Минимум 95% покрытия
  integrationPoints: ["TransactionContext", "Node operations"]
}

function validatePhaseCompletion(phase: PhaseRequirements): boolean {
  // Проверяем что все функции реализованы
  for (const func of phase.requiredFunctions) {
    if (!isFunctionImplemented(func)) {
      console.error(`❌ Function ${func} not implemented`)
      return false
    }
  }

  // Проверяем покрытие тестами
  const coverage = calculateTestCoverage(phase.requiredFunctions)
  if (coverage < phase.requiredTestCoverage) {
    console.error(`❌ Test coverage ${coverage}% < required ${phase.requiredTestCoverage}%`)
    return false
  }

  // Проверяем интеграционные точки
  for (const point of phase.integrationPoints) {
    if (!isIntegrationTested(point)) {
      console.error(`❌ Integration point ${point} not tested`)
      return false
    }
  }

  console.log(`✅ Phase "${phase.phase}" completed successfully`)
  return true
}

// Пример использования в конце этапа:
// npm run test:coverage
// node coverage-check.js --phase=1
```

### 12. **Тестирование edge cases**
```typescript
// ✅ ПРАВИЛЬНО: Покрывай все граничные случаи
describe('Edge Cases', () => {
  it('should handle empty nodes', () => {
    const emptyNode = Node.createLeaf(txCtx)
    expect(() => merge_with_left_cow(emptyNode, /* ... */)).not.toThrow()
  })

  it('should handle single element nodes', () => { /* ... */ })
  it('should handle maximum capacity nodes', () => { /* ... */ })
  it('should handle orphaned nodes', () => { /* ... */ })
  it('should handle duplicate keys', () => { /* ... */ })
})

// Урок из проекта: Edge cases часто выявляют фундаментальные проблемы
```

### 13. **Тестирование производительности**
```typescript
// ✅ ПРАВИЛЬНО: Включай тесты производительности
describe('Performance', () => {
  it('should handle large datasets efficiently', () => {
    const startTime = performance.now()

    // Выполняем операцию
    for (let i = 0; i < 10000; i++) {
      tree.insert_in_transaction(i, `value${i}`, txCtx)
    }

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(1000) // Менее 1 секунды для 10k операций
  })
})

// Урок: RangeError: Out of memory был обнаружен через тесты производительности
```

---

## 🔗 Правила интеграции

### 14. **Изолированное проектирование фаз**
```markdown
# Правило изолированного проектирования

## ✅ ПРАВИЛЬНО: Проектируй фазы изолированно
### Phase 1: Core Data Structures (изолированно)
- Implement Node class
- Implement basic tree operations
- No dependencies on transactions

### Phase 2: Transaction System (изолированно)
- Implement TransactionContext
- Implement Copy-on-Write logic
- No dependencies on advanced operations

### Phase 3: Advanced Operations (изолированно)
- Implement merge/split operations
- Implement rebalancing
- Uses interfaces from Phase 1 & 2

### Phase 4: Integration (планируется отдельно)
- Integrate transaction system with core operations
- Integrate advanced operations with transactions
- End-to-end testing

## ❌ НЕПРАВИЛЬНО: Смешанная разработка
- Разрабатывать все компоненты одновременно
- Создавать зависимости между фазами во время разработки
- Не планировать интеграционные шаги
```

### 15. **Планирование интеграционных шагов**
```typescript
// ✅ ПРАВИЛЬНО: Явное планирование интеграции
interface IntegrationPlan {
  name: string
  components: string[]
  integrationSteps: IntegrationStep[]
  testStrategy: string
  rollbackPlan: string
}

interface IntegrationStep {
  step: number
  description: string
  dependencies: string[]
  validation: string[]
  estimatedTime: string
}

const transactionIntegrationPlan: IntegrationPlan = {
  name: "Transaction System Integration",
  components: ["Core Tree", "Transaction Context", "CoW Operations"],
  integrationSteps: [
    {
      step: 1,
      description: "Integrate TransactionContext with basic tree operations",
      dependencies: ["Core Tree Phase", "Transaction System Phase"],
      validation: ["Basic insert/remove with transactions", "Context isolation"],
      estimatedTime: "2 days"
    },
    {
      step: 2,
      description: "Integrate CoW with advanced operations",
      dependencies: ["Step 1", "Advanced Operations Phase"],
      validation: ["Merge/split with CoW", "Parent-child consistency"],
      estimatedTime: "3 days"
    },
    {
      step: 3,
      description: "End-to-end transaction scenarios",
      dependencies: ["Step 2"],
      validation: ["2PC protocol", "Isolation guarantees", "Performance tests"],
      estimatedTime: "2 days"
    }
  ],
  testStrategy: "Integration tests separate from unit tests",
  rollbackPlan: "Revert to previous stable interfaces"
}

// Каждый шаг интеграции планируется как отдельная фаза
```

### 16. **Тестирование интеграционных точек**
```typescript
// ✅ ПРАВИЛЬНО: Отдельные тесты для интеграции
describe('Integration Tests', () => {
  describe('Transaction-Tree Integration', () => {
    it('should maintain tree invariants during transactions', () => {
      // Тестируем интеграцию между деревом и транзакциями
      const tree = new BPlusTree<number, number>(3, false)
      const txCtx = new TransactionContext(tree)

      // Выполняем операции через транзакционный интерфейс
      tree.insert_in_transaction(1, 100, txCtx)
      tree.insert_in_transaction(2, 200, txCtx)

      // Проверяем что инварианты дерева сохраняются
      validateTreeInvariants(tree)

      // Проверяем что транзакционный контекст корректен
      validateTransactionState(txCtx)
    })
  })

  describe('CoW-Operations Integration', () => {
    it('should handle CoW during complex operations', () => {
      // Тестируем интеграцию CoW с операциями merge/split
    })
  })
})

// Интеграционные тесты отдельно от unit тестов
```

### 17. **Документирование интеграционных зависимостей**
```markdown
# Правило документирования интеграционных зависимостей

## Integration Dependency Map

### Core Tree → Transaction System
- **Interface:** TreeOperationInterface
- **Dependencies:** Node access, tree traversal
- **Potential Conflicts:** Direct node modification vs CoW
- **Resolution Strategy:** Wrapper pattern with transaction-aware operations

### Transaction System → Advanced Operations
- **Interface:** TransactionAwareOperations
- **Dependencies:** Node copying, state management
- **Potential Conflicts:** Memory management, parent-child updates
- **Resolution Strategy:** Event-driven coordination

### Integration Testing Points
1. **Tree-Transaction boundary:** Verify CoW semantics
2. **Transaction-Operations boundary:** Verify state consistency
3. **End-to-end scenarios:** Verify complete workflows

### Rollback Strategies
- **Phase 1 rollback:** Revert to non-transactional operations
- **Phase 2 rollback:** Disable CoW, use direct modifications
- **Phase 3 rollback:** Fallback to simple transaction model
```

---

## 🐛 Правила отладки

### 18. **Трассировка перед исправлением**
```markdown
# Правило трассировки

Перед отладкой и исправлением сложных тестов:
1. Сначала выполни трассировку вручную с ожидаемыми результатами
2. Помечай шаг на котором возникает ошибка
3. Сохраняй этот лог в отдельный файл markdown
4. Только потом переходи к отладке и исправлению

Пример файлов трассировки из проекта:
- failed.2pc.isolation.md
- failed.duplicate.keys.md
- failed.transaction.abort.md
```

### 19. **Детальное логирование**
```typescript
// ✅ ПРАВИЛЬНО: Подробное логирование для сложных операций
function remove_in_transaction<T, K extends ValueType>(
  tree: BPlusTree<T, K>,
  key: K,
  txCtx: TransactionContext<T, K>
): boolean {
  console.log(`[REMOVE_TX] Starting removal of key ${key}`)

  const leaf = find_leaf_for_key_in_transaction(tree, key, txCtx)
  console.log(`[REMOVE_TX] Found leaf ${leaf.id} with ${leaf.keys.length} keys`)

  const keyIndex = find_first_key(leaf.keys, key, tree.comparator)
  console.log(`[REMOVE_TX] Key index: ${keyIndex}`)

  if (keyIndex === -1 || tree.comparator(leaf.keys[keyIndex], key) !== 0) {
    console.log(`[REMOVE_TX] Key ${key} not found`)
    return false
  }

  // ... остальная логика с логированием каждого шага
}
```

### 20. **Валидация инвариантов**
```typescript
// ✅ ПРАВИЛЬНО: Проверка инвариантов на каждом шаге
function validateTreeInvariants<T, K extends ValueType>(
  tree: BPlusTree<T, K>,
  operation: string
): void {
  console.log(`[VALIDATION] Checking invariants after ${operation}`)

  // Проверяем структуру дерева
  const structureValid = validateTreeStructure(tree)
  if (!structureValid) {
    throw new Error(`Tree structure invalid after ${operation}`)
  }

  // Проверяем parent-child связи
  const linksValid = validateParentChildLinks(tree)
  if (!linksValid) {
    throw new Error(`Parent-child links invalid after ${operation}`)
  }

  // Проверяем порядок ключей
  const orderValid = validateKeyOrder(tree)
  if (!orderValid) {
    throw new Error(`Key order invalid after ${operation}`)
  }

  console.log(`[VALIDATION] All invariants valid after ${operation}`)
}
```

---

## 📚 Правила документирования

### 21. **Документирование решений**
```markdown
# Правило документирования решений

Для каждой решенной проблемы документируй:

## ✅ ИСПРАВЛЕНИЕ #N: Название проблемы
- **Проблема:** Краткое описание
- **Решение:** Техническое решение
- **Техническое решение:** Код/алгоритм
- **Результат:** Что изменилось
- **Файлы:** Какие файлы затронуты

Пример из проекта:
## ✅ ИСПРАВЛЕНИЕ #1: 2PC Transaction Isolation
- **Проблема:** Нарушение snapshot isolation в prepare фазе
- **Решение:** Реализована система сохранения состояния узлов
- **Техническое решение:**
  ```typescript
  this._snapshotNodeStates = new Map();
  for (const [nodeId, node] of tree.nodes) {
    this._snapshotNodeStates.set(nodeId, { ... });
  }
  ```
- **Результат:** ✅ Тест проходит полностью
- **Файлы:** `src/TransactionContext.ts`, `src/BPlusTree.ts`
```

### 22. **Ведение статистики**
```markdown
# Правило ведения статистики

Отслеживай прогресс количественно:

**ИТОГОВАЯ СТАТИСТИКА УСПЕХА:**
- **✅ ВСЕ 340 ТЕСТОВ ПРОХОДЯТ** (100% success rate)
- **✅ insert_in_transaction:** Полностью реализован
- **✅ remove_in_transaction:** Полностью реализован
- **✅ 2PC API:** Полностью реализован
- **✅ Транзакционная изоляция:** Работает корректно
- **✅ Copy-on-Write:** Полностью функционирует

Это помогает видеть общую картину прогресса.
```

### 23. **Создание примеров использования**
```typescript
// ✅ ПРАВИЛЬНО: Создавай рабочие примеры для каждой функции
// examples/transaction-example.ts
async function transactionExample() {
  const tree = new BPlusTree<User, number>(3, false)
  const txCtx = new TransactionContext(tree)

  // Демонстрируем основные операции
  tree.insert_in_transaction(1, { name: 'Alice' }, txCtx)
  tree.insert_in_transaction(2, { name: 'Bob' }, txCtx)

  // Демонстрируем 2PC
  const canCommit = await txCtx.prepareCommit()
  if (canCommit) {
    await txCtx.finalizeCommit()
  }

  console.log('Transaction completed successfully')
}

// Примеры должны быть исполняемыми и демонстрировать реальные сценарии
```

---

## 🔄 Правила рефакторинга

### 24. **Постепенный рефакторинг**
```typescript
// ✅ ПРАВИЛЬНО: Рефакторинг по одной функции за раз
// Шаг 1: Создаем новую функцию с улучшенной логикой
function merge_with_left_cow_v2<T, K extends ValueType>(/* ... */) {
  // Улучшенная реализация
}

// Шаг 2: Тестируем новую функцию
describe('merge_with_left_cow_v2', () => {
  // Все тесты для новой версии
})

// Шаг 3: Заменяем старую функцию после успешных тестов
// Шаг 4: Удаляем старую функцию

// ❌ НЕПРАВИЛЬНО: Переписываем все сразу
```

### 25. **Сохранение обратной совместимости**
```typescript
// ✅ ПРАВИЛЬНО: Сохраняем старый API при рефакторинге
// Старый API (deprecated)
function insert(key: K, value: T): boolean {
  console.warn('insert() is deprecated, use insert_in_transaction()')
  const txCtx = new TransactionContext(this)
  const result = this.insert_in_transaction(key, value, txCtx)
  txCtx.commit()
  return result
}

// Новый API
function insert_in_transaction(key: K, value: T, txCtx: TransactionContext<T, K>): boolean {
  // Новая реализация
}
```

### 26. **Метрики качества кода**
```typescript
// ✅ ПРАВИЛЬНО: Отслеживай метрики качества
interface CodeQualityMetrics {
  testCoverage: number        // 100% для критических функций
  cyclomaticComplexity: number // < 10 для большинства функций
  linesOfCode: number         // Отслеживай рост
  technicalDebt: number       // Количество TODO/FIXME
  performanceRegression: boolean // Нет регрессий производительности
}

// Пример из проекта:
// Было: 13 провальных тестов, сложность > 15
// Стало: 0 провальных тестов, сложность < 8
```

---

## 📋 Чек-лист для каждого PR

### Перед коммитом:
- [ ] Все тесты проходят (включая существующие)
- [ ] Добавлены тесты для новой функциональности
- [ ] Обновлена документация
- [ ] Проверена производительность
- [ ] Нет memory leaks
- [ ] Код соответствует стилю проекта

### Перед релизом:
- [ ] Все фазы разработки завершены
- [ ] 100% тестовое покрытие критических функций
- [ ] Примеры использования работают
- [ ] Документация актуальна
- [ ] Производительность не хуже предыдущей версии
- [ ] Обратная совместимость сохранена

---

## 🎯 Ключевые уроки из проекта

### 1. **Сложность растет экспоненциально**
- Простые изменения могут сломать множество тестов
- Всегда проверяй влияние на существующий функционал
- Используй фазовый подход для управления сложностью

### 2. **Тестирование - это инвестиция**
- Высокогранулированные тесты помогают быстро находить проблемы
- Edge cases часто выявляют фундаментальные ошибки архитектуры
- Тесты производительности предотвращают критические проблемы

### 3. **Документирование экономит время**
- Подробные логи помогают в отладке
- Документирование решений предотвращает повторные ошибки
- Примеры использования выявляют проблемы UX

### 4. **Координация между системами критична**
- В сложных системах нужны механизмы координации
- Флаги, события, callbacks помогают избежать конфликтов
- Всегда думай о взаимодействии компонентов

### 5. **Производительность важна с самого начала**
- Memory leaks могут полностью заблокировать разработку
- Алгоритмическая сложность важнее микрооптимизаций
- Регулярно измеряй производительность

---

*Правила основаны на реальном опыте разработки B+ Tree с транзакционной поддержкой*
*Проект: 340 тестов, 100% success rate, полная транзакционная поддержка*
*Версия: 1.0 | Дата: Декабрь 2024*