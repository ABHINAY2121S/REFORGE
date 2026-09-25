# REFORGE — Setup Guide
# How to get from this folder to a running app (and eventually an MSI)

## Prerequisites

### 1. Install Rust toolchain (one-time, ~10 min)
```powershell
# Download and run rustup:
winget install Rustlang.Rustup
# Or: https://rustup.rs/
# After install, open a new terminal and verify:
rustc --version   # should print rustc 1.77.x or newer
cargo --version
```

### 2. Install Tauri v2 prerequisites (Windows-specific)
```powershell
# Tauri needs the MSVC C++ build tools + WebView2
# WebView2 is already on Windows 10 21H1+ / Windows 11 — nothing extra needed.
# MSVC build tools via Visual Studio Installer:
winget install Microsoft.VisualStudio.2022.BuildTools
# Or: https://aka.ms/vs/17/release/vs_BuildTools.exe
```

### 3. Verify Node + Python (already installed per session notes)
```powershell
node --version    # v22.x
python --version  # 3.13.x
```

---

## Python sidecar — install dependencies

```powershell
cd D:\My apps\REFORGE\reforge-app\python
pip install -r requirements.txt
# Note: pytsk3 and python-magic need native libs — see requirements.txt comments.
# For dev/testing, both degrade gracefully if absent (recovery layer falls back).
```

---

## Run in development mode

```powershell
cd D:\My apps\REFORGE\reforge-app
npm install                 # already done — skip if node_modules exists
npm run tauri dev           # builds Rust sidecar + starts Vite dev server
```

The first Rust build takes 3-5 minutes. Subsequent builds are cached.

---

## Build the production MSI

```powershell
cd D:\My apps\REFORGE\reforge-app
# Bundle the Python sidecar first:
python -m PyInstaller `
  --onefile --noconsole `
  --name reforge-python `
  --distpath src-tauri/binaries `
  python/main.py
# Then build the Tauri MSI:
npm run tauri build
# Output: src-tauri/target/release/bundle/msi/REFORGE_0.1.0_x64_en-US.msi
```

### Code signing (production)
```json
// In src-tauri/tauri.conf.json, set:
"certificateThumbprint": "<your Authenticode thumbprint>"
```

---

## Project layout

```
reforge-app/
├── index.html              ← App entry HTML
├── package.json            ← npm deps (React 19, Tauri v2)
├── tsconfig.json           ← TypeScript config
├── vite.config.ts          ← Vite + Tauri dev server
│
├── src/                    ← React frontend
│   ├── App.tsx             ← Root: auth flow + screen routing
│   ├── api.ts              ← ALL frontend → sidecar calls (typed wrappers)
│   ├── types.ts            ← Shared types (Screen, Device, Session, etc.)
│   ├── index.css           ← Design system tokens + global styles
│   ├── screens/            ← 11 screens from Figma prototype
│   ├── components/         ← Sidebar, Icons
│   └── audit-reports/      ← Audit & Reports screen (real 5-tab component)
│       ├── api/            ← reforgeAuditApi.ts (Tauri v2 invoke, with mock fallback)
│       ├── components/     ← StatusStrip, StatusPill, DetailPanel
│       ├── hooks/          ← useAuditData, useHashChainStatus
│       ├── tabs/           ← AuditLog, ChainOfCustody, ActivityTimeline, IntegrityCheck, ReportGeneration
│       └── types/          ← audit.ts (ActionResult, AuditLogEntry, etc.)
│
├── src-tauri/              ← Rust/Tauri layer
│   ├── Cargo.toml          ← Rust deps (tauri 2.5, serde, tauri-plugin-shell)
│   ├── tauri.conf.json     ← Window config, CSP, sidecar declaration
│   └── src/
│       ├── main.rs         ← App entry (Tauri builder)
│       └── lib.rs          ← Sidecar bridge (invoke_python command)
│
└── python/                 ← Python sidecar
    ├── main.py             ← JSON-RPC dispatcher (stdin/stdout loop)
    ├── requirements.txt    ← All three modules' deps, unified + pinned
    ├── reforge_core.py     ← Dev stub; replace with Rust .pyd for production
    ├── reforge_audit/      ← Verification & Audit module (copied, finding fixes applied)
    ├── reforge_recovery/   ← Recovery module (copied, unchanged)
    └── reforge_erase/      ← Erase module (copied, finding fixes applied)
```

---

## Originals preserved (read-only backups)

| Module | Backup location |
|--------|----------------|
| Audit  | `../reforge_audit_backend/` |
| Recovery | `../reforge_recovery_module/` |
| Erase | `../reforge_erase/` |
| Figma prototype | `../Continue Development/` |
| Audit UI | `../reforge_audit_ui_frontend/` |

---

## Changes applied during monorepo assembly

### Finding 1 — TypeScript (low risk)
`src/audit-reports/types/audit.ts`: widened `ActionResult` to include `"in_progress"`.
Erase module logs `result="in_progress"` at operation start; the TS type didn't include it.

### Finding 2 — Python (medium, was a spec gap)
`python/reforge_erase/erase.py` + `peer_modules.py`:
After a verified erase, now calls `record_chain_of_custody("erased")` and
auto-generates a Certificate of Sanitization. Both were imported but never invoked.

### Additional fixes
- `python/reforge_audit/db.py`: aligned `users` table role constraint to `investigator | auditor` (was `examiner | supervisor | admin`)
- `src/audit-reports/api/reforgeAuditApi.ts`: upgraded Tauri invoke import from v1 path to v2 path
- `src/screens/Audit.tsx`: replaced mock hardcoded data with delegation to real `AuditReportsScreen`
- `src/App.tsx`: added real auth (needs_first_run → first-run setup → real login via sidecar)
