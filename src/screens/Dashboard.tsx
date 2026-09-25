import { useState } from 'react';
import { Screen, UserRole } from '../types';
import {
  IconPlus, IconSearch, IconShieldLock, IconShieldCheck,
  IconActivity, IconHardDrive, IconCheck, IconX, IconAlertTriangle, IconDocument
} from '../components/Icons';

interface DashboardProps {
  navigate: (screen: Screen) => void;
  userName: string;
  activeCaseName: string;
  userRole: UserRole;
}

const operations = [
  { id: 1, type: 'recovery', device: 'Seagate Barracuda 2TB (SDA)', status: 'verified', time: '09:14, Today', caseId: '2024-CF-0892' },
  { id: 2, type: 'erase', device: 'Samsung 870 EVO SSD (SDB)', status: 'in-progress', time: '08:47, Today', caseId: '2024-CF-0892' },
  { id: 3, type: 'recovery', device: 'SanDisk Ultra USB 3.2', status: 'needs-review', time: '11 Sep, 14:22', caseId: '2024-CF-0887' },
  { id: 4, type: 'erase', device: 'WD Black NVMe 1TB (NVMe0)', status: 'verified', time: '11 Sep, 11:05', caseId: '2024-CF-0887' },
  { id: 5, type: 'recovery', device: 'Kingston microSD 128GB', status: 'failed', time: '10 Sep, 16:30', caseId: '2024-CF-0884' },
];

const pendingReviews = [
  { id: 1, type: 'erase', device: 'Samsung 870 EVO SSD (SDB)', investigator: 'S. Mehta', time: '10:42, Today', caseId: '2024-CF-0892' },
  { id: 2, type: 'recovery', device: 'SanDisk Ultra USB 3.2', investigator: 'R. Kumar', time: '11 Sep, 14:22', caseId: '2024-CF-0887' },
];

const auditFeed = [
  { time: '09:14:22', user: 'S. Mehta', event: 'Recovery operation verified — Case #2024-CF-0892', type: 'success' },
  { time: '08:47:01', user: 'S. Mehta', event: 'Erase initiated — Samsung 870 EVO SSD', type: 'warning' },
  { time: '08:44:15', user: 'System', event: 'Device connected — Samsung 870 EVO SSD (SDB)', type: 'info' },
  { time: '08:30:00', user: 'A. Patel', event: 'Case #2024-CF-0892 opened', type: 'info' },
  { time: '11 Sep 23:58', user: 'System', event: 'Daily audit log sealed — chain intact', type: 'success' },
  { time: '11 Sep 14:22', user: 'R. Kumar', event: 'Recovery scan started — SanDisk Ultra', type: 'info' },
  { time: '11 Sep 11:05', user: 'R. Kumar', event: 'Erasure certificate generated — WD Black NVMe', type: 'success' },
];

const statusConfig = {
  'verified': { label: 'Verified', bg: '#EDFAF3', color: '#2E9E5B', Icon: IconCheck },
  'in-progress': { label: 'In Progress', bg: '#E8F5F2', color: '#1E8F7A', Icon: IconActivity },
  'needs-review': { label: 'Needs Review', bg: '#FEF8EC', color: '#B8862E', Icon: IconAlertTriangle },
  'failed': { label: 'Failed', bg: '#FEF2F3', color: '#C6394A', Icon: IconX },
};

const auditTypeColors = {
  success: '#2E9E5B',
  warning: '#B8862E',
  info: '#4C5FC7',
  danger: '#C6394A',
};

interface NewOpModalProps {
  onClose: () => void;
  navigate: (screen: Screen) => void;
}

function NewOpModal({ onClose, navigate }: NewOpModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(16,21,27,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 32, width: 440,
          boxShadow: '0 8px 32px rgba(16,21,27,0.16)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2330', marginBottom: 6 }}>
          Start a New Operation
        </div>
        <div style={{ fontSize: 13, color: '#647184', marginBottom: 24 }}>
          Choose a device first. You can select the operation type after.
        </div>
        <button
          onClick={() => { navigate('devices'); onClose(); }}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 8, border: 'none',
            backgroundColor: '#1E8F7A', color: '#FFFFFF', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <IconHardDrive size={16} style={{ stroke: '#fff' }} />
          Select a Device to Begin
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 10, padding: '11px 16px', borderRadius: 8,
            border: '1px solid #DDE3EA', backgroundColor: 'transparent', color: '#647184',
            fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ navigate, userName, activeCaseName, userRole }: DashboardProps) {
  const [showModal, setShowModal] = useState(false);

  const firstName = userName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Devices Connected', value: '3', icon: IconHardDrive, color: '#1E8F7A' },
    { label: 'Active Operations', value: '1', icon: IconActivity, color: '#4C5FC7' },
    { label: 'Cases Open', value: '4', icon: IconSearch, color: '#B8862E' },
    { label: 'Pending Verifications', value: '2', icon: IconShieldCheck, color: '#C6394A' },
  ];

  const auditorStats = [
    { label: 'Certificates Issued (Week)', value: '18', icon: IconDocument, color: '#1E8F7A' },
    { label: 'Pending Reviews', value: '2', icon: IconAlertTriangle, color: '#B8862E' },
    { label: 'Cases Open', value: '4', icon: IconSearch, color: '#4C5FC7' },
  ];

  if (userRole === 'Auditor') {
    return (
      <div style={{ display: 'flex', gap: 24, height: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>
                {greeting}, {firstName}.
              </div>
              <div style={{ fontSize: 14, color: '#647184', marginTop: 4 }}>
                Role: <span style={{ color: '#1A2330', fontWeight: 500 }}>Independent Auditor</span>
              </div>
            </div>
          </div>

          {/* Chain Integrity strip */}
          <div style={{ marginBottom: 28, backgroundColor: '#EDFAF3', border: '1px solid #C4ECD4', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#2E9E5B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconShieldCheck size={18} style={{ color: '#fff', stroke: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#17502E' }}>Chain Integrity: Verified</div>
              <div style={{ fontSize: 13, color: '#2E9E5B' }}>0 tamper events detected across all active cases.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {auditorStats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#647184' }}>{label}</span>
                  <div style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} style={{ color, stroke: color }} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1A2330', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Pending Reviews */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>Pending Review</div>
              <button onClick={() => navigate('verification')} style={{ fontSize: 13, color: '#1E8F7A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Go to Verification →
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F5F7FA' }}>
                  {['Type', 'Device', 'Case', 'Investigator', 'Time'].map((h) => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#647184', letterSpacing: '0.02em' }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingReviews.map((op) => (
                  <tr key={op.id} style={{ borderTop: '1px solid #F0F3F6' }}>
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: op.type === 'recovery' ? '#E8F5F2' : '#FEF2F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {op.type === 'recovery' ? <IconSearch size={13} style={{ color: '#1E8F7A', stroke: '#1E8F7A' }} /> : <IconShieldLock size={13} style={{ color: '#C6394A', stroke: '#C6394A' }} />}
                        </div>
                        <span style={{ fontSize: 13, color: '#1A2330', textTransform: 'capitalize' }}>{op.type}</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 20px', fontSize: 13, color: '#1A2330' }}>{op.device}</td>
                    <td style={{ padding: '13px 20px' }}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#647184' }}>#{op.caseId}</span></td>
                    <td style={{ padding: '13px 20px', fontSize: 13, color: '#1A2330' }}>{op.investigator}</td>
                    <td style={{ padding: '13px 20px' }}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#647184' }}>{op.time}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Audit Feed */}
        <div style={{ width: 280, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)', display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 100px)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #DDE3EA' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>Live Audit Feed</div>
            <div style={{ fontSize: 12, color: '#647184', marginTop: 2 }}>System events, real-time</div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {auditFeed.map((entry, i) => (
              <div key={i} style={{ padding: '12px 18px', borderBottom: i < auditFeed.length - 1 ? '1px solid #F0F3F6' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, backgroundColor: auditTypeColors[entry.type as keyof typeof auditTypeColors] }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#1A2330', lineHeight: 1.4 }}>{entry.event}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#647184' }}>{entry.time}</span>
                      <span style={{ fontSize: 11, color: '#B0BAC9' }}>·</span>
                      <span style={{ fontSize: 11, color: '#647184' }}>{entry.user}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Investigator Dashboard
  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>
              {greeting}, {firstName}.
            </div>
            <div style={{ fontSize: 14, color: '#647184', marginTop: 4 }}>
              Active case:{' '}
              <span style={{ color: '#1A2330', fontWeight: 500 }}>{activeCaseName}</span>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A', color: '#FFFFFF',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#178269')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E8F7A')}
          >
            <IconPlus size={16} style={{ stroke: '#fff' }} />
            New Operation
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 10, padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#647184' }}>{label}</span>
                <div
                  style={{
                    width: 30, height: 30, borderRadius: 7,
                    backgroundColor: `${color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={15} style={{ color, stroke: color }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1A2330', lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Operations */}
        <div
          style={{
            backgroundColor: '#FFFFFF', borderRadius: 10,
            boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>Recent Operations</div>
            <button
              onClick={() => navigate('audit')}
              style={{ fontSize: 13, color: '#1E8F7A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              View all in Audit →
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#F5F7FA' }}>
                {['Type', 'Device', 'Case', 'Status', 'Time'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 20px', textAlign: 'left', fontSize: 12,
                      fontWeight: 500, color: '#647184', letterSpacing: '0.02em',
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op, i) => {
                const cfg = statusConfig[op.status as keyof typeof statusConfig];
                const StatusIcon = cfg.Icon;
                return (
                  <tr
                    key={op.id}
                    style={{
                      borderTop: '1px solid #F0F3F6',
                      backgroundColor: 'transparent',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 28, height: 28, borderRadius: 6,
                            backgroundColor: op.type === 'recovery' ? '#E8F5F2' : '#FEF2F3',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {op.type === 'recovery'
                            ? <IconSearch size={13} style={{ color: '#1E8F7A', stroke: '#1E8F7A' }} />
                            : <IconShieldLock size={13} style={{ color: '#C6394A', stroke: '#C6394A' }} />
                          }
                        </div>
                        <span style={{ fontSize: 13, color: '#1A2330', textTransform: 'capitalize' }}>
                          {op.type}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 20px', fontSize: 13, color: '#1A2330' }}>{op.device}</td>
                    <td style={{ padding: '13px 20px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#647184' }}>
                        #{op.caseId}
                      </span>
                    </td>
                    <td style={{ padding: '13px 20px' }}>
                      <div
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', borderRadius: 20,
                          backgroundColor: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 500,
                        }}
                      >
                        <StatusIcon size={11} style={{ stroke: cfg.color }} />
                        {cfg.label}
                      </div>
                    </td>
                    <td style={{ padding: '13px 20px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#647184' }}>
                        {op.time}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Feed */}
      <div
        style={{
          width: 280, flexShrink: 0,
          backgroundColor: '#FFFFFF', borderRadius: 10,
          boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
          display: 'flex', flexDirection: 'column', alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 100px)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #DDE3EA' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>Live Audit Feed</div>
          <div style={{ fontSize: 12, color: '#647184', marginTop: 2 }}>System events, real-time</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {auditFeed.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '12px 18px',
                borderBottom: i < auditFeed.length - 1 ? '1px solid #F0F3F6' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    backgroundColor: auditTypeColors[entry.type as keyof typeof auditTypeColors],
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, color: '#1A2330', lineHeight: 1.4 }}>{entry.event}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#647184' }}>
                      {entry.time}
                    </span>
                    <span style={{ fontSize: 11, color: '#B0BAC9' }}>·</span>
                    <span style={{ fontSize: 11, color: '#647184' }}>{entry.user}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && <NewOpModal onClose={() => setShowModal(false)} navigate={navigate} />}
    </div>
  );
}
