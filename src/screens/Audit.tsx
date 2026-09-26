/**
 * Audit screen — thin wrapper around the real AuditReportsScreen component.
 *
 * The AuditReportsScreen was built by the Verification & Audit team. It is
 * self-contained, has its own data fetching via reforgeAuditApi.ts, and
 * renders all five tabs (Audit Log, Chain of Custody, Activity Timeline,
 * Integrity Check, Report Generation).
 *
 * This file just passes in the active case/operation context from the
 * REFORGE app shell.
 */

import type { Screen } from '../types';
import { AuditReportsScreen } from '../audit-reports/AuditReportsScreen';

interface AuditProps {
  navigate: (screen: Screen) => void;
  caseId?: string;
  operationId?: string;
}

export default function Audit({ navigate, caseId, operationId }: AuditProps) {
  return (
    <AuditReportsScreen
      navigate={navigate}
      caseId={caseId}
      operationId={operationId}
    />
  );
}
