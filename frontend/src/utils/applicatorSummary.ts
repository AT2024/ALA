/**
 * Pure builder for the sidebar "Applicator Summary" table.
 *
 * "Available" must reflect the FULL expected pool from Priority on load and
 * decrement as applicators reach a terminal state — not start at zero and grow
 * only as the user adds applicators. Pool applicators the user has not acted on
 * yet count as available; processed applicators are classified by their
 * effective (status-first) state. De-duplicated by serial number, with the
 * processed record winning over the pool record.
 */

import type { Applicator } from "@shared/types";
import {
  APPLICATOR_STATUSES,
  TERMINAL_STATUSES,
  getEffectiveStatus,
  type ApplicatorStatus,
} from "@/utils/applicatorStatus";

export interface ApplicatorSummaryRow {
  seedQuantity: number;
  inserted: number;
  available: number;
  loaded: number;
  packaged: number;
}

const keyOf = (a: { serialNumber?: string; id?: string | number }): string =>
  String(a.serialNumber || a.id || "").toUpperCase();

export function buildApplicatorSummary(
  processedApplicators: Applicator[],
  availableApplicators: Applicator[],
): ApplicatorSummaryRow[] {
  const processedByKey = new Map<string, Applicator>();
  processedApplicators.forEach((app) => {
    const k = keyOf(app);
    if (k) processedByKey.set(k, app);
  });

  // Pool applicators not already represented by a processed record.
  const poolOnly = availableApplicators.filter((app) => {
    const k = keyOf(app);
    return k.length > 0 && !processedByKey.has(k);
  });

  const summaryMap: Record<number, ApplicatorSummaryRow> = {};

  const tally = (app: Applicator, isProcessed: boolean): void => {
    const qty = app.seedQuantity || 0;
    if (!summaryMap[qty]) {
      summaryMap[qty] = {
        seedQuantity: qty,
        inserted: 0,
        available: 0,
        loaded: 0,
        packaged: 0,
      };
    }
    const entry = summaryMap[qty];

    // A pool applicator not yet acted on is available-to-use by definition;
    // its placeholder usageType must not be read as a real workflow state.
    const status = isProcessed
      ? getEffectiveStatus(app.status, app.usageType)
      : APPLICATOR_STATUSES.SEALED;

    if (status === APPLICATOR_STATUSES.INSERTED) entry.inserted++;
    if (status === APPLICATOR_STATUSES.LOADED) entry.loaded++;
    if (!TERMINAL_STATUSES.includes(status as ApplicatorStatus))
      entry.available++;
    if (app.package_label) entry.packaged++;
  };

  processedApplicators.forEach((app) => tally(app, true));
  poolOnly.forEach((app) => tally(app, false));

  return Object.values(summaryMap).sort(
    (a, b) => a.seedQuantity - b.seedQuantity,
  );
}
