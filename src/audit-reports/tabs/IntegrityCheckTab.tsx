import React from "react";
import { useHashChainStatus } from "../hooks/useHashChainStatus";

export function IntegrityCheckTab({ caseId }: { caseId?: string }) {
  const { status, refresh, loading } = useHashChainStatus(caseId);

  if (!status) return <p className="mono">Verifying hash chain…</p>;

  return (
    <div>
      <div className={`integrity-hero ${status.intact ? "intact" : "broken"}`}>
        <div className="headline">
          {status.intact ? "Hash chain intact" : "Hash chain integrity failure"}
        </div>
        <div className="sub">
          {status.intact
            ? `${status.entries_checked} entries verified for this case with no breaks in the chain.`
            : `A break was detected at entry ${status.break_at_entry_id}. Every entry before this point is verified; everything from this entry forward cannot be trusted until investigated.`}
        </div>
        <button className="btn" onClick={refresh} disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "Re-checking…" : "Re-run integrity check"}
        </button>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 16, maxWidth: 640 }}>
        This check walks every audit_log row in insertion order and recomputes
        each entry's chain_hash from the previous entry's hash, so any change
        to historical data — even a single character in a description —
        would be detected here.
      </p>
    </div>
  );
}
