import { useEffect, useMemo, useState } from "react";
import { fetchAuditLog, fetchEvidenceItems } from "../api/reforgeAuditApi";
import type { AuditLogEntry, EvidenceItem, AuditLogFilters } from "../types/audit";

export function useAuditLog(caseId?: string) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAuditLog(caseId).then((rows) => {
      if (!cancelled) {
        setEntries(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return { entries, loading };
}

export function useEvidenceItems(caseId?: string) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEvidenceItems(caseId).then((rows) => {
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return { items, loading };
}

export const DEFAULT_FILTERS: AuditLogFilters = {
  search: "",
  user_id: "all",
  case_id: "all",
  action_type: "all",
  status: "all",
};

export function useFilteredAuditLog(entries: AuditLogEntry[], filters: AuditLogFilters) {
  return useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filters.user_id !== "all" && e.user_id !== filters.user_id) return false;
      if (filters.case_id !== "all" && e.case_id !== filters.case_id) return false;
      if (filters.action_type !== "all" && e.action_type !== filters.action_type) return false;
      if (filters.status !== "all" && e.status !== filters.status) return false;
      if (search) {
        const haystack = `${e.description} ${e.action_type} ${e.user_id} ${e.evidence_id ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [entries, filters]);
}
