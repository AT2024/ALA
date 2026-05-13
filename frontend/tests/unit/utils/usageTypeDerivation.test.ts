import { describe, it, expect } from "vitest";
import { deriveUsageType, mapUsageType } from "@/utils/usageTypeDerivation";

describe("deriveUsageType (8-state -> 3-state mapping)", () => {
  describe("terminal statuses map to the real outcome", () => {
    it("INSERTED -> full (counted as a successful insertion)", () => {
      expect(deriveUsageType("INSERTED", "Full use")).toBe("full");
    });

    it("FAULTY -> faulty", () => {
      expect(deriveUsageType("FAULTY", "Full use")).toBe("faulty");
    });

    it("DEPLOYMENT_FAILURE -> faulty (partial deployment counts as faulty)", () => {
      expect(deriveUsageType("DEPLOYMENT_FAILURE", "Full use")).toBe("faulty");
    });
  });

  describe("non-terminal in-progress statuses never count as a successful insertion", () => {
    // The bug this addresses: SEALED/OPENED/LOADED were mapped to "full"
    // via the radio default, inflating insertion counts before the applicator
    // had actually been deployed.
    it("SEALED -> none (registered but unopened)", () => {
      expect(deriveUsageType("SEALED", "Full use")).toBe("none");
    });

    it("OPENED -> none", () => {
      expect(deriveUsageType("OPENED", "Full use")).toBe("none");
    });

    it("LOADED -> none", () => {
      expect(deriveUsageType("LOADED", "Full use")).toBe("none");
    });
  });

  describe("non-insertion terminal statuses map to none", () => {
    it("DISPOSED -> none", () => {
      expect(deriveUsageType("DISPOSED", "Full use")).toBe("none");
    });

    it("DISCHARGED -> none", () => {
      expect(deriveUsageType("DISCHARGED", "Full use")).toBe("none");
    });
  });

  describe("status overrides the legacy radio (regression guarantee)", () => {
    // Before the fix: the form's `usingType` radio was the only signal,
    // so an INSERTED applicator with the radio left on "No Use" was
    // miscounted. The 8-state status MUST win.
    it("status INSERTED beats usingType 'No Use'", () => {
      expect(deriveUsageType("INSERTED", "No Use")).toBe("full");
    });

    it("status FAULTY beats usingType 'Full use'", () => {
      expect(deriveUsageType("FAULTY", "Full use")).toBe("faulty");
    });

    it("status SEALED beats usingType 'Full use' (the most dangerous old miscount)", () => {
      expect(deriveUsageType("SEALED", "Full use")).toBe("none");
    });
  });

  describe("falls back to mapUsageType when no status is provided", () => {
    it("null status + 'Full use' radio -> full", () => {
      expect(deriveUsageType(null, "Full use")).toBe("full");
    });

    it("undefined status + 'Faulty' radio -> faulty", () => {
      expect(deriveUsageType(undefined, "Faulty")).toBe("faulty");
    });

    it("undefined status + 'No Use' radio -> none", () => {
      expect(deriveUsageType(undefined, "No Use")).toBe("none");
    });

    it("empty string status + 'Full use' radio -> full (empty is falsy)", () => {
      expect(deriveUsageType("", "Full use")).toBe("full");
    });
  });
});

describe("mapUsageType (legacy radio -> 3-state)", () => {
  it("maps the three documented form labels exactly", () => {
    expect(mapUsageType("Full use")).toBe("full");
    expect(mapUsageType("Faulty")).toBe("faulty");
    expect(mapUsageType("No Use")).toBe("none");
  });

  it("defaults unknown / undefined values to full (preserves pre-fix behavior)", () => {
    expect(mapUsageType("")).toBe("full");
    expect(mapUsageType(undefined)).toBe("full");
    expect(mapUsageType("Some Other Value")).toBe("full");
  });
});
