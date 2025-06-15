#!/bin/bash

# 🔍 Скрипт анализа дублирующихся тестов
# Автоматизированный анализ результатов duplicate-detection-report.json

set -e

# Цвета для вывода
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверка наличия jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Ошибка: jq не установлен. Установите: brew install jq${NC}"
    exit 1
fi

# Проверка наличия отчета
if [ ! -f "duplicate-detection-report.json" ]; then
    echo -e "${RED}❌ Файл duplicate-detection-report.json не найден${NC}"
    echo -e "${BLUE}💡 Запустите: bun run tools/duplicate-detector.ts${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 АНАЛИЗ ДУБЛИРУЮЩИХСЯ ТЕСТОВ${NC}"
echo "=================================="
echo ""

# Общая статистика
echo -e "${GREEN}📊 ОБЩАЯ СТАТИСТИКА:${NC}"
cat duplicate-detection-report.json | jq -r '
"Всего файлов: \(.totalFiles)
Время обработки: \(.processingTime | round)ms
Точные дубликаты: \(.exactDuplicates)
Структурные дубликаты: \(.structuralDuplicates)
Частичные дубликаты: \(.partialDuplicates)
Всего групп дубликатов: \(.duplicateGroups | length)"'

echo ""

# Критические дубликаты
echo -e "${RED}🔴 КРИТИЧЕСКИЕ ДУБЛИКАТЫ (требуют немедленного удаления):${NC}"
EXACT_COUNT=$(cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == "EXACT")' | jq -s length)

if [ "$EXACT_COUNT" -gt 0 ]; then
    cat duplicate-detection-report.json | jq -r '.duplicateGroups[] | select(.type == "EXACT") |
    "
📁 Группа дубликатов:
   Файлы: \(.files | map(.relativePath) | join(", "))
   Размер: \(.files[0].size) bytes
   Причина: \(.reason)
   Действие: ✅ Безопасно удалить дубликат
"'
else
    echo "✅ Точных дубликатов не найдено"
fi

echo ""

# Структурные дубликаты
echo -e "${YELLOW}🟡 СТРУКТУРНЫЕ ДУБЛИКАТЫ (требуют анализа):${NC}"
STRUCTURAL_COUNT=$(cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == "STRUCTURAL")' | jq -s length)

if [ "$STRUCTURAL_COUNT" -gt 0 ]; then
    echo "Найдено $STRUCTURAL_COUNT групп структурных дубликатов:"
    cat duplicate-detection-report.json | jq -r '.duplicateGroups[] | select(.type == "STRUCTURAL") |
    "
📁 \(.files | map(.relativePath) | join(" ↔ "))
   Причина: \(.reason)
   Действие: ⚠️ Требует ручного анализа"' | head -20

    if [ "$STRUCTURAL_COUNT" -gt 10 ]; then
        echo "... и еще $(($STRUCTURAL_COUNT - 10)) групп"
    fi
else
    echo "✅ Структурных дубликатов не найдено"
fi

echo ""

# Частичные дубликаты с высокой схожестью
echo -e "${BLUE}🟢 ЧАСТИЧНЫЕ ДУБЛИКАТЫ (>99% схожести):${NC}"
HIGH_SIMILARITY=$(cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == "PARTIAL" and .confidence > 0.99)' | jq -s length)

if [ "$HIGH_SIMILARITY" -gt 0 ]; then
    echo "Найдено $HIGH_SIMILARITY групп с высокой схожестью:"
    cat duplicate-detection-report.json | jq -r '.duplicateGroups[] | select(.type == "PARTIAL" and .confidence > 0.99) |
    "
📁 \(.files | map(.relativePath) | join(" ↔ "))
   Схожесть: \(.confidence * 100 | round)%
   Основные различия: \(.differences[0:2] | join("; "))
   Действие: 🔍 Проверить различия в import путях"' | head -15
else
    echo "✅ Частичных дубликатов с высокой схожестью не найдено"
fi

echo ""

# Рекомендации по действиям
echo -e "${GREEN}💡 РЕКОМЕНДАЦИИ ПО ДЕЙСТВИЯМ:${NC}"
echo ""

if [ "$EXACT_COUNT" -gt 0 ]; then
    echo -e "${RED}🔥 НЕМЕДЛЕННО (Критический приоритет):${NC}"
    echo "   1. Запустите dry run: bun run tools/duplicate-cleaner.ts --dry-run"
    echo "   2. Проверьте план очистки: cat duplicate-cleanup-dry-run.md"
    echo "   3. Выполните очистку: bun run tools/duplicate-cleaner.ts"
    echo "   4. Экономия дискового пространства: ~$(($(cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == "EXACT") | .files[0].size' | paste -sd+ | bc) / 1024))KB"
    echo ""
fi

if [ "$STRUCTURAL_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}📅 В ТЕЧЕНИЕ НЕДЕЛИ (Высокий приоритет):${NC}"
    echo "   1. Проанализируйте структурные дубликаты вручную"
    echo "   2. Определите, какие файлы оставить (обычно в основной директории)"
    echo "   3. Проверьте корректность import путей"
    echo "   4. Потенциальная экономия: ~$(($(cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == "STRUCTURAL") | .files[0].size' | paste -sd+ | bc) / 1024))KB"
    echo ""
fi

if [ "$HIGH_SIMILARITY" -gt 0 ]; then
    echo -e "${BLUE}📆 В ТЕЧЕНИЕ МЕСЯЦА (Средний приоритет):${NC}"
    echo "   1. Стандартизируйте структуру тестов"
    echo "   2. Унифицируйте import пути"
    echo "   3. Настройте автоматическую проверку дубликатов в CI/CD"
    echo ""
fi

# Команды для быстрого анализа
echo -e "${GREEN}🛠️ ПОЛЕЗНЫЕ КОМАНДЫ:${NC}"
echo ""
echo "# Просмотр только точных дубликатов:"
echo "cat duplicate-detection-report.json | jq '.duplicateGroups[] | select(.type == \"EXACT\")'"
echo ""
echo "# Просмотр файлов для удаления:"
echo "cat duplicate-detection-report.json | jq -r '.duplicateGroups[] | select(.type == \"EXACT\") | .files[1].relativePath'"
echo ""
echo "# Запуск безопасной очистки:"
echo "bun run tools/duplicate-cleaner.ts --dry-run"
echo ""
echo "# Валидация структуры тестов:"
echo "bun run tools/test-structure-validator.ts"
echo ""

# Проверка готовности к очистке
echo -e "${GREEN}✅ ГОТОВНОСТЬ К ОЧИСТКЕ:${NC}"
if [ "$EXACT_COUNT" -gt 0 ]; then
    echo "🔴 Есть точные дубликаты - готовы к автоматической очистке"
else
    echo "🟢 Точных дубликатов нет - ручной анализ не требуется"
fi

if [ "$STRUCTURAL_COUNT" -gt 5 ]; then
    echo "🟡 Много структурных дубликатов - требуется планирование"
elif [ "$STRUCTURAL_COUNT" -gt 0 ]; then
    echo "🟡 Есть структурные дубликаты - требуется анализ"
else
    echo "🟢 Структурных дубликатов нет"
fi

echo ""
echo -e "${BLUE}📋 Для продолжения см. USAGE_GUIDE.md${NC}"