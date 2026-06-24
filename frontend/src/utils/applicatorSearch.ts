/**
 * Applicator "Choose from list" search.
 *
 * The picker previously filtered with `serialNumber.endsWith("-A" + query)`,
 * which only matched the legacy hyphenated test serials. Real production serials
 * use a slash before the applicator number, e.g. "260423-35/A1", "260423-11/A7",
 * so the hyphen match never succeeded in production and "search by serial number"
 * appeared broken.
 *
 * A case-insensitive substring match against the FULL serial is format-agnostic:
 * it handles searching by the whole serial ("260423-35/A1"), the batch-lot prefix
 * ("260423-35"), or the A-number ("A11"), for both "/A" and "-A" forms.
 */
export const matchesSerialQuery = (
  serialNumber: string | null | undefined,
  query: string,
): boolean => {
  const q = query.trim().toUpperCase();
  if (!q) return true; // empty query matches everything (no filtering)
  return (serialNumber || "").toUpperCase().includes(q);
};
