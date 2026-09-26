import React, { useState } from "react";
import { useEvidenceItems } from "../hooks/useAuditData";
import { DetailPanel, DetailPanelContext } from "../components/DetailPanel";
import { relevantReportsForCustodyEvent } from "../components/reportRelevance";
import type { CustodyEvent, EvidenceItem } from "../types/audit";

export function ChainOfCustodyTab({ caseId }: { caseId?: string }) {
  const { items, loading } = useEvidenceItems(caseId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{ evidence: EvidenceItem; event: CustodyEvent } | null>(null);

  const selected = items.find((i) => i.evidence_id === selectedId) ?? items[0] ?? null;

  const detailContext: DetailPanelContext | null = selectedEvent
    ? {
        title: `${selectedEvent.event.event_type} — ${selectedEvent.evidence.evidence_id}`,
        caseId: selectedEvent.evidence.case_id,
        operationId: selectedEvent.event.id,
        fields: [
          { label: "Timestamp", value: selectedEvent.event.timestamp },
          { label: "From", value: selectedEvent.event.from_person },
          { label: "To", value: selectedEvent.event.to_person },
          { label: "Location", value: selectedEvent.event.location },
          { label: "Reason", value: selectedEvent.event.reason },
        ],
        relevantReports: relevantReportsForCustodyEvent(selectedEvent.event.event_type),
      }
    : null;

  if (loading) return <p className="mono">Loading evidence…</p>;

  return (
    <div className="custody-layout">
      <div className="evidence-list">
        {items.map((item) => (
          <div
            key={item.evidence_id}
            className={`evidence-list-item ${selected?.evidence_id === item.evidence_id ? "active" : ""}`}
            onClick={() => setSelectedId(item.evidence_id)}
          >
            <div className="mono">{item.evidence_id}</div>
            <div>{item.device_label}</div>
          </div>
        ))}
      </div>

      <div>
        {selected ? (
          <>
            <div className="field-grid" style={{ marginBottom: 20 }}>
              <div style={{ backgroundColor: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div className="field-label" style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>SHA-256</div>
                <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all', overflowWrap: 'anywhere', color: 'var(--text)', lineHeight: 1.4 }}>{selected.sha256}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div className="field-label" style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>MD5</div>
                <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all', overflowWrap: 'anywhere', color: 'var(--text)', lineHeight: 1.4 }}>{selected.md5}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div className="field-label" style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Case</div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{selected.case_id}</div>
              </div>
            </div>

            <div className="custody-timeline">
              {selected.events.map((event) => (
                <div
                  key={event.id}
                  className="custody-step"
                  onClick={() => setSelectedEvent({ evidence: selected, event })}
                  style={{ cursor: "pointer" }}
                >
                  <div className="event-type">{event.event_type}</div>
                  <div className="mono" style={{ fontSize: 12 }}>{event.timestamp}</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    {event.from_person} → {event.to_person} · {event.location}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {event.reason}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mono">No evidence items for this case yet.</p>
        )}
      </div>

      {detailContext && <DetailPanel context={detailContext} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
