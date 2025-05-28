import { describe, it, expect } from 'bun:test';
// Import the specific functions to test
import { deepCompare, compareBSONValues } from '../comparison';
// Import the operator classes for their tests
import { EqOperator, NeOperator, GtOperator, GteOperator, LtOperator, LteOperator, InOperator, NinOperator } from '../comparison';

// --- Tests for Utility Functions --- //
describe('Comparison Utilities', () => {
    describe('deepCompare', () => {
        it('should return true for identical primitive values', () => {
            expect(deepCompare(1, 1)).toBe(true);
            expect(deepCompare('a', 'a')).toBe(true);
            expect(deepCompare(true, true)).toBe(true);
            expect(deepCompare(null, null)).toBe(true);
            expect(deepCompare(undefined, undefined)).toBe(true);
        });

        it('should return false for different primitive values', () => {
            expect(deepCompare(1, 2)).toBe(false);
            expect(deepCompare('a', 'b')).toBe(false);
            expect(deepCompare(true, false)).toBe(false);
            expect(deepCompare(null, undefined)).toBe(false);
            expect(deepCompare(0, false)).toBe(false);
            expect(deepCompare(1, '1')).toBe(false);
        });

        it('should return true for identical Date objects', () => {
            const date1 = new Date(2024, 5, 20, 10, 30, 0);
            const date2 = new Date(2024, 5, 20, 10, 30, 0);
            expect(deepCompare(date1, date2)).toBe(true);
        });

        it('should return false for different Date objects', () => {
            const date1 = new Date(2024, 5, 20, 10, 30, 0);
            const date3 = new Date(2024, 5, 20, 10, 30, 1);
            expect(deepCompare(date1, date3)).toBe(false);
        });

        it('should return true for identical arrays (shallow & nested)', () => {
            expect(deepCompare([], [])).toBe(true);
            expect(deepCompare([1, 2, 3], [1, 2, 3])).toBe(true);
            expect(deepCompare(['a', null, true], ['a', null, true])).toBe(true);
            const date = new Date();
            expect(deepCompare([date], [new Date(date.getTime())])).toBe(true); // Compare by value
            expect(deepCompare([[1], [2]], [[1], [2]])).toBe(true);
            expect(deepCompare([1, ['a', null]], [1, ['a', null]])).toBe(true);
        });

        it('should return false for arrays with different lengths', () => {
            expect(deepCompare([1, 2], [1, 2, 3])).toBe(false);
            expect(deepCompare([1, 2, 3], [1, 2])).toBe(false);
        });

        it('should return false for arrays with different elements', () => {
            expect(deepCompare([1, 2, 3], [1, 2, 4])).toBe(false);
            expect(deepCompare(['a', 'b'], ['a', 'c'])).toBe(false);
            expect(deepCompare([null], [undefined])).toBe(false);
            expect(deepCompare([[1], [2]], [[1], [3]])).toBe(false);
            const date1 = new Date(); const date2 = new Date(date1.getTime()+1);
            expect(deepCompare([date1], [date2])).toBe(false);
            expect(deepCompare([1, {'a': 1}], [1, {'a': 2}])).toBe(false); // Objects inside array (if obj compare added later)
        });

        it('should return false when comparing array with non-array', () => {
            expect(deepCompare([], {})).toBe(false);
            expect(deepCompare([1], 1)).toBe(false);
            expect(deepCompare([1], '[1]')).toBe(false);
        });

        // Object comparison tests (currently deepCompare returns false for non-identical objects)
        it('should return false for different objects', () => {
             expect(deepCompare({}, {})).toBe(false); // Not identical references
             expect(deepCompare({a: 1}, {a: 1})).toBe(false);
        });
         it('should return true for identical objects (same reference)', () => {
             const obj = {a: 1};
             expect(deepCompare(obj, obj)).toBe(true);
         });
    });

    describe('compareBSONValues', () => {
        it('should return null if either argument is undefined', () => {
            expect(compareBSONValues(undefined, 1)).toBeNull();
            expect(compareBSONValues(1, undefined)).toBeNull();
            expect(compareBSONValues(undefined, null)).toBeNull();
            expect(compareBSONValues(null, undefined)).toBeNull();
            expect(compareBSONValues(undefined, 'a')).toBeNull();
            expect(compareBSONValues('a', undefined)).toBeNull();
        });

        it('should return 0 for undefined vs undefined', () => {
            // This relies on the specific check `v1 === undefined && v2 === undefined`
            expect(compareBSONValues(undefined, undefined)).toBe(0);
        });

        it('should return 0 for deeply equal values (primitives, dates, arrays)', () => {
            expect(compareBSONValues(1, 1)).toBe(0);
            expect(compareBSONValues('a', 'a')).toBe(0);
            expect(compareBSONValues(null, null)).toBe(0);
            const date = new Date();
            expect(compareBSONValues(date, new Date(date.getTime()))).toBe(0);
            expect(compareBSONValues([1, 'a'], [1, 'a'])).toBe(0);
            expect(compareBSONValues([], [])).toBe(0);
        });

        it('should compare numbers correctly', () => {
            expect(compareBSONValues(1, 2)).toBe(-1);
            expect(compareBSONValues(2, 1)).toBe(1);
            expect(compareBSONValues(1.1, 1.2)).toBe(-1);
            expect(compareBSONValues(1.2, 1.1)).toBe(1);
            expect(compareBSONValues(-1, 1)).toBe(-1);
            expect(compareBSONValues(1, -1)).toBe(1);
        });

        it('should compare strings correctly', () => {
            expect(compareBSONValues('a', 'b')).toBe(-1);
            expect(compareBSONValues('b', 'a')).toBe(1);
            expect(compareBSONValues('apple', 'apply')).toBe(-1);
        });

        it('should compare dates correctly', () => {
            const d1 = new Date(2020, 1, 1);
            const d2 = new Date(2021, 1, 1);
            expect(compareBSONValues(d1, d2)).toBe(-1);
            expect(compareBSONValues(d2, d1)).toBe(1);
        });

        it('should compare booleans correctly (false < true)', () => {
            expect(compareBSONValues(false, true)).toBe(-1);
            expect(compareBSONValues(true, false)).toBe(1);
        });

        it('should compare arrays element-wise based on BSON order', () => {
            expect(compareBSONValues([1, 2], [1, 3])).toBe(-1); // 2 < 3
            expect(compareBSONValues([1, 3], [1, 2])).toBe(1); // 3 > 2
            expect(compareBSONValues([1, 'a'], [1, 'b'])).toBe(-1); // 'a' < 'b'
            expect(compareBSONValues([1, 'b'], [1, 'a'])).toBe(1); // 'b' > 'a'
            expect(compareBSONValues([1, 2], [1, 'a'])).toBe(-1); // number < string
            expect(compareBSONValues([1, 'a'], [1, 2])).toBe(1); // string > number
            expect(compareBSONValues([1, null], [1, 2])).toBe(-1); // null < number
            expect(compareBSONValues([1, [2]], [1, [3]])).toBe(-1); // nested [2] < [3]
        });

        it('should compare arrays by length if elements are equal', () => {
            expect(compareBSONValues([1, 2], [1, 2, 3])).toBe(-1);
            expect(compareBSONValues([1, 2, 3], [1, 2])).toBe(1);
            expect(compareBSONValues([], [1])).toBe(-1);
            expect(compareBSONValues([1], [])).toBe(1);
        });

        it('should compare different types based on BSON order', () => {
            // Order: null(1) < number(2) < string(3) < object(4) < array(5) < boolean(8) < date(9)
            expect(compareBSONValues(null, 0)).toBe(-1);
            expect(compareBSONValues(0, null)).toBe(1);

            expect(compareBSONValues(100, 'abc')).toBe(-1);
            expect(compareBSONValues('abc', 100)).toBe(1);

            expect(compareBSONValues('zzz', {})).toBe(-1);
            expect(compareBSONValues({}, 'zzz')).toBe(1);

            expect(compareBSONValues({}, [])).toBe(-1);
            expect(compareBSONValues([], {})).toBe(1);

            expect(compareBSONValues([], false)).toBe(-1);
            expect(compareBSONValues(true, [])).toBe(1);

            expect(compareBSONValues(true, new Date())).toBe(-1);
            expect(compareBSONValues(new Date(), false)).toBe(1);
        });

        it('should return 0 for objects (considered equal for ordering)', () => {
            // Note: deepCompare handles actual equality check elsewhere.
            expect(compareBSONValues({a: 1}, {b: 2})).toBe(0);
            expect(compareBSONValues({}, {a: 1})).toBe(0);
        });
    });
});

// --- Tests for Operator Classes --- //
describe('Comparison Operators', () => {
  describe('EqOperator ($eq)', () => {
    it('should create an EqOperator instance', () => {
      const op = new EqOperator(1);
      expect(op).toBeInstanceOf(EqOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true for equal values', () => {
      // Test with number
      const opNum = new EqOperator(1);
      expect(opNum.evaluate(1)).toBe(true);

      // Test with string
      const opStr = new EqOperator('hello');
      expect(opStr.evaluate('hello')).toBe(true);

      // Test with boolean
      const opBool = new EqOperator(true);
      expect(opBool.evaluate(true)).toBe(true);

      // Test with null
      const opNull = new EqOperator(null);
      expect(opNull.evaluate(null)).toBe(true);

      // Test with Date objects
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20);
      const opDate = new EqOperator(date1);
      expect(opDate.evaluate(date2)).toBe(true);

      // Test with arrays
      const opArr = new EqOperator([1, 'a']);
      expect(opArr.evaluate([1, 'a'])).toBe(true);
    });

    it('should evaluate to false for non-equal values', () => {
      // Test with different number
      const opNum = new EqOperator(1);
      expect(opNum.evaluate(2)).toBe(false);

      // Test with different string
      const opStr = new EqOperator('hello');
      expect(opStr.evaluate('world')).toBe(false);

      // Test with different boolean
      const opBool = new EqOperator(true);
      expect(opBool.evaluate(false)).toBe(false);

       // Test with different Date objects
      const date1 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 21);
      const opDate = new EqOperator(date1);
      expect(opDate.evaluate(date3)).toBe(false);

       // Test with different arrays
      const opArr = new EqOperator([1, 'a']);
      expect(opArr.evaluate([1, 'b'])).toBe(false);
      expect(opArr.evaluate([1])).toBe(false);
    });

    it('should evaluate to false for different types', () => {
        // $eq uses deepCompare, which is strict
        const opNum = new EqOperator(1);
        expect(opNum.evaluate('1')).toBe(false);
        expect(opNum.evaluate(true)).toBe(false);
        expect(opNum.evaluate(null)).toBe(false);

        const opStr = new EqOperator('true');
        expect(opStr.evaluate(true)).toBe(false);

        const opNull = new EqOperator(null);
        expect(opNull.evaluate(undefined)).toBe(false);

        const opArr = new EqOperator([]);
        expect(opArr.evaluate({})).toBe(false);
    });

    it('should handle undefined correctly (matching MongoDB $eq behavior)', () => {
        const opUndefQuery = new EqOperator(undefined);
        expect(opUndefQuery.evaluate(undefined)).toBe(true);
        expect(opUndefQuery.evaluate(null)).toBe(false);
        expect(opUndefQuery.evaluate(1)).toBe(false);

        const opDefinedQuery = new EqOperator(1);
        expect(opDefinedQuery.evaluate(undefined)).toBe(false);

        const opNullQuery = new EqOperator(null);
        expect(opNullQuery.evaluate(undefined)).toBe(false);
    });
  });

  describe('NeOperator ($ne)', () => {
    it('should create an NeOperator instance', () => {
      const op = new NeOperator(1);
      expect(op).toBeInstanceOf(NeOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to false for equal values', () => {
      const opNum = new NeOperator(1);
      expect(opNum.evaluate(1)).toBe(false);
      const opStr = new NeOperator('hello');
      expect(opStr.evaluate('hello')).toBe(false);
      const opBool = new NeOperator(true);
      expect(opBool.evaluate(true)).toBe(false);
      const opNull = new NeOperator(null);
      expect(opNull.evaluate(null)).toBe(false);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20);
      const opDate = new NeOperator(date1);
      expect(opDate.evaluate(date2)).toBe(false);
      const opArr = new NeOperator([1, 'a']);
      expect(opArr.evaluate([1, 'a'])).toBe(false);
    });

    it('should evaluate to true for non-equal values', () => {
      const opNum = new NeOperator(1);
      expect(opNum.evaluate(2)).toBe(true);
      const opStr = new NeOperator('hello');
      expect(opStr.evaluate('world')).toBe(true);
      const opBool = new NeOperator(true);
      expect(opBool.evaluate(false)).toBe(true);
      const date1 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 21);
      const opDate = new NeOperator(date1);
      expect(opDate.evaluate(date3)).toBe(true);
      const opArr = new NeOperator([1, 'a']);
      expect(opArr.evaluate([1, 'b'])).toBe(true);
    });

    it('should evaluate to true for different types', () => {
        // $ne uses deepCompare
        const opNum = new NeOperator(1);
        expect(opNum.evaluate('1')).toBe(true);
        expect(opNum.evaluate(true)).toBe(true);
        expect(opNum.evaluate(null)).toBe(true);
        const opNull = new NeOperator(null);
        expect(opNull.evaluate(undefined)).toBe(true);
        const opArr = new NeOperator([]);
        expect(opArr.evaluate({})).toBe(true);
    });

    it('should handle undefined correctly (matching MongoDB $ne behavior)', () => {
        const opUndefQuery = new NeOperator(undefined);
        expect(opUndefQuery.evaluate(undefined)).toBe(false);
        expect(opUndefQuery.evaluate(null)).toBe(true);
        expect(opUndefQuery.evaluate(1)).toBe(true);

        const opDefinedQuery = new NeOperator(1);
        expect(opDefinedQuery.evaluate(undefined)).toBe(true);
        expect(opDefinedQuery.evaluate(1)).toBe(false);
        expect(opDefinedQuery.evaluate(2)).toBe(true);

        const opNullQuery = new NeOperator(null);
        expect(opNullQuery.evaluate(undefined)).toBe(true);
        expect(opNullQuery.evaluate(null)).toBe(false);
    });
  });

  describe('GtOperator ($gt)', () => {
    it('should create a GtOperator instance', () => {
      const op = new GtOperator(10);
      expect(op).toBeInstanceOf(GtOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true when value > queryValue (same type)', () => {
      const opNum = new GtOperator(10);
      expect(opNum.evaluate(11)).toBe(true);
      const opStr = new GtOperator('apple');
      expect(opStr.evaluate('banana')).toBe(true);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 21);
      const opDate = new GtOperator(date1);
      expect(opDate.evaluate(date2)).toBe(true);
      const opArr = new GtOperator([1, 2]);
      expect(opArr.evaluate([1, 3])).toBe(true);
      expect(opArr.evaluate([2])).toBe(true);
    });

    it('should evaluate to false when value <= queryValue (same type)', () => {
      const opNum = new GtOperator(10);
      expect(opNum.evaluate(10)).toBe(false);
      expect(opNum.evaluate(9)).toBe(false);
      const opStr = new GtOperator('banana');
      expect(opStr.evaluate('banana')).toBe(false);
      expect(opStr.evaluate('apple')).toBe(false);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 19);
      const opDate = new GtOperator(date1);
      expect(opDate.evaluate(date2)).toBe(false);
      expect(opDate.evaluate(date3)).toBe(false);
      const opArr = new GtOperator([1, 3]);
      expect(opArr.evaluate([1, 3])).toBe(false);
      expect(opArr.evaluate([1, 2])).toBe(false);
    });

    it('should use BSON comparison order for different types', () => {
      const opNum = new GtOperator(100);
      expect(opNum.evaluate('abc')).toBe(true); // string > number
      const opStr = new GtOperator('abc');
      expect(opStr.evaluate(100)).toBe(false); // number < string
      const opObj = new GtOperator({});
      expect(opObj.evaluate([])).toBe(true); // array > object
      const opArr = new GtOperator([]);
      expect(opArr.evaluate({})).toBe(false); // object < array
    });

     it('should evaluate to false if value is incomparable (null/undefined)', () => {
       const opNum = new GtOperator(5);
       expect(opNum.evaluate(null)).toBe(false); // compareBSONValues returns null
       expect(opNum.evaluate(undefined)).toBe(false); // compareBSONValues returns null
     });

     it('should evaluate to false if queryValue is incomparable (undefined)', () => {
       const opUndefQuery = new GtOperator(undefined as any);
       expect(opUndefQuery.evaluate(1)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(null)).toBe(false); // compareBSONValues returns null
     });
  });

  describe('GteOperator ($gte)', () => {
    it('should create a GteOperator instance', () => {
      const op = new GteOperator(10);
      expect(op).toBeInstanceOf(GteOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true when value >= queryValue (same type)', () => {
      const opNum = new GteOperator(10);
      expect(opNum.evaluate(11)).toBe(true);
      expect(opNum.evaluate(10)).toBe(true);
      const opStr = new GteOperator('apple');
      expect(opStr.evaluate('banana')).toBe(true);
      expect(opStr.evaluate('apple')).toBe(true);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 21);
      const date3 = new Date(2024, 5, 20);
      const opDate = new GteOperator(date1);
      expect(opDate.evaluate(date2)).toBe(true);
      expect(opDate.evaluate(date3)).toBe(true);
      const opArr = new GteOperator([1, 2]);
      expect(opArr.evaluate([1, 3])).toBe(true);
      expect(opArr.evaluate([1, 2])).toBe(true);
    });

    it('should evaluate to false when value < queryValue (same type)', () => {
      const opNum = new GteOperator(10);
      expect(opNum.evaluate(9.9)).toBe(false);
      const opStr = new GteOperator('banana');
      expect(opStr.evaluate('apple')).toBe(false);
      const date1 = new Date(2024, 5, 20);
      const date4 = new Date(2024, 5, 19);
      const opDate = new GteOperator(date1);
      expect(opDate.evaluate(date4)).toBe(false);
      const opArr = new GteOperator([1, 3]);
      expect(opArr.evaluate([1, 2])).toBe(false);
    });

    it('should use BSON comparison order for different types (>=)', () => {
      const opNum = new GteOperator(100);
      expect(opNum.evaluate('abc')).toBe(true); // string > number
      const opStr = new GteOperator('abc');
      expect(opStr.evaluate(100)).toBe(false); // number < string
      const opObj = new GteOperator({});
      expect(opObj.evaluate([])).toBe(true); // array > object
      const opArr = new GteOperator([]);
      expect(opArr.evaluate({})).toBe(false); // object < array
      const opNull = new GteOperator(null);
      expect(opNull.evaluate(null)).toBe(true); // null == null
    });

    it('should evaluate to false if value is incomparable (null/undefined)', () => {
       const opNum = new GteOperator(5);
       expect(opNum.evaluate(null)).toBe(false); // compareBSONValues returns null
       expect(opNum.evaluate(undefined)).toBe(false); // compareBSONValues returns null
     });

     it('should evaluate correctly if queryValue is incomparable (undefined)', () => {
       const opUndefQuery = new GteOperator(undefined as any);
       expect(opUndefQuery.evaluate(1)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(null)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(undefined)).toBe(true); // compareBSONValues(undef, undef) is 0
     });
  });

  describe('LtOperator ($lt)', () => {
    it('should create an LtOperator instance', () => {
      const op = new LtOperator(10);
      expect(op).toBeInstanceOf(LtOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true when value < queryValue (same type)', () => {
      const opNum = new LtOperator(10);
      expect(opNum.evaluate(9)).toBe(true);
      const opStr = new LtOperator('banana');
      expect(opStr.evaluate('apple')).toBe(true);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 19);
      const opDate = new LtOperator(date1);
      expect(opDate.evaluate(date2)).toBe(true);
      const opArr = new LtOperator([1, 3]);
      expect(opArr.evaluate([1, 2])).toBe(true);
    });

    it('should evaluate to false when value >= queryValue (same type)', () => {
      const opNum = new LtOperator(10);
      expect(opNum.evaluate(10)).toBe(false);
      expect(opNum.evaluate(11)).toBe(false);
      const opStr = new LtOperator('apple');
      expect(opStr.evaluate('apple')).toBe(false);
      expect(opStr.evaluate('banana')).toBe(false);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 21);
      const opDate = new LtOperator(date1);
      expect(opDate.evaluate(date2)).toBe(false);
      expect(opDate.evaluate(date3)).toBe(false);
      const opArr = new LtOperator([1, 2]);
      expect(opArr.evaluate([1, 2])).toBe(false);
      expect(opArr.evaluate([1, 3])).toBe(false);
    });

     it('should use BSON comparison order for different types (<)', () => {
       const opStr = new LtOperator('abc');
       expect(opStr.evaluate(100)).toBe(true); // number < string
       const opNum = new LtOperator(100);
       expect(opNum.evaluate('abc')).toBe(false); // string > number
       const opArr = new LtOperator([]);
       expect(opArr.evaluate({})).toBe(true); // object < array
       const opObj = new LtOperator({});
       expect(opObj.evaluate([])).toBe(false); // array > object
     });

     it('should evaluate to false if value is incomparable (null/undefined)', () => {
       const opNum = new LtOperator(5);
       expect(opNum.evaluate(null)).toBe(true); // Corrected expectation: null < 5 is true
       expect(opNum.evaluate(undefined)).toBe(false); // undefined is incomparable
     });

     it('should evaluate to false if queryValue is incomparable (undefined)', () => {
       const opUndefQuery = new LtOperator(undefined as any);
       expect(opUndefQuery.evaluate(1)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(null)).toBe(false); // compareBSONValues returns null
     });
  });

  describe('LteOperator ($lte)', () => {
    it('should create an LteOperator instance', () => {
      const op = new LteOperator(10);
      expect(op).toBeInstanceOf(LteOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true when value <= queryValue (same type)', () => {
      const opNum = new LteOperator(10);
      expect(opNum.evaluate(9)).toBe(true);
      expect(opNum.evaluate(10)).toBe(true);
      const opStr = new LteOperator('banana');
      expect(opStr.evaluate('apple')).toBe(true);
      expect(opStr.evaluate('banana')).toBe(true);
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 19);
      const date3 = new Date(2024, 5, 20);
      const opDate = new LteOperator(date1);
      expect(opDate.evaluate(date2)).toBe(true);
      expect(opDate.evaluate(date3)).toBe(true);
      const opArr = new LteOperator([1, 3]);
      expect(opArr.evaluate([1, 2])).toBe(true);
      expect(opArr.evaluate([1, 3])).toBe(true);
    });

    it('should evaluate to false when value > queryValue (same type)', () => {
      const opNum = new LteOperator(10);
      expect(opNum.evaluate(10.1)).toBe(false);
      const opStr = new LteOperator('apple');
      expect(opStr.evaluate('banana')).toBe(false);
      const opDate = new LteOperator(new Date(2024, 5, 20));
      const date4 = new Date(2024, 5, 21);
      expect(opDate.evaluate(date4)).toBe(false);
      const opArr = new LteOperator([1, 2]);
      expect(opArr.evaluate([1, 3])).toBe(false);
    });

    it('should use BSON comparison order for different types (<=)', () => {
      const opStr = new LteOperator('abc');
      expect(opStr.evaluate(100)).toBe(true); // number < string
      const opNum = new LteOperator(100);
      expect(opNum.evaluate('abc')).toBe(false); // string > number
      const opArr = new LteOperator([]);
      expect(opArr.evaluate({})).toBe(true); // object < array
      const opObj = new LteOperator({});
      expect(opObj.evaluate([])).toBe(false); // array > object
      const opNull = new LteOperator(null);
      expect(opNull.evaluate(null)).toBe(true); // null == null
    });

    it('should evaluate to false if value is incomparable (null/undefined)', () => {
       const opNum = new LteOperator(5);
       expect(opNum.evaluate(null)).toBe(true); // Corrected expectation: null <= 5 is true
       expect(opNum.evaluate(undefined)).toBe(false); // undefined is incomparable
     });

     it('should evaluate correctly if queryValue is incomparable (undefined)', () => {
       const opUndefQuery = new LteOperator(undefined as any);
       expect(opUndefQuery.evaluate(1)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(null)).toBe(false); // compareBSONValues returns null
       expect(opUndefQuery.evaluate(undefined)).toBe(true); // compareBSONValues(undef, undef) is 0
     });
  });

  describe('InOperator ($in)', () => {
    // Note: $in implementation in comparison.ts still uses compareBSONValues directly,
    // not deepCompare. This might differ from compileQuery's generated code.
    // The tests here reflect the behavior of the InOperator class itself.
    it('should create an InOperator instance', () => {
      const op = new InOperator([1, 2, 3]);
      expect(op).toBeInstanceOf(InOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to true if value matches any element in the array (BSON comparison)', () => {
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20); // Same time
      const queryArray = [1, 'hello', true, null, date1, [10]];
      const op = new InOperator(queryArray);

      expect(op.evaluate(1)).toBe(true);
      expect(op.evaluate('hello')).toBe(true);
      expect(op.evaluate(true)).toBe(true);
      expect(op.evaluate(null)).toBe(true);
      expect(op.evaluate(date2)).toBe(true); // Date equality
      expect(op.evaluate([10])).toBe(true); // Array equality via compareBSONValues -> deepCompare
    });

    it('should evaluate to false if value matches no element in the array (BSON comparison)', () => {
      const date1 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 21);
      const queryArray = [1, 'hello', true, null, date1, [10]];
      const op = new InOperator(queryArray);

      expect(op.evaluate(2)).toBe(false);
      expect(op.evaluate('world')).toBe(false);
      expect(op.evaluate(false)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false); // undefined is not in array
      expect(op.evaluate(date3)).toBe(false); // Different date
      expect(op.evaluate({})).toBe(false);
      expect(op.evaluate([])).toBe(false); // Empty array not in list
      expect(op.evaluate([11])).toBe(false); // Different array
    });

    it('should handle mixed types in array based on BSON comparison', () => {
      const queryArray = [10, 'apple', null];
      const op = new InOperator(queryArray);
      expect(op.evaluate(10)).toBe(true);
      expect(op.evaluate('apple')).toBe(true);
      expect(op.evaluate(null)).toBe(true);
      expect(op.evaluate('10')).toBe(false); // String '10' != number 10
      expect(op.evaluate(true)).toBe(false);
      expect(op.evaluate(undefined)).toBe(false);
    });

    it('should support RegExp elements in the query array', () => {
      const queryArray = [/^hel/i, 5, /o$/];
      const op = new InOperator(queryArray);
      expect(op.evaluate('Hello World')).toBe(true); // Matches /^hel/i
      expect(op.evaluate('world')).toBe(false); // Does not end with 'o'
      expect(op.evaluate(5)).toBe(true); // Matches 5
      expect(op.evaluate('helicopter')).toBe(true); // Matches /^hel/i
      expect(op.evaluate('polo')).toBe(true); // Matches /o$/
      expect(op.evaluate('World')).toBe(false); // No match
      expect(op.evaluate(6)).toBe(false); // No match
      expect(op.evaluate(null)).toBe(false); // Regex requires string field
      expect(op.evaluate(true)).toBe(false); // Regex requires string field
    });

    it('should evaluate to false if field value is undefined (unless undefined is in array)', () => {
      const op1 = new InOperator([1, 2]);
      expect(op1.evaluate(undefined)).toBe(false); // compareBSONValues(undefined, x) is null

      const op2 = new InOperator([1, undefined, 2]);
      // compareBSONValues(undefined, undefined) is 0, so it matches
      expect(op2.evaluate(undefined)).toBe(true);
    });
  });

  describe('NinOperator ($nin)', () => {
    // Note: $nin implementation in comparison.ts uses compareBSONValues directly.
    it('should create a NinOperator instance', () => {
      const op = new NinOperator([1, 2, 3]);
      expect(op).toBeInstanceOf(NinOperator);
      expect(typeof op.evaluate).toBe('function');
    });

    it('should evaluate to false if value matches any element in the array (BSON comparison)', () => {
      const date1 = new Date(2024, 5, 20);
      const date2 = new Date(2024, 5, 20); // Same time
      const queryArray = [1, 'hello', true, null, date1, [10]];
      const op = new NinOperator(queryArray);

      expect(op.evaluate(1)).toBe(false);
      expect(op.evaluate('hello')).toBe(false);
      expect(op.evaluate(true)).toBe(false);
      expect(op.evaluate(null)).toBe(false);
      expect(op.evaluate(date2)).toBe(false); // Date equality
      expect(op.evaluate([10])).toBe(false); // Array equality via compareBSONValues -> deepCompare
    });

    it('should evaluate to true if value matches no element in the array (BSON comparison)', () => {
      const date1 = new Date(2024, 5, 20);
      const date3 = new Date(2024, 5, 21);
      const queryArray = [1, 'hello', true, null, date1, [10]];
      const op = new NinOperator(queryArray);

      expect(op.evaluate(2)).toBe(true);
      expect(op.evaluate('world')).toBe(true);
      expect(op.evaluate(false)).toBe(true);
      // expect(op.evaluate(undefined)).toBe(true); // Changed below
      expect(op.evaluate(date3)).toBe(true); // Different date
      expect(op.evaluate({})).toBe(true);
      expect(op.evaluate([])).toBe(true);
    });

    it('should handle mixed types in array based on BSON comparison', () => {
      const queryArray = [10, 'apple', null];
      const op = new NinOperator(queryArray);

      // Test values that should not match
      expect(op.evaluate(10)).toBe(false);
      expect(op.evaluate('apple')).toBe(false);
      expect(op.evaluate(null)).toBe(false);

      // Test values that should match
      expect(op.evaluate('10')).toBe(true); // String '10' != number 10
      expect(op.evaluate(true)).toBe(true);
      expect(op.evaluate(undefined)).toBe(true);
    });

    it('should support RegExp elements in the query array (negated)', () => {
      const queryArray = [/^hel/i, 5, /o$/];
      const op = new NinOperator(queryArray);

      expect(op.evaluate('Hello World')).toBe(false); // Matches /^hel/i
      // 'world' does not end with o. No match found. Nin should be true.
      expect(op.evaluate('world')).toBe(true); // Corrected expectation
      expect(op.evaluate(5)).toBe(false); // Matches 5

      expect(op.evaluate('helicopter')).toBe(false); // Matches /^hel/i
      expect(op.evaluate('World')).toBe(true); // No match
      expect(op.evaluate(6)).toBe(true); // No match
      expect(op.evaluate(null)).toBe(true); // Regex requires string field, null is not string
      expect(op.evaluate(true)).toBe(true); // Regex requires string field, true is not string
    });

    it('should evaluate correctly if field value is undefined (consistent with MongoDB)', () => {
      // $nin matches fields that are missing (undefined)
      const op1 = new NinOperator([1, 2]);
      expect(op1.evaluate(undefined)).toBe(true);

      // Unless undefined is explicitly in the query array
      const op2 = new NinOperator([1, undefined, 2]);
      expect(op2.evaluate(undefined)).toBe(false);
    });
  });

  // TODO: Add describe blocks for NinOperator
});