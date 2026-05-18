/**
 * Regression test for parseTraceabilityMatrix().
 *
 * Bug: the row regex required exactly one space before the closing pipe of
 * the status cell, so column-aligned rows whose status is padded with
 * trailing spaces (e.g. `| Verify      |`) were silently skipped. That
 * undercounted "Verify" requirements (9 instead of 27) and failed the SRS
 * integrity check in CI.
 *
 * Contract: the parser must capture a requirement row regardless of how the
 * status cell is whitespace-padded for column alignment.
 *
 * Runnable standalone (no test runner is configured for scripts/):
 *   npx ts-node scripts/srs/verify-integrity.test.ts
 * Exits 0 on pass, 1 on failure.
 */

import * as assert from "assert";
import * as path from "path";
import { parseTraceabilityMatrix } from "./verify-integrity";

const fixture = path.join(
  __dirname,
  "__fixtures__",
  "trailing-space-matrix.md",
);

const rows = parseTraceabilityMatrix(fixture);
const byId = new Map(rows.map((r) => [r.id, r]));

// Tight, single-space status cell — the control; parses either way.
assert.strictEqual(
  byId.get("SRS-TEST-001")?.status,
  "Implemented",
  "tight status cell should parse",
);

// Padded status cells with trailing spaces — these are what the bug dropped.
assert.strictEqual(
  byId.get("SRS-TEST-002")?.status,
  "Verify",
  "trailing-space status cell (SRS-TEST-002) must be parsed as Verify",
);
assert.strictEqual(
  byId.get("SRS-TEST-003")?.status,
  "Verify",
  "trailing-space status cell (SRS-TEST-003) must be parsed as Verify",
);

// And the whole table must be seen, not just the tight row.
assert.strictEqual(rows.length, 3, "all three requirement rows must parse");

console.log(
  "PASS: parseTraceabilityMatrix tolerates trailing-space status cells",
);
