import React, { useState } from "react";
import { generateReport } from "../api/reforgeAuditApi";
import type { ReportType, GenerateReportResult } from "../types/audit";

const REPORT_DEFS: Array<{ type: ReportType; title: string; description: string }> = [
  {
    type: "forensic",
    title: "Forensic Report",
    description: "Recovered file list, operation timeline, and chain of custody for this case.",
  },
  {
    type: "erasure",
    title: "Erasure Report",
    description: "Method(s) used including fallback attempts, entropy measurements, and verification result.",
  },
  {
    type: "sanitization_cert",
    title: "Certificate of Sanitization",
    description: "NIST SP 800-88 Rev.2 certificate with a QR-encoded verification hash.",
  },
  {
    type: "section_65b",
    title: "Section 65B(4) Evidence Certificate",
    description: "Indian IT Act §65B(4) format declaration of non-alteration and examiner attestation.",
  },
];

interface ReportState {
  status: "idle" | "generating" | "done" | "error";
  result?: GenerateReportResult;
}

export function ReportGenerationTab({ caseId, operationId }: { caseId: string; operationId: string }) {
  const [states, setStates] = useState<Record<ReportType, ReportState>>({
    forensic: { status: "idle" },
    erasure: { status: "idle" },
    sanitization_cert: { status: "idle" },
    section_65b: { status: "idle" },
  });

  async function handleGenerate(type: ReportType) {
    setStates((s) => ({ ...s, [type]: { status: "generating" } }));
    try {
      const result = await generateReport(type, caseId, operationId);
      setStates((s) => ({ ...s, [type]: { status: "done", result } }));
    } catch {
      setStates((s) => ({ ...s, [type]: { status: "error" } }));
    }
  }

  function handleDownload(path: string) {
    window.open(path, "_blank");
  }

  return (
    <div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, maxWidth: 640 }}>
        Reports are generated fresh from live case data, then cached below —
        generating again always re-renders the latest state of the case.
      </p>
      <div className="report-grid">
        {REPORT_DEFS.map((def) => {
          const state = states[def.type];
          return (
            <div className="report-card" key={def.type}>
              <h3>{def.title}</h3>
              <p>{def.description}</p>
              <div className="actions">
                {state.status !== "done" ? (
                  <button
                    className="btn primary"
                    disabled={state.status === "generating"}
                    onClick={() => handleGenerate(def.type)}
                  >
                    {state.status === "generating" ? "Generating…" : "Generate"}
                  </button>
                ) : (
                  <>
                    <button className="btn primary" onClick={() => handleDownload(state.result!.pdf_path)}>
                      Download PDF
                    </button>
                    <button className="btn" onClick={() => handleDownload(state.result!.json_path)}>
                      Download JSON
                    </button>
                  </>
                )}
              </div>
              {state.status === "error" && (
                <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>
                  Report generation failed. Try again.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
