#!/usr/bin/env bun

/**
 * Duplicate Test Cleanup System
 *
 * C5: Risk Assessment Module
 * C6: Cleanup Orchestrator
 * C7: Reporting Engine
 *
 * Safe cleanup with comprehensive backup and rollback mechanisms
 */

import { readFile, writeFile, unlink, mkdir, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync } from 'fs';
import { TestFileInfo, DuplicateGroup, DetectionReport } from './duplicate-detector';
import * as readline from 'readline';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface CleanupPlan {
  duplicateGroups: DuplicateGroup[];
  filesToRemove: string[];
  filesToKeep: string[];
  riskAssessments: Map<string, RiskAssessment>;
  backupPath: string;
  estimatedSavings: number;
}

interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
  recommendation: 'REMOVE' | 'MERGE' | 'MANUAL_REVIEW';
  confidence: number;
  reasoning: string;
}

interface CleanupResult {
  success: boolean;
  filesRemoved: string[];
  filesKept: string[];
  errors: string[];
  backupPath: string;
  spaceSaved: number;
  processingTime: number;
}

interface BackupInfo {
  timestamp: string;
  backupPath: string;
  originalFiles: string[];
  checksums: Map<string, string>;
}

interface UserChoice {
  fileToKeep: TestFileInfo;
  filesToRemove: TestFileInfo[];
}

// ============================================================================
// INTERACTIVE FILE SELECTOR
// ============================================================================

class InteractiveFileSelector {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async selectFileToKeep(group: DuplicateGroup): Promise<UserChoice> {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 DUPLICATE GROUP FOUND (${group.type})`);
    console.log('='.repeat(80));

    if (group.type === 'EXACT') {
      console.log('📋 Type: Exact duplicates (100% identical content)');
    } else if (group.type === 'STRUCTURAL') {
      console.log('📋 Type: Structural duplicates (same test structure)');
    } else {
      console.log(`📋 Type: Partial duplicates (${Math.round(group.confidence * 100)}% similarity)`);
    }

    console.log(`📊 Confidence: ${Math.round(group.confidence * 100)}%`);

    if (group.reason) {
      console.log(`💡 Reason: ${group.reason}`);
    }

    if (group.differences && group.differences.length > 0) {
      console.log('🔍 Key differences:');
      group.differences.slice(0, 3).forEach(diff => {
        console.log(`   • ${diff}`);
      });
    }

    console.log('\n📁 Files in this group:');
    group.files.forEach((file, index) => {
      const sizeKB = (file.size / 1024).toFixed(2);
      const lastModified = typeof file.lastModified === 'string'
        ? new Date(file.lastModified).toLocaleDateString()
        : file.lastModified.toLocaleDateString();

      console.log(`   [${index + 1}] ${file.relativePath}`);
      console.log(`       Size: ${sizeKB} KB | Modified: ${lastModified}`);
    });

    // Show automatic recommendation
    const autoChoice = this.getAutomaticRecommendation(group);
    console.log(`\n🤖 Automatic recommendation: Keep file [${group.files.indexOf(autoChoice) + 1}]`);
    console.log(`   Reason: ${this.getRecommendationReason(group, autoChoice)}`);

    console.log('\n📋 Options:');
    console.log('   [1-' + group.files.length + '] Select file to keep');
    console.log('   [a] Accept automatic recommendation');
    console.log('   [s] Skip this group (manual review)');
    console.log('   [q] Quit interactive mode');

    const choice = await this.getUserInput('\n👤 Your choice: ');

    if (choice.toLowerCase() === 'q') {
      this.close();
      process.exit(0);
    }

    if (choice.toLowerCase() === 's') {
      console.log('⏭️ Skipping this group for manual review');
      return {
        fileToKeep: group.files[0], // Dummy, won't be used
        filesToRemove: [] // Empty - skip removal
      };
    }

    if (choice.toLowerCase() === 'a') {
      console.log(`✅ Accepting automatic recommendation: ${autoChoice.relativePath}`);
      return {
        fileToKeep: autoChoice,
        filesToRemove: group.files.filter(f => f.path !== autoChoice.path)
      };
    }

    const fileIndex = parseInt(choice) - 1;
    if (fileIndex >= 0 && fileIndex < group.files.length) {
      const selectedFile = group.files[fileIndex];
      console.log(`✅ Selected to keep: ${selectedFile.relativePath}`);

      return {
        fileToKeep: selectedFile,
        filesToRemove: group.files.filter(f => f.path !== selectedFile.path)
      };
    }

    console.log('❌ Invalid choice. Please try again.');
    return this.selectFileToKeep(group); // Recursive retry
  }

  private getAutomaticRecommendation(group: DuplicateGroup): TestFileInfo {
    const files = group.files;

    // Prefer files NOT in __test__ or __tests__ directories
    const nonTestDirFiles = files.filter(f =>
      !f.relativePath.includes('__test__') &&
      !f.relativePath.includes('__tests__')
    );

    if (nonTestDirFiles.length > 0) {
      // Among non-test-dir files, prefer the one with shortest path
      return nonTestDirFiles.reduce((shortest, current) =>
        current.relativePath.length < shortest.relativePath.length ? current : shortest
      );
    }

    // If all are in test directories, prefer the newest file
    return files.reduce((newest, current) => {
      const currentDate = typeof current.lastModified === 'string' ? new Date(current.lastModified) : current.lastModified;
      const newestDate = typeof newest.lastModified === 'string' ? new Date(newest.lastModified) : newest.lastModified;
      return currentDate > newestDate ? current : newest;
    });
  }

  private getRecommendationReason(group: DuplicateGroup, recommendedFile: TestFileInfo): string {
    const isInTestDir = recommendedFile.relativePath.includes('__test__') ||
                       recommendedFile.relativePath.includes('__tests__');

    if (!isInTestDir) {
      return 'Prefers files outside __test__/__tests__ directories';
    }

    return 'Newest file among test directory files';
  }

  private async getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  close(): void {
    this.rl.close();
  }
}

// ============================================================================
// C5: RISK ASSESSMENT MODULE
// ============================================================================

class RiskAssessmentModule {
  async assessRisk(group: DuplicateGroup): Promise<RiskAssessment> {
    const factors: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let recommendation: 'REMOVE' | 'MERGE' | 'MANUAL_REVIEW' = 'REMOVE';
    let confidence = 0.9;

    // Factor 1: Type of duplicate
    if (group.type === 'EXACT') {
      factors.push('Exact duplicate - identical content');
      riskLevel = 'LOW';
      confidence = 1.0;
    } else if (group.type === 'STRUCTURAL') {
      factors.push('Structural duplicate - same test structure');
      riskLevel = 'MEDIUM';
      confidence = 0.8;
      recommendation = 'MANUAL_REVIEW';
    } else if (group.type === 'PARTIAL') {
      factors.push(`Partial duplicate - ${Math.round(group.confidence * 100)}% similarity`);
      if (group.confidence > 0.95) {
        riskLevel = 'LOW';
        confidence = 0.9;
      } else {
        riskLevel = 'HIGH';
        confidence = 0.6;
        recommendation = 'MANUAL_REVIEW';
      }
    }

    // Factor 2: File size differences
    const sizes = group.files.map(f => f.size);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    const sizeDifference = maxSize - minSize;

    if (sizeDifference > 100) {
      factors.push(`Significant size difference: ${sizeDifference} bytes`);
      riskLevel = this.escalateRisk(riskLevel);
      confidence *= 0.9;
    }

    // Factor 3: Path analysis
    const paths = group.files.map(f => f.relativePath);
    const hasTestDirPattern = paths.some(p => p.includes('__test__') || p.includes('__tests__'));

    if (hasTestDirPattern) {
      factors.push('Files in different test directory structures');
      // This is expected for reorganized tests
    }

    // Factor 4: Import path differences (for partial duplicates)
    if (group.type === 'PARTIAL' && group.differences.some(d => d.includes('import'))) {
      factors.push('Different import paths detected');
      // This suggests files were moved/reorganized
      if (group.confidence > 0.98) {
        factors.push('High similarity despite import differences - likely reorganization');
        riskLevel = 'LOW';
        recommendation = 'REMOVE';
      }
    }

    // Factor 5: File age (prefer newer files)
    const dates = group.files.map(f => {
      const date = typeof f.lastModified === 'string' ? new Date(f.lastModified) : f.lastModified;
      return date.getTime();
    });
    const newestDate = Math.max(...dates);
    const oldestDate = Math.min(...dates);
    const ageDifference = newestDate - oldestDate;

    if (ageDifference > 24 * 60 * 60 * 1000) { // More than 1 day
      factors.push('Files have different modification dates');
    }

    const reasoning = this.generateReasoning(group, factors, riskLevel);

    return {
      level: riskLevel,
      factors,
      recommendation,
      confidence,
      reasoning
    };
  }

  private escalateRisk(currentLevel: 'LOW' | 'MEDIUM' | 'HIGH'): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (currentLevel === 'LOW') return 'MEDIUM';
    if (currentLevel === 'MEDIUM') return 'HIGH';
    return 'HIGH';
  }

  private generateReasoning(group: DuplicateGroup, factors: string[], riskLevel: string): string {
    const fileCount = group.files.length;
    const type = group.type.toLowerCase();

    let reasoning = `Found ${fileCount} ${type} duplicate files. `;

    if (riskLevel === 'LOW') {
      reasoning += 'Safe to remove automatically. ';
    } else if (riskLevel === 'MEDIUM') {
      reasoning += 'Requires careful review before removal. ';
    } else {
      reasoning += 'High risk - manual review strongly recommended. ';
    }

    reasoning += `Key factors: ${factors.slice(0, 3).join(', ')}.`;

    return reasoning;
  }

  selectFileToKeep(group: DuplicateGroup): TestFileInfo {
    // Strategy: Keep the file with the most "canonical" path
    const files = group.files;

    // Prefer files NOT in __test__ or __tests__ directories
    const nonTestDirFiles = files.filter(f =>
      !f.relativePath.includes('__test__') &&
      !f.relativePath.includes('__tests__')
    );

    if (nonTestDirFiles.length > 0) {
      // Among non-test-dir files, prefer the one with shortest path
      return nonTestDirFiles.reduce((shortest, current) =>
        current.relativePath.length < shortest.relativePath.length ? current : shortest
      );
    }

    // If all are in test directories, prefer the newest file
    return files.reduce((newest, current) => {
      const currentDate = typeof current.lastModified === 'string' ? new Date(current.lastModified) : current.lastModified;
      const newestDate = typeof newest.lastModified === 'string' ? new Date(newest.lastModified) : newest.lastModified;
      return currentDate > newestDate ? current : newest;
    });
  }

  selectFilesToRemove(group: DuplicateGroup): TestFileInfo[] {
    const fileToKeep = this.selectFileToKeep(group);
    return group.files.filter(f => f.path !== fileToKeep.path);
  }
}

// ============================================================================
// C6: CLEANUP ORCHESTRATOR
// ============================================================================

class CleanupOrchestrator {
  constructor(
    private riskAssessment: RiskAssessmentModule,
    private interactiveMode: boolean = false
  ) {}

  async createCleanupPlan(report: DetectionReport): Promise<CleanupPlan> {
    console.log('📋 Creating cleanup plan...');

    const riskAssessments = new Map<string, RiskAssessment>();
    const filesToRemove: string[] = [];
    const filesToKeep: string[] = [];
    let estimatedSavings = 0;

    let interactiveSelector: InteractiveFileSelector | null = null;
    if (this.interactiveMode) {
      interactiveSelector = new InteractiveFileSelector();
      console.log('\n🎯 INTERACTIVE MODE ENABLED');
      console.log('You will be asked to choose which file to keep for each duplicate group.\n');
    }

    // Assess risk for each duplicate group
    for (const group of report.duplicateGroups) {
      const risk = await this.riskAssessment.assessRisk(group);
      const groupKey = group.files.map(f => f.relativePath).join('|');
      riskAssessments.set(groupKey, risk);

      let fileToKeep: TestFileInfo;
      let filesToRemoveInGroup: TestFileInfo[];

      if (this.interactiveMode && interactiveSelector) {
        // Interactive mode: ask user to choose
        const userChoice = await interactiveSelector.selectFileToKeep(group);
        fileToKeep = userChoice.fileToKeep;
        filesToRemoveInGroup = userChoice.filesToRemove;

        // If user skipped this group, don't include it in cleanup
        if (filesToRemoveInGroup.length === 0) {
          console.log(`⏭️ Skipped group: ${group.files.map(f => f.relativePath).join(', ')}`);
          continue;
        }
      } else {
        // Automatic mode: only include low-risk groups
        if (risk.level === 'LOW' && risk.recommendation === 'REMOVE') {
          fileToKeep = this.riskAssessment.selectFileToKeep(group);
          filesToRemoveInGroup = this.riskAssessment.selectFilesToRemove(group);
        } else {
          // Skip high-risk groups in automatic mode
          continue;
        }
      }

      filesToKeep.push(fileToKeep.path);
      filesToRemove.push(...filesToRemoveInGroup.map(f => f.path));

      // Calculate space savings
      estimatedSavings += filesToRemoveInGroup.reduce((sum, f) => sum + f.size, 0);
    }

    if (interactiveSelector) {
      interactiveSelector.close();
      console.log('\n✅ Interactive selection completed');
    }

    const backupPath = `backup-duplicates-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    return {
      duplicateGroups: report.duplicateGroups,
      filesToRemove,
      filesToKeep,
      riskAssessments,
      backupPath,
      estimatedSavings
    };
  }

  async executeCleanup(plan: CleanupPlan, dryRun: boolean = false): Promise<CleanupResult> {
    console.log(`🧹 ${dryRun ? 'DRY RUN: ' : ''}Executing cleanup plan...`);

    const startTime = performance.now();
    const result: CleanupResult = {
      success: true,
      filesRemoved: [],
      filesKept: [],
      errors: [],
      backupPath: plan.backupPath,
      spaceSaved: 0,
      processingTime: 0
    };

    try {
      // Step 1: Create backup
      if (!dryRun) {
        await this.createBackup(plan);
        console.log(`✅ Backup created: ${plan.backupPath}`);
      }

      // Step 2: Remove duplicate files
      for (const filePath of plan.filesToRemove) {
        try {
          if (dryRun) {
            console.log(`[DRY RUN] Would remove: ${filePath}`);
          } else {
            const stats = await Bun.file(filePath).size;
            await unlink(filePath);
            result.spaceSaved += stats;
            console.log(`🗑️ Removed: ${filePath}`);
          }
          result.filesRemoved.push(filePath);
        } catch (error) {
          const errorMsg = `Failed to remove ${filePath}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      // Step 3: Track kept files
      result.filesKept = plan.filesToKeep;

      const endTime = performance.now();
      result.processingTime = endTime - startTime;

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error}`);
      console.error(`❌ Cleanup failed: ${error}`);
    }

    return result;
  }

  private async createBackup(plan: CleanupPlan): Promise<BackupInfo> {
    const backupDir = join(process.cwd(), plan.backupPath);
    await mkdir(backupDir, { recursive: true });

    const checksums = new Map<string, string>();

    for (const filePath of plan.filesToRemove) {
      try {
        // Create backup directory structure
        const relativePath = filePath.replace(process.cwd() + '/', '');
        const backupFilePath = join(backupDir, relativePath);
        const backupFileDir = dirname(backupFilePath);

        await mkdir(backupFileDir, { recursive: true });

        // Copy file to backup
        await copyFile(filePath, backupFilePath);

        // Calculate checksum
        const content = await readFile(filePath, 'utf-8');
        const checksum = Bun.hash(content).toString();
        checksums.set(relativePath, checksum);

      } catch (error) {
        console.warn(`⚠️ Warning: Could not backup ${filePath}: ${error}`);
      }
    }

    // Save backup metadata
    const backupInfo: BackupInfo = {
      timestamp: new Date().toISOString(),
      backupPath: plan.backupPath,
      originalFiles: plan.filesToRemove,
      checksums
    };

    await writeFile(
      join(backupDir, 'backup-info.json'),
      JSON.stringify(backupInfo, null, 2)
    );

    return backupInfo;
  }

  async rollback(backupPath: string): Promise<boolean> {
    console.log(`🔄 Rolling back from backup: ${backupPath}`);

    try {
      const backupInfoPath = join(backupPath, 'backup-info.json');
      if (!existsSync(backupInfoPath)) {
        console.error('❌ Backup info not found');
        return false;
      }

      const backupInfo: BackupInfo = JSON.parse(await readFile(backupInfoPath, 'utf-8'));

      for (const originalPath of backupInfo.originalFiles) {
        const relativePath = originalPath.replace(process.cwd() + '/', '');
        const backupFilePath = join(backupPath, relativePath);

        if (existsSync(backupFilePath)) {
          // Restore file
          const targetDir = dirname(originalPath);
          await mkdir(targetDir, { recursive: true });
          await copyFile(backupFilePath, originalPath);
          console.log(`✅ Restored: ${originalPath}`);
        }
      }

      console.log('✅ Rollback completed successfully');
      return true;

    } catch (error) {
      console.error(`❌ Rollback failed: ${error}`);
      return false;
    }
  }
}

// ============================================================================
// C7: REPORTING ENGINE
// ============================================================================

class ReportingEngine {
  generateCleanupReport(plan: CleanupPlan, result: CleanupResult): string {
    const report: string[] = [];

    report.push('# 🧹 DUPLICATE CLEANUP REPORT');
    report.push('');
    report.push(`**Generated:** ${new Date().toISOString()}`);
    report.push(`**Processing Time:** ${Math.round(result.processingTime)}ms`);
    report.push(`**Success:** ${result.success ? '✅' : '❌'}`);
    report.push('');

    // Summary
    report.push('## 📊 SUMMARY');
    report.push('');
    report.push(`- **Files Removed:** ${result.filesRemoved.length}`);
    report.push(`- **Files Kept:** ${result.filesKept.length}`);
    report.push(`- **Space Saved:** ${this.formatBytes(result.spaceSaved)}`);
    report.push(`- **Errors:** ${result.errors.length}`);
    report.push(`- **Backup Location:** ${result.backupPath}`);
    report.push('');

    // Risk Assessment Summary
    report.push('## 🎯 RISK ASSESSMENT SUMMARY');
    report.push('');
    const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const [, risk] of plan.riskAssessments) {
      riskCounts[risk.level]++;
    }
    report.push(`- **Low Risk:** ${riskCounts.LOW} groups`);
    report.push(`- **Medium Risk:** ${riskCounts.MEDIUM} groups`);
    report.push(`- **High Risk:** ${riskCounts.HIGH} groups`);
    report.push('');

    // Detailed Results
    if (result.filesRemoved.length > 0) {
      report.push('## 🗑️ REMOVED FILES');
      report.push('');
      result.filesRemoved.forEach(file => {
        report.push(`- \`${file}\``);
      });
      report.push('');
    }

    if (result.filesKept.length > 0) {
      report.push('## 📁 KEPT FILES');
      report.push('');
      result.filesKept.forEach(file => {
        report.push(`- \`${file}\``);
      });
      report.push('');
    }

    if (result.errors.length > 0) {
      report.push('## ❌ ERRORS');
      report.push('');
      result.errors.forEach(error => {
        report.push(`- ${error}`);
      });
      report.push('');
    }

    // Risk Details
    report.push('## 🔍 DETAILED RISK ASSESSMENT');
    report.push('');
    for (const [groupKey, risk] of plan.riskAssessments) {
      const files = groupKey.split('|');
      report.push(`### ${risk.level} Risk Group`);
      report.push('');
      report.push(`**Recommendation:** ${risk.recommendation}`);
      report.push(`**Confidence:** ${Math.round(risk.confidence * 100)}%`);
      report.push(`**Reasoning:** ${risk.reasoning}`);
      report.push('');
      report.push('**Files:**');
      files.forEach(file => {
        report.push(`- \`${file}\``);
      });
      report.push('');
      report.push('**Factors:**');
      risk.factors.forEach(factor => {
        report.push(`- ${factor}`);
      });
      report.push('');
    }

    return report.join('\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async saveReport(report: string, filename: string): Promise<void> {
    await writeFile(filename, report);
    console.log(`📄 Report saved: ${filename}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🧹 Starting Duplicate Test Cleanup System');
  console.log('🛡️ Safe cleanup with comprehensive backup and rollback');
  console.log('');

  try {
    // Load detection report
    const reportPath = 'duplicate-detection-report.json';
    let detectionReport: DetectionReport;

    if (!existsSync(reportPath)) {
      console.log('📋 Detection report not found. Running duplicate detection first...');
      console.log('');

      // Import and run duplicate detector
      const { main: runDetector } = await import('./duplicate-detector.ts');
      await runDetector();

      console.log('');
      console.log('✅ Detection completed. Proceeding with cleanup...');
      console.log('');
    }

    // Load the detection report (now it should exist)
    if (!existsSync(reportPath)) {
      console.error('❌ Failed to create detection report. Please check duplicate-detector.ts');
      process.exit(1);
    }

    const reportContent = await readFile(reportPath, 'utf-8');
    detectionReport = JSON.parse(reportContent);

    // Check for interactive mode
    const isInteractive = process.argv.includes('--interactive') || process.argv.includes('-i');

    // Initialize components
    const riskAssessment = new RiskAssessmentModule();
    const cleanupOrchestrator = new CleanupOrchestrator(riskAssessment, isInteractive);
    const reportingEngine = new ReportingEngine();

    if (isInteractive) {
      console.log('🎯 INTERACTIVE MODE: You will choose which files to keep');
    } else {
      console.log('🤖 AUTOMATIC MODE: Using built-in selection logic');
    }

    // Create cleanup plan
    const cleanupPlan = await cleanupOrchestrator.createCleanupPlan(detectionReport);

    console.log('\n📋 CLEANUP PLAN SUMMARY');
    console.log('========================');
    console.log(`Files to remove: ${cleanupPlan.filesToRemove.length}`);
    console.log(`Files to keep: ${cleanupPlan.filesToKeep.length}`);
    console.log(`Estimated space savings: ${reportingEngine['formatBytes'](cleanupPlan.estimatedSavings)}`);
    console.log(`Backup location: ${cleanupPlan.backupPath}`);
    console.log('');

    // Check if there are any files to clean up
    if (cleanupPlan.filesToRemove.length === 0) {
      console.log('✅ No safe duplicates found for automatic cleanup.');
      console.log('💡 All duplicates require manual review.');

      // Generate report for manual review
      const dryRunResult: CleanupResult = {
        success: true,
        filesRemoved: [],
        filesKept: [],
        errors: [],
        backupPath: cleanupPlan.backupPath,
        spaceSaved: 0,
        processingTime: 0
      };

      const report = reportingEngine.generateCleanupReport(cleanupPlan, dryRunResult);
      await reportingEngine.saveReport(report, 'duplicate-cleanup-manual-review.md');
      return;
    }

    // Check if dry run mode is requested
    const isDryRun = process.argv.includes('--dry-run');

    if (!isDryRun) {
      console.log('⚠️ This will permanently remove duplicate files.');
      console.log('📦 A backup will be created before removal.');
      console.log('');

      // Ask for confirmation for real cleanup
      if (!isInteractive) {
        console.log('🔄 REAL CLEANUP MODE: Files will be permanently removed');
        console.log('💡 Use --dry-run flag to preview changes first');
        console.log('');
      }
    }

    // Execute cleanup
    const result = await cleanupOrchestrator.executeCleanup(cleanupPlan, isDryRun);

    // Generate and save report
    const report = reportingEngine.generateCleanupReport(cleanupPlan, result);
    const reportFilename = isDryRun ? 'duplicate-cleanup-dry-run.md' : 'duplicate-cleanup-report.md';
    await reportingEngine.saveReport(report, reportFilename);

    // Display results
    console.log('\n🎯 CLEANUP RESULTS');
    console.log('==================');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Files processed: ${result.filesRemoved.length}`);
    console.log(`Space saved: ${reportingEngine['formatBytes'](result.spaceSaved)}`);
    console.log(`Processing time: ${Math.round(result.processingTime)}ms`);

    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
    }

    if (isDryRun) {
      console.log('');
      console.log('💡 This was a dry run. No files were actually removed.');
      console.log('💡 To perform actual cleanup, run without --dry-run flag.');
    }

  } catch (error) {
    console.error('❌ Cleanup system error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export {
  RiskAssessmentModule,
  CleanupOrchestrator,
  ReportingEngine,
  type CleanupPlan,
  type CleanupResult,
  type RiskAssessment
};