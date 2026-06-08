/**
 * Single source of truth for ALA mock ("Test Mode") data.
 *
 * The canonical dataset physically lives in backend/test-data.json because the
 * backend loads it at runtime via fs (Test Mode for the dev-bypass user / the
 * X-Test-Mode header) and the production image copies that file to its working
 * directory. This module is the ONE place TEST code (backend Jest fixtures and
 * frontend Playwright e2e helpers) should derive mock values from, so serials
 * and source counts can never drift out of sync with what the app serves.
 *
 * Runtime code keeps using priorityService.loadTestData() (fs) — NOT this
 * module. The JSON import below is for tests only; it is not relied on in the
 * compiled production bundle.
 */
import rawTestData from "./fixtures/test-data.json";

export interface TestApplicator {
  /** Full serial number (SERNUMTEXT), e.g. "SO25000015/A1". */
  serial: string;
  /** INTDATA2 — source (seed) count for this applicator. */
  sources: number;
}

interface RawApplicator {
  SERNUM?: string;
  SERNUMTEXT?: string;
  INTDATA2?: number;
}

interface RawTestData {
  sites: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  subform_data: Record<string, { value: RawApplicator[] }>;
}

export const testData = rawTestData as unknown as RawTestData;

/**
 * Derive the {serial, sources} list for an order from its subform — the same
 * data the backend serves for that order's applicator list.
 */
export const applicatorsForOrder = (ordName: string): TestApplicator[] => {
  const subform = testData.subform_data[ordName];
  if (!subform?.value) return [];
  return subform.value.map((a) => ({
    serial: a.SERNUMTEXT ?? a.SERNUM ?? "",
    sources: a.INTDATA2 ?? 0,
  }));
};

/** Worked-example pancreas order used by the QA e2e specs. */
export const MAIN_015_ORDER = "SO25000015";
export const MAIN_015_APPLICATORS = applicatorsForOrder(MAIN_015_ORDER);
