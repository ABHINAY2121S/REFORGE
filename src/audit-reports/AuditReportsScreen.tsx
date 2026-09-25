import React, { useState } from "react";
import "./styles/audit-screen.css";
import { StatusStrip } from "./components/StatusStrip";
import { AuditLogTab } from "./tabs/AuditLogTab";
import { ChainOfCustodyTab } from "./tabs/ChainOfCustodyTab";
import { ActivityTimelineTab } from "./tabs/ActivityTimelineTab";
import { IntegrityCheckTab } from "./tabs/IntegrityCheckTab";
import { ReportGenerationTab } from "./tabs/ReportGenerationTab";
import { MOCK_CASE_ID } from "./api/reforgeAuditApi";

type TabId = "audit_log" | "chain_of_custody" | "activity_timeline" | "integrity_check" | "report_generation";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "audit_log", label: "Audit Log" },
  { id: "chain_of_custody", label: "Chain of Custody" },
  { id: "activity_timeline", label: "Activity Timeline" },
  { id: "integrity_check", label: "Integrity Check" },
  { id: "report_generation", label: "Report Generation" },
];

export interface AuditReportsScreenProps {
  /** The case currently open in REFORGE. Defaults to a demo case ID when
   * not provided, so this screen renders standalone during development. */
  caseId?: string;
  /** The most recent operation ID for this case, used by the Report
   * Generation tab and by row-level "download report" actions when a
   * more specific operation ID isn't available from the row itself. */
  operationId?: string;
}

export function AuditReportsScreen({
  caseId = MOCK_CASE_ID,
  operationId = "op-latest",
}: AuditReportsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>("audit_log");

  return (
    <div className="audit-screen">
      <StatusStrip caseId={caseId} />

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {activeTab === "audit_log" && <AuditLogTab caseId={caseId} />}
        {activeTab === "chain_of_custody" && <ChainOfCustodyTab caseId={caseId} />}
        {activeTab === "activity_timeline" && <ActivityTimelineTab caseId={caseId} />}
        {activeTab === "integrity_check" && <IntegrityCheckTab caseId={caseId} />}
        {activeTab === "report_generation" && (
          <ReportGenerationTab caseId={caseId} operationId={operationId} />
        )}
      </div>
    </div>
  );
}

export default AuditReportsScreen;
