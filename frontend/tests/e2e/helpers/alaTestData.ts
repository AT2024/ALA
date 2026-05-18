/**
 * ALA Test Mode data map (backend/test-data.json).
 *
 * Served when logged in as the dev-bypass user or any session with the
 * `X-Test-Mode` header. The treatment-select patient dropdown shows the order
 * `DETAILS` as its label (NOT the ORDNAME); `subform_data` is keyed by ORDNAME.
 * Order dates are regenerated to yesterday/today/tomorrow at request time, so
 * always pick by the date button — never a hardcoded date.
 *
 * Verified worked example used by the QA E2E specs. To re-derive after a
 * test-data change:
 *   node -e "const d=require('./backend/test-data.json'); \
 *     console.log(d.subform_data['SO25000015'].value.map(a=>a.SERNUM+':'+a.INTDATA2))"
 * (INTDATA2 = source count per applicator.)
 */

export const DEV_LOGIN = { email: "test@example.com", code: "123456" } as const;

/** Pancreas order → 3-stage workflow (SEALED→OPENED→LOADED→INSERTED). */
export const MAIN_015 = {
  siteQuery: "Main Test", // resolves to "Main Test Hospital (100078)"
  date: "Tomorrow" as const,
  patientLabel: "Patient Main-015", // → order SO25000015
  ordName: "SO25000015",
  indication: "pancreas" as const,
  applicators: [
    { serial: "SO25000015-A1", sources: 2 },
    { serial: "SO25000015-A2", sources: 3 },
    { serial: "SO25000015-A3", sources: 3 },
  ],
} as const;

export const TEST_MODE_BANNER = "TEST MODE ACTIVE - Using simulated data";
