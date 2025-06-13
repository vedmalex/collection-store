import { describe, it, expect, beforeEach } from 'bun:test';
import { QueryEngine } from '../QueryEngine';

interface SampleDoc {
  name: string;
  age: number;
  tags: string[];
  active: boolean;
}

describe('QueryEngine', () => {
  let engine: QueryEngine<SampleDoc>;
  let docs: SampleDoc[];

  beforeEach(() => {
    engine = new QueryEngine<SampleDoc>();
    docs = [
      { name: 'Alice', age: 30, tags: ['a', 'b'], active: true },
      { name: 'Bob', age: 40, tags: ['b', 'c'], active: false },
      { name: 'Charlie', age: 40, tags: ['c', 'd'], active: true },
    ];
  });

  describe('matches', () => {
    it('should handle simple equality', () => {
      expect(engine.matches(docs[0], { name: 'Alice' })).toBe(true);
      expect(engine.matches(docs[0], { name: 'Bob' })).toBe(false);
      expect(engine.matches(docs[1], { active: false })).toBe(true);
    });

    it('should handle multiple conditions (implicit AND)', () => {
      expect(engine.matches(docs[2], { name: 'Charlie', age: 40 })).toBe(true);
      expect(engine.matches(docs[2], { name: 'Charlie', age: 30 })).toBe(false);
    });

    it('should handle the $eq operator', () => {
      expect(engine.matches(docs[0], { age: { '$eq': 30 } })).toBe(true);
      expect(engine.matches(docs[0], { age: { '$eq': 31 } })).toBe(false);
    });

    it('should handle the $ne operator', () => {
      expect(engine.matches(docs[0], { name: { '$ne': 'Bob' } })).toBe(true);
      expect(engine.matches(docs[0], { name: { '$ne': 'Alice' } })).toBe(false);
    });

    it('should handle the $gt operator', () => {
      expect(engine.matches(docs[1], { age: { '$gt': 35 } })).toBe(true);
      expect(engine.matches(docs[1], { age: { '$gt': 40 } })).toBe(false);
    });

    it('should handle the $gte operator', () => {
      expect(engine.matches(docs[1], { age: { '$gte': 40 } })).toBe(true);
      expect(engine.matches(docs[1], { age: { '$gte': 41 } })).toBe(false);
    });

    it('should handle the $lt operator', () => {
      expect(engine.matches(docs[0], { age: { '$lt': 35 } })).toBe(true);
      expect(engine.matches(docs[0], { age: { '$lt': 30 } })).toBe(false);
    });

    it('should handle the $lte operator', () => {
      expect(engine.matches(docs[0], { age: { '$lte': 30 } })).toBe(true);
      expect(engine.matches(docs[0], { age: { '$lte': 29 } })).toBe(false);
    });

    it('should handle the $in operator', () => {
      expect(engine.matches(docs[0], { name: { '$in': ['Alice', 'Zelda'] } })).toBe(true);
      expect(engine.matches(docs[0], { name: { '$in': ['Bob', 'Charlie'] } })).toBe(false);
    });

    it('should handle the $nin operator', () => {
      expect(engine.matches(docs[0], { name: { '$nin': ['Bob', 'Charlie'] } })).toBe(true);
      expect(engine.matches(docs[0], { name: { '$nin': ['Alice', 'Zelda'] } })).toBe(false);
    });

    it('should return false for unknown operators', () => {
        expect(engine.matches(docs[0], { age: { '$unknown': 123 } })).toBe(false);
    });
  });

  describe('execute', () => {
    it('should filter data based on a simple query', () => {
      const results = engine.execute(docs, { active: true });
      expect(results).toHaveLength(2);
      expect(results.map(d => d.name)).toContain('Alice');
      expect(results.map(d => d.name)).toContain('Charlie');
    });

    it('should filter data based on a query with operators', () => {
      const results = engine.execute(docs, { age: { '$gte': 40 } });
      expect(results).toHaveLength(2);
      expect(results.map(d => d.name)).toContain('Bob');
      expect(results.map(d => d.name)).toContain('Charlie');
    });

    it('should return an empty array if no documents match', () => {
      const results = engine.execute(docs, { name: 'Zelda' });
      expect(results).toEqual([]);
    });
  });
});