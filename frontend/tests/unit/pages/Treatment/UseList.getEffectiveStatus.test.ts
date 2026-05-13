import { describe, it, expect } from "vitest";
import { getEffectiveStatus } from "@/pages/Treatment/UseList";

// getEffectiveStatus is the centralized helper that lets the summary
// counters (totalApplicatorUse / faultyApplicator / notUsedApplicators)
// and the seed-quantity column read either the new 8-state status field
// (preferred) or fall back to the legacy 3-state usageType. Before this
// helper existed, the counters read only usageType, so an 8-state SEALED
// applicator (which carries usageType="full" for legacy reasons) was
// counted as a successful insertion in the totals.

describe("getEffectiveStatus", () => {
  describe("8-state status takes priority when present", () => {
    it("returns the status string verbatim when set", () => {
      expect(
        getEffectiveStatus({ status: "INSERTED", usageType: "full" }),
      ).toBe("INSERTED");
      expect(
        getEffectiveStatus({ status: "FAULTY", usageType: "faulty" }),
      ).toBe("FAULTY");
      expect(
        getEffectiveStatus({
          status: "DEPLOYMENT_FAILURE",
          usageType: "faulty",
        }),
      ).toBe("DEPLOYMENT_FAILURE");
    });

    it("returns SEALED/OPENED/LOADED for in-progress applicators (regression: keeps them out of 'totalApplicatorUse')", () => {
      // These three are the dangerous case. With the old code these
      // applicators got their usageType from the form default ("Full use"
      // -> "full") and so were counted as completed insertions. After the
      // fix, the counters call getEffectiveStatus first and see "SEALED"
      // instead of "full", so they correctly land in notUsedApplicators.
      expect(getEffectiveStatus({ status: "SEALED", usageType: "full" })).toBe(
        "SEALED",
      );
      expect(getEffectiveStatus({ status: "OPENED", usageType: "full" })).toBe(
        "OPENED",
      );
      expect(getEffectiveStatus({ status: "LOADED", usageType: "full" })).toBe(
        "LOADED",
      );
    });

    it("status wins even when usageType contradicts it", () => {
      // Defensive: a stale usageType from before the 8-state migration
      // should never override a real status update.
      expect(getEffectiveStatus({ status: "FAULTY", usageType: "full" })).toBe(
        "FAULTY",
      );
      expect(
        getEffectiveStatus({ status: "INSERTED", usageType: "none" }),
      ).toBe("INSERTED");
    });
  });

  describe("legacy fallback when status is missing (old records)", () => {
    it("usageType 'full' -> INSERTED", () => {
      expect(getEffectiveStatus({ usageType: "full" })).toBe("INSERTED");
      expect(getEffectiveStatus({ status: null, usageType: "full" })).toBe(
        "INSERTED",
      );
    });

    it("usageType 'faulty' -> FAULTY", () => {
      expect(getEffectiveStatus({ usageType: "faulty" })).toBe("FAULTY");
    });

    it("usageType 'none' -> SEALED (safest default; never counted as inserted)", () => {
      expect(getEffectiveStatus({ usageType: "none" })).toBe("SEALED");
    });

    it("unknown usageType also maps to SEALED (fail-safe)", () => {
      expect(getEffectiveStatus({ usageType: "anything-else" })).toBe("SEALED");
    });
  });
});
