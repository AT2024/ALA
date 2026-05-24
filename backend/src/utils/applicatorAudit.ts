/**
 * Build the audit-trail `reason` for an applicator status change.
 *
 * For FAULTY applicators the operator-entered inserted-seed count is
 * dosimetry-critical. It is persisted on the (mutable) applicator row, but the
 * row can be updated later — so the value at the moment of the FAULTY transition
 * must also be captured in the immutable audit trail. We append it to the
 * operator comments so a later query can reconstruct what was recorded and when.
 *
 * Non-faulty rows keep their comments unchanged.
 */
export function buildApplicatorAuditReason(
  usageType: string | undefined,
  insertedSeedsQty: number | null | undefined,
  comments?: string,
): string | undefined {
  if (usageType === "faulty" && insertedSeedsQty != null) {
    const note = `insertedSeedsQty=${insertedSeedsQty}`;
    return comments ? `${comments} [${note}]` : `[${note}]`;
  }
  return comments;
}
