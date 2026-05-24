import { describe, it, expect } from "vitest";
import { formatTreatmentDate } from "@/utils/dateFormat";

describe("formatTreatmentDate", () => {
  it("formats a midnight-UTC date-only value as dd.MMM.yyyy", () => {
    expect(formatTreatmentDate("2026-05-20T00:00:00.000Z")).toBe("20.May.2026");
  });

  it("keeps the calendar day stable regardless of host timezone (no off-by-one)", () => {
    // Midnight UTC must NOT roll back to the 19th when rendered in a
    // negative-offset timezone. Single-digit day is zero-padded.
    expect(formatTreatmentDate("2026-01-01T00:00:00.000Z")).toBe("01.Jan.2026");
    expect(formatTreatmentDate("2026-12-31T00:00:00.000Z")).toBe("31.Dec.2026");
  });

  it("accepts a Date instance", () => {
    expect(formatTreatmentDate(new Date("2026-05-20T00:00:00.000Z"))).toBe(
      "20.May.2026",
    );
  });

  it("returns an em dash for empty or invalid input", () => {
    expect(formatTreatmentDate(null)).toBe("—");
    expect(formatTreatmentDate(undefined)).toBe("—");
    expect(formatTreatmentDate("")).toBe("—");
    expect(formatTreatmentDate("not-a-date")).toBe("—");
  });
});
