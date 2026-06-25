import { describe, it, expect } from "vitest";
import { matchesSerialQuery } from "@/utils/applicatorSearch";

describe("matchesSerialQuery", () => {
  it("matches the production '/A' serial format (bug 1 regression)", () => {
    // The old endsWith('-A'+q) predicate failed on slash serials.
    expect(matchesSerialQuery("260423-35/A1", "260423-35/A1")).toBe(true);
    expect(matchesSerialQuery("260423-11/A7", "A7")).toBe(true);
    expect(matchesSerialQuery("260423-52/A11", "260423-52")).toBe(true);
  });

  it("matches the legacy hyphenated test format too (format-agnostic)", () => {
    expect(matchesSerialQuery("SO25000015-A3", "SO25000015")).toBe(true);
    expect(matchesSerialQuery("SO25000015-A3", "A3")).toBe(true);
  });

  it("is case-insensitive and trims the query", () => {
    expect(matchesSerialQuery("260423-35/A1", "  a1 ")).toBe(true);
    expect(matchesSerialQuery("260423-35/A1", "260423-35/a1")).toBe(true);
  });

  it("returns false when the serial does not contain the query", () => {
    expect(matchesSerialQuery("260423-35/A1", "999")).toBe(false);
    expect(matchesSerialQuery("260423-35/A2", "/A1")).toBe(false);
  });

  it("treats an empty/whitespace query as no filter (matches all)", () => {
    expect(matchesSerialQuery("260423-35/A1", "")).toBe(true);
    expect(matchesSerialQuery("260423-35/A1", "   ")).toBe(true);
    expect(matchesSerialQuery(null, "")).toBe(true);
  });

  it("does not throw on missing serial numbers", () => {
    expect(matchesSerialQuery(undefined, "A1")).toBe(false);
    expect(matchesSerialQuery(null, "A1")).toBe(false);
  });

  describe("pure-digit query scopes to the A-number suffix (ends-with)", () => {
    it("does NOT match a digit found only in the batch prefix (reported bug)", () => {
      // "8" appears in the "82" lot prefix but the A-number is 29 → no match.
      expect(matchesSerialQuery("260423-82/A29", "8")).toBe(false);
    });

    it("matches when the A-number ends with the query", () => {
      expect(matchesSerialQuery("260423-11/A8", "8")).toBe(true);
      expect(matchesSerialQuery("260423-11/A18", "8")).toBe(true);
      expect(matchesSerialQuery("260423-11/A28", "8")).toBe(true);
      expect(matchesSerialQuery("260423-11/A29", "9")).toBe(true);
    });

    it("works for the legacy '-A' form too", () => {
      expect(matchesSerialQuery("SO25000015-A8", "8")).toBe(true);
      expect(matchesSerialQuery("SO25000015-A82", "8")).toBe(false);
    });

    it("returns false when the serial has no A-number suffix", () => {
      expect(matchesSerialQuery("260423-82", "8")).toBe(false);
    });
  });
});
