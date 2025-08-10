# Collection Store – MUST HAVE Gate

Purpose: Non-negotiable criteria to declare a feature/domain Implemented and Production-Ready. All items include how-to-verify.

## Core Data Engine

- Type-safe collections with CRUD
  - Verify: bun test src/collection/__test__/ src/core/__test__/
- ACID transactions (local) with commit/rollback
  - Verify: bun test src/transactions/__tests__/

## Write-Ahead Logging (WAL)

- Durable WAL with crash recovery
  - Verify: bun test src/core/wal/__test__/
- WAL throughput meets targets (≥90K ops/sec in benchmark conditions)
  - Verify: follow README benchmark checklist and confirm target numbers

## Replication & Consensus

- WAL streaming replication (SYNC/ASYNC)
  - Verify: bun test src/replication/replication-wal-streaming.test.ts
- Leader election and log replication (Raft)
  - Verify: bun test src/raft/*.test.ts

## Indexing

- B+ Tree indexing for primary/secondary keys
  - Verify: bun test src/index/*.test.ts src/core/__test__/IndexManager.test.ts
- Default unique required index for ID
  - Verify: bun test src/index/autoinc-and-default-index.test.ts

## Query Engine

- MongoDB-style operators; compiled-by-default execution with safe fallback
  - Verify: bun test src/query/__tests__/

## Schema & Validation

- Schema definition with types and validators
  - Verify: covered by CRUD/Query test suites; ensure failures surface on invalid data

## Performance & Monitoring

- Baseline performance targets documented and reproducible
  - Verify: run benchmark scripts per README; attach run output
- Monitoring/metrics APIs available
  - Verify: presence in codebase and validated via tests where applicable
- Performance Optimizers are stable (no failing tests)
  - Verify: bun test src/performance/__tests__/ returns green (RealTimeOptimizer, AutomatedOptimizationEngine)

## Browser SDK & Offline

- Browser storage abstraction (IndexedDB/LocalStorage/Memory) with fallbacks
  - Verify: bun test src/browser-sdk/storage/__test__/BrowserStorageManager.test.ts
- Core adapter bridge & sync integration
  - Verify: bun test src/browser-sdk/core-integration/__test__/
- Offline operation with queuing and reconciled sync
  - Verify: bun test packages/shared-test-utils/src/tests/core/OfflineSyncEngine.test.ts src/client/offline/**/__tests__/

## Security

- AuthZ (RBAC/ABAC) with policy evaluation and audit logging
  - Verify: bun test src/auth/authorization/tests/ src/auth/tests/
- JWT/token security with rotation support
  - Verify: bun test src/auth/tests/TokenManager.test.ts

## Test Gate

- All unit/integration tests pass (0 failures)
  - Verify: bun test
- Critical UI/Playwright tests green when browser features are touched
  - Verify: bun run test:ui (or CI equivalent)

## Evidence & Traceability

- Feature matrix kept up to date with statuses and file paths
  - Verify: collection-store-requirements-feature-matrix-audit.md updated per release


