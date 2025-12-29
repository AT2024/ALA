#!/usr/bin/env ts-node
/**
 * SRS Integrity Verification Script
 *
 * Validates SRS documentation integrity for IEC 62304 compliance:
 * - All requirement IDs in traceability matrix exist in SRS
 * - All requirements have test case references
 * - Hazard linkages are valid
 * - No orphaned test references
 * - Statistics are accurate
 *
 * Usage:
 *   ts-node verify-integrity.ts
 *   ts-node verify-integrity.ts --strict  # Fail on warnings
 *   ts-node verify-integrity.ts --fix     # Auto-fix minor issues
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Errors found (integrity issues)
 *   2 - Warnings only (non-critical)
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  errors: string[];
  warnings: string[];
  info: string[];
  stats: {
    totalRequirements: number;
    requirementsWithTests: number;
    requirementsWithHazards: number;
    orphanedTests: number;
    missingMappings: number;
  };
}

interface ParsedRequirement {
  id: string;
  description: string;
  hazardId: string;
  testCase: string;
  testType: string;
  status: string;
}

interface MappingFile {
  requirements: Record<string, { files: string[]; tests: string[]; description: string }>;
}

// Parse command line arguments
function parseArgs(): { strict: boolean; fix: boolean } {
  const args = process.argv.slice(2);
  return {
    strict: args.includes('--strict'),
    fix: args.includes('--fix'),
  };
}

// Read and parse the traceability matrix
function parseTraceabilityMatrix(filePath: string): ParsedRequirement[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const requirements: ParsedRequirement[] = [];

  // Match requirement rows in tables
  const rowRegex = /\| (SRS-[A-Z]+-\d+) \| ([^|]+) \| ([^|]*) \| ([^|]+) \| ([^|]+) \| (\w+) \|/g;

  let match;
  while ((match = rowRegex.exec(content)) !== null) {
    requirements.push({
      id: match[1].trim(),
      description: match[2].trim(),
      hazardId: match[3].trim(),
      testCase: match[4].trim(),
      testType: match[5].trim(),
      status: match[6].trim(),
    });
  }

  return requirements;
}

// Parse hazard analysis file
function parseHazardAnalysis(filePath: string): Set<string> {
  const hazards = new Set<string>();

  if (!fs.existsSync(filePath)) {
    return hazards;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Match hazard IDs (HAZ-001, HAZ-002, etc.)
  const hazardRegex = /HAZ-\d{3}/g;
  let match;
  while ((match = hazardRegex.exec(content)) !== null) {
    hazards.add(match[0]);
  }

  return hazards;
}

// Parse requirement mapping file
function parseMappingFile(filePath: string): MappingFile | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Verify all requirements have code mappings
function verifyCodeMappings(
  requirements: ParsedRequirement[],
  mapping: MappingFile | null
): { missing: string[]; orphaned: string[] } {
  const missing: string[] = [];
  const orphaned: string[] = [];

  const mappedReqs = new Set(Object.keys(mapping?.requirements || {}));
  const matrixReqs = new Set(requirements.map(r => r.id));

  // Find requirements in matrix without mapping
  for (const req of matrixReqs) {
    if (!mappedReqs.has(req)) {
      missing.push(req);
    }
  }

  // Find orphaned mappings (in mapping file but not in matrix)
  for (const req of mappedReqs) {
    if (!matrixReqs.has(req)) {
      orphaned.push(req);
    }
  }

  return { missing, orphaned };
}

// Verify hazard linkages
function verifyHazardLinkages(
  requirements: ParsedRequirement[],
  validHazards: Set<string>
): string[] {
  const errors: string[] = [];

  for (const req of requirements) {
    if (!req.hazardId || req.hazardId === '-') {
      continue;
    }

    // Handle multiple hazards (e.g., "HAZ-001, HAZ-003")
    const hazardIds = req.hazardId.split(',').map(h => h.trim());

    for (const hazardId of hazardIds) {
      if (!validHazards.has(hazardId)) {
        errors.push(`${req.id}: Invalid hazard reference "${hazardId}"`);
      }
    }
  }

  return errors;
}

// Verify test case format
function verifyTestCases(requirements: ParsedRequirement[]): string[] {
  const errors: string[] = [];
  const seenTestCases = new Set<string>();

  for (const req of requirements) {
    // Check test case format (TC-XXXX-NNN)
    const expectedTestCase = req.id.replace('SRS-', 'TC-');

    if (req.testCase !== expectedTestCase) {
      errors.push(`${req.id}: Test case mismatch. Expected "${expectedTestCase}", found "${req.testCase}"`);
    }

    // Check for duplicate test cases
    if (seenTestCases.has(req.testCase)) {
      errors.push(`${req.id}: Duplicate test case reference "${req.testCase}"`);
    }
    seenTestCases.add(req.testCase);
  }

  return errors;
}

// Verify statistics accuracy
function verifyStatistics(content: string, requirements: ParsedRequirement[]): string[] {
  const errors: string[] = [];

  // Count actual statuses
  const statusCounts = {
    implemented: requirements.filter(r => r.status.toLowerCase() === 'implemented').length,
    verify: requirements.filter(r => r.status.toLowerCase() === 'verify').length,
    pending: requirements.filter(r => r.status.toLowerCase() === 'pending').length,
  };

  const total = statusCounts.implemented + statusCounts.verify + statusCounts.pending;

  // Extract claimed statistics from content
  const totalMatch = content.match(/\*\*TOTAL\*\* \| \*\*(\d+)\*\*/);
  const implMatch = content.match(/\*\*Implemented\*\*: (\d+)/);
  const verifyMatch = content.match(/\*\*Needs Verification\*\*: (\d+)/);
  const pendingMatch = content.match(/\*\*Pending Implementation\*\*: (\d+)/);

  if (totalMatch && parseInt(totalMatch[1]) !== total) {
    errors.push(`Statistics mismatch: Total claimed ${totalMatch[1]}, actual ${total}`);
  }

  if (implMatch && parseInt(implMatch[1]) !== statusCounts.implemented) {
    errors.push(`Statistics mismatch: Implemented claimed ${implMatch[1]}, actual ${statusCounts.implemented}`);
  }

  if (verifyMatch && parseInt(verifyMatch[1]) !== statusCounts.verify) {
    errors.push(`Statistics mismatch: Verify claimed ${verifyMatch[1]}, actual ${statusCounts.verify}`);
  }

  if (pendingMatch && parseInt(pendingMatch[1]) !== statusCounts.pending) {
    errors.push(`Statistics mismatch: Pending claimed ${pendingMatch[1]}, actual ${statusCounts.pending}`);
  }

  return errors;
}

// Verify requirement ID sequence
function verifyRequirementSequence(requirements: ParsedRequirement[]): string[] {
  const warnings: string[] = [];
  const categorySequences: Record<string, number[]> = {};

  for (const req of requirements) {
    const match = req.id.match(/^SRS-([A-Z]+)-(\d+)$/);
    if (match) {
      const [, category, numStr] = match;
      const num = parseInt(numStr);

      if (!categorySequences[category]) {
        categorySequences[category] = [];
      }
      categorySequences[category].push(num);
    }
  }

  // Check for gaps in sequences
  for (const [category, nums] of Object.entries(categorySequences)) {
    const sorted = [...nums].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] > 1) {
        warnings.push(
          `Gap in ${category} sequence: SRS-${category}-${sorted[i].toString().padStart(3, '0')} to SRS-${category}-${sorted[i + 1].toString().padStart(3, '0')}`
        );
      }
    }
  }

  return warnings;
}

// Main verification
function verify(): VerificationResult {
  const result: VerificationResult = {
    errors: [],
    warnings: [],
    info: [],
    stats: {
      totalRequirements: 0,
      requirementsWithTests: 0,
      requirementsWithHazards: 0,
      orphanedTests: 0,
      missingMappings: 0,
    },
  };

  const basePath = path.resolve(__dirname, '../../docs/srs');
  const matrixPath = path.join(basePath, 'traceability-matrix.md');
  const hazardPath = path.join(basePath, 'hazard-analysis.md');
  const mappingPath = path.join(basePath, 'requirement-mapping.json');

  // Check file existence
  if (!fs.existsSync(matrixPath)) {
    result.errors.push(`Traceability matrix not found: ${matrixPath}`);
    return result;
  }

  // Parse files
  const matrixContent = fs.readFileSync(matrixPath, 'utf-8');
  const requirements = parseTraceabilityMatrix(matrixPath);
  const validHazards = parseHazardAnalysis(hazardPath);
  const mapping = parseMappingFile(mappingPath);

  result.stats.totalRequirements = requirements.length;
  result.info.push(`Total requirements found: ${requirements.length}`);

  // Verify hazard linkages
  const hazardErrors = verifyHazardLinkages(requirements, validHazards);
  result.errors.push(...hazardErrors);
  result.stats.requirementsWithHazards = requirements.filter(r => r.hazardId && r.hazardId !== '-').length;
  result.info.push(`Requirements with hazard links: ${result.stats.requirementsWithHazards}`);

  // Verify test cases
  const testErrors = verifyTestCases(requirements);
  result.errors.push(...testErrors);
  result.stats.requirementsWithTests = requirements.filter(r => r.testCase && r.testCase !== '-').length;
  result.info.push(`Requirements with test cases: ${result.stats.requirementsWithTests}`);

  // Verify code mappings
  if (mapping) {
    const { missing, orphaned } = verifyCodeMappings(requirements, mapping);
    result.stats.missingMappings = missing.length;
    result.stats.orphanedTests = orphaned.length;

    if (missing.length > 0) {
      result.warnings.push(`Requirements without code mapping: ${missing.join(', ')}`);
    }
    if (orphaned.length > 0) {
      result.warnings.push(`Orphaned mappings (not in matrix): ${orphaned.join(', ')}`);
    }
  } else {
    result.warnings.push('Requirement mapping file not found');
  }

  // Verify statistics
  const statsErrors = verifyStatistics(matrixContent, requirements);
  result.errors.push(...statsErrors);

  // Verify requirement sequence (warnings only)
  const sequenceWarnings = verifyRequirementSequence(requirements);
  result.warnings.push(...sequenceWarnings);

  return result;
}

// Print results and exit with appropriate code
function printResults(result: VerificationResult, strict: boolean): number {
  console.log('\n=== SRS Integrity Verification Report ===\n');

  // Print info
  console.log('Summary:');
  for (const info of result.info) {
    console.log(`  ${info}`);
  }
  console.log();

  // Print stats
  console.log('Statistics:');
  console.log(`  Total Requirements: ${result.stats.totalRequirements}`);
  console.log(`  With Test Cases: ${result.stats.requirementsWithTests}`);
  console.log(`  With Hazard Links: ${result.stats.requirementsWithHazards}`);
  console.log(`  Missing Mappings: ${result.stats.missingMappings}`);
  console.log(`  Orphaned Mappings: ${result.stats.orphanedTests}`);
  console.log();

  // Print errors
  if (result.errors.length > 0) {
    console.log(`ERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  [ERROR] ${error}`);
    }
    console.log();
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log(`WARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  [WARN] ${warning}`);
    }
    console.log();
  }

  // Determine exit code
  if (result.errors.length > 0) {
    console.log('RESULT: FAILED - Integrity errors found');
    return 1;
  }

  if (result.warnings.length > 0 && strict) {
    console.log('RESULT: FAILED - Warnings found (strict mode)');
    return 2;
  }

  if (result.warnings.length > 0) {
    console.log('RESULT: PASSED with warnings');
    return 0;
  }

  console.log('RESULT: PASSED - All integrity checks passed');
  return 0;
}

// Main execution
function main(): void {
  const { strict, fix } = parseArgs();

  if (fix) {
    console.log('Note: --fix mode not yet implemented. Running verification only.');
  }

  const result = verify();
  const exitCode = printResults(result, strict);

  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { verify, parseTraceabilityMatrix, verifyHazardLinkages };
