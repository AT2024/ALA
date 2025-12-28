/**
 * Utility functions for parsing Priority order IDs
 *
 * Priority IDs can be stored as:
 * - Single string: "SO25000001"
 * - JSON array (combined treatments): '["SO25000001", "SO25000002"]'
 *
 * This utility consolidates the JSON parsing logic that was duplicated 6 times across the codebase.
 */

/**
 * Parse a Priority ID string into an array of order IDs
 * Handles both single IDs and JSON arrays
 *
 * @param priorityId - The priority ID string (may be JSON array or plain string)
 * @returns Array of order ID strings
 *
 * @example
 * parseOrderIds("SO25000001") // ["SO25000001"]
 * parseOrderIds('["SO25000001", "SO25000002"]') // ["SO25000001", "SO25000002"]
 * parseOrderIds(null) // []
 */
export function parseOrderIds(priorityId: string | null | undefined): string[] {
  if (!priorityId) return [];

  try {
    const parsed = JSON.parse(priorityId);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
    // Handle case where JSON.parse returns a non-array (e.g., a number)
    if (typeof parsed === 'string') {
      return [parsed];
    }
    return [priorityId];
  } catch {
    // Not valid JSON, treat as plain string
    return [priorityId];
  }
}

/**
 * Get the first order ID from a Priority ID string
 * Useful when you only need one order (e.g., for seedLength lookup)
 *
 * @param priorityId - The priority ID string
 * @returns First order ID or null if empty
 *
 * @example
 * getFirstOrderId("SO25000001") // "SO25000001"
 * getFirstOrderId('["SO25000001", "SO25000002"]') // "SO25000001"
 * getFirstOrderId(null) // null
 */
export function getFirstOrderId(priorityId: string | null | undefined): string | null {
  const ids = parseOrderIds(priorityId);
  return ids[0] || null;
}

/**
 * Check if a Priority ID represents a combined treatment (multiple orders)
 *
 * @param priorityId - The priority ID string
 * @returns true if the ID represents multiple orders
 */
export function isCombinedTreatment(priorityId: string | null | undefined): boolean {
  return parseOrderIds(priorityId).length > 1;
}
