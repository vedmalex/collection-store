import { describe, it, expect } from 'bun:test';
import { ModOperator, RegexOperator, WhereOperator } from '../evaluation';
import { QueryOperatorError } from '../types';

describe('Evaluation Operators', () => {
  describe('ModOperator ($mod)', () => {

    it('should return true if value % divisor === remainder', () => {
      const op1 = new ModOperator([4, 0]); // divisible by 4
      expect(op1.evaluate(8)).toBe(true);
      expect(op1.evaluate(0)).toBe(true);
      expect(op1.evaluate(12)).toBe(true);
      expect(op1.evaluate(-4)).toBe(true);

      const op2 = new ModOperator([5, 1]); // remainder 1 when divided by 5
      expect(op2.evaluate(6)).toBe(true);
      expect(op2.evaluate(11)).toBe(true);
      expect(op2.evaluate(1)).toBe(true);
      // Note: JS % behavior with negative numbers differs from mathematical modulo
      expect(op2.evaluate(-4)).toBe(false); // JS: -4 % 5 = -4
      expect(op2.evaluate(-9)).toBe(false); // JS: -9 % 5 = -4
    });

    it('should return false if value % divisor !== remainder', () => {
      const op1 = new ModOperator([4, 0]);
      expect(op1.evaluate(5)).toBe(false);
      expect(op1.evaluate(1)).toBe(false);
      expect(op1.evaluate(-1)).toBe(false);

      const op2 = new ModOperator([5, 1]);
      expect(op2.evaluate(5)).toBe(false);
      expect(op2.evaluate(0)).toBe(false);
      expect(op2.evaluate(7)).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      const op = new ModOperator([4, 0]);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(true)).toBe(false);
    });

    it('should work with BigInt', () => {
      const op1 = new ModOperator([BigInt(4), BigInt(0)]);
      expect(op1.evaluate(BigInt(8))).toBe(true);
      expect(op1.evaluate(8)).toBe(true); // Mix number value
      expect(op1.evaluate(BigInt(5))).toBe(false);

      const op2 = new ModOperator([4, 0]); // Number args
      expect(op2.evaluate(BigInt(12))).toBe(true); // BigInt value

      const op3 = new ModOperator([BigInt(5), 1]); // Mixed args
      expect(op3.evaluate(BigInt(6))).toBe(true);
      expect(op3.evaluate(11)).toBe(true);
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new ModOperator([0, 1])).toThrow(QueryOperatorError);
      expect(() => new ModOperator([BigInt(0), 1])).toThrow(QueryOperatorError);
      expect(() => new ModOperator([4, 0, 1] as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator([4] as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator(['a', 0] as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator([4, 'b'] as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator(1 as any)).toThrow(QueryOperatorError);
      expect(() => new ModOperator({} as any)).toThrow(QueryOperatorError);
    });

  });

  describe('RegexOperator ($regex)', () => {

    it('should match string field using RegExp object', () => {
      const op = new RegexOperator(/^abc/i);
      expect(op.evaluate('abcde')).toBe(true);
      expect(op.evaluate('ABCDE')).toBe(true);
      expect(op.evaluate('Xabcde')).toBe(false);
    });

    it('should match string field using string pattern (no flags)', () => {
      const op = new RegexOperator('^abc');
      expect(op.evaluate('abcde')).toBe(true);
      expect(op.evaluate('ABCDE')).toBe(false); // Case-sensitive
      expect(op.evaluate('Xabcde')).toBe(false);
    });

    it('should match string field using object notation with options', () => {
      const op = new RegexOperator({ $regex: '^abc', $options: 'i' });
      expect(op.evaluate('abcde')).toBe(true);
      expect(op.evaluate('ABCDE')).toBe(true);
      expect(op.evaluate('Xabcde')).toBe(false);
    });

    it('should match string field using object notation without options', () => {
      const op = new RegexOperator({ $regex: 'abc$' });
      expect(op.evaluate('xyzabc')).toBe(true);
      expect(op.evaluate('xyzABC')).toBe(false); // Case-sensitive
      expect(op.evaluate('abcxyz')).toBe(false);
    });

    it('should return false for non-string field values (MongoDB behavior)', () => {
      const op = new RegexOperator(/^123/);
      expect(op.evaluate(12345)).toBe(false); // Number field does not match
      expect(op.evaluate(12)).toBe(false);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate(true)).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
    });

    it('should throw error for invalid constructor arguments', () => {
        // Invalid regex pattern string
        expect(() => new RegexOperator('[')).toThrow(QueryOperatorError);
        // Invalid regex pattern in object
        expect(() => new RegexOperator({ $regex: '[', $options: 'i' })).toThrow(QueryOperatorError);
        // Invalid options flag
        expect(() => new RegexOperator({ $regex: '^abc', $options: '!' })).toThrow(QueryOperatorError);
        // Invalid main argument type
        expect(() => new RegexOperator(123 as any)).toThrow(QueryOperatorError);
        expect(() => new RegexOperator(null as any)).toThrow(QueryOperatorError);
        expect(() => new RegexOperator({} as any)).toThrow(QueryOperatorError);
        // Invalid $regex property type
        expect(() => new RegexOperator({ $regex: 123 } as any)).toThrow(QueryOperatorError);
        // Invalid $options property type
        expect(() => new RegexOperator({ $regex: 'abc', $options: 1 } as any)).toThrow(QueryOperatorError);
    });

  });

  describe('WhereOperator ($where)', () => {

    it("should evaluate function using document context ('this' and 'obj')", () => {
      const opFuncThis = new WhereOperator(function() { return this.a === this.b; });
      expect(opFuncThis.evaluate(null, { a: 5, b: 5 })).toBe(true);
      expect(opFuncThis.evaluate(null, { a: 5, b: 6 })).toBe(false);

      const opFuncObj = new WhereOperator(function(obj) { return obj.a + obj.b === 10; });
      expect(opFuncObj.evaluate(null, { a: 3, b: 7 })).toBe(true);
      expect(opFuncObj.evaluate(null, { a: 3, b: 8 })).toBe(false);
    });

    it("should evaluate string expression using document context ('this' and 'obj')", () => {
      // Note: String-based $where usually warns due to security/performance

      const opStrThis = new WhereOperator('this.a === this.b');
      expect(opStrThis.evaluate(null, { a: 5, b: 5 })).toBe(true);
      expect(opStrThis.evaluate(null, { a: 5, b: 6 })).toBe(false);

      const opStrObj = new WhereOperator('obj.a + obj.b === 10');
      expect(opStrObj.evaluate(null, { a: 4, b: 6 })).toBe(true);
      expect(opStrObj.evaluate(null, { a: 4, b: 7 })).toBe(false);
    });

    it('should return false if context is not a valid object', () => {
      const op = new WhereOperator(function() { return true; });
      expect(op.evaluate(null, null)).toBe(false);
      expect(op.evaluate(null, undefined)).toBe(false);
      expect(op.evaluate(null, 123)).toBe(false);
      expect(op.evaluate(null, 'test')).toBe(false);
      // Array context might work if the function expects an array
      // expect(op.evaluate(null, [])).toBe(true); // Depends on function logic
    });

    it('should return false if function/expression throws an error', () => {
      const opFunc = new WhereOperator(function() { throw new Error('Test fail'); });
      expect(opFunc.evaluate(null, { a: 1 })).toBe(false);

      const opStr = new WhereOperator('obj.nonExistent.property === 1'); // Throws TypeError
      expect(opStr.evaluate(null, { a: 1 })).toBe(false);
    });

    it('should throw error for invalid constructor argument types', () => {
      expect(() => new WhereOperator(123 as any)).toThrow(QueryOperatorError);
      expect(() => new WhereOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new WhereOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new WhereOperator([] as any)).toThrow(QueryOperatorError);
    });

    it('should throw error for invalid string expression syntax', () => {
      expect(() => new WhereOperator('this.a ===')).toThrow(QueryOperatorError); // Syntax error
    });

  });
});