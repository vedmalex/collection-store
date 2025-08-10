/*
 * Normalize top-level describe titles to concise, meaningful names.
 * Usage: node tools/normalize-describe-titles.js
 */
const fs = require('fs');
const path = require('path');

function listTestFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTestFiles(p));
    else if (/\.test\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function applyRules(title) {
  let t = title.trim();
  // Remove Phase/Day prefixes
  t = t.replace(/^Phase\s+\d+(?:\.\d+)?\s+Day\s+\d+\s*:\s*/i, '');
  // Shorten suffixes
  t = t.replace(/\s*-\s*Basic\s*Tests?$/i, ' - Basic');
  t = t.replace(/\s*Tests?$/i, '');
  t = t.replace(/\s*Test$/i, '');
  // Common camel tokens → spaced
  t = t.replace(/\bWALDatabase\b/g, 'WAL Database');
  t = t.replace(/\bWALCollection\b/g, 'WAL Collection');
  t = t.replace(/\bIndexManager\b/g, 'Index Manager');
  t = t.replace(/\bReadOnlyCollectionManager\b/g, 'Read-only Collection Manager');
  t = t.replace(/\bCoreIntegrationLayer\b/g, 'Core Integration Layer');
  t = t.replace(/\bTransactionalCollection\b/g, 'Transactional Collection');
  t = t.replace(/\bTransactionalListWrapper\b/g, 'Transactional List Wrapper');
  t = t.replace(/^TransactionManager$/i, 'Transaction Manager');
  t = t.replace(/^Memory Adapter Selection$/i, 'Memory Adapter');
  t = t.replace(/^Composite Index Basic Functionality$/i, 'Composite Index Basics');
  t = t.replace(/^AutoInc and Default Index$/i, 'Auto-inc and Default Index');
  t = t.replace(/^WAL Basic Functionality$/i, 'WAL Basic');
  t = t.replace(/^Replicated WAL Collection Integration$/i, 'Replicated WAL Collection');
  // Collapse extra spaces
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

function contextNormalize(filePath, title) {
  const p = filePath.replace(/\\/g, '/');
  let t = title;
  const camelToTitle = (s) => s
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Offline suites
  if (p.includes('/client/offline/')) {
    t = t
      .replace(/^Core Offline Infrastructure$/i, 'Offline Core Infrastructure')
      .replace(/^Core Offline Infrastructure - Summary$/i, 'Offline Core Infrastructure - Summary')
      .replace(/^Sync Management System$/i, 'Offline Sync Management')
      .replace(/^Sync Management System - Basic$/i, 'Offline Sync Management - Basic')
      .replace(/^Conflict Resolution System$/i, 'Offline Conflict Resolution')
      .replace(/^Conflict Resolution System - Basic$/i, 'Offline Conflict Resolution - Basic')
      .replace(/^Sync Management - Basic$/i, 'Offline Sync Management - Basic')
      .replace(/^Conflict Resolution - Basic$/i, 'Offline Conflict Resolution - Basic');
    // Compilation special-case
    if (/^Compilation$/i.test(t) || /^Compilation Test$/i.test(t)) t = 'Offline Compilation';
    // Ensure Offline prefix for known offline cores
    if (/^(Core Infrastructure|Sync Management|Conflict Resolution)$/i.test(t)) {
      t = 'Offline ' + t;
    }
  }
  // Browser SDK core integration
  if (p.includes('/browser-sdk/core-integration/')) {
    if (/^Core Integration Layer$/i.test(t)) t = 'Browser SDK Core Integration';
    if (/^CoreIntegrationLayer$/i.test(t)) t = 'Browser SDK Core Integration';
  }
  // SDK/client/session
  if (p.includes('/client/sdk/core/__test__/ClientSDK.test.ts')) t = 'Client SDK';
  if (p.includes('/client/session/core/__test__/SessionManager.test.ts')) t = 'Client Session Manager';
  if (p.includes('/browser-sdk/storage/__test__/BrowserStorageManager.test.ts') || p.includes('/packages/shared-test-utils/src/tests/core/BrowserStorageManager.test.ts')) t = 'Browser Storage Manager';

  // Performance suites
  if (p.includes('/performance/')) {
    t = t.replace(/^Phase\s*\d+\s*:\s*/i, '');
    t = t
      .replace(/^PerformanceIntegrator$/i, 'Performance Integrator')
      .replace(/^TestScenarioBuilder$/i, 'Test Scenario Builder')
      .replace(/^AutomatedOptimizationEngine$/i, 'Automated Optimization Engine')
      .replace(/^AutomatedOptimizationIntegration$/i, 'Automated Optimization Integration')
      .replace(/^PredictivePerformanceAnalyzer$/i, 'Predictive Performance Analyzer')
      .replace(/^CrossComponentCorrelationAnalyzer$/i, 'Cross-Component Correlation Analyzer')
      .replace(/^NetworkProfiler$/i, 'Network Profiler')
      .replace(/^RealtimeSubscriptionProfiler$/i, 'Realtime Subscription Profiler')
      .replace(/^BottleneckAnalyzer$/i, 'Bottleneck Analyzer')
      .replace(/^PerformanceScenarios$/i, 'Performance Scenarios')
      .replace(/^FileOperationsProfiler$/i, 'File Operations Profiler')
      .replace(/^LoadTestManager$/i, 'Load Test Manager')
      .replace(/^IndexManager Performance$/i, 'Index Manager Performance');
  }

  // Query suites
  if (p.includes('/query/__tests__/')) {
    t = t
      .replace(/^compile_query$/i, 'Compile Query')
      .replace(/^QueryEngine$/i, 'Query Engine')
      .replace(/^operators$/i, 'Operators')
      .replace(/^bitwise$/i, 'Bitwise Operators')
      .replace(/^element$/i, 'Element Operators')
      .replace(/^array$/i, 'Array Operators')
      .replace(/^evaluation$/i, 'Evaluation Operators')
      .replace(/^logical$/i, 'Logical Operators')
      .replace(/^comparison$/i, 'Comparison Operators')
      .replace(/^query-advanced$/i, 'Query Advanced Features')
      .replace(/^query-simple-integration$/i, 'Query Simple Integration');
  }

  // Subscriptions
  if (p.includes('/subscriptions/tests/')) {
    const cased = camelToTitle(t)
      .replace(/^Integration$/i, 'Integration');
    // Ensure unified prefix
    if (!/^Subscriptions\b/i.test(cased)) {
      t = `Subscriptions ${cased}`.trim();
    } else {
      t = cased;
    }
  }

  // Adapters
  if (p.includes('/adapters/__test__/')) {
    t = t
      .replace(/^GoogleSheetsAdapter$/i, 'Google Sheets Adapter')
      .replace(/^MongoDBEnhancement$/i, 'MongoDB Enhancement')
      .replace(/^AdapterFoundation$/i, 'Adapter Foundation');
  }
  if (p.includes('/adapters/markdown/__test__/')) {
    t = t
      .replace(/^MarkdownAdapter$/i, 'Markdown Adapter')
      .replace(/^MarkdownParser$/i, 'Markdown Parser')
      .replace(/^MarkdownWatcher$/i, 'Markdown Watcher')
      .replace(/^GitManager$/i, 'Git Manager');
  }

  // Authorization/AuthN
  if (p.includes('/auth/authorization/tests/')) {
    t = t
      .replace(/^AuthorizationEngine$/i, 'Authorization Engine')
      .replace(/^PolicyEvaluator$/i, 'Policy Evaluator')
      .replace(/^RBACEngine$/i, 'RBAC Engine')
      .replace(/^ABACEngine$/i, 'ABAC Engine')
      .replace(/^Integration$/i, 'Authorization Integration');
  }
  if (p.includes('/auth/tests/')) {
    t = t
      .replace(/^TokenManager$/i, 'Token Manager')
      .replace(/^AuditLogger$/i, 'Audit Logger')
      .replace(/^SessionManager$/i, 'Session Manager')
      .replace(/^RoleManager$/i, 'Role Manager')
      .replace(/^UserManager$/i, 'User Manager');
  }

  // Computed attributes & functions
  if (p.includes('/auth/computed/tests/')) {
    t = t
      .replace(/^Day\d+Components$/i, 'Computed Attributes - Components')
      .replace(/^Day\d+Cache$/i, 'Computed Attributes - Cache')
      .replace(/^Day\d+Invalidator$/i, 'Computed Attributes - Invalidation')
      .replace(/^Day\d+Schema$/i, 'Computed Attributes - Schema')
      .replace(/^Interfaces$/i, 'Computed Attributes - Interfaces')
      .replace(/^Types$/i, 'Computed Attributes - Types')
      .replace(/^ComputedAttributeEngine$/i, 'Computed Attribute Engine')
      .replace(/^Performance$/i, 'Computed Attributes - Performance');
  }
  if (p.includes('/auth/functions/tests/')) {
    t = t
      .replace(/^StoredFunctionEngine$/i, 'Stored Function Engine')
      .replace(/^SimpleFunctionSandbox$/i, 'Function Sandbox (Simple)')
      .replace(/^ESBuildTranspiler$/i, 'ESBuild Transpiler');
  }

  // Pagination (client)
  if (p.includes('/client/pagination/__test__/')) {
    t = t
      .replace(/^SortingEngine$/i, 'Sorting Engine')
      .replace(/^CursorPaginationManager$/i, 'Cursor Pagination Manager')
      .replace(/^Integration$/i, 'Pagination Integration')
      .replace(/^QueryOptimizer$/i, 'Query Optimizer')
      .replace(/^FactoryFunction$/i, 'Factory Function');
  }

  // Mikro-ORM project
  if (p.includes('/packages/collection-store-mikro-orm/test/')) {
    if (/basic\.test\.ts$/i.test(p)) t = 'MikroORM Basic';
    if (/compatibility\.test\.ts$/i.test(p)) t = 'MikroORM Compatibility';
    if (/custom-methods\.test\.ts$/i.test(p)) t = 'MikroORM Custom Methods';
    if (/relations\.test\.ts$/i.test(p)) t = 'MikroORM Relations';
    if (/savepoint\.test\.ts$/i.test(p)) t = 'MikroORM Savepoint';
    if (/schema\.test\.ts$/i.test(p)) t = 'MikroORM Schema';
    if (/simple\.test\.ts$/i.test(p)) t = 'MikroORM Simple';
    if (/transactions\.test\.ts$/i.test(p)) t = 'MikroORM Transactions';
  }

  // Guide project
  if (p.includes('/packages/guide/test/')) {
    if (/minimal\.test\.ts$/i.test(p)) t = 'Guide Minimal';
    if (/article\.test\.ts$/i.test(p)) t = 'Guide Article';
    if (/user\.test\.ts$/i.test(p)) t = 'Guide User';
  }

  // Qwik test app
  if (p.includes('/packages/qwik-test-app/src/tests/integration/')) {
    if (/useCollectionSignal\.test\.ts$/i.test(p)) t = 'Qwik Collection Signal Integration';
  }

  // React test app
  if (p.includes('/packages/react-test-app/src/tests/integration/')) {
    if (/useCollection\.test\.tsx$/i.test(p)) t = 'React useCollection Integration';
  }
  return t;
}

function normalizeTitle(filePath, title) {
  let t = applyRules(title);
  t = contextNormalize(filePath, t);
  return t;
}

function patchFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const re = /describe\s*\(\s*([`'\"])([\s\S]*?)\1/;
  const m = src.match(re);
  if (!m) return false;
  const quote = m[1];
  const oldTitle = m[2];
  const newTitle = normalizeTitle(filePath, oldTitle);
  if (newTitle === oldTitle) return false;
  const replaced = src.replace(re, `describe(${quote}${newTitle}${quote}`);
  fs.writeFileSync(filePath, replaced);
  return true;
}

function main() {
  const root = process.cwd();
  const files = listTestFiles(root);
  let changed = 0;
  for (const f of files) {
    try {
      if (patchFile(f)) changed++;
    } catch (e) {
      console.warn('Failed to normalize', f, e.message);
    }
  }
  console.log('Normalized describe titles in files:', changed, 'of', files.length);
}

if (require.main === module) main();


