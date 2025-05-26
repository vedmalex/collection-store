import 'jest'
import { Item } from '../types/Item'
import { List } from '../storage/List'
import AdapterFile from '../AdapterFile'
import Collection from '../collection'
import fs from 'fs-extra'

interface ChildItem extends Item {
  name: string
  age: string
  address: {
    state: string
  }
}

function setTimer(ms) {
  return new Promise((res) => {
    setTimeout(res, ms)
  })
}
let names = {}

beforeAll(() => {
  names = {}
})

beforeEach(async () => {
  // Очищаем тестовые данные перед каждым тестом
  try {
    const testDirs = await fs.readdir(__dirname)
    for (const dir of testDirs) {
      if (dir.startsWith('items-') || dir.startsWith('clone') || dir.startsWith('test') || dir.startsWith('loaded')) {
        const fullPath = `${__dirname}/${dir}`
        try {
          const stat = await fs.stat(fullPath)
          if (stat.isDirectory()) {
            await fs.remove(fullPath)
          } else if (fullPath.endsWith('.json')) {
            await fs.remove(fullPath)
          }
        } catch (e) {
          // Файл может не существовать
        }
      }
    }
    // Также очищаем JSON файлы
    const files = await fs.readdir(__dirname)
    for (const file of files) {
      if (file.endsWith('.json') && (file.startsWith('items-') || file.startsWith('clone') || file.startsWith('test') || file.startsWith('loaded'))) {
        await fs.remove(`${__dirname}/${file}`)
      }
    }
  } catch (e) {
    // Игнорируем ошибки очистки
  }
})

const fileName = (name) => {
  if (!names[name]) {
    names[name] = 0
  }
  return `${__dirname}/${name}-${names[name]++}.json`
}

describe('collection clone', () => {
  it('clone', async () => {
    const c1 = await loadCoolectionTTL('clone')
    await c1.load()
    // const clone = c1.clone()
    // c1.list.toArray().forEach((i) => clone.push(i))
    // clone.persist('another')
  })
  it('rotate', async () => {
    const c1 = await loadCoolectionTTL('clone')
    await c1.load()
    // c1.doRotate();
  })
})

describe('list', () => {
  it('run', async () => {
    const list = new List()
    const collection = Collection.create({
      name: 'test',
      root: __dirname,
      list: list,
      adapter: new AdapterFile(),
    })
    list.init(collection)

    await list.set(0, { id: 0, obje: 1 })
    await list.set(1, { id: 1, obje: 2 })
    await list.set(2, { id: 2, obje: 3 })
    await list.set(3, { id: 3, obje: 4 })
    await list.set(4, { id: 4, obje: 10 })

    let k: string = ''
    expect(() => {
      for (const item of list.keys) {
        k += item
      }
      expect(k).toBe('01234')
    }).not.toThrow()
  })
})

describe('indexLoader', () => {
  it('loads empty file', async () => {
    const c1 = Collection.create({
      name: 'loaded',
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })
    await c1.load()
  })
})

const loadCoolectionTTL = async (name) => {
  const fn = fileName(name)
  const c1 = Collection.create({
    name,
    ttl: '100ms',
    id: 'name',
    adapter: new AdapterFile(),
    list: new List(),
    root: __dirname,
  })

  await c1.create({ name: 'Some', age: 12 })
  await c1.create({ name: 'Another', age: 13 })
  await c1.create({ name: 'SomeOneElse', age: 12 })
  await c1.create({ name: 'Anybody', age: 12 })
  await c1.persist()
  return Collection.create({
    name,
    ttl: '100ms',
    id: 'name',
    adapter: new AdapterFile(),
    list: new List(),
    root: __dirname,
  })
}

describe('collectionTTL', () => {
  it('exists before ttl-ends', async () => {
    const c1 = await loadCoolectionTTL('items-ttl')
    await c1.load()
    expect(c1.list.length).toBe(4)
  })

  it("didn't exists after ttl-ends", async () => {
    const c1 = await loadCoolectionTTL('items-ttl')
    await c1.load()
    await setTimer(300)
    await c1.persist()
    expect((await c1.find({ age: 12 })).length).toBe(0)
    expect(await c1.findById('Some')).toBe(undefined)
  })

  it("didn't exists after ttl-ends without re-loading", async () => {
    const c1 = await loadCoolectionTTL('items-ttl')
    await setTimer(300)
    await c1.load()
    expect(c1.list.length).toBe(0)
    await c1.create({ name: 'Some', age: 12 })
    await c1.create({ name: 'Another', age: 13 })
    await c1.create({ name: 'SomeOneElse', age: 12 })
    await c1.create({ name: 'Anybody', age: 12 })
    await c1.persist()
    expect(c1.list.length).toBe(4)
  })
})

const loadCoolection = async <T extends Item>(name): Promise<Collection<T>> => {
  const uniqueName = `${name}-${Date.now()}-${Math.random()}`
  const c1 = Collection.create<T>({
    name: uniqueName,
    adapter: new AdapterFile<T>(),
    list: new List<T>(),
    root: __dirname,
    indexList: [{ key: 'address.state', sparse: true }],
  })
  await c1.create({ name: 'Some', age: 12 } as unknown as T)
  await c1.create({ name: 'Another', age: 13 } as unknown as T)
  await c1.create({ name: 'SomeOneElse', age: 12 } as unknown as T)
  await c1.create({ name: 'Anybody', age: 12, address: { state: 'NY' } } as unknown as T)
  await c1.persist()
  return Collection.create<T>({
    name: uniqueName,
    adapter: new AdapterFile<T>(),
    list: new List<T>(),
    root: __dirname,
  })
}

describe('collection', () => {
  it('default autoinc works', async () => {
    const c1 = await loadCoolection('items-noTTL')
    await c1.load()
    const item0 = await c1.list.get(0)
    const item1 = await c1.list.get(1)
    const item2 = await c1.list.get(2)
    const item3 = await c1.list.get(3)

    expect(item0?.id).toBe(0)
    expect(item1?.id).toBe(1)
    expect(item2?.id).toBe(2)
    expect(item3?.id).toBe(3)

    expect(c1.indexes.id.findFirst(0)).toBe(0)
    expect(c1.indexes.id.findFirst(1)).toBe(1)
    expect(c1.indexes.id.findFirst(2)).toBe(2)
    expect(c1.indexes.id.findFirst(3)).toBe(3)
  })

  it('has different configurations', async () => {
    const col1 = Collection.create({
      name: 'testOne',
      id: 'name',
      auto: false,
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })

    expect(col1.store().indexDefs['name']).toMatchObject({
      key: 'name',
      auto: false,
      gen: 'autoIncIdGen',
    })

    const col11 = Collection.create({
      name: 'testOne',
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })

    expect(col11.store().indexDefs['id']).toMatchObject({
      key: 'id',
      auto: true,
      gen: 'autoIncIdGen',
    })

    const gen2 = (item, model, initial) => {
      return item.name + model + initial
    }

    const col2 = Collection.create({
      name: 'testTwo',
      id: 'name',
      idGen: gen2,
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })

    expect(col2.store().indexDefs['name']).toMatchObject({
      key: 'name',
      auto: true,
      gen: gen2.toString(),
    })

    const col3 = Collection.create({
      name: 'testThree',
      id: 'name',
      auto: false,
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })

    await expect(col3.push({ some: 1, other: 2 })).rejects.toThrow()

    const col4 = Collection.create({
      name: 'testFour',
      id: { name: 'name', auto: false },
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })

    expect(col4.store().indexDefs['name']).toMatchObject({
      key: 'name',
      auto: false,
      gen: 'autoIncIdGen',
    })
  })

  it('has unique index', async () => {
    const c1 = await loadCoolection('items-noTTL')
    await c1.load()
    await expect(c1.push({ id: 0, name: 'some' })).rejects.toThrow()
  })

  it('must have constructor', () => {
    expect(() => Collection.create()).toThrow()
    expect(() => Collection.create({
      name: 'name',
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })).not.toThrow()
    const collection = Collection.create({
      name: 'SomeName',
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })
    expect(collection.list.length).toBe(0)
    expect(collection.indexes.id.size).toBe(0)
  })

  it('creates item', async () => {
    const c1 = await loadCoolection('items-noTTL')
    // await c1.load();
    await c1.create({ name: 'Some', age: 12 } as any)
    await c1.persist()
    await c1.load()
    expect(c1.list.length).toBe(1)
    expect(c1.indexes.id.size).toBe(1)
  })

  it('resets the collection, not the storage', async () => {
    const c1 = await loadCoolection('items-noTTL')
    await c1.create({ name: 'Some', age: 12 } as any)
    await c1.create({ name: 'Another', age: 13 } as any)
    await c1.create({ name: 'SomeOneElse', age: 12 } as any)
    await c1.create({ name: 'Anybody', age: 12 } as any)
    await c1.persist()
    expect(c1.list.length).toBe(4)
    expect(c1.indexes.id.size).toBe(4)
    await c1.reset()
    expect(c1.list.length).toBe(0)
    expect(c1.indexes.id.size).toBe(0)
    await c1.load()
    expect(c1.list.length).toBe(4)
    expect(c1.indexes.id.size).toBe(4)
    await c1.reset()
    await c1.persist()
    await c1.load()
    expect(c1.list.length).toBe(0)
    expect(c1.indexes.id.size).toBe(0)
  })

  it('allow update key fields', async () => {
    const c1 = await loadCoolection('items-noTTL')
    await c1.load()
    expect(c1.list.length).toBe(4)
    await c1.update({ id: 0, age: 12 }, { id: 10, class: 5 } as any)
    await c1.persist()
    expect(await c1.findById(0)).toBe(undefined)
    expect(await c1.findById(10)).not.toBe(undefined)
  })

  it('find findOne findById', async () => {
    const c1 = await loadCoolection('items-noTTL')
    // let c1 = new Collection({ name: 'items' });
    await c1.load()
    expect(c1.list.length).toBe(4)
    expect((await c1.find({ age: 12 })).length).toBe(3)
    expect((await c1.find({ age: 13 })).length).toBe(1)
    expect((await c1.find((i) => i.age == 13)).length).toBe(1)
    expect(await c1.findFirst({ age: 13 })).toMatchObject({
      name: 'Another',
      age: 13,
      id: 1,
    })
    expect(await c1.findFirst((i) => i.age == 13)).toMatchObject({
      name: 'Another',
      age: 13,
      id: 1,
    })
    expect(await c1.findById(1)).toMatchObject({ name: 'Another', age: 13, id: 1 })
  })

  it('update undateOne updateWithId', async () => {
    const c1 = await loadCoolection<ChildItem>('items-noTTL')
    // let c1 = new Collection<ChildItem>({ name: 'items' });
    await c1.load()
    expect(c1.list.length).toBe(4)
    await c1.update({ age: 12 }, { class: 5 } as any)
    await c1.persist()
    await c1.load()
    expect((await c1.find({ class: 5 } as any)).length).toBe(3)
    await c1.update({ age: 13 }, { class: 6 } as any)
    await c1.persist()
    await c1.load()
    expect((await c1.find({ class: 6 } as any)).length).toBe(1)
    await c1.updateWithId(0, { name: '!!!', address: { state: 'NJ' } })
    await c1.persist()
    await c1.load()
    expect((await c1.findById(0))?.name).toBe('!!!')
    expect((await c1.findById(0))?.address.state).toBe('NJ')
  })

  it('remove removeOne removeWithId', async () => {
    const c1 = await loadCoolection('items-noTTL')
    // let c1 = new Collection({ name: 'items' });
    await c1.load()
    expect(c1.list.length).toBe(4)
    await c1.removeFirst({ age: 12 })
    expect(c1.list.length).toBe(3)
    await c1.persist()
    await c1.load()
    expect((await c1.find({ age: 12 })).length).toBe(2)
    await c1.remove((i) => i.age == 12)
    expect(c1.list.length).toBe(1)
    await c1.persist()
    await c1.load()
    expect((await c1.find({ age: 12 })).length).toBe(0)
    expect((await c1.find((i) => i.age == 13)).length).toBe(1)
    await c1.removeWithId(1)
    await c1.persist()
    await c1.load()
    expect((await c1.find((i) => i.age == 13)).length).toBe(0)
  })

  it('continue id after removing and etc', async () => {
    const c1 = await loadCoolection('items-noTTL')
    // let c1 = new Collection({ name: 'items' });
    await c1.load()
    await c1.removeWithId(3)
    await c1.removeWithId(1)
    const nv = await c1.create({ age: 100, class: 100 } as any)
    expect(nv?.id).toBe(4)
    await c1.persist()
  })
})

const loadCoolectionIndexes = async <T extends Item>(
  name,
): Promise<Collection<T>> => {
  const uniqueName = `${name}-${Date.now()}-${Math.random()}`
  const c1 = await Collection.create({
    name: uniqueName,
    id: '_id',
    indexList: [
      {
        key: 'name',
        process: (value: string) => value.toLowerCase(),
      },
      {
        key: 'age',
        sparse: true,
      },
      {
        key: 'pass',
        unique: true,
        sparse: true,
      },
      {
        key: 'address.state',
      },
      { key: 'middleName', ignoreCase: true },
    ],
    list: new List(),
    adapter: new AdapterFile(),
    root: __dirname,
  })
  await c1.create({
    name: 'Some',
    age: 12,
    pass: 1,
    address: { state: 'NY' },
    middleName: 'Jay',
  } as unknown as T)
  await c1.create({
    name: 'Another',
    age: 13,
    pass: 2,
    address: { state: 'NJ' },
    middleName: 'Nathan',
  } as unknown as T)
  await c1.create({
    name: 'Another',
    age: 12,
    pass: 3,
    address: { state: 'WA' },
    middleName: 'NATHAN',
  } as unknown as T)
  await c1.create({
    name: 'SomeOneElse',
    age: 11,
    pass: 4,
    address: { state: 'DE' },
    middleName: 'NaThan',
  } as unknown as T)
  await c1.create({
    name: 'SomeOneElse',
    age: 14,
    pass: 5,
    address: { state: 'WI' },
    middleName: 'nathaN',
  } as unknown as T)
  await c1.create({
    name: 'Anybody',
    age: 13,
    address: { state: 'CA' },
    middleName: 'Joe',
  } as unknown as T)
  await c1.create({ name: 'Anybody', pass: 6 } as unknown as T)
  await c1.create({
    name: 'Anybody',
    age: 12,
    address: { state: 'NY' },
    middleName: 'Jim',
  } as unknown as T)
  await c1.persist()
  return Collection.create<T>({
    name: uniqueName,
    id: '_id',
    indexList: [
      {
        key: 'name',
        process: (value: string) => value.toLowerCase(),
      },
      {
        key: 'age',
        sparse: true,
      },
      {
        key: 'pass',
        unique: true,
        sparse: true,
      },
      {
        key: 'address.state',
      },
      { key: 'middleName', ignoreCase: true },
    ],
    adapter: new AdapterFile<T>(),
    list: new List<T>(),
    root: __dirname,
  })
}

describe('collection indexes', () => {
  it('restore all collection state', async () => {
    const c1 = await loadCoolectionIndexes('items-indexes')
    expect(c1.id).toBe('_id')
    await c1.load()
    expect(c1.id).toBe('_id')
    expect(c1.indexDefs.id).toBe(undefined)
    expect(c1.indexDefs._id).not.toBe(undefined)
    expect(c1.indexDefs.name).not.toBe(undefined)
    expect(c1.indexDefs.age).not.toBe(undefined)
    expect(c1.indexes.id).toBe(undefined)
    expect(c1.indexes._id).not.toBe(undefined)
    expect(c1.indexes.name).not.toBe(undefined)
    expect(c1.indexes.age).not.toBe(undefined)
  })

  it('uses process to find Value', async () => {
    const c1 = await loadCoolectionIndexes('items-indexes')
    await c1.load()
    const byName = await c1.findBy('name', 'anybody')
    expect(byName.length).toBe(3)
  })

  it('ignoreCase', async () => {
    const c1 = await loadCoolectionIndexes('items-indexes')
    await c1.load()
    const byName = await c1.findBy('middleName', 'nathan')
    expect(byName.length).toBe(4)
  })

  it('findBy index keys', async () => {
    const c1 = await loadCoolectionIndexes('items-indexes')
    await c1.load()
    const byName = await c1.findBy('name', 'Anybody')
    expect(byName.length).toBe(3)
    const byAge = await c1.findBy('age', 12)
    expect(byAge.length).toBe(3)
    const byId = await c1.findBy('_id', 1)
    expect(byId.length).toBe(1)
  })

  it('findBy unique index keys', async () => {
    const c1 = await loadCoolectionIndexes('items-indexes')
    await c1.load()
    const byName = await c1.findBy('pass', 1)
    await c1.removeWithId(byName[0]['_id'])
    await c1.create({ name: 'Some', age: 12, pass: 1 } as any)
    expect((byName[0] as any).name).toBe('Some')
    await c1.persist()
  })

  it('complex sample', async () => {
    const c1 = Collection.create({
      name: 'DeviceMapping',
      indexList: [
        { key: 'DeviceId', required: true, unique: true, sparse: true },
        { key: 'Username', required: true, unique: false },
      ],
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })
    expect(c1.indexes.id.size).toBe(0)
    expect(c1.indexes.DeviceId.size).toBe(0)
    expect(c1.indexes.Username.size).toBe(0)
    await c1.persist()

    await c1.create({ DeviceId: '111222', Username: 'testuser01' } as any)

    expect(c1.indexes.id.size).toBe(1)
    expect(c1.indexes.id.findFirst(0)).toBe(0)
    expect(c1.indexes.DeviceId.size).toBe(1)
    expect(c1.indexes.DeviceId.findFirst(111222)).toBe(0)
    expect(c1.indexes.Username.size).toBe(1)
    expect(c1.indexes.Username.find('testuser01')[0]).toBe(0)

    await c1.persist()

    await c1.create({ DeviceId: '1112221', Username: 'testuser01' } as any)

    expect(c1.indexes.id.size).toBe(2)
    expect(c1.indexes.id.findFirst(0)).toBe(0)
    expect(c1.indexes.id.findFirst(1)).toBe(1)
    expect(c1.indexes.DeviceId.size).toBe(2)
    expect(c1.indexes.DeviceId.findFirst(111222)).toBe(0)
    expect(c1.indexes.DeviceId.findFirst(1112221)).toBe(1)
    expect(c1.indexes.Username.size).toBe(2)
    expect(c1.indexes.Username.find('testuser01')[0]).toBe(0)
    expect(c1.indexes.Username.find('testuser01')[1]).toBe(1)

    await c1.persist()

    const item = await c1.findBy('DeviceId', '111222')

    await c1.removeWithId(item[0].id)

    await c1.persist()

    expect(c1.indexes.id.size).toBe(1)
    expect(c1.indexes.id.findFirst(0)).toBeUndefined()
    expect(c1.indexes.id.findFirst(1)).toBe(1)
    expect(c1.indexes.DeviceId.size).toBe(1)
    expect(c1.indexes.DeviceId.findFirst(111222)).toBeUndefined()
    expect(c1.indexes.DeviceId.findFirst(1112221)).toBe(1)
    expect(c1.indexes.Username.size).toBe(1)
    expect(c1.indexes.Username.find('testuser01')[0]).toBe(1)

    await c1.create({ DeviceId: '111222', Username: 'testuser01' } as any)

    expect(c1.indexes.id.size).toBe(2)
    expect(c1.indexes.id.findFirst(0)).toBeUndefined()
    expect(c1.indexes.id.findFirst(1)).toBe(1)
    expect(c1.indexes.id.findFirst(2)).toBe(2)
    expect(c1.indexes.DeviceId.size).toBe(2)
    expect(c1.indexes.DeviceId.findFirst(111222)).toBe(2)
    expect(c1.indexes.DeviceId.findFirst(1112221)).toBe(1)
    expect(c1.indexes.Username.size).toBe(2)
    expect(c1.indexes.Username.find('testuser01')[0]).toBe(1)
    expect(c1.indexes.Username.find('testuser01')[1]).toBe(2)

    await c1.persist()

    const new_item = await c1.findBy('DeviceId', '111222')
    expect(new_item.length).toBe(1)
    expect(new_item[0].id).toBe(2)
  })

  it('indexAll', async () => {
    const c1 = Collection.create({
      name: 'collectionTest',
      indexList: [{ key: '*' }],
      adapter: new AdapterFile(),
      list: new List(),
      root: __dirname,
    })
    await c1.create({ name: 'Some', age: 12, pass: 1 } as any)
    expect(c1.indexes.name.size).toBe(1)
    await c1.persist()
  })
})

// доделать тесты для node + web и можно делать проект...
// посмотреть может быть можно и нужно использовать версию с Map вместо hash
// индексы храняться в hash не по значению а по строкам... это может упростить
// работы кодогенерации...
//

// нужно хранить объекты для кодогенерации и иметь возможность обращаться
// к ним по определенным полям...
