# TODO



use uuidv7
https://www.npmjs.com/package/@kripod/uuidv7

использовать в качестве cron эту библиотеку
https://www.npmjs.com/package/cron-schedule?activeTab=readme

сделать версию для браузера и для fs

сделать версию для mongodb

сделать multipackage repo
вынести адаптеры в разные npm модули
добавить в него b-pl-tree

использовать comparators в UnaryOperator


ajv заменить на zod

подумать: как сделать join
как сделать SQL

rotate не работает с обычными файлами, он их удаляет

AdapterFS - хранит данные в директории, главный файл называется metadata.json, в принципе совместим с List поскольку может сохранять List Внуть себя

тип данных Blob когда поле хранится в виде текстового или бинарного
несколько видов баз данных, один файл, или директория с ключами
придумать чанки для хранения файлов

не всегда правильно сохраняется или вообще не сохраняется

import { MikroORM } from 'collection-store-mikro-orm'
import config from './mikro-orm.config'
import { logline } from '~/lib/logline'
import { initORM } from './db'

const orm = await MikroORM.init(config)
await orm.schema.refreshDatabase()

const db = await initORM({debug:true})
const pages = db.pages()
const pages_sep = db.pages_sep()

const items = await pages.findAll({})
items.forEach((item, index) => {
  logline(`${index}`)

  pages_sep.create({
    id: item.id,
    path: item.path,
    content: item.content,
    relative: item.relative,
  })

})

await db.em.flush()
---
без этого кода просто выгружается не завершив транзакцию
const count = await pages_sep.findAndCount({})

console.log(count.length)

AllPages:sep не сохраняет описание
и не работает коррект