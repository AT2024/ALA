// Applicator Service - getTransitionsForTreatment fallback behavior
// Regression coverage for: unknown/null indication must fall back to skin's
// 2-stage workflow (not the permissive GENERIC path).
import { describe, test, expect } from "@jest/globals";
import { applicatorService } from "../../../src/services/applicatorService";
import {
  APPLICATOR_STATUSES,
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
} from "../../../../shared/applicatorStatuses";

describe("applicatorService.getTransitionsForTreatment", () => {
  describe("explicit indication routes to correct map", () => {
    test("indication 'pancreas' → PANC_PROS_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment(undefined, "pancreas"),
      ).toBe(PANC_PROS_TRANSITIONS);
    });

    test("indication 'prostate' → PANC_PROS_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment(undefined, "prostate"),
      ).toBe(PANC_PROS_TRANSITIONS);
    });

    test("indication 'skin' → SKIN_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment(undefined, "skin"),
      ).toBe(SKIN_TRANSITIONS);
    });

    test("indication is case-insensitive ('SKIN', 'Pancreas')", () => {
      expect(
        applicatorService.getTransitionsForTreatment(undefined, "SKIN"),
      ).toBe(SKIN_TRANSITIONS);
      expect(
        applicatorService.getTransitionsForTreatment(undefined, "Pancreas"),
      ).toBe(PANC_PROS_TRANSITIONS);
    });
  });

  describe("unknown/null indication falls back to skin", () => {
    test("no indication, no treatmentType → SKIN_TRANSITIONS", () => {
      expect(applicatorService.getTransitionsForTreatment()).toBe(
        SKIN_TRANSITIONS,
      );
    });

    test("indication=null, treatmentType=undefined → SKIN_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment(undefined, null),
      ).toBe(SKIN_TRANSITIONS);
    });

    test("indication is an unrecognized string → SKIN_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment(
          undefined,
          "not_a_real_indication",
        ),
      ).toBe(SKIN_TRANSITIONS);
    });

    test("unrecognized treatmentType, no indication → SKIN_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment("lung_insertion", null),
      ).toBe(SKIN_TRANSITIONS);
    });
  });

  describe("legacy treatmentType keyword detection still works", () => {
    test("treatmentType contains 'pancreas' → PANC_PROS_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment("pancreas_insertion"),
      ).toBe(PANC_PROS_TRANSITIONS);
    });

    test("treatmentType contains 'skin' → SKIN_TRANSITIONS", () => {
      expect(
        applicatorService.getTransitionsForTreatment("skin_insertion"),
      ).toBe(SKIN_TRANSITIONS);
    });
  });
});

describe("applicatorService.validateStatusTransition (skin fallback)", () => {
  test("SEALED → INSERTED is allowed when indication is null (skin fallback)", () => {
    const result = applicatorService.validateStatusTransition(
      APPLICATOR_STATUSES.SEALED,
      APPLICATOR_STATUSES.INSERTED,
      undefined,
      null,
    );
    expect(result.valid).toBe(true);
  });

  test("SEALED → OPENED is rejected when indication is null (skin fallback)", () => {
    const result = applicatorService.validateStatusTransition(
      APPLICATOR_STATUSES.SEALED,
      APPLICATOR_STATUSES.OPENED,
      undefined,
      null,
    );
    expect(result.valid).toBe(false);
  });

  test("SEALED → OPENED still allowed when indication is 'pancreas'", () => {
    const result = applicatorService.validateStatusTransition(
      APPLICATOR_STATUSES.SEALED,
      APPLICATOR_STATUSES.OPENED,
      undefined,
      "pancreas",
    );
    expect(result.valid).toBe(true);
  });
});
