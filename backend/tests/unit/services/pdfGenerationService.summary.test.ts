import {
  calculateSummary,
  Treatment,
  Applicator,
} from "../../../src/services/pdfGenerationService";

/**
 * Bugs 4 & 6: the PDF/email summary must use the EFFECTIVE status (status-first,
 * usageType fallback) and the per-applicator deployed-seed count, exactly like
 * the on-screen frontend total. The previous implementation filtered
 * `status === "INSERTED"` only (dropping legacy rows that carry just a
 * usageType) and summed the full `seedQuantity` even for faulty/partial
 * applicators, so the emailed totals were wrong.
 */
describe("calculateSummary (effective-status seed counting)", () => {
  const treatment: Treatment = {
    id: "T1",
    type: "skin_insertion",
    subjectId: "P-1",
    site: "Test Site",
    date: "2026-06-01",
    surgeon: "Dr. Test",
    activityPerSeed: 2.5,
  };

  const base = {
    insertionTime: "2026-06-01T10:00:00.000Z",
    applicatorType: "Alpha Flex Applicator",
  };

  const applicators: Applicator[] = [
    // INSERTED with a partial inserted count → counts 2 (not the seedQuantity 3)
    {
      ...base,
      id: "1",
      serialNumber: "SO/A1",
      seedQuantity: 3,
      usageType: "full",
      status: "INSERTED",
      insertedSeedsQty: 2,
    },
    // FAULTY → counts the partial insertedSeedsQty (2), not the full 5
    {
      ...base,
      id: "2",
      serialNumber: "SO/A2",
      seedQuantity: 5,
      usageType: "faulty",
      status: "FAULTY",
      insertedSeedsQty: 2,
    },
    // Legacy row: no status, only usageType "full" → still counts (seedQuantity 2)
    {
      ...base,
      id: "3",
      serialNumber: "SO/A3",
      seedQuantity: 2,
      usageType: "full",
      status: null,
    },
    // SEALED / not deployed → contributes 0
    {
      ...base,
      id: "4",
      serialNumber: "SO/A4",
      seedQuantity: 3,
      usageType: "none",
      status: "SEALED",
    },
    // INSERTED with no partial recorded → falls back to seedQuantity 4
    {
      ...base,
      id: "5",
      serialNumber: "SO/A5",
      seedQuantity: 4,
      usageType: "full",
      status: "INSERTED",
    },
  ];

  it("sums only the sources actually deployed (full=inserted/seedQty, faulty=partial, else 0)", () => {
    const summary = calculateSummary(treatment, applicators);
    // 2 (A1 partial) + 2 (A2 faulty) + 2 (A3 legacy full) + 0 (A4 sealed) + 4 (A5 full) = 10
    expect(summary.totalDartSeedsInserted).toBe(10);
  });

  it("counts applicators by effective status, not raw usageType", () => {
    const summary = calculateSummary(treatment, applicators);
    expect(summary.totalApplicatorUse).toBe(4); // A1, A2, A3, A5 used
    expect(summary.faultyApplicator).toBe(1); // A2
    expect(summary.notUsedApplicators).toBe(1); // A4
  });

  it("derives total activity from deployed sources", () => {
    const summary = calculateSummary(treatment, applicators);
    expect(summary.totalActivity).toBeCloseTo(25); // 10 * 2.5
  });

  it("does not over-count a legacy row that only carries usageType", () => {
    const legacyOnly: Applicator[] = [
      {
        ...base,
        id: "9",
        serialNumber: "SO/A9",
        seedQuantity: 3,
        usageType: "full",
        status: null,
      },
    ];
    const summary = calculateSummary(treatment, legacyOnly);
    expect(summary.totalDartSeedsInserted).toBe(3);
    expect(summary.totalApplicatorUse).toBe(1);
  });
});
