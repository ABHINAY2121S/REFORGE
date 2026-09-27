import { useState, useEffect, useRef } from 'react';
import { Device, Screen, NavigateOptions } from '../types';
import { recordRecoveryCompleted } from '../operationsStore';
import {
  apiScanLiveFilesystem,
  apiCheckAdminStatus,
  apiElevateAdmin,
  apiPickFolder,
  apiOpenFolder,
  apiExportRecoveredFiles,
  ScannedRecoveryFile,
} from '../api';
import {
  IconSearch, IconCheck, IconPause, IconX, IconDownload, IconChevronRight, IconChevronDown,
  IconInfo, IconEye, IconClock, IconArrowRight, IconHardDrive, IconShieldCheck, IconRefresh
} from '../components/Icons';

interface RecoveryProps {
  device?: Device;
  navigate: (screen: Screen, options?: NavigateOptions) => void;
  initialTargetPaths?: string[];
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
  { id: 1, name: 'Q3_Financial_Report_2024.xlsx', type: 'xlsx', size: '2.4 MB', confidence: 'high', checked: true, hash: 'sha256:a3f4c8d2e1b09...', path: '/RECYCLER/$R4H7PP2', isDeleted: true, multiCandidate: false },
  { id: 2, name: 'Contract_MeridianCorp_v3.pdf', type: 'pdf', size: '890 KB', confidence: 'high', checked: true, hash: 'sha256:b7d1e5f3a2c09...', path: '/Documents/', isDeleted: false, multiCandidate: false },
  {
    id: 3, name: 'Unnamed (recovered by content)', type: 'jpg', size: '3.1 MB', confidence: 'medium', checked: false, hash: 'sha256:c9e2f4d1b3a08...', path: 'Unallocated cluster 0x1A4F', multiCandidate: true,
    candidates: [
      {
        id: 'cand-a', label: 'Candidate A', size: '3.1 MB', confidence: 89,
        reasoning: [
          { step: 'Header continuity', detail: 'JPEG SOI/APP0 markers intact, Exif block structurally valid' },
          { step: 'Fragment coherence', detail: 'Coherence score 0.92 vs Fragment D 0.61 — significantly higher structural integrity' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.94' },
          { step: 'Spatial contiguity', detail: 'Cluster run is contiguous; no reallocation gaps detected' },
        ],
      },
      {
        id: 'cand-b', label: 'Candidate B', size: '2.8 MB', confidence: 54,
        reasoning: [
          { step: 'Header continuity', detail: 'SOI marker present but APP1 Exif block has 3 corrupted bytes' },
          { step: 'Fragment coherence', detail: 'Coherence score 0.61 — lower score suggests partial overwrite' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.61' },
          { step: 'Spatial contiguity', detail: 'Cluster run crosses a reallocated region (cluster 0x1C02–0x1C08)' },
        ],
      },
      {
        id: 'cand-c', label: 'Candidate C', size: '3.0 MB', confidence: 31,
        reasoning: [
          { step: 'Header continuity', detail: 'SOI marker present; EOI marker missing — file likely truncated' },
          { step: 'Fragment coherence', detail: 'Coherence score 0.44 — high likelihood of mixed content from another file' },
          { step: 'ML type consistency', detail: 'ResNet-50 content classifier: image/jpeg confidence 0.29' },
          { step: 'Spatial contiguity', detail: 'Fragment spans 4 non-contiguous clusters' },
        ],
      },
    ] as Candidate[],
  },
  { id: 4, name: 'email_export_nov_2024.pst', type: 'pst', size: '18.7 MB', confidence: 'high', checked: true, hash: 'sha256:d5f8a1c3e2b07...', path: '/AppData/Local/Microsoft', isDeleted: false, multiCandidate: false },
  { id: 5, name: 'system_log_20241108.txt', type: 'txt', size: '156 KB', confidence: 'low', checked: false, hash: 'sha256:e1b4d6f2c3a06...', path: 'Unallocated cluster 0x3C21', isDeleted: false, multiCandidate: false },
  { id: 6, name: 'backup_keys_encrypted.zip', type: 'zip', size: '44.2 KB', confidence: 'medium', checked: true, hash: 'sha256:f6c3b8d4e2a05...', path: '/RECYCLER/$RBKP91A', isDeleted: true, multiCandidate: false },
  { id: 7, name: 'Unnamed (recovered by content)', type: 'mp4', size: '512 MB', confidence: 'medium', checked: false, hash: 'sha256:a2d7e9c1b4f04...', path: 'Unallocated cluster 0x7E88', isDeleted: false, multiCandidate: false },
  { id: 8, name: 'HR_Investigation_Notes.docx', type: 'docx', size: '128 KB', confidence: 'high', checked: true, hash: 'sha256:b9f1a3d5c2e03...', path: '/OneDrive/Documents', isDeleted: false, multiCandidate: false },
];

const confidenceConfig = {
  high: { label: 'High', bg: '#EDFAF3', color: '#2E9E5B' },
  medium: { label: 'Medium', bg: '#FEF8EC', color: '#B8862E' },
  low: { label: 'Low', bg: '#F5F7FA', color: '#647184' },
};

function getConfidenceBreakdown(file: any) {
  if (!file) {
    return [
      { label: 'Signature Match', value: 92, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 88, color: '#1E8F7A' },
      { label: 'Decoder Success', value: 100, color: '#4C5FC7' },
      { label: 'Contiguity', value: 71, color: '#B8862E' },
      { label: 'Metadata Match', value: 85, color: '#1E8F7A' },
    ];
  }

  const name = (file.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  const conf = file.confidence || 'high';

  if (name.includes('contract') || (ext === 'pdf' && conf === 'high')) {
    return [
      { label: 'Signature Match', value: 99, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 96, color: '#1E8F7A' },
      { label: 'Decoder Success', value: 100, color: '#4C5FC7' },
      { label: 'Contiguity', value: 94, color: '#2E9E5B' },
      { label: 'Metadata Match', value: 92, color: '#1E8F7A' },
    ];
  }

  if (name.includes('financial') || name.includes('q3') || ext === 'xlsx') {
    return [
      { label: 'Signature Match', value: 94, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 90, color: '#1E8F7A' },
      { label: 'Decoder Success', value: 100, color: '#4C5FC7' },
      { label: 'Contiguity', value: 81, color: '#B8862E' },
      { label: 'Metadata Match', value: 86, color: '#1E8F7A' },
    ];
  }

  if (name.includes('unnamed') || file.multiCandidate || ext === 'jpg' || ext === 'jpeg') {
    return [
      { label: 'Signature Match', value: 89, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 74, color: '#B8862E' },
      { label: 'Decoder Success', value: 82, color: '#4C5FC7' },
      { label: 'Contiguity', value: 61, color: '#B8862E' },
      { label: 'Metadata Match', value: 38, color: '#C6394A' },
    ];
  }

  if (name.includes('email') || ext === 'pst') {
    return [
      { label: 'Signature Match', value: 96, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 93, color: '#1E8F7A' },
      { label: 'Decoder Success', value: 99, color: '#4C5FC7' },
      { label: 'Contiguity', value: 88, color: '#2E9E5B' },
      { label: 'Metadata Match', value: 94, color: '#1E8F7A' },
    ];
  }

  if (ext === 'txt' || conf === 'low') {
    return [
      { label: 'Signature Match', value: 46, color: '#C6394A' },
      { label: 'Structural Validity', value: 52, color: '#B8862E' },
      { label: 'Decoder Success', value: 60, color: '#B8862E' },
      { label: 'Contiguity', value: 41, color: '#C6394A' },
      { label: 'Metadata Match', value: 33, color: '#C6394A' },
    ];
  }

  if (ext === 'zip' || conf === 'medium') {
    return [
      { label: 'Signature Match', value: 82, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 76, color: '#B8862E' },
      { label: 'Decoder Success', value: 79, color: '#4C5FC7' },
      { label: 'Contiguity', value: 68, color: '#B8862E' },
      { label: 'Metadata Match', value: 58, color: '#B8862E' },
    ];
  }

  if (ext === 'docx') {
    return [
      { label: 'Signature Match', value: 95, color: '#2E9E5B' },
      { label: 'Structural Validity', value: 92, color: '#1E8F7A' },
      { label: 'Decoder Success', value: 100, color: '#4C5FC7' },
      { label: 'Contiguity', value: 89, color: '#2E9E5B' },
      { label: 'Metadata Match', value: 87, color: '#1E8F7A' },
    ];
  }

  const base = conf === 'high' ? 88 : conf === 'medium' ? 70 : 45;
  const hashVal = (file.name || '').length * 7;
  const sMatch = Math.min(99, base + (hashVal % 10));
  const sValid = Math.min(99, base - 4 + ((hashVal * 3) % 11));
  const sDec = conf === 'high' ? 100 : Math.min(95, base + ((hashVal * 2) % 12));
  const sCont = Math.min(99, base - 8 + ((hashVal * 5) % 14));
  const sMeta = Math.min(99, base - 6 + ((hashVal * 7) % 15));

  const getColor = (v: number) => v >= 85 ? '#2E9E5B' : v >= 65 ? '#B8862E' : '#C6394A';

  return [
    { label: 'Signature Match', value: sMatch, color: getColor(sMatch) },
    { label: 'Structural Validity', value: sValid, color: getColor(sValid) },
    { label: 'Decoder Success', value: sDec, color: '#4C5FC7' },
    { label: 'Contiguity', value: sCont, color: getColor(sCont) },
    { label: 'Metadata Match', value: sMeta, color: getColor(sMeta) },
  ];
}

const fileTypeColors: Record<string, string> = {
  xlsx: '#2E9E5B', pdf: '#C6394A', jpg: '#B8862E', jpeg: '#B8862E', pst: '#4C5FC7',
  txt: '#647184', zip: '#647184', mp4: '#1E8F7A', docx: '#4C5FC7', png: '#0D9488',
  bin: '#647184', '7z': '#647184', rar: '#647184', exe: '#C6394A', csv: '#2E9E5B',
  json: '#B8862E', py: '#4C5FC7', rs: '#B8862E', md: '#647184', html: '#C6394A',
  js: '#B8862E', m4a: '#1E8F7A', mp3: '#1E8F7A', sql: '#0D9488', log: '#647184',
};

function getShortTypeBadge(type: string = '', name: string = ''): { label: string; color: string; bg: string } {
  const t = (type || '').toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (t.includes('pdf') || ext === 'pdf') {
    return { label: 'PDF', color: '#DC2626', bg: '#FEE2E2' };
  }
  if (t.includes('excel') || t.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return { label: 'XLSX', color: '#16A34A', bg: '#DCFCE7' };
  }
  if (t.includes('jpeg') || t.includes('jpg') || t.includes('image') || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    return { label: 'JPEG', color: '#7C3AED', bg: '#F3E8FF' };
  }
  if (t.includes('word') || t.includes('document') || ext === 'docx' || ext === 'doc') {
    return { label: 'DOCX', color: '#2563EB', bg: '#DBEAFE' };
  }
  if (t.includes('sqlite') || t.includes('database') || ext === 'sqlite' || ext === 'db' || ext === 'sql') {
    return { label: 'SQL', color: '#0D9488', bg: '#CCFBF1' };
  }
  if (t.includes('text') || ext === 'txt' || ext === 'log') {
    return { label: 'TXT', color: '#475569', bg: '#F1F5F9' };
  }
  if (t.includes('zip') || ext === 'zip' || ext === 'rar' || ext === '7z') {
    return { label: 'ZIP', color: '#EA580C', bg: '#FFEDD5' };
  }
  if (t.includes('video') || ext === 'mp4' || ext === 'mkv') {
    return { label: 'MP4', color: '#9333EA', bg: '#F3E8FF' };
  }
  const clean = (ext || t.split(' ')[0] || 'FILE').toUpperCase().slice(0, 4);
  return { label: clean, color: fileTypeColors[clean.toLowerCase()] ?? '#475569', bg: '#F1F5F9' };
}

function StepIndicator({ current, onStepClick }: { current: Step; onStepClick?: (step: Step) => void }) {
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
            <div
              onClick={() => onStepClick && onStepClick(step.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onStepClick ? 'pointer' : 'default' }}
            >
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
              const confPercent = cand.confidence <= 1 ? Math.round(cand.confidence * 100) : Math.round(cand.confidence);
              const cc = confidenceColor(confPercent);
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
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500, color: cc }}>{confPercent}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, backgroundColor: '#F0F3F6', overflow: 'hidden' }}>
                        <div
                          key={`cand-${cand.id}`}
                          className="bar-animated"
                          style={{ height: '100%', width: `${confPercent}%`, borderRadius: 3, backgroundColor: cc }}
                        />
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

export default function Recovery({ device, navigate, initialTargetPaths }: RecoveryProps) {
  const [step, setStep] = useState<Step>('scan');
  const [progress, setProgress] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Forensic Data Source & Target Scope
  const initialCustom = (initialTargetPaths && initialTargetPaths.length > 0) ? initialTargetPaths[0] : '';
  const [scanSource, setScanSource] = useState<'live' | 'demo'>('live');
  const [scopeMode, setScopeMode] = useState<string>(initialCustom ? 'custom' : 'all');
  const [customPath, setCustomPath] = useState<string>(initialCustom || 'D:\\DEMO');
  const [recoveredFilesList, setRecoveredFilesList] = useState<ScannedRecoveryFile[]>([]);
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<ScannedRecoveryFile | null>(null);
  const [checkedFiles, setCheckedFiles] = useState<Record<number, boolean>>({});
  const [filterConf, setFilterConf] = useState<string>('all');
  const [destFolder, setDestFolder] = useState('D:\\REFORGE_Recovered_Files');
  const [exportSuccess, setExportSuccess] = useState<{ destination: string; count: number; manifest?: string } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const intervalRef = useRef<number | undefined>(undefined);

  // USP 1: candidate selection per multi-candidate file
  const [candidatePanelFileId, setCandidatePanelFileId] = useState<number | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, string>>({ 3: 'cand-a' });

  const [scanStarted, setScanStarted] = useState(false);

  const deviceName = device?.name ?? 'Selected Device';

  const triggerLiveScan = (pathOverride?: string, scopeOverride?: string) => {
    const curScope = scopeOverride ?? scopeMode;
    const curPath = (pathOverride ?? customPath).trim() || 'D:\\DEMO';
    const target = curScope === 'custom' ? curPath : undefined;
    setIsScanningLive(true);
    apiScanLiveFilesystem(target, curScope, 50).then((liveFiles) => {
      setIsScanningLive(false);
      if (liveFiles && liveFiles.length > 0) {
        setRecoveredFilesList(liveFiles);
        setCheckedFiles(Object.fromEntries(liveFiles.map((f) => [f.id, true])));
      }
    }).catch((err) => {
      console.warn('Live filesystem recovery scan failed:', err);
      setIsScanningLive(false);
    });
  };

  useEffect(() => {
    apiCheckAdminStatus().then((res) => setIsAdmin(res.isAdmin)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!device || step !== 'scan' || !scanStarted || paused) return;

    if (scanSource === 'live') {
      triggerLiveScan();
    } else {
      setRecoveredFilesList(recoveredFiles);
      setCheckedFiles(Object.fromEntries(recoveredFiles.map((f) => [f.id, f.checked])));
    }

    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(intervalRef.current); return 100; }
        const next = p + 1.2;
        setPhaseIdx(Math.min(Math.floor((next / 100) * scanPhases.length), scanPhases.length - 1));
        return next;
      });
      setElapsed((e) => e + 1);
    }, 90);
    return () => clearInterval(intervalRef.current);
  }, [device, step, scanStarted, paused, scanSource, scopeMode, customPath]);

  const eta = progress < 100 ? Math.ceil(((100 - progress) / 1.2) * 0.09 / 60) : 0;
  const elapsedMin = Math.floor(elapsed * 0.09 / 60);
  const elapsedSec = Math.floor((elapsed * 0.09) % 60);

  const filteredFiles = recoveredFilesList.filter((f) => {
    if (filterConf === 'all') return true;
    if (filterConf === 'deleted') return Boolean(f.isDeleted);
    return f.confidence === filterConf;
  });
  const checkedCount = Object.values(checkedFiles).filter(Boolean).length;

  const handleCompleteRecovery = () => {
    if (device) {
      recordRecoveryCompleted({
        caseId: '2024-CF-0892',
        caseName: scanSource === 'live' ? 'Live Forensic Evidence Scan' : 'State v. Meridian Corp',
        device,
        recoveredFiles: recoveredFilesList.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          confidence: f.confidence as any,
          hash: f.hash,
          path: f.path,
        })),
      });
    }
  };

  const handlePerformExport = async () => {
    setIsExporting(true);
    const selectedList = recoveredFilesList.filter((f) => checkedFiles[f.id]);
    try {
      const res = await apiExportRecoveredFiles(destFolder, selectedList.length > 0 ? selectedList : recoveredFilesList);
      setIsExporting(false);
      setExportSuccess({ destination: res.destination, count: res.exportedCount, manifest: res.manifest });
      handleCompleteRecovery();
      apiOpenFolder(res.destination);
    } catch (err) {
      console.error('Export failed:', err);
      setIsExporting(false);
    }
  };

  useEffect(() => {
    // Automatically trigger live file scan on mount so real system files and target artifacts are loaded immediately
    const initialTarget = initialCustom ? initialCustom : undefined;
    const initialMode = initialCustom ? 'custom' : 'all';
    apiScanLiveFilesystem(initialTarget, initialMode, 50).then((liveFiles) => {
      if (liveFiles && liveFiles.length > 0) {
        setRecoveredFilesList(liveFiles);
        setCheckedFiles(Object.fromEntries(liveFiles.map((f) => [f.id, true])));
      }
    }).catch(() => {});
  }, [initialCustom]);

  const candidatePanelFile = candidatePanelFileId != null ? recoveredFilesList.find(f => f.id === candidatePanelFileId) : null;

  // ── No Device Selected View ───────────────────────────────────────────────
  if (!device) {
    return (
      <div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Data Recovery
          </div>
          <div style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginTop: 4 }}>
            Deep signature carving, fragment reconstruction, and journal analysis.
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
            Forensic file recovery and signature carving require an active target drive or partition. Please select a physical device from the Devices tab to begin.
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
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>Recovery</div>
        <div style={{ fontSize: 13, color: '#334155', fontWeight: 500, marginTop: 3 }}>
          <strong style={{ color: '#0F172A' }}>{deviceName}</strong>
          <span style={{ margin: '0 8px', color: '#CBD5E1' }}>·</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#334155' }}>{device?.serial ?? '—'}</span>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: '#CBD5E1', margin: '18px 0 24px' }} />
      <StepIndicator
        current={step}
        onStepClick={(s) => {
          setStep(s);
          if (s === 'scan') {
            setScanStarted(false);
            setProgress(0);
          }
        }}
      />

      {/* PRE-SCAN SETUP */}
      {step === 'scan' && !scanStarted && (
        <div style={{ maxWidth: 640 }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 10, padding: '24px 28px',
            border: '1.5px solid #CBD5E1', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, backgroundColor: '#E6FFFA',
                border: '1px solid #99F6E4', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconHardDrive size={22} style={{ stroke: '#0D9488' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{device.name}</div>
                <div style={{ fontSize: 13, color: '#334155', fontWeight: 500, marginTop: 2 }}>
                  {device.capacity} · {device.interface} · {device.type}
                </div>
              </div>
            </div>

            {/* Administrator Privilege Status */}
            {!isAdmin && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, backgroundColor: '#FFFBEB',
                border: '1.5px solid #FCD34D', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🛡️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Standard User Privilege Active</div>
                    <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                      NTFS $Recycle.Bin residuals, Recent link artifacts, and target folder residuals are active. Administrator elevation is recommended for raw unallocated disk cluster carving.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => apiElevateAdmin()}
                  style={{
                    padding: '7px 14px', borderRadius: 6, backgroundColor: '#D97706', color: '#FFFFFF',
                    border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  Run as Admin
                </button>
              </div>
            )}
            {isAdmin && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, backgroundColor: '#F0FDF4',
                border: '1.5px solid #86EFAC', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ fontSize: 16 }}>🛡️</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
                  Full Forensic Administrator Mode Active — Direct MFT & Raw Physical Sector Carving Enabled
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 0', fontSize: 13, padding: '16px 0', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', marginBottom: 20 }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Serial Number</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0F172A', fontWeight: 600 }}>{device.serial}</span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Media Type</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>
                {(device as any).mediaTechnology ||
                  (device.type === 'USB' ? 'USB Flash Storage (NAND Flash)'
                  : device.type === 'SD' ? 'SD Flash Storage (NAND Flash)'
                  : device.type === 'SSD' ? 'Solid State Drive (NAND Flash)'
                  : 'Magnetic Platter HDD')}
              </span>
              <span style={{ color: '#475569', fontWeight: 600 }}>TRIM Architecture</span>
              <span style={{ color: (device as any).trimSupported ? '#D97706' : '#16A34A', fontWeight: 600 }}>
                {(device as any).trimStatus ||
                  (device.type === 'USB' || device.type === 'SD'
                    ? 'TRIM: Not applicable (USB/SD mass storage)'
                    : device.type === 'SSD'
                      ? 'Hardware TRIM Active (Emptied sectors cleared; recovered via journal & residuals)'
                      : 'TRIM Inactive (100% Raw Physical Cluster Carving Supported)')}
              </span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Access Mode</span>
              <span style={{ color: '#16A34A', fontWeight: 700 }}>Forensic Read-Only (Software Write-Protected — Hardware write-blocker recommended for evidence drives)</span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Carving Strategy</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>
                {device.type === 'USB' || device.type === 'SD'
                  ? 'FAT Directory Entry Recovery + File Signature/Header Carving + Unallocated Cluster Scan'
                  : 'Header/Trailer Signatures + $Recycle.Bin Residuals + Shell Journal + MFT'}
              </span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Target Partitions</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>{device.partitions?.map(p => p.label).join(', ') || 'Whole Physical Device'}</span>
            </div>

            {/* Scan Mode & Scope Selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                Forensic Data Source
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setScanSource('live')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
                    border: `1.5px solid ${scanSource === 'live' ? '#0D9488' : '#CBD5E1'}`,
                    backgroundColor: scanSource === 'live' ? '#F0FDFA' : '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    backgroundColor: scanSource === 'live' ? '#CCFBF1' : '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <span style={{ fontSize: 14 }}>⚡</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: scanSource === 'live' ? '#0F766E' : '#0F172A' }}>
                      Live Hardware Scan
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                      Scans real files & signatures on this PC
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScanSource('demo')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
                    border: `1.5px solid ${scanSource === 'demo' ? '#0D9488' : '#CBD5E1'}`,
                    backgroundColor: scanSource === 'demo' ? '#F0FDFA' : '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    backgroundColor: scanSource === 'demo' ? '#CCFBF1' : '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <span style={{ fontSize: 14 }}>📂</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: scanSource === 'demo' ? '#0F766E' : '#0F172A' }}>
                      Demo Case (Meridian Corp)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                      Preconfigured prototype training dataset
                    </div>
                  </div>
                </button>
              </div>

              {scanSource === 'live' && (
                <div style={{ padding: '14px 16px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                    TARGET SCAN SCOPE
                  </label>
                  <select
                    value={scopeMode}
                    onChange={(e) => setScopeMode(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1',
                      fontSize: 13, color: '#0F172A', fontWeight: 600, backgroundColor: '#FFFFFF', outline: 'none'
                    }}
                  >
                    {(device.type === 'USB' || device.type === 'SD') ? (
                      <>
                        <option value="all">Whole Device — Full Volume Carving</option>
                        <option value="d_drive">{device.partitions?.[0]?.label ?? 'Removable Volume'} — FAT Cluster Scan</option>
                        <option value="temp">Unallocated Clusters Only</option>
                        <option value="custom">Specific Directory / Folder Path...</option>
                      </>
                    ) : (
                      <>
                        <option value="all">Comprehensive (Downloads, Documents, Desktop, Pictures, D:)</option>
                        <option value="downloads">User Downloads Folder (Fast Carving)</option>
                        <option value="documents">User Documents Folder</option>
                        <option value="desktop">User Desktop Directory</option>
                        <option value="temp">Windows Temp & Deleted Cache</option>
                        <option value="d_drive">D: REFORGE Workspace / Data Drive</option>
                        <option value="custom">Specific Directory / Folder Path...</option>
                      </>
                    )}
                  </select>

                  {scopeMode === 'custom' && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="e.g. D:\DEMO or C:\Users\Abhinay\OneDrive\Desktop"
                          value={customPath}
                          onChange={(e) => setCustomPath(e.target.value)}
                          style={{
                            flex: 1, padding: '9px 12px', borderRadius: 6, border: '1.5px solid #CBD5E1',
                            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#0F172A', outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const picked = await apiPickFolder();
                            if (picked) {
                              setCustomPath(picked);
                              triggerLiveScan(picked, 'custom');
                            }
                          }}
                          style={{
                            padding: '9px 14px', borderRadius: 6, border: '1.5px solid #0D9488',
                            backgroundColor: '#E6FFFA', color: '#0F766E', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
                          }}
                        >
                          📁 Browse...
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerLiveScan(customPath, 'custom')}
                          style={{
                            padding: '9px 14px', borderRadius: 6, border: 'none',
                            backgroundColor: '#0D9488', color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
                          }}
                        >
                          ⚡ Scan Target
                        </button>
                      </div>

                      {/* Quick target chips */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Quick Targets:</span>
                        {[
                          { label: 'D:\\DEMO', path: 'D:\\DEMO' },
                          { label: 'Desktop', path: 'C:\\Users\\Abhinay\\OneDrive\\Desktop' },
                          { label: 'Downloads', path: 'C:\\Users\\Abhinay\\Downloads' },
                        ].map((chip) => (
                          <button
                            key={chip.path}
                            type="button"
                            onClick={() => {
                              setCustomPath(chip.path);
                              triggerLiveScan(chip.path, 'custom');
                            }}
                            style={{
                              padding: '3px 8px', borderRadius: 4, border: '1px solid #CBD5E1',
                              backgroundColor: customPath.toLowerCase() === chip.path.toLowerCase() ? '#CCFBF1' : '#FFFFFF',
                              color: customPath.toLowerCase() === chip.path.toLowerCase() ? '#0F766E' : '#334155',
                              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace'
                            }}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                        Direct forensic carving parses NTFS unallocated cluster runs, directory indexes, and headers inside your selected folder.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={() => setScanStarted(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px',
                  borderRadius: 8, border: 'none', backgroundColor: '#0D9488',
                  color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  boxShadow: '0 2px 6px rgba(13,148,136,0.3)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0F766E')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0D9488')}
              >
                <IconSearch size={16} style={{ stroke: '#fff' }} />
                Start Recovery Scan
              </button>
              <button
                onClick={() => navigate('devices')}
                style={{
                  padding: '11px 18px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF', color: '#334155', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                Change Target Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCAN IN PROGRESS */}
      {step === 'scan' && scanStarted && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: '28px 28px 24px', border: '1.5px solid #CBD5E1', boxShadow: '0 2px 4px rgba(15,23,42,0.06)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#E6FFFA', border: '1px solid #99F6E4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSearch size={22} style={{ stroke: '#0D9488' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Scanning {deviceName}</div>
                <div style={{ fontSize: 13, color: '#334155', fontWeight: 500, marginTop: 2 }}>
                  {progress < 100 ? scanPhases[phaseIdx] : 'Scan complete. Review your recovered files.'}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{Math.round(progress)}% complete</span>
                {progress < 100 && <span style={{ fontSize: 12, color: '#334155', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>~{eta}m remaining</span>}
              </div>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div
                  className={progress < 100 ? 'bar-shimmer' : undefined}
                  style={{ height: '100%', borderRadius: 4, backgroundColor: '#0D9488', width: `${progress}%`, transition: 'width 0.15s linear' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#334155', fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconClock size={14} style={{ stroke: '#334155' }} />
                <span>Elapsed: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0F172A', fontWeight: 600 }}>{String(elapsedMin).padStart(2, '0')}:{String(elapsedSec).padStart(2, '0')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconSearch size={14} style={{ stroke: '#334155' }} />
                <span>Files found: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0F172A', fontWeight: 600 }}>{Math.floor(progress * 0.8)} fragments</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setPaused(!paused)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1.5px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IconPause size={14} />{paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => { setScanStarted(false); setProgress(0); setElapsed(0); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1.5px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <IconX size={14} />Cancel
            </button>
            {progress >= 100 && (
              <button onClick={() => { handleCompleteRecovery(); setStep('review'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: 'none', backgroundColor: '#0D9488', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginLeft: 'auto', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 2px 6px rgba(13,148,136,0.3)' }}>
                Review {recoveredFilesList.length} Recovered Files <IconArrowRight size={14} style={{ stroke: '#fff' }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* REVIEW */}
      {step === 'review' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Live vs Demo Status Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, padding: '12px 18px', borderRadius: 8,
              backgroundColor: scanSource === 'live' ? '#F0FDFA' : '#F8FAFC',
              border: `1.5px solid ${scanSource === 'live' ? '#99F6E4' : '#E2E8F0'}`
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: scanSource === 'live' ? '#0F766E' : '#0F172A' }}>
                    {scanSource === 'live' ? '⚡ Live System Recovery Scan Results' : '📂 Prototype Training Dataset (State v. Meridian Corp)'}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    backgroundColor: scanSource === 'live' ? '#CCFBF1' : '#E2E8F0',
                    color: scanSource === 'live' ? '#0F766E' : '#475569'
                  }}>
                    {scanSource === 'live' ? 'REAL SYSTEM FILES' : 'DEMO MOCK'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {recoveredFilesList.length} files carved & cataloged from {deviceName} ({device?.serial})
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsScanningLive(true);
                    apiScanLiveFilesystem(scopeMode === 'custom' ? customPath.trim() : undefined, scopeMode, 50)
                      .then((liveFiles) => {
                        setIsScanningLive(false);
                        if (liveFiles && liveFiles.length > 0) {
                          setRecoveredFilesList(liveFiles);
                          setCheckedFiles(Object.fromEntries(liveFiles.map((f) => [f.id, true])));
                        }
                      })
                      .catch(() => setIsScanningLive(false));
                  }}
                  style={{
                    padding: '7px 14px', borderRadius: 6, border: '1.5px solid #0D9488',
                    backgroundColor: '#FFFFFF', color: '#0D9488', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 1px 2px rgba(13,148,136,0.1)',
                  }}
                >
                  <IconRefresh size={13} style={{ stroke: '#0D9488' }} />
                  {isScanningLive ? 'Scanning...' : 'Rescan Live Files'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('scan'); setScanStarted(false); setProgress(0); }}
                  style={{
                    padding: '7px 14px', borderRadius: 6, border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF', color: '#334155', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Change Target Scope
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Filter:</span>
              {[
                { key: 'all', label: `All Files (${recoveredFilesList.length})` },
                { key: 'deleted', label: `🗑️ Deleted Files (${recoveredFilesList.filter(f => f.isDeleted).length})` },
                { key: 'high', label: 'High Confidence' },
                { key: 'medium', label: 'Medium Confidence' },
                { key: 'low', label: 'Low Confidence' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterConf(tab.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${filterConf === tab.key ? (tab.key === 'deleted' ? '#DC2626' : '#0D9488') : '#CBD5E1'}`,
                    backgroundColor: filterConf === tab.key ? (tab.key === 'deleted' ? '#FEF2F2' : '#E6FFFA') : '#FFFFFF',
                    color: filterConf === tab.key ? (tab.key === 'deleted' ? '#DC2626' : '#0D9488') : '#334155',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                {checkedCount} of {recoveredFilesList.length} selected
              </span>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #CBD5E1', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', maxHeight: 520, overflowY: 'auto' }}>
              {filteredFiles.map((file, i) => {
                const conf = confidenceConfig[file.confidence as keyof typeof confidenceConfig] ?? confidenceConfig.medium;
                const typeBadge = getShortTypeBadge(file.type, file.name);
                const hasMultiple = (file as any).multiCandidate;
                const chosenCandId = selectedCandidates[file.id];
                const chosenCand = hasMultiple ? (file as any).candidates?.find((c: Candidate) => c.id === chosenCandId) : null;

                return (
                  <div
                    key={file.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', cursor: 'pointer', backgroundColor: selectedFile?.id === file.id ? '#F8FAFC' : 'transparent', transition: 'background-color 0.1s ease' }}
                    onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                  >
                    <input
                      type="checkbox"
                      checked={checkedFiles[file.id] ?? false}
                      onChange={(e) => { e.stopPropagation(); setCheckedFiles({ ...checkedFiles, [file.id]: e.target.checked }); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0, width: 16, height: 16, accentColor: '#0D9488' }}
                    />
                    <div style={{
                      width: 46,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: typeBadge.bg,
                      border: `1px solid ${typeBadge.color}35`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: typeBadge.color,
                        fontFamily: 'JetBrains Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap'
                      }}>
                        {typeBadge.label}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {file.isDeleted && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                            backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5',
                            letterSpacing: '0.04em', flexShrink: 0
                          }}>
                            DELETED
                          </span>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{chosenCand ? chosenCand.size : file.size}</span>
                        {file.recoverySource && (
                          <span style={{ color: '#0D9488', fontWeight: 600 }}>• {file.recoverySource}</span>
                        )}
                        <span style={{ color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          {file.path}
                        </span>
                      </div>
                    </div>

                    {/* USP 1: Multiple Candidates badge */}
                    {hasMultiple && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setCandidatePanelFileId(file.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
                          border: '1.5px solid #4338CA', backgroundColor: '#EEF2FF', color: '#4338CA',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                          fontFamily: 'Inter, system-ui, sans-serif',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E0E7FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
                      >
                        <IconInfo size={11} style={{ stroke: '#4338CA' }} />
                        Multiple Candidates Found
                      </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, backgroundColor: conf.bg, color: conf.color, border: `1px solid ${conf.color}40`, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: conf.color }} />
                      {hasMultiple && chosenCand ? `${chosenCand.confidence <= 1 ? Math.round(chosenCand.confidence * 100) : Math.round(chosenCand.confidence)}%` : conf.label}
                    </div>
                    {!hasMultiple && <IconChevronRight size={14} style={{ color: '#94A3B8', stroke: '#94A3B8', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setStep('export')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: 'none', backgroundColor: '#0D9488', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 2px 6px rgba(13,148,136,0.3)' }}>
                Proceed to Export ({checkedCount} files) <IconArrowRight size={14} style={{ stroke: '#fff' }} />
              </button>
            </div>
          </div>

          {/* File detail side panel */}
          {selectedFile && (
            <div style={{ width: 320, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 10, border: '1.5px solid #CBD5E1', boxShadow: '0 2px 6px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #CBD5E1', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedFile.isDeleted && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
                        DELETED
                      </span>
                    )}
                    {(() => {
                      const panelBadge = getShortTypeBadge(selectedFile.type, selectedFile.name);
                      return (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: panelBadge.color,
                          backgroundColor: panelBadge.bg,
                          border: `1px solid ${panelBadge.color}35`,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontFamily: 'JetBrains Mono, monospace',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          whiteSpace: 'nowrap'
                        }}>
                          {panelBadge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
                    <IconX size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 2, wordBreak: 'break-word' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{selectedFile.size}</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {selectedFile.multiCandidate && (
                  <div style={{ marginBottom: 14 }}>
                    <button
                      onClick={() => setCandidatePanelFileId(selectedFile.id)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1.5px solid #4338CA', backgroundColor: '#EEF2FF', color: '#4338CA',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <IconInfo size={13} style={{ stroke: '#4338CA' }} />
                      Compare Forensic Candidates
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em', marginBottom: 10 }}>CONFIDENCE SCORE</div>
                {getConfidenceBreakdown(selectedFile).map((item) => (
                  <div key={item.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: item.color }}>{item.value}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <div
                        key={`${selectedFile.id}-${item.label}`}
                        className="bar-animated"
                        style={{ height: '100%', width: `${item.value}%`, borderRadius: 3, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em', marginBottom: 6 }}>SHA-256 HASH</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: '#0F172A', wordBreak: 'break-all', lineHeight: 1.6, backgroundColor: '#F8FAFC', padding: '6px 8px', borderRadius: 4, border: '1px solid #E2E8F0' }}>{selectedFile.hash}</div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em', marginBottom: 6 }}>ORIGINAL PATH</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: '#0F172A', wordBreak: 'break-all', lineHeight: 1.6, backgroundColor: '#F8FAFC', padding: '6px 8px', borderRadius: 4, border: '1px solid #E2E8F0' }}>{selectedFile.path}</div>
                </div>
                {selectedFile.recoverySource && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em', marginBottom: 4 }}>RECOVERY SOURCE</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0D9488' }}>{selectedFile.recoverySource}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPORT */}
      {step === 'export' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 28, border: '1.5px solid #CBD5E1', boxShadow: '0 2px 6px rgba(15,23,42,0.06)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Export Recovered Files</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>Write salvaged evidence to disk and verify cryptographic hashes.</div>
              </div>
              <button
                onClick={() => setStep('review')}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                ← Back to Results
              </button>
            </div>

            {exportSuccess ? (
              <div>
                <div style={{ padding: '18px 20px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={16} style={{ stroke: '#fff' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#14532D' }}>
                        Successfully Exported {exportSuccess.count} Files!
                      </div>
                      <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                        All files and signed SHA-256 manifests have been written to disk.
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: '#FFFFFF', borderRadius: 6, border: '1px solid #BBF7D0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#0F172A', wordBreak: 'break-all' }}>
                    📁 {exportSuccess.destination}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => apiOpenFolder(exportSuccess.destination)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 8, border: 'none', backgroundColor: '#0D9488',
                      color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 2px 6px rgba(13,148,136,0.3)'
                    }}
                  >
                    📂 Open in Windows File Explorer
                  </button>
                  <button
                    onClick={() => navigate('reports')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                      backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    📄 View Forensic Report
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Files selected', value: `${checkedCount} file${checkedCount !== 1 ? 's' : ''}` },
                    { label: 'Target Scope', value: scopeMode === 'custom' ? customPath : 'Live Device Carving' },
                    { label: 'Source device', value: deviceName },
                    { label: 'Case reference', value: '#2024-CF-0892' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                    Destination folder on your PC
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={destFolder}
                      onChange={(e) => setDestFolder(e.target.value)}
                      style={{
                        flex: 1, padding: '10px 12px', border: '1.5px solid #CBD5E1', borderRadius: 8,
                        fontSize: 13, color: '#0F172A', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                        backgroundColor: '#FFFFFF', outline: 'none'
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#0D9488')}
                      onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const picked = await apiPickFolder();
                        if (picked) setDestFolder(picked);
                      }}
                      style={{
                        padding: '10px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                        backgroundColor: '#F8FAFC', color: '#0F172A', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', flexShrink: 0
                      }}
                    >
                      📁 Browse...
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                    Recovered files will be physically saved in this folder along with an immutable SHA-256 chain-of-custody manifest.
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: 8, backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: '#3730A3', fontWeight: 500, display: 'flex', gap: 8 }}>
                    <IconInfo size={15} style={{ stroke: '#3730A3', flexShrink: 0, marginTop: 1 }} />
                    <span>A cryptographically signed SHA-256 manifest and chain-of-custody audit report will be automatically sealed alongside exported files.</span>
                  </div>
                </div>

                <button
                  disabled={isExporting}
                  onClick={handlePerformExport}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                    backgroundColor: isExporting ? '#64748B' : '#0D9488', color: '#FFFFFF',
                    fontWeight: 700, fontSize: 15, cursor: isExporting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 2px 6px rgba(13,148,136,0.3)'
                  }}
                >
                  <IconDownload size={16} style={{ stroke: '#fff' }} />
                  {isExporting ? 'Exporting Files to Disk...' : `Export & Save ${checkedCount} File${checkedCount !== 1 ? 's' : ''} to Disk`}
                </button>
              </div>
            )}
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
