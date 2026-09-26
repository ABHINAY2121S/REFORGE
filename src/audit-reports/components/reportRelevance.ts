import type { ReportType } from "../types/audit";

/**
 * Maps an audit_log action_type to the report types most relevant to it,
 * so clicking a row can offer "the report(s) relevant to that specific
 * operation" rather than always offering all four.
 */
export function relevantReportsForAction(actionType: string): ReportType[] {
  if (actionType.startsWith("recovery")) return ["forensic", "section_65b"];
  if (actionType.startsWith("erase")) return ["erasure", "sanitization_cert"];
  return [];
}

export function relevantReportsForCustodyEvent(eventType: string): ReportType[] {
  if (eventType === "erased") return ["erasure", "sanitization_cert"];
  return ["forensic", "section_65b"];
}
