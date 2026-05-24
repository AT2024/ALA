/**
 * Small input-validation helpers used at controller trust boundaries.
 *
 * These functions normalize and validate untrusted strings before the rest
 * of the code is allowed to trust them. They throw ValidationError on
 * rejection so handlers can let asyncHandler convert it to a 400 response.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// RFC 5321 caps an email address at 254 chars including the local part, "@",
// and the domain. Anything longer is invalid by spec.
const MAX_EMAIL_LENGTH = 254;

/**
 * Validate that `input` is a non-empty email-shaped string, then return it
 * trimmed and lowercased. Throws ValidationError otherwise.
 *
 * Intentionally strict: rejects non-string types, whitespace inside the
 * address, addresses longer than 254 chars.
 */
export function validateAndNormalizeEmail(input: unknown): string {
  if (typeof input !== "string") {
    throw new ValidationError("Valid email address is required");
  }
  const normalized = input.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(normalized)
  ) {
    throw new ValidationError("Valid email address is required");
  }
  return normalized;
}
