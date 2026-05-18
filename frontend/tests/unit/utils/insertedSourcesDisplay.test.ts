// Regression coverage for the FAULTY partial-insert display bug.
//
// Bug: a FAULTY applicator that deployed 1 of 2 sources showed "2" in the
// Processed Applicators "Inserted Sources Qty." column and was not counted as
// faulty, because the table read the legacy `usageType` (stale "full") instead
// of the 8-state `status`. These helpers now derive everything status-first.
import { describe, it, expect } from "vitest";
import {
  getEffectiveStatus,
  getDisplayedInsertedSeeds,
  DARK_ROW_STATUSES,
  APPLICATOR_STATUSES,
} from "../../../src/utils/applicatorStatus";

describe("getEffectiveStatus (status-first, usageType fallback)", () => {
  it("prefers explicit status even when usageType is stale 'full'", () => {
    expect(getEffectiveStatus("FAULTY", "full")).toBe("FAULTY");
  });

  it("falls back to usageType only when status is absent", () => {
    expect(getEffectiveStatus(null, "full")).toBe(APPLICATOR_STATUSES.INSERTED);
    expect(getEffectiveStatus(undefined, "faulty")).toBe(
      APPLICATOR_STATUSES.FAULTY,
    );
    expect(getEffectiveStatus("", "none")).toBe(APPLICATOR_STATUSES.SEALED);
  });
});

describe("getDisplayedInsertedSeeds", () => {
  it("FAULTY with stale usageType 'full' shows actual inserted (1 of 2), not 2", () => {
    expect(
      getDisplayedInsertedSeeds({
        status: "FAULTY",
        usageType: "full", // stale legacy value — the original bug
        insertedSeedsQty: 1,
        seedQuantity: 2,
      }),
    ).toBe(1);
  });

  it("FAULTY with no seeds deployed shows 0", () => {
    expect(
      getDisplayedInsertedSeeds({
        status: "FAULTY",
        usageType: "faulty",
        insertedSeedsQty: 0,
        seedQuantity: 2,
      }),
    ).toBe(0);
  });

  it("INSERTED full applicator shows insertedSeedsQty when present", () => {
    expect(
      getDisplayedInsertedSeeds({
        status: "INSERTED",
        usageType: "full",
        insertedSeedsQty: 2,
        seedQuantity: 2,
      }),
    ).toBe(2);
  });

  it("INSERTED legacy record without insertedSeedsQty falls back to seedQuantity", () => {
    expect(
      getDisplayedInsertedSeeds({
        status: "INSERTED",
        usageType: "full",
        seedQuantity: 3,
      }),
    ).toBe(3);
  });

  it("non-used statuses contribute 0", () => {
    expect(
      getDisplayedInsertedSeeds({ status: "SEALED", seedQuantity: 2 }),
    ).toBe(0);
  });

  it("per-row values sum to the same total as the FAULTY scenario (2 + 1 = 3)", () => {
    const inserted = getDisplayedInsertedSeeds({
      status: "INSERTED",
      usageType: "full",
      insertedSeedsQty: 2,
      seedQuantity: 2,
    });
    const faulty = getDisplayedInsertedSeeds({
      status: "FAULTY",
      usageType: "full",
      insertedSeedsQty: 1,
      seedQuantity: 2,
    });
    expect(inserted + faulty).toBe(3);
  });
});

describe("DARK_ROW_STATUSES", () => {
  it("FAULTY renders as a dark (black) row", () => {
    expect(DARK_ROW_STATUSES).toContain(APPLICATOR_STATUSES.FAULTY);
  });

  it("INSERTED and SEALED are not dark rows", () => {
    expect(DARK_ROW_STATUSES).not.toContain(APPLICATOR_STATUSES.INSERTED);
    expect(DARK_ROW_STATUSES).not.toContain(APPLICATOR_STATUSES.SEALED);
  });
});

// Regression for the medical-safety review findings (H2 / R3): the per-row
// "Inserted Sources Qty." cell and the Treatment Summary "Total DaRT Sources
// Inserted" total must agree. Both now derive from the effective status, so
// summing the per-row helper over a batch equals the clinical total even when
// a record carries a stale usageType. getActualInsertedSeeds in
// TreatmentContext applies the identical INSERTED/FAULTY rule by status.
describe("per-row sum equals the clinical total (status-first)", () => {
  it("a stale-FAULTY + FAULTY-0 + INSERTED batch sums to the deployed count", () => {
    const batch = [
      // INSERTED full: 2 deployed.
      {
        status: "INSERTED",
        usageType: "full",
        insertedSeedsQty: 2,
        seedQuantity: 2,
      },
      // FAULTY with stale usageType "full" (the original bug): 1 deployed,
      // must count 1 — not seedQuantity (2).
      {
        status: "FAULTY",
        usageType: "full",
        insertedSeedsQty: 1,
        seedQuantity: 2,
      },
      // FAULTY that deployed 0 sources (R3): must stay 0, not inflate to 2.
      {
        status: "FAULTY",
        usageType: "faulty",
        insertedSeedsQty: 0,
        seedQuantity: 2,
      },
    ];
    const total = batch.reduce(
      (sum, app) => sum + getDisplayedInsertedSeeds(app),
      0,
    );
    expect(batch.map(getDisplayedInsertedSeeds)).toEqual([2, 1, 0]);
    expect(total).toBe(3);
  });
});
