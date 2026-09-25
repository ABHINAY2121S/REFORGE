/**
 * REFORGE App shell.
 *
 * Auth flow (Phase 1):
 *   On mount → needs_first_run() → first-run setup screen OR login screen.
 *   On login → real apiLogin() to Python sidecar.
 *   On success → store session, navigate to dashboard.
 *
 * All other navigation uses the same prototype-derived navigate() pattern.
 * The mock login in Login.tsx still works for dev/design — it calls onLogin
 * with role+name, which this file accepts. When IS_TAURI is true we
 * additionally validate against the real sidecar.
 */

import { useState, useEffect } from 'react';
import { AppState, Device, OperationType, OperationScope, Screen, Session, UserRole } from './types';
import { apiNeedsFirstRun, apiLogin, apiSetupFirstAccount } from './api';
import Sidebar from './components/Sidebar';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Devices from './screens/Devices';
import OperationChoice from './screens/OperationChoice';
import Recovery from './screens/Recovery';
import Erase from './screens/Erase';
import FileScopeSelector from './screens/FileScopeSelector';
import Verification from './screens/Verification';
import Audit from './screens/Audit';
import Cases from './screens/Cases';
import Settings from './screens/Settings';

declare global {
  interface Window { __TAURI__?: unknown; }
}

const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI__;

const initialState: AppState = {
  isLoggedIn: false,
  currentScreen: 'login',
  userRole: 'Investigator',
  userName: '',
  activeCaseName: 'Case #2024-CF-0892: State v. Meridian Corp',
};

type AuthPhase = 'checking' | 'first-run' | 'login' | 'app';

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking');
  // session stored for future role-gating; currently auth is role-based via UserRole string
  const [_session, setSession] = useState<Session | null>(null); // eslint-disable-line
  const [authError, setAuthError] = useState<string>('');

  // ── Bootstrap: check if first-run setup is required ──────────────────────
  useEffect(() => {
    if (!IS_TAURI) {
      // Dev mode with no Tauri — go straight to login (mock login in Login.tsx works).
      setAuthPhase('login');
      return;
    }
    apiNeedsFirstRun()
      .then((needsSetup) => setAuthPhase(needsSetup ? 'first-run' : 'login'))
      .catch(() => setAuthPhase('login'));  // graceful degradation
  }, []);

  // ── Login handler — called by Login.tsx via onLogin prop ─────────────────
  const handleLogin = async (role: UserRole, name: string, password?: string) => {
    if (IS_TAURI && password) {
      setAuthError('');
      const result = await apiLogin(name, password);
      if (!result) {
        setAuthError('Invalid credentials');
        return;
      }
      const newSession: Session = {
        userId: result.id,
        username: result.username,
        role: result.role,
      };
      setSession(newSession);
    }
    // Map contract roles → UI roles (case-insensitive).
    const uiRole: UserRole = role.toLowerCase().startsWith('auditor') ? 'Auditor' : 'Investigator';
    setState((s) => ({
      ...s,
      isLoggedIn: true,
      userRole: uiRole,
      userName: name,
      currentScreen: 'dashboard',
    }));
    setAuthPhase('app');
  };

  // ── First-run account setup ───────────────────────────────────────────────
  const handleFirstRunSetup = async (
    username: string,
    password: string,
    role: 'investigator' | 'auditor'
  ) => {
    setAuthError('');
    try {
      if (IS_TAURI) {
        await apiSetupFirstAccount(username, password, role);
      }
      const uiRole: UserRole = role === 'auditor' ? 'Auditor' : 'Investigator';
      setState((s) => ({
        ...s,
        isLoggedIn: true,
        userRole: uiRole,
        userName: username,
        currentScreen: 'dashboard',
      }));
      setAuthPhase('app');
    } catch (e) {
      setAuthError(String(e));
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (screen: Screen) => {
    setState((s) => ({ ...s, currentScreen: screen }));
  };

  const handleSelectDevice = (device: Device) => {
    setState((s) => ({ ...s, selectedDevice: device }));
  };

  const handleChooseOperation = (type: OperationType, scope: OperationScope) => {
    setState((s) => ({ ...s, operationType: type, operationScope: scope }));
  };

  // ── Auth phase rendering ──────────────────────────────────────────────────
  if (authPhase === 'checking') {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
      }}>
        <span>Initialising…</span>
      </div>
    );
  }

  if (authPhase === 'first-run') {
    return (
      <FirstRunSetup onSetup={handleFirstRunSetup} error={authError} />
    );
  }

  if (authPhase === 'login' || !state.isLoggedIn) {
    return <Login onLogin={(role, name) => handleLogin(role, name)} authError={authError} />;
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar
        currentScreen={state.currentScreen}
        navigate={navigate}
        userRole={state.userRole}
        userName={state.userName}
      />

      <main className="app-main">
        {state.currentScreen === 'dashboard' && (
          <Dashboard
            navigate={navigate}
            userName={state.userName}
            activeCaseName={state.activeCaseName}
            userRole={state.userRole}
          />
        )}
        {(state.currentScreen === 'devices' || state.currentScreen === 'operation-choice') && (
          <Devices navigate={navigate} onSelectDevice={handleSelectDevice} />
        )}
        {state.currentScreen === 'file-scope' && (
          <FileScopeSelector
            device={state.selectedDevice}
            operationType={state.operationType ?? 'recovery'}
            navigate={navigate}
          />
        )}
        {state.currentScreen === 'recovery' && (
          <Recovery device={state.selectedDevice} navigate={navigate} />
        )}
        {state.currentScreen === 'erase' && (
          <Erase device={state.selectedDevice} navigate={navigate} />
        )}
        {state.currentScreen === 'verification' && (
          <Verification navigate={navigate} />
        )}
        {state.currentScreen === 'audit' && (
          <Audit navigate={navigate} />
        )}
        {state.currentScreen === 'cases' && (
          <Cases navigate={navigate} userRole={state.userRole} />
        )}
        {state.currentScreen === 'settings' && (
          <Settings navigate={navigate} userRole={state.userRole} />
        )}
      </main>

      {state.currentScreen === 'operation-choice' && state.selectedDevice && (
        <OperationChoice
          device={state.selectedDevice}
          navigate={navigate}
          onChoose={handleChooseOperation}
          onClose={() => navigate('devices')}
        />
      )}
    </div>
  );
}

// ── First-run setup screen ────────────────────────────────────────────────────

interface FirstRunProps {
  onSetup: (username: string, password: string, role: 'investigator' | 'auditor') => void;
  error: string;
}

function FirstRunSetup({ onSetup, error }: FirstRunProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'investigator' | 'auditor'>('investigator');
  const [localError, setLocalError] = useState('');

  const submit = () => {
    if (!username || !password) { setLocalError('Username and password are required.'); return; }
    if (password !== confirm)   { setLocalError('Passwords do not match.'); return; }
    if (password.length < 12)   { setLocalError('Password must be at least 12 characters.'); return; }
    setLocalError('');
    onSetup(username, password, role);
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
    }}>
      <div className="card" style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ color: 'var(--accent-teal)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            REFORGE — Initial Setup
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            No accounts exist yet. Create the first administrator account.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>USERNAME</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>PASSWORD (min 12 chars)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>CONFIRM PASSWORD</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>ROLE</span>
          <select value={role} onChange={(e) => setRole(e.target.value as 'investigator' | 'auditor')}>
            <option value="investigator">Investigator</option>
            <option value="auditor">Auditor</option>
          </select>
        </label>
        {(localError || error) && (
          <span style={{ color: 'var(--danger-red)', fontSize: 13 }}>{localError || error}</span>
        )}
        <button className="btn-primary" onClick={submit}>Create Account & Continue</button>
      </div>
    </div>
  );
}
