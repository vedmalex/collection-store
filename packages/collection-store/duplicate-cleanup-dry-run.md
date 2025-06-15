# 🧹 DUPLICATE CLEANUP REPORT

**Generated:** 2025-06-15T08:25:21.191Z
**Processing Time:** 0ms
**Success:** ✅

## 📊 SUMMARY

- **Files Removed:** 17
- **Files Kept:** 17
- **Space Saved:** 0 Bytes
- **Errors:** 0
- **Backup Location:** backup-duplicates-2025-06-15T08-25-21-190Z

## 🎯 RISK ASSESSMENT SUMMARY

- **Low Risk:** 17 groups
- **Medium Risk:** 3 groups
- **High Risk:** 0 groups

## 🗑️ REMOVED FILES

- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/__tests__/query-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/__tests__/query-simple-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/__tests__/query-advanced.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/transactions/__tests__/TransactionalCollection.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/__test__/CSDatabase.transaction.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/__test__/CSDatabase.savepoint.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/collection/__test__/typed-collection.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/collection/__test__/typed-collection-updates.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/__test__/IndexManager.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/wal/__test__/wal-transaction-coordination.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/wal/__test__/wal-basic.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/wal/__test__/wal-storage-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/__test__/CompositeKeyUtils.unified.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/__test__/SingleKeyUtils.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/__test__/CompositeKeyUtils.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/performance/__tests__/stress-testing.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/__tests__/compile-query-compatibility.test.ts`

## 📁 KEPT FILES

- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/query-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/query-simple-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/query-advanced.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/transaction/TransactionalCollection.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/database/CSDatabase.transaction.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/database/CSDatabase.savepoint.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/__test__/typed-collection.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/core/__test__/typed-collection-updates.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/index/IndexManager.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/wal/wal-transaction-coordination.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/wal/wal-basic.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/wal/wal-storage-integration.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/CompositeKeyUtils.unified.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/SingleKeyUtils.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/utils/CompositeKeyUtils.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/performance/stress-testing.test.ts`
- `/Users/vedmalex/work/collection-store/packages/collection-store/src/query/compile-query-compatibility.test.ts`

## 🔍 DETAILED RISK ASSESSMENT

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 100%
**Reasoning:** Found 2 exact duplicate files. Safe to remove automatically. Key factors: Exact duplicate - identical content, Files in different test directory structures.

**Files:**
- `src/query/query-integration.test.ts`
- `src/query/__tests__/query-integration.test.ts`

**Factors:**
- Exact duplicate - identical content
- Files in different test directory structures

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 100%
**Reasoning:** Found 2 exact duplicate files. Safe to remove automatically. Key factors: Exact duplicate - identical content, Files in different test directory structures.

**Files:**
- `src/query/query-simple-integration.test.ts`
- `src/query/__tests__/query-simple-integration.test.ts`

**Factors:**
- Exact duplicate - identical content
- Files in different test directory structures

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 100%
**Reasoning:** Found 2 exact duplicate files. Safe to remove automatically. Key factors: Exact duplicate - identical content, Files in different test directory structures.

**Files:**
- `src/query/__tests__/query-advanced.test.ts`
- `src/query/query-advanced.test.ts`

**Factors:**
- Exact duplicate - identical content
- Files in different test directory structures

### MEDIUM Risk Group

**Recommendation:** MANUAL_REVIEW
**Confidence:** 80%
**Reasoning:** Found 2 structural duplicate files. Requires careful review before removal. Key factors: Structural duplicate - same test structure, Files in different test directory structures.

**Files:**
- `src/transaction/TransactionManager.test.ts`
- `src/transactions/__tests__/TransactionManager2.test.ts`

**Factors:**
- Structural duplicate - same test structure
- Files in different test directory structures

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/transaction/TransactionalCollection.test.ts`
- `src/transactions/__tests__/TransactionalCollection.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/database/CSDatabase.transaction.test.ts`
- `src/core/__test__/CSDatabase.transaction.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/database/CSDatabase.savepoint.test.ts`
- `src/core/__test__/CSDatabase.savepoint.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/collection/__test__/typed-collection.test.ts`
- `src/core/__test__/typed-collection.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/collection/__test__/typed-collection-updates.test.ts`
- `src/core/__test__/typed-collection-updates.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/core/wal/__test__/wal-transaction-coordination.test.ts`
- `src/wal/wal-transaction-coordination.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/core/wal/__test__/wal-basic.test.ts`
- `src/wal/wal-basic.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/core/wal/__test__/wal-storage-integration.test.ts`
- `src/wal/wal-storage-integration.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/core/__test__/IndexManager.test.ts`
- `src/index/IndexManager.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/utils/CompositeKeyUtils.unified.test.ts`
- `src/utils/__test__/CompositeKeyUtils.unified.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 99% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/utils/__test__/SingleKeyUtils.test.ts`
- `src/utils/SingleKeyUtils.test.ts`

**Factors:**
- Partial duplicate - 99% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/utils/__test__/CompositeKeyUtils.test.ts`
- `src/utils/CompositeKeyUtils.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### MEDIUM Risk Group

**Recommendation:** MANUAL_REVIEW
**Confidence:** 80%
**Reasoning:** Found 2 structural duplicate files. Requires careful review before removal. Key factors: Structural duplicate - same test structure, Files in different test directory structures.

**Files:**
- `src/storage/adapters/__test__/memory-adapter.test.ts`
- `src/adapters/__test__/memory-adapter-selection.test.ts`

**Factors:**
- Structural duplicate - same test structure
- Files in different test directory structures

### MEDIUM Risk Group

**Recommendation:** MANUAL_REVIEW
**Confidence:** 80%
**Reasoning:** Found 2 structural duplicate files. Requires careful review before removal. Key factors: Structural duplicate - same test structure, Files in different test directory structures.

**Files:**
- `src/performance/performance-benchmarks.test.ts`
- `src/performance/__tests__/performance.test.ts`

**Factors:**
- Structural duplicate - same test structure
- Files in different test directory structures

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/performance/__tests__/stress-testing.test.ts`
- `src/performance/stress-testing.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization

### LOW Risk Group

**Recommendation:** REMOVE
**Confidence:** 90%
**Reasoning:** Found 2 partial duplicate files. Safe to remove automatically. Key factors: Partial duplicate - 100% similarity, Files in different test directory structures, Different import paths detected.

**Files:**
- `src/query/compile-query-compatibility.test.ts`
- `src/query/__tests__/compile-query-compatibility.test.ts`

**Factors:**
- Partial duplicate - 100% similarity
- Files in different test directory structures
- Different import paths detected
- High similarity despite import differences - likely reorganization
