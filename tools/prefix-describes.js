/*
 * Prefix top-level describe titles in test files with requirement IDs based on path heuristics.
 * Usage: node tools/prefix-describes.js
 */
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function loadSummary() {
  const p = path.join(repoRoot, 'tests-summary.json');
  if (!fs.existsSync(p)) {
    throw new Error('tests-summary.json not found. Generate it first.');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function prefixFor(filePath) {
  const p = filePath.replace(/\\/g, '/');

  // Security (AuthN/Z, RBAC/ABAC)
  if (p.includes('/src/auth/authorization/tests/')) {
    return '[R11.1][R11.2][R11.3][R11.9][R11.10]';
  }
  if (p.includes('/src/auth/tests/TokenManager.test.ts')) return '[R11.6]';
  if (p.includes('/src/auth/tests/UserManager.test.ts')) return '[R11.11]';
  if (p.includes('/src/auth/tests/RoleManager.test.ts')) return '[R11.12]';
  if (p.includes('/src/auth/tests/SessionManager.test.ts')) return '[R11.13]';
  if (p.includes('/src/auth/tests/AuditLogger.test.ts')) return '[R11.14]';

  // External Adapters
  if (p.includes('/src/adapters/googlesheets/')) {
    return '[R27.4][R27.5][R27.6][R27.7][R27.8][R27.16][R27.17]';
  }
  if (p.includes('/src/adapters/markdown/')) {
    return '[R27.9][R27.10][R27.11][R27.12][R27.18][R27.19]';
  }
  if (p.includes('/src/adapters/mongodb/')) {
    return '[R27.13][R27.14][R27.15]';
  }

  // Browser/Client offline & SDK
  if (p.includes('/src/browser-sdk/')) return '[R9.10][R9.11][R9.12][R9.13]';
  if (p.includes('/src/client/offline/')) return '[R10.1][R10.2][R10.3][R10.4][R10.5][R10.6][R10.7][R10.8][R10.9][R10.11]';
  if (p.includes('/src/client/sdk/core/__test__/SDK.offline.e2e.test.ts')) return '[R10.1][R9.10]';
  if (p.includes('/src/client/sdk/core/__test__/CollectionManager.offline.test.ts')) return '[R10.1]';
  if (p.includes('/packages/shared-test-utils/src/tests/core/BrowserStorageManager.test.ts')) return '[R9.10][R10.2]';
  if (p.includes('/src/browser-sdk/storage/__test__/BrowserStorageManager.test.ts')) return '[R9.10][R10.2]';
  if (p.includes('/src/browser-sdk/core-integration/__test__/CoreIntegrationLayer.test.ts')) return '[R9.10][R9.11]';

  // Pagination client utilities (query-related)
  if (p.includes('/src/client/pagination/')) return '[R6.1][R6.11][R6.12]';

  // Storage adapter (memory)
  if (p.includes('/src/storage/adapters/__test__/memory-adapter.test.ts')) return '[R1.3]';

  // Core/Index/Transactions extras
  if (p.includes('/src/core/__test__/IndexManager.test.ts')) return '[R4.4]';
  if (p.includes('/src/core/__test__/CSDatabase.savepoint.test.ts')) return '[R4.1]';
  if (p.includes('/src/transactions/__tests__/TransactionalCollection.test.ts')) return '[R4.5][R4.6]';

  // Index utils
  if (p.includes('/src/utils/__test__/SingleKeyUtils.test.ts')) return '[R5.12]';
  if (p.includes('/src/utils/__test__/CompositeKeyUtils.test.ts')) return '[R5.10][R5.11]';
  if (p.includes('/src/index/single-key-sort-order.test.ts')) return '[R5.12]';
  if (p.includes('/src/index/autoinc-and-default-index.test.ts')) return '[R5.2]';

  // Query engine granular suites
  if (p.includes('/src/query/__tests__/bitwise.test.ts')) return '[R6.5]';
  if (p.includes('/src/query/__tests__/element.test.ts')) return '[R6.5]';
  if (p.includes('/src/query/__tests__/array.test.ts')) return '[R6.5]';
  if (p.includes('/src/query/__tests__/evaluation.test.ts')) return '[R6.5]';
  if (p.includes('/src/query/__tests__/logical.test.ts')) return '[R6.1]';
  if (p.includes('/src/query/__tests__/comparison.test.ts')) return '[R6.1]';
  if (p.includes('/src/query/__tests__/operators.test.ts')) return '[R6.1][R6.5]';
  if (p.includes('/src/query/__tests__/compile_query.test.ts')) return '[R6.2]';
  if (p.includes('/src/query/__tests__/QueryEngine.test.ts')) return '[R6.1]';
  if (p.includes('/src/query/__tests__/query-integration.test.ts')) return '[R6.1][R6.2]';

  // Configuration-driven architecture
  if (p.includes('/src/config/__test__/ConfigurationManager.test.ts')) return '[R1.11][R1.12][R1.13][R1.16]';

  // Offline client day1/day3 and compilation
  if (p.includes('/src/client/offline/__tests__/day1-core-infrastructure.test.ts')) return '[R10.1][R10.2]';
  if (p.includes('/src/client/offline/sync/__tests__/day3-basic.test.ts')) return '[R10.1][R10.5][R10.6][R10.9]';
  if (p.includes('/src/client/offline/__tests__/compilation.test.ts')) return '[R6.2]';

  // Subscriptions system (Realtime)
  if (p.includes('/src/subscriptions/tests/')) return '[R13.15][R13.16][R13.17][R13.18][R13.19][R13.20]';

  // Stored procedures / computed attributes
  if (p.includes('/src/auth/functions/tests/')) return '[R14.2][R14.3][R14.4][R14.10][R14.12][R14.13]';
  if (p.includes('/src/auth/computed/tests/')) return '[R15.1][R15.2][R15.3][R15.4][R15.5]';

  // Default: no prefix (skip)
  return '';
}

function patchFile(filePath, prefix) {
  const src = fs.readFileSync(filePath, 'utf8');
  const re = /describe\s*\(\s*([`'\"])([\s\S]*?)\1/;
  const m = src.match(re);
  if (!m) return false;
  const title = m[2];
  if (/\[R\d+/.test(title)) return false; // already tagged
  const newTitle = `${prefix} ${title}`.trim();
  const replaced = src.replace(re, (all, q) => `describe(${q}${newTitle}${q}`);
  if (replaced !== src) {
    fs.writeFileSync(filePath, replaced);
    return true;
  }
  return false;
}

function main() {
  const summary = loadSummary();
  const candidates = summary.filter(s => s.describeCount > 0 && !s.hasTagged);
  let changed = 0;
  for (const c of candidates) {
    const abs = path.join(repoRoot, c.file);
    const prefix = prefixFor(c.file);
    if (!prefix) continue;
    try {
      if (patchFile(abs, prefix)) changed++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Patch failed for', c.file, e.message);
    }
  }
  // eslint-disable-next-line no-console
  console.log('Prefixed files:', changed, 'out of', candidates.length);
}

if (require.main === module) {
  main();
}


