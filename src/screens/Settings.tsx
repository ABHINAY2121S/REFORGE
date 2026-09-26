import { useState } from 'react';
import { Screen, UserRole } from '../types';
import { IconShieldCheck, IconInfo, IconCheck } from '../components/Icons';

interface SettingsProps {
  navigate: (screen: Screen) => void;
  userRole: UserRole;
}

type Tab = 'compliance' | 'about';

interface ToggleProps {
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ value, onChange, disabled }: ToggleProps) {
  return (
    <button
      onClick={() => {
        if (!disabled && onChange) onChange(!value);
      }}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        backgroundColor: value ? '#1E8F7A' : '#DDE3EA',
        position: 'relative', transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: '50%', backgroundColor: '#FFFFFF',
          position: 'absolute', top: 3, left: value ? 21 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

const complianceStandards = [
  { id: 'nist-800-88', label: 'NIST 800-88 Rev.2', description: 'Guidelines for Media Sanitization', enabled: true },
  { id: 'ieee-2883', label: 'IEEE 2883-2022', description: 'Standard for Sanitizing Storage', enabled: true },
  { id: 'dpdp-act', label: 'DPDP Act (India)', description: 'Digital Personal Data Protection Act 2023', enabled: true },
  { id: 'dod-5220', label: 'DoD 5220.22-M', description: 'National Industrial Security Program', enabled: false },
  { id: 'gdpr', label: 'GDPR Article 17', description: 'Right to Erasure obligations', enabled: false },
  { id: 'it-act-65b', label: 'IT Act §65B(4)', description: 'Indian IT Act evidence admissibility', enabled: true },
];

export default function Settings({ navigate, userRole }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('compliance');
  const [standards, setStandards] = useState(
    Object.fromEntries(complianceStandards.map((s) => [s.id, s.enabled]))
  );

  const tabs: { key: Tab; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'compliance', label: 'Compliance Standards', Icon: IconShieldCheck },
    { key: 'about', label: 'About', Icon: IconInfo },
  ];

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em', marginBottom: 28 }}>
        Settings
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Tab list */}
        <div
          style={{
            width: 220, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 10,
            border: '1px solid #DDE3EA', overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(16,21,27,0.05)',
          }}
        >
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderBottom: '1px solid #F0F3F6',
                background: activeTab === key ? '#EEF1F5' : 'transparent',
                border: 'none', cursor: 'pointer',
                borderLeft: `3px solid ${activeTab === key ? '#1E8F7A' : 'transparent'}`,
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background-color 0.1s ease',
              }}
            >
              <Icon size={16} style={{ stroke: activeTab === key ? '#1E8F7A' : '#647184' }} />
              <span style={{ fontSize: 13, fontWeight: activeTab === key ? 500 : 400, color: activeTab === key ? '#1A2330' : '#647184' }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'compliance' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2330', marginBottom: 6 }}>
                Compliance Standards
              </div>
              <div style={{ fontSize: 13, color: '#647184', marginBottom: 18 }}>
                Enabled standards are referenced in generated reports and certificates.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {complianceStandards.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      backgroundColor: '#FFFFFF', borderRadius: 10, border: '1px solid #DDE3EA',
                    }}
                  >
                    <Toggle
                      value={standards[s.id] ?? false}
                      onChange={(v) => setStandards({ ...standards, [s.id]: v })}
                      disabled={userRole === 'Auditor'}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: '#647184' }}>{s.description}</div>
                    </div>
                    {standards[s.id] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2E9E5B' }}>
                        <IconCheck size={11} style={{ stroke: '#2E9E5B' }} />
                        Referenced in reports
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 10, padding: '28px',
                border: '1px solid #DDE3EA',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>REFORGE</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 24 }}>
                Next-Gen Forensic Recovery & Sanitization Platform
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 0', fontSize: 13 }}>
                {[
                  ['Version', '2.4.1'],
                  ['Build', '20241108-a3f4c'],
                  ['License', 'Enterprise — Agency License'],
                  ['NIST 800-88', 'Rev.2 Compliant'],
                  ['IEEE 2883', '2022 Compliant'],
                  ['Last updated', '2024-11-08'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'contents' }}>
                    <span style={{ color: '#647184' }}>{label}</span>
                    <span style={{ color: '#1A2330', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
