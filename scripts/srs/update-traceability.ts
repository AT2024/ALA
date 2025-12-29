#!/usr/bin/env ts-node
/**
 * SRS Traceability Matrix Updater
 *
 * Updates the traceability matrix based on:
 * - Affected requirements from git changes
 * - Test results (pass/fail status)
 * - Adds revision history entries
 * - Recalculates statistics
 *
 * Usage:
 *   ts-node update-traceability.ts --requirements "SRS-AUTH-001,SRS-SCAN-003"
 *   ts-node update-traceability.ts --requirements "SRS-AUTH-001" --test-results ./coverage/results.json
 *
 * Output:
 *   Updates docs/srs/traceability-matrix.md in place
 *   Creates backup at docs/srs/traceability-matrix.md.bak
 */

import * as fs from 'fs';
import * as path from 'path';

interface UpdateOptions {
  requirements: string[];
  testResultsPath?: string;
  commitRange?: string;
  dryRun?: boolean;
}

interface TestResult {
  requirementId: string;
  testCase: string;
  passed: boolean;
  duration?: number;
}

interface StatusCount {
  implemented: number;
  verify: number;
  pending: number;
}

interface CategoryStats {
  [category: string]: StatusCount;
}

// Parse command line arguments
function parseArgs(): UpdateOptions {
  const args = process.argv.slice(2);
  const options: UpdateOptions = {
    requirements: [],
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--requirements':
        options.requirements = args[++i]?.split(',').map(r => r.trim()) || [];
        break;
      case '--test-results':
        options.testResultsPath = args[++i];
        break;
      case '--commit-range':
        options.commitRange = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }

  return options;
}

// Read and parse the traceability matrix markdown
function readTraceabilityMatrix(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Traceability matrix not found at ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Parse test results from Jest/Vitest output
function parseTestResults(testResultsPath: string): Map<string, TestResult> {
  const results = new Map<string, TestResult>();

  if (!fs.existsSync(testResultsPath)) {
    console.warn(`Test results file not found: ${testResultsPath}`);
    return results;
  }

  try {
    const content = fs.readFileSync(testResultsPath, 'utf-8');
    const json = JSON.parse(content);

    // Support Jest and Vitest result formats
    const testSuites = json.testResults || json.suites || [];

    for (const suite of testSuites) {
      const tests = suite.assertionResults || suite.tests || [];
      for (const test of tests) {
        // Extract requirement ID from test name (e.g., "TC-AUTH-001" -> "SRS-AUTH-001")
        const match = test.title?.match(/TC-([A-Z]+-\d+)/);
        if (match) {
          const reqId = `SRS-${match[1]}`;
          results.set(reqId, {
            requirementId: reqId,
            testCase: `TC-${match[1]}`,
            passed: test.status === 'passed',
            duration: test.duration,
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Error parsing test results: ${error}`);
  }

  return results;
}

// Update a single requirement row in the matrix
function updateRequirementStatus(
  content: string,
  reqId: string,
  testResults: Map<string, TestResult>
): string {
  // Find the row for this requirement
  const rowRegex = new RegExp(
    `(\\| ${reqId} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|)\\s*(\\w+)\\s*\\|`,
    'g'
  );

  return content.replace(rowRegex, (match, prefix, currentStatus) => {
    const testResult = testResults.get(reqId);

    // Only update if we have test results
    if (testResult) {
      const newStatus = testResult.passed ? 'Implemented' : 'Verify';
      return `${prefix} ${newStatus} |`;
    }

    return match;
  });
}

// Add a revision history entry
function addRevisionEntry(
  content: string,
  commitRange: string | undefined,
  requirements: string[]
): string {
  const today = new Date().toISOString().split('T')[0];
  const version = extractNextVersion(content);
  const description = `Auto-update: ${requirements.length} requirements affected by ${commitRange || 'merge to main'}`;

  // Find the revision history table and add a new row
  const revisionTableRegex = /(## 4\. Revision History\s*\n\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*\n\|[-|]+\|)/;

  return content.replace(revisionTableRegex, (match) => {
    return `${match}\n| ${version} | ${today} | Claude Code | ${description} |`;
  });
}

// Extract next version number from content
function extractNextVersion(content: string): string {
  const versionMatch = content.match(/\| (\d+\.\d+) \| \d{4}-\d{2}-\d{2}/g);
  if (versionMatch && versionMatch.length > 0) {
    const lastVersion = versionMatch[versionMatch.length - 1].match(/\| (\d+\.\d+)/)?.[1];
    if (lastVersion) {
      const [major, minor] = lastVersion.split('.').map(Number);
      return `${major}.${minor + 1}`;
    }
  }
  return '1.1';
}

// Recalculate statistics from the matrix content
function recalculateStatistics(content: string): CategoryStats {
  const stats: CategoryStats = {};

  // Find all requirement rows
  const rowRegex = /\| (SRS-([A-Z]+)-\d+) \|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*(\w+)\s*\|/g;

  let match;
  while ((match = rowRegex.exec(content)) !== null) {
    const category = match[2];
    const status = match[3].toLowerCase();

    if (!stats[category]) {
      stats[category] = { implemented: 0, verify: 0, pending: 0 };
    }

    if (status === 'implemented') {
      stats[category].implemented++;
    } else if (status === 'verify') {
      stats[category].verify++;
    } else if (status === 'pending') {
      stats[category].pending++;
    }
  }

  return stats;
}

// Update the statistics section in the content
function updateStatisticsSection(content: string, stats: CategoryStats): string {
  // Calculate totals
  let totalImplemented = 0;
  let totalVerify = 0;
  let totalPending = 0;

  for (const category of Object.values(stats)) {
    totalImplemented += category.implemented;
    totalVerify += category.verify;
    totalPending += category.pending;
  }

  const total = totalImplemented + totalVerify + totalPending;

  // Update the summary statistics
  const implementedPercent = ((totalImplemented / total) * 100).toFixed(1);
  const verifyPercent = ((totalVerify / total) * 100).toFixed(1);
  const pendingPercent = ((totalPending / total) * 100).toFixed(1);

  // Update the coverage section
  content = content.replace(
    /\*\*Implemented\*\*: \d+ \(\d+\.\d+%\)/,
    `**Implemented**: ${totalImplemented} (${implementedPercent}%)`
  );
  content = content.replace(
    /\*\*Needs Verification\*\*: \d+ \(\d+\.\d+%\)/,
    `**Needs Verification**: ${totalVerify} (${verifyPercent}%)`
  );
  content = content.replace(
    /\*\*Pending Implementation\*\*: \d+ \(\d+\.\d+%\)/,
    `**Pending Implementation**: ${totalPending} (${pendingPercent}%)`
  );

  // Update total row
  content = content.replace(
    /\| \*\*TOTAL\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \|/,
    `| **TOTAL** | **${total}** | **${totalImplemented}** | **${totalVerify}** | **${totalPending}** |`
  );

  return content;
}

// Main execution
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.requirements.length === 0) {
    console.log('No requirements specified. Nothing to update.');
    return;
  }

  const matrixPath = path.resolve(__dirname, '../../docs/srs/traceability-matrix.md');

  console.log(`\n--- SRS Traceability Matrix Update ---`);
  console.log(`Requirements to update: ${options.requirements.join(', ')}`);
  console.log(`Matrix file: ${matrixPath}`);
  console.log(`Dry run: ${options.dryRun}`);

  // Read current content
  let content = readTraceabilityMatrix(matrixPath);

  // Create backup
  if (!options.dryRun) {
    fs.writeFileSync(`${matrixPath}.bak`, content);
    console.log(`Backup created: ${matrixPath}.bak`);
  }

  // Parse test results if provided
  const testResults = options.testResultsPath
    ? parseTestResults(options.testResultsPath)
    : new Map<string, TestResult>();

  console.log(`Test results loaded: ${testResults.size} requirements`);

  // Update each affected requirement
  for (const reqId of options.requirements) {
    content = updateRequirementStatus(content, reqId, testResults);
  }

  // Add revision history entry
  content = addRevisionEntry(content, options.commitRange, options.requirements);

  // Recalculate and update statistics
  const stats = recalculateStatistics(content);
  content = updateStatisticsSection(content, stats);

  // Output or save
  if (options.dryRun) {
    console.log('\n--- Dry Run Output ---');
    console.log('Statistics:');
    for (const [category, counts] of Object.entries(stats)) {
      const total = counts.implemented + counts.verify + counts.pending;
      console.log(`  ${category}: ${total} total (${counts.implemented} impl, ${counts.verify} verify, ${counts.pending} pending)`);
    }
  } else {
    fs.writeFileSync(matrixPath, content);
    console.log(`\nTraceability matrix updated successfully.`);

    // Log statistics
    console.log('\nUpdated Statistics:');
    let totalAll = 0;
    let totalImpl = 0;
    for (const [category, counts] of Object.entries(stats)) {
      const total = counts.implemented + counts.verify + counts.pending;
      totalAll += total;
      totalImpl += counts.implemented;
      console.log(`  ${category}: ${counts.implemented}/${total} implemented`);
    }
    console.log(`  TOTAL: ${totalImpl}/${totalAll} (${((totalImpl / totalAll) * 100).toFixed(1)}%)`);
  }
}

// Run if executed directly
main().catch(console.error);

export { parseArgs, recalculateStatistics, updateStatisticsSection };
