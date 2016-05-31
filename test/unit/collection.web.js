import Collection from '../../src/collection.web';
import { List } from '../../src/collection';

describe('hreplacer', () => {

  describe('list', ()=> {
    it('run', ()=> {
      let list = new List();
      list.push({obje: 1});
      list.push({obje: 2});
      list.push({obje: 3});
      list.push({obje: 4});
      list.push(10);

      for (let item of list.keys) {
        console.log(item);
      }
    });
  });

  describe('collectionTTL',()=> {

    beforeEach(()=> {
      localStorage.clear();
      let c1 = new Collection({storage: localStorage, name: 'items', ttl: '100ms', id: 'name'});
      c1.create({name: 'Some', age: 12});
      c1.create({name: 'Another', age: 13});
      c1.create({name: 'SomeOneElse', age: 12});
      c1.create({name: 'Anybody', age: 12});
      c1.persist();
    });

    it('exists before ttl-ends',()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();
      expect(c1.list.length).to.be.equal(4);

    });

    it('didn\'t exists after ttl-ends',(done)=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      setTimeout(()=> {
        c1.load();
        expect(c1.list.length).to.be.equal(0);
        c1.create({name: 'Some', age: 12});
        c1.create({name: 'Another', age: 13});
        c1.create({name: 'SomeOneElse', age: 12});
        c1.create({name: 'Anybody', age: 12});
        c1.persist();
        expect(c1.list.length).to.be.equal(4);
        done();
      }, 300);
    });
  });

  describe('collection',()=> {

    beforeEach(()=> {
      localStorage.clear();
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.create({name: 'Some', age: 12});
      c1.create({name: 'Another', age: 13});
      c1.create({name: 'SomeOneElse', age: 12});
      c1.create({name: 'Anybody', age: 12});
      c1.persist();
    });

    it('default autoinc works', ()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();

      expect(c1.list.get(0).id).to.be.equal(0);
      expect(c1.list.get(1).id).to.be.equal(1);
      expect(c1.list.get(2).id).to.be.equal(2);
      expect(c1.list.get(3).id).to.be.equal(3);

      expect(c1.indexes.id[0]).to.be.equal(0);
      expect(c1.indexes.id[1]).to.be.equal(1);
      expect(c1.indexes.id[2]).to.be.equal(2);
      expect(c1.indexes.id[3]).to.be.equal(3);
    });

    it('has different configurations', ()=> {

      let col1 = new Collection({storage: localStorage, name: 'testOne', id: 'name', auto: false});

      expect({id: col1.id, auto: col1.auto, gen: col1.indexDefs.name.gen}).to.be.deep.equal({
        id: 'name', auto: false, gen: 'autoIncIdGen'
      });

      let col11 = new Collection({storage: localStorage, name: 'testOne'});

      expect({id: col11.id, auto: col11.auto, gen: col11.indexDefs.id.gen}).to.be.deep.equal({
        id: 'id', auto: true, gen: 'autoIncIdGen'
      });

      let gen2 = (item, model, initial, current) => {
        return item.name + initial + current;
      };

      let col2 = new Collection({storage: localStorage,
        name: 'testTwo',
        id: 'name',
        idGen: gen2
      });

      expect({id: col2.id, auto: col2.auto, gen: col2.indexDefs.name.gen}).to.be.deep.equal({
        id: 'name', auto: true, gen: gen2.toString()
      });

      let col3 = new Collection({storage: localStorage, name: 'testThree', id: 'name', auto: false});

      expect(() => col3.push({some: 1, other: 2})).to.throw();

      let col4 = new Collection({storage: localStorage, name: 'testFour', id: {name: 'name', auto: false}});

      expect({id: col4.id, auto: col4.auto, gen: col4.indexDefs.name.gen}).to.be.deep.equal({
        id: 'name', auto: false, gen: 'autoIncIdGen'
      });

    });

    it('has unique index', ()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();
      expect(()=> c1.push({ id: 0, name: 'some'})).to.throw();
    });

    it('must have constructor',()=> {
      expect(()=> new Collection()).to.throw();
      expect(()=> new Collection({storage: localStorage, name: 'name'})).to.not.throw();
      let collection = new Collection({storage: localStorage, name: 'SomeName'});
      expect(collection.list.length).to.be.equal(0);
      expect(Object.keys(collection.indexes.id).length).to.be.equal(0);
    });

    it('creates item', ()=> {
      let c1 = new Collection({storage: localStorage, name: 'items0'});
      // c1.load();
      c1.create({name: 'Some', age: 12});
      c1.persist();
      c1.load();
      expect(c1.list.length).to.be.equal(1);
      expect(Object.keys(c1.indexes.id).length).to.be.equal(1);
    });

    it('resets the collection, not the storage',()=> {
      let c1 = new Collection({storage: localStorage, name: 'items8'});
      c1.create({name: 'Some', age: 12});
      c1.create({name: 'Another', age: 13});
      c1.create({name: 'SomeOneElse', age: 12});
      c1.create({name: 'Anybody', age: 12});
      c1.persist();
      expect(c1.list.length).to.be.equal(4);
      expect(Object.keys(c1.indexes.id).length).to.be.equal(4);
      c1.reset();
      expect(c1.list.length).to.be.equal(0);
      expect(Object.keys(c1.indexes.id).length).to.be.equal(0);
      c1.load();
      expect(c1.list.length).to.be.equal(4);
      expect(Object.keys(c1.indexes.id).length).to.be.equal(4);
      c1.reset();
      c1.persist();
      c1.load();
      expect(c1.list.length).to.be.equal(0);
      expect(Object.keys(c1.indexes.id).length).to.be.equal(0);
    });

    it('allow update key fields',()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();
      expect(c1.list.length).to.be.equal(4);
      c1.update({id: 0, age: 12},{id: 10, class: 5});
      c1.persist();
      expect(c1.findById(0)).to.be.equal(undefined);
      expect(c1.findById(10)).to.be.not.equal(undefined);
    });

    it('find findOne findById', ()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();
      expect(c1.list.length).to.be.equal(4);
      expect(c1.find({age: 12}).length).to.be.equal(3);
      expect(c1.find({age: 13}).length).to.be.equal(1);
      expect(c1.find(i => i.age == 13).length).to.be.equal(1);
      expect(c1.findOne({age: 13})).to.be.deep.equal({name: 'Another', age: 13, id: 1});
      expect(c1.findOne(i => i.age == 13)).to.be.deep.equal({name: 'Another', age: 13, id: 1});
      expect(c1.findById(1)).to.be.deep.equal({name: 'Another', age: 13, id: 1});
    });

    it('update undateOne updateWithId', ()=> {
      let c1 = new Collection({storage: localStorage,  name: 'items'});
      c1.load();
      expect(c1.list.length).to.be.equal(4);
      c1.update({age: 12},{class: 5});
      c1.persist();
      c1.load();
      expect(c1.find({class: 5}).length).to.be.equal(3);
      c1.update({age: 13},{class: 6});
      c1.persist();
      c1.load();
      expect(c1.find({class: 6}).length).to.be.equal(1);
      c1.updateWithId(0,{name: '!!!'});
      c1.persist();
      c1.load();
      expect(c1.findById(0).name).to.be.equal('!!!');
    });

    it('remove removeOne removeWithId', ()=> {
      let c1 = new Collection({storage: localStorage,  name: 'items'});
      c1.load();
      expect(c1.list.length).to.be.equal(4);
      c1.removeOne({age: 12});
      expect(c1.list.length).to.be.equal(3);
      c1.persist();
      c1.load();
      expect(c1.find({age: 12}).length).to.be.equal(2);
      c1.remove(i=> i.age == 12);
      expect(c1.list.length).to.be.equal(1);
      c1.persist();
      c1.load();
      expect(c1.find({age: 12}).length).to.be.equal(0);
      expect(c1.find(i => i.age = 13).length).to.be.equal(1);
      c1.removeWithId(1);
      c1.persist();
      c1.load();
      expect(c1.find(i => i.age = 13).length).to.be.equal(0);
    });

    it('continue id after removing and etc',()=> {
      let c1 = new Collection({storage: localStorage,  name: 'items'});
      c1.load();
      c1.removeWithId(3);
      c1.removeWithId(1);
      let nv = c1.create({age: 100, class: 100});
      expect(nv.id).to.be.equal(4);
      c1.persist();
    });

  });

  describe('collection indexes',()=> {
    beforeEach(()=> {
      localStorage.clear();
      let c1 = new Collection({storage: localStorage, name: 'items', id: '_id', indexList: [{
        key: 'name',
      },{
        key: 'age'
      }
      ]});
      c1.create({name: 'Some', age: 12});
      c1.create({name: 'Another', age: 13});
      c1.create({name: 'Another', age: 12});
      c1.create({name: 'SomeOneElse', age: 11});
      c1.create({name: 'SomeOneElse', age: 14});
      c1.create({name: 'Anybody', age: 13});
      c1.create({name: 'Anybody', age: 1});
      c1.create({name: 'Anybody', age: 12});
      c1.persist();
    });

    it('restore all collection state',()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      expect(c1.id).to.be.equal('id');
      c1.load();
      expect(c1.id).to.be.equal('_id');
      expect(c1.indexDefs.id).to.be.equal(undefined);
      expect(c1.indexDefs._id).to.be.not.equal(undefined);
      expect(c1.indexDefs.name).to.be.not.equal(undefined);
      expect(c1.indexDefs.age).to.be.not.equal(undefined);
      expect(c1.indexes.id).to.be.equal(undefined);
      expect(c1.indexes._id).to.be.not.equal(undefined);
      expect(c1.indexes.name).to.be.not.equal(undefined);
      expect(c1.indexes.age).to.be.not.equal(undefined);
    });

    it('findBy index keys',()=> {
      let c1 = new Collection({storage: localStorage, name: 'items'});
      c1.load();

      let byName = c1.findBy('name','Anybody');
      expect(byName.length).to.be.equal(3);
      let byAge = c1.findBy('age',12);
      expect(byAge.length).to.be.equal(3);
      let byId = c1.findBy('_id',1);
      expect(byId.length).to.be.equal(1);

    });

  });

});
