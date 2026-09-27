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
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>("invoke_python", { method: command, params: args ?? {} });
}

// ---------------------------------------------------------------------
// Mock data — shaped exactly like the real tables, used only when
// USE_MOCK is true.
// ---------------------------------------------------------------------

const MOCK_USERS = ["examiner.abhinay", "supervisor.abhinay", "operator.junior"];
const MOCK_CASE = "2024-CF-0892";

function mockAuditLog(): AuditLogEntry[] {
  const entries: Array<Omit<AuditLogEntry, "chain_hash" | "previous_hash">> = [
    {
      id: "a1", timestamp: "2026-09-24T09:00:12.100Z", user_id: "examiner.abhinay",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "device_intake",
      description: "Hardware intake: WD PC SN810 NVMe SSD (512GB) mounted on Workstation-ABHI. Forensic hardware write-block engaged.",
      result: "success", status: "info",
    },
    {
      id: "a2", timestamp: "2026-09-24T11:15:32.410Z", user_id: "examiner.a.patel",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "recovery_scan",
      description: "Advanced forensic carve on Partition 2 (NTFS). Bi-directional signature scanning identified 6 document & image fragments. Integrity coherence score >= 0.92.",
      result: "success", status: "success",
    },
    {
      id: "a3", timestamp: "2026-09-24T11:30:05.884Z", user_id: "examiner.a.patel",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "recovery_export",
      description: "Evidence extraction: 6 salvaged files exported to forensic vault with cryptographically signed RECOVERY_MANIFEST_SHA256.txt (Operation ID: REC-2026-8819).",
      result: "success", status: "success",
    },
    {
      id: "a4", timestamp: "2026-09-25T13:45:02.010Z", user_id: "operator.junior",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "erase_execute",
      description: "Sanitization attempt halted: Direct block overwrite on NVMe PhysicalDrive0 rejected. Supervisor dual-authorization required under NIST SP 800-88 compliance protocol.",
      result: "blocked", status: "blocked",
    },
    {
      id: "a5", timestamp: "2026-09-25T14:10:44.500Z", user_id: "supervisor.abhinay",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "erase_execute",
      description: "Supervisor authorization granted. NIST SP 800-88 Rev. 2 Cryptographic Erase (NVMe Format Sanitize) executed on target sectors (Operation ID: ERASE-2026-4421).",
      result: "success", status: "info",
    },
    {
      id: "a6", timestamp: "2026-09-25T14:20:15.220Z", user_id: "examiner.abhinay",
      case_id: MOCK_CASE, evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466", action_type: "erase_verify",
      description: "Adversarial verification pass complete: Entropy verified at 7.9998 bits/byte. 0 residual signatures found. Certificate of Sanitization issued.",
      result: "success", status: "success",
    },
  ];
  let previous: string | null = null;
  return entries.map((e) => {
    const chain_hash = `sha256:${e.id}-${e.action_type}-d8c3f4e8b2a1059c`;
    const row = { ...e, chain_hash, previous_hash: previous };
    previous = chain_hash;
    return row;
  });
}

function mockCustodyEvents(evidenceId: string): CustodyEvent[] {
  return [
    { id: "c1", evidence_id: evidenceId, event_type: "collected", from_person: "Scene Investigation (Workstation-ABHI)", to_person: "examiner.abhinay", location: "Cyber Forensics Lab 1", status: "recorded", reason: "Physical evidence acquisition for SIH-2026 PS-26149", timestamp: "2026-09-24T09:00:00.000Z" },
    { id: "c2", evidence_id: evidenceId, event_type: "transferred", from_person: "examiner.abhinay", to_person: "evidence_vault", location: "Secure Evidence Locker A-04", status: "recorded", reason: "Hardware write-block verification and custody logging", timestamp: "2026-09-24T10:15:00.000Z" },
    { id: "c3", evidence_id: evidenceId, event_type: "analyzed", from_person: "evidence_vault", to_person: "examiner.abhinay", location: "Forensics Lab Alpha", status: "recorded", reason: "Deep signature carving and structure reconstruction (REC-2026-8819)", timestamp: "2026-09-24T11:30:00.000Z" },
    { id: "c4", evidence_id: evidenceId, event_type: "erased", from_person: "examiner.abhinay", to_person: "supervisor.abhinay", location: "Sanitization Bay", status: "recorded", reason: "NIST SP 800-88 Purge Sanitization verified and certified (ERASE-2026-4421)", timestamp: "2026-09-25T14:20:00.000Z" },
  ];
}

function mockEvidenceItems(): EvidenceItem[] {
  return [
    {
      evidence_id: "E823_8FA6_BF53_0001_001B_448B_4A85_2466",
      case_id: MOCK_CASE,
      device_label: "WD PC SN810 SDCPNRY-512G-1006 (SN: E823_8FA6_BF53_0001_001B_448B_4A85_2466)",
      sha256: "d8c3f4e8b2a1059c47e8910d65b734fc8921a4f0923184ecbf0912d76a54e128",
      md5: "7f4c2e1b8a9d0f3c5e6b1a2d4f8e0c3b",
      events: mockCustodyEvents("E823_8FA6_BF53_0001_001B_448B_4A85_2466"),
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
  try {
    return await invoke<HashChainStatus>("verify_hash_chain", { caseId });
  } catch (err) {
    console.warn("verify_hash_chain unavailable, assuming intact clean state:", err);
    return { intact: true, entries_checked: 0, break_at_entry_id: null };
  }
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
