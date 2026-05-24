import { describe, it, expect } from "vitest";
import { buildApplicatorSummary } from "@/utils/applicatorSummary";
import type { Applicator } from "@shared/types";

// Minimal applicator factory — only the fields the summary reads.
const app = (over: Partial<Applicator>): Applicator =>
  ({
    id: over.serialNumber,
    serialNumber: "SN",
    applicatorType: "",
    seedQuantity: 2,
    usageType: "none",
    insertionTime: new Date().toISOString(),
    insertedSeedsQty: 0,
    comments: "",
    ...over,
  }) as Applicator;

describe("buildApplicatorSummary", () => {
  it("shows the full Priority pool as available before anything is added", () => {
    const pool = [
      app({ serialNumber: "A1" }),
      app({ serialNumber: "A2" }),
      app({ serialNumber: "A3" }),
    ];
    const rows = buildApplicatorSummary([], pool);
    expect(rows).toEqual([
      { seedQuantity: 2, inserted: 0, available: 3, loaded: 0, packaged: 0 },
    ]);
  });

  it("decrements available and increments inserted as applicators are used", () => {
    const pool = [
      app({ serialNumber: "A1" }),
      app({ serialNumber: "A2" }),
      app({ serialNumber: "A3" }),
    ];
    const processed = [app({ serialNumber: "A1", status: "INSERTED" })];
    const [row] = buildApplicatorSummary(processed, pool);
    expect(row).toEqual({
      seedQuantity: 2,
      inserted: 1,
      available: 2,
      loaded: 0,
      packaged: 0,
    });
  });

  it("counts LOADED as both loaded and still available", () => {
    const [row] = buildApplicatorSummary(
      [app({ serialNumber: "A1", status: "LOADED" })],
      [app({ serialNumber: "A1" })],
    );
    expect(row.loaded).toBe(1);
    expect(row.available).toBe(1);
    expect(row.inserted).toBe(0);
  });

  it("does not double-count an applicator present in both pool and processed", () => {
    const rows = buildApplicatorSummary(
      [app({ serialNumber: "A1", status: "INSERTED" })],
      [app({ serialNumber: "A1" }), app({ serialNumber: "A2" })],
    );
    expect(rows[0]).toEqual({
      seedQuantity: 2,
      inserted: 1,
      available: 1,
      loaded: 0,
      packaged: 0,
    });
  });

  it("excludes terminal (FAULTY) applicators from available", () => {
    const [row] = buildApplicatorSummary(
      [app({ serialNumber: "A1", status: "FAULTY" })],
      [app({ serialNumber: "A1" })],
    );
    expect(row.available).toBe(0);
    expect(row.inserted).toBe(0);
  });

  it("groups by seed quantity and counts packaged", () => {
    const rows = buildApplicatorSummary(
      [app({ serialNumber: "A1", seedQuantity: 4, package_label: "P1" })],
      [app({ serialNumber: "B1", seedQuantity: 2 })],
    );
    expect(rows).toEqual([
      { seedQuantity: 2, inserted: 0, available: 1, loaded: 0, packaged: 0 },
      { seedQuantity: 4, inserted: 0, available: 1, loaded: 0, packaged: 1 },
    ]);
  });
});
