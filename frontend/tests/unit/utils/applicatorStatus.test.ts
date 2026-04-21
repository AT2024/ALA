// Unit tests for getTransitionsForTreatment fallback.
// Regression coverage for the "unknown/null indication → skin 2-stage"
// default (matches backend fallback so online/offline behavior stays aligned).
import { describe, it, expect } from "vitest";
import {
  getTransitionsForTreatment,
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
} from "../../../src/utils/applicatorStatus";

describe("frontend getTransitionsForTreatment", () => {
  describe("explicit indication routes correctly", () => {
    it("indication 'pancreas' → PANC_PROS_TRANSITIONS", () => {
      expect(
        getTransitionsForTreatment({ indication: "pancreas" } as any),
      ).toBe(PANC_PROS_TRANSITIONS);
    });

    it("indication 'prostate' → PANC_PROS_TRANSITIONS", () => {
      expect(
        getTransitionsForTreatment({ indication: "prostate" } as any),
      ).toBe(PANC_PROS_TRANSITIONS);
    });

    it("indication 'skin' → SKIN_TRANSITIONS", () => {
      expect(getTransitionsForTreatment({ indication: "skin" } as any)).toBe(
        SKIN_TRANSITIONS,
      );
    });
  });

  describe("unknown/null indication falls back to skin (not generic)", () => {
    it("undefined context → SKIN_TRANSITIONS", () => {
      expect(getTransitionsForTreatment()).toBe(SKIN_TRANSITIONS);
    });

    it("context with null indication and no keyword → SKIN_TRANSITIONS", () => {
      expect(
        getTransitionsForTreatment({
          indication: null,
          type: "",
          site: "",
        } as any),
      ).toBe(SKIN_TRANSITIONS);
    });

    it("context with unrecognized indication → SKIN_TRANSITIONS", () => {
      expect(
        getTransitionsForTreatment({
          indication: "not_a_real_value",
          type: "",
        } as any),
      ).toBe(SKIN_TRANSITIONS);
    });

    it("legacy string site 'unknown' → SKIN_TRANSITIONS", () => {
      expect(getTransitionsForTreatment("unknown_site")).toBe(SKIN_TRANSITIONS);
    });
  });
});
