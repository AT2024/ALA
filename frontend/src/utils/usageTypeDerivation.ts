export type UsageType = "full" | "faulty" | "none";

export function mapUsageType(formUsageType: string | undefined): UsageType {
  switch (formUsageType) {
    case "Full use":
      return "full";
    case "Faulty":
      return "faulty";
    case "No Use":
      return "none";
    default:
      return "full";
  }
}

// 8-state status takes priority over the legacy usingType radio so summary
// counters (which still read usageType) reflect the real status. Without this,
// SEALED/OPENED/LOADED applicators were silently counted as "full" inserts.
export function deriveUsageType(
  status: string | undefined | null,
  usingType: string | undefined,
): UsageType {
  if (status === "INSERTED") return "full";
  if (status === "FAULTY" || status === "DEPLOYMENT_FAILURE") return "faulty";
  if (status) return "none";
  return mapUsageType(usingType);
}
