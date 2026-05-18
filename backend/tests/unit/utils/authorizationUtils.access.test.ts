/**
 * Contract tests for the treatment- and site-level authorization utilities in
 * authorizationUtils.ts.
 *
 * These guard patient-data access (see .claude/rules/testing.md "Critical Path"):
 * a non-owner, non-admin user must never reach another user's treatment, and
 * site access must be restricted to a user's assigned sites unless they are an
 * Alpha Tau admin (POSITIONCODE 99). Assertions target that contract, not the
 * incidental wording of error messages.
 *
 * Two distinct "admin" concepts exist and are tested separately on purpose:
 *   - treatment access keys off `user.role === "admin"`
 *   - site access / isAlphaTauAdmin key off `metadata.positionCode === 99`
 */

import {
  ForbiddenError,
  requireTreatmentAccess,
  hasTreatmentAccess,
  denyIfNoTreatmentAccess,
  isAlphaTauAdmin,
  isAdmin,
  hasSiteAccess,
  requireSiteAccess,
  getUserSiteCodes,
  buildUserContextFromUser,
} from "../../../src/utils/authorizationUtils";

// Obviously-fake, professional test data (safe in screenshots/logs).
const OWNER_ID = "user-owner-001";
const OTHER_ID = "user-other-002";

function makeUser(opts: {
  id?: string;
  role?: "admin" | "user";
  positionCode?: number | string;
  sites?: { custName: string }[];
  email?: string;
}) {
  return {
    id: opts.id ?? OWNER_ID,
    email: opts.email ?? "clinician@clinic.example",
    role: opts.role ?? "user",
    metadata: {
      positionCode: opts.positionCode,
      sites: opts.sites,
    },
  } as any;
}

const treatmentOwnedBy = (userId: string) => ({ userId }) as any;

describe("requireTreatmentAccess", () => {
  it("allows the treatment owner (no throw)", () => {
    const user = makeUser({ id: OWNER_ID, role: "user" });
    expect(() =>
      requireTreatmentAccess(treatmentOwnedBy(OWNER_ID), user),
    ).not.toThrow();
  });

  it("allows a role=admin user to access a treatment they do not own", () => {
    const admin = makeUser({ id: OTHER_ID, role: "admin" });
    expect(() =>
      requireTreatmentAccess(treatmentOwnedBy(OWNER_ID), admin),
    ).not.toThrow();
  });

  it("denies a non-owner, non-admin user with ForbiddenError", () => {
    const intruder = makeUser({ id: OTHER_ID, role: "user" });
    expect(() =>
      requireTreatmentAccess(treatmentOwnedBy(OWNER_ID), intruder),
    ).toThrow(ForbiddenError);
  });
});

describe("hasTreatmentAccess", () => {
  it("returns true for the owner", () => {
    expect(
      hasTreatmentAccess(
        treatmentOwnedBy(OWNER_ID),
        makeUser({ id: OWNER_ID }),
      ),
    ).toBe(true);
  });

  it("returns true for a role=admin user on any treatment", () => {
    expect(
      hasTreatmentAccess(
        treatmentOwnedBy(OWNER_ID),
        makeUser({ id: OTHER_ID, role: "admin" }),
      ),
    ).toBe(true);
  });

  it("returns false for a non-owner, non-admin user", () => {
    expect(
      hasTreatmentAccess(
        treatmentOwnedBy(OWNER_ID),
        makeUser({ id: OTHER_ID, role: "user" }),
      ),
    ).toBe(false);
  });
});

describe("denyIfNoTreatmentAccess", () => {
  it("returns false (access granted) for the owner without touching the response", () => {
    const res = { status: jest.fn().mockReturnThis() } as any;
    const result = denyIfNoTreatmentAccess(
      res,
      treatmentOwnedBy(OWNER_ID),
      makeUser({ id: OWNER_ID }),
    );
    expect(result).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("sets HTTP 403 and throws ForbiddenError for a non-owner, non-admin user", () => {
    const res = { status: jest.fn().mockReturnThis() } as any;
    expect(() =>
      denyIfNoTreatmentAccess(
        res,
        treatmentOwnedBy(OWNER_ID),
        makeUser({ id: OTHER_ID, role: "user" }),
      ),
    ).toThrow(ForbiddenError);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("isAlphaTauAdmin", () => {
  it("recognizes POSITIONCODE 99 as a number", () => {
    expect(isAlphaTauAdmin(makeUser({ positionCode: 99 }))).toBe(true);
  });

  it("recognizes POSITIONCODE '99' as a string", () => {
    expect(isAlphaTauAdmin(makeUser({ positionCode: "99" }))).toBe(true);
  });

  it("rejects a non-99 position code", () => {
    expect(isAlphaTauAdmin(makeUser({ positionCode: 50 }))).toBe(false);
  });

  it("rejects an undefined user", () => {
    expect(isAlphaTauAdmin(undefined)).toBe(false);
  });

  it("isAdmin is the same check (backwards-compat alias)", () => {
    expect(isAdmin(makeUser({ positionCode: 99 }))).toBe(true);
    expect(isAdmin(makeUser({ positionCode: 1 }))).toBe(false);
  });
});

describe("hasSiteAccess", () => {
  it("returns false when there is no user", () => {
    expect(hasSiteAccess(undefined, "CLINIC-NORTH")).toBe(false);
  });

  it("grants an Alpha Tau admin access to any site", () => {
    const admin = makeUser({ positionCode: 99, sites: [] });
    expect(hasSiteAccess(admin, "CLINIC-NORTH")).toBe(true);
  });

  it("grants a regular user access to an assigned site", () => {
    const user = makeUser({ sites: [{ custName: "CLINIC-NORTH" }] });
    expect(hasSiteAccess(user, "CLINIC-NORTH")).toBe(true);
  });

  it("denies a regular user a site that is not assigned to them", () => {
    const user = makeUser({ sites: [{ custName: "CLINIC-NORTH" }] });
    expect(hasSiteAccess(user, "CLINIC-SOUTH")).toBe(false);
  });
});

describe("requireSiteAccess", () => {
  it("does not throw when the user has site access", () => {
    const user = makeUser({ sites: [{ custName: "CLINIC-NORTH" }] });
    expect(() => requireSiteAccess(user, "CLINIC-NORTH")).not.toThrow();
  });

  it("throws ForbiddenError when the user lacks site access", () => {
    const user = makeUser({ sites: [{ custName: "CLINIC-NORTH" }] });
    expect(() => requireSiteAccess(user, "CLINIC-SOUTH")).toThrow(
      ForbiddenError,
    );
  });
});

describe("getUserSiteCodes", () => {
  it("returns an empty list for no user", () => {
    expect(getUserSiteCodes(undefined)).toEqual([]);
  });

  it("returns an empty list for an Alpha Tau admin (empty = full access)", () => {
    expect(getUserSiteCodes(makeUser({ positionCode: 99 }))).toEqual([]);
  });

  it("returns exactly the assigned site codes for a regular user", () => {
    const user = makeUser({
      sites: [{ custName: "CLINIC-NORTH" }, { custName: "CLINIC-SOUTH" }],
    });
    expect(getUserSiteCodes(user)).toEqual(["CLINIC-NORTH", "CLINIC-SOUTH"]);
  });

  it("returns an empty list when a regular user has no assigned sites", () => {
    expect(getUserSiteCodes(makeUser({ sites: undefined }))).toEqual([]);
  });
});

describe("buildUserContextFromUser", () => {
  it("uses the email as identifier and never enables test mode", () => {
    const ctx = buildUserContextFromUser(
      makeUser({ email: "clinician@clinic.example", positionCode: 99 }),
    );
    expect(ctx.identifier).toBe("clinician@clinic.example");
    expect(ctx.userMetadata?.testModeEnabled).toBe(false);
  });

  it("falls back to the user id when no email is present", () => {
    const ctx = buildUserContextFromUser({
      id: OWNER_ID,
      role: "user",
    } as any);
    expect(ctx.identifier).toBe(OWNER_ID);
  });

  it("returns an empty identifier for an undefined user", () => {
    expect(buildUserContextFromUser(undefined).identifier).toBe("");
  });
});
