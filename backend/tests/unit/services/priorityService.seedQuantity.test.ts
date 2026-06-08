// Bug 2: clicking "Validate Serial Number" must keep the real per-applicator
// seed quantity (INTDATA2 from the order subform), and must NOT fabricate a
// count. The old getPartDetails defaulted to 25 (an order of magnitude above
// real values like 2/3/5), which silently overwrote the operator's count.
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAxiosInstance: { get: jest.Mock<any> } = { get: jest.fn() };

jest.mock("axios", () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: { create: jest.fn(() => mockAxiosInstance) },
}));

jest.mock("fs", () => ({ readFileSync: jest.fn(), existsSync: jest.fn() }));

import priorityService from "../../../src/services/priorityService";

describe("Priority Service - seed quantity sourcing (bug 2)", () => {
  beforeEach(() => {
    mockAxiosInstance.get.mockReset();
  });

  describe("getApplicatorFromPriority", () => {
    test("returns the per-applicator INTDATA2 as seedQuantity (not 25)", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              SERNUMTEXT: "SO25000015/A2",
              PARTNAMETEXT: "FLEX-00019-FG",
              INTDATA2: 3,
              INSERTEDSEEDSQTY: 0,
              USINGTYPE: null,
              INSERTIONDATE: null,
              INSERTIONCOMMENTS: null,
            },
          ],
        },
      });

      const result = await priorityService.getApplicatorFromPriority(
        "SO25000015/A2",
        "SO25000015",
      );

      expect(result.found).toBe(true);
      expect(result.data?.seedQuantity).toBe(3);
    });

    test("seedQuantity is null when INTDATA2 is absent (no fabricated 25)", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              SERNUMTEXT: "SO25000015/A2",
              PARTNAMETEXT: "FLEX-00019-FG",
              // INTDATA2 missing
              INSERTEDSEEDSQTY: 0,
            },
          ],
        },
      });

      const result = await priorityService.getApplicatorFromPriority(
        "SO25000015/A2",
        "SO25000015",
      );

      expect(result.found).toBe(true);
      expect(result.data?.seedQuantity).toBeNull();
    });
  });

  describe("getPartDetails", () => {
    test("returns seedQuantity null (not 25) when the PARTS row is missing", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { value: [] } });

      const result = await priorityService.getPartDetails("FLEX-00019-FG");

      expect(result.seedQuantity).toBeNull();
      expect(result.partDes).toBe("FLEX-00019-FG");
    });

    test("uses the real PARTS seed quantity when present", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              PARTNAME: "FLEX-00019-FG",
              PARTDES: "Alpha Flex Applicator",
              SBD_SEEDQTY: 5,
            },
          ],
        },
      });

      const result = await priorityService.getPartDetails("FLEX-00019-FG");

      expect(result.seedQuantity).toBe(5);
    });
  });
});
