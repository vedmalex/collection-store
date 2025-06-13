import { describe, it, expect } from 'bun:test';
import { ExistsOperator, TypeOperator } from '../element';
import { QueryOperatorError } from '../types';

describe('Element Operators', () => {
  describe('ExistsOperator ($exists)', () => {

    describe('$exists: true', () => {
      const op = new ExistsOperator(true);

      it('should evaluate to true for defined values (string, number, boolean, object, array, null)', () => {
        expect(op.evaluate('hello')).toBe(true);
        expect(op.evaluate('')).toBe(true);
        expect(op.evaluate(0)).toBe(true);
        expect(op.evaluate(1)).toBe(true);
        expect(op.evaluate(false)).toBe(true);
        expect(op.evaluate(true)).toBe(true);
        expect(op.evaluate(null)).toBe(true);
        expect(op.evaluate({})).toBe(true);
        expect(op.evaluate([])).toBe(true);
        expect(op.evaluate(new Date())).toBe(true);
      });

      it('should evaluate to false for undefined', () => {
        expect(op.evaluate(undefined)).toBe(false);
      });
    });

    describe('$exists: false', () => {
      const op = new ExistsOperator(false);

      it('should evaluate to false for defined values (string, number, boolean, object, array, null)', () => {
        expect(op.evaluate('hello')).toBe(false);
        expect(op.evaluate('')).toBe(false);
        expect(op.evaluate(0)).toBe(false);
        expect(op.evaluate(1)).toBe(false);
        expect(op.evaluate(false)).toBe(false);
        expect(op.evaluate(true)).toBe(false);
        expect(op.evaluate(null)).toBe(false);
        expect(op.evaluate({})).toBe(false);
        expect(op.evaluate([])).toBe(false);
        expect(op.evaluate(new Date())).toBe(false);
      });

      it('should evaluate to true for undefined', () => {
        expect(op.evaluate(undefined)).toBe(true);
      });
    });

    it('should throw error if constructor value is not boolean', () => {
      expect(() => new ExistsOperator(1 as any)).toThrow(QueryOperatorError);
      expect(() => new ExistsOperator('true' as any)).toThrow(QueryOperatorError);
      expect(() => new ExistsOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new ExistsOperator({} as any)).toThrow(QueryOperatorError);
    });

  });

  describe('TypeOperator ($type)', () => {

    it('should match basic types using string alias', () => {
      expect(new TypeOperator('string').evaluate('hello')).toBe(true);
      expect(new TypeOperator('double').evaluate(1.5)).toBe(true);
      expect(new TypeOperator('int').evaluate(10)).toBe(true);
      expect(new TypeOperator('number').evaluate(10)).toBe(true);
      expect(new TypeOperator('number').evaluate(10.5)).toBe(true);
      expect(new TypeOperator('bool').evaluate(true)).toBe(true);
      expect(new TypeOperator('array').evaluate([])).toBe(true);
      expect(new TypeOperator('object').evaluate({ a: 1 })).toBe(true);
      expect(new TypeOperator('date').evaluate(new Date())).toBe(true);
      expect(new TypeOperator('null').evaluate(null)).toBe(true);
      expect(new TypeOperator('undefined').evaluate(undefined)).toBe(true);
      // BigInt
      expect(new TypeOperator('long').evaluate(BigInt(10))).toBe(true);
      expect(new TypeOperator('number').evaluate(BigInt(10))).toBe(true);
    });

    it('should not match incorrect basic types (string alias)', () => {
      expect(new TypeOperator('string').evaluate(123)).toBe(false);
      expect(new TypeOperator('double').evaluate(10)).toBe(false);
      expect(new TypeOperator('int').evaluate(10.5)).toBe(false);
      expect(new TypeOperator('bool').evaluate('true')).toBe(false);
      expect(new TypeOperator('array').evaluate({})).toBe(false);
      expect(new TypeOperator('object').evaluate([])).toBe(false);
      expect(new TypeOperator('object').evaluate(null)).toBe(false);
      expect(new TypeOperator('object').evaluate(new Date())).toBe(false);
      expect(new TypeOperator('date').evaluate('2023-01-01')).toBe(false);
      expect(new TypeOperator('null').evaluate(undefined)).toBe(false);
      expect(new TypeOperator('undefined').evaluate(null)).toBe(false);
    });

    it('should match basic types using numeric alias', () => {
      expect(new TypeOperator(2).evaluate('hello')).toBe(true); // string
      expect(new TypeOperator(1).evaluate(1.5)).toBe(true); // double
      expect(new TypeOperator(16).evaluate(10)).toBe(true); // int
      expect(new TypeOperator(18).evaluate(BigInt(10))).toBe(true); // long
      expect(new TypeOperator(8).evaluate(false)).toBe(true); // bool
      expect(new TypeOperator(4).evaluate([1, 2])).toBe(true); // array
      expect(new TypeOperator(3).evaluate({ a: 1 })).toBe(true); // object
      expect(new TypeOperator(9).evaluate(new Date())).toBe(true); // date
      expect(new TypeOperator(10).evaluate(null)).toBe(true); // null
      expect(new TypeOperator(6).evaluate(undefined)).toBe(true); // undefined
    });

    it('should match newly added types (objectId, binData, regex)', () => {
        // Assuming ObjectId representation
        const fakeObjectId = { _bsontype: 'ObjectId', id: 'someid' };
        expect(new TypeOperator('objectId').evaluate(fakeObjectId)).toBe(true);
        expect(new TypeOperator(7).evaluate(fakeObjectId)).toBe(true);
        expect(new TypeOperator('objectId').evaluate({ id: 'someid' })).toBe(false); // Missing _bsontype
        expect(new TypeOperator('object').evaluate(fakeObjectId)).toBe(false); // Object checker excludes ObjectId

        // Assuming binData representation
        const bufferData = typeof Buffer !== 'undefined' ? Buffer.from('test') : new Uint8Array();
        const uint8Data = new Uint8Array([1, 2]);
        expect(new TypeOperator('binData').evaluate(bufferData)).toBe(true);
        expect(new TypeOperator(5).evaluate(bufferData)).toBe(true);
        expect(new TypeOperator('binData').evaluate(uint8Data)).toBe(true);
        expect(new TypeOperator(5).evaluate(uint8Data)).toBe(true);
        expect(new TypeOperator('binData').evaluate('test')).toBe(false);
        expect(new TypeOperator('object').evaluate(bufferData)).toBe(false); // Object excludes binData

        // Regex
        const regex = /test/i;
        expect(new TypeOperator('regex').evaluate(regex)).toBe(true);
        expect(new TypeOperator(11).evaluate(regex)).toBe(true);
        expect(new TypeOperator('regex').evaluate('/test/i')).toBe(false);
        expect(new TypeOperator('object').evaluate(regex)).toBe(false); // Object excludes regex
    });

    it('should match if type is in an array of types', () => {
      const op = new TypeOperator(['string', 'number', 10, 'regex']); // string, number, null, or regex
      expect(op.evaluate('hello')).toBe(true);
      expect(op.evaluate(123)).toBe(true);
      expect(op.evaluate(12.3)).toBe(true);
      expect(op.evaluate(BigInt(100))).toBe(true);
      expect(op.evaluate(null)).toBe(true);
      expect(op.evaluate(/a/)).toBe(true);

      expect(op.evaluate(true)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(new Date())).toBe(false);
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new TypeOperator('unsupportedType')).toThrow(QueryOperatorError);
      expect(() => new TypeOperator(99)).toThrow(QueryOperatorError);
      expect(() => new TypeOperator(['string', 99])).toThrow(QueryOperatorError);
      expect(() => new TypeOperator([])).toThrow(QueryOperatorError);
      expect(() => new TypeOperator(true as any)).toThrow(QueryOperatorError);
      expect(() => new TypeOperator({} as any)).toThrow(QueryOperatorError);
    });

  });
});