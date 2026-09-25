// Types mirror the Shared Contract's Python function signatures and the
// reforge_audit SQLite schema exactly, so wiring this UI to the real
// backend (via Tauri `invoke`) is a drop-in swap of api/reforgeAuditApi.ts
// — nothing in the components or tabs needs to change shape.

export type ActionResult = "success" | "failure" | "blocked" | "in_progress";
export type EntryStatus = "info" | "success" | "warning" | "blocked";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  user_id: string;
  case_id: string;
  evidence_id: string | null;
  action_type: string; // e.g. "recovery_scan", "erase_execute", "erase_verify"
  description: string;
  result: ActionResult;
  status: EntryStatus;
  chain_hash: string;
  previous_hash: string | null;
}

export type CustodyEventType = "collected" | "transferred" | "analyzed" | "erased";

export interface CustodyEvent {
  id: string;
  evidence_id: string;
  event_type: CustodyEventType;
  from_person: string;
  to_person: string;
  location: string;
  status: string;
  reason: string;
  timestamp: string;
}

export interface EvidenceItem {
  evidence_id: string;
  case_id: string;
  device_label: string;
  sha256: string;
  md5: string;
  events: CustodyEvent[];
}

export interface HashChainStatus {
  intact: boolean;
  entries_checked: number;
  break_at_entry_id: string | null;
}

export type ReportType =
  | "forensic"
  | "erasure"
  | "sanitization_cert"
  | "section_65b";

export interface ReportRecord {
  id: string;
  case_id: string;
  operation_id: string;
  type: ReportType;
  generated_at: string;
  file_path_pdf: string;
  file_path_json: string;
}

export interface GenerateReportResult {
  pdf_path: string;
  json_path: string;
}

export interface AuditLogFilters {
  search: string;
  user_id: string | "all";
  case_id: string | "all";
  action_type: string | "all";
  status: EntryStatus | "all";
}

// A generic "timeline item" the Activity Timeline groups by day — it's
// really just an AuditLogEntry, kept as an alias so the tab's intent
// reads clearly in its own file.
export type TimelineEntry = AuditLogEntry;
