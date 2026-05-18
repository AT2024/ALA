// Regression coverage for the FAULTY partial-insert bug: a FAULTY applicator
// was persisted with usageType "full" because the online save path mapped the
// stale legacy `usingType` field instead of the 8-state `status`. The status →
// usageType translation now lives in one shared helper used by both save paths.
import { describe, it, expect } from "vitest";
import {
  mapStatusToUsageType,
  APPLICATOR_STATUSES,
} from "../../../src/utils/applicatorStatus";

describe("mapStatusToUsageType", () => {
  it("INSERTED → full", () => {
    expect(mapStatusToUsageType(APPLICATOR_STATUSES.INSERTED)).toBe("full");
  });

  it("FAULTY → faulty (regression: was incorrectly 'full' via legacy field)", () => {
    expect(mapStatusToUsageType(APPLICATOR_STATUSES.FAULTY)).toBe("faulty");
  });

  it.each([
    APPLICATOR_STATUSES.SEALED,
    APPLICATOR_STATUSES.OPENED,
    APPLICATOR_STATUSES.LOADED,
    APPLICATOR_STATUSES.DISPOSED,
    APPLICATOR_STATUSES.DISCHARGED,
    APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
  ])("%s → none", (status) => {
    expect(mapStatusToUsageType(status)).toBe("none");
  });

  it("null / undefined / empty → none (legacy records with no status)", () => {
    expect(mapStatusToUsageType(null)).toBe("none");
    expect(mapStatusToUsageType(undefined)).toBe("none");
    expect(mapStatusToUsageType("")).toBe("none");
  });
});
