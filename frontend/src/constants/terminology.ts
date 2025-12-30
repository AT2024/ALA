/**
 * Centralized Terminology Constants for Regulatory Compliance
 *
 * "Source" is the correct NRC (Nuclear Regulatory Commission) and medical physics
 * terminology for radioactive seeds used in brachytherapy procedures.
 *
 * IMPORTANT: These are DISPLAY-ONLY strings for the UI layer.
 * DO NOT change:
 * - Database columns (seedQuantity, seedLength, etc.)
 * - TypeScript property names
 * - API field names (SBD_SEEDQTY, SIBD_SEEDLEN, etc.)
 * - Variable names in code
 *
 * See docs/TERMINOLOGY_GLOSSARY.md for full mapping and regulatory references.
 */

// =============================================================================
// CORE TERMINOLOGY
// =============================================================================

/**
 * Display terms - use these in all user-facing text
 */
export const TERM = {
  // Singular forms
  source: 'source',
  Source: 'Source',
  SOURCE: 'SOURCE',

  // Plural forms
  sources: 'sources',
  Sources: 'Sources',
  SOURCES: 'SOURCES',
} as const;

// =============================================================================
// COMMON DISPLAY LABELS
// =============================================================================

export const LABELS = {
  // Quantity labels
  SOURCE_QTY: 'Source Qty.',
  SOURCES_QTY: 'Sources Qty.',
  INSERTED_SOURCES_QTY: 'Inserted Sources Qty.',

  // Progress labels
  TOTAL_SOURCES: 'Total Sources',
  SOURCES_INSERTED: 'Sources Inserted',
  SOURCES_REMAINING: 'Sources Remaining',
  TOTAL_SOURCES_AVAILABLE: 'Total Sources Available:',
  EXPECTED_SOURCES: 'Expected Sources:',
  ACTUAL_TOTAL_SOURCES: 'Actual Total Sources:',

  // Activity labels
  ACTIVITY_PER_SOURCE: 'Activity Per Source',

  // Removal labels
  SOURCE_REMOVAL: 'Source Removal',
  SOURCE_REMOVAL_TRACKING: 'Source Removal Tracking',
  INDIVIDUAL_SOURCE_REMOVAL: 'Individual Source Removal',
  ADD_INDIVIDUAL_SOURCE_REMOVAL: 'Add Individual Source Removal',
  INDIVIDUAL_SOURCES_REMOVED: 'Individual sources removed:',
  SOURCES_REMOVED: 'Sources Removed',
  REMOVE_INDIVIDUAL_SOURCE: 'Remove individual source',
  COMPLETE_WITH_MISSING_SOURCES: 'Complete with Missing Sources',

  // PDF/Export labels
  TOTAL_DART_SOURCES_INSERTED: 'Total DaRT Sources Inserted',
  SOURCES_INSERTED_BY: 'Sources Inserted By',

  // Status descriptions
  SOURCES_EXPELLED: 'sources expelled',
  DISCHARGED_SOURCES_EXPELLED: 'Discharged (sources expelled)',
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Returns the correct singular/plural form of "source"
 * @param count - The number of sources
 * @returns "source" if count is 1, "sources" otherwise
 */
export const sourceLabel = (count: number): string => {
  return count === 1 ? TERM.source : TERM.sources;
};

/**
 * Returns the correct singular/plural form of "Source" (capitalized)
 * @param count - The number of sources
 * @returns "Source" if count is 1, "Sources" otherwise
 */
export const SourceLabel = (count: number): string => {
  return count === 1 ? TERM.Source : TERM.Sources;
};

/**
 * Formats a count with the appropriate source label
 * @param count - The number of sources
 * @returns Formatted string like "1 source" or "5 sources"
 */
export const formatSourceCount = (count: number): string => {
  return `${count} ${sourceLabel(count)}`;
};
