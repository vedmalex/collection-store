/*
 * Remove leading [R..] prefixes from top-level describe titles across test files.
 * Usage: node tools/strip-requirement-prefixes.js
 */
const fs = require('fs');
const path = require('path');

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (/\.test\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function stripPrefixesInFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const re = /describe\s*\(\s*([`'\"])([\s\S]*?)\1/;
  const m = src.match(re);
  if (!m) return false;
  const quote = m[1];
  const title = m[2];
  const stripped = title.replace(/^(\s*(?:\[R\d+(?:\.\d+)?\]\s*)+)(.*)$/s, '$2').trimStart();
  if (stripped === title) return false;
  const replaced = src.replace(re, `describe(${quote}${stripped}${quote}`);
  fs.writeFileSync(filePath, replaced);
  return true;
}

function main() {
  const root = process.cwd();
  const files = listFiles(root);
  let changed = 0;
  for (const f of files) {
    try {
      if (stripPrefixesInFile(f)) changed++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to update', f, e.message);
    }
  }
  // eslint-disable-next-line no-console
  console.log('Stripped prefixes in files:', changed, 'of', files.length);
}

if (require.main === module) main();


