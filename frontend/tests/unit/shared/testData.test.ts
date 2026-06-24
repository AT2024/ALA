import { describe, it, expect } from "vitest";
import {
  applicatorsForOrder,
  MAIN_015_ORDER,
  MAIN_015_APPLICATORS,
  testData,
} from "../../../../shared/testData";

/**
 * Guard for the single-source test data: the derived views must stay in sync
 * with the canonical shared/fixtures/test-data.json so the e2e helper and Jest
 * fixtures (which consume these) can never drift from what the backend serves.
 */
describe("shared/testData derived views", () => {
  it("derives MAIN_015 applicators directly from the canonical subform", () => {
    const subform = testData.subform_data[MAIN_015_ORDER].value;
    expect(MAIN_015_APPLICATORS).toHaveLength(subform.length);
    MAIN_015_APPLICATORS.forEach((a, i) => {
      expect(a.serial).toBe(subform[i].SERNUMTEXT ?? subform[i].SERNUM);
      expect(a.sources).toBe(subform[i].INTDATA2);
    });
  });

  it("returns serial + numeric source count for each applicator", () => {
    const apps = applicatorsForOrder(MAIN_015_ORDER);
    expect(apps.length).toBeGreaterThan(0);
    apps.forEach((a) => {
      expect(typeof a.serial).toBe("string");
      expect(a.serial.length).toBeGreaterThan(0);
      expect(typeof a.sources).toBe("number");
    });
  });

  it("returns an empty list for an unknown order", () => {
    expect(applicatorsForOrder("DOES-NOT-EXIST")).toEqual([]);
  });
});
