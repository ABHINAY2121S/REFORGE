import React from "react";
import { useHashChainStatus } from "../hooks/useHashChainStatus";

export function StatusStrip({ caseId }: { caseId?: string }) {
  const { status, totalEntries, loading } = useHashChainStatus(caseId);
  const broken = status !== null && !status.intact;

  return (
    <div className={`status-strip ${broken ? "broken" : ""}`}>
      <span className="dot" />
      <span>Live recording</span>
      <span className="sep">·</span>
      <span className="count">
        {loading && totalEntries === null ? "…" : totalEntries} entries
      </span>
      <span className="sep">·</span>
      <span className="chain-state">
        {status === null
          ? "Checking hash chain…"
          : status.intact
          ? "Hash chain intact"
          : `Hash chain broken at entry ${status.break_at_entry_id}`}
      </span>
    </div>
  );
}
