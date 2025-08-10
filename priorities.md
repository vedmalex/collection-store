# Collection Store – Priority Backlog

Scope: Based on the latest audit and test run (bun test: 3014 pass, 2 fail, 3 skip). Focus is to get all MUST items green and reduce risk before extending optional features.

Out of scope:
- Do not modify or run tests in `packages/origina_guide/` (reference only).

## P0 – Immediate (blocking)

- Stabilize Performance Optimization Engines
  - Fix RealTimeOptimizer duplicate-emergency suppression
    - Test: src/performance/__tests__/RealTimeOptimizer.test.ts ("should not handle same emergency type if already active")
    - Acceptance: Test passes consistently on CI and local
    - Verify: bun test src/performance/__tests__/RealTimeOptimizer.test.ts
  - Fix AutomatedOptimizationEngine validation race/consistency
    - Test: src/performance/__tests__/AutomatedOptimizationEngine.test.ts ("should validate optimization successfully")
    - Acceptance: Test passes; history write/flush is deterministic
    - Verify: bun test src/performance/__tests__/AutomatedOptimizationEngine.test.ts
- Green test gate
  - Acceptance: bun test returns 0 failures across the repo
  - Verify: bun test

## P1 – High (near-term)

- Composite Keys – complete integration
  - Deliverables: full composite index operations + query integrations (findBy/First/Last, range queries)
  - Tests: extend unit/integration coverage per integration plans
  - Docs: update examples and feature matrix
- Realtime Subscription Engine – core functionality
  - Deliverables: WebSocket manager, SSE manager, cross-tab sync, permission-aware filtering
  - Tests: end-to-end subscription delivery, reconnection, backpressure
- Performance & Monitoring – evidence refresh
  - Deliverables: re-run benchmarks, attach results, ensure thresholds documented
  - Tests: keep perf suites stable; add regression tests for optimizer decisions
- File & Assets – automated tests alignment
  - Deliverables: unit/integration tests to complement integration reports
  - Verify: bun test packages/collection-store/src/filestorage/tests/ (when added)

## P2 – Medium

- Browser Build & Offline Enhancements
  - Deliverables: ESM browser build, Service Worker caching, IndexedDB adapter (browser runtime), BroadcastChannel cross-tab sync
  - Tests: Playwright suite (headless + headed)
- Query Engine – coverage expansion
  - Deliverables: NOR/NIN/BSON specialized cases, utility refactors to shared module
- Security – field-level access control
  - Deliverables: field-level policies with tests and audit coverage
- TTL Policies
  - Deliverables: TTL/expiration policies for documents with cleanup routines

## P3 – Longer-term / Nice-to-have

- SDKs (React/Qwik polish; multi-language SDK foundations)
- Ops & Productionization (deploy pipeline, monitoring dashboards, alerts)
- Advanced Performance Tooling (load/stress frameworks, regression perf suite)
- Analytics/ML/Workflow experimental features

## Tracking & Reporting

- Update `collection-store-requirements-feature-matrix-audit.md` after each P0/P1 completion.
- Keep evidence links (tests, demos, docs) up to date; ensure reproducible verification commands are listed alongside each item.


