# 🚀 Расширенный бенчмарк производительности Query Systems

## 🎯 Быстрый старт

### ⚡ Простой тест производительности (рекомендуется)

```bash
# Базовый тест с 1000 записей
bun src/benchmark/simple_performance_test.ts

# Быстрый тест (только базовые запросы)
BENCH_QUICK=true bun src/benchmark/simple_performance_test.ts

# Тест конкретной категории
BENCH_CATEGORY=logical bun src/benchmark/simple_performance_test.ts

# Тест с большими данными для максимального эффекта
BENCH_DATA_SIZE=10000 bun src/benchmark/simple_performance_test.ts
```

### 🔧 Vitest бенчмарк

```bash
# Интеграция с vitest
bun vitest bench src/benchmark/build_query.bench.ts --run

# С выбором категории
BENCH_CATEGORY=basic bun vitest bench src/benchmark/build_query.bench.ts --run
```

## 📈 Впечатляющие результаты

### 🏆 Лучшие показатели производительности

- **Средний прирост**: **7.56x быстрее** (на 10,000 записей)
- **Максимальный прирост**: **до 57.83x быстрее** (numericRange запросы)
- **Стабильный прирост**: на всех типах запросов и размерах данных
- **100% совместимость**: идентичные результаты между системами

### 📊 Результаты по категориям

| Категория | Средний прирост | Лучший результат | Описание |
|-----------|-----------------|------------------|----------|
| **fieldAccess** | **15.38x** | 57.83x | Доступ к полям и сравнения |
| **logical** | **12.66x** | 18.98x | Сложные логические операции |
| **specialized** | **3.85x** | 12.45x | Специализированные операции |
| **basic** | **1.87x** | 2.56x | Базовые операции |
| **arrayOps** | **1.86x** | 1.86x | Операции с массивами |

## 🎯 Категории запросов

### 📋 Basic (Базовые)
- **baseline** - комплексные запросы с $or, $in, $gt
- **array** - операции с массивами ($size, $all, $elemMatch)
- **bitwise** - битовые операции ($bitsAllSet, $bitsAnySet)
- **evaluation** - regex и модуль ($regex, $mod)

### 🧠 Logical (Логические)
- **complexLogical** - сложные $and/$or комбинации
- **mixedComplex** - смешанные логические операции
- **performanceStress** - стресс-тест производительности

### 🔍 FieldAccess (Доступ к полям)
- **deepNested** - глубоко вложенные поля
- **textSearch** - текстовый поиск и regex
- **numericRange** - числовые диапазоны
- **simpleField** - простые поля
- **comparison** - операции сравнения

### 📚 ArrayOps (Операции с массивами)
- **arrayOperations** - расширенные операции с массивами
- **array** - базовые операции с массивами

### ⚙️ Specialized (Специализированные)
- **dateTime** - операции с датами
- **typeCheck** - проверка типов
- **existence** - проверка существования полей
- **advancedBitwise** - продвинутые битовые операции
- **regexVariations** - различные regex паттерны
- **whereClause** - $where функции
- **stringOperations** - операции со строками

## 🛠️ Доступные размеры данных

| Размер | Записей | Рекомендация |
|--------|---------|--------------|
| `100` | 100 | Быстрое тестирование |
| `1000` | 1,000 | По умолчанию |
| `10000` | 10,000 | **Рекомендуется** для демонстрации |
| `100000` | 100,000 | Максимальный эффект |
| `1000000` | 1,000,000 | Экстремальные нагрузки |

## 🎮 Режимы тестирования

### ⚡ Быстрый режим
```bash
BENCH_QUICK=true bun src/benchmark/simple_performance_test.ts
```
Тестирует только 4 базовых запроса для быстрой проверки.

### 📂 Тестирование по категориям
```bash
# Логические операции (лучшие результаты)
BENCH_CATEGORY=logical bun src/benchmark/simple_performance_test.ts

# Доступ к полям (максимальный прирост)
BENCH_CATEGORY=fieldAccess bun src/benchmark/simple_performance_test.ts

# Специализированные операции
BENCH_CATEGORY=specialized bun src/benchmark/simple_performance_test.ts
```

### 🔧 Настройка параметров
```bash
# Больше итераций для точности
BENCH_ITERATIONS=20 bun src/benchmark/simple_performance_test.ts

# Больше прогрева для стабильности
BENCH_WARMUP=5 bun src/benchmark/simple_performance_test.ts

# Комбинирование параметров
BENCH_DATA_SIZE=10000 BENCH_CATEGORY=logical BENCH_ITERATIONS=15 bun src/benchmark/simple_performance_test.ts
```

## 📊 Примеры тестируемых запросов

### 🏆 Лучший результат (57.83x быстрее)
```javascript
// numericRange - числовые диапазоны
{
  rating: { $gte: 3.5, $lte: 4.8 },
  'stats.loginCount': { $gt: 50 },
  'stats.totalSpent': { $gte: 100.0 },
  score: { $mod: [10, 0] }
}
```

### 🧠 Сложная логика (18.98x быстрее)
```javascript
// complexLogical - сложные логические операции
{
  $and: [
    { age: { $gte: 25, $lte: 45 } },
    {
      $or: [
        { category: 'premium' },
        { rating: { $gte: 4.0 } }
      ]
    }
  ],
  status: { $ne: 'suspended' },
  'profile.settings.notifications': { $ne: false }
}
```

### 🔍 Глубокие поля (6.43x быстрее)
```javascript
// deepNested - доступ к вложенным полям
{
  'nested.deep.level': { $gt: 5 },
  'nested.deep.active': true,
  'profile.settings.theme': { $in: ['dark', 'auto'] },
  'location.coordinates.lat': { $gte: 0 },
  'metadata.version': { $ne: 1 }
}
```

## 🎯 Рекомендации по использованию

### ✅ Используйте Compiled Query когда:
- Работаете с большими объемами данных (1000+ записей)
- Выполняете запросы многократно
- Нужна максимальная производительность
- Используете сложные логические операции
- Работаете с числовыми диапазонами
- Обращаетесь к глубоко вложенным полям

### 📈 Ожидаемый прирост по типам:
- **Числовые операции**: 10-57x быстрее
- **Логические операции**: 5-19x быстрее
- **Битовые операции**: 2-3x быстрее
- **Операции с массивами**: 1.5-2x быстрее
- **Regex операции**: 1.5-2.5x быстрее

## 🔄 Генерация данных

```bash
# Генерация всех размеров
bun src/benchmark/generate_data.ts

# Генерация конкретного размера
bun src/benchmark/generate_data.ts 50000 custom_data.json
```

## 📋 Структура данных

Новая расширенная структура включает:
- **Базовые поля**: id, name, age, tags, status, score
- **Вложенные объекты**: nested.deep, profile.settings, location
- **Массивы**: items, values, scores, permissions
- **Метаданные**: created, updated, version
- **Специальные поля**: email, rating, features, stats

## 📚 Отчеты

- `PERFORMANCE_BENCHMARK_REPORT.md` - детальные результаты
- `BENCHMARK_FINAL_SUMMARY.md` - итоговый отчет
- Этот файл - краткая инструкция

---

**🎉 Compiled Query демонстрирует впечатляющий прирост производительности до 57x быстрее!**