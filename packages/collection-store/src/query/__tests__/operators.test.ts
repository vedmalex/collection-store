import { describe, expect, it } from 'bun:test';
import {
  AndOperator,
  OrOperator,
  NotOperator,
  NorOperator,
  ExistsOperator,
  TypeOperator,
  AllOperator,
  ElemMatchOperator,
  SizeOperator,
  ModOperator,
  RegexOperator,
  WhereOperator,
  BitsAllSetOperator,
  BitsAnySetOperator,
  TextSearchOperatorImpl,
  QueryOperatorError,
  QueryOperator,
  QueryValue
} from '..';
import { compileQuery } from '../compile_query';

// Вспомогательная функция для создания тестового условия
function createCondition(returnValue: boolean): QueryValue {
  return {
    type: 'test',
    evaluate: () => returnValue
  } as QueryOperator;
}

describe('Logical Operators', () => {
  describe('$and', () => {
    it('should return true when all conditions are true', () => {
      const trueCondition = createCondition(true);
      const and = new AndOperator([trueCondition, trueCondition]);
      expect(and.evaluate({})).toBe(true);
    });

    it('should return false when any condition is false', () => {
      const trueCondition = createCondition(true);
      const falseCondition = createCondition(false);
      const and = new AndOperator([trueCondition, falseCondition]);
      expect(and.evaluate({})).toBe(false);
    });

    it('should throw error for invalid input', () => {
      expect(() => new AndOperator('not an array' as any)).toThrow(QueryOperatorError);
    });
  });

  // Тесты для $or
  describe('$or', () => {
    it('should return true when any condition is true', () => {
      const trueCondition = createCondition(true);
      const falseCondition = createCondition(false);
      const or = new OrOperator([falseCondition, trueCondition]);
      expect(or.evaluate({})).toBe(true);
    });

    it('should return false when all conditions are false', () => {
      const falseCondition = createCondition(false);
      const or = new OrOperator([falseCondition, falseCondition]);
      expect(or.evaluate({})).toBe(false);
    });
  });

  // Тесты для $not
  describe('$not', () => {
    it('should negate condition result', () => {
      const trueCondition = createCondition(true);
      const not = new NotOperator(trueCondition);
      expect(not.evaluate({})).toBe(false);
    });
  });

  // Тесты для $nor
  describe('$nor', () => {
    it('should return true when all conditions are false', () => {
      const falseCondition = createCondition(false);
      const nor = new NorOperator([falseCondition, falseCondition]);
      expect(nor.evaluate({})).toBe(true);
    });

    it('should return false when any condition is true', () => {
      const trueCondition = createCondition(true);
      const falseCondition = createCondition(false);
      const nor = new NorOperator([falseCondition, trueCondition]);
      expect(nor.evaluate({})).toBe(false);
    });
  });
});

describe('Element Operators', () => {
  describe('$exists', () => {
    it('should return true when field exists', () => {
      const exists = new ExistsOperator(true);
      expect(exists.evaluate('value')).toBe(true);
    });

    it('should return false when field does not exist', () => {
      const exists = new ExistsOperator(true);
      expect(exists.evaluate(undefined)).toBe(false);
    });

    it('should throw error for invalid input', () => {
      expect(() => new ExistsOperator('not a boolean' as any)).toThrow(QueryOperatorError);
    });
  });

  describe('$type', () => {
    it('should correctly identify string type', () => {
      const type = new TypeOperator('string');
      expect(type.evaluate('test')).toBe(true);
      expect(type.evaluate(123)).toBe(false);
    });

    it('should support multiple types', () => {
      const type = new TypeOperator(['string', 'number']);
      expect(type.evaluate('test')).toBe(true);
      expect(type.evaluate(123)).toBe(true);
      expect(type.evaluate(true)).toBe(false);
    });

    it('should throw error for invalid type', () => {
      expect(() => new TypeOperator('invalid' as any)).toThrow(QueryOperatorError);
    });
  });
});

describe('Array Operators', () => {
  describe('$all', () => {
    it('should return true when array contains all elements', () => {
      const all = new AllOperator([1, 2]);
      expect(all.evaluate([1, 2, 3])).toBe(true);
    });

    it('should return false when array missing elements', () => {
      const all = new AllOperator([1, 2]);
      expect(all.evaluate([1, 3])).toBe(false);
    });

    it('should throw error for non-array input', () => {
      expect(() => new AllOperator('not an array' as any)).toThrow(QueryOperatorError);
    });
  });

  describe('$elemMatch', () => {
    // Helper function to compile $elemMatch queries for testing
    const compileElemMatch = (field: string, condition: object) => {
      const query = { [field]: { $elemMatch: condition } };
      const compiled = compileQuery(query);
      if (compiled.error) {
        throw new Error(`Compilation failed: ${compiled.error}`);
      }
      return compiled.func;
    };

    it('should match array elements with condition', () => {
      // Test: db.coll.find({ items: { $elemMatch: { value: { $gt: 5 } } } })
      const testFunc = compileElemMatch('items', { value: { $gt: 5 } });
      expect(testFunc({ items: [{ value: 1 }, { value: 6 }, { value: 3 }] })).toBe(true);
      expect(testFunc({ items: [{ value: 1 }, { value: 5 }, { value: 3 }] })).toBe(false);
    });

    it('should not match when no elements satisfy condition', () => {
      // Test: db.coll.find({ items: { $elemMatch: { value: { $lt: 0 } } } })
      const testFunc = compileElemMatch('items', { value: { $lt: 0 } });
      expect(testFunc({ items: [{ value: 1 }, { value: 6 }, { value: 3 }] })).toBe(false);
    });
  });

  describe('$size', () => {
    it('should match arrays of exact size', () => {
      const size = new SizeOperator(3);
      expect(size.evaluate([1, 2, 3])).toBe(true);
      expect(size.evaluate([1, 2])).toBe(false);
    });
  });
});

describe('Evaluation Operators', () => {
  describe('$mod', () => {
    it('should correctly check modulo', () => {
      const mod = new ModOperator([3, 1]);
      expect(mod.evaluate(10)).toBe(true); // 10 % 3 = 1
      expect(mod.evaluate(9)).toBe(false); // 9 % 3 = 0
    });

    it('should throw error for invalid input', () => {
      expect(() => new ModOperator([0, 1])).toThrow(QueryOperatorError); // деление на 0
    });
  });

  describe('$regex', () => {
    it('should match pattern', () => {
      const regex = new RegexOperator('^test');
      expect(regex.evaluate('test123')).toBe(true);
      expect(regex.evaluate('123test')).toBe(false);
    });

    it('should support options', () => {
      const regex = new RegexOperator({$regex: 'TEST', $options: 'i'});
      expect(regex.evaluate('test')).toBe(true);
    });
  });

  describe('$where', () => {
    it('should evaluate function', () => {
      const whereFunc = function(this: any) { return this.value > 10; };
      const where = new WhereOperator(whereFunc);
      expect(where.evaluate(null, { value: 15 })).toBe(true);
      expect(where.evaluate(null, { value: 5 })).toBe(false);
    });
  });
});

describe('Bitwise Operators', () => {
  describe('$bitsAllSet', () => {
    it('should check if all bits are set', () => {
      const bits = new BitsAllSetOperator([1, 2]); // 110 в двоичном
      expect(bits.evaluate(6)).toBe(true);  // 110 в двоичном
      expect(bits.evaluate(4)).toBe(false); // 100 в двоичном
    });
  });

  describe('$bitsAnySet', () => {
    it('should check if any bits are set', () => {
      const bits = new BitsAnySetOperator([1, 2]); // 110 в двоичном
      expect(bits.evaluate(2)).toBe(true);  // 010 в двоичном
      expect(bits.evaluate(8)).toBe(false); // 1000 в двоичном
    });
  });
});

describe('Text Search Operator', () => {
  describe('$text', () => {
    it('should match text search', () => {
      const text = new TextSearchOperatorImpl({
        $search: 'test query',
        $caseSensitive: false
      });
      expect(text.evaluate('This is a test query string')).toBe(true);
      expect(text.evaluate('No match here')).toBe(false);
    });

    it('should respect case sensitivity', () => {
      const text = new TextSearchOperatorImpl({
        $search: 'Test',
        $caseSensitive: true
      });
      expect(text.evaluate('Test')).toBe(true);
      expect(text.evaluate('test')).toBe(false);
    });

    it('should throw error for invalid input', () => {
      expect(() => new TextSearchOperatorImpl(null as any)).toThrow(QueryOperatorError);
    });
  });
});