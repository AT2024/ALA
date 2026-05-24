// Audit-reason builder: faulty applicators must record the dosimetry-critical
// inserted-seed count in the (immutable) audit trail, not just on the mutable row.
import { describe, test, expect } from "@jest/globals";
import { buildApplicatorAuditReason } from "../../../src/utils/applicatorAudit";

describe("buildApplicatorAuditReason", () => {
  test("faulty: appends insertedSeedsQty to the operator comments", () => {
    expect(
      buildApplicatorAuditReason("faulty", 2, "partial insertion before fault"),
    ).toBe("partial insertion before fault [insertedSeedsQty=2]");
  });

  test("faulty with zero seeds and no comments: records the count alone", () => {
    expect(buildApplicatorAuditReason("faulty", 0, undefined)).toBe(
      "[insertedSeedsQty=0]",
    );
  });

  test("non-faulty: reason is the comments, unchanged", () => {
    expect(buildApplicatorAuditReason("full", 5, "all good")).toBe("all good");
    expect(buildApplicatorAuditReason("none", 0, undefined)).toBeUndefined();
  });

  test("faulty with unknown (null) count: falls back to comments only", () => {
    expect(buildApplicatorAuditReason("faulty", null, "see notes")).toBe(
      "see notes",
    );
  });
});
