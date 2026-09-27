import { useState } from 'react';
import { Screen, UserRole } from '../types';
import {
  IconHardDrive, IconSearch, IconShieldLock, IconPlus, IconCheck, IconActivity, IconAlertTriangle, IconInfo, IconDocument, IconShieldCheck
} from '../components/Icons';
import {
  getCompletedRecovery,
  getCompletedErase,
  getVerifiedErase,
  getCustodyRecords
} from '../operationsStore';

interface CasesProps {
  navigate: (screen: Screen) => void;
  userRole: UserRole;
}

type CaseTab = 'operations' | 'correlation';

const cases = [
  {
    id: '2024-CF-0892',
    name: 'State v. Meridian Corp',
    description: 'Corporate data exfiltration investigation & media sanitization audit.',
    status: 'active',
    mode: 'both',
    devices: ['WD PC SN810 NVMe 512GB', 'Seagate Barracuda 2TB'],
    operations: 2,
    opened: '2024-11-08',
    assignee: 'Inspector Abhinay',
    ops: [
      { type: 'recovery', device: 'WD PC SN810 NVMe 512GB', status: 'verified', time: '11:30, 24 Sep' },
      { type: 'erase', device: 'WD PC SN810 NVMe 512GB', status: 'verified', time: '14:20, 25 Sep' },
    ],
    correlationEdges: [
      {
        devA: 'WD PC SN810 NVMe 512GB', devB: 'Seagate Barracuda 2TB', matchCount: 3,
        matches: [
          { type: 'hash', label: 'Contract_MeridianCorp_v3.pdf', detail: 'SHA-256 match — identical file on both drives', confidence: 97 },
          { type: 'timestamp', label: 'NTFS journal entry — 2024-09-04 14:22', detail: 'Same file modification event logged on both devices within 4s', confidence: 84 },
          { type: 'fragment', label: 'Fragment signature 0xA3F4C8D2', detail: 'Matching header fragment in unallocated space on both drives', confidence: 71 },
        ],
      },
    ],
  },
  {
    id: '2024-CF-0884',
    name: 'Procurement Fraud Investigation',
    description: 'Targeted recovery of deleted bid comparisons, kickback ledgers and encrypted archives.',
    status: 'active',
    mode: 'recovery',
    devices: ['Kingston Canvas React Plus microSDXC 128GB'],
    operations: 1,
    opened: '2024-09-08',
    assignee: 'Examiner A. Patel',
    ops: [
      { type: 'recovery', device: 'Kingston Canvas React Plus microSDXC 128GB', status: 'verified', time: '16:30, 10 Sep' },
    ],
    correlationEdges: [],
  },
  {
    id: '2024-CF-0887',
    name: 'Internal HR Investigation — R. Sharma',
    description: 'Decommissioned workstation SSD sanitization & verification prior to redeployment.',
    status: 'active',
    mode: 'erase',
    devices: ['WD Black NVMe 1TB'],
    operations: 1,
    opened: '2024-09-09',
    assignee: 'Examiner R. Kumar',
    ops: [
      { type: 'erase', device: 'WD Black NVMe 1TB', status: 'verified', time: '11:05, 11 Sep' },
    ],
    correlationEdges: [],
  },
  {
    id: '2024-CF-0880',
    name: 'Ex-employee IP Theft',
    description: 'Quarantined storage intake pending legal authorization and forensic imaging.',
    status: 'pending',
    mode: 'pending',
    devices: ['Quarantined USB 64GB'],
    operations: 0,
    opened: '2024-09-05',
    assignee: 'Investigator S. Mehta',
    ops: [],
    correlationEdges: [],
  },
];

const statusConfig = {
  active: { label: 'Active', bg: '#E8F5F2', color: '#1E8F7A', Icon: IconActivity },
  closed: { label: 'Closed', bg: '#F5F7FA', color: '#647184', Icon: IconCheck },
  pending: { label: 'Pending', bg: '#FEF8EC', color: '#B8862E', Icon: IconAlertTriangle },
};

const opStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  verified: { label: 'Verified', bg: '#EDFAF3', color: '#2E9E5B' },
  'in-progress': { label: 'In Progress', bg: '#E8F5F2', color: '#1E8F7A' },
  'needs-review': { label: 'Needs Review', bg: '#FEF8EC', color: '#B8862E' },
  failed: { label: 'Failed', bg: '#FEF2F3', color: '#C6394A' },
};

const matchTypeIcon: Record<string, string> = {
  hash: '≡',
  timestamp: '⏱',
  fragment: '⟨⟩',
};

// USP 4: SVG node graph
function CorrelationGraph({
  devices,
  edges,
  onEdgeClick,
  activeEdgeIdx,
}: {
  devices: string[];
  edges: { devA: string; devB: string; matchCount: number }[];
  onEdgeClick: (i: number) => void;
  activeEdgeIdx: number | null;
}) {
  const W = 420, H = 220;
  const nodeR = 30;

  // Lay out up to 4 nodes in a circle
  const nodePositions = devices.map((_, i) => {
    const angle = (i / devices.length) * 2 * Math.PI - Math.PI / 2;
    const cx = W / 2 + (H / 2 - nodeR - 24) * Math.cos(angle);
    const cy = H / 2 + (H / 2 - nodeR - 24) * Math.sin(angle);
    return { cx, cy };
  });

  if (devices.length < 2) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: '#647184' }}>
        Correlation requires at least 2 devices on this case.
      </div>
    );
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
      {/* Edges */}
      {edges.map((edge, i) => {
        const ai = devices.indexOf(edge.devA);
        const bi = devices.indexOf(edge.devB);
        if (ai < 0 || bi < 0) return null;
        const { cx: x1, cy: y1 } = nodePositions[ai];
        const { cx: x2, cy: y2 } = nodePositions[bi];
        const active = activeEdgeIdx === i;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        return (
          <g key={i} style={{ cursor: 'pointer' }} onClick={() => onEdgeClick(i)}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={active ? '#1E8F7A' : '#B0BAC9'}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? 'none' : '5,3'}
            />
            {/* Match count badge */}
            <circle cx={mx} cy={my} r={12} fill={active ? '#1E8F7A' : '#FFFFFF'} stroke={active ? '#1E8F7A' : '#B0BAC9'} strokeWidth={1.5} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={active ? '#FFFFFF' : '#647184'}>
              {edge.matchCount}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {devices.map((name, i) => {
        const { cx, cy } = nodePositions[i];
        const short = name.split(' ').slice(0, 2).join(' ');
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={nodeR} fill="#F5F7FA" stroke="#DDE3EA" strokeWidth={1.5} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} dominantBaseline="auto">💾</text>
            <text x={cx} y={cy + nodeR + 14} textAnchor="middle" fontSize={10} fill="#647184">
              {short.length > 16 ? short.slice(0, 14) + '…' : short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Cases({ navigate, userRole }: CasesProps) {
  const [selectedCase, setSelectedCase] = useState(cases[0]);
  const [caseTab, setCaseTab] = useState<CaseTab>('operations');
  const [activeEdgeIdx, setActiveEdgeIdx] = useState<number | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [newCaseAssignee, setNewCaseAssignee] = useState('');

  const handleEdgeClick = (i: number) => {
    setActiveEdgeIdx(prev => prev === i ? null : i);
  };

  const activeEdge = activeEdgeIdx != null ? selectedCase.correlationEdges[activeEdgeIdx] : null;
  const hasMultipleDevices = selectedCase.devices.length >= 2;

  const recOp = getCompletedRecovery(selectedCase.id);
  const eraseOp = getCompletedErase(selectedCase.id);
  const verifiedEraseOp = getVerifiedErase(selectedCase.id);
  const custodyRecords = getCustodyRecords(selectedCase.id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>
            Case Management
          </div>
          <div style={{ fontSize: 14, color: '#647184', marginTop: 4 }}>
            {cases.filter(c => c.status === 'active').length} active cases · {cases.length} total
          </div>
        </div>
        {userRole !== 'Auditor' && (
          <button
            onClick={() => setShowNewCase(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A', color: '#FFFFFF',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <IconPlus size={15} style={{ stroke: '#fff' }} />
            New Case
          </button>
        )}
      </div>

      {/* New Case Modal */}
      {showNewCase && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16,21,27,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 8px 32px rgba(16,21,27,0.18)', border: '1px solid #DDE3EA' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A2330', marginBottom: 4 }}>Open New Case</div>
            <div style={{ fontSize: 13, color: '#647184', marginBottom: 22 }}>Create a new forensic investigation case file.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#647184', display: 'block', marginBottom: 5 }}>CASE NAME *</label>
                <input
                  autoFocus
                  value={newCaseName}
                  onChange={e => setNewCaseName(e.target.value)}
                  placeholder="e.g. State v. Meridian Corp"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #DDE3EA', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box', color: '#1A2330' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#647184', display: 'block', marginBottom: 5 }}>DESCRIPTION</label>
                <textarea
                  value={newCaseDesc}
                  onChange={e => setNewCaseDesc(e.target.value)}
                  placeholder="Brief description of the investigation..."
                  rows={3}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #DDE3EA', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'none', color: '#1A2330' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#647184', display: 'block', marginBottom: 5 }}>ASSIGNED INVESTIGATOR</label>
                <input
                  value={newCaseAssignee}
                  onChange={e => setNewCaseAssignee(e.target.value)}
                  placeholder="e.g. S. Mehta"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #DDE3EA', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box', color: '#1A2330' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => { setShowNewCase(false); setNewCaseName(''); setNewCaseDesc(''); setNewCaseAssignee(''); }}
                style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF', color: '#647184', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                disabled={!newCaseName.trim()}
                onClick={() => {
                  alert(`Case "${newCaseName}" created successfully! (Demo — data not persisted in prototype)`);
                  setShowNewCase(false); setNewCaseName(''); setNewCaseDesc(''); setNewCaseAssignee('');
                }}
                style={{ padding: '9px 18px', borderRadius: 7, border: 'none', backgroundColor: newCaseName.trim() ? '#1E8F7A' : '#B0BAC9', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: newCaseName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Cases list */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cases.map((c) => {
              const cfg = statusConfig[c.status as keyof typeof statusConfig];
              const CfgIcon = cfg.Icon;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCase(c); setCaseTab('operations'); setActiveEdgeIdx(null); }}
                  style={{
                    textAlign: 'left', padding: '16px 18px', borderRadius: 10,
                    border: `1.5px solid ${selectedCase.id === c.id ? '#1E8F7A' : '#DDE3EA'}`,
                    backgroundColor: selectedCase.id === c.id ? '#FFFFFF' : 'transparent',
                    boxShadow: selectedCase.id === c.id ? '0 1px 3px rgba(16,21,27,0.07)' : 'none',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#647184' }}>
                      #{c.id}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {c.mode === 'both' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EDFAF3', color: '#16A34A' }}>
                          Both
                        </span>
                      )}
                      {c.mode === 'recovery' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#E8F5F2', color: '#1E8F7A' }}>
                          Recovery
                        </span>
                      )}
                      {c.mode === 'erase' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                          Erase
                        </span>
                      )}
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                          padding: '2px 7px', borderRadius: 10,
                          backgroundColor: cfg.bg, color: cfg.color,
                        }}
                      >
                        <CfgIcon size={10} style={{ stroke: cfg.color }} />
                        {cfg.label}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2330', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#647184' }}>
                    <span>{c.devices.length} device{c.devices.length !== 1 ? 's' : ''}</span>
                    <span>{c.operations} operation{c.operations !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Case detail */}
        {selectedCase && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '22px 24px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2330', marginBottom: 4 }}>
                    {selectedCase.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#647184', marginBottom: 10 }}>
                    {selectedCase.description}
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#647184' }}>
                    <span>Case: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1A2330' }}>#{selectedCase.id}</span></span>
                    <span>Opened: <span style={{ color: '#1A2330' }}>{selectedCase.opened}</span></span>
                    <span>Assigned to: <span style={{ color: '#1A2330' }}>{selectedCase.assignee}</span></span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id } }));
                    navigate('reports');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 7, border: '1.5px solid #1E8F7A', backgroundColor: '#EDFAF3',
                    color: '#1E8F7A', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  <IconDocument size={14} style={{ stroke: '#1E8F7A' }} />
                  View Reports & Certificates
                </button>
              </div>

              {/* Devices */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #DDE3EA' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 10 }}>
                  LINKED DEVICES ({selectedCase.devices.length})
                </div>
                {selectedCase.devices.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedCase.devices.map((d) => (
                      <div
                        key={d}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px',
                          borderRadius: 6, backgroundColor: '#F5F7FA', border: '1px solid #DDE3EA',
                          fontSize: 12, color: '#1A2330',
                        }}
                      >
                        <IconHardDrive size={12} style={{ stroke: '#647184' }} />
                        {d}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#647184' }}>
                    No devices linked. Add devices by starting an operation.
                  </div>
                )}
              </div>

              {/* Reports & Certificates for Selected Case (PRAHARI Documentation Engine) */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #DDE3EA', backgroundColor: '#FBFCFD' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2330', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Case Reports & Admissible Certificates
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, backgroundColor: '#EDFAF3', color: '#16A34A' }}>
                      Cryptographically Sealed
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#647184' }}>
                    Click any document to inspect or print
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                  {/* Forensic Recovery Docs */}
                  {recOp && (
                    <>
                      <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#1E8F7A', fontSize: 13, fontWeight: 700 }}>✓</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>Forensic Report</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#647184', marginTop: 2 }}>
                            {recOp.operationId} · {recOp.recoveredCount || 4} files carved
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id, docType: 'forensic' } }));
                            navigate('reports');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #1E8F7A', backgroundColor: '#EDFAF3', color: '#1E8F7A', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          View Report →
                        </button>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#1E8F7A', fontSize: 13, fontWeight: 700 }}>✓</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>BSA §63 Certificate</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#647184', marginTop: 2 }}>
                            BSA 2023 court-admissible certificate
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id, docType: 'section65b' } }));
                            navigate('reports');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #1E8F7A', backgroundColor: '#EDFAF3', color: '#1E8F7A', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          View Cert →
                        </button>
                      </div>
                    </>
                  )}

                  {/* Sanitization / Erasure Docs */}
                  {eraseOp && (
                    <>
                      <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#2563EB', fontSize: 13, fontWeight: 700 }}>✓</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>Erasure Report</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#647184', marginTop: 2 }}>
                            {eraseOp.operationId} · Technical erasure log
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id, docType: 'erasure' } }));
                            navigate('reports');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #2563EB', backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          View Report →
                        </button>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#2563EB', fontSize: 13, fontWeight: 700 }}>✓</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>Sanitization Certificate</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#647184', marginTop: 2 }}>
                            NIST SP 800-88 / IEEE 2883-2022 Verified
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id, docType: 'sanitization' } }));
                            navigate('reports');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #2563EB', backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          View Cert →
                        </button>
                      </div>
                    </>
                  )}

                  {/* Always Chain of Custody */}
                  <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#1E8F7A', fontSize: 13, fontWeight: 700 }}>✓</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>Chain of Custody Record</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#647184', marginTop: 2 }}>
                        Sequential custody ledger ({custodyRecords.length} logged events)
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('reforge:view_document', { detail: { caseId: selectedCase.id, docType: 'custody' } }));
                        navigate('reports');
                      }}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #647184', backgroundColor: '#F8FAFC', color: '#1A2330', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >
                      View Ledger →
                    </button>
                  </div>
                </div>

                {/* Specific Case Operational Context Note */}
                {recOp && !eraseOp && (
                  <div style={{ marginTop: 12, padding: '7px 12px', borderRadius: 6, backgroundColor: '#E8F5F2', border: '1px solid #C2E7DD', fontSize: 11, color: '#1E8F7A', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconInfo size={12} style={{ stroke: '#1E8F7A' }} />
                    Evidence Preservation Mode: Physical storage media preserved for court proceedings. Media sanitization was not performed.
                  </div>
                )}
                {eraseOp && !recOp && (
                  <div style={{ marginTop: 12, padding: '7px 12px', borderRadius: 6, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 11, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconInfo size={12} style={{ stroke: '#2563EB' }} />
                    Media Decommissioning Mode: Drive sanitized with certified zero remanence. Data recovery was not requested for this case.
                  </div>
                )}
                {!recOp && !eraseOp && (
                  <div style={{ marginTop: 12, padding: '7px 12px', borderRadius: 6, backgroundColor: '#FEF8EC', border: '1px solid #FDE6B0', fontSize: 11, color: '#B8862E', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconAlertTriangle size={12} style={{ stroke: '#B8862E' }} />
                    Evidence Intake Mode: Device currently quarantined. Run a Recovery scan or Drive Sanitization to generate technical certificates.
                  </div>
                )}
              </div>

              {/* Tab bar — USP 4: show Correlation View when 2+ devices */}
              <div style={{ display: 'flex', borderBottom: '1px solid #DDE3EA', padding: '0 24px' }}>
                {([
                  { key: 'operations' as CaseTab, label: 'Operations' },
                  ...(hasMultipleDevices ? [{ key: 'correlation' as CaseTab, label: 'Correlation View' }] : []),
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setCaseTab(key)}
                    style={{
                      padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: caseTab === key ? 600 : 400,
                      color: caseTab === key ? '#1A2330' : '#647184',
                      borderBottom: `2px solid ${caseTab === key ? '#1E8F7A' : 'transparent'}`,
                      marginBottom: -1, fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'color 0.1s ease',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Operations tab */}
              {caseTab === 'operations' && (
                <div style={{ padding: '18px 24px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 12 }}>
                    OPERATIONS ({selectedCase.ops.length})
                  </div>
                  {selectedCase.ops.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedCase.ops.map((op, i) => {
                        const cfg = opStatusConfig[op.status] ?? { label: op.status, bg: '#F5F7FA', color: '#647184' };
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                              borderRadius: 8, backgroundColor: '#F8FAFB', border: '1px solid #F0F3F6',
                            }}
                          >
                            <div
                              style={{
                                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                                backgroundColor: op.type === 'recovery' ? '#E8F5F2' : '#FEF2F3',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {op.type === 'recovery'
                                ? <IconSearch size={13} style={{ stroke: '#1E8F7A' }} />
                                : <IconShieldLock size={13} style={{ stroke: '#C6394A' }} />
                              }
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330', textTransform: 'capitalize' }}>
                                {op.type}
                              </div>
                              <div style={{ fontSize: 12, color: '#647184' }}>{op.device}</div>
                            </div>
                            <div
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                                padding: '3px 9px', borderRadius: 10,
                                backgroundColor: cfg.bg, color: cfg.color,
                              }}
                            >
                              {cfg.label}
                            </div>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#647184' }}>
                              {op.time}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#647184' }}>
                      No operations yet.
                    </div>
                  )}

                  {userRole !== 'Auditor' && (
                    <button
                      onClick={() => navigate('devices')}
                      style={{
                        marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                        borderRadius: 8, border: '1px solid #1E8F7A', backgroundColor: '#E8F5F2',
                        color: '#1E8F7A', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      <IconPlus size={14} style={{ stroke: '#1E8F7A' }} />
                      Add Operation to this Case
                    </button>
                  )}
                </div>
              )}

              {/* USP 4: Correlation tab */}
              {caseTab === 'correlation' && (
                <div style={{ padding: '24px' }}>
                  <div style={{ fontSize: 13, color: '#647184', marginBottom: 20, lineHeight: 1.6 }}>
                    Connecting lines show shared evidence found between devices. Click a line to see the matching items.
                  </div>

                  <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                    {/* Graph */}
                    <div style={{ flex: 1, backgroundColor: '#F8FAFB', borderRadius: 10, border: '1px solid #EEF1F5', padding: '20px 0' }}>
                      <CorrelationGraph
                        devices={selectedCase.devices}
                        edges={selectedCase.correlationEdges.map(e => ({ devA: e.devA, devB: e.devB, matchCount: e.matchCount }))}
                        onEdgeClick={handleEdgeClick}
                        activeEdgeIdx={activeEdgeIdx}
                      />
                      {selectedCase.correlationEdges.length === 0 && (
                        <div style={{ textAlign: 'center', fontSize: 12, color: '#B0BAC9', marginTop: 12 }}>
                          No shared evidence detected between these devices yet.
                        </div>
                      )}
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#B0BAC9', marginTop: 12 }}>
                        Click a number badge on a connecting line to view matches
                      </div>
                    </div>

                    {/* Match detail panel */}
                    {activeEdge && (
                      <div style={{ width: 280, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2330', marginBottom: 4 }}>
                          {activeEdge.matchCount} match{activeEdge.matchCount !== 1 ? 'es' : ''} found
                        </div>
                        <div style={{ fontSize: 12, color: '#647184', marginBottom: 14 }}>
                          Between <strong style={{ color: '#1A2330' }}>{activeEdge.devA.split(' ').slice(0, 2).join(' ')}</strong> and <strong style={{ color: '#1A2330' }}>{activeEdge.devB.split(' ').slice(0, 2).join(' ')}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeEdge.matches.map((m, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '12px 14px', borderRadius: 8, backgroundColor: '#FFFFFF',
                                border: '1px solid #DDE3EA',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 14, lineHeight: 1 }}>{matchTypeIcon[m.type] ?? '·'}</span>
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2330', flex: 1, wordBreak: 'break-word' }}>{m.label}</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#1E8F7A', flexShrink: 0 }}>{m.confidence}%</span>
                              </div>
                              <div style={{ fontSize: 11, color: '#647184', lineHeight: 1.5 }}>{m.detail}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Placeholder when no edge selected */}
                    {!activeEdge && selectedCase.correlationEdges.length > 0 && (
                      <div style={{ width: 260, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                        <div style={{ textAlign: 'center', fontSize: 12, color: '#B0BAC9' }}>
                          <IconInfo size={18} style={{ stroke: '#DDE3EA', margin: '0 auto 8px' } as React.CSSProperties} />
                          Select a connection to see shared evidence
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
