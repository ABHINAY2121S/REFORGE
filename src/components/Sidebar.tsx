import { Screen, UserRole } from '../types';
import {
  IconHome, IconHardDrive, IconSearch, IconShieldLock, IconShieldCheck,
  IconDocument, IconFolder, IconGear, IconUser
} from './Icons';
import reforgeLogoUrl from '../assets/reforge-logo.png';

interface SidebarProps {
  currentScreen: Screen;
  navigate: (screen: Screen) => void;
  userRole: UserRole;
  userName: string;
}

interface NavItem {
  screen: Screen;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
}

const roleColors: Record<UserRole, string> = {
  Investigator: '#1E8F7A',
  Auditor: '#B8862E',
};

export default function Sidebar({ currentScreen, navigate, userRole, userName }: SidebarProps) {
  const activeScreen = ['operation-choice', 'file-scope', 'recovery', 'erase'].includes(currentScreen)
    ? 'devices'
    : currentScreen;

  const navItems: NavItem[] = userRole === 'Investigator' 
    ? [
        { screen: 'dashboard', label: 'Dashboard', Icon: IconHome },
        { screen: 'devices', label: 'Devices', Icon: IconHardDrive },
        { screen: 'recovery', label: 'Recovery', Icon: IconSearch },
        { screen: 'erase', label: 'Erase', Icon: IconShieldLock },
        { screen: 'verification', label: 'Verification', Icon: IconShieldCheck },
        { screen: 'reports', label: 'Reports & Certificates', Icon: IconDocument },
        { screen: 'audit', label: 'Audit Trail', Icon: IconShieldCheck },
        { screen: 'cases', label: 'Case Management', Icon: IconFolder },
      ]
    : [
        { screen: 'dashboard', label: 'Dashboard', Icon: IconHome },
        { screen: 'verification', label: 'Verification', Icon: IconShieldCheck },
        { screen: 'reports', label: 'Reports & Certificates', Icon: IconDocument },
        { screen: 'audit', label: 'Audit Trail', Icon: IconShieldCheck },
        { screen: 'cases', label: 'Case Management', Icon: IconFolder },
      ];

  return (
    <aside
      className="sidebar-no-print"
      style={{
        width: 240,
        minWidth: 240,
        backgroundColor: '#EEF1F5',
        borderRight: '1px solid #DDE3EA',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #DDE3EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={reforgeLogoUrl}
          alt="REFORGE — Forensic Recovery & Sanitization"
          style={{ width: 160, height: 'auto', display: 'block' }}
        />
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
        {navItems.map(({ screen, label, Icon }) => {
          const isActive = activeScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => navigate(screen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#1A2330' : '#647184',
                fontWeight: isActive ? 500 : 400,
                fontSize: 14,
                textAlign: 'left',
                marginBottom: 2,
                boxShadow: isActive ? '0 1px 2px rgba(16,21,27,0.06)' : 'none',
                transition: 'background-color 0.1s ease, color 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.6)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#1A2330';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#647184';
                }
              }}
            >
              <Icon
                size={17}
                className={isActive ? 'text-teal' : undefined}
                {...(isActive ? { style: { color: '#1E8F7A' } } : {})}
              />
              <span style={{ color: isActive ? '#1A2330' : 'inherit' }}>{label}</span>
            </button>
          );
        })}

        <div style={{ height: 1, backgroundColor: '#DDE3EA', margin: '10px 4px' }} />

        <button
          onClick={() => navigate('settings')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeScreen === 'settings' ? '#FFFFFF' : 'transparent',
            color: activeScreen === 'settings' ? '#1A2330' : '#647184',
            fontWeight: activeScreen === 'settings' ? 500 : 400,
            fontSize: 14,
            textAlign: 'left',
            marginBottom: 2,
            transition: 'background-color 0.1s ease, color 0.1s ease',
          }}
          onMouseEnter={(e) => {
            if (activeScreen !== 'settings') {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.6)';
              (e.currentTarget as HTMLButtonElement).style.color = '#1A2330';
            }
          }}
          onMouseLeave={(e) => {
            if (activeScreen !== 'settings') {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#647184';
            }
          }}
        >
          <IconGear size={17} {...(activeScreen === 'settings' ? { style: { color: '#1E8F7A' } } : {})} />
          <span>Settings</span>
        </button>
      </nav>

      {/* User info */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #DDE3EA' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: `${roleColors[userRole]}15`,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: roleColors[userRole],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: roleColors[userRole] }}>
            {userRole}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#DDE3EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconUser size={14} className="text-muted" style={{ color: '#647184' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330' }}>{userName}</div>
            <div style={{ fontSize: 11, color: '#647184' }}>Logged in</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
