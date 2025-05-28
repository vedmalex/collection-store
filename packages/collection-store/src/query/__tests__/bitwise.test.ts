import { describe, it, expect } from 'bun:test';
import { BitsAllSetOperator, BitsAnySetOperator, BitsAllClearOperator, BitsAnyClearOperator } from '../bitwise';
import { QueryOperatorError } from '../types';

describe('Bitwise Operators', () => {
  describe('BitsAllSetOperator ($bitsAllSet)', () => {

    // Using Bitmask
    it('should return true if all specified bits (mask) are 1', () => {
      const op = new BitsAllSetOperator(3); // Mask 0b11
      expect(op.evaluate(0b11)).toBe(true); // 3
      expect(op.evaluate(0b1011)).toBe(true); // 11
      expect(op.evaluate(0b1111)).toBe(true); // 15
    });

    it('should return false if any specified bit (mask) is 0', () => {
      const op = new BitsAllSetOperator(3); // Mask 0b11
      expect(op.evaluate(0b01)).toBe(false); // 1
      expect(op.evaluate(0b10)).toBe(false); // 2
      expect(op.evaluate(0b1001)).toBe(false); // 9 (bit 1 is 0)
      expect(op.evaluate(0b1010)).toBe(false); // 10 (bit 0 is 0)
      expect(op.evaluate(0)).toBe(false);
    });

    // Using Position Array
    it('should return true if all specified bits (positions) are 1', () => {
      const op = new BitsAllSetOperator([0, 2]); // Mask 0b101 = 5
      expect(op.evaluate(0b101)).toBe(true); // 5
      expect(op.evaluate(0b11101)).toBe(true); // 29
    });

    it('should return false if any specified bit (position) is 0', () => {
      const op = new BitsAllSetOperator([0, 2]); // Mask 0b101 = 5
      expect(op.evaluate(0b001)).toBe(false); // 1 (bit 2 is 0)
      expect(op.evaluate(0b100)).toBe(false); // 4 (bit 0 is 0)
      expect(op.evaluate(0b110)).toBe(false); // 6 (bit 0 is 0)
      expect(op.evaluate(0b011)).toBe(false); // 3 (bit 2 is 0)
      expect(op.evaluate(0)).toBe(false);
    });

    it('should return false for non-integer or non-numeric values', () => {
      const op = new BitsAllSetOperator(2);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(1.5)).toBe(false);
      // expect(op.evaluate(BigInt(3))).toBe(false); // Bitwise ops typically require number type
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new BitsAllSetOperator(-1)).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator(1.5)).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator([-1])).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator([1.5])).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator(['a'] as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllSetOperator(BigInt(2) as any)).toThrow(QueryOperatorError);
    });

  });

  describe('BitsAnySetOperator ($bitsAnySet)', () => {

    // Using Bitmask
    it('should return true if any specified bit (mask) is 1', () => {
      const op = new BitsAnySetOperator(5); // Mask 0b101
      expect(op.evaluate(0b101)).toBe(true); // Both set
      expect(op.evaluate(0b100)).toBe(true); // Bit 2 set
      expect(op.evaluate(0b001)).toBe(true); // Bit 0 set
      expect(op.evaluate(0b111)).toBe(true); // Both set (plus bit 1)
      expect(op.evaluate(1)).toBe(true);
      expect(op.evaluate(4)).toBe(true);
      expect(op.evaluate(5)).toBe(true);
    });

    it('should return false if all specified bits (mask) are 0', () => {
      const op = new BitsAnySetOperator(5); // Mask 0b101
      expect(op.evaluate(0b010)).toBe(false); // Value 2
      expect(op.evaluate(0b10010)).toBe(false); // Value 18
      expect(op.evaluate(0)).toBe(false);
      expect(op.evaluate(2)).toBe(false);
    });

    // Using Position Array
    it('should return true if any specified bit (position) is 1', () => {
      const op = new BitsAnySetOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b1010)).toBe(true); // Both set
      expect(op.evaluate(0b1000)).toBe(true); // Bit 3 set
      expect(op.evaluate(0b0010)).toBe(true); // Bit 1 set
      expect(op.evaluate(0b1011)).toBe(true); // Bit 1 set (value 11)
      expect(op.evaluate(2)).toBe(true);
      expect(op.evaluate(8)).toBe(true);
      expect(op.evaluate(10)).toBe(true);
    });

    it('should return false if all specified bits (position) are 0', () => {
      const op = new BitsAnySetOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b0101)).toBe(false); // Value 5
      expect(op.evaluate(0b10100)).toBe(false); // Value 20
      expect(op.evaluate(0)).toBe(false);
      expect(op.evaluate(1)).toBe(false);
      expect(op.evaluate(4)).toBe(false);
    });

    it('should return false for non-integer or non-numeric values', () => {
      const op = new BitsAnySetOperator(2);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(1.5)).toBe(false);
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new BitsAnySetOperator(-1)).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator(1.5)).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator([-1])).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator([1.5])).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator(['a'] as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnySetOperator(BigInt(2) as any)).toThrow(QueryOperatorError);
    });

  });

  describe('BitsAllClearOperator ($bitsAllClear)', () => {

    // Using Bitmask
    it('should return true if all specified bits (mask) are 0', () => {
      const op = new BitsAllClearOperator(5); // Mask 0b101
      expect(op.evaluate(0b10010)).toBe(true); // Value 18
      expect(op.evaluate(0b00000)).toBe(true); // Value 0
      expect(op.evaluate(2)).toBe(true); // Value 2 (0b10)
    });

    it('should return false if any specified bit (mask) is 1', () => {
      const op = new BitsAllClearOperator(5); // Mask 0b101
      expect(op.evaluate(0b101)).toBe(false); // Value 5
      expect(op.evaluate(0b100)).toBe(false); // Value 4
      expect(op.evaluate(0b001)).toBe(false); // Value 1
      expect(op.evaluate(1)).toBe(false);
      expect(op.evaluate(4)).toBe(false);
    });

    // Using Position Array
    it('should return true if all specified bits (positions) are 0', () => {
      const op = new BitsAllClearOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b10001)).toBe(true); // Value 17
      expect(op.evaluate(1)).toBe(true);
      expect(op.evaluate(0)).toBe(true);
    });

    it('should return false if any specified bit (position) is 1', () => {
      const op = new BitsAllClearOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b1010)).toBe(false); // Value 10
      expect(op.evaluate(0b1000)).toBe(false); // Value 8
      expect(op.evaluate(0b0010)).toBe(false); // Value 2
      expect(op.evaluate(2)).toBe(false);
      expect(op.evaluate(8)).toBe(false);
      expect(op.evaluate(10)).toBe(false);
    });

    it('should return false for non-integer or non-numeric values', () => {
      const op = new BitsAllClearOperator(2);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(1.5)).toBe(false);
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new BitsAllClearOperator(-1)).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator(1.5)).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator([-1])).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator([1.5])).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator(['a'] as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAllClearOperator(BigInt(2) as any)).toThrow(QueryOperatorError);
    });

  });

  describe('BitsAnyClearOperator ($bitsAnyClear)', () => {

    // Using Bitmask
    it('should return true if any specified bit (mask) is 0', () => {
      const op = new BitsAnyClearOperator(5); // Mask 0b101
      expect(op.evaluate(0b100)).toBe(true); // Bit 0 is clear
      expect(op.evaluate(0b001)).toBe(true); // Bit 2 is clear
      expect(op.evaluate(0b000)).toBe(true); // Both clear
      expect(op.evaluate(0b1010)).toBe(true); // Bit 0 is clear (value 10)
      expect(op.evaluate(2)).toBe(true); // Value 2 (0b10), bits 0 and 2 clear
    });

    it('should return false if all specified bits (mask) are 1', () => {
      const op = new BitsAnyClearOperator(5); // Mask 0b101
      expect(op.evaluate(0b101)).toBe(false); // Value 5
      expect(op.evaluate(0b11101)).toBe(false); // Value 29
      expect(op.evaluate(5)).toBe(false);
    });

    // Using Position Array
    it('should return true if any specified bit (position) is 0', () => {
      const op = new BitsAnyClearOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b0010)).toBe(true); // Bit 3 is clear (value 2)
      expect(op.evaluate(0b1000)).toBe(true); // Bit 1 is clear (value 8)
      expect(op.evaluate(0b0000)).toBe(true); // Both clear
      expect(op.evaluate(1)).toBe(true); // Value 1
    });

    it('should return false if all specified bits (position) are 1', () => {
      const op = new BitsAnyClearOperator([1, 3]); // Mask 0b1010 = 10
      expect(op.evaluate(0b1010)).toBe(false); // Value 10
      expect(op.evaluate(0b11010)).toBe(false); // Value 26
      expect(op.evaluate(10)).toBe(false);
    });

    it('should return false for non-integer or non-numeric values', () => {
      const op = new BitsAnyClearOperator(2);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
      expect(op.evaluate('abc')).toBe(false);
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false);
      expect(op.evaluate(1.5)).toBe(false);
    });

    it('should throw error for invalid constructor arguments', () => {
      expect(() => new BitsAnyClearOperator(-1)).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator(1.5)).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator([-1])).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator([1.5])).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator(['a'] as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator(null as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator({} as any)).toThrow(QueryOperatorError);
      expect(() => new BitsAnyClearOperator(BigInt(2) as any)).toThrow(QueryOperatorError);
    });

  });
});