import { useEffect, useState, useCallback } from "react";
import { verifyHashChain, fetchAuditLog } from "../api/reforgeAuditApi";
import type { HashChainStatus } from "../types/audit";

const POLL_INTERVAL_MS = 15_000;

interface LiveStatus {
  status: HashChainStatus | null;
  totalEntries: number | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Polls verify_hash_chain() and the audit log count so the top status
 * strip ("Live recording · N entries · Hash chain intact") reflects
 * real, live-updating state rather than a static string. Any screen
 * action that writes to the log (a new report, a custody event, an
 * erase) should also call refresh() immediately for a snappy update
 * instead of waiting for the next poll tick.
 */
export function useHashChainStatus(caseId?: string): LiveStatus {
  const [status, setStatus] = useState<HashChainStatus | null>(null);
  const [totalEntries, setTotalEntries] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([verifyHashChain(caseId), fetchAuditLog(caseId)])
      .then(([chainStatus, entries]) => {
        if (cancelled) return;
        setStatus(chainStatus);
        setTotalEntries(entries.length);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed: an unreachable backend should not silently claim
        // the chain is intact.
        setStatus({ intact: false, entries_checked: 0, break_at_entry_id: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    const cleanup = refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cleanup?.();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  return { status, totalEntries, loading, refresh };
}
