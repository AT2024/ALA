// Types for DaRT Removal Procedure data

export interface DiscrepancyCategory {
  checked: boolean;
  amount: number;
  comment: string;
}

export interface DiscrepancyOther extends DiscrepancyCategory {
  description: string;
}

export interface DiscrepancyClarification {
  lost: DiscrepancyCategory;
  retrievedToSite: DiscrepancyCategory;
  removalFailure: DiscrepancyCategory;
  other: DiscrepancyOther;
}

export interface IndividualSeedNote {
  reason: string;
  timestamp: string;
  count: number;
}

export interface RemovalProcedureData {
  removalDate: string;
  allSourcesSameDate: boolean;
  additionalRemovalDate?: string;
  reasonNotSameDate?: string;
  discrepancyClarification?: DiscrepancyClarification;
  individualSeedsRemoved: number;
  individualSeedNotes: IndividualSeedNote[];
  removalGeneralComments?: string;
}

// Validation helper
export function validateDiscrepancySum(
  clarification: DiscrepancyClarification,
  expectedTotal: number
): { valid: boolean; actual: number } {
  const actual =
    (clarification.lost.checked ? clarification.lost.amount : 0) +
    (clarification.retrievedToSite.checked ? clarification.retrievedToSite.amount : 0) +
    (clarification.removalFailure.checked ? clarification.removalFailure.amount : 0) +
    (clarification.other.checked ? clarification.other.amount : 0);

  return { valid: actual === expectedTotal, actual };
}
