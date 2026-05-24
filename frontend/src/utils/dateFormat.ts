/**
 * Date formatting helpers for treatment records.
 *
 * The backend sends the treatment date as a date-only value serialised at
 * midnight UTC (e.g. "2026-05-20T00:00:00.000Z"). Formatting it with local
 * getters would shift it to the previous day in negative-UTC timezones, so we
 * read the UTC components. Output matches the backend PDF format
 * (`pdfGenerationService.formatDate`) so the UI and the report agree.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format a treatment date as `dd.MMM.yyyy` (e.g. "20.May.2026") in UTC.
 * Returns an em dash for missing or unparseable input.
 */
export function formatTreatmentDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  return `${day}.${month}.${d.getUTCFullYear()}`;
}
