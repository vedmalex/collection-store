import { describe, it, expect } from 'bun:test';
import { AndOperator, OrOperator, NotOperator, NorOperator } from '../logical';
import { EqOperator, GtOperator, LtOperator, InOperator } from '../comparison'; // For sub-conditions
import { ExistsOperator } from '../element'; // Example with context
import { QueryOperator } from '../types'; // For type casting if needed

describe('Logical Operators', () => {
  describe('AndOperator ($and)', () => {

    it('should evaluate to true if all sub-conditions evaluate to true', () => {
      const subCondition1 = new GtOperator(5);
      const subCondition2 = new LtOperator(15);
      const op = new AndOperator([subCondition1, subCondition2]);

      expect(op.evaluate(10)).toBe(true);
    });

    it('should evaluate to false if any sub-condition evaluates to false', () => {
      const subCondition1 = new GtOperator(5);
      const subCondition2 = new LtOperator(15);
      const subCondition3 = new EqOperator(10); // This will match
      const subCondition4 = new EqOperator(12); // This will not match

      const op1 = new AndOperator([subCondition1, subCondition2, subCondition3]);
      expect(op1.evaluate(10)).toBe(true);

      const op2 = new AndOperator([subCondition1, subCondition2, subCondition4]);
      expect(op2.evaluate(10)).toBe(false); // Fails due to subCondition4

      const op3 = new AndOperator([subCondition1, new LtOperator(8)]); // 10 is not < 8
      expect(op3.evaluate(10)).toBe(false);
    });

    it('should evaluate to true for an empty array of conditions (vacuously true)', () => {
      const op = new AndOperator([]);
      expect(op.evaluate(10)).toBe(true);
      expect(op.evaluate(null)).toBe(true);
      expect(op.evaluate({})).toBe(true);
    });

    it('should pass context to sub-conditions if needed', () => {
        // Example: { $and: [ { a: { $gt: 5 } }, { b: { $exists: true } } ] }
        // Note: This requires the evaluation engine to handle field targeting.
        // The AndOperator itself just passes the context down.

        // Let's simulate conditions that use context indirectly
        const conditionA_Gt5: QueryOperator = {
            type: 'comparison',
            evaluate: (value: any, context: any) => new GtOperator(5).evaluate(context?.a)
        };
        const conditionB_Exists: QueryOperator = {
            type: 'element',
            evaluate: (value: any, context: any) => new ExistsOperator(true).evaluate(context?.b)
        };

        const op = new AndOperator([conditionA_Gt5, conditionB_Exists]);

        expect(op.evaluate(null, { a: 10, b: 'exists' })).toBe(true);
        expect(op.evaluate(null, { a: 3, b: 'exists' })).toBe(false); // a not > 5
        expect(op.evaluate(null, { a: 10 })).toBe(false); // b does not exist
    });

    it('should throw error if constructor value is not an array', () => {
        expect(() => new AndOperator(1 as any)).toThrow('$and requires an array of conditions');
        expect(() => new AndOperator({} as any)).toThrow('$and requires an array of conditions');
    });

    it('should throw error if array elements are not objects (potential QueryOperators)', () => {
        const validOp = new EqOperator(1);
        expect(() => new AndOperator([validOp, 1] as any)).toThrow('Each condition in $and must be an object');
        expect(() => new AndOperator([null] as any)).toThrow('Each condition in $and must be an object');
        expect(() => new AndOperator([validOp, undefined] as any)).toThrow('Each condition in $and must be an object');
    });

  });

  describe('OrOperator ($or)', () => {

    it('should evaluate to true if any sub-condition evaluates to true', () => {
      const subCondition1 = new EqOperator(5);
      const subCondition2 = new GtOperator(10);
      const op = new OrOperator([subCondition1, subCondition2]);

      expect(op.evaluate(5)).toBe(true);  // Matches subCondition1
      expect(op.evaluate(12)).toBe(true); // Matches subCondition2
      expect(op.evaluate(8)).toBe(false); // Matches neither
    });

    it('should evaluate to false if all sub-conditions evaluate to false', () => {
      const subCondition1 = new LtOperator(0);
      const subCondition2 = new EqOperator('test');
      const op = new OrOperator([subCondition1, subCondition2]);

      expect(op.evaluate(5)).toBe(false);
      expect(op.evaluate('hello')).toBe(false);
      expect(op.evaluate(null)).toBe(true);
    });

    it('should evaluate to false for an empty array of conditions (vacuously false)', () => {
        // Logical OR is vacuously false for zero conditions
        const op = new OrOperator([]);
        expect(op.evaluate(10)).toBe(false);
        expect(op.evaluate(null)).toBe(false);
        expect(op.evaluate({})).toBe(false);
    });

    it('should pass context to sub-conditions if needed', () => {
        // Example: { $or: [ { a: { $lt: 5 } }, { b: { $exists: true } } ] }
        const conditionA_Lt5: QueryOperator = {
            type: 'comparison',
            evaluate: (value: any, context: any) => new LtOperator(5).evaluate(context?.a)
        };
        const conditionB_Exists: QueryOperator = {
            type: 'element',
            evaluate: (value: any, context: any) => new ExistsOperator(true).evaluate(context?.b)
        };

        const op = new OrOperator([conditionA_Lt5, conditionB_Exists]);

        expect(op.evaluate(null, { a: 3 })).toBe(true); // a < 5
        expect(op.evaluate(null, { b: 'exists' })).toBe(true); // b exists
        expect(op.evaluate(null, { a: 10, b: 'exists' })).toBe(true); // b exists even if a is not < 5
        expect(op.evaluate(null, { a: 10 })).toBe(false); // Neither condition met
    });

    it('should throw error if constructor value is not an array', () => {
        expect(() => new OrOperator(1 as any)).toThrow('$or requires an array of conditions');
        expect(() => new OrOperator({} as any)).toThrow('$or requires an array of conditions');
    });

    it('should throw error if array elements are not objects (potential QueryOperators)', () => {
        const validOp = new EqOperator(1);
        expect(() => new OrOperator([validOp, 1] as any)).toThrow('Each condition in $or must be an object');
        expect(() => new OrOperator([null] as any)).toThrow('Each condition in $or must be an object');
        expect(() => new OrOperator([validOp, undefined] as any)).toThrow('Each condition in $or must be an object');
    });

  });

  describe('NotOperator ($not)', () => {

    it('should invert the result of the sub-condition', () => {
      // $not: { $eq: 10 }
      const subEq = new EqOperator(10);
      const opEq = new NotOperator(subEq);
      expect(opEq.evaluate(10)).toBe(false); // !(10 == 10)
      expect(opEq.evaluate(11)).toBe(true);  // !(11 == 10)
      expect(opEq.evaluate(null)).toBe(true); // !(null == 10)

      // $not: { $gt: 10 }
      const subGt = new GtOperator(10);
      const opGt = new NotOperator(subGt);
      expect(opGt.evaluate(15)).toBe(false); // !(15 > 10)
      expect(opGt.evaluate(10)).toBe(true);  // !(10 > 10)
      expect(opGt.evaluate(5)).toBe(true);   // !(5 > 10)
    });

    it('should work with regex sub-condition', () => {
      // $not: { $in: [/^a/, /^b/] }
      const subInRegex = new InOperator([/^a/i, /^b/i]);
      const opNotRegex = new NotOperator(subInRegex);

      expect(opNotRegex.evaluate('Apple')).toBe(false); // Matches /^a/i
      expect(opNotRegex.evaluate('Banana')).toBe(false); // Matches /^b/i
      expect(opNotRegex.evaluate('Cherry')).toBe(true); // No match
      expect(opNotRegex.evaluate(null)).toBe(true); // null doesn't match regex
    });

     it('should pass context to sub-condition if needed', () => {
        // Example: { a: { $not: { $exists: true } } }
        // Simulating the condition application part
        const conditionA_NotExists: QueryOperator = {
            type: 'logical',
            evaluate: (value: any, context: any) => {
                const subExists = new ExistsOperator(true);
                const opNot = new NotOperator(subExists);
                return opNot.evaluate(context?.a, context); // Pass field value (a) to evaluate
            }
        };

        expect(conditionA_NotExists.evaluate(null, { a: 10 })).toBe(false); // a exists -> exists=true -> not=false
        expect(conditionA_NotExists.evaluate(null, { b: 10 })).toBe(true); // a undef -> exists=false -> not=true
        expect(conditionA_NotExists.evaluate(null, { a: null })).toBe(false); // a is null -> exists=true -> not=false
    });

    it('should throw error if constructor value is not an object', () => {
      const expectedMsg = '$not requires a valid QueryOperator object condition';
      expect(() => new NotOperator(1 as any)).toThrow(expectedMsg);
      expect(() => new NotOperator(null as any)).toThrow(expectedMsg);
      expect(() => new NotOperator('test' as any)).toThrow(expectedMsg);
      expect(() => new NotOperator([] as any)).toThrow(expectedMsg);
    });

  });

  describe('NorOperator ($nor)', () => {

    it('should evaluate to true if all sub-conditions evaluate to false', () => {
      const subCondition1 = new LtOperator(0);
      const subCondition2 = new EqOperator('test');
      const op = new NorOperator([subCondition1, subCondition2]);

      expect(op.evaluate(5)).toBe(true);
      expect(op.evaluate('hello')).toBe(true);
      expect(op.evaluate(null)).toBe(false);
    });

    it('should evaluate to false if any sub-condition evaluates to true', () => {
      const subCondition1 = new EqOperator(5);
      const subCondition2 = new GtOperator(10);
      const op = new NorOperator([subCondition1, subCondition2]);

      expect(op.evaluate(5)).toBe(false);  // Matches subCondition1
      expect(op.evaluate(12)).toBe(false); // Matches subCondition2
      expect(op.evaluate(8)).toBe(true);   // Matches neither
    });

    it('should evaluate to true for an empty array of conditions (vacuously true)', () => {
        // NOR is true if none of the conditions match. If there are no conditions, none match.
        const op = new NorOperator([]);
        expect(op.evaluate(10)).toBe(true);
        expect(op.evaluate(null)).toBe(true);
        expect(op.evaluate({})).toBe(true);
    });

    it('should pass context to sub-conditions if needed', () => {
        // Example: { $nor: [ { a: { $lt: 5 } }, { b: { $exists: true } } ] }
        const conditionA_Lt5: QueryOperator = {
            type: 'comparison',
            evaluate: (value: any, context: any) => new LtOperator(5).evaluate(context?.a)
        };
        const conditionB_Exists: QueryOperator = {
            type: 'element',
            evaluate: (value: any, context: any) => new ExistsOperator(true).evaluate(context?.b)
        };

        const op = new NorOperator([conditionA_Lt5, conditionB_Exists]);

        expect(op.evaluate(null, { a: 3 })).toBe(false); // a < 5 -> NOR is false
        expect(op.evaluate(null, { b: 'exists' })).toBe(false); // b exists -> NOR is false
        expect(op.evaluate(null, { a: 10, b: 'exists' })).toBe(false); // b exists -> NOR is false
        expect(op.evaluate(null, { a: 10 })).toBe(true); // Neither condition met -> NOR is true
    });

    it('should throw error if constructor value is not an array', () => {
        expect(() => new NorOperator(1 as any)).toThrow('$nor requires an array of conditions');
        expect(() => new NorOperator({} as any)).toThrow('$nor requires an array of conditions');
    });

    it('should throw error if array elements are not objects (potential QueryOperators)', () => {
        const validOp = new EqOperator(1);
        expect(() => new NorOperator([validOp, 1] as any)).toThrow('Each condition in $nor must be an object');
        expect(() => new NorOperator([null] as any)).toThrow('Each condition in $nor must be an object');
        expect(() => new NorOperator([validOp, undefined] as any)).toThrow('Each condition in $nor must be an object');
    });

  });

  // TODO: Add describe blocks for NorOperator
});