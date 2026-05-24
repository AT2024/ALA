// Priority Data Transformer - faulty insertedSeedsQty validation
import { describe, test, expect, jest } from "@jest/globals";

// Logger is noisy and irrelevant to the transformation logic under test.
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { transformPriorityApplicatorData } from "../../../src/utils/priorityDataTransformer";

describe("priorityDataTransformer", () => {
  describe("transformPriorityApplicatorData - faulty insertedSeedsQty bounds", () => {
    const base = {
      serialNumber: "260423-11/A8",
      status: "FAULTY",
      insertionTime: new Date("2026-05-20T10:54:00Z"),
      seedQuantity: 5,
      comments: "partial insertion before fault", // required for faulty rows
    };

    test("accepts a faulty count within [0, seedQuantity]", () => {
      const result = transformPriorityApplicatorData({
        ...base,
        usageType: "faulty",
        insertedSeedsQty: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.usageType).toBe("faulty");
      expect(result.data?.insertedSeedsQty).toBe(2);
    });

    test("rejects a faulty count greater than seedQuantity (over-report guard)", () => {
      // Dosimetry guard: an operator must not be able to record more inserted
      // seeds than the applicator's capacity. Out-of-range => success:false so
      // the bad value is never persisted.
      const result = transformPriorityApplicatorData({
        ...base,
        usageType: "faulty",
        insertedSeedsQty: 999, // > capacity (5)
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/must be between 0 and seedQuantity/),
        ]),
      );
    });

    test("floors a negative faulty count to 0 (fail-safe: never over-report)", () => {
      // A negative count is nonsensical input; flooring to 0 (no seeds) is the
      // conservative direction for dosimetry and keeps the value in range.
      const result = transformPriorityApplicatorData({
        ...base,
        usageType: "faulty",
        insertedSeedsQty: -1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.insertedSeedsQty).toBe(0);
    });
  });
});
