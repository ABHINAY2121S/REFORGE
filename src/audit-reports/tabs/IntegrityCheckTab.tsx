import React from "react";
import { useHashChainStatus } from "../hooks/useHashChainStatus";

export function IntegrityCheckTab({ caseId }: { caseId?: string }) {
  const { status, refresh, loading } = useHashChainStatus(caseId);

  if (loading && !status) {
    return (
      <div style={{ padding: "20px 0" }}>
        <p className="mono" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Loading audit log & verifying hash chain…
        </p>
      </div>
    );
  }

  // A chain is ONLY broken if the backend explicitly flagged intact: false AND provided a real entry ID.
  // Never interpret loading, empty data, null, or undefined as a broken chain.
  const isBroken = Boolean(status && status.intact === false && status.break_at_entry_id != null);
  const isIntact = !isBroken;
  const entriesChecked = status?.entries_checked ?? 0;

  return (
    <div>
      <div className={`integrity-hero ${isIntact ? "intact" : "broken"}`}>
        <div className="headline">
          {isIntact ? "✓ Hash chain intact" : "⚠ Hash chain integrity failure"}
        </div>
        <div className="sub">
          {isIntact
            ? (entriesChecked === 0
                ? "0 entries recorded. The cryptographic audit hash chain is initialized (GENESIS) and intact."
                : `${entriesChecked} entries verified for this case with no breaks in the chain.`)
            : `A break was detected at entry ${status?.break_at_entry_id}. Every entry before this point is verified; everything from this entry forward cannot be trusted until investigated.`}
        </div>
        <button className="btn" onClick={refresh} disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "Re-checking…" : "Re-run integrity check"}
        </button>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 16, maxWidth: 640 }}>
        This check walks every audit_log row in insertion order and recomputes
        each entry's chain_hash from the previous entry's hash (anchored at GENESIS), so any change
        to historical data — even a single character in a description —
        would be detected here.
      </p>
    </div>
  );
}
