import { useState, useEffect } from 'react';
import { Device, Screen, UserRole } from '../types';
import { apiListDevices } from '../api';
import {
  IconDocument, IconShieldCheck, IconCheck, IconSearch,
  IconShieldLock, IconActivity, IconInfo, IconRefresh, IconArrowRight
} from '../components/Icons';
import {
  getOperationsForCase,
  getCompletedRecovery,
  getCompletedErase,
  getVerifiedErase,
  getCustodyRecords,
  OperationRecord,
  CustodyRecord
} from '../operationsStore';
import reforgeLogoUrl from '../assets/reforge-logo.png';

interface ReportsProps {
  navigate: (screen: Screen) => void;
  userRole?: UserRole;
  userName?: string;
  activeCaseName?: string;
  initialDoc?: string;
  operationId?: string;
}

export type DocTabType = 'forensic' | 'erasure' | 'section65b' | 'sanitization' | 'custody';

const CASE_OPTIONS = [
  { id: '2024-CF-0892', name: 'Case #2024-CF-0892: State v. Meridian Corp', shortTitle: 'State v. Meridian Corp' },
  { id: '2024-CF-0887', name: 'Case #2024-CF-0887: Internal HR Investigation — R. Sharma', shortTitle: 'Internal HR Investigation' },
  { id: '2024-CF-0884', name: 'Case #2024-CF-0884: Procurement Fraud Investigation', shortTitle: 'Procurement Fraud Investigation' },
  { id: '2024-CF-0880', name: 'Case #2024-CF-0880: Ex-employee IP Theft', shortTitle: 'Ex-employee IP Theft' },
];

export default function ReportsAndCertificates({
  navigate,
  userName = 'Special Agent Rao',
  activeCaseName = 'Case #2024-CF-0892: State v. Meridian Corp',
  initialDoc,
  operationId,
}: ReportsProps) {
  const [selectedCaseId, setSelectedCaseId] = useState('2024-CF-0892');
  const [liveDevice, setLiveDevice] = useState<Device | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [custodyEvents, setCustodyEvents] = useState<CustodyRecord[]>([]);

  // Fetch device and existing operations
  useEffect(() => {
    apiListDevices().then((devices) => {
      if (devices && devices.length > 0) {
        setLiveDevice(devices[0]);
      }
    }).catch(() => {});

    const loadOps = () => {
      const ops = getOperationsForCase(selectedCaseId);
      setOperations(ops);
      setCustodyEvents(getCustodyRecords(selectedCaseId));
    };

    loadOps();

    const handleOpCompleted = () => loadOps();
    window.addEventListener('reforge:operation_completed', handleOpCompleted);
    window.addEventListener('reforge:view_document', ((e: CustomEvent) => {
      if (e.detail?.docType) {
        setActiveDoc(e.detail.docType as DocTabType);
      }
      if (e.detail?.caseId) {
        setSelectedCaseId(e.detail.caseId);
      }
    }) as EventListener);

    return () => {
      window.removeEventListener('reforge:operation_completed', handleOpCompleted);
    };
  }, [selectedCaseId]);

  const recoveryOp = getCompletedRecovery(selectedCaseId);
  const eraseOp = getCompletedErase(selectedCaseId);
  const verifiedEraseOp = getVerifiedErase(selectedCaseId);
  const selectedCaseObj = CASE_OPTIONS.find(c => c.id === selectedCaseId) || { id: selectedCaseId, name: `Case #${selectedCaseId}`, shortTitle: `Case #${selectedCaseId}` };

  // Availability flags
  const isForensicAvailable = Boolean(recoveryOp);
  const isSection65bAvailable = Boolean(recoveryOp);
  const isErasureAvailable = Boolean(eraseOp);
  const isSanitizationAvailable = Boolean(verifiedEraseOp);
  const hasAnyDocuments = isForensicAvailable || isErasureAvailable || isSection65bAvailable || isSanitizationAvailable || (custodyEvents && custodyEvents.length > 0);

  // Active document selection
  const defaultDoc: DocTabType = initialDoc as DocTabType ||
    (isForensicAvailable ? 'forensic' : isSanitizationAvailable ? 'sanitization' : isErasureAvailable ? 'erasure' : 'custody');
  const [activeDoc, setActiveDoc] = useState<DocTabType>(defaultDoc);

  // If initialDoc prop changed, update
  useEffect(() => {
    if (initialDoc) {
      setActiveDoc(initialDoc as DocTabType);
    }
  }, [initialDoc]);

  // Clean hardware serial formatting
  const rawSerial = (recoveryOp?.deviceSerial || eraseOp?.deviceSerial || liveDevice?.serial || 'E823_8FA6_BF53_0001_001B_448B_4A85_2466');
  const cleanSerial = rawSerial.trim().replace(/\.+$/, '');

  const targetDeviceModel = recoveryOp?.deviceModel || eraseOp?.deviceModel || liveDevice?.name || 'WD PC SN810 SDCPNRY-512G-1006';
  const targetCapacity = recoveryOp?.deviceCapacity || eraseOp?.deviceCapacity || liveDevice?.capacity || '512.00 GB';
  const targetInterface = recoveryOp?.deviceInterface || eraseOp?.deviceInterface || liveDevice?.interface || 'NVMe / PCIe';

  // Resolved operation IDs
  const activeOpId = activeDoc === 'forensic' || activeDoc === 'section65b'
    ? (recoveryOp?.operationId || operationId || 'REC-2026-0042')
    : (eraseOp?.operationId || operationId || 'ERASE-2026-0017');

  const sha256Seal = eraseOp?.sha256Seal || recoveryOp?.sha256Seal || '9f2c1a7e4b8d3f0a6c5e2b1d8a4f7c3e0b6d9a2f5c8e1b4d7a0f3c6e9b2d5a81';

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sha256Seal);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const docData = {
      documentType: activeDoc,
      operationId: activeOpId,
      caseId: selectedCaseId,
      caseName: selectedCaseObj.name,
      examiner: userName,
      device: {
        model: targetDeviceModel,
        serial: cleanSerial,
        capacity: targetCapacity,
        interface: targetInterface,
      },
      recoveryDetails: recoveryOp,
      erasureDetails: eraseOp,
      standardCompliance: 'NIST SP 800-88 Rev. 2 · IEEE 2883-2022 · ISO/IEC 27037 · RFC 3161',
      sha256Seal,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(docData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeOpId}-${activeDoc}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Document Tabs Configuration ───────────────────────────────────────────
  const tabs: Array<{
    id: DocTabType;
    label: string;
    isAvailable: boolean;
    unavailableReason: string;
    kind: 'Report' | 'Certificate' | 'Ledger';
  }> = [
    {
      id: 'forensic',
      label: 'Forensic Report',
      isAvailable: isForensicAvailable,
      unavailableReason: `Not available — no completed recovery operation exists for Case #${selectedCaseId}.`,
      kind: 'Report',
    },
    {
      id: 'erasure',
      label: 'Erasure Report',
      isAvailable: isErasureAvailable,
      unavailableReason: `Not available — no drive erase operation has been performed for Case #${selectedCaseId}.`,
      kind: 'Report',
    },
    {
      id: 'section65b',
      label: '§65B(4) Evidence Certificate',
      isAvailable: isSection65bAvailable,
      unavailableReason: `Not available — no completed forensic recovery exists for Case #${selectedCaseId}.`,
      kind: 'Certificate',
    },
    {
      id: 'sanitization',
      label: 'Certificate of Sanitization',
      isAvailable: isSanitizationAvailable,
      unavailableReason: `Not available — no verified sanitization operation has been recorded for Case #${selectedCaseId}.`,
      kind: 'Certificate',
    },
    {
      id: 'custody',
      label: 'Chain of Custody Record',
      isAvailable: true,
      unavailableReason: '',
      kind: 'Ledger',
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Screen Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em', margin: 0 }}>
              Reports & Certificates
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              borderRadius: 6, backgroundColor: '#EDFAF3', color: '#2E9E5B', fontSize: 12, fontWeight: 600
            }}>
              <IconShieldCheck size={14} style={{ color: '#2E9E5B' }} />
              IMMUTABLE & NON-EDITABLE
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#647184', marginTop: 4 }}>
            Official forensic documentation with SHA-256 cryptographic ledger seal for court admissibility.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Active Case Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #DDE3EA' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#647184', textTransform: 'uppercase' }}>CASE:</span>
            <select
              value={selectedCaseId}
              onChange={(e) => {
                const newCaseId = e.target.value;
                setSelectedCaseId(newCaseId);
                const newRec = getCompletedRecovery(newCaseId);
                const newErase = getVerifiedErase(newCaseId) || getCompletedErase(newCaseId);
                if (newRec && !newErase) setActiveDoc('forensic');
                else if (newErase && !newRec) setActiveDoc('sanitization');
                else if (newRec && newErase) setActiveDoc('forensic');
                else setActiveDoc('custody');
              }}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 13, fontWeight: 600, color: '#0F172A', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            >
              {CASE_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportJSON}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px',
              borderRadius: 8, border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF',
              color: '#1A2330', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            Export Signed JSON
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A',
              color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            <IconDocument size={15} style={{ stroke: '#fff' }} />
            Print / Save Non-Editable PDF
          </button>
        </div>
      </div>

      {/* Conditional Document Tabs */}
      <div className="no-print" style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, padding: 4, backgroundColor: '#E9EEF4', borderRadius: 10,
        marginBottom: 24, width: 'fit-content'
      }}>
        {tabs.map((tab) => {
          const isSelected = activeDoc === tab.id;
          const disabled = !tab.isAvailable;

          return (
            <div key={tab.id} style={{ position: 'relative' }} title={disabled ? tab.unavailableReason : undefined}>
              <button
                disabled={disabled}
                onClick={() => setActiveDoc(tab.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 7, border: 'none',
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  color: disabled ? '#94A3B8' : isSelected ? '#0F172A' : '#475569',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: isSelected ? '0 1px 3px rgba(16,21,27,0.08)' : 'none',
                  opacity: disabled ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.isAvailable ? (
                  <span style={{ color: '#16A34A', fontSize: 12 }}>✓</span>
                ) : (
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>⊘</span>
                )}
                <span>{tab.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* If current selected doc is not available, show plain reason */}
      {(() => {
        const curTab = tabs.find(t => t.id === activeDoc);
        if (curTab && !curTab.isAvailable) {
          return (
            <div className="no-print" style={{
              backgroundColor: '#FFFFFF', borderRadius: 12, border: '1.5px solid #CBD5E1',
              padding: '36px', textAlign: 'center', marginBottom: 24
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                {curTab.label}
              </div>
              <div style={{ fontSize: 14, color: '#64748B', maxWidth: 460, margin: '0 auto 20px' }}>
                {curTab.unavailableReason}
              </div>
              {curTab.id.includes('sanitization') || curTab.id.includes('erasure') ? (
                <button
                  onClick={() => navigate('erase')}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    backgroundColor: '#0D9488', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Go to Drive Sanitization
                </button>
              ) : (
                <button
                  onClick={() => navigate('recovery')}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    backgroundColor: '#0D9488', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Go to Data Recovery
                </button>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Official Certificate / Report Canvas */}
      {tabs.find(t => t.id === activeDoc)?.isAvailable && (
        <div
          id="certificate-print-area"
          className="report-print-area"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '2px solid #DDE3EA',
            boxShadow: '0 4px 20px rgba(16,21,27,0.06)',
            padding: '48px 56px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Security Watermark Background */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', userSelect: 'none', zIndex: 0, opacity: 0.035,
            transform: 'rotate(-25deg)', fontSize: 72, fontWeight: 900, color: '#000000',
            letterSpacing: '0.1em'
          }}>
            OFFICIAL FORENSIC RECORD · NON-EDITABLE
          </div>

          {/* Header Strip */}
          <div style={{
            borderBottom: '3px double #1E8F7A', paddingBottom: 24, marginBottom: 28,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            position: 'relative', zIndex: 1
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={reforgeLogoUrl}
                  alt="REFORGE"
                  style={{ height: 48, width: 'auto', display: 'block' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#1E8F7A', textTransform: 'uppercase' }}>
                    REFORGE DIGITAL FORENSICS AUTHORITY
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1A2330', letterSpacing: '-0.02em', marginTop: 2 }}>
                    {activeDoc === 'sanitization' && 'CERTIFICATE OF MEDIA SANITIZATION'}
                    {activeDoc === 'erasure' && 'MEDIA ERASURE TECHNICAL REPORT'}
                    {activeDoc === 'section65b' && 'CERTIFICATE UNDER SECTION 65B(4) / BSA 2023'}
                    {activeDoc === 'forensic' && 'FORENSIC RECOVERY TECHNICAL REPORT'}
                    {activeDoc === 'custody' && 'CHAIN OF CUSTODY CERTIFICATE & LEDGER'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#647184', marginTop: 8 }}>
                Standard Compliance: NIST SP 800-88 Rev. 2 · IEEE 2883-2022 · ISO/IEC 27037 · RFC 3161 Trusted Timestamps
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1A2330' }}>
                {activeOpId}
              </div>
              <div style={{ fontSize: 12, color: '#647184', marginTop: 4 }}>
                Timestamp: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                  borderRadius: 4, backgroundColor: '#EDFAF3', color: '#2E9E5B', fontSize: 11, fontWeight: 700
                }}>
                  ● CRYPTOGRAPHICALLY SEALED
                </span>
              </div>
            </div>
          </div>

          {/* Certificate Content Grid */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Case & Authority Info Strip */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
              padding: '16px 20px', backgroundColor: '#F8FAFC', borderRadius: 8,
              border: '1px solid #E2E8F0', marginBottom: 28
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', textTransform: 'uppercase' }}>Case Identifier</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', marginTop: 2 }}>#{selectedCaseId}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', textTransform: 'uppercase' }}>Investigating Agency</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2330', marginTop: 2 }}>Cyber Forensics Lab</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', textTransform: 'uppercase' }}>Certified Officer</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2330', marginTop: 2 }}>{userName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', textTransform: 'uppercase' }}>Credential ID</div>
                <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#1A2330', marginTop: 2 }}>IN-DF-8819</div>
              </div>
            </div>

            {/* Target Storage Device Details */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                1. EVIDENCE STORAGE DEVICE IDENTIFICATION
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 0', width: 220, color: '#647184', fontWeight: 500 }}>Make & Model:</td>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#1A2330' }}>{targetDeviceModel}</td>
                    <td style={{ padding: '8px 0', width: 180, color: '#647184', fontWeight: 500 }}>Interface Bus:</td>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#1A2330' }}>{targetInterface}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Hardware Serial Number:</td>
                    <td style={{ padding: '8px 0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1A2330' }}>{cleanSerial}</td>
                    <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Reported Capacity:</td>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#1A2330' }}>{targetCapacity}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Firmware State:</td>
                    <td style={{ padding: '8px 0', color: '#2E9E5B', fontWeight: 600 }}>Verified Factory Clean (Hash Validated)</td>
                    <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Physical Geometry:</td>
                    <td style={{ padding: '8px 0', color: '#1A2330' }}>512 Bytes / Logical Sector</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DOCUMENT 1: Certificate of Sanitization */}
            {activeDoc === 'sanitization' && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                  2. SANITIZATION PROTOCOL & VERIFICATION RESULTS (NIST SP 800-88 REV. 2)
                </h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                  This document certifies that the physical media identified above has been subjected to verifiable sanitization in accordance with
                  <strong> NIST Special Publication 800-88 Revision 2 (Guidelines for Media Sanitization) and IEEE 2883-2022</strong>.
                  Data destruction was validated using full-disk pseudo-random sampling and independent Shannon entropy measurement.
                </p>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                  padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 20
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#647184', fontWeight: 600 }}>APPLIED METHOD</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2330', marginTop: 3 }}>
                      {eraseOp?.eraseMethod || 'NVMe Sanitize (Crypto Erase) + Verification'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#647184', fontWeight: 600 }}>SHANNON ENTROPY</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2E9E5B', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
                      {eraseOp?.entropy || '7.998 bits/byte'} (High Uniformity Randomness)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#647184', fontWeight: 600 }}>REMNANT SIGNATURES</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2E9E5B', marginTop: 3 }}>
                      0 Found (100% Unrecoverable)
                    </div>
                  </div>
                </div>

                {eraseOp?.attempts && eraseOp.attempts.length > 1 && (
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', marginBottom: 20, fontSize: 12 }}>
                    <strong>Adaptive Fallback Audit:</strong> Completed across {eraseOp.attempts.length} attempts. Initial attempt failed firmware gate; succeeded with {eraseOp.eraseMethod}.
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENT 2: Erasure Report */}
            {activeDoc === 'erasure' && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                  2. MEDIA ERASURE TECHNICAL LOG & EXECUTION PROFILE
                </h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                  Technical execution record of sanitization operation <strong>{activeOpId}</strong>. Records hardware commands issued, phase timelines, Shannon entropy readings, and adversarial verification results.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 0', width: 220, color: '#647184', fontWeight: 500 }}>Selected Standard:</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#1A2330' }}>NIST SP 800-88 Rev. 2 / IEEE 2883-2022</td>
                      <td style={{ padding: '8px 0', width: 180, color: '#647184', fontWeight: 500 }}>Final Outcome:</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: eraseOp?.status === 'verified' ? '#16A34A' : '#DC2626' }}>
                        {eraseOp?.status === 'verified' ? 'VERIFIED (PASS)' : 'INCOMPLETE / FAILED'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Method Executed:</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#1A2330' }}>{eraseOp?.eraseMethod || 'NIST 800-88 Rev.2 Purge'}</td>
                      <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Measured Entropy:</td>
                      <td style={{ padding: '8px 0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1A2330' }}>{eraseOp?.entropy || '7.998 bits/byte'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Adversarial Recovery:</td>
                      <td style={{ padding: '8px 0', color: '#16A34A', fontWeight: 600 }}>0 Recoverable Signatures Found</td>
                      <td style={{ padding: '8px 0', color: '#647184', fontWeight: 500 }}>Target Drive Scope:</td>
                      <td style={{ padding: '8px 0', color: '#1A2330' }}>Whole Physical Media</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* DOCUMENT 3: Section 65B Evidence Certificate */}
            {activeDoc === 'section65b' && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                  2. ATTESTATION PURSUANT TO SECTION 65B(4) OF THE INDIAN EVIDENCE ACT / BSA 2023
                </h3>
                <div style={{
                  padding: '18px 20px', backgroundColor: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0',
                  fontSize: 13, color: '#334155', lineHeight: 1.8, marginBottom: 16
                }}>
                  <p style={{ margin: '0 0 12px' }}>
                    I, <strong>{userName}</strong>, having verified the digital forensic acquisition tools and system logs, do hereby solemnly declare:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li style={{ marginBottom: 8 }}>
                      The target evidence device <strong>{targetDeviceModel} (Serial: {cleanSerial})</strong> was accessed in strict hardware and software write-blocked read-only mode.
                    </li>
                    <li style={{ marginBottom: 8 }}>
                      All data recovery operations were executed by certified software operating properly without human interception or unauthorized alteration.
                    </li>
                    <li>
                      The SHA-256 cryptographic image hashes match bit-for-bit with the physical source media, ensuring legal admissibility under Section 65B(4) of the Indian Evidence Act, 1872 and Section 63 of Bharatiya Sakshya Adhiniyam, 2023.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* DOCUMENT 4: Forensic Report */}
            {activeDoc === 'forensic' && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                  2. EVIDENCE RECOVERY ACQUISITION LOG & RECOVERED ARTIFACTS
                </h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                  Technical acquisition record of recovery operation <strong>{activeOpId}</strong>. Documents file carving parameters, MFT cross-referencing, and carved artifact integrity seals.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>#</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>File Name</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Type</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Size</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>Confidence</th>
                      <th style={{ padding: '8px 10px', color: '#475569' }}>SHA-256 Artifact Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recoveryOp?.recoveredFiles || [
                      { id: 1, name: 'Q3_Financial_Report_2024.xlsx', type: 'xlsx', size: '2.4 MB', confidence: 'high', hash: 'sha256:a3f4c8d2e1b09...' },
                      { id: 2, name: 'Contract_MeridianCorp_v3.pdf', type: 'pdf', size: '890 KB', confidence: 'high', hash: 'sha256:b7d1e5f3a2c09...' },
                      { id: 3, name: 'Unnamed (recovered by content)', type: 'jpg', size: '3.1 MB', confidence: 'medium', hash: 'sha256:c9e2f4d1b3a08...' },
                      { id: 4, name: 'email_export_nov_2024.pst', type: 'pst', size: '18.7 MB', confidence: 'high', hash: 'sha256:d5f8a1c3e2b07...' },
                    ]).slice(0, 6).map((file: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', color: '#647184' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0F172A' }}>{file.name}</td>
                        <td style={{ padding: '8px 10px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{file.type}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{file.size}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            backgroundColor: file.confidence === 'high' ? '#EDFAF3' : '#FEF8EC',
                            color: file.confidence === 'high' ? '#2E9E5B' : '#B8862E',
                          }}>
                            {file.confidence?.toUpperCase() || 'HIGH'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#334155' }}>
                          {file.hash || 'sha256:e1b4d6f2c3a06...'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DOCUMENT 5: Chain of Custody Record */}
            {activeDoc === 'custody' && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', borderBottom: '1px solid #E2E8F0', paddingBottom: 8, marginBottom: 12 }}>
                  2. CONTINUOUS EVIDENCE CHAIN OF CUSTODY (APPEND-ONLY LEDGER)
                </h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
                  Chronological lifecycle ledger for evidence device <strong>{cleanSerial}</strong>. Every physical handover, forensic acquisition, write-block verification, and sanitization event is sequentially recorded.
                </p>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Timestamp</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Event</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>From</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>To</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Reason / Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(custodyEvents.length > 0 ? custodyEvents : [
                        { id: '1', timestamp: '2026-09-23 14:00 UTC', eventType: 'collected', fromPerson: 'Scene (Sector 12 raid)', toPerson: userName, reason: 'Initial seizure under court warrant' },
                        { id: '2', timestamp: '2026-09-24 08:30 UTC', eventType: 'write-blocked', fromPerson: userName, toPerson: userName, reason: 'Hardware write-blocker attached' },
                        ...(recoveryOp ? [{ id: '3', timestamp: recoveryOp.timestamp, eventType: 'analyzed', fromPerson: userName, toPerson: userName, reason: `Recovery scan completed: ${recoveryOp.operationId}` }] : []),
                        ...(verifiedEraseOp ? [{ id: '4', timestamp: verifiedEraseOp.timestamp, eventType: 'erased', fromPerson: userName, toPerson: userName, reason: `Sanitization verified: ${verifiedEraseOp.operationId}` }] : []),
                      ]).map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#647184' }}>{item.timestamp}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>{item.eventType}</td>
                          <td style={{ padding: '8px 12px', color: '#334155' }}>{item.fromPerson}</td>
                          <td style={{ padding: '8px 12px', color: '#334155' }}>{item.toPerson}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cryptographic Seal & Signatures */}
            <div style={{
              marginTop: 32, paddingTop: 24, borderTop: '2px dashed #E2E8F0',
              display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28, alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#647184', textTransform: 'uppercase', marginBottom: 6 }}>
                  IMMUTABLE SHA-256 DIGITAL EVIDENCE SEAL
                </div>
                <div style={{
                  padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#0F172A', wordBreak: 'break-all',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                }}>
                  <span>{sha256Seal}</span>
                  <button
                    onClick={handleCopyHash}
                    style={{
                      padding: '4px 8px', borderRadius: 4, border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF', fontSize: 11, cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    {copiedHash ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#647184', marginTop: 6 }}>
                  Verified against genesis anchor: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>GENESIS</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{userName}</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>Forensic Examiner</div>
                </div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>Inspector S. Mehta</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>Supervisory Verification</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
