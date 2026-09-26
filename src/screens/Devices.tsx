import { useState, useEffect } from 'react';
import { Device, Screen } from '../types';
import { apiListDevices } from '../api';
import {
  IconHardDrive, IconChevronRight, IconChevronDown, IconInfo, IconArrowRight, IconRefresh, IconShieldCheck, IconAlertTriangle
} from '../components/Icons';

interface DevicesProps {
  navigate: (screen: Screen) => void;
  onSelectDevice: (device: Device) => void;
}

const fallbackDevices: Device[] = [
  {
    id: 'dev-0',
    name: 'WD PC SN810 SDCPNRY-512G-1006',
    type: 'SSD',
    capacity: '476.94 GB',
    capacityBytes: 512105932800,
    interface: 'NVMe',
    model: 'WD PC SN810 SDCPNRY-512G-1006',
    serial: 'E823_8FA6_BF53_0001_001B_448B_4A85_2466',
    partitions: [
      { label: 'C: (Operating System)', size: '310.41 GB', fs: 'NTFS' },
      { label: 'D: (REFORGE Workspace)', size: '146.48 GB', fs: 'NTFS' },
      { label: 'Recovery Environment', size: '0.84 GB', fs: 'RAW' },
    ],
    encrypted: false,
    hiddenArea: false,
    isSystemDrive: true,
    firmwareStatus: 'verified',
  },
];

const deviceTypeIcon = (type: Device['type']) => {
  if (type === 'USB') return '🔌';
  if (type === 'SD') return '💳';
  if (type === 'SSD') return '⚡';
  return '💾';
};

// USP 3a — firmware badge config
const firmwareBadgeConfig = {
  verified: {
    label: 'Firmware: Verified Reliable',
    bg: '#EDFAF3',
    color: '#2E9E5B',
    Icon: IconShieldCheck,
  },
  unverified: {
    label: 'Firmware: Unverified',
    bg: '#FEF8EC',
    color: '#B8862E',
    Icon: IconInfo,
  },
  unreliable: {
    label: 'Firmware: Known Unreliable',
    bg: '#FEF2F3',
    color: '#C6394A',
    Icon: IconAlertTriangle,
  },
};

interface DeviceCardProps {
  device: Device;
  isSelected: boolean;
  onSelect: () => void;
}

function DeviceCard({ device, isSelected, onSelect }: DeviceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const fwCfg = device.firmwareStatus ? firmwareBadgeConfig[device.firmwareStatus] : null;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        border: `2px solid ${isSelected ? '#0D9488' : '#CBD5E1'}`,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? '0 0 0 3px rgba(13,148,136,0.18)' : '0 1px 3px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          padding: '18px 20px',
          cursor: 'pointer',
          display: 'flex', gap: 16, alignItems: 'flex-start',
        }}
        onClick={() => onSelect()}
      >
        {/* Device icon */}
        <div
          style={{
            width: 44, height: 44, borderRadius: 10,
            backgroundColor: isSelected ? '#E6FFFA' : '#F1F5F9',
            border: `1px solid ${isSelected ? '#99F6E4' : '#E2E8F0'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          {deviceTypeIcon(device.type)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{device.name}</span>
            {device.isSystemDrive && (
              <span
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                  backgroundColor: '#F1F5F9', color: '#1E293B', border: '1px solid #94A3B8',
                }}
              >
                System Drive
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#334155', fontWeight: 500 }}>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{device.capacity}</span>
            <span>·</span>
            <span>{device.interface}</span>
            <span>·</span>
            <span>{device.type}</span>
          </div>

          {/* Badges row */}
          {(device.encrypted || device.hiddenArea || fwCfg) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {device.encrypted && (
                <span
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                    backgroundColor: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <IconInfo size={11} style={{ stroke: '#3730A3' }} />
                  Encrypted Volume Found
                </span>
              )}
              {device.hiddenArea && (
                <span
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                    backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <IconInfo size={11} style={{ stroke: '#92400E' }} />
                  Hidden Area (HPA/DCO) Detected
                </span>
              )}
              {/* USP 3a: Firmware badge */}
              {fwCfg && (
                <span
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                    backgroundColor: fwCfg.bg, color: fwCfg.color, border: `1px solid ${fwCfg.color}40`,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <fwCfg.Icon size={11} style={{ stroke: fwCfg.color }} />
                  {fwCfg.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Selection indicator */}
        <div
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${isSelected ? '#0D9488' : '#94A3B8'}`,
            backgroundColor: isSelected ? '#0D9488' : '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s ease',
          }}
        >
          {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />}
        </div>
      </div>

      {/* Expandable details */}
      <div style={{ borderTop: '1px solid #E2E8F0' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC', border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
            transition: 'background-color 0.1s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
        >
          {expanded ? <IconChevronDown size={14} style={{ stroke: '#334155' }} /> : <IconChevronRight size={14} style={{ stroke: '#334155' }} />}
          <span>Device Details & Partitions</span>
        </button>

        {expanded && (
          <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 0', fontSize: 13 }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Model</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>{device.model}</span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Serial No.</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#0F172A', fontWeight: 600 }}>
                {device.serial}
              </span>
              <span style={{ color: '#475569', fontWeight: 600 }}>Interface</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>{device.interface}</span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8, letterSpacing: '0.04em' }}>
                PARTITIONS & VOLUMES
              </div>
              {device.partitions.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{p.label}</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>{p.size}</span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', padding: '2px 7px',
                      borderRadius: 4, backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1',
                      color: '#1E293B', fontWeight: 600, fontSize: 11,
                    }}>
                      {p.fs}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {device.isSystemDrive && (
              <div
                style={{
                  marginTop: 14, padding: '10px 14px', borderRadius: 8,
                  backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                  fontSize: 13, color: '#1E40AF', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}
              >
                <IconShieldCheck size={16} style={{ stroke: '#2563EB', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontWeight: 600, color: '#1E3A8A' }}>Host System Drive (Live OS): </strong>
                  Selected for safe, read-only forensic file recovery and artifact carving. Destructive disk sanitization is prohibited on the active boot disk.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Devices({ navigate, onSelectDevice }: DevicesProps) {
  const [deviceList, setDeviceList] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const real = await apiListDevices();
      if (real && real.length > 0) {
        setDeviceList(real);
      } else {
        setDeviceList(fallbackDevices);
      }
    } catch (e) {
      console.warn("Failed to load real devices, using fallback:", e);
      setDeviceList(fallbackDevices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const selectedDevice = deviceList.find((d) => d.id === selectedId);

  const handleProceed = () => {
    if (selectedDevice) {
      onSelectDevice(selectedDevice);
      navigate('operation-choice');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Devices
          </div>
          <div style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginTop: 4 }}>
            Connected physical drives detected in real-time.
          </div>
        </div>
        <button
          onClick={loadDevices}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
            borderRadius: 8, border: '1.5px solid #CBD5E1', backgroundColor: '#FFFFFF',
            color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
            transition: 'background-color 0.1s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
        >
          <IconRefresh size={14} style={{ stroke: '#0F172A', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Scanning Hardware…' : 'Refresh Devices'}
        </button>
      </div>

      {/* Connected count */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: loading ? '#D97706' : '#16A34A', boxShadow: loading ? '0 0 0 2px rgba(217,119,6,0.2)' : '0 0 0 2px rgba(22,163,74,0.2)' }} />
        {loading ? (
          'Scanning physical interfaces and disk buses…'
        ) : (
          `${deviceList.length} physical device(s) online · ${deviceList.reduce((acc, d) => acc + (d.partitions?.length || 0), 0)} active volume partition(s)`
        )}
      </div>

      {/* Device grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginBottom: 24 }}>
        {deviceList.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            isSelected={selectedId === device.id}
            onSelect={() => setSelectedId(selectedId === device.id ? null : device.id)}
          />
        ))}
      </div>

      {/* Action footer */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', backgroundColor: '#FFFFFF', borderRadius: 10,
          border: '1.5px solid #CBD5E1',
          boxShadow: '0 2px 4px rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>
          {selectedDevice ? (
            <>
              Selected: <strong style={{ color: '#0F172A', fontWeight: 700 }}>{selectedDevice.name}</strong> ({selectedDevice.capacity})
              {selectedDevice.isSystemDrive && <span style={{ marginLeft: 8, color: '#2563EB', fontWeight: 600 }}>— Read-Only Forensic Mode</span>}
            </>
          ) : (
            'Select a device to proceed to Recovery or Sanitization'
          )}
        </div>
        <button
          onClick={handleProceed}
          disabled={!selectedDevice}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
            borderRadius: 8, border: 'none',
            backgroundColor: selectedDevice ? '#0D9488' : '#E2E8F0',
            color: selectedDevice ? '#FFFFFF' : '#64748B',
            fontWeight: 700, fontSize: 14, cursor: selectedDevice ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: selectedDevice ? '0 2px 6px rgba(13,148,136,0.3)' : 'none',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => { if (selectedDevice) e.currentTarget.style.backgroundColor = '#0F766E'; }}
          onMouseLeave={(e) => { if (selectedDevice) e.currentTarget.style.backgroundColor = '#0D9488'; }}
        >
          Select This Device
          <IconArrowRight size={15} style={{ stroke: selectedDevice ? '#fff' : '#64748B' }} />
        </button>
      </div>
    </div>
  );
}
