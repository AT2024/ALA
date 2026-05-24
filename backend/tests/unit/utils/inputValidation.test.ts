/**
 * Tests for inputValidation.ts — validateAndNormalizeEmail.
 *
 * Pinned contract: rejects non-string, empty, oversized, and shape-violating
 * inputs; returns trimmed + lowercased form for valid input.
 */

import {
  validateAndNormalizeEmail,
  ValidationError,
} from "../../../src/utils/inputValidation";

describe("validateAndNormalizeEmail", () => {
  describe("accepts", () => {
    it("a well-formed lowercase email unchanged", () => {
      expect(validateAndNormalizeEmail("surgeon@example.test")).toBe(
        "surgeon@example.test",
      );
    });

    it("a well-formed email with leading/trailing whitespace, trimmed", () => {
      expect(validateAndNormalizeEmail("  surgeon@example.test  ")).toBe(
        "surgeon@example.test",
      );
    });

    it("a well-formed email with mixed case, lowercased", () => {
      expect(validateAndNormalizeEmail("  Surgeon@Example.TEST  ")).toBe(
        "surgeon@example.test",
      );
    });
  });

  describe("rejects", () => {
    it("non-string input (undefined)", () => {
      expect(() => validateAndNormalizeEmail(undefined)).toThrow(
        ValidationError,
      );
    });

    it("non-string input (number)", () => {
      expect(() => validateAndNormalizeEmail(12345)).toThrow(ValidationError);
    });

    it("non-string input (object)", () => {
      expect(() => validateAndNormalizeEmail({ address: "x@y.z" })).toThrow(
        ValidationError,
      );
    });

    it("an empty string", () => {
      expect(() => validateAndNormalizeEmail("")).toThrow(ValidationError);
    });

    it("a whitespace-only string", () => {
      expect(() => validateAndNormalizeEmail("    ")).toThrow(ValidationError);
    });

    it("an email longer than 254 chars (RFC 5321 cap)", () => {
      const tooLong = `${"a".repeat(250)}@b.test`; // 250 + 7 = 257
      expect(() => validateAndNormalizeEmail(tooLong)).toThrow(ValidationError);
    });

    it("an email with whitespace inside the address", () => {
      expect(() => validateAndNormalizeEmail("surgeon @example.test")).toThrow(
        ValidationError,
      );
    });

    it("a string missing the @", () => {
      expect(() =>
        validateAndNormalizeEmail("surgeon-at-example.test"),
      ).toThrow(ValidationError);
    });

    it("a string missing the domain dot", () => {
      expect(() => validateAndNormalizeEmail("surgeon@example")).toThrow(
        ValidationError,
      );
    });
  });
});
