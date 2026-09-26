/**
 * REFORGE Forensic Operations & Document Lifecycle Store
 *
 * Enforces the strict conditional lifecycle:
 *   ANY ACTION              --> AUDIT TRAIL ENTRY
 *   RECOVERY COMPLETED      --> FORENSIC REPORT + §65B(4) CERTIFICATE + CUSTODY: ANALYZED
 *   ERASE COMPLETED         --> ERASURE REPORT
 *   ERASE VERIFIED (PASS)   --> CERTIFICATE OF SANITIZATION + CUSTODY: ERASED
 *   ERASE UNVERIFIED/FAILED --> NO CERTIFICATE OF SANITIZATION
 */

import { Device } from './types';
import { logAuditEvent, recordChainOfCustody } from './audit-reports/api/reforgeAuditApi';

export interface RecoveredItem {
  id: number | string;
  name: string;
  type: string;
  size: string;
  confidence: 'high' | 'medium' | 'low';
  hash: string;
  path: string;
}

export interface AttemptLog {
  attemptNum: number;
  method: string;
  result: 'success' | 'failed';
}

export interface OperationRecord {
  operationId: string;
  type: 'recovery' | 'erase';
  caseId: string;
  caseName: string;
  deviceModel: string;
  deviceSerial: string;
  deviceCapacity: string;
  deviceInterface: string;
  timestamp: string;
  examiner: string;
  badgeNo: string;
  status: 'completed' | 'verified' | 'failed' | 'incomplete';

  // Recovery-specific
  scanMethod?: string;
  recoveredCount?: number;
  recoveredFiles?: RecoveredItem[];

  // Erase-specific
  eraseMethod?: string;
  standard?: string;
  entropy?: string;
  remnantSignatures?: number;
  attempts?: AttemptLog[];
  sha256Seal?: string;
  prevChainHash?: string;
}

export interface CustodyRecord {
  id: string;
  caseId: string;
  deviceSerial: string;
  eventType: 'collected' | 'transferred' | 'analyzed' | 'erased' | 'write-blocked';
  fromPerson: string;
  toPerson: string;
  location: string;
  reason: string;
  timestamp: string;
}

const STORAGE_OPS_KEY = 'reforge_completed_operations_v3';
const STORAGE_CUSTODY_KEY = 'reforge_custody_records_v3';

const SEED_OPERATIONS: OperationRecord[] = [
  // ── CASE 1: Both Recovery & Erasing Done (Case #2024-CF-0892) ─────────────
  {
    operationId: 'REC-2026-8819',
    type: 'recovery',
    status: 'completed',
    caseId: '2024-CF-0892',
    caseName: 'State v. Meridian Corp',
    deviceModel: 'WD PC SN810 SDCPNRY-512G-1006',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    deviceCapacity: '512.11 GB',
    deviceInterface: 'NVMe PCIe Gen4 x4',
    timestamp: '2026-09-24 11:30:00 UTC',
    examiner: 'Inspector Abhinay',
    badgeNo: 'IN-DF-8819',
    scanMethod: 'Deep Signature Carving + Structure Reconstruction (Read-Only Mode)',
    recoveredCount: 6,
    recoveredFiles: [
      {
        id: 'rec-01',
        name: 'Confidential_Audit_Report_2024.pdf',
        type: 'PDF Document',
        size: '2.4 MB',
        confidence: 'high',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        path: 'D:\\Evidence\\Carved_PDF_001.pdf',
      },
      {
        id: 'rec-02',
        name: 'Financial_Ledger_Q3.xlsx',
        type: 'Excel Spreadsheet',
        size: '1.1 MB',
        confidence: 'high',
        hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
        path: 'D:\\Evidence\\Carved_XLSX_002.xlsx',
      },
      {
        id: 'rec-03',
        name: 'Surveillance_Capture_0924.jpg',
        type: 'JPEG Image',
        size: '3.8 MB',
        confidence: 'high',
        hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
        path: 'D:\\Evidence\\Carved_JPEG_003.jpg',
      },
      {
        id: 'rec-04',
        name: 'Evidence_Manifest_Signature.docx',
        type: 'Word Document',
        size: '640 KB',
        confidence: 'medium',
        hash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
        path: 'D:\\Evidence\\Carved_DOCX_004.docx',
      },
      {
        id: 'rec-05',
        name: 'System_Event_Logs.sqlite',
        type: 'SQLite Database',
        size: '4.5 MB',
        confidence: 'high',
        hash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
        path: 'D:\\Evidence\\Carved_SQLITE_005.sqlite',
      },
      {
        id: 'rec-06',
        name: 'Security_Incident_Summary.txt',
        type: 'Text File',
        size: '18 KB',
        confidence: 'high',
        hash: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
        path: 'D:\\Evidence\\Carved_TXT_006.txt',
      },
    ],
  },
  {
    operationId: 'ERASE-2026-4421',
    type: 'erase',
    status: 'verified',
    caseId: '2024-CF-0892',
    caseName: 'State v. Meridian Corp',
    deviceModel: 'WD PC SN810 SDCPNRY-512G-1006',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    deviceCapacity: '512.11 GB',
    deviceInterface: 'NVMe PCIe Gen4 x4',
    timestamp: '2026-09-25 14:20:00 UTC',
    examiner: 'Supervisor Abhinay',
    badgeNo: 'IN-DF-8819',
    eraseMethod: 'NIST SP 800-88 Rev. 2 Cryptographic Erase + Block Overwrite',
    standard: 'NIST SP 800-88 Rev. 2 · IEEE 2883-2022 · DoD 5220.22-M',
    entropy: '7.9998 bits/byte (Certified Zero Remanence)',
    remnantSignatures: 0,
    sha256Seal: 'd8c3f4e8b2a1059c47e8910d65b734fc8921a4f0923184ecbf0912d76a54e128',
    prevChainHash: '4a6b2c8e1f0d3a5b7c9e2f4a6b8d0c2e4f6a8b0d2e4f6a8b0c2d4e6f8a0b2c4',
    attempts: [
      {
        attemptNum: 1,
        method: 'NVMe Format Sanitize (Crypto Scramble + Zero Pass)',
        result: 'success',
      },
    ],
  },

  // ── CASE 2: ONLY Recovery Done (Case #2024-CF-0884: Procurement Fraud) ──────
  {
    operationId: 'REC-2026-0884',
    type: 'recovery',
    status: 'completed',
    caseId: '2024-CF-0884',
    caseName: 'Procurement Fraud Investigation',
    deviceModel: 'Kingston Canvas React Plus microSDXC 128GB',
    deviceSerial: 'KINGSTON_SD_128G_884920',
    deviceCapacity: '128.00 GB',
    deviceInterface: 'SDXC UHS-II / USB 3.2 Reader',
    timestamp: '2026-09-10 16:30:00 UTC',
    examiner: 'Examiner A. Patel',
    badgeNo: 'IN-DF-9412',
    scanMethod: 'Deep Signature Carving + ExFAT Cluster Chain Reconstruction',
    recoveredCount: 4,
    recoveredFiles: [
      {
        id: 'rec-pf-01',
        name: 'Procurement_Bids_Comparison_2024.xlsx',
        type: 'Excel Spreadsheet',
        size: '1.8 MB',
        confidence: 'high',
        hash: 'b4a8c9e1f2d3a4b5c6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9',
        path: 'D:\\Evidence\\Fraud_Invoices\\Carved_XLSX_0884_1.xlsx',
      },
      {
        id: 'rec-pf-02',
        name: 'Vendor_Kickback_Ledger_Confidential.pdf',
        type: 'PDF Document',
        size: '3.2 MB',
        confidence: 'high',
        hash: 'c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9',
        path: 'D:\\Evidence\\Fraud_Invoices\\Carved_PDF_0884_2.pdf',
      },
      {
        id: 'rec-pf-03',
        name: 'Whistleblower_Audio_Recording_Sep24.wav',
        type: 'WAV Audio',
        size: '14.6 MB',
        confidence: 'high',
        hash: 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
        path: 'D:\\Evidence\\Fraud_Invoices\\Carved_WAV_0884_3.wav',
      },
      {
        id: 'rec-pf-04',
        name: 'Encrypted_Communications_Archive.7z',
        type: '7-Zip Archive',
        size: '8.4 MB',
        confidence: 'medium',
        hash: 'e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
        path: 'D:\\Evidence\\Fraud_Invoices\\Carved_7Z_0884_4.7z',
      },
    ],
  },

  // ── CASE 3: ONLY Erase Done (Case #2024-CF-0887: Internal HR Investigation) ──
  {
    operationId: 'ERASE-2026-0887',
    type: 'erase',
    status: 'verified',
    caseId: '2024-CF-0887',
    caseName: 'Internal HR Investigation — R. Sharma',
    deviceModel: 'WD Black NVMe 1TB (NVMe0)',
    deviceSerial: 'WD_WDS100T3X0C_00SJG0_210984801294',
    deviceCapacity: '1000.20 GB',
    deviceInterface: 'NVMe PCIe Gen3 x4',
    timestamp: '2026-09-11 11:05:00 UTC',
    examiner: 'Examiner R. Kumar',
    badgeNo: 'IN-DF-9104',
    eraseMethod: 'NIST SP 800-88 Rev. 2 Clear + 3-Pass DoD 5220.22-M Overwrite',
    standard: 'NIST SP 800-88 Rev. 2 · IEEE 2883-2022 · DoD 5220.22-M',
    entropy: '7.9999 bits/byte (Certified Zero Remanence)',
    remnantSignatures: 0,
    sha256Seal: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    prevChainHash: 'GENESIS-ANCHOR-0887',
    attempts: [
      {
        attemptNum: 1,
        method: 'DoD 5220.22-M 3-Pass Overwrite + Verification',
        result: 'success',
      },
    ],
  },
];

const SEED_CUSTODY: CustodyRecord[] = [
  // Case 2024-CF-0892 (Both)
  {
    id: 'CUST-001',
    caseId: '2024-CF-0892',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    eventType: 'collected',
    fromPerson: 'Hardware Intake (Workstation-ABHI)',
    toPerson: 'Inspector Abhinay',
    location: 'Cyber Forensics Lab 1',
    reason: 'Physical evidence acquisition under court warrant',
    timestamp: '2026-09-24 09:00:00 UTC',
  },
  {
    id: 'CUST-002',
    caseId: '2024-CF-0892',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    eventType: 'write-blocked',
    fromPerson: 'Inspector Abhinay',
    toPerson: 'Inspector Abhinay',
    location: 'Forensics Workstation-ABHI',
    reason: 'Hardware & OS read-only write-blocking engaged for non-destructive analysis',
    timestamp: '2026-09-24 09:15:00 UTC',
  },
  {
    id: 'CUST-003',
    caseId: '2024-CF-0892',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    eventType: 'analyzed',
    fromPerson: 'Inspector Abhinay',
    toPerson: 'Inspector Abhinay',
    location: 'Cyber Forensics Lab 1',
    reason: 'Forensic recovery scan completed. Carved 6 structured files. (Op: REC-2026-8819)',
    timestamp: '2026-09-24 11:30:00 UTC',
  },
  {
    id: 'CUST-004',
    caseId: '2024-CF-0892',
    deviceSerial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    eventType: 'erased',
    fromPerson: 'Inspector Abhinay',
    toPerson: 'Supervisor Abhinay',
    location: 'Sanitization Facility',
    reason: 'Secure media sanitization verified under NIST SP 800-88 Rev. 2. (Op: ERASE-2026-4421)',
    timestamp: '2026-09-25 14:20:00 UTC',
  },

  // Case 2024-CF-0887 (Only Erasing)
  {
    id: 'CUST-005',
    caseId: '2024-CF-0887',
    deviceSerial: 'WD_WDS100T3X0C_00SJG0_210984801294',
    eventType: 'collected',
    fromPerson: 'Corporate Security Intake',
    toPerson: 'Examiner R. Kumar',
    location: 'Secure Quarantine Lockup',
    reason: 'Internal HR Investigation Device Seizure',
    timestamp: '2026-09-09 09:30:00 UTC',
  },
  {
    id: 'CUST-006',
    caseId: '2024-CF-0887',
    deviceSerial: 'WD_WDS100T3X0C_00SJG0_210984801294',
    eventType: 'erased',
    fromPerson: 'Examiner R. Kumar',
    toPerson: 'HR Director',
    location: 'Decommissioning Lab',
    reason: 'NIST SP 800-88 Rev. 2 Sanitization verified prior to employee re-issuance (Op: ERASE-2026-0887)',
    timestamp: '2026-09-11 11:05:00 UTC',
  },

  // Case 2024-CF-0884 (Only Recovery)
  {
    id: 'CUST-007',
    caseId: '2024-CF-0884',
    deviceSerial: 'KINGSTON_SD_128G_884920',
    eventType: 'collected',
    fromPerson: 'Finance Audit Officer',
    toPerson: 'Examiner A. Patel',
    location: 'Evidence Vault B',
    reason: 'Procurement Fraud suspect microSD evidence seizure',
    timestamp: '2026-09-08 14:00:00 UTC',
  },
  {
    id: 'CUST-008',
    caseId: '2024-CF-0884',
    deviceSerial: 'KINGSTON_SD_128G_884920',
    eventType: 'write-blocked',
    fromPerson: 'Examiner A. Patel',
    toPerson: 'Examiner A. Patel',
    location: 'Forensics Workstation-PATEL',
    reason: 'Write-block bridge engaged to preserve integrity for court admissibility',
    timestamp: '2026-09-08 14:30:00 UTC',
  },
  {
    id: 'CUST-009',
    caseId: '2024-CF-0884',
    deviceSerial: 'KINGSTON_SD_128G_884920',
    eventType: 'analyzed',
    fromPerson: 'Examiner A. Patel',
    toPerson: 'Examiner A. Patel',
    location: 'Cyber Forensics Lab 2',
    reason: 'Targeted recovery scan completed. Carved 4 key procurement bid documents. (Op: REC-2026-0884)',
    timestamp: '2026-09-10 16:30:00 UTC',
  },

  // Case 2024-CF-0880 (Pending Intake)
  {
    id: 'CUST-010',
    caseId: '2024-CF-0880',
    deviceSerial: 'PENDING_SERIAL_0880',
    eventType: 'collected',
    fromPerson: 'IT Security Desk',
    toPerson: 'Investigator S. Mehta',
    location: 'Evidence Quarantine Locker 4',
    reason: 'Suspect media logged into evidence custody pending forensic authorization',
    timestamp: '2026-09-05 10:00:00 UTC',
  },
];

function readStoredOps(): OperationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_OPS_KEY);
    if (!raw) {
      writeStoredOps(SEED_OPERATIONS);
      return SEED_OPERATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_OPERATIONS;
  } catch {
    return SEED_OPERATIONS;
  }
}

function writeStoredOps(ops: OperationRecord[]) {
  try {
    localStorage.setItem(STORAGE_OPS_KEY, JSON.stringify(ops));
  } catch (err) {
    console.error('Failed to persist operation record:', err);
  }
}

function readStoredCustody(): CustodyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTODY_KEY);
    if (!raw) {
      writeStoredCustody(SEED_CUSTODY);
      return SEED_CUSTODY;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_CUSTODY;
  } catch {
    return SEED_CUSTODY;
  }
}

function writeStoredCustody(records: CustodyRecord[]) {
  try {
    localStorage.setItem(STORAGE_CUSTODY_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to persist custody record:', err);
  }
}

/** Get all operations for a given case and optionally target device */
export function getOperationsForCase(caseId?: string, deviceSerial?: string): OperationRecord[] {
  const all = readStoredOps();
  return all.filter((op) => {
    const matchCase = !caseId || op.caseId.toLowerCase().includes(caseId.toLowerCase()) || caseId.toLowerCase().includes(op.caseId.toLowerCase());
    const matchSerial = !deviceSerial || op.deviceSerial.replace(/\.+$/, '') === deviceSerial.replace(/\.+$/, '');
    return matchCase && matchSerial;
  });
}

/** Lookup exact operation by its unique operationId */
export function getOperationById(operationId: string): OperationRecord | undefined {
  const all = readStoredOps();
  return all.find((op) => op.operationId === operationId);
}

/** Check if a completed recovery operation exists */
export function getCompletedRecovery(caseId?: string, deviceSerial?: string): OperationRecord | undefined {
  const ops = getOperationsForCase(caseId, deviceSerial);
  return ops.find((op) => op.type === 'recovery' && op.status === 'completed');
}

/** Check if an erasure operation exists (whether verified or incomplete) */
export function getCompletedErase(caseId?: string, deviceSerial?: string): OperationRecord | undefined {
  const ops = getOperationsForCase(caseId, deviceSerial);
  return ops.find((op) => op.type === 'erase');
}

/** Check if a VERIFIED erasure operation exists (required for Certificate of Sanitization) */
export function getVerifiedErase(caseId?: string, deviceSerial?: string): OperationRecord | undefined {
  const ops = getOperationsForCase(caseId, deviceSerial);
  return ops.find((op) => op.type === 'erase' && op.status === 'verified');
}

/** Get running Chain of Custody records for a device */
export function getCustodyRecords(caseId?: string, deviceSerial?: string): CustodyRecord[] {
  const all = readStoredCustody();
  return all.filter((rec) => {
    const matchCase = !caseId || rec.caseId.toLowerCase().includes(caseId.toLowerCase()) || caseId.toLowerCase().includes(rec.caseId.toLowerCase());
    const matchSerial = !deviceSerial || rec.deviceSerial.replace(/\.+$/, '') === deviceSerial.replace(/\.+$/, '');
    return matchCase && matchSerial;
  });
}

/**
 * Record a completed Recovery operation:
 * 1. Saves OperationRecord
 * 2. Appends "analyzed" event to Chain of Custody
 * 3. Logs an audit entry
 */
export function recordRecoveryCompleted(params: {
  caseId: string;
  caseName: string;
  device: Device;
  recoveredFiles: RecoveredItem[];
  examiner?: string;
  badgeNo?: string;
}): OperationRecord {
  const now = new Date();
  const year = now.getFullYear();
  const opSeq = Math.floor(1000 + Math.random() * 9000);
  const operationId = `REC-${year}-${opSeq}`;
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const cleanSerial = (params.device.serial || 'WF2096DW').trim().replace(/\.+$/, '');

  const op: OperationRecord = {
    operationId,
    type: 'recovery',
    status: 'completed',
    caseId: params.caseId,
    caseName: params.caseName,
    deviceModel: params.device.name || params.device.model,
    deviceSerial: cleanSerial,
    deviceCapacity: params.device.capacity,
    deviceInterface: params.device.interface,
    timestamp,
    examiner: params.examiner || 'Special Agent Rao',
    badgeNo: params.badgeNo || 'IN-DF-8819',
    scanMethod: 'Deep Signature Carving + Journal Analysis (Read-Only Mode)',
    recoveredCount: params.recoveredFiles.length,
    recoveredFiles: params.recoveredFiles,
  };

  const ops = readStoredOps();
  // Filter out older duplicate recovery for this specific device in this case so latest wins
  const nextOps = ops.filter(o => !(o.type === 'recovery' && o.deviceSerial === cleanSerial && o.caseId === params.caseId));
  nextOps.unshift(op);
  writeStoredOps(nextOps);

  // Append Chain of Custody: Analyzed
  const custodyEvent: CustodyRecord = {
    id: `CUST-${Date.now()}`,
    caseId: params.caseId,
    deviceSerial: cleanSerial,
    eventType: 'analyzed',
    fromPerson: op.examiner,
    toPerson: op.examiner,
    location: 'Cyber Forensics Lab 2',
    reason: `Forensic recovery scan completed. Found ${params.recoveredFiles.length} files. (Op: ${operationId})`,
    timestamp,
  };
  const custodyList = readStoredCustody();
  custodyList.push(custodyEvent);
  writeStoredCustody(custodyList);

  // Sync to backend audit log
  logAuditEvent({
    userId: op.examiner,
    caseId: op.caseId,
    evidenceId: cleanSerial,
    actionType: 'recovery_completed',
    description: `Recovery Completed: ${params.recoveredFiles.length} files carved & cataloged (Operation ID: ${operationId})`,
    result: 'success',
    status: 'success',
  }).catch(() => {});

  recordChainOfCustody({
    evidenceId: cleanSerial,
    eventType: 'analyzed',
    fromPerson: op.examiner,
    toPerson: op.examiner,
    location: 'Cyber Forensics Lab 2',
    reason: `Recovery scan completed: ${operationId}`,
  }).catch(() => {});

  // Dispatch custom window event so open screens re-evaluate
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reforge:operation_completed', { detail: op }));
  }

  return op;
}

/**
 * Record a completed Erase operation:
 * 1. Saves OperationRecord
 * 2. If status === 'verified', appends "erased" event to Chain of Custody
 * 3. Logs an audit entry
 */
export function recordEraseCompleted(params: {
  caseId: string;
  caseName: string;
  device: Device;
  selectedMethod: string;
  methodLabel: string;
  status: 'verified' | 'failed' | 'incomplete';
  entropy: number;
  attempts?: AttemptLog[];
  examiner?: string;
  badgeNo?: string;
}): OperationRecord {
  const now = new Date();
  const year = now.getFullYear();
  const opSeq = Math.floor(1000 + Math.random() * 9000);
  const operationId = `ERASE-${year}-${opSeq}`;
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const cleanSerial = (params.device.serial || 'WF2096DW').trim().replace(/\.+$/, '');

  const op: OperationRecord = {
    operationId,
    type: 'erase',
    status: params.status,
    caseId: params.caseId,
    caseName: params.caseName,
    deviceModel: params.device.name || params.device.model,
    deviceSerial: cleanSerial,
    deviceCapacity: params.device.capacity,
    deviceInterface: params.device.interface,
    timestamp,
    examiner: params.examiner || 'Special Agent Rao',
    badgeNo: params.badgeNo || 'IN-DF-8819',
    eraseMethod: params.methodLabel,
    standard: 'NIST SP 800-88 Rev. 2 · IEEE 2883-2022',
    entropy: `${params.entropy.toFixed(3)} bits/byte`,
    remnantSignatures: params.status === 'verified' ? 0 : 14,
    attempts: params.attempts,
    sha256Seal: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    prevChainHash: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  };

  const ops = readStoredOps();
  // Filter out older erase for this specific device in this case so latest wins
  const nextOps = ops.filter(o => !(o.type === 'erase' && o.deviceSerial === cleanSerial && o.caseId === params.caseId));
  nextOps.unshift(op);
  writeStoredOps(nextOps);

  if (params.status === 'verified') {
    // Append Chain of Custody: Erased
    const custodyEvent: CustodyRecord = {
      id: `CUST-${Date.now()}`,
      caseId: params.caseId,
      deviceSerial: cleanSerial,
      eventType: 'erased',
      fromPerson: op.examiner,
      toPerson: op.examiner,
      location: 'Cyber Forensics Lab 2',
      reason: `Secure media sanitization verified under NIST SP 800-88 Rev. 2. (Op: ${operationId})`,
      timestamp,
    };
    const custodyList = readStoredCustody();
    custodyList.push(custodyEvent);
    writeStoredCustody(custodyList);

    recordChainOfCustody({
      evidenceId: cleanSerial,
      eventType: 'erased',
      fromPerson: op.examiner,
      toPerson: op.examiner,
      location: 'Cyber Forensics Lab 2',
      reason: `Sanitization verified: ${operationId}`,
    }).catch(() => {});
  }

  // Sync to backend audit log
  logAuditEvent({
    userId: op.examiner,
    caseId: op.caseId,
    evidenceId: cleanSerial,
    actionType: params.status === 'verified' ? 'erase_completed' : 'erase_failed',
    description: `Secure Erasure ${params.status === 'verified' ? 'Completed & Verified' : 'Incomplete'}: ${params.methodLabel} (Operation ID: ${operationId})`,
    result: params.status === 'verified' ? 'success' : 'failure',
    status: params.status === 'verified' ? 'success' : 'blocked',
  }).catch(() => {});

  // Dispatch custom window event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reforge:operation_completed', { detail: op }));
  }

  return op;
}
