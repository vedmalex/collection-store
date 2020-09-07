#collection-store

It is simple and effective in-memory object store
can be used both on browser and server side.

for usage please see tests.

features:

- ttl: each item can have ttl;
- indexes: collection can have multiple indexes;
- schema: collection must have schema for all indexed items;
- simple CRUD.
- simple persistence
- extensible persistence.
- serialize/load schema within storage

## find

можно добавить валидацию
можно добавить интеграцию с удаленным хранилищем через хранилище
можно добавить graphql
можно добавить полнотекстовый поиск

можно использовать как структурированные логи для приложения

[x] чистить пустые индексные записи для Array
интегрировать с filter
и плотнее с lodash
[x] уровень хранения сделать адаптером, а не отдельным классом
кастомные индексы
    туда же можно включить сохранение в firebase

[x] предварительная обработка ключевых полей, функция,
[x] ignoreCase

поиск по нескольким ключам
сложные индексы(более двух полей)
fuzzy поиск по коллекциям

сделать сервер для работы с библиотекой в смысле сдлать программу сервер

посмотреть lunr.js для поиска по индексам