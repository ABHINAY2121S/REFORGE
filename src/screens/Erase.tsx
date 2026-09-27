import { useState, useEffect, useRef } from 'react';
import { Device, Screen } from '../types';
import { recordEraseCompleted } from '../operationsStore';
import {
  IconShieldLock, IconShieldCheck, IconCheck, IconAlertTriangle,
  IconInfo, IconChevronDown, IconChevronUp, IconArrowRight, IconActivity, IconCertificate, IconRefresh, IconHardDrive, IconX
} from '../components/Icons';

interface EraseProps {
  device?: Device;
  navigate: (screen: Screen) => void;
}

// Step definition
type Step = 'configure' | 'confirm' | 'erasing' | 'verified' | 'failed';

const erasePhases = [
  { label: 'Erasing', progress: [0, 70] },
  { label: 'Verifying', progress: [70, 90] },
  { label: 'Running adversarial recovery check', progress: [90, 100] },
];

interface AttemptRecord {
  attemptNum: number;
  method: string;
  result: 'failed' | 'success';
}

// USP 5: Attempt history bar
function AttemptHistory({ attempts }: { attempts: AttemptRecord[] }) {
  if (attempts.length === 0) return null;
  return (
    <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, backgroundColor: '#F8FAFB', border: '1px solid #EEF1F5' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attempt History</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {attempts.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
              backgroundColor: a.result === 'failed' ? '#FEF2F3' : '#EDFAF3',
              border: `1px solid ${a.result === 'failed' ? '#F9D0D4' : '#A8E6C3'}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#647184' }}>Attempt {a.attemptNum}</span>
              <span style={{ fontSize: 11, color: '#1A2330' }}>{a.method}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: a.result === 'failed' ? '#C6394A' : '#2E9E5B' }}>
                — {a.result === 'failed' ? 'Failed' : 'Success'}
              </span>
            </div>
            {i < attempts.length - 1 && <IconArrowRight size={11} style={{ stroke: '#B0BAC9' }} />}
          </div>
        ))}
        {attempts[attempts.length - 1].result === 'failed' && (
          <>
            <IconArrowRight size={11} style={{ stroke: '#B0BAC9' }} />
            <div style={{ padding: '5px 10px', borderRadius: 6, backgroundColor: '#EEF0FB', border: '1px solid #C8CFF5', fontSize: 11, color: '#4C5FC7' }}>
              In Progress…
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'configure', label: 'Configure' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'erasing', label: 'Erasing' },
    { key: 'verified', label: 'Verified' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  const effectiveIdx = current === 'failed' ? steps.findIndex(s => s.key === 'verified') : currentIdx;

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
      {steps.map((step, i) => {
        const done = i < effectiveIdx;
        const active = i === effectiveIdx;
        const isFailed = current === 'failed' && step.key === 'verified';
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: isFailed ? '#C6394A' : done ? '#C6394A' : active ? '#C6394A' : '#F5F7FA',
                  border: `2px solid ${isFailed || done || active ? '#C6394A' : '#DDE3EA'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {isFailed
                  ? <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>✕</span>
                  : done
                    ? <IconCheck size={13} style={{ stroke: '#fff' }} />
                    : <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#647184' }}>{i + 1}</span>
                }
              </div>
              <span style={{ fontSize: 14, fontWeight: active || isFailed ? 600 : 400, color: active || isFailed ? '#1A2330' : done ? '#C6394A' : '#647184' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 32, height: 2, backgroundColor: done ? '#C6394A' : '#DDE3EA', margin: '0 12px', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ value, onChange, label, description }: ToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
          backgroundColor: value ? '#1E8F7A' : '#DDE3EA',
          position: 'relative', transition: 'background-color 0.2s ease', marginTop: 1,
        }}
      >
        <div
          style={{
            width: 18, height: 18, borderRadius: '50%', backgroundColor: '#FFFFFF',
            position: 'absolute', top: 3, left: value ? 23 : 3,
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: '#647184', marginTop: 2 }}>{description}</div>}
      </div>
    </div>
  );
}

// NIST SP 800-88 Rev. 2 primary methods (IEEE 2883-2022)
export interface EraseMethod {
  id: string;
  label: string;
  badge: string;
  description: string;
  nistLevel: 'NIST Clear' | 'NIST Purge' | 'NIST Destroy' | 'Legacy';
}

const nistMethods: EraseMethod[] = [
  {
    id: 'nist-clear',
    label: 'NIST Clear: Overwrite',
    badge: 'NIST Clear',
    description: 'Single-pass overwrite of all user-accessible storage. Suitable for HDDs and USB/SD flash media. NIST SP 800-88 Rev. 2 Clear, per IEEE 2883.',
    nistLevel: 'NIST Clear',
  },
  {
    id: 'nist-purge-block',
    label: 'NIST Purge: Sanitize Block Erase',
    badge: 'NIST Purge',
    description: "Uses the drive's built-in Sanitize command to erase every block, including hidden spare areas. For SATA and NVMe SSDs that support it. NIST SP 800-88 Rev. 2 Purge.",
    nistLevel: 'NIST Purge',
  },
  {
    id: 'nist-purge-crypto',
    label: 'NIST Purge: Crypto Erase',
    badge: 'NIST Purge',
    description: "Destroys the drive's internal encryption key, making all stored data cryptographically inaccessible. Only valid for self-encrypting drives (SEDs) where encryption was always enabled. NIST SP 800-88 Rev. 2 Purge.",
    nistLevel: 'NIST Purge',
  },
  {
    id: 'nist-destroy',
    label: 'NIST Destroy: Physical Destruction',
    badge: 'NIST Destroy',
    description: 'Physical destruction by shredding, disintegration, or incineration. Required when software Purge is not possible and the data is highly sensitive. Reforge records the destruction and issues a certificate.',
    nistLevel: 'NIST Destroy',
  },
];

const legacyMethods: EraseMethod[] = [
  {
    id: 'dod-3pass',
    label: 'DoD 5220.22-M (3-pass overwrite)',
    badge: 'LEGACY',
    description: 'Three passes: zeros, then ones, then random data. Replaced by NIST SP 800-88 for modern media. Offers no extra security over a single pass on flash drives and adds wear. Kept for legacy policy requirements only.',
    nistLevel: 'Legacy',
  },
  {
    id: 'gutmann-35pass',
    label: 'Gutmann (35-pass overwrite)',
    badge: 'LEGACY',
    description: 'Designed in 1996 for old magnetic drive encoding schemes. Not meaningful for modern HDDs or flash media. Kept for legacy policy requirements only.',
    nistLevel: 'Legacy',
  },
];

const eraseMethods: EraseMethod[] = [...nistMethods, ...legacyMethods];

function PhysicalDestructionModal({
  device,
  onClose,
  onComplete,
}: {
  device?: Device;
  onClose: () => void;
  onComplete: (data: { technique: string; facility: string; witness: string; operator: string }) => void;
}) {
  const [technique, setTechnique] = useState('shredding');
  const [facility, setFacility] = useState('Forensic Evidence Disposal Vault, Chamber 3');
  const [witness, setWitness] = useState('Special Agent R. Vance (Badge #4891)');
  const [operator, setOperator] = useState('A. Patel (Senior Forensic Examiner)');
  const [certified, setCertified] = useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(16,21,27,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24,
    }}>
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 640,
        boxShadow: '0 8px 32px rgba(16,21,27,0.2)', overflow: 'hidden', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconShieldLock size={18} style={{ stroke: '#C6394A' }} />
              Log Physical Media Destruction
            </div>
            <div style={{ fontSize: 12, color: '#647184', marginTop: 2 }}>
              NIST SP 800-88 Rev. 2 §4.3 & IEEE 2883-2022 §6.4 Chain of Custody Protocol
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#647184', padding: 4 }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#F1F5F9', borderRadius: 8, padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#647184' }}>TARGET DEVICE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{device?.name || 'Selected Device'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#647184' }}>SERIAL NUMBER</div>
              <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{device?.serial || 'WF2096DW'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#647184' }}>CAPACITY / TYPE</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{device?.capacity || '32 GB'} · {device?.type || 'USB'}</div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 5 }}>
              Destruction Technique (NIST SP 800-88 / DIN 66399)
            </label>
            <select
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              <option value="shredding">Industrial Cross-cut Shredding (≤ 2mm particle size — Level E-4)</option>
              <option value="disintegration">Mechanical Disintegration & Granulation (Rotary blade disintegrator)</option>
              <option value="incineration">High-Temperature Incineration (Exceeding 1,000°C Curie point)</option>
              <option value="degaussing">Degaussing + Mechanical Deformation (Crush & Sheared platen)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 5 }}>
                Disposal Facility / Vault
              </label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 13, color: '#0F172A' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 5 }}>
                Date & Time (UTC)
              </label>
              <input
                type="text"
                readOnly
                value={new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, color: '#647184', backgroundColor: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 5 }}>
                Authorized Witness (Two-Person Rule)
              </label>
              <input
                type="text"
                value={witness}
                onChange={(e) => setWitness(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 13, color: '#0F172A' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 5 }}>
                Supervising Examiner
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 13, color: '#0F172A' }}
              />
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', backgroundColor: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>📸 Photographic Destruction Evidence</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: 4 }}>VERIFIED ATTACHMENT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🗂️
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>evidence_shred_residue_WF2096DW.jpg</div>
                <div style={{ fontSize: 11, color: '#647184', fontFamily: 'JetBrains Mono, monospace' }}>SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069</div>
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '10px 12px', borderRadius: 6, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <input
              type="checkbox"
              checked={certified}
              onChange={(e) => setCertified(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#DC2626' }}
            />
            <span style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5, fontWeight: 500 }}>
              I certify under formal evidentiary chain of custody that the storage media identified above was physically destroyed to unrecognizable particles (≤ 2mm) in accordance with NIST SP 800-88 Rev. 2.
            </span>
          </label>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #DDE3EA', display: 'flex', justifyContent: 'flex-end', gap: 10, backgroundColor: '#F8FAFC' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#647184', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={!certified}
            onClick={() => onComplete({ technique, facility, witness, operator })}
            style={{
              padding: '9px 20px', borderRadius: 6, border: 'none',
              backgroundColor: certified ? '#DC2626' : '#E2E8F0',
              color: certified ? '#FFFFFF' : '#94A3B8',
              fontSize: 13, fontWeight: 600, cursor: certified ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <IconCheck size={14} style={{ stroke: certified ? '#fff' : '#94A3B8' }} />
            Record Destruction & Issue Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Erase({ device, navigate }: EraseProps) {
  const [step, setStep] = useState<Step>('configure');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'full' | 'sample'>('full');
  const [showDestructionModal, setShowDestructionModal] = useState(false);

  const isUsbOrSd = device?.type === 'USB' || device?.type === 'SD';
  const isNvme = device?.interface === 'NVMe';
  const isSed = Boolean(device?.encrypted || isNvme);

  const getMethodSupport = (methodId: string): { supported: boolean; reason?: string } => {
    if (methodId === 'nist-purge-block') {
      if (isUsbOrSd) {
        return {
          supported: false,
          reason: 'Not supported by this device. USB drives do not provide a Sanitize command.',
        };
      }
    }
    if (methodId === 'nist-purge-crypto') {
      if (isUsbOrSd || !isSed) {
        return {
          supported: false,
          reason: isUsbOrSd
            ? 'Not supported by this device. This drive is not self-encrypting.'
            : 'Not supported by this device. SED hardware encryption not detected.',
        };
      }
    }
    return { supported: true };
  };

  const estimatedEraseTime = isNvme
    ? '< 30 sec (Crypto Key Destruction)'
    : isUsbOrSd
      ? '~8–12 min (Single-pass @ 45 MB/s)'
      : '~1.5 hr (Full surface write)';

  const getDefaultMethod = (dev?: Device) => {
    if (!dev) return 'nist-clear';
    if (dev.interface === 'NVMe') return 'nist-purge-crypto';
    return 'nist-clear';
  };

  const [selectedMethod, setSelectedMethod] = useState(() => getDefaultMethod(device));
  const [serialInput, setSerialInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState('Erasing');
  const [entropy, setEntropy] = useState(0);
  const intervalRef = useRef<number | undefined>(undefined);
  const [showFirmwareWhy, setShowFirmwareWhy] = useState(false);

  // USP 5: attempt history
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const attemptNumRef = useRef(1);

  // USP 5: simulate fail on first attempt when firmware is unreliable
  const [simulateFail] = useState(device?.firmwareStatus === 'unreliable');

  const deviceName = device?.name ?? 'Selected Device';
  const deviceSerial = device?.serial ?? 'WF2096DW';
  const last4 = deviceSerial.slice(-4);
  const serialMatch = serialInput === last4;
  const firmwareStatus = device?.firmwareStatus;
  const showFirmwareWarning = (firmwareStatus === 'unverified' || firmwareStatus === 'unreliable') && step === 'configure';

  const handleCompleteDestruction = (destroyData: { technique: string; facility: string; witness: string; operator: string }) => {
    const recAttempts = [{ attemptNum: 1, method: `Physical Destruction (${destroyData.technique})`, result: 'success' as const }];
    setAttempts(recAttempts);
    if (device) {
      recordEraseCompleted({
        caseId: '2024-CF-0892',
        caseName: 'State v. Meridian Corp',
        device,
        selectedMethod: 'nist-destroy',
        methodLabel: 'NIST Destroy: Physical Destruction',
        status: 'verified',
        entropy: 0.00,
        attempts: recAttempts,
      });
    }
    setShowDestructionModal(false);
    setStep('verified');
  };

  useEffect(() => {
    if (step !== 'erasing') return;
    setProgress(0);
    setEntropy(selectedMethod === 'nist-clear' ? 7.8 : 0);
    setPhaseLabel('Erasing…');
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          const currentMethod = eraseMethods.find(m => m.id === selectedMethod)?.label ?? selectedMethod;
          const finalEntropy = selectedMethod === 'nist-clear' ? 0.002 : 7.998;
          setTimeout(() => {
            // USP 5: first attempt with unreliable device fails
            if (simulateFail && attemptNumRef.current === 1) {
              const recAttempts = [{ attemptNum: attemptNumRef.current, method: currentMethod, result: 'failed' as const }];
              setAttempts(recAttempts);
              if (device) {
                recordEraseCompleted({
                  caseId: '2024-CF-0892',
                  caseName: 'State v. Meridian Corp',
                  device,
                  selectedMethod,
                  methodLabel: currentMethod,
                  status: 'failed',
                  entropy: 4.21,
                  attempts: recAttempts,
                });
              }
              setStep('failed');
            } else {
              const recAttempts = [{ attemptNum: attemptNumRef.current, method: currentMethod, result: 'success' as const }];
              setAttempts(recAttempts);
              if (device) {
                recordEraseCompleted({
                  caseId: '2024-CF-0892',
                  caseName: 'State v. Meridian Corp',
                  device,
                  selectedMethod,
                  methodLabel: currentMethod,
                  status: 'verified',
                  entropy: finalEntropy,
                  attempts: recAttempts,
                });
              }
              setStep('verified');
            }
          }, 400);
          return 100;
        }
        const next = Math.min(p + 0.5, 100);
        const phase = erasePhases.find(ph => next >= ph.progress[0] && next < ph.progress[1]);
        if (phase) setPhaseLabel(phase.label + '…');
        if (selectedMethod === 'nist-clear') {
          setEntropy(Math.max(0.00, 7.8 - (next / 100 * 7.8)));
        } else {
          setEntropy(Math.min(8.0, next / 100 * 8.0));
        }
        return next;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [step, selectedMethod]);

  const handleRetry = (newMethod: string) => {
    attemptNumRef.current += 1;
    setSelectedMethod(newMethod);
    setSerialInput('');
    setStep('configure');
  };

  // Method label lookup
  const methodLabel = (id: string) => eraseMethods.find(m => m.id === id)?.label ?? id;

  // ── No Device Selected View ───────────────────────────────────────────────
  if (!device) {
    return (
      <div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Drive Sanitization
          </div>
          <div style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginTop: 4 }}>
            NIST 800-88 Rev. 2 & DoD 5220.22-M media purge and crypto-erase.
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: '#CBD5E1', margin: '20px 0 28px' }} />

        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, border: '1.5px solid #CBD5E1',
          padding: '40px 32px', maxWidth: 640,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', backgroundColor: '#F1F5F9',
            border: '1.5px solid #CBD5E1', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 18px',
          }}>
            <IconHardDrive size={28} style={{ stroke: '#0F172A' }} />
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            No Target Storage Device Selected
          </div>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 24px', fontWeight: 500 }}>
            Sanitization and media wiping require selecting an active secondary or external target drive. Please select a device from the Devices tab to proceed.
          </p>

          <button
            onClick={() => navigate('devices')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px',
              borderRadius: 8, border: 'none', backgroundColor: '#0D9488', color: '#FFFFFF',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: '0 2px 6px rgba(13,148,136,0.3)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0F766E')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0D9488')}
          >
            Go to Devices
            <IconArrowRight size={15} style={{ stroke: '#fff' }} />
          </button>
        </div>
      </div>
    );
  }



  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
          Erase
        </div>
        <div style={{ fontSize: 13, color: '#334155', fontWeight: 500, marginTop: 3 }}>
          <strong style={{ color: '#0F172A' }}>{deviceName}</strong>
          <span style={{ margin: '0 8px', color: '#CBD5E1' }}>·</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#334155' }}>{deviceSerial}</span>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: '#CBD5E1', margin: '18px 0 24px' }} />

      {/* USP 5: Attempt history bar above stepper */}
      {attempts.length > 0 && <AttemptHistory attempts={attempts} />}

      <StepIndicator current={step} />

      {/* CONFIGURE */}
      {step === 'configure' && (
        <div style={{ maxWidth: 600 }}>
          {device.isSystemDrive && (
            <div style={{
              backgroundColor: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 10,
              padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <IconAlertTriangle size={20} style={{ stroke: '#DC2626', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 2 }}>
                  Safety Lock Active — Host Boot OS Drive
                </div>
                <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
                  Target: <strong>{deviceName}</strong> ({device.capacity} · {device.interface}). Software erasure of the active host operating system drive is locked in this session to protect the forensic workstation. To sanitize host drives, boot REFORGE via external live USB media.
                </div>
              </div>
            </div>
          )}

          {/* Device facts panel */}
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 10, padding: '14px 18px',
            border: '1px solid #DDE3EA', marginBottom: 14,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#647184', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>CAPACITY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>{device?.capacity || '32 GB'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#647184', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>INTERFACE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>{device?.interface || 'USB 3.0'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#647184', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>MEDIA TYPE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2330' }}>{isUsbOrSd ? 'USB Flash (NAND)' : isNvme ? 'NVMe SSD' : `${device?.type || 'Drive'}`}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#647184', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>EST. TIME</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E8F7A' }}>{estimatedEraseTime}</div>
            </div>
          </div>

          {/* USP 3b: Firmware warning callout — shows when firmware is amber/red */}
          {showFirmwareWarning && (
            <div style={{
              backgroundColor: firmwareStatus === 'unreliable' ? '#FEF2F3' : '#FEF8EC',
              border: `1px solid ${firmwareStatus === 'unreliable' ? '#F9D0D4' : '#F0D890'}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 16,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <IconAlertTriangle size={17} style={{ stroke: firmwareStatus === 'unreliable' ? '#C6394A' : '#B8862E', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: firmwareStatus === 'unreliable' ? '#C6394A' : '#B8862E', marginBottom: 4 }}>
                  {firmwareStatus === 'unreliable' ? 'Known Unreliable Firmware' : 'Unverified Firmware'}
                </div>
                <div style={{ fontSize: 13, color: '#1A2330', lineHeight: 1.6 }}>
                  This device's firmware has not been verified as fully reliable for hardware Sanitize.
                  Recommending <strong>Overwrite + Adversarial Verification</strong> as a stronger fallback.
                  {' '}
                  <button
                    onClick={() => setShowFirmwareWhy(!showFirmwareWhy)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#4C5FC7', fontSize: 13, textDecoration: 'underline', fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    Why?
                  </button>
                </div>
                {showFirmwareWhy && (
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.7)', fontSize: 12, color: '#647184', lineHeight: 1.6 }}>
                    Some device firmware reports a successful sanitize command even when portions of data remain intact. REFORGE's adversarial verification independently checks whether data is actually irrecoverable after the erase completes.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommended method card */}
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: '20px 22px',
              border: '1.5px solid #1E8F7A',
              boxShadow: '0 0 0 3px rgba(30,143,122,0.08)',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  backgroundColor: '#E8F5F2', color: '#1E8F7A',
                }}
              >
                RECOMMENDED
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2330', marginBottom: 6 }}>
              {isNvme ? 'NIST Purge: Crypto Erase' : 'NIST Clear: Overwrite'}
            </div>
            <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
              {isNvme
                ? 'Destroys the drive\'s internal encryption key, making all stored data cryptographically inaccessible. Meets NIST SP 800-88 Rev. 2 Purge.'
                : 'Single-pass overwrite of all user-accessible storage on this device. Meets NIST SP 800-88 Rev. 2 Clear.'}
            </div>
            {isUsbOrSd && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E7EB', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                <strong style={{ color: '#374151' }}>Assurance level: Clear.</strong> This protects against standard recovery tools. USB drives do not support Purge commands, so for highly sensitive data, physical destruction is required.
              </div>
            )}
          </div>

          {/* Dry run toggle */}
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: '18px 20px',
              border: '1px solid #DDE3EA', marginBottom: 14,
            }}
          >
            <Toggle
              value={dryRun}
              onChange={setDryRun}
              label="Dry Run — simulate only, no data destroyed"
              description="Runs the full erasure workflow without writing to the device. Use this to test the process before committing."
            />
            {dryRun && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, backgroundColor: '#FEF8EC', border: '1px solid #F0D890' }}>
                <div style={{ fontSize: 12, color: '#B8862E', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <IconAlertTriangle size={13} style={{ stroke: '#B8862E', flexShrink: 0, marginTop: 1 }} />
                  Dry Run is active. No data will be destroyed. The verification step will simulate results only.
                </div>
              </div>
            )}
          </div>

          {/* Verification setting */}
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: '14px 18px',
              border: '1px solid #DDE3EA', marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2330', marginBottom: 2 }}>
              Post-Erase Verification Setting
            </div>
            <div style={{ fontSize: 12, color: '#647184', marginBottom: 10 }}>
              Select read-back verification coverage per NIST SP 800-88 §4.8 & IEEE 2883-2022.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
                border: `1.5px solid ${verificationMode === 'full' ? '#1E8F7A' : '#DDE3EA'}`,
                backgroundColor: verificationMode === 'full' ? '#F8FDFC' : '#FFFFFF', cursor: 'pointer',
              }}>
                <input
                  type="radio"
                  name="verifMode"
                  checked={verificationMode === 'full'}
                  onChange={() => setVerificationMode('full')}
                  style={{ accentColor: '#1E8F7A' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2330' }}>Full Read-Back (100%)</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>Exhaustive LBA sector sweep</div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
                border: `1.5px solid ${verificationMode === 'sample' ? '#1E8F7A' : '#DDE3EA'}`,
                backgroundColor: verificationMode === 'sample' ? '#F8FDFC' : '#FFFFFF', cursor: 'pointer',
              }}>
                <input
                  type="radio"
                  name="verifMode"
                  checked={verificationMode === 'sample'}
                  onChange={() => setVerificationMode('sample')}
                  style={{ accentColor: '#1E8F7A' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2330' }}>Statistical Sample (10%)</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>Pseudo-random block sample</div>
                </div>
              </label>
            </div>
          </div>

          {/* Advanced section */}
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10,
              border: '1px solid #DDE3EA', marginBottom: 24, overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              style={{
                width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2330' }}>
                Advanced: override erase method
              </span>
              {advancedOpen ? <IconChevronUp size={16} style={{ stroke: '#647184' }} /> : <IconChevronDown size={16} style={{ stroke: '#647184' }} />}
            </button>

            {advancedOpen && (
              <div style={{ borderTop: '1px solid #DDE3EA', padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: '#647184', marginBottom: 14, lineHeight: 1.5 }}>
                  Override the recommended method. Methods this device does not support are disabled. Legacy methods are kept only for organisations whose policies still require them.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nistMethods.map((method) => {
                    const support = getMethodSupport(method.id);
                    const isSelected = selectedMethod === method.id;
                    const isDisabled = !support.supported;

                    return (
                      <label
                        key={method.id}
                        onClick={(e) => {
                          if (isDisabled) e.preventDefault();
                        }}
                        style={{
                          display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8,
                          border: `1.5px solid ${isSelected ? '#1E8F7A' : isDisabled ? '#E2E8F0' : '#DDE3EA'}`,
                          backgroundColor: isSelected ? '#F8FDFC' : isDisabled ? '#F8FAFC' : '#FFFFFF',
                          opacity: isDisabled ? 0.65 : 1,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="eraseMethod"
                          value={method.id}
                          disabled={isDisabled}
                          checked={isSelected}
                          onChange={() => {
                            if (!isDisabled) setSelectedMethod(method.id);
                          }}
                          style={{ flexShrink: 0, marginTop: 2, accentColor: '#1E8F7A', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isDisabled ? '#647184' : '#1A2330' }}>
                              {method.label}
                            </span>
                            <span
                              style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                                backgroundColor: isDisabled ? '#F1F5F9' : '#EDFAF3',
                                color: isDisabled ? '#647184' : '#2E9E5B',
                                border: `1px solid ${isDisabled ? '#CBD5E1' : '#A8E6C3'}`,
                              }}
                            >
                              {method.badge}
                            </span>
                            {isDisabled && (
                              <span
                                style={{
                                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                                  backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                                }}
                              >
                                NOT SUPPORTED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: isDisabled ? '#C6394A' : '#647184', marginTop: 3, lineHeight: 1.5, fontStyle: isDisabled ? 'italic' : 'normal' }}>
                            {isDisabled && support.reason ? support.reason : method.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Legacy methods section behind toggle */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #DDE3EA' }}>
                  <button
                    type="button"
                    onClick={() => setShowLegacy(!showLegacy)}
                    style={{
                      background: 'none', border: 'none', padding: '4px 0',
                      color: '#647184', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {showLegacy ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                    <span>{showLegacy ? 'Hide legacy methods' : 'Show legacy methods'}</span>
                  </button>

                  {showLegacy && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {legacyMethods.map((method) => {
                        const isSelected = selectedMethod === method.id;
                        return (
                          <label
                            key={method.id}
                            style={{
                              display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8,
                              border: `1.5px solid ${isSelected ? '#1E8F7A' : '#F0D890'}`,
                              backgroundColor: isSelected ? '#F8FDFC' : '#FFFDF5',
                              cursor: 'pointer', transition: 'all 0.1s ease',
                            }}
                          >
                            <input
                              type="radio"
                              name="eraseMethod"
                              value={method.id}
                              checked={isSelected}
                              onChange={() => setSelectedMethod(method.id)}
                              style={{ flexShrink: 0, marginTop: 2, accentColor: '#1E8F7A' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{method.label}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, backgroundColor: '#FEF8EC', color: '#B8862E', border: '1px solid #F0D890' }}>
                                  LEGACY
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#647184', marginTop: 3, lineHeight: 1.5 }}>
                                {method.description}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            disabled={device.isSystemDrive}
            onClick={() => {
              if (selectedMethod === 'nist-destroy') {
                setShowDestructionModal(true);
              } else {
                setStep('confirm');
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px',
              borderRadius: 8, border: 'none',
              backgroundColor: device.isSystemDrive ? '#CBD5E1' : selectedMethod === 'nist-destroy' ? '#1E293B' : '#C6394A',
              color: '#FFFFFF',
              fontWeight: 600, fontSize: 14,
              cursor: device.isSystemDrive ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: device.isSystemDrive ? 'none' : '0 2px 6px rgba(198,57,74,0.3)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {selectedMethod === 'nist-destroy' ? 'Log Physical Destruction →' : 'Proceed to Confirmation →'}
            <IconArrowRight size={14} style={{ stroke: '#fff' }} />
          </button>

          {showDestructionModal && (
            <PhysicalDestructionModal
              device={device}
              onClose={() => setShowDestructionModal(false)}
              onComplete={handleCompleteDestruction}
            />
          )}
        </div>
      )}

      {/* CONFIRM */}
      {step === 'confirm' && (
        <div style={{ maxWidth: 540 }}>
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: '28px 28px 24px',
              boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              marginBottom: 16,
            }}
          >
            {/* Warning banner */}
            <div
              style={{
                padding: '14px 16px', borderRadius: 8, backgroundColor: '#FEF2F3',
                border: '1px solid #F9D0D4', marginBottom: 24,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              <IconAlertTriangle size={18} style={{ stroke: '#C6394A', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#C6394A', marginBottom: 4 }}>
                  This action cannot be undone.
                </div>
                <div style={{ fontSize: 13, color: '#8B3040', lineHeight: 1.6 }}>
                  This will permanently destroy all data on{' '}
                  <strong>{deviceName}</strong>. Once confirmed, data recovery will not be possible.
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#647184', marginBottom: 12 }}>
                OPERATION SUMMARY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 0', fontSize: 13 }}>
                <span style={{ color: '#647184' }}>Device</span>
                <span style={{ color: '#1A2330', fontWeight: 500 }}>{deviceName}</span>
                <span style={{ color: '#647184' }}>Capacity</span>
                <span style={{ color: '#1A2330' }}>{device?.capacity ?? '—'}</span>
                <span style={{ color: '#647184' }}>Erase method</span>
                <span style={{ color: '#1A2330' }}>{methodLabel(selectedMethod)}</span>
                <span style={{ color: '#647184' }}>Mode</span>
                <span style={{ color: dryRun ? '#B8862E' : '#1A2330' }}>
                  {dryRun ? 'Dry Run (no data destroyed)' : 'Live — data will be destroyed'}
                </span>
                {attempts.length > 0 && (
                  <>
                    <span style={{ color: '#647184' }}>Attempt</span>
                    <span style={{ color: '#1A2330' }}>#{attemptNumRef.current}</span>
                  </>
                )}
              </div>
            </div>

            {/* Serial confirmation */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1A2330', marginBottom: 6 }}>
                Type the last 4 digits of the device serial number to enable the erase button
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder={`e.g. ${last4}`}
                  maxLength={4}
                  style={{
                    width: 100, padding: '10px 12px', border: `1.5px solid ${serialMatch ? '#1E8F7A' : '#DDE3EA'}`,
                    borderRadius: 8, fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
                    color: '#1A2330', backgroundColor: '#FFFFFF', outline: 'none',
                    textAlign: 'center', letterSpacing: '0.12em',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                <span style={{ fontSize: 12, color: '#647184' }}>
                  Full serial:{' '}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#1A2330' }}>
                    {deviceSerial.slice(0, -4)}
                    <strong style={{ color: '#1E8F7A' }}>{last4}</strong>
                  </span>
                </span>
              </div>
            </div>

            <button
              disabled={!serialMatch}
              onClick={() => setStep('erasing')}
              style={{
                width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                backgroundColor: serialMatch ? '#C6394A' : '#DDE3EA',
                color: serialMatch ? '#FFFFFF' : '#B0BAC9',
                fontWeight: 700, fontSize: 15, cursor: serialMatch ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background-color 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { if (serialMatch) e.currentTarget.style.backgroundColor = '#A82F3F'; }}
              onMouseLeave={(e) => { if (serialMatch) e.currentTarget.style.backgroundColor = '#C6394A'; }}
            >
              <IconShieldLock size={17} style={{ stroke: serialMatch ? '#fff' : '#B0BAC9' }} />
              {dryRun ? 'Run Dry Erase Simulation' : 'Erase This Drive'}
            </button>

            <button
              onClick={() => setStep('configure')}
              style={{
                width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
                border: '1px solid #DDE3EA', backgroundColor: 'transparent', color: '#647184',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Back to Configure
            </button>
          </div>
        </div>
      )}

      {/* ERASING */}
      {step === 'erasing' && (
        <div style={{ maxWidth: 580 }}>
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: '28px 28px 24px',
              boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF2F3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconShieldLock size={20} style={{ stroke: '#C6394A' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2330', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulse-dot" style={{ backgroundColor: '#C6394A' }} />
                  {phaseLabel}
                </div>
                <div style={{ fontSize: 13, color: '#647184' }}>{deviceName}</div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>
                  {Math.round(progress)}% complete
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
                <div
                  className={progress < 100 ? 'bar-shimmer' : undefined}
                  style={{
                    height: '100%', borderRadius: 5, backgroundColor: '#C6394A',
                    width: `${progress}%`, transition: 'width 0.15s linear',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 12 }}>
                {erasePhases.map((phase) => {
                  const done = progress >= phase.progress[1];
                  const active = progress >= phase.progress[0] && progress < phase.progress[1];
                  return (
                    <div key={phase.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div
                        style={{
                          width: 6, height: 6, borderRadius: '50%',
                          backgroundColor: done ? '#2E9E5B' : active ? '#C6394A' : '#DDE3EA',
                        }}
                      />
                      <span style={{ color: done ? '#2E9E5B' : active ? '#C6394A' : '#B0BAC9' }}>
                        {phase.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Entropy meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconActivity size={14} style={{ stroke: '#4C5FC7' }} />
                  Entropy Level
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#4C5FC7', fontWeight: 500 }}>
                  {entropy.toFixed(2)} / 8.00 bits/byte
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: '#EEF0FB', overflow: 'hidden' }}>
                <div
                  className="bar-animated"
                  style={{
                    height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg, #4C5FC7, #1E8F7A)',
                    width: `${(entropy / 8.0) * 100}%`, transition: 'width 0.2s linear',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#B0BAC9' }}>0.00 (all zeros)</span>
                <span style={{ fontSize: 11, color: '#4C5FC7' }}>8.00 (maximum entropy)</span>
              </div>
              <div style={{ fontSize: 12, color: '#647184', marginTop: 8, lineHeight: 1.5 }}>
                {selectedMethod === 'nist-clear' ? (
                  'For NIST Clear single-pass overwrite (all zeros), post-wipe entropy near 0.00 bits/byte is expected. The adversarial recovery scan verifies zero non-zero bytes remain across all addressable sectors.'
                ) : selectedMethod === 'dod-3pass' ? (
                  'For DoD 5220.22-M 3-pass overwrite, the final pass writes pseudorandom data, so post-wipe entropy near 8.00 bits/byte is expected. The adversarial recovery scan verifies pattern dispersion.'
                ) : (
                  'For crypto erase and sanitize purge methods, post-wipe entropy near 8.00 bits/byte is expected — residual ciphertext appears fully random. The adversarial scan confirms no key remnants remain.'
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VERIFIED — pass */}
      {step === 'verified' && (
        <div style={{ maxWidth: 560 }}>
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: 28,
              boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              marginBottom: 16,
            }}
          >
            {/* Pass result */}
            <div
              style={{
                padding: '20px 22px', borderRadius: 10,
                backgroundColor: selectedMethod === 'nist-destroy' ? '#F8FAFC' : '#EDFAF3',
                border: `1.5px solid ${selectedMethod === 'nist-destroy' ? '#CBD5E1' : '#A8E6C3'}`,
                display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: selectedMethod === 'nist-destroy' ? '#1E293B' : '#2E9E5B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {selectedMethod === 'nist-destroy' ? (
                  <IconShieldLock size={22} style={{ stroke: '#fff' }} />
                ) : (
                  <IconShieldCheck size={22} style={{ stroke: '#fff' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2330', marginBottom: 4 }}>
                  {selectedMethod === 'nist-destroy' ? 'Physical Destruction Documented & Certified' : 'Erasure Independently Verified'}
                </div>
                <div style={{ fontSize: 13, color: selectedMethod === 'nist-destroy' ? '#475569' : '#2E6E40', lineHeight: 1.6 }}>
                  {selectedMethod === 'nist-destroy' ? (
                    <>
                      Witness log recorded and cross-signed under chain-of-custody protocol. Media serial <strong>{deviceSerial}</strong> permanently destroyed per NIST SP 800-88 Rev. 2 standards.
                    </>
                  ) : (
                    <>
                      0 recoverable signatures found. Post-wipe adversarial recovery scan detected no remnant data patterns.
                      Entropy: <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{selectedMethod === 'nist-clear' ? '0.002' : '7.998'} bits/byte</strong>.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                {
                  label: 'Sanitization Method',
                  value: selectedMethod === 'nist-destroy' ? 'Physical Destroy' : (eraseMethods.find(m => m.id === selectedMethod)?.label.split(' (')[0] ?? 'NIST Clear'),
                  sub: selectedMethod === 'nist-destroy' ? 'NIST SP 800-88' : '—',
                },
                {
                  label: selectedMethod === 'nist-destroy' ? 'Witness Verified' : 'Final Entropy',
                  value: selectedMethod === 'nist-destroy' ? '2-Officer Sign' : (selectedMethod === 'nist-clear' ? '0.002' : '7.998'),
                  sub: selectedMethod === 'nist-destroy' ? 'Chain of Custody' : 'bits/byte',
                },
                {
                  label: selectedMethod === 'nist-destroy' ? 'Physical State' : 'Remnant Signatures',
                  value: selectedMethod === 'nist-destroy' ? 'Disintegrated' : '0',
                  sub: selectedMethod === 'nist-destroy' ? 'Residue ≤ 2mm' : 'found',
                },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ padding: '12px 14px', backgroundColor: '#F5F7FA', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#647184', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1A2330', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* USP 5: show attempt history in certificate preview if multiple attempts */}
            {attempts.length > 1 && (
              <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 8, backgroundColor: '#EEF0FB', border: '1px solid #C8CFF5' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4C5FC7', marginBottom: 8 }}>
                  INCLUDED IN CERTIFICATE: Attempt Record
                </div>
                <div style={{ fontSize: 12, color: '#647184', lineHeight: 1.6 }}>
                  This certificate will include the full attempt history as a transparency record — including prior failed attempts and the method that ultimately succeeded.
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {attempts.map((a, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, backgroundColor: a.result === 'failed' ? '#FEF2F3' : '#EDFAF3', color: a.result === 'failed' ? '#C6394A' : '#2E9E5B', fontWeight: 500 }}>
                      #{a.attemptNum} {a.result === 'failed' ? '✕' : '✓'} {a.method}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certificate */}
            <button
              onClick={() => {
                // #28: tell ReportsAndCertificates to open the sanitization tab, not the default forensic tab
                window.dispatchEvent(new CustomEvent('reforge:view_document', {
                  detail: { docType: 'sanitization', caseId: device?.serial ? undefined : undefined }
                }));
                navigate('reports');
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                border: '1.5px solid #1E8F7A', backgroundColor: '#E8F5F2', color: '#1E8F7A',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 10,
                fontFamily: 'Inter, system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <IconCertificate size={16} style={{ stroke: '#1E8F7A' }} />
              {selectedMethod === 'nist-destroy' ? 'View Certificate of Destruction' : 'View Certificate of Sanitization'}
            </button>

            <button
              onClick={() => navigate('dashboard')}
              style={{
                width: '100%', padding: '11px', borderRadius: 8,
                border: '1px solid #DDE3EA', backgroundColor: 'transparent', color: '#647184',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* USP 5: FAILED state */}
      {step === 'failed' && (
        <div style={{ maxWidth: 560 }}>
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 10, padding: 28,
              boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)',
              marginBottom: 16,
            }}
          >
            {/* Fail banner */}
            <div
              style={{
                padding: '20px 22px', borderRadius: 10,
                backgroundColor: '#FEF2F3', border: '1.5px solid #F9D0D4',
                display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: '50%', backgroundColor: '#C6394A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <IconAlertTriangle size={22} style={{ stroke: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#C6394A', marginBottom: 4 }}>
                  Verification Failed
                </div>
                <div style={{ fontSize: 13, color: '#8B3040', lineHeight: 1.6 }}>
                  Verification found residual signatures using the <strong>{methodLabel(selectedMethod)}</strong> method.
                  Adversarial recovery scan detected remnant data patterns that would allow partial reconstruction.
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Erase Method', value: 'Failed', sub: methodLabel(selectedMethod).split(' (')[0] },
                { label: 'Entropy Reached', value: '4.21', sub: 'bits/byte' },
                { label: 'Remnant Signatures', value: '6', sub: 'detected' },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ padding: '12px 14px', backgroundColor: '#F5F7FA', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#647184', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#C6394A', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#647184' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* USP 5: Suggested alternate method card */}
            <div style={{
              padding: '18px 20px', borderRadius: 10,
              backgroundColor: '#EEF0FB', border: '1.5px solid #C8CFF5',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <IconInfo size={16} style={{ stroke: '#4C5FC7', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#4C5FC7', marginBottom: 4 }}>
                    Try Alternate Method: Crypto Erase
                  </div>
                  <div style={{ fontSize: 13, color: '#1A2330', lineHeight: 1.6 }}>
                    Recommended for this device type. Crypto Erase destroys the encryption key rather than overwriting sectors — bypassing firmware limitations that caused the current method to fail.
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRetry('nist-purge-crypto')}
                style={{
                  width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                  backgroundColor: '#4C5FC7', color: '#FFFFFF', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <IconRefresh size={15} style={{ stroke: '#fff' }} />
                Retry with Crypto Erase
              </button>
            </div>

            {/* Retry with different method */}
            <div style={{ fontSize: 12, color: '#647184', textAlign: 'center', marginBottom: 10 }}>
              or
            </div>
            <button
              onClick={() => handleRetry(selectedMethod)}
              style={{
                width: '100%', padding: '11px', borderRadius: 8,
                border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF', color: '#1A2330',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
              }}
            >
              <IconArrowRight size={14} style={{ stroke: '#647184' }} />
              Retry with Same Method ({methodLabel(selectedMethod).split(' (')[0]})
            </button>

            <button
              onClick={() => navigate('dashboard')}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: '1px solid #DDE3EA', backgroundColor: 'transparent', color: '#647184',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
