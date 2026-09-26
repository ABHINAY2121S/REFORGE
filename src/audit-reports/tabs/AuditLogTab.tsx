import React, { useMemo, useState } from "react";
import { useAuditLog, useFilteredAuditLog, DEFAULT_FILTERS } from "../hooks/useAuditData";
import { StatusPill } from "../components/StatusPill";
import { DetailPanel, DetailPanelContext } from "../components/DetailPanel";
import { relevantReportsForAction } from "../components/reportRelevance";
import type { AuditLogEntry, AuditLogFilters } from "../types/audit";

type SortKey = "timestamp" | "user_id" | "case_id" | "action_type" | "status";

export function AuditLogTab({ caseId, navigate }: { caseId?: string; navigate?: (screen: any, options?: any) => void }) {
  const { entries, loading } = useAuditLog(caseId);
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const filtered = useFilteredAuditLog(entries, filters);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return sortAsc ? rows : rows.reverse();
  }, [filtered, sortKey, sortAsc]);

  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.user_id))), [entries]);
  const cases = useMemo(() => Array.from(new Set(entries.map((e) => e.case_id))), [entries]);
  const actionTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.action_type))), [entries]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const detailContext: DetailPanelContext | null = selected
    ? (() => {
        const opIdMatch = selected.description.match(/Operation ID:\s*([A-Za-z0-9_-]+)/i);
        const resolvedOpId = opIdMatch ? opIdMatch[1] : selected.id;
        const isRecovery = selected.action_type.toLowerCase().includes("recovery");
        const isErase = selected.action_type.toLowerCase().includes("erase");
        const title = isRecovery ? "Recovery Completed" : isErase ? "Secure Erasure Completed" : selected.action_type;

        return {
          title,
          caseId: selected.case_id,
          operationId: resolvedOpId,
          fields: [
            { label: "Operation ID", value: resolvedOpId },
            { label: "Evidence / Device", value: selected.evidence_id ?? "—" },
            { label: "Completed", value: selected.timestamp },
            { label: "User / Examiner", value: selected.user_id },
            { label: "Description", value: selected.description },
            { label: "Result", value: selected.result },
            { label: "Chain hash", value: selected.chain_hash },
          ],
          relevantReports: relevantReportsForAction(selected.action_type),
          navigate,
        };
      })()
    : null;

  return (
    <div>
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search description, user, evidence…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}>
          <option value="all">All users</option>
          {users.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select value={filters.case_id} onChange={(e) => setFilters({ ...filters, case_id: e.target.value })}>
          <option value="all">All cases</option>
          {cases.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filters.action_type} onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}>
          <option value="all">All actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}>
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="blocked">Blocked</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <p className="mono">Loading audit log…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("timestamp")}>Timestamp</th>
              <th onClick={() => toggleSort("user_id")}>User</th>
              <th onClick={() => toggleSort("case_id")}>Case ID</th>
              <th>Evidence / Device</th>
              <th onClick={() => toggleSort("action_type")}>Action</th>
              <th>Result</th>
              <th onClick={() => toggleSort("status")}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.id} onClick={() => setSelected(entry)}>
                <td className="mono">{entry.timestamp}</td>
                <td>{entry.user_id}</td>
                <td className="mono">{entry.case_id}</td>
                <td className="mono">{entry.evidence_id ?? "—"}</td>
                <td>{entry.action_type}</td>
                <td>{entry.result}</td>
                <td><StatusPill status={entry.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detailContext && <DetailPanel context={detailContext} onClose={() => setSelected(null)} />}
    </div>
  );
}
