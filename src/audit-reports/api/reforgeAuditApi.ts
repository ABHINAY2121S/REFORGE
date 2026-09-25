// This file is the ONLY place the Audit & Reports screen talks to the
// backend. Every exported function here has a name and parameter list
// that mirrors a reforge_audit Python function 1:1 (see the Shared
// Contract, Part A) and is expected to be wired to a Tauri command of
// the same name — e.g. `log_audit_event` -> `invoke("log_audit_event", {...})`.
//
// INTEGRATION POINT for Antigravity: once the Tauri commands exist,
// delete the `USE_MOCK` branch in each function below; the real branch
// (the `invoke(...)` call) is already written and shaped correctly.
// Until then, every function returns realistic mock data so the 5 tabs
// are fully interactive and demoable against the real prop/state shapes.

import type {
  AuditLogEntry,
  CustodyEvent,
  EvidenceItem,
  HashChainStatus,
  ReportRecord,
  ReportType,
  GenerateReportResult,
} from "../types/audit";

// Tauri injects window.__TAURI__ at runtime; its absence means we're in
// a plain browser/dev/storybook context, so we serve mock data instead.
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

const USE_MOCK = typeof window === "undefined" || !window.__TAURI__;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Lazily imported so this module doesn't hard-fail to load in a plain
  // browser context where @tauri-apps/api isn't bundled/available.
  // Tauri v2 moved invoke from @tauri-apps/api/tauri to @tauri-apps/api/core.
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(command, args);
}

// ---------------------------------------------------------------------
// Mock data — shaped exactly like the real tables, used only when
// USE_MOCK is true.
// ---------------------------------------------------------------------

const MOCK_USERS = ["examiner.rao", "examiner.singh", "supervisor.mehta"];
const MOCK_CASE = "CASE-2026-0143";

function mockAuditLog(): AuditLogEntry[] {
  const entries: Array<Omit<AuditLogEntry, "chain_hash" | "previous_hash">> = [
    {
      id: "a1", timestamp: "2026-09-24T09:12:03.100Z", user_id: "examiner.rao",
      case_id: MOCK_CASE, evidence_id: "EVID-9931", action_type: "recovery_scan",
      description: "Signature + structure carve on /dev/sdb1", result: "success", status: "success",
    },
    {
      id: "a2", timestamp: "2026-09-24T09:41:55.221Z", user_id: "examiner.rao",
      case_id: MOCK_CASE, evidence_id: "EVID-9931", action_type: "erase_execute",
      description: "NIST 800-88 Purge (block erase) started on /dev/sdb1", result: "success", status: "info",
    },
    {
      id: "a3", timestamp: "2026-09-24T10:03:12.884Z", user_id: "examiner.rao",
      case_id: MOCK_CASE, evidence_id: "EVID-9931", action_type: "erase_verify",
      description: "Adversarial verification scan found 0 recoverable signatures", result: "success", status: "success",
    },
    {
      id: "a4", timestamp: "2026-09-24T10:04:02.010Z", user_id: "examiner.singh",
      case_id: MOCK_CASE, evidence_id: "EVID-9931", action_type: "erase_execute",
      description: "Secure Erase Blocked — Supervisor authorization not present",
      result: "blocked", status: "blocked",
    },
    {
      id: "a5", timestamp: "2026-09-24T11:20:44.500Z", user_id: "supervisor.mehta",
      case_id: MOCK_CASE, evidence_id: "EVID-9931", action_type: "erase_execute",
      description: "Erase re-authorized and completed by supervisor override", result: "success", status: "success",
    },
  ];
  let previous: string | null = null;
  return entries.map((e) => {
    const chain_hash = `sha256:${e.id}-mockhash`;
    const row = { ...e, chain_hash, previous_hash: previous };
    previous = chain_hash;
    return row;
  });
}

function mockCustodyEvents(evidenceId: string): CustodyEvent[] {
  return [
    { id: "c1", evidence_id: evidenceId, event_type: "collected", from_person: "Scene (Sector 12 raid)", to_person: "examiner.rao", location: "Forensic Lab 2", status: "recorded", reason: "Initial seizure under warrant", timestamp: "2026-09-23T14:00:00.000Z" },
    { id: "c2", evidence_id: evidenceId, event_type: "transferred", from_person: "examiner.rao", to_person: "examiner.singh", location: "Forensic Lab 2", status: "recorded", reason: "Handover for cross-verification", timestamp: "2026-09-24T08:30:00.000Z" },
    { id: "c3", evidence_id: evidenceId, event_type: "analyzed", from_person: "examiner.singh", to_person: "examiner.singh", location: "Forensic Lab 2", status: "recorded", reason: "Recovery scan + erase execution", timestamp: "2026-09-24T09:00:00.000Z" },
    { id: "c4", evidence_id: evidenceId, event_type: "erased", from_person: "supervisor.mehta", to_person: "supervisor.mehta", location: "Forensic Lab 2", status: "recorded", reason: "Sanitization completed and verified", timestamp: "2026-09-24T11:20:44.500Z" },
  ];
}

function mockEvidenceItems(): EvidenceItem[] {
  return [
    {
      evidence_id: "EVID-9931", case_id: MOCK_CASE, device_label: "Seagate Barracuda 2TB (SN: Z4K8QW21)",
      sha256: "9f2c1a7e4b8d3f0a6c5e2b1d8a4f7c3e0b6d9a2f5c8e1b4d7a0f3c6e9b2d5a81",
      md5: "d41d8cd98f00b204e9800998ecf8427e",
      events: mockCustodyEvents("EVID-9931"),
    },
    {
      evidence_id: "EVID-9944", case_id: MOCK_CASE, device_label: "SanDisk USB 32GB (SN: SD8871A)",
      sha256: "1b4d7a0f3c6e9b2d5a819f2c1a7e4b8d3f0a6c5e2b1d8a4f7c3e0b6d9a2f5c8e",
      md5: "5eb63bbbe01eeed093cb22bb8f5acdc3",
      events: mockCustodyEvents("EVID-9944"),
    },
  ];
}

// ---------------------------------------------------------------------
// Public API — signatures mirror the Python contract functions.
// ---------------------------------------------------------------------

export async function fetchAuditLog(caseId?: string): Promise<AuditLogEntry[]> {
  if (USE_MOCK) {
    const rows = mockAuditLog();
    return caseId ? rows.filter((r) => r.case_id === caseId) : rows;
  }
  return invoke<AuditLogEntry[]>("fetch_audit_log", { caseId });
}

export async function fetchEvidenceItems(caseId?: string): Promise<EvidenceItem[]> {
  if (USE_MOCK) {
    const items = mockEvidenceItems();
    return caseId ? items.filter((i) => i.case_id === caseId) : items;
  }
  return invoke<EvidenceItem[]>("fetch_evidence_items", { caseId });
}

/** Mirrors log_audit_event(user_id, case_id, evidence_id, action_type,
 * description, result, status) -> str (returns the new row's id). */
export async function logAuditEvent(args: {
  userId: string;
  caseId: string;
  evidenceId: string | null;
  actionType: string;
  description: string;
  result: "success" | "failure" | "blocked";
  status: "info" | "success" | "warning" | "blocked";
}): Promise<string> {
  if (USE_MOCK) {
    return `mock-${Date.now()}`;
  }
  return invoke<string>("log_audit_event", args);
}

/** Mirrors record_chain_of_custody(evidence_id, event_type, from_person,
 * to_person, location, reason) -> str. */
export async function recordChainOfCustody(args: {
  evidenceId: string;
  eventType: "collected" | "transferred" | "analyzed" | "erased";
  fromPerson: string;
  toPerson: string;
  location: string;
  reason: string;
}): Promise<string> {
  if (USE_MOCK) {
    return `mock-${Date.now()}`;
  }
  return invoke<string>("record_chain_of_custody", args);
}

/** Mirrors verify_hash_chain(case_id: str | None = None) -> dict. */
export async function verifyHashChain(caseId?: string): Promise<HashChainStatus> {
  if (USE_MOCK) {
    return { intact: true, entries_checked: mockAuditLog().length, break_at_entry_id: null };
  }
  return invoke<HashChainStatus>("verify_hash_chain", { caseId });
}

export async function fetchReports(caseId: string): Promise<ReportRecord[]> {
  if (USE_MOCK) {
    return [];
  }
  return invoke<ReportRecord[]>("fetch_reports", { caseId });
}

/** Mirrors generate_report(report_type, case_id, operation_id) -> dict
 * with {"pdf_path": str, "json_path": str}. */
export async function generateReport(
  reportType: ReportType,
  caseId: string,
  operationId: string
): Promise<GenerateReportResult> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500)); // simulate render time
    return {
      pdf_path: `/mock/reports/${reportType}_${caseId}_${operationId}.pdf`,
      json_path: `/mock/reports/${reportType}_${caseId}_${operationId}.json`,
    };
  }
  return invoke<GenerateReportResult>("generate_report", {
    reportType,
    caseId,
    operationId,
  });
}

export const MOCK_CASE_ID = MOCK_CASE;
export const MOCK_USER_IDS = MOCK_USERS;
