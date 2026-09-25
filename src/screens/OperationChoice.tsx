import { useState } from 'react';
import { Device, OperationScope, Screen } from '../types';
import { IconSearch, IconShieldLock, IconX } from '../components/Icons';

interface OperationChoiceProps {
  device: Device;
  navigate: (screen: Screen) => void;
  onChoose: (type: 'recovery' | 'erase', scope: OperationScope) => void;
  onClose: () => void;
}

export default function OperationChoice({ device, navigate, onChoose, onClose }: OperationChoiceProps) {
  const [recoveryScope, setRecoveryScope] = useState<OperationScope>('whole-drive');
  const [eraseScope, setEraseScope] = useState<OperationScope>('whole-drive');

  const handleChoose = (type: 'recovery' | 'erase') => {
    const scope = type === 'recovery' ? recoveryScope : eraseScope;
    onChoose(type, scope);
    if (scope === 'specific-files') {
      navigate('file-scope');
    } else {
      navigate(type === 'recovery' ? 'recovery' : 'erase');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(16,21,27,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 14, width: '100%', maxWidth: 680,
          boxShadow: '0 8px 40px rgba(16,21,27,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 28px', borderBottom: '1px solid #DDE3EA',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A2330' }}>
              Choose Operation Type
            </div>
            <div style={{ fontSize: 13, color: '#647184', marginTop: 4 }}>
              Device: <span style={{ color: '#1A2330', fontWeight: 500 }}>{device.name}</span>
              <span style={{ margin: '0 6px', color: '#DDE3EA' }}>·</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                {device.capacity} / {device.interface}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid #DDE3EA',
              backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#647184',
            }}
          >
            <IconX size={15} />
          </button>
        </div>

        {/* Cards */}
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Recovery */}
          <div
            style={{
              borderRadius: 10, border: '1.5px solid #D0EBE6',
              backgroundColor: '#F8FDFC', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 24px 18px' }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10, backgroundColor: '#E8F5F2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}
              >
                <IconSearch size={22} style={{ stroke: '#1E8F7A' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2330', marginBottom: 6 }}>
                Recover Data
              </div>
              <div style={{ fontSize: 13, color: '#647184', lineHeight: 1.6 }}>
                Find and restore deleted or lost files from this device. Non-destructive — original data is not modified.
              </div>
            </div>

            {/* Scope toggle */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #D0EBE6', backgroundColor: '#F0FAF7' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 8 }}>
                SCOPE
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['whole-drive', 'specific-files'] as OperationScope[]).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setRecoveryScope(scope)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12,
                      border: `1.5px solid ${recoveryScope === scope ? '#1E8F7A' : '#C5DFD9'}`,
                      backgroundColor: recoveryScope === scope ? '#1E8F7A' : 'transparent',
                      color: recoveryScope === scope ? '#FFFFFF' : '#647184',
                      fontWeight: recoveryScope === scope ? 500 : 400,
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {scope === 'whole-drive' ? 'Whole Drive' : 'Specific Files'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #D0EBE6' }}>
              <button
                onClick={() => handleChoose('recovery')}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  backgroundColor: '#1E8F7A', color: '#FFFFFF', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#178269')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E8F7A')}
              >
                Start Recovery
              </button>
            </div>
          </div>

          {/* Erase */}
          <div
            style={{
              borderRadius: 10, border: '1.5px solid #F9D0D4',
              backgroundColor: '#FFFBFB', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 24px 18px' }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10, backgroundColor: '#FEF2F3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}
              >
                <IconShieldLock size={22} style={{ stroke: '#C6394A' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2330', marginBottom: 6 }}>
                Erase Data
              </div>
              <div style={{ fontSize: 13, color: '#647184', lineHeight: 1.6 }}>
                Permanently and verifiably destroy data on this device. This action cannot be undone.
              </div>
            </div>

            {/* Scope toggle */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #F9D0D4', backgroundColor: '#FFF8F8' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 8 }}>
                SCOPE
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['whole-drive', 'specific-files'] as OperationScope[]).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setEraseScope(scope)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12,
                      border: `1.5px solid ${eraseScope === scope ? '#C6394A' : '#F5C0C5'}`,
                      backgroundColor: eraseScope === scope ? '#C6394A' : 'transparent',
                      color: eraseScope === scope ? '#FFFFFF' : '#647184',
                      fontWeight: eraseScope === scope ? 500 : 400,
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {scope === 'whole-drive' ? 'Whole Drive' : 'Specific Files'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F9D0D4' }}>
              <button
                onClick={() => handleChoose('erase')}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  backgroundColor: '#C6394A', color: '#FFFFFF', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#A82F3F')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C6394A')}
              >
                Configure Erase
              </button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div
          style={{
            padding: '14px 28px', borderTop: '1px solid #DDE3EA',
            backgroundColor: '#F5F7FA', fontSize: 12, color: '#647184',
          }}
        >
          All operations are logged to the immutable audit chain and associated with the active case.
        </div>
      </div>
    </div>
  );
}
