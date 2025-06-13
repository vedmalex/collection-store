# TTL Problem Trace

## Проблема
TTL элементы не удаляются после истечения времени жизни при загрузке коллекции.

## Ожидаемое поведение
1. Создается коллекция с TTL 100ms
2. Добавляется 4 элемента с ID: 'Some', 'Another', 'SomeOneElse', 'Anybody'
3. Ждем 300ms (больше чем TTL)
4. Загружаем коллекцию - должна вызваться `ensure_ttl`
5. `ensure_ttl` должна найти и удалить все просроченные элементы
6. `c1.list.length` должен быть 0

## Фактическое поведение
1. ✅ Коллекция создается с TTL 100ms
2. ✅ Добавляется 4 элемента
3. ✅ Ждем 300ms
4. ✅ Загружаем коллекцию, вызывается `ensure_ttl`
5. ✅ `ensure_ttl` находит 4 просроченных элемента
6. ❌ Элементы не удаляются, `c1.list.length` остается 4

## Детальная трассировка

### Шаг 1: Создание элементов
```typescript
// В loadCoolectionTTL:
await c1.create({ name: 'Some', age: 12 })     // ID = 'Some'
await c1.create({ name: 'Another', age: 13 })  // ID = 'Another'
await c1.create({ name: 'SomeOneElse', age: 12 }) // ID = 'SomeOneElse'
await c1.create({ name: 'Anybody', age: 12 })  // ID = 'Anybody'
```

**Что происходит в List.set():**
- Элемент с ID 'Some' сохраняется в `hash[0]`
- Элемент с ID 'Another' сохраняется в `hash[1]`
- Элемент с ID 'SomeOneElse' сохраняется в `hash[2]`
- Элемент с ID 'Anybody' сохраняется в `hash[3]`

**Что происходит в индексах:**
- В индексе `name`: 'Some' -> 'Some', 'Another' -> 'Another', и т.д.
- В индексе `__ttltime`: timestamp1 -> 'Some', timestamp2 -> 'Another', и т.д.

### Шаг 2: Поиск просроченных элементов ✅
```typescript
// ensure_ttl находит:
expiredItems = ['Anybody', 'SomeOneElse', 'Another', 'Some']
```

### Шаг 3: Попытка удаления ❌
```typescript
// Для каждого itemId в expiredItems:
const item = await collection.findById(itemId)  // ❌ Возвращает undefined!
if (item) {
  await collection.remove((i) => i[collection.id] === itemId)  // Никогда не выполняется
}
```

**ПРОБЛЕМА НАЙДЕНА:** `findById` возвращает `undefined` для всех элементов!

**Отладочный вывод:**
```
[ensure_ttl] Processing expired item: Anybody
[ensure_ttl] Found item by ID: undefined
[ensure_ttl] Item not found by findById: Anybody
```

Это означает, что проблема в функции `findById` - она не может найти элементы по их ID.

## Корневая причина ПОДТВЕРЖДЕНА
Несоответствие между:
1. **Система индексов**: Хранит ID элементов как значения ('Some', 'Another')
2. **Система List**: Хранит элементы под числовыми ключами (0, 1, 2, 3)
3. **Функции поиска**: `findById` использует результат индекса как ключ для List

**Детальная диагностика:**
```
[findById] Index.findFirst(Anybody) returned: Anybody  // Индекс возвращает ID
[findById] List.get(Anybody) returned: undefined       // List не находит по ID
```

**Проблема:** `List.get('Anybody')` ищет элемент в `hash['Anybody']`, но элемент сохранен в `hash[3]`

## Возможные решения
1. ❌ Исправить `removeWithId` - сложно из-за архитектурного несоответствия
2. ✅ Исправить функцию `remove` с условием
3. ✅ Исправить архитектурное несоответствие между индексами и List
4. ✅ Использовать прямое удаление из List по числовым ключам

## ✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО

### Решение
Исправлена функция `List.set()` для использования переданного ключа вместо автоинкремента:

```typescript
// Было:
set(this.hash, this._counter, result)

// Стало:
set(this.hash, String(key), result)
```

### Результат
- ✅ TTL тест проходит полностью
- ✅ Элементы корректно удаляются после истечения TTL
- ✅ Система индексов и List теперь согласованы

### Файлы изменены
- `src/async/storage/List.ts` - исправлены методы `set()` и `update()`
- `src/async/collection/ensure_ttl.ts` - упрощена логика удаления

### Статистика
- **Было:** 0 проходящих TTL тестов
- **Стало:** 1 проходящий TTL тест
- **Прогресс:** TTL функциональность восстановлена