/**
 * Tests for per-session Test Mode derivation in authorizationUtils.ts
 *
 * Fix: Test Mode must be a deliberate, per-session, admin-only choice that is
 * NEVER read from persisted user metadata. The only valid signal is the
 * `X-Test-Mode` request header, and only for admin users (POSITIONCODE 99).
 */

import {
  deriveSessionTestMode,
  buildUserContext,
} from "../../../src/utils/authorizationUtils";

// Minimal Express-request stub with a case-insensitive header() like Express.
function makeReq(opts: {
  testModeHeader?: string;
  positionCode?: number | string;
  persistedTestMode?: boolean;
  email?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.testModeHeader !== undefined) {
    headers["x-test-mode"] = opts.testModeHeader;
  }
  return {
    header: (name: string) => headers[name.toLowerCase()],
    user: {
      email: opts.email ?? "user@example.com",
      id: "user-id",
      metadata: {
        positionCode: opts.positionCode,
        testModeEnabled: opts.persistedTestMode,
      },
    },
  } as any;
}

describe("deriveSessionTestMode", () => {
  it("returns true when X-Test-Mode header is 'true' and user is admin (99)", () => {
    const req = makeReq({ testModeHeader: "true", positionCode: 99 });
    expect(deriveSessionTestMode(req)).toBe(true);
  });

  it("returns false when X-Test-Mode header is set but user is not admin", () => {
    const req = makeReq({ testModeHeader: "true", positionCode: 50 });
    expect(deriveSessionTestMode(req)).toBe(false);
  });

  it("returns false when no header is sent, even for an admin", () => {
    const req = makeReq({ positionCode: 99 });
    expect(deriveSessionTestMode(req)).toBe(false);
  });

  it("ignores persisted metadata.testModeEnabled (stale DB flag must not activate test mode)", () => {
    const req = makeReq({ positionCode: 99, persistedTestMode: true });
    expect(deriveSessionTestMode(req)).toBe(false);
  });
});

describe("buildUserContext - test mode is session-derived only", () => {
  it("sets testModeEnabled from the header for an admin, not from persisted metadata", () => {
    const req = makeReq({ testModeHeader: "true", positionCode: 99 });
    expect(buildUserContext(req).userMetadata?.testModeEnabled).toBe(true);
  });

  it("forces testModeEnabled false when a stale persisted flag is true but no header", () => {
    const req = makeReq({ positionCode: 99, persistedTestMode: true });
    expect(buildUserContext(req).userMetadata?.testModeEnabled).toBe(false);
  });
});
