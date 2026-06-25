/**
 * Bug: returning to a treatment showed a blank Length (MM) for applicators whose
 * own row resolved no seedLength, even though a sibling in the same order had it.
 * seedLength is an order-level value shared across the order, so the formatter
 * must fall back to a sibling's value instead of leaving some rows blank.
 */
import { formatAndEnrichApplicators } from "../../../src/utils/applicatorFormatter";

// Catalog comes straight from PARTNAME in these fixtures, so the Priority
// description lookup is never hit; mock it defensively anyway.
jest.mock("../../../src/services/priorityService", () => ({
  priorityService: {
    getPartNameFromDescription: jest.fn().mockResolvedValue(null),
  },
}));

describe("formatAndEnrichApplicators — order-level seedLength fallback", () => {
  const opts = {
    treatmentId: "T-1",
    priorityIdPrefix: "260423-11",
    defaultUserId: "user-1",
  };

  it("fills a missing seedLength from a sibling when the order lookup is null", async () => {
    const applicators = [
      // A7: no SIBD_SEEDLEN on its own row → previously rendered "-"
      { SERNUM: "260423-11/A7", PARTNAME: "FLEX-00023-FG", INTDATA2: 5 },
      // A8: carries the order's seed length
      {
        SERNUM: "260423-11/A8",
        PARTNAME: "FLEX-00023-FG",
        INTDATA2: 5,
        SIBD_SEEDLEN: 10,
      },
    ];

    const result = await formatAndEnrichApplicators(applicators, {
      ...opts,
      seedLength: null, // order-level lookup returned nothing
    });

    expect(result[0].seedLength).toBe(10); // A7 now inherits the sibling value
    expect(result[1].seedLength).toBe(10);
  });

  it("prefers the explicit order-level seedLength when provided", async () => {
    const applicators = [
      { SERNUM: "260423-11/A7", PARTNAME: "FLEX-00023-FG", INTDATA2: 5 },
    ];

    const result = await formatAndEnrichApplicators(applicators, {
      ...opts,
      seedLength: 12,
    });

    expect(result[0].seedLength).toBe(12);
  });
});
