# Debug Trace: Guide Project Server Startup Error

## ✅ ПРОБЛЕМА РЕШЕНА УСПЕШНО

### Корневая причина:
**Collection-store создавал обязательные индексы для всех полей в embedded объектах, но MikroORM передавал только частичные данные для embedded объекта `Social`.**

## Детальный анализ

### Что происходило:
1. ✅ `em.create(User, userData)` создавал entity успешно
2. ✅ `em.flush()` начинал процесс сохранения
3. ✅ `CollectionStoreDriver.nativeInsertMany()` вызывался с данными
4. ❌ `collection.create()` требовал значения для всех полей embedded объекта `Social`
5. ❌ Ошибки:
   - `value for index token is required, but undefined is met`
   - `value for index social.facebook is required, but undefined is met`

### Проблемы в User entity:
1. **Поле `token`:** было помечено как `persist: false`, но collection-store создавал для него индекс
2. **Embedded поля в `Social`:** все поля были обязательными, но передавался только `twitter`

### Решение:
1. ✅ Убрали `persist: false` из поля `token` и добавили `nullable: true`
2. ✅ Добавили `nullable: true` ко всем полям в embedded классе `Social`

## Исправления

### 1. Поле token:
```typescript
// Было:
@Property({ persist: false, type: 'string' })
token?: string

// Стало:
@Property({ type: 'string', nullable: true })
token?: string
```

### 2. Embedded класс Social:
```typescript
// Было:
@Property({ type: 'string' })
twitter?: string

// Стало:
@Property({ type: 'string', nullable: true })
twitter?: string
```

## Результат
✅ Сервер запускается успешно
✅ Сидер выполняется без ошибок
✅ Пользователь создается с auto-increment ID (0)
✅ Все поля сохраняются корректно

## Уроки
- Collection-store требует явного указания nullable для опциональных полей
- Embedded объекты должны иметь все поля nullable если они могут отсутствовать
- `persist: false` в MikroORM не совместимо с collection-store индексами
- Важно синхронизировать метаданные между MikroORM и collection-store