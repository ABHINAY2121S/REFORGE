import { useState } from 'react';
import { Screen } from '../types';
import { IconShieldCheck, IconAlertTriangle, IconActivity } from '../components/Icons';

interface VerificationProps {
  navigate: (screen: Screen) => void;
}

const operations = [
  { id: 'OP-2024-1182', device: 'Seagate Barracuda 2TB', type: 'erase', status: 'pass', entropy_before: 2.14, entropy_after: 7.998, signatures_before: 12840, signatures_after: 0, method: 'DoD 5220.22-M', timestamp: '2024-11-08 09:14:22' },
  { id: 'OP-2024-1181', device: 'WD Black NVMe 1TB', type: 'erase', status: 'pass', entropy_before: 3.07, entropy_after: 7.991, signatures_before: 8320, signatures_after: 0, method: 'NVMe Sanitize', timestamp: '2024-09-11 11:05:17' },
  { id: 'OP-2024-1177', device: 'SanDisk Ultra USB 3.2', type: 'erase', status: 'partial', entropy_before: 1.88, entropy_after: 7.201, signatures_before: 3210, signatures_after: 14, method: 'Multi-pass Overwrite', timestamp: '2024-09-10 16:30:00' },
];

const entropyColor = (val: number) => {
  if (val >= 7.9) return '#2E9E5B';
  if (val >= 6.0) return '#B8862E';
  return '#C6394A';
};

function EntropyBar({ value }: { value: number }) {
  const pct = (value / 8.0) * 100;
  const color = entropyColor(value);
  return (
    <div>
      <div style={{ height: 10, borderRadius: 5, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, backgroundColor: color }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color, fontWeight: 500 }}>
          {value.toFixed(3)} bits/byte
        </span>
        <span style={{ fontSize: 11, color: '#B0BAC9' }}>max 8.000</span>
      </div>
    </div>
  );
}

export default function Verification({ navigate }: VerificationProps) {
  const [selectedOp, setSelectedOp] = useState(operations[0]);

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em', marginBottom: 4 }}>
        Verification
      </div>
      <div style={{ fontSize: 14, color: '#647184', marginBottom: 28 }}>
        Before/after entropy and signature comparison for completed erase operations.
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Operation list */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 10 }}>
            COMPLETED OPERATIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {operations.map((op) => (
              <button
                key={op.id}
                onClick={() => setSelectedOp(op)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 10,
                  cursor: 'pointer',
                  backgroundColor: selectedOp.id === op.id ? '#FFFFFF' : 'transparent',
                  border: `1.5px solid ${selectedOp.id === op.id ? '#1E8F7A' : '#DDE3EA'}`,
                  boxShadow: selectedOp.id === op.id ? '0 1px 3px rgba(16,21,27,0.07)' : 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#647184' }}>
                    {op.id}
                  </span>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                      padding: '2px 7px', borderRadius: 10,
                      backgroundColor: op.status === 'pass' ? '#EDFAF3' : '#FEF8EC',
                      color: op.status === 'pass' ? '#2E9E5B' : '#B8862E',
                    }}
                  >
                    {op.status === 'pass'
                      ? <IconShieldCheck size={10} style={{ stroke: 'currentColor' }} />
                      : <IconAlertTriangle size={10} style={{ stroke: 'currentColor' }} />
                    }
                    {op.status === 'pass' ? 'Pass' : 'Partial'}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330', marginBottom: 2 }}>{op.device}</div>
                <div style={{ fontSize: 11, color: '#647184', fontFamily: 'JetBrains Mono, monospace' }}>{op.timestamp}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Comparison panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status banner */}
          <div
            style={{
              padding: '16px 20px', borderRadius: 10, marginBottom: 20,
              backgroundColor: selectedOp.status === 'pass' ? '#EDFAF3' : '#FEF8EC',
              border: `1.5px solid ${selectedOp.status === 'pass' ? '#A8E6C3' : '#F0D890'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            {selectedOp.status === 'pass'
              ? <IconShieldCheck size={22} style={{ stroke: '#2E9E5B', flexShrink: 0 }} />
              : <IconAlertTriangle size={22} style={{ stroke: '#B8862E', flexShrink: 0 }} />
            }
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2330', marginBottom: 2 }}>
                {selectedOp.status === 'pass'
                  ? '0 recoverable signatures found — erasure independently verified'
                  : 'Best-Effort — Residual Risk'}
              </div>
              <div style={{ fontSize: 13, color: '#647184' }}>
                {selectedOp.status === 'pass'
                  ? `Method: ${selectedOp.method} · Verified ${selectedOp.timestamp}`
                  : `${selectedOp.signatures_after} remnant signatures detected. The device interface (USB) does not support full sanitize commands. Additional overwrite passes are recommended.`
                }
              </div>
            </div>
          </div>

          {/* Before / After comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 10, padding: '20px 22px',
                boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C6394A' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>Before Erase</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 10 }}>ENTROPY</div>
                <EntropyBar value={selectedOp.entropy_before} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 8 }}>FILE SIGNATURES DETECTED</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#C6394A', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedOp.signatures_before.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#647184' }}>recoverable file patterns</div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 10, padding: '20px 22px',
                boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2E9E5B' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>After Erase</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 10 }}>ENTROPY</div>
                <EntropyBar value={selectedOp.entropy_after} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 8 }}>FILE SIGNATURES DETECTED</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: selectedOp.signatures_after === 0 ? '#2E9E5B' : '#B8862E', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedOp.signatures_after.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#647184' }}>recoverable file patterns</div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16, padding: '14px 16px', borderRadius: 10,
              backgroundColor: '#FFFFFF', border: '1px solid #DDE3EA',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <IconActivity size={16} style={{ stroke: '#647184', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#647184' }}>
              <strong style={{ color: '#1A2330' }}>Method used:</strong> {selectedOp.method} ·{' '}
              <strong style={{ color: '#1A2330' }}>Operation ID:</strong>{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{selectedOp.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
