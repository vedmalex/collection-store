import 'jest'
import { List, Item } from '../collection';
import Collection from '../collection.node';

interface ChildItem extends Item {
  name: string
  age: string
}

function setTimer(ms) {
  return new Promise(res => {
    setTimeout(res, ms)
  })
}
let names = {}

beforeAll(() => {
  names = {}
})

const fileName = (name) => {
  if (!names[name]) {
    names[name] = 0
  }
  return `${__dirname}/${name}-${names[name]++}.json`
};

describe('hreplacer', () => {

  describe('list', () => {
    it('run', () => {
      let list = new List();
      list.push({ obje: 1 });
      list.push({ obje: 2 });
      list.push({ obje: 3 });
      list.push({ obje: 4 });
      list.push(10);

      let k: string = ''
      expect(() => {
        for (let item of list.keys) {
          k += item
        }
        expect(k).toBe('01234')
      }).not.toThrow()

    });
  });

  describe('indexLoader', () => {
    it('loads empty file', async () => {
      let c1 = new Collection({ name: "loaded", path: fileName('loaded') })
      await c1.load()
    })
  })

  const loadCoolectionTTL = async (name) => {
    const fn = fileName(name)
    let c1 = new Collection({ name, ttl: '100ms', id: 'name', path: fn });
    c1.create({ name: 'Some', age: 12 });
    c1.create({ name: 'Another', age: 13 });
    c1.create({ name: 'SomeOneElse', age: 12 });
    c1.create({ name: 'Anybody', age: 12 });
    await c1.persist();
    return new Collection({ name, path: fn })
  }



  describe('collectionTTL', () => {
    it('exists before ttl-ends', async () => {
      let c1 = await loadCoolectionTTL('items-ttl')
      await c1.load()
      expect(c1.list.length).toBe(4);
    });

    it('didn\'t exists after ttl-ends', async () => {
      let c1 = await loadCoolectionTTL('items-ttl')
      await c1.load();
      await setTimer(300);
      expect(c1.find({ age: 12 }).length).toBe(0);
      expect(c1.findById(0)).toBe(undefined);
    });

    it('didn\'t exists after ttl-ends without re-loading', async () => {
      let c1 = await loadCoolectionTTL('items-ttl')
      await setTimer(300)
      await c1.load();
      expect(c1.list.length).toBe(0);
      c1.create({ name: 'Some', age: 12 });
      c1.create({ name: 'Another', age: 13 });
      c1.create({ name: 'SomeOneElse', age: 12 });
      c1.create({ name: 'Anybody', age: 12 });
      await c1.persist();
      expect(c1.list.length).toBe(4);
    });
  });

  const loadCoolection = async <T extends Item>(name): Promise<Collection<T>> => {
    const fn = fileName(name)
    let c1 = new Collection({ name, path: fn });
    c1.create({ name: 'Some', age: 12 });
    c1.create({ name: 'Another', age: 13 });
    c1.create({ name: 'SomeOneElse', age: 12 });
    c1.create({ name: 'Anybody', age: 12 });
    await c1.persist();
    return new Collection({ name, path: fn })
  }

  describe('collection', () => {
    it('default autoinc works', async () => {
      let c1 = await loadCoolection('items-noTTL')
      await c1.load()
      expect(c1.list.get(0).id).toBe(0);
      expect(c1.list.get(1).id).toBe(1);
      expect(c1.list.get(2).id).toBe(2);
      expect(c1.list.get(3).id).toBe(3);

      expect(c1.indexes.id[0]).toBe(0);
      expect(c1.indexes.id[1]).toBe(1);
      expect(c1.indexes.id[2]).toBe(2);
      expect(c1.indexes.id[3]).toBe(3);
    });

    it('has different configurations', () => {

      let col1 = new Collection({ name: 'testOne', id: 'name', auto: false });

      expect({ id: col1.id, auto: col1.auto, gen: col1.indexDefs.name.gen }).toMatchObject({
        id: 'name', auto: false, gen: 'autoIncIdGen'
      });

      let col11 = new Collection({ name: 'testOne' });

      expect({ id: col11.id, auto: col11.auto, gen: col11.indexDefs.id.gen }).toMatchObject({
        id: 'id', auto: true, gen: 'autoIncIdGen'
      });

      let gen2 = (item, model, initial) => {
        return item.name + model + initial;
      };

      let col2 = new Collection({
        name: 'testTwo',
        id: 'name',
        idGen: gen2
      });

      expect({ id: col2.id, auto: col2.auto, gen: col2.indexDefs.name.gen }).toMatchObject({
        id: 'name', auto: true, gen: gen2.toString()
      });

      let col3 = new Collection({ name: 'testThree', id: 'name', auto: false });

      expect(() => col3.push({ some: 1, other: 2 })).toThrow();

      let col4 = new Collection({ name: 'testFour', id: { name: 'name', auto: false } });

      expect({ id: col4.id, auto: col4.auto, gen: col4.indexDefs.name.gen }).toMatchObject({
        id: 'name', auto: false, gen: 'autoIncIdGen'
      });
    });

    it('has unique index', async () => {
      let c1 = await loadCoolection('items-noTTL')
      await c1.load()
      expect(() => c1.push({ id: 0, name: 'some' })).toThrow();
    });

    it('must have constructor', () => {
      expect(() => new Collection()).toThrow();
      expect(() => new Collection({ name: 'name' })).not.toThrow();
      let collection = new Collection({ name: 'SomeName' });
      expect(collection.list.length).toBe(0);
      expect(Object.keys(collection.indexes.id).length).toBe(0);
    });

    it('creates item', async () => {
      let c1 = await loadCoolection('items-noTTL')
      // await c1.load();
      c1.create({ name: 'Some', age: 12 });
      await c1.persist();
      await c1.load();
      expect(c1.list.length).toBe(1);
      expect(Object.keys(c1.indexes.id).length).toBe(1);
    });

    it('resets the collection, not the storage', async () => {
      let c1 = await loadCoolection('items-noTTL')
      c1.create({ name: 'Some', age: 12 });
      c1.create({ name: 'Another', age: 13 });
      c1.create({ name: 'SomeOneElse', age: 12 });
      c1.create({ name: 'Anybody', age: 12 });
      await c1.persist();
      expect(c1.list.length).toBe(4);
      expect(Object.keys(c1.indexes.id).length).toBe(4);
      c1.reset();
      expect(c1.list.length).toBe(0);
      expect(Object.keys(c1.indexes.id).length).toBe(0);
      await c1.load()
      expect(c1.list.length).toBe(4);
      expect(Object.keys(c1.indexes.id).length).toBe(4);
      c1.reset();
      await c1.persist();
      await c1.load();
      expect(c1.list.length).toBe(0);
      expect(Object.keys(c1.indexes.id).length).toBe(0);
    });

    it('allow update key fields', async () => {
      let c1 = await loadCoolection('items-noTTL')
      await c1.load()
      expect(c1.list.length).toBe(4);
      c1.update({ id: 0, age: 12 }, { id: 10, class: 5 });
      await c1.persist();
      expect(c1.findById(0)).toBe(undefined);
      expect(c1.findById(10)).not.toBe(undefined);
    });

    it('find findOne findById', async () => {
      let c1 = await loadCoolection('items-noTTL')
      // let c1 = new Collection({ name: 'items' });
      await c1.load()
      expect(c1.list.length).toBe(4);
      expect(c1.find({ age: 12 }).length).toBe(3);
      expect(c1.find({ age: 13 }).length).toBe(1);
      expect(c1.find(i => i.age == 13).length).toBe(1);
      expect(c1.findOne({ age: 13 })).toMatchObject({ name: 'Another', age: 13, id: 1 });
      expect(c1.findOne(i => i.age == 13)).toMatchObject({ name: 'Another', age: 13, id: 1 });
      expect(c1.findById(1)).toMatchObject({ name: 'Another', age: 13, id: 1 });
    });

    it('update undateOne updateWithId', async () => {
      let c1 = await loadCoolection<ChildItem>('items-noTTL')
      // let c1 = new Collection<ChildItem>({ name: 'items' });
      await c1.load();
      expect(c1.list.length).toBe(4);
      c1.update({ age: 12 }, { class: 5 });
      await c1.persist();
      await c1.load();
      expect(c1.find({ class: 5 }).length).toBe(3);
      c1.update({ age: 13 }, { class: 6 });
      await c1.persist();
      await c1.load();
      expect(c1.find({ class: 6 }).length).toBe(1);
      c1.updateWithId(0, { name: '!!!' });
      await c1.persist();
      await c1.load();
      expect(c1.findById(0).name).toBe('!!!');
    });

    it('remove removeOne removeWithId', async () => {
      let c1 = await loadCoolection('items-noTTL')
      // let c1 = new Collection({ name: 'items' });
      await c1.load();
      expect(c1.list.length).toBe(4);
      c1.removeOne({ age: 12 });
      expect(c1.list.length).toBe(3);
      await c1.persist();
      await c1.load();
      expect(c1.find({ age: 12 }).length).toBe(2);
      c1.remove(i => i.age == 12);
      expect(c1.list.length).toBe(1);
      await c1.persist();
      await c1.load();
      expect(c1.find({ age: 12 }).length).toBe(0);
      expect(c1.find(i => i.age = 13).length).toBe(1);
      c1.removeWithId(1);
      await c1.persist();
      await c1.load();
      expect(c1.find(i => i.age = 13).length).toBe(0);
    });

    it('continue id after removing and etc', async () => {
      let c1 = await loadCoolection('items-noTTL')
      // let c1 = new Collection({ name: 'items' });
      await c1.load();
      c1.removeWithId(3);
      c1.removeWithId(1);
      let nv = c1.create({ age: 100, class: 100 });
      expect(nv.id).toBe(4);
      await c1.persist();
    });

  });

  const loadCoolectionIndexes = async <T extends Item>(name): Promise<Collection<T>> => {
    const fn = fileName(name)
    let c1 = new Collection({
      name: 'items', id: '_id', indexList: [{
        key: 'name',
      }, {
        key: 'age',
        sparse: true
      }, {
        key: 'pass',
        unique: true,
        sparse: true
      }
      ], path: fn
    });
    c1.create({ name: 'Some', age: 12, pass: 1 });
    c1.create({ name: 'Another', age: 13, pass: 2 });
    c1.create({ name: 'Another', age: 12, pass: 3 });
    c1.create({ name: 'SomeOneElse', age: 11, pass: 4 });
    c1.create({ name: 'SomeOneElse', age: 14, pass: 5 });
    c1.create({ name: 'Anybody', age: 13 });
    c1.create({ name: 'Anybody', pass: 6 });
    c1.create({ name: 'Anybody', age: 12 });
    await c1.persist();
    return new Collection({ name, path: fn })
  }

  describe('collection indexes', () => {
    it('restore all collection state', async () => {
      let c1 = await loadCoolectionIndexes('items-indexes')
      expect(c1.id).toBe('id');
      await c1.load();
      expect(c1.id).toBe('_id');
      expect(c1.indexDefs.id).toBe(undefined);
      expect(c1.indexDefs._id).not.toBe(undefined);
      expect(c1.indexDefs.name).not.toBe(undefined);
      expect(c1.indexDefs.age).not.toBe(undefined);
      expect(c1.indexes.id).toBe(undefined);
      expect(c1.indexes._id).not.toBe(undefined);
      expect(c1.indexes.name).not.toBe(undefined);
      expect(c1.indexes.age).not.toBe(undefined);
    });

    it('findBy index keys', async () => {
      let c1 = await loadCoolectionIndexes('items-indexes')
      await c1.load()
      let byName = c1.findBy('name', 'Anybody');
      expect(byName.length).toBe(3);
      let byAge = c1.findBy('age', 12);
      expect(byAge.length).toBe(3);
      let byId = c1.findBy('_id', 1);
      expect(byId.length).toBe(1);
    });

    it('findBy unique index keys', async () => {
      let c1 = await loadCoolectionIndexes('items-indexes')
      await c1.load()
      let byName = c1.findBy('pass', 1);
      c1.removeWithId(byName[0]["_id"])
      c1.create({ name: 'Some', age: 12, pass: 1 });
      expect((byName[0] as any).name).toBe('Some');
      c1.persist()
    });

    it('complex sample', async () => {
      const c1 = new Collection({
        name: 'DeviceMapping',
        indexList: [
          { key: "DeviceId", required: true, unique: true, sparse:true },
          { key: 'Username', required: true, unique: false }
        ],
        path: fileName('device-mapping')
      })
      expect(Object.keys(c1.indexes.id).length).toBe(0)
      expect(Object.keys(c1.indexes.DeviceId).length).toBe(0)
      expect(Object.keys(c1.indexes.Username).length).toBe(0)
      await c1.persist()

      c1.create({DeviceId: '111222', Username:'testuser01'})

      expect(Object.keys(c1.indexes.id).length).toBe(1)
      expect(c1.indexes.id[0]).toBe(0)
      expect(Object.keys(c1.indexes.DeviceId).length).toBe(1)
      expect(c1.indexes.DeviceId[111222]).toBe(0)
      expect(Object.keys(c1.indexes.Username).length).toBe(1)
      expect(c1.indexes.Username['testuser01'][0]).toBe(0)

      await c1.persist()

      c1.create({DeviceId: '1112221', Username:'testuser01'})

      expect(Object.keys(c1.indexes.id).length).toBe(2)
      expect(c1.indexes.id[0]).toBe(0)
      expect(c1.indexes.id[1]).toBe(1)
      expect(Object.keys(c1.indexes.DeviceId).length).toBe(2)
      expect(c1.indexes.DeviceId[111222]).toBe(0)
      expect(c1.indexes.DeviceId[1112221]).toBe(1)
      expect(Object.keys(c1.indexes.Username).length).toBe(1)
      expect(c1.indexes.Username['testuser01'][0]).toBe(0)
      expect(c1.indexes.Username['testuser01'][1]).toBe(1)

      await c1.persist()

      const item = c1.findBy('DeviceId', '111222')

      c1.removeWithId(item[0].id)

      await c1.persist()

      expect(Object.keys(c1.indexes.id).length).toBe(1)
      expect(c1.indexes.id[0]).toBeUndefined()
      expect(c1.indexes.id[1]).toBe(1)
      expect(Object.keys(c1.indexes.DeviceId).length).toBe(1)
      expect(c1.indexes.DeviceId[111222]).toBeUndefined()
      expect(c1.indexes.DeviceId[1112221]).toBe(1)
      expect(Object.keys(c1.indexes.Username).length).toBe(1)
      expect(c1.indexes.Username['testuser01'][0]).toBe(1)

      c1.create({DeviceId: '111222', Username:'testuser01'})

      expect(Object.keys(c1.indexes.id).length).toBe(2)
      expect(c1.indexes.id[0]).toBeUndefined()
      expect(c1.indexes.id[1]).toBe(1)
      expect(c1.indexes.id[2]).toBe(2)
      expect(Object.keys(c1.indexes.DeviceId).length).toBe(2)
      expect(c1.indexes.DeviceId[111222]).toBe(2)
      expect(c1.indexes.DeviceId[1112221]).toBe(1)
      expect(Object.keys(c1.indexes.Username).length).toBe(1)
      expect(c1.indexes.Username['testuser01'][0]).toBe(1)
      expect(c1.indexes.Username['testuser01'][1]).toBe(2)

      await c1.persist()

      const new_item = c1.findBy('DeviceId', '111222')
      expect(new_item.length).toBe(1)
      expect(new_item[0].id).toBe(2)
    })

  });
});

// доделать тесты для node + web и можно делать проект...
// посмотреть может быть можно и нужно использовать версию с Map вместо hash
// индексы храняться в hash не по значению а по строкам... это может упростить
// работы кодогенерации...
//

// нужно хранить объекты для кодогенерации и иметь возможность обращаться
// к ним по определенным полям...
