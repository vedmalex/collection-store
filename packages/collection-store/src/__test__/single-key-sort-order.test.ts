import { SingleKeyUtils } from "../utils/SingleKeyUtils"
import { describe, test, expect } from "bun:test";

describe("Single Key Sort Order Tests", () => {
    describe("Sort Order Validation", () => {
    test("should validate ascending sort order", () => {
      expect(SingleKeyUtils.validateSortOrder("asc")).toBe(true);
    });

    test("should validate descending sort order", () => {
      expect(SingleKeyUtils.validateSortOrder("desc")).toBe(true);
    });

    test("should reject invalid sort orders", () => {
      expect(SingleKeyUtils.validateSortOrder("invalid" as any)).toBe(false);
      expect(SingleKeyUtils.validateSortOrder(0 as any)).toBe(false);
      expect(SingleKeyUtils.validateSortOrder(2 as any)).toBe(false);
      expect(SingleKeyUtils.validateSortOrder(null as any)).toBe(false);
      expect(SingleKeyUtils.validateSortOrder(undefined as any)).toBe(false);
    });
  });

  describe("Sort Order Normalization", () => {
    test("should normalize valid sort orders to standard format", () => {
      expect(SingleKeyUtils.normalizeSortOrder("asc")).toBe("asc");
      expect(SingleKeyUtils.normalizeSortOrder("desc")).toBe("desc");
    });

    test("should default to ascending for undefined", () => {
      expect(SingleKeyUtils.normalizeSortOrder(undefined)).toBe("asc");
    });
  });

  describe("Comparator Creation", () => {
    test("should create ascending comparator for numbers", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      expect(comparator(1, 2)).toBeLessThan(0);
      expect(comparator(2, 1)).toBeGreaterThan(0);
      expect(comparator(1, 1)).toBe(0);
    });

    test("should create descending comparator for numbers", () => {
      const comparator = SingleKeyUtils.createComparator("desc");
      expect(comparator(1, 2)).toBeGreaterThan(0);
      expect(comparator(2, 1)).toBeLessThan(0);
      expect(comparator(1, 1)).toBe(0);
    });

    test("should handle string comparison", () => {
      const ascComparator = SingleKeyUtils.createComparator("asc");
      expect(ascComparator("a", "b")).toBeLessThan(0);
      expect(ascComparator("b", "a")).toBeGreaterThan(0);
      expect(ascComparator("a", "a")).toBe(0);
    });

    test("should handle null and undefined values", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      expect(comparator(null, 1)).toBeLessThan(0);
      expect(comparator(undefined, 1)).toBeLessThan(0);
      expect(comparator(null, undefined)).toBeLessThan(0);
      expect(comparator(null, null)).toBe(0);
    });

    test("should handle mixed types with fallback to string comparison", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      expect(comparator(1, "2")).toBeLessThan(0); // "1" < "2"
      expect(comparator("2", 1)).toBeGreaterThan(0); // "2" > "1"
    });
  });

  describe("Edge Cases", () => {
    test("should handle boolean values", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      expect(comparator(false, true)).toBeLessThan(0);
      expect(comparator(true, false)).toBeGreaterThan(0);
      expect(comparator(true, true)).toBe(0);
    });

    test("should handle date objects", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      const date1 = new Date("2023-01-01");
      const date2 = new Date("2023-01-02");

      expect(comparator(date1, date2)).toBeLessThan(0);
      expect(comparator(date2, date1)).toBeGreaterThan(0);
      expect(comparator(date1, date1)).toBe(0);
    });

    test("should handle array values", () => {
      const comparator = SingleKeyUtils.createComparator("asc");
      const arr1 = [1, 2];
      const arr2 = [1, 3];

      // Arrays should be compared as strings
      expect(typeof comparator(arr1, arr2)).toBe("number");
    });
  });
});
