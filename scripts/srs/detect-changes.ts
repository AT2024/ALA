#!/usr/bin/env ts-node
/**
 * SRS Change Detection Script
 *
 * Analyzes git diff output to identify affected SRS requirements.
 * Uses requirement-mapping.json for O(1) lookups instead of scanning entire codebase.
 *
 * Usage:
 *   ts-node detect-changes.ts "file1.ts file2.ts ..."
 *   git diff --name-only HEAD~1 | xargs ts-node detect-changes.ts
 *
 * Output (GitHub Actions format):
 *   has_changes=true
 *   requirements=SRS-AUTH-001,SRS-SCAN-003
 */

import * as fs from 'fs';
import * as path from 'path';

interface RequirementMapping {
  files: string[];
  tests: string[];
  description: string;
}

interface MappingFile {
  _meta: {
    description: string;
    version: string;
    lastUpdated: string;
    totalRequirements: number;
  };
  requirements: Record<string, RequirementMapping>;
}

// Build reverse index: file path -> requirement IDs
function buildReverseIndex(mapping: MappingFile): Map<string, Set<string>> {
  const reverseIndex = new Map<string, Set<string>>();

  for (const [reqId, reqMapping] of Object.entries(mapping.requirements)) {
    // Index implementation files
    for (const file of reqMapping.files) {
      const normalizedPath = file.replace(/\\/g, '/');
      if (!reverseIndex.has(normalizedPath)) {
        reverseIndex.set(normalizedPath, new Set());
      }
      reverseIndex.get(normalizedPath)!.add(reqId);
    }

    // Index test files
    for (const testFile of reqMapping.tests) {
      const normalizedPath = testFile.replace(/\\/g, '/');
      if (!reverseIndex.has(normalizedPath)) {
        reverseIndex.set(normalizedPath, new Set());
      }
      reverseIndex.get(normalizedPath)!.add(reqId);
    }
  }

  return reverseIndex;
}

// Find requirements affected by changed files
function findAffectedRequirements(
  changedFiles: string[],
  reverseIndex: Map<string, Set<string>>
): Set<string> {
  const affectedRequirements = new Set<string>();

  for (const file of changedFiles) {
    const normalizedPath = file.replace(/\\/g, '/').trim();

    // Direct match
    const directMatch = reverseIndex.get(normalizedPath);
    if (directMatch) {
      directMatch.forEach(req => affectedRequirements.add(req));
    }

    // Pattern matching for directory-level changes
    // e.g., if backend/src/services/priorityService.ts changes, match it
    for (const [mappedPath, reqs] of reverseIndex.entries()) {
      if (normalizedPath.endsWith(mappedPath) || mappedPath.endsWith(normalizedPath)) {
        reqs.forEach(req => affectedRequirements.add(req));
      }
    }
  }

  return affectedRequirements;
}

// Categorize requirements by type
function categorizeRequirements(requirements: Set<string>): Record<string, string[]> {
  const categories: Record<string, string[]> = {};

  for (const req of requirements) {
    // Extract category from requirement ID (e.g., SRS-AUTH-001 -> AUTH)
    const match = req.match(/^SRS-([A-Z]+)-\d+$/);
    if (match) {
      const category = match[1];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(req);
    }
  }

  // Sort requirements within each category
  for (const category of Object.keys(categories)) {
    categories[category].sort();
  }

  return categories;
}

// Main execution
function main(): void {
  const args = process.argv.slice(2);

  // Parse changed files from arguments
  let changedFiles: string[] = [];
  if (args.length > 0) {
    // Files can be passed as single space-separated string or multiple arguments
    changedFiles = args.flatMap(arg => arg.split(/\s+/).filter(f => f.trim()));
  }

  // Read requirement mapping
  const mappingPath = path.resolve(__dirname, '../../docs/srs/requirement-mapping.json');

  if (!fs.existsSync(mappingPath)) {
    console.error(`Error: Requirement mapping file not found at ${mappingPath}`);
    console.log('has_changes=false');
    process.exit(1);
  }

  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mapping: MappingFile = JSON.parse(mappingContent);

  // Build reverse index
  const reverseIndex = buildReverseIndex(mapping);

  // Find affected requirements
  const affectedRequirements = findAffectedRequirements(changedFiles, reverseIndex);

  // Output results in GitHub Actions format
  if (affectedRequirements.size === 0) {
    console.log('has_changes=false');
    console.log('requirements=');

    // Also output human-readable summary to stderr
    console.error('\n--- SRS Change Detection Summary ---');
    console.error(`Changed files analyzed: ${changedFiles.length}`);
    console.error('Affected requirements: None');
    console.error('No SRS documentation update needed.');
  } else {
    const requirementsList = Array.from(affectedRequirements).sort().join(',');
    console.log('has_changes=true');
    console.log(`requirements=${requirementsList}`);

    // Human-readable summary to stderr
    const categories = categorizeRequirements(affectedRequirements);
    console.error('\n--- SRS Change Detection Summary ---');
    console.error(`Changed files analyzed: ${changedFiles.length}`);
    console.error(`Affected requirements: ${affectedRequirements.size}`);
    console.error('\nBy category:');
    for (const [category, reqs] of Object.entries(categories).sort()) {
      console.error(`  ${category}: ${reqs.join(', ')}`);
    }

    // List changed files that matched
    console.error('\nMatched files:');
    for (const file of changedFiles) {
      const normalizedPath = file.replace(/\\/g, '/').trim();
      const matches = reverseIndex.get(normalizedPath);
      if (matches && matches.size > 0) {
        console.error(`  ${file} -> ${Array.from(matches).join(', ')}`);
      }
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { buildReverseIndex, findAffectedRequirements, categorizeRequirements };
