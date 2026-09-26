import React, { useState } from "react";
import type { ReportType } from "../types/audit";
import { generateReport } from "../api/reforgeAuditApi";

export interface DetailPanelContext {
  title: string;
  caseId: string;
  operationId: string;
  fields: Array<{ label: string; value: string }>;
  relevantReports: ReportType[];
  navigate?: (screen: any, options?: any) => void;
}

const REPORT_LABELS: Record<ReportType, string> = {
  forensic: "Forensic Report",
  erasure: "Erasure Report",
  sanitization_cert: "Certificate of Sanitization",
  section_65b: "§65B(4) Evidence Certificate",
};

export function DetailPanel({
  context,
  onClose,
}: {
  context: DetailPanelContext;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<ReportType | null>(null);

  function handleView(reportType: ReportType) {
    const docTypeMap: Record<ReportType, string> = {
      forensic: "forensic",
      erasure: "erasure",
      section_65b: "section65b",
      sanitization_cert: "sanitization",
    };
    if (context.navigate) {
      context.navigate("reports", {
        operationId: context.operationId,
        initialDoc: docTypeMap[reportType],
      });
      onClose();
    } else {
      window.dispatchEvent(
        new CustomEvent("reforge:view_document", {
          detail: {
            operationId: context.operationId,
            docType: docTypeMap[reportType],
            caseId: context.caseId,
          },
        })
      );
      onClose();
    }
  }

  async function handleDownload(reportType: ReportType) {
    setPending(reportType);
    try {
      const result = await generateReport(reportType, context.caseId, context.operationId);
      window.open(result.pdf_path, "_blank");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{context.title}</h2>

        {context.fields.map((f) => (
          <div className="field" key={f.label}>
            <div className="field-label">{f.label}</div>
            <div className="mono">{f.value}</div>
          </div>
        ))}

        {context.relevantReports.length > 0 && (
          <div className="field" style={{ marginTop: 24 }}>
            <div className="field-label" style={{ fontWeight: 700, marginBottom: 8 }}>
              Generated Documents
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {context.relevantReports.map((rt) => (
                <div key={rt} style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn primary"
                    style={{ flex: 1, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}
                    onClick={() => handleView(rt)}
                  >
                    View {REPORT_LABELS[rt]}
                  </button>
                  <button
                    className="btn secondary"
                    style={{ padding: "8px 12px", fontSize: 12 }}
                    disabled={pending === rt}
                    onClick={() => handleDownload(rt)}
                    title="Export / Download PDF"
                  >
                    {pending === rt ? "…" : "Download"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
