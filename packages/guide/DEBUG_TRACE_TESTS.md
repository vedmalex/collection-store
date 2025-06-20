# Debug Trace: Guide Project Test Timeout Issues

## 🔍 Проблема
Тесты `user.test.ts` и `article.test.ts` зависают с timeout после ~5-6 секунд.

## 📋 Текущие размышления и идеи для проверки

### ✅ Успешно исправлено
- ✅ Compatibility тесты теперь проходят (3/3)
- ✅ Переключились с vitest на bun test
- ✅ Пересобрали collection-store и collection-store-mikro-orm

### ⏳ Идеи для проверки
- [ ] Проблема в initTestApp() - возможно зависает при инициализации ORM
- [ ] Проблема в bootstrap() - возможно зависает при запуске Fastify
- [ ] Проблема в initORM() - возможно зависает при подключении к базе
- [ ] Проблема в schema.createSchema() - возможно зависает при создании схемы
- [ ] Проблема с портами - возможно конфликт портов между тестами

## 🎯 План отладки
1. Добавить детальное логирование в initTestApp()
2. Проверить каждый шаг инициализации отдельно
3. Создать минимальный тест для проверки ORM инициализации
4. Проверить работу bootstrap() отдельно от тестов

## 📝 Ожидаемые результаты
- initTestApp() должен завершиться за < 1 секунду
- bootstrap() должен запустить сервер успешно
- Тесты должны выполняться и завершаться нормально