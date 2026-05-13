import type { Page } from "@playwright/test";

export const TREATMENT_KEYS = [
  "currentTreatment",
  "processedApplicators",
  "availableApplicators",
  "individualSeedsRemoved",
] as const;

export type TreatmentKey = (typeof TREATMENT_KEYS)[number];

export async function readSessionKeys(
  page: Page,
): Promise<Record<TreatmentKey, string | null>> {
  return page.evaluate(
    (keys: readonly string[]) => {
      const out: Record<string, string | null> = {};
      for (const k of keys) out[k] = sessionStorage.getItem(k);
      return out;
    },
    TREATMENT_KEYS as unknown as readonly string[],
  ) as Promise<Record<TreatmentKey, string | null>>;
}
