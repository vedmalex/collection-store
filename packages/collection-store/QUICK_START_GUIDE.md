# 🚀 Quick Start Guide: Duplicate Test Cleanup

## ⚡ One-Command Solutions

### 🔍 Just Check What Duplicates Exist
```bash
bun run tools/duplicate-detector.ts
```

### 🧹 Safe Preview (Recommended First Run)
```bash
bun run tools/duplicate-cleaner.ts --dry-run
```

### 🎯 Interactive Preview (Full Control)
```bash
bun run tools/duplicate-cleaner.ts --interactive --dry-run
```

### 🗑️ **REAL CLEANUP** (Actually Removes Files)
```bash
# Automatic cleanup - removes files permanently
bun run tools/duplicate-cleaner.ts

# Interactive cleanup - you choose which files to keep
bun run tools/duplicate-cleaner.ts --interactive
```

## 📋 What Each Command Does

| Command | What It Does | Safety Level | User Input | Files Changed |
|---------|--------------|--------------|------------|---------------|
| `duplicate-detector.ts` | Finds duplicates, creates report | 🟢 Read-only | None | ❌ No |
| `--dry-run` | Shows what would be removed | 🟢 Preview only | None | ❌ No |
| `--interactive --dry-run` | Let you choose files (preview) | 🟢 Preview only | File selection | ❌ No |
| `--interactive` | Interactive cleanup **REMOVES FILES** | 🟡 **REAL CHANGES** | File selection | ✅ **YES** |
| No flags | Automatic cleanup **REMOVES FILES** | 🟡 **REAL CHANGES** | None | ✅ **YES** |

## ⚠️ IMPORTANT: Real vs Preview Mode

### 🟢 Preview Mode (Safe - No Files Removed)
- `--dry-run` flag = Preview only
- Shows what WOULD be removed
- No actual file changes

### 🔴 Real Mode (Files Actually Removed)
- **NO** `--dry-run` flag = Real cleanup
- **Permanently removes** duplicate files
- Creates automatic backup
- **Cannot be undone** (except via backup)

## 🎯 Recommended Workflow

### First Time Users (SAFE)
1. **Preview what's there**: `bun run tools/duplicate-cleaner.ts --dry-run`
2. **Make git backup**: `git add . && git commit -m "Before duplicate cleanup"`
3. **Interactive preview**: `bun run tools/duplicate-cleaner.ts --interactive --dry-run`
4. **Real interactive cleanup**: `bun run tools/duplicate-cleaner.ts --interactive`

### Quick Users
1. **Preview**: `bun run tools/duplicate-cleaner.ts --dry-run`
2. **If happy with plan**: `bun run tools/duplicate-cleaner.ts`

## 🛡️ Safety Features

- ✅ **Automatic backup** before any real changes
- ✅ **Preview mode** with `--dry-run` flag
- ✅ **Interactive mode** for full control
- ✅ **Rollback capability** if needed
- ✅ **No manual setup** required

## 📊 What You'll See

### Preview Mode (--dry-run)
```
🧹 DRY RUN: Executing cleanup plan...
[DRY RUN] Would remove: src/query/__tests__/query-integration.test.ts
[DRY RUN] Would remove: src/query/__tests__/query-advanced.test.ts

💡 This was a dry run. No files were actually removed.
💡 To perform actual cleanup, run without --dry-run flag.
```

### Real Mode (no --dry-run)
```
⚠️ This will permanently remove duplicate files.
📦 A backup will be created before removal.

🔄 REAL CLEANUP MODE: Files will be permanently removed
💡 Use --dry-run flag to preview changes first

🧹 Executing cleanup plan...
✅ Removed: src/query/__tests__/query-integration.test.ts
✅ Removed: src/query/__tests__/query-advanced.test.ts

🎯 CLEANUP RESULTS
==================
Success: ✅
Files processed: 17
Space saved: 225.02 KB
```

## 🆘 If Something Goes Wrong

### Rollback Changes
```bash
# Check backup location from output, then:
# (Example backup path from output)
bun run tools/duplicate-cleaner.ts --rollback backup-duplicates-2025-06-15T08-07-57-310Z

# Or restore from git
git reset --hard HEAD~1
```

### Get Help
```bash
# Check system status
bun run tools/system-validator.ts

# Re-run detection
bun run tools/duplicate-detector.ts
```

## 💡 Pro Tips

1. **ALWAYS start with `--dry-run`** to see what will happen
2. **Make git commit** before real cleanup
3. **Use interactive mode** for important decisions
4. **Check test results** after cleanup: `bun test`
5. **Keep the reports** for future reference

## 🎯 Common Use Cases

### "I just want to clean up obvious duplicates"
```bash
# 1. Preview first
bun run tools/duplicate-cleaner.ts --dry-run

# 2. If looks good, do real cleanup
bun run tools/duplicate-cleaner.ts
```

### "I want to choose which files to keep"
```bash
# 1. Interactive preview
bun run tools/duplicate-cleaner.ts --interactive --dry-run

# 2. Real interactive cleanup
bun run tools/duplicate-cleaner.ts --interactive
```

### "I want to see what duplicates exist first"
```bash
bun run tools/duplicate-detector.ts
# Review duplicate-detection-report.json
```

## ⚠️ CRITICAL REMINDERS

- 🔴 **Commands WITHOUT `--dry-run` PERMANENTLY REMOVE FILES**
- 🟢 **Commands WITH `--dry-run` only show preview**
- 💾 **Always make git commit before real cleanup**
- 📦 **Automatic backup is created, but git is safer**

---

**Need more details?** See `USAGE_GUIDE.md` and `INTERACTIVE_MODE_GUIDE.md`