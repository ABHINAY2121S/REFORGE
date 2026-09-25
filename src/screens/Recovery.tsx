import { useState, useEffect, useRef } from 'react';
import { Device, Screen } from '../types';
import {
  IconSearch, IconCheck, IconPause, IconX, IconDownload, IconChevronRight, IconChevronDown,
  IconInfo, IconEye, IconClock, IconArrowRight
} from '../components/Icons';

interface RecoveryProps {
  device?: Device;
  navigate: (screen: Screen) => void;
}

type Step = 'scan' | 'review' | 'export';

const scanPhases = [
  'Mounting device in read-only mode…',
  'Reading partition table and file system metadata…',
  'Reading raw disk sectors…',
  'Scanning for file signatures and headers…',
  'Reconstructing fragmented files…',
  'Cross-referencing metadata with journal entries…',
  'Building recovered file catalog…',
];

interface Candidate {
  id: string;
  label: string;
  size: string;
  confidence: number;
  reasoning: { step: string; detail: string }[];
}

const recoveredFiles = [
  { id: 1, name: 'Q3_Financial_Report_2024.xlsx', type: 'xlsx', size: '2.4 MB', confidence: 'high', checked: true, hash: 'sha256:a3f4c8d2e1b09...', path: '/RECYCLER/$R4H7PP2', multiCandidate: false },
  { id: 2, name: 'Contract_MeridianCorp_v3.pdf', type: 'pdf', size: '890 KB', confidence: 'high', checked: true, hash: 'sha256:b7d1e5f3a2c09...', path: '/Documents/', multiCandidate: false },
  {
    id: 3, name: 'Unnamed (recovered by content)', type: 'jpg', size: '3.1 MB', confidence: 'medium', checked: false, hash: 'sha256:c9e2f4d1b3a08...', path: 'Unallocated cluster 0x1A4F', multiCandidate: true,
    candidates: [
      {
        id: 'cand-a', label: 'Candidate A', size: '3.1 MB', confidence: 89,
        reasoning: [
          { step: 'Header continuity', detail: 'JPEG SOI/APP0 markers intact, Exif block structurally valid' },
          { step: 'Entropy match', detail: 'Fragment entropy 92% vs Fragment D 61% — significantly higher coherence' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.94' },
          { step: 'Spatial contiguity', detail: 'Cluster run is contiguous; no reallocation gaps detected' },
        ],
      },
      {
        id: 'cand-b', label: 'Candidate B', size: '2.8 MB', confidence: 54,
        reasoning: [
          { step: 'Header continuity', detail: 'SOI marker present but APP1 Exif block has 3 corrupted bytes' },
          { step: 'Entropy match', detail: 'Fragment entropy 61% — lower coherence suggests partial overwrite' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.61' },
          { step: 'Spatial contiguity', detail: 'Cluster run crosses a reallocated region (cluster 0x1C02–0x1C08)' },
        ],
      },
      {
        id: 'cand-c', label: 'Candidate C', size: '3.0 MB', confidence: 31,
        reasoning: [
          { step: 'Header continuity', detail: 'SOI marker present; EOI marker missing — file likely truncated' },
          { step: 'Entropy match', detail: 'Fragment entropy 44% — high likelihood of mixed content from another file' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.29' },
          { step: 'Spatial contiguity', detail: 'Fragment spans 4 non-contiguous clusters' },
        ],
      },
    ] as Candidate[],
  },
  { id: 4, name: 'email_export_nov_2024.pst', type: 'pst', size: '18.7 MB', confidence: 'high', checked: true, hash: 'sha256:d5f8a1c3e2b07...', path: '/AppData/Local/Microsoft', multiCandidate: false },
  { id: 5, name: 'system_log_20241108.txt', type: 'txt', size: '156 KB', confidence: 'low', checked: false, hash: 'sha256:e1b4d6f2c3a06...', path: 'Unallocated cluster 0x3C21', multiCandidate: false },
  { id: 6, name: 'backup_keys_encrypted.zip', type: 'zip', size: '44.2 KB', confidence: 'medium', checked: true, hash: 'sha256:f6c3b8d4e2a05...', path: '/RECYCLER/$RBKP91A', multiCandidate: false },
  { id: 7, name: 'Unnamed (recovered by content)', type: 'mp4', size: '512 MB', confidence: 'medium', checked: false, hash: 'sha256:a2d7e9c1b4f04...', path: 'Unallocated cluster 0x7E88', multiCandidate: false },
  { id: 8, name: 'HR_Investigation_Notes.docx', type: 'docx', size: '128 KB', confidence: 'high', checked: true, hash: 'sha256:b9f1a3d5c2e03...', path: '/OneDrive/Documents', multiCandidate: false },
];

const confidenceConfig = {
  high: { label: 'High', bg: '#EDFAF3', color: '#2E9E5B' },
  medium: { label: 'Medium', bg: '#FEF8EC', color: '#B8862E' },
  low: { label: 'Low', bg: '#F5F7FA', color: '#647184' },
};

const confidenceBreakdown = [
  { label: 'Signature Match', value: 92, color: '#2E9E5B' },
  { label: 'Structural Validity', value: 88, color: '#1E8F7A' },
  { label: 'Decoder Success', value: 100, color: '#4C5FC7' },
  { label: 'Contiguity', value: 71, color: '#B8862E' },
  { label: 'Metadata Match', value: 85, color: '#1E8F7A' },
];

const fileTypeColors: Record<string, string> = {
  xlsx: '#2E9E5B', pdf: '#C6394A', jpg: '#B8862E', pst: '#4C5FC7',
  txt: '#647184', zip: '#647184', mp4: '#1E8F7A', docx: '#4C5FC7',
};

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'scan', label: 'Scan' },
    { key: 'review', label: 'Review Results' },
    { key: 'export', label: 'Export' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: done ? '#1E8F7A' : active ? '#1E8F7A' : '#F5F7FA',
                border: `2px solid ${done || active ? '#1E8F7A' : '#DDE3EA'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {done ? <IconCheck size={13} style={{ stroke: '#fff' }} /> : <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#647184' }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#1A2330' : done ? '#1E8F7A' : '#647184' }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 40, height: 2, backgroundColor: done ? '#1E8F7A' : '#DDE3EA', margin: '0 12px', flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── USP 1: Compare Candidates Panel ──────────────────────────────────────────
function CompareCandidatesPanel({
  candidates,
  selectedId,
  onSelect,
  onClose,
}: {
  candidates: Candidate[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>(null);

  const toggleReasoning = (id: string) =>
    setExpandedReasoning((prev) => (prev === id ? null : id));

  const confidenceColor = (v: number) => v >= 80 ? '#2E9E5B' : v >= 50 ? '#B8862E' : '#C6394A';

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(16,21,27,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 32,
    }}>
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: 14, width: '100%', maxWidth: 860,
        boxShadow: '0 8px 40px rgba(16,21,27,0.18)', overflow: 'hidden', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2330', marginBottom: 4 }}>
              Compare Reconstruction Candidates
            </div>
            <div style={{ fontSize: 13, color: '#647184' }}>
              This file was fragmented. {candidates.length} plausible reconstructions exist — select the one to include in the export.
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #DDE3EA', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#647184', flexShrink: 0 }}>
            <IconX size={14} />
          </button>
        </div>

        {/* Cards */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: `repeat(${candidates.length}, 1fr)`, gap: 16 }}>
            {candidates.map((cand) => {
              const isSelected = cand.id === selectedId;
              const isOpen = expandedReasoning === cand.id;
              const cc = confidenceColor(cand.confidence);
              return (
                <div
                  key={cand.id}
                  style={{
                    borderRadius: 10, border: `2px solid ${isSelected ? '#1E8F7A' : '#DDE3EA'}`,
                    overflow: 'hidden', backgroundColor: isSelected ? '#F8FDFC' : '#FFFFFF',
                    boxShadow: isSelected ? '0 0 0 3px rgba(30,143,122,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Thumbnail placeholder */}
                  <div style={{
                    height: 110, backgroundColor: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderBottom: '1px solid #F0F3F6', position: 'relative',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>🖼️</div>
                      <div style={{ fontSize: 11, color: '#B0BAC9' }}>Preview unavailable</div>
                    </div>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#1E8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconCheck size={12} style={{ stroke: '#fff' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2330' }}>{cand.label}</span>
                      <span style={{ fontSize: 12, color: '#647184' }}>{cand.size}</span>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: '#647184' }}>Confidence</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500, color: cc }}>{cand.confidence}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${cand.confidence}%`, borderRadius: 3, backgroundColor: cc }} />
                      </div>
                    </div>

                    {/* Why this candidate toggle */}
                    <button
                      onClick={() => toggleReasoning(cand.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', borderRadius: 6, border: '1px solid #DDE3EA',
                        backgroundColor: isOpen ? '#F5F7FA' : '#FFFFFF', cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif', marginBottom: isOpen ? 10 : 12,
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#647184' }}>Why this candidate?</span>
                      {isOpen ? <IconChevronDown size={13} style={{ stroke: '#647184' }} /> : <IconChevronRight size={13} style={{ stroke: '#647184' }} />}
                    </button>

                    {isOpen && (
                      <div style={{ marginBottom: 12 }}>
                        {cand.reasoning.map((r, ri) => (
                          <div key={ri} style={{ display: 'flex', gap: 10, paddingBottom: 10, marginBottom: ri < cand.reasoning.length - 1 ? 0 : 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: 3 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1E8F7A', flexShrink: 0 }} />
                              {ri < cand.reasoning.length - 1 && <div style={{ width: 1, flex: 1, backgroundColor: '#DDE3EA', marginTop: 4 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: ri < cand.reasoning.length - 1 ? 8 : 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#1A2330', marginBottom: 2 }}>{r.step}</div>
                              <div style={{ fontSize: 11, color: '#647184', lineHeight: 1.5 }}>
                                {/* Replace percentages with monospace spans */}
                                {r.detail.split(/(\d+%)/g).map((part, pi) =>
                                  /\d+%/.test(part)
                                    ? <span key={pi} style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1A2330' }}>{part}</span>
                                    : part
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      disabled={isSelected}
                      onClick={() => onSelect(cand.id)}
                      style={{
                        width: '100%', padding: '9px 0', borderRadius: 7, border: 'none',
                        backgroundColor: isSelected ? '#E8F5F2' : '#1E8F7A',
                        color: isSelected ? '#1E8F7A' : '#FFFFFF',
                        fontWeight: 600, fontSize: 13, cursor: isSelected ? 'default' : 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Use This Candidate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #DDE3EA', backgroundColor: '#F5F7FA', fontSize: 12, color: '#647184', flexShrink: 0 }}>
          Selection is saved automatically. Close this panel to return to the file list.
        </div>
      </div>
    </div>
  );
}

export default function Recovery({ device, navigate }: RecoveryProps) {
  const [step, setStep] = useState<Step>('scan');
  const [progress, setProgress] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selectedFile, setSelectedFile] = useState<(typeof recoveredFiles)[0] | null>(null);
  const [checkedFiles, setCheckedFiles] = useState<Record<number, boolean>>(
    Object.fromEntries(recoveredFiles.map((f) => [f.id, f.checked]))
  );
  const [filterConf, setFilterConf] = useState<string>('all');
  const [destFolder, setDestFolder] = useState('/Forensics/Cases/2024-CF-0892/Recovery/');
  const intervalRef = useRef<number | undefined>(undefined);

  // USP 1: candidate selection per multi-candidate file
  const [candidatePanelFileId, setCandidatePanelFileId] = useState<number | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, string>>({ 3: 'cand-a' });

  const deviceName = device?.name ?? 'Selected Device';

  useEffect(() => {
    if (step !== 'scan' || paused) return;
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(intervalRef.current); return 100; }
        const next = p + 0.6;
        setPhaseIdx(Math.min(Math.floor((next / 100) * scanPhases.length), scanPhases.length - 1));
        return next;
      });
      setElapsed((e) => e + 1);
    }, 120);
    return () => clearInterval(intervalRef.current);
  }, [step, paused]);

  const eta = progress < 100 ? Math.ceil(((100 - progress) / 0.6) * 0.12 / 60) : 0;
  const elapsedMin = Math.floor(elapsed * 0.12 / 60);
  const elapsedSec = Math.floor((elapsed * 0.12) % 60);

  const filteredFiles = recoveredFiles.filter((f) => filterConf === 'all' || f.confidence === filterConf);
  const checkedCount = Object.values(checkedFiles).filter(Boolean).length;

  const candidatePanelFile = candidatePanelFileId != null ? recoveredFiles.find(f => f.id === candidatePanelFileId) : null;

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>Recovery</div>
        <div style={{ fontSize: 13, color: '#647184', marginTop: 3 }}>
          {deviceName}
          <span style={{ margin: '0 6px', color: '#DDE3EA' }}>·</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{device?.serial ?? '—'}</span>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: '#DDE3EA', margin: '18px 0 24px' }} />
      <StepIndicator current={step} />

      {/* SCAN */}
      {step === 'scan' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSearch size={20} style={{ stroke: '#1E8F7A' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2330' }}>Scanning {deviceName}</div>
                <div style={{ fontSize: 13, color: '#647184', marginTop: 2 }}>
                  {progress < 100 ? scanPhases[phaseIdx] : 'Scan complete. Review your recovered files.'}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{Math.round(progress)}% complete</span>
                {progress < 100 && <span style={{ fontSize: 12, color: '#647184', fontFamily: 'JetBrains Mono, monospace' }}>~{eta}m remaining</span>}
              </div>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, backgroundColor: '#1E8F7A', width: `${progress}%`, transition: 'width 0.15s linear' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#647184' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconClock size={13} />
                <span>Elapsed: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1A2330' }}>{String(elapsedMin).padStart(2, '0')}:{String(elapsedSec).padStart(2, '0')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconSearch size={13} />
                <span>Files found: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1A2330' }}>{Math.floor(progress * 0.8)} fragments</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setPaused(!paused)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF', color: '#1A2330', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IconPause size={14} />{paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => navigate('devices')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF', color: '#647184', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IconX size={14} />Cancel
            </button>
            {progress >= 100 && (
              <button onClick={() => setStep('review')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A', color: '#FFFFFF', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginLeft: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Review {recoveredFiles.length} Recovered Files <IconArrowRight size={14} style={{ stroke: '#fff' }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* REVIEW */}
      {step === 'review' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: '#647184' }}>Confidence:</span>
              {['all', 'high', 'medium', 'low'].map((v) => (
                <button key={v} onClick={() => setFilterConf(v)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, border: `1.5px solid ${filterConf === v ? '#1E8F7A' : '#DDE3EA'}`, backgroundColor: filterConf === v ? '#E8F5F2' : '#FFFFFF', color: filterConf === v ? '#1E8F7A' : '#647184', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'capitalize' }}>{v === 'all' ? 'All' : v}</button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#647184' }}>{checkedCount} of {recoveredFiles.length} selected</span>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)' }}>
              {filteredFiles.map((file, i) => {
                const conf = confidenceConfig[file.confidence as keyof typeof confidenceConfig];
                const typeColor = fileTypeColors[file.type] ?? '#647184';
                const hasMultiple = (file as any).multiCandidate;
                const chosenCandId = selectedCandidates[file.id];
                const chosenCand = hasMultiple ? (file as any).candidates?.find((c: Candidate) => c.id === chosenCandId) : null;

                return (
                  <div
                    key={file.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i > 0 ? '1px solid #F0F3F6' : 'none', cursor: 'pointer', backgroundColor: selectedFile?.id === file.id ? '#F8FAFB' : 'transparent', transition: 'background-color 0.1s ease' }}
                    onClick={() => !hasMultiple && setSelectedFile(selectedFile?.id === file.id ? null : file)}
                  >
                    <input
                      type="checkbox"
                      checked={checkedFiles[file.id] ?? false}
                      onChange={(e) => { e.stopPropagation(); setCheckedFiles({ ...checkedFiles, [file.id]: e.target.checked }); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: `${typeColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>{file.type}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: '#647184', marginTop: 1 }}>{chosenCand ? chosenCand.size : file.size}</div>
                    </div>

                    {/* USP 1: Multiple Candidates badge */}
                    {hasMultiple && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setCandidatePanelFileId(file.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6,
                          border: '1.5px solid #4C5FC7', backgroundColor: '#EEF0FB', color: '#4C5FC7',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                          fontFamily: 'Inter, system-ui, sans-serif',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E4E7F8')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#EEF0FB')}
                      >
                        <IconInfo size={11} style={{ stroke: '#4C5FC7' }} />
                        Multiple Candidates Found
                      </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 10, backgroundColor: conf.bg, color: conf.color, fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: conf.color }} />
                      {hasMultiple && chosenCand ? `${chosenCand.confidence}%` : conf.label}
                    </div>
                    {!hasMultiple && <IconChevronRight size={14} style={{ color: '#B0BAC9', stroke: '#B0BAC9', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setStep('export')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A', color: '#FFFFFF', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Proceed to Export ({checkedCount} files) <IconArrowRight size={14} style={{ stroke: '#fff' }} />
              </button>
            </div>
          </div>

          {/* Single-file side panel */}
          {selectedFile && !selectedFile.multiCandidate && (
            <div style={{ width: 300, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 10, boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #DDE3EA' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2330', marginBottom: 2, wordBreak: 'break-word' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 12, color: '#647184' }}>{selectedFile.size}</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 10 }}>CONFIDENCE SCORE</div>
                {confidenceBreakdown.map((item) => (
                  <div key={item.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: '#1A2330' }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>{item.value}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.value}%`, borderRadius: 3, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F0F3F6' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 6 }}>SHA-256 HASH</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#1A2330', wordBreak: 'break-all', lineHeight: 1.6 }}>{selectedFile.hash}</div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F3F6' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 6 }}>ORIGINAL PATH</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#1A2330', wordBreak: 'break-all', lineHeight: 1.6 }}>{selectedFile.path}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPORT */}
      {step === 'export' && (
        <div style={{ maxWidth: 580 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 28, boxShadow: '0 1px 3px rgba(16,21,27,0.07), 0 0 0 1px rgba(16,21,27,0.04)', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2330', marginBottom: 18 }}>Export Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Files selected', value: String(checkedCount) },
                { label: 'Total size (approx.)', value: '25.4 MB' },
                { label: 'Source device', value: deviceName },
                { label: 'Case reference', value: '#2024-CF-0892' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 14px', backgroundColor: '#F5F7FA', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#647184', marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1A2330', marginBottom: 8 }}>Destination folder</label>
              <input type="text" value={destFolder} onChange={(e) => setDestFolder(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #DDE3EA', borderRadius: 8, fontSize: 13, color: '#1A2330', fontFamily: 'JetBrains Mono, monospace', backgroundColor: '#FFFFFF', outline: 'none' }} onFocus={(e) => (e.target.style.borderColor = '#1E8F7A')} onBlur={(e) => (e.target.style.borderColor = '#DDE3EA')} />
            </div>
            <div style={{ padding: '14px', borderRadius: 8, backgroundColor: '#EEF0FB', border: '1px solid #C8CFF5', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#4C5FC7', display: 'flex', gap: 8 }}>
                <IconInfo size={15} style={{ stroke: '#4C5FC7', flexShrink: 0, marginTop: 1 }} />
                <span>A SHA-256 manifest and chain-of-custody report will be generated alongside the exported files.</span>
              </div>
            </div>
            <button onClick={() => navigate('verification')} style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', backgroundColor: '#1E8F7A', color: '#FFFFFF', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IconDownload size={16} style={{ stroke: '#fff' }} />Export & Generate Report
            </button>
          </div>
        </div>
      )}

      {/* USP 1: Candidates modal */}
      {candidatePanelFile && candidatePanelFile.multiCandidate && (
        <CompareCandidatesPanel
          candidates={(candidatePanelFile as any).candidates}
          selectedId={selectedCandidates[candidatePanelFile.id] ?? (candidatePanelFile as any).candidates[0].id}
          onSelect={(id) => setSelectedCandidates({ ...selectedCandidates, [candidatePanelFile.id]: id })}
          onClose={() => setCandidatePanelFileId(null)}
        />
      )}
    </div>
  );
}
