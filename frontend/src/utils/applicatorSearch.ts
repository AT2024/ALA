/**
 * Applicator "Choose from list" search.
 *
 * Serials carry an applicator number after a final "/A" or "-A", e.g.
 * "260423-82/A29" → A-number 29. Search behaviour depends on the query:
 *
 * - Pure-digit query (e.g. "8"): scope the match to the A-number ONLY and match
 *   when it ENDS WITH the query. So "8" matches A8/A18/A28 but NOT A29 — a plain
 *   substring match against the full serial wrongly matched "82" in the prefix.
 * - Query containing any non-digit (e.g. "260423-11/A7", "A7"): fall back to a
 *   case-insensitive substring match against the FULL serial, so searching by the
 *   whole serial or the batch-lot prefix still works.
 */
const A_SUFFIX_RE = /[/-]A(\d+)\s*$/i;

export const matchesSerialQuery = (
  serialNumber: string | null | undefined,
  query: string,
): boolean => {
  const q = query.trim().toUpperCase();
  if (!q) return true; // empty query matches everything (no filtering)
  const serial = (serialNumber || "").toUpperCase();

  // Pure-digit query → match only the A-number suffix, "ends with".
  if (/^\d+$/.test(q)) {
    const suffix = serial.match(A_SUFFIX_RE)?.[1];
    return suffix ? suffix.endsWith(q) : false;
  }

  // Text query → broad substring match against the full serial.
  return serial.includes(q);
};
