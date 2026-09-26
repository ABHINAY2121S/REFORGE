import { useState } from 'react';
import { UserRole } from '../types';
import { IconShieldCheck, IconEye } from '../components/Icons';

import reforgeLogoUrl from '../assets/reforge-logo.png';

interface LoginProps {
  onLogin: (role: UserRole, name: string) => void;
  authError?: string;
}

export default function Login({ onLogin, authError = '' }: LoginProps) {
  const [username, setUsername] = useState('demo_user');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleRoleLogin = (role: UserRole) => {
    if (!username.trim()) { setError('Username is required.'); return; }
    if (!password.trim()) { setError('Password is required.'); return; }
    onLogin(role, username.trim());
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #DDE3EA',
    borderRadius: 8,
    fontSize: 14,
    color: '#1A2330',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F5F7FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={reforgeLogoUrl}
            alt="REFORGE Forensic Recovery & Sanitization"
            style={{ width: 220, maxWidth: '80%', height: 'auto', display: 'inline-block', marginBottom: 6 }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 1px 3px rgba(16,21,27,0.08), 0 0 0 1px rgba(16,21,27,0.04)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2330', marginBottom: 6 }}>
            Sign in
          </div>
          <div style={{ fontSize: 13, color: '#647184', marginBottom: 24 }}>
            Access is restricted to authorized personnel.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1A2330', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              style={inputStyle}
              placeholder="Enter your username"
              autoComplete="username"
              onFocus={(e) => (e.target.style.borderColor = '#1E8F7A')}
              onBlur={(e) => (e.target.style.borderColor = '#DDE3EA')}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1A2330', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                style={{ ...inputStyle, paddingRight: 40 }}
                placeholder="Enter your password"
                autoComplete="current-password"
                onFocus={(e) => (e.target.style.borderColor = '#1E8F7A')}
                onBlur={(e) => (e.target.style.borderColor = '#DDE3EA')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#647184',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconEye size={16} />
              </button>
            </div>
          </div>

          {(error || authError) && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#FEF2F3',
                border: '1px solid #F9D0D4',
                color: '#C6394A',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error || authError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => handleRoleLogin('Investigator')}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #1E8F7A',
                backgroundColor: '#1E8F7A',
                color: '#FFFFFF',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#178269')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E8F7A')}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Continue as Forensic Investigator</div>
              <div style={{ fontSize: 12, color: '#A0DFD1', fontWeight: 400 }}>Perform recovery and erasure operations.</div>
            </button>

            <button
              onClick={() => handleRoleLogin('Auditor')}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #DDE3EA',
                backgroundColor: '#FFFFFF',
                color: '#1A2330',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F5F7FA')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Continue as Auditor</div>
              <div style={{ fontSize: 12, color: '#647184', fontWeight: 400 }}>Independently review results and reports.</div>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, fontWeight: 500, color: '#334155' }}>
          REFORGE v1.0.0 — Licensed for Forensic Operations
        </div>
      </div>
    </div>
  );
}
