/**
 * ALA Test Mode data map.
 *
 * Served when logged in as the dev-bypass user or any session with the
 * `X-Test-Mode` header. The treatment-select patient dropdown shows the order
 * `DETAILS` as its label (NOT the ORDNAME); `subform_data` is keyed by ORDNAME.
 * Order dates are regenerated to yesterday/today/tomorrow at request time, so
 * always pick by the date button — never a hardcoded date.
 *
 * The applicator list (serial + source count) is derived directly from the
 * single source of truth (shared/fixtures/test-data.json), so it can never
 * drift from what the backend serves. Only the e2e-specific selectors (site
 * query, date, patient label) live here. (We import the canonical JSON directly
 * rather than via shared/testData.ts because Playwright's loader doesn't follow
 * that module's static JSON import; the data source is identical.)
 */
import canonicalTestData from "../../../../shared/fixtures/test-data.json" with { type: "json" };

const MAIN_015_ORDER = "SO25000015";

interface RawApplicator {
  SERNUM?: string;
  SERNUMTEXT?: string;
  INTDATA2?: number;
}

const main015Applicators = (
  (
    canonicalTestData as {
      subform_data: Record<string, { value: RawApplicator[] }>;
    }
  ).subform_data[MAIN_015_ORDER]?.value ?? []
).map((a) => ({
  serial: a.SERNUMTEXT ?? a.SERNUM ?? "",
  sources: a.INTDATA2 ?? 0,
}));

export const DEV_LOGIN = { email: "test@example.com", code: "123456" } as const;

/** Pancreas order → 3-stage workflow (SEALED→OPENED→LOADED→INSERTED). */
export const MAIN_015 = {
  siteQuery: "Main Test", // resolves to "Main Test Hospital (100078)"
  date: "Tomorrow" as const,
  patientLabel: "Patient Main-015", // → order SO25000015
  ordName: MAIN_015_ORDER,
  indication: "pancreas" as const,
  applicators: main015Applicators,
} as const;

export const TEST_MODE_BANNER = "TEST MODE ACTIVE - Using simulated data";
