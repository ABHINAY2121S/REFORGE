import { useState } from 'react';
import { Device, Screen } from '../types';
import {
  IconHardDrive, IconChevronRight, IconChevronDown, IconInfo, IconArrowRight, IconRefresh, IconShieldCheck, IconAlertTriangle
} from '../components/Icons';

interface DevicesProps {
  navigate: (screen: Screen) => void;
  onSelectDevice: (device: Device) => void;
}

const devices: Device[] = [
  {
    id: 'dev-1',
    name: 'Seagate Barracuda 2TB',
    type: 'HDD',
    capacity: '2.00 TB',
    capacityBytes: 2000398934016,
    interface: 'SATA',
    model: 'ST2000DM008-2FR102',
    serial: 'WF2096DW',
    partitions: [
      { label: 'NTFS Primary', size: '1.80 TB', fs: 'NTFS' },
      { label: 'Recovery (OEM)', size: '0.20 TB', fs: 'FAT32' },
    ],
    encrypted: false,
    hiddenArea: true,
    firmwareStatus: 'verified',
  },
  {
    id: 'dev-2',
    name: 'Samsung 970 EVO NVMe',
    type: 'SSD',
    capacity: '1.00 TB',
    capacityBytes: 1000204886016,
    interface: 'NVMe',
    model: 'Samsung SSD 970 EVO 1TB',
    serial: 'S4EWNG0N512034F',
    partitions: [
      { label: 'EFI System', size: '0.26 GB', fs: 'FAT32' },
      { label: 'Windows (C:)', size: '920 GB', fs: 'NTFS' },
      { label: 'WinRE Tools', size: '0.56 GB', fs: 'NTFS' },
    ],
    encrypted: true,
    hiddenArea: false,
    isSystemDrive: true,
    firmwareStatus: 'verified',
  },
  {
    id: 'dev-3',
    name: 'SanDisk Ultra USB 3.2',
    type: 'USB',
    capacity: '128 GB',
    capacityBytes: 128000000000,
    interface: 'USB 3.2',
    model: 'SanDisk Ultra USB 3.2 Gen 1',
    serial: '4C5313AA00981BBA',
    partitions: [
      { label: 'USB Drive (F:)', size: '128 GB', fs: 'FAT32' },
    ],
    encrypted: false,
    hiddenArea: false,
    firmwareStatus: 'unverified',
  },
  {
    id: 'dev-4',
    name: 'Kingston Canvas microSD',
    type: 'SD',
    capacity: '64 GB',
    capacityBytes: 64000000000,
    interface: 'microSD',
    model: 'Kingston SDCE/64GB',
    serial: 'KNG064GSD1',
    partitions: [
      { label: 'Media Storage', size: '64 GB', fs: 'exFAT' },
    ],
    encrypted: false,
    hiddenArea: false,
    firmwareStatus: 'unreliable',
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
        border: `1.5px solid ${isSelected ? '#1E8F7A' : '#DDE3EA'}`,
        overflow: 'hidden',
        opacity: device.isSystemDrive ? 0.6 : 1,
        transition: 'border-color 0.15s ease',
        boxShadow: isSelected ? '0 0 0 3px rgba(30,143,122,0.12)' : '0 1px 2px rgba(16,21,27,0.06)',
      }}
    >
      <div
        style={{
          padding: '18px 20px',
          cursor: device.isSystemDrive ? 'not-allowed' : 'pointer',
          display: 'flex', gap: 16, alignItems: 'flex-start',
        }}
        onClick={() => !device.isSystemDrive && onSelect()}
      >
        {/* Device icon */}
        <div
          style={{
            width: 44, height: 44, borderRadius: 10,
            backgroundColor: isSelected ? '#E8F5F2' : '#F5F7FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
            transition: 'background-color 0.15s ease',
          }}
        >
          {deviceTypeIcon(device.type)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>{device.name}</span>
            {device.isSystemDrive && (
              <span
                style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 4,
                  backgroundColor: '#F5F7FA', color: '#647184', border: '1px solid #DDE3EA',
                }}
              >
                System Drive
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#647184' }}>
            <span>{device.capacity}</span>
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
                    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                    backgroundColor: '#EEF0FB', color: '#4C5FC7',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <IconInfo size={11} style={{ stroke: '#4C5FC7' }} />
                  Encrypted Volume Found
                </span>
              )}
              {device.hiddenArea && (
                <span
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                    backgroundColor: '#FEF8EC', color: '#B8862E',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <IconInfo size={11} style={{ stroke: '#B8862E' }} />
                  Hidden Area (HPA/DCO) Detected
                </span>
              )}
              {/* USP 3a: Firmware badge */}
              {fwCfg && (
                <span
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                    backgroundColor: fwCfg.bg, color: fwCfg.color,
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
        {!device.isSystemDrive && (
          <div
            style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${isSelected ? '#1E8F7A' : '#DDE3EA'}`,
              backgroundColor: isSelected ? '#1E8F7A' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s ease',
            }}
          >
            {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff' }} />}
          </div>
        )}
      </div>

      {/* Expandable details */}
      <div style={{ borderTop: '1px solid #F0F3F6' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', padding: '9px 20px', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#647184', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
          }}
        >
          {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
          <span>Device Details</span>
        </button>

        {expanded && (
          <div style={{ padding: '4px 20px 16px', borderTop: '1px solid #F0F3F6' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#647184' }}>Model</span>
              <span style={{ color: '#1A2330' }}>{device.model}</span>
              <span style={{ color: '#647184' }}>Serial No.</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#1A2330' }}>
                {device.serial}
              </span>
              <span style={{ color: '#647184' }}>Interface</span>
              <span style={{ color: '#1A2330' }}>{device.interface}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#647184', marginBottom: 6 }}>
                PARTITIONS
              </div>
              {device.partitions.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderTop: i > 0 ? '1px solid #F0F3F6' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#1A2330' }}>{p.label}</span>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#647184' }}>
                    <span>{p.size}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{p.fs}</span>
                  </div>
                </div>
              ))}
            </div>

            {device.isSystemDrive && (
              <div
                style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  backgroundColor: '#F5F7FA', border: '1px solid #DDE3EA',
                  fontSize: 13, color: '#647184',
                }}
              >
                This is your active system drive and cannot be selected for operations.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Devices({ navigate, onSelectDevice }: DevicesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedId);

  const handleProceed = () => {
    if (selectedDevice) {
      onSelectDevice(selectedDevice);
      navigate('operation-choice');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>
            Devices
          </div>
          <div style={{ fontSize: 14, color: '#647184', marginTop: 4 }}>
            Select a storage device to begin an operation.
          </div>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
            borderRadius: 8, border: '1px solid #DDE3EA', backgroundColor: '#FFFFFF',
            color: '#647184', fontSize: 13, cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'background-color 0.1s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F5F7FA')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
        >
          <IconRefresh size={14} />
          Refresh Devices
        </button>
      </div>

      {/* Connected count */}
      <div style={{ fontSize: 13, color: '#647184', marginBottom: 16 }}>
        {devices.length} devices detected — {devices.filter(d => !d.isSystemDrive).length} available for operations
      </div>

      {/* Device grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
        {devices.map((device) => (
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
          padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: 10,
          border: '1px solid #DDE3EA',
        }}
      >
        <div style={{ fontSize: 13, color: '#647184' }}>
          {selectedDevice
            ? <>Selected: <strong style={{ color: '#1A2330' }}>{selectedDevice.name}</strong></>
            : 'No device selected'}
        </div>
        <button
          onClick={handleProceed}
          disabled={!selectedDevice}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 8, border: 'none',
            backgroundColor: selectedDevice ? '#1E8F7A' : '#DDE3EA',
            color: selectedDevice ? '#FFFFFF' : '#B0BAC9',
            fontWeight: 600, fontSize: 14, cursor: selectedDevice ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => { if (selectedDevice) e.currentTarget.style.backgroundColor = '#178269'; }}
          onMouseLeave={(e) => { if (selectedDevice) e.currentTarget.style.backgroundColor = '#1E8F7A'; }}
        >
          Select This Device
          <IconArrowRight size={15} style={{ stroke: selectedDevice ? '#fff' : '#B0BAC9' }} />
        </button>
      </div>
    </div>
  );
}
