import React, { useState } from "react";
import type { ReportType } from "../types/audit";
import { generateReport } from "../api/reforgeAuditApi";

export interface DetailPanelContext {
  title: string;
  caseId: string;
  operationId: string;
  fields: Array<{ label: string; value: string }>;
  /** Which report types are relevant to this specific row/card — e.g. an
   * erase_execute entry offers "erasure" + "sanitization_cert"; a
   * recovery_scan entry offers "forensic". */
  relevantReports: ReportType[];
}

const REPORT_LABELS: Record<ReportType, string> = {
  forensic: "Forensic Report",
  erasure: "Erasure Report",
  sanitization_cert: "Certificate of Sanitization",
  section_65b: "Section 65B(4) Certificate",
};

export function DetailPanel({
  context,
  onClose,
}: {
  context: DetailPanelContext;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<ReportType | null>(null);

  async function handleDownload(reportType: ReportType) {
    setPending(reportType);
    try {
      const result = await generateReport(reportType, context.caseId, context.operationId);
      // In the real (Tauri) build, this triggers the OS save dialog /
      // opens the file; in mock mode we just surface the path.
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

        <div className="field" style={{ marginTop: 24 }}>
          <div className="field-label">Relevant Reports</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {context.relevantReports.map((rt) => (
              <button
                key={rt}
                className="btn primary"
                disabled={pending === rt}
                onClick={() => handleDownload(rt)}
              >
                {pending === rt ? "Generating…" : `Download ${REPORT_LABELS[rt]}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
