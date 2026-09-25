import React, { useMemo, useState } from "react";
import { useAuditLog } from "../hooks/useAuditData";
import { StatusPill } from "../components/StatusPill";
import { DetailPanel, DetailPanelContext } from "../components/DetailPanel";
import { relevantReportsForAction } from "../components/reportRelevance";
import type { AuditLogEntry } from "../types/audit";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ActivityTimelineTab({ caseId }: { caseId?: string }) {
  const { entries, loading } = useAuditLog(caseId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const groups = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    const byDay = new Map<string, AuditLogEntry[]>();
    for (const e of sorted) {
      const key = dayLabel(e.timestamp);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }
    return Array.from(byDay.entries());
  }, [entries]);

  const detailContext: DetailPanelContext | null = selected
    ? {
        title: selected.action_type,
        caseId: selected.case_id,
        operationId: selected.id,
        fields: [
          { label: "Timestamp", value: selected.timestamp },
          { label: "User", value: selected.user_id },
          { label: "Description", value: selected.description },
        ],
        relevantReports: relevantReportsForAction(selected.action_type),
      }
    : null;

  if (loading) return <p className="mono">Loading activity…</p>;

  return (
    <div>
      {groups.map(([day, dayEntries]) => (
        <div key={day}>
          <div className="day-group-label">{day}</div>
          {dayEntries.map((entry) => {
            const isFailure = entry.status === "blocked" || entry.status === "warning";
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="timeline-card"
                onClick={() => {
                  if (isFailure) setExpandedId(isExpanded ? null : entry.id);
                  else setSelected(entry);
                }}
              >
                <div className="row">
                  <div>
                    <div className="desc">{entry.description}</div>
                    <div className="meta">{timeLabel(entry.timestamp)} · {entry.user_id} · {entry.action_type}</div>
                  </div>
                  <StatusPill status={entry.status} />
                </div>
                {isFailure && isExpanded && (
                  <div className="failure-box">
                    <strong>Why this happened: </strong>
                    {entry.description}
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(entry);
                        }}
                      >
                        View details / reports
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {detailContext && <DetailPanel context={detailContext} onClose={() => setSelected(null)} />}
    </div>
  );
}
