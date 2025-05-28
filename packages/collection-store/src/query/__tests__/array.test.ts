import { describe, it, expect } from 'bun:test';
import { AllOperator, ElemMatchOperator, SizeOperator } from '../array';
import { QueryOperatorError } from '../types';
import { compileQuery } from '../compile_query';

describe('Array Operators', () => {
  describe('AllOperator ($all)', () => {

    it('should return true if array contains all specified values (BSON comparison)', () => {
      const date1 = new Date(2023, 0, 1);
      const date2 = new Date(2023, 0, 2);
      const queryArray = [1, 'a', date1, null];
      const op = new AllOperator(queryArray);

      // Exact match + extra
      expect(op.evaluate([1, 'a', new Date(2023, 0, 1), null, true])).toBe(true);
      // Different order
      expect(op.evaluate([null, date1, 3, 'a', 1])).toBe(true);
      // Exact match
      expect(op.evaluate([1, 'a', date1, null])).toBe(true);
      // Duplicate values in target array
      expect(op.evaluate([1, 1, 'a', date1, date1, null, null])).toBe(true);
    });

    it('should return false if array does not contain all specified values (BSON comparison)', () => {
      const date1 = new Date(2023, 0, 1);
      const queryArray = [1, 'a', date1, true];
      const op = new AllOperator(queryArray);

      // Missing 'true'
      expect(op.evaluate([1, 'a', date1])).toBe(false);
      // Missing 'a'
      expect(op.evaluate([1, date1, true])).toBe(false);
      // Missing '1'
      expect(op.evaluate(['a', date1, true])).toBe(false);
      // Empty array cannot contain values
      expect(op.evaluate([])).toBe(false);
      // Wrong type (string '1' vs number 1)
      expect(op.evaluate(['1', 'a', date1, true])).toBe(false);
    });

    it('should handle non-array field values according to MongoDB behavior', () => {
      // Matches only if query array has exactly one element equal to the field value
      const op1 = new AllOperator([5]);
      expect(op1.evaluate(5)).toBe(true);
      expect(op1.evaluate(6)).toBe(false);
      expect(op1.evaluate('5')).toBe(false); // BSON compare

      const op2 = new AllOperator([5, 6]);
      expect(op2.evaluate(5)).toBe(false); // Query array has more than one element

      const opNull = new AllOperator([null]);
      expect(opNull.evaluate(null)).toBe(true);

      const opEmptyQuery = new AllOperator([]);
      expect(opEmptyQuery.evaluate(5)).toBe(false); // Query array must have 1 element

      // Target is null/undefined
      const opForNull = new AllOperator([1]);
      expect(opForNull.evaluate(null)).toBe(false);
      expect(opForNull.evaluate(undefined)).toBe(false);
    });

    it('should handle empty query array (matches any array, including empty)', () => {
        // MongoDB $all: [] matches arrays
        const op = new AllOperator([]);
        expect(op.evaluate([1, 2])).toBe(true);
        expect(op.evaluate([])).toBe(true);
        // But should not match non-arrays based on our non-array handling logic
        expect(op.evaluate(null)).toBe(false);
        expect(op.evaluate(1)).toBe(false);
    });

    it('should throw error if constructor argument is not an array', () => {
      expect(() => new AllOperator(1 as any)).toThrow(QueryOperatorError);
      expect(() => new AllOperator('test' as any)).toThrow(QueryOperatorError);
      expect(() => new AllOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new AllOperator(null as any)).toThrow(QueryOperatorError);
    });

  });

  describe('ElemMatchOperator ($elemMatch)', () => {

    // Helper function to compile $elemMatch queries for testing
    const compileElemMatch = (field: string, condition: object) => {
      const query = { [field]: { $elemMatch: condition } };
      const compiled = compileQuery(query);
      if (compiled.error) {
        throw new Error(`Compilation failed: ${compiled.error}`);
      }
      return compiled.func;
    };

    it('should return true if at least one element matches the condition', () => {
      // Test: db.coll.find({ scores: { $elemMatch: { $gt: 5 } } })
      const testFuncGt = compileElemMatch('scores', { $gt: 5 });
      expect(testFuncGt({ scores: [1, 6, 3] })).toBe(true);
      expect(testFuncGt({ scores: [1, 5, 3] })).toBe(false); // 5 is not > 5

      // Test: db.coll.find({ tags: { $elemMatch: { $eq: 'a' } } })
      const testFuncEq = compileElemMatch('tags', { $eq: 'a' });
      expect(testFuncEq({ tags: ['b', 'c', 'a'] })).toBe(true);
      expect(testFuncEq({ tags: ['b', 'c'] })).toBe(false);

       // Test: db.coll.find({ items: { $elemMatch: { value: { $gt: 10 } } } })
       const testFuncNested = compileElemMatch('items', { value: { $gt: 10 } });
       expect(testFuncNested({ items: [{ value: 5 }, { value: 12 }, { value: 8 }] })).toBe(true);
       expect(testFuncNested({ items: [{ value: 5 }, { value: 9 }] })).toBe(false);
    });

    it('should return true if multiple elements match the condition', () => {
      const testFuncGt = compileElemMatch('scores', { $gt: 5 });
      expect(testFuncGt({ scores: [1, 6, 7, 3] })).toBe(true); // 6 and 7 match
    });

    it('should return false if no element matches the condition', () => {
      const testFuncGt = compileElemMatch('scores', { $gt: 10 });
      expect(testFuncGt({ scores: [1, 6, 3] })).toBe(false);

      const testFuncEq = compileElemMatch('tags', { $eq: 'z' });
      expect(testFuncEq({ tags: ['b', 'c', 'a'] })).toBe(false);

      const testFuncNested = compileElemMatch('items', { value: { $gt: 10 } });
       expect(testFuncNested({ items: [{ value: 5 }, { value: 9 }] })).toBe(false);
    });

    // Note: Complex element matching (e.g., objects with multiple fields) is implicitly tested
    // by using compileQuery, which handles nested structures.

    it('should return false if the target field is not an array', () => {
      const testFunc = compileElemMatch('field', { $eq: 1 }); // Condition doesn't matter much here
      expect(testFunc({ field: null })).toBe(false);
      // MongoDB $elemMatch returns false for undefined field, compileQuery needs the field to exist.
      // Adapt test: check for undefined field explicitly if needed or ensure field exists.
      expect(testFunc({})).toBe(false); // field is implicitly undefined
      expect(testFunc({ field: 123 })).toBe(false);
      expect(testFunc({ field: 'abc' })).toBe(false);
      expect(testFunc({ field: { a: 1 } })).toBe(false);
    });

    it('should return false for an empty array', () => {
      const testFunc = compileElemMatch('field', { $eq: 1 }); // Condition doesn't matter much here
      expect(testFunc({ field: [] })).toBe(false);
    });

    it('should return error during compilation for invalid $elemMatch condition', () => {
        // $elemMatch requires an object
        const compiledInvalidType = compileQuery({ field: { $elemMatch: 123 } });
        expect(compiledInvalidType.error).toContain('$elemMatch requires a query object');
        expect(compiledInvalidType.errorDetails).toBeInstanceOf(QueryOperatorError);

        const compiledNull = compileQuery({ field: { $elemMatch: null } });
        expect(compiledNull.error).toContain('$elemMatch requires a query object');
        expect(compiledNull.errorDetails).toBeInstanceOf(QueryOperatorError);

        const compiledArray = compileQuery({ field: { $elemMatch: [1, 2] } });
        expect(compiledArray.error).toContain('$elemMatch requires a query object');
        expect(compiledArray.errorDetails).toBeInstanceOf(QueryOperatorError);

        // $elemMatch condition cannot be empty (assuming based on previous test, adjust if behavior is different)
        const compiledEmptyObj = compileQuery({ field: { $elemMatch: {} } });
        // Check if compileQuery handles empty object as an error or allows it (MongoDB might allow it)
        // MongoDB allows `$elemMatch: {}`, so compilation should succeed without error.
        expect(compiledEmptyObj.error).toBeUndefined(); // No error should occur for empty object

        // Invalid operator within $elemMatch
        const compiledInvalidOp = compileQuery({ field: { $elemMatch: { $invalidOp: 1 } } });
        expect(compiledInvalidOp.error).toContain('Unsupported operator: $invalidOp');
        expect(compiledInvalidOp.errorDetails).toBeInstanceOf(QueryOperatorError);
    });

     it('should handle errors within the sub-query execution gracefully', () => {
       // Example: Sub-query tries to access a non-existent property
       const testFunc = compileElemMatch('items', { 'a.b': { $eq: 1 } });
       // Element { c: 2 } will cause an error when trying to access 'a.b'
       expect(testFunc({ items: [{ a: { b: 1 } }, { c: 2 }] })).toBe(true); // First element matches
       // Element { c: 2 } causes error, but doesn't stop the process, returns false for that element
       expect(testFunc({ items: [{ a: { b: 99 } }, { c: 2 }] })).toBe(false); // No element matches
       expect(testFunc({ items: [{ c: 2 }] })).toBe(false); // Only erroring element
     });

  });

  describe('SizeOperator ($size)', () => {

    it('should return true if array length matches the specified size', () => {
      const op3 = new SizeOperator(3);
      expect(op3.evaluate([1, 2, 3])).toBe(true);
      expect(op3.evaluate(['a', 'b', 'c'])).toBe(true);

      const op0 = new SizeOperator(0);
      expect(op0.evaluate([])).toBe(true);

      const op1 = new SizeOperator(1);
      expect(op1.evaluate([null])).toBe(true);
    });

    it('should return false if array length does not match the specified size', () => {
      const op3 = new SizeOperator(3);
      expect(op3.evaluate([1, 2])).toBe(false);
      expect(op3.evaluate([])).toBe(false);
      expect(op3.evaluate([1, 2, 3, 4])).toBe(false);

      const op0 = new SizeOperator(0);
      expect(op0.evaluate([1])).toBe(false);
    });

    it('should return false for non-array field values', () => {
      const op = new SizeOperator(3);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate(123)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({ length: 3 })).toBe(false); // Object with length prop is not array
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new SizeOperator(-1)).toThrow(QueryOperatorError); // Negative size
      expect(() => new SizeOperator(1.5)).toThrow(QueryOperatorError); // Non-integer size
      expect(() => new SizeOperator('3' as any)).toThrow(QueryOperatorError);
      expect(() => new SizeOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new SizeOperator({} as any)).toThrow(QueryOperatorError);
    });

  });
});