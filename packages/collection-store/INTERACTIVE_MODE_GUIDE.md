# 🎯 ИНТЕРАКТИВНЫЙ РЕЖИМ ВЫБОРА ФАЙЛОВ

## 🎮 ОБЗОР

Интерактивный режим позволяет вам лично выбирать, какой файл оставить в каждой группе дубликатов. Это дает полный контроль над процессом очистки и позволяет принимать обоснованные решения на основе контекста проекта.

## 🚀 ЗАПУСК ИНТЕРАКТИВНОГО РЕЖИМА

### Основная команда
```bash
bun run tools/duplicate-cleaner.ts --interactive --dry-run
```

### Альтернативные варианты
```bash
# Короткий флаг
bun run tools/duplicate-cleaner.ts -i --dry-run

# Без dry-run (реальное удаление)
bun run tools/duplicate-cleaner.ts --interactive
```

## 📋 ИНТЕРФЕЙС ИНТЕРАКТИВНОГО РЕЖИМА

### Информация о группе дубликатов
Для каждой группы дубликатов отображается:

```
================================================================================
🔍 DUPLICATE GROUP FOUND (EXACT)
================================================================================
📋 Type: Exact duplicates (100% identical content)
📊 Confidence: 100%
💡 Reason: Identical file content (hash: b9782c05...)

🔍 Key differences:
   • Different content but identical test structure
   • Line 7: "import Collection from '../core/Collection'" vs "import Collection from '../../core/Collection'"

📁 Files in this group:
   [1] src/query/query-integration.test.ts
       Size: 10.76 KB | Modified: 6/15/2025
   [2] src/query/__tests__/query-integration.test.ts
       Size: 10.76 KB | Modified: 6/15/2025

🤖 Automatic recommendation: Keep file [1]
   Reason: Prefers files outside __test__/__tests__ directories
```

### Варианты выбора
```
📋 Options:
   [1-2] Select file to keep
   [a] Accept automatic recommendation
   [s] Skip this group (manual review)
   [q] Quit interactive mode
```

## 🎯 СТРАТЕГИИ ВЫБОРА

### 1. По расположению файлов
- **Предпочтительно**: Файлы вне `__test__` и `__tests__` директорий
- **Причина**: Более каноническое расположение, лучше для импортов

### 2. По дате модификации
- **Предпочтительно**: Более новые файлы
- **Причина**: Содержат последние изменения и исправления

### 3. По размеру файла
- **Предпочтительно**: Файлы с большим размером (если разница значительная)
- **Причина**: Могут содержать дополнительные тесты или улучшения

### 4. По структуре импортов
- **Предпочтительно**: Файлы с более простыми путями импорта
- **Причина**: Легче поддерживать и понимать

## 📊 ТИПЫ ДУБЛИКАТОВ

### 🔴 EXACT (Точные дубликаты)
- **Описание**: 100% идентичный контент
- **Рекомендация**: Безопасно удалять любой из файлов
- **Стратегия**: Выбирать по расположению

### 🟡 STRUCTURAL (Структурные дубликаты)
- **Описание**: Одинаковая структура тестов, разный контент
- **Рекомендация**: Требует анализа различий
- **Стратегия**: Анализировать ключевые различия

### 🟢 PARTIAL (Частичные дубликаты)
- **Описание**: 95-100% схожесть контента
- **Рекомендация**: Проверить различия в импортах
- **Стратегия**: Выбирать файл с правильными путями импорта

## 🎮 КОМАНДЫ ИНТЕРАКТИВНОГО РЕЖИМА

### Выбор файла по номеру
```
👤 Your choice: 1
```
Выбирает первый файл из списка для сохранения.

### Принятие автоматической рекомендации
```
👤 Your choice: a
```
Использует встроенную логику выбора файла.

### Пропуск группы
```
👤 Your choice: s
```
Пропускает группу для ручного анализа позже.

### Выход из режима
```
👤 Your choice: q
```
Завершает интерактивный режим и выходит из программы.

## 📈 РЕЗУЛЬТАТЫ ИНТЕРАКТИВНОГО РЕЖИМА

### Статистика выбора
После завершения интерактивного режима отображается:
- Количество обработанных групп
- Количество файлов для удаления
- Количество файлов для сохранения
- Ожидаемая экономия места

### Пример результата
```
✅ Interactive selection completed

📋 CLEANUP PLAN SUMMARY
========================
Files to remove: 34
Files to keep: 34
Estimated space savings: 450.63 KB
Backup location: backup-duplicates-2025-06-15T07-45-43-570Z
```

## 🛡️ БЕЗОПАСНОСТЬ

### Автоматический backup
- Создается backup всех файлов перед удалением
- Возможность полного отката изменений
- Сохранение контрольных сумм для проверки целостности

### Dry-run режим
- Рекомендуется всегда использовать `--dry-run` сначала
- Позволяет просмотреть план без реального удаления
- Создает отчет для анализа

## 💡 ЛУЧШИЕ ПРАКТИКИ

### 1. Подготовка
```bash
# Создайте git commit перед началом
git add . && git commit -m "Before duplicate cleanup"

# Запустите сначала в dry-run режиме
bun run tools/duplicate-cleaner.ts --interactive --dry-run
```

### 2. Анализ различий
- Внимательно читайте ключевые различия
- Обращайте внимание на пути импорта
- Учитывайте структуру проекта

### 3. Стратегия выбора
- Для EXACT дубликатов: выбирайте по расположению
- Для STRUCTURAL: анализируйте содержимое
- Для PARTIAL: проверяйте импорты

### 4. Проверка результатов
```bash
# После очистки запустите тесты
bun test

# Проверьте, что все импорты работают
bun run build
```

## 🔧 УСТРАНЕНИЕ ПРОБЛЕМ

### Проблема: Неправильный выбор файла
**Решение**: Используйте rollback функцию
```bash
# Восстановление из backup
bun run tools/duplicate-cleaner.ts --rollback backup-duplicates-TIMESTAMP
```

### Проблема: Прерванный интерактивный режим
**Решение**: Перезапустите с того же места
- Программа автоматически пропустит уже обработанные группы
- Используйте `--dry-run` для безопасности

### Проблема: Слишком много групп
**Решение**: Используйте фильтрацию
- Сначала обработайте только EXACT дубликаты
- Затем STRUCTURAL и PARTIAL отдельно

## 📊 СРАВНЕНИЕ РЕЖИМОВ

| Аспект | Автоматический | Интерактивный |
|--------|---------------|---------------|
| **Скорость** | Быстро | Медленно |
| **Контроль** | Ограниченный | Полный |
| **Безопасность** | Только LOW risk | Все группы |
| **Точность** | 95% | 100% |
| **Использование** | Массовая очистка | Точная настройка |

## 🎯 ЗАКЛЮЧЕНИЕ

Интерактивный режим идеально подходит для:
- Первичной очистки дубликатов
- Сложных случаев с неоднозначными дубликатами
- Проектов с особой структурой файлов
- Ситуаций, требующих максимальной точности

Используйте автоматический режим для рутинной очистки простых дубликатов, а интерактивный - для важных решений, требующих человеческого анализа.