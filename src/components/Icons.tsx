interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const base = (size: number, sw = 1.75, style?: React.CSSProperties) => ({
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...style,
});

export const IconHome = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" />
    <path d="M9 21V13h6v8" />
  </svg>
);

export const IconHardDrive = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <rect x="2" y="7" width="20" height="13" rx="2" />
    <path d="M6 14h.01M10 14h.01" />
    <path d="M6 4l-4 3M18 4l4 3" />
    <circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSearch = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="M17 17l4 4" />
  </svg>
);

export const IconShieldLock = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M12 2L4 5.5v6c0 5 3.5 9.3 8 10 4.5-.7 8-5 8-10v-6L12 2z" />
    <rect x="9" y="12" width="6" height="5" rx="1" />
    <path d="M12 12v-1.5a1.5 1.5 0 00-3 0V12" />
  </svg>
);

export const IconShieldCheck = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M12 2L4 5.5v6c0 5 3.5 9.3 8 10 4.5-.7 8-5 8-10v-6L12 2z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconDocument = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
);

export const IconFolder = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293L11.707 6.7A1 1 0 0012.414 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

export const IconGear = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

export const IconPlus = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevronRight = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconChevronDown = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronUp = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

export const IconCheck = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const IconX = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const IconAlertTriangle = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconInfo = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const IconClock = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export const IconDownload = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const IconUser = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <circle cx="12" cy="7" r="4" />
    <path d="M4 21v-1a8 8 0 0116 0v1" />
  </svg>
);

export const IconFilter = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);

export const IconPause = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const IconArrowRight = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const IconRefresh = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

export const IconLock = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

export const IconDatabase = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

export const IconLink = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

export const IconEye = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconExport = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

export const IconBarChart = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

export const IconToggleLeft = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <rect x="1" y="5" width="22" height="14" rx="7" />
    <circle cx="8" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconToggleRight = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <rect x="1" y="5" width="22" height="14" rx="7" />
    <circle cx="16" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCertificate = ({ className, size = 20, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
    <path d="M14 2v6h6M9 15l2 2 4-4" />
  </svg>
);

export const IconActivity = ({ className, size = 16, strokeWidth, style }: IconProps) => (
  <svg viewBox="0 0 24 24" style={base(size, strokeWidth, style)} className={className}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
