Design a desktop application called PRAHARI — an integrated digital forensics
tool that both RECOVERS deleted/lost files from storage devices and SECURELY
ERASES data beyond recovery, in one unified platform. Its users are forensic
investigators, IT security teams, and compliance officers — not casual
consumers. Design for a desktop window, minimum 1440x900, left-sidebar
navigation layout.

=== DESIGN PRINCIPLE: CALM, NOT FLASHY ===
This is a professional forensic tool, not a consumer app. The #1 design goal
is that a first-time user feels immediately oriented and never confused about
"what will happen if I click this." Prioritize clarity, generous whitespace,
and predictable patterns over decoration. A nervous new user should be able to
complete a recovery or an erase operation without reading a manual.

Rules to enforce everywhere:
- Never more than one primary (filled) button visible per screen at a time.
- Every destructive action (erase, delete, overwrite) uses red only for that
  one action — red must never appear as decoration elsewhere, so it keeps its
  warning meaning.
- Every screen has a single, obvious "next step" — the user should never have
  to guess what to do next.
- Use progressive disclosure: show simple choices first, reveal advanced
  options (raw device paths, sanitize method overrides, hex views) only
  behind a clearly labeled "Advanced" toggle or expandable panel.
- Every irreversible action requires a confirmation step that names exactly
  what will happen, in plain language, before it happens.
- Never use jargon in the primary UI copy without a plain-language explainer
  next to it (e.g. "Purge (NIST-approved secure erase)" not just "Purge").

=== VISUAL SYSTEM ===
Theme: LIGHT THEME ONLY. Do not use a dark background anywhere in this
design — no dark sidebar, no dark cards, no dark modals. Think a clean,
professional security/compliance dashboard in daylight mode — calm, clinical,
trustworthy — not a hacker movie, not a black terminal.

Color tokens:
- Background base: #F5F7FA (soft neutral off-white, not pure #FFFFFF — easier
  on the eyes for long sessions)
- Surface / card background: #FFFFFF
- Surface elevated (modals, panels, popovers): #FFFFFF with a soft shadow
  (rgba(16,21,27,0.08)) to lift it off the base background
- Border / divider: #DDE3EA
- Primary text: #1A2330 (near-black slate, not pure #000)
- Secondary / muted text: #647184
- Accent (brand, primary actions, links): #1E8F7A (deep teal) — used for
  Recovery-related actions and general navigation/brand accents. Use this
  darker teal (not a bright/light teal) so it holds enough contrast against
  the white background for text and icons.
- Danger (erase actions, warnings, destructive confirms): #C6394A (deep,
  professional red — not neon/alarm red, but clearly a "stop and think" red)
- Warning / caution (verification pending, dry-run mode): #B8862E (deep
  amber/gold — dark enough to read clearly on white)
- Success / verified / pass: #2E9E5B (deep green)
- Info / audit / blockchain elements: #4C5FC7 (deep indigo)

Sidebar specifically: use a very light tinted surface (#EEF1F5), NOT a dark
panel, so the whole app reads as one continuous light surface with the
sidebar only subtly separated by a border, not a color inversion.

Typography: One clean, highly legible sans-serif for UI text (e.g. Inter or
similar geometric grotesk) for everything — labels, buttons, body. Use a
monospace font ONLY for technical data that benefits from fixed-width
alignment: device serials, hash values (SHA-256), file paths, hex/byte views,
timestamps. This distinction should be consistent everywhere: normal words in
sans-serif, machine-generated identifiers in monospace.

Iconography: simple line icons (not filled/glyph-heavy), 1.5-2px stroke,
rounded joins. Use icons to reinforce meaning, never as decoration alone —
e.g. a shield for verification, a lock for erase, a magnifying glass for
recovery, a document for reports.

Spacing & shape: generous padding (minimum 16px inside cards), 8px corner
radius on cards and buttons (soft, not sharp, not overly rounded/bubbly),
consistent 24px gutter between major layout regions.

=== INFORMATION ARCHITECTURE (LEFT SIDEBAR NAVIGATION) ===
Persistent left sidebar (fixed, ~240px wide) with these items top to bottom,
each with a simple line icon:
1. Dashboard (home icon)
2. Devices (a drive/USB icon)
3. Recovery (magnifying glass icon)
4. Erase (shield-lock icon)
5. Verification (checkmark-shield icon)
6. Audit & Reports (document icon)
7. Case Management (folder icon)
--- divider ---
8. Settings (gear icon) — bottom of sidebar
Show the current user's role badge (Operator / Investigator / Auditor /
Admin) at the very bottom of the sidebar, above Settings.

=== SCREENS TO DESIGN ===

1. LOGIN / ROLE SELECT
   Simple centered card: PRAHARI logo/wordmark, username, password, and a
   role indicator once logged in. Minimal, no marketing content — this is an
   internal tool.

2. DASHBOARD (home)
   - Top: greeting + active case name + a single prominent "+ New Operation"
     button (opens a modal to choose Recovery or Erase).
   - Middle: a row of 4 summary stat cards (Devices Connected, Active
     Operations, Cases Open, Pending Verifications).
   - Below: a simple table/list of "Recent Operations" — each row shows
     operation type icon (recovery/erase), device name, status pill
     (In Progress / Verified / Failed / Needs Review), and timestamp.
   - Right side (optional narrow column): live "Audit Feed" — a scrolling
     timestamped list of recent system events, small monospace timestamps.

3. DEVICE DETECTION & SELECTION
   - A card grid or list of detected devices, each card shows: device icon
     (HDD/SSD/USB/SD), name, capacity, interface type (SATA/NVMe/USB), and a
     small "Details" link.
   - Clicking a device expands a details panel: model, serial (monospace),
     partitions, and small badges for anything detected: "Encrypted Volume
     Found", "Hidden Area (HPA/DCO) Detected" — shown as amber informational
     badges, not alarming.
   - Bottom: a clear single button "Select This Device →" that becomes
     active once a device is chosen. Selecting the device the app is
     currently running from should be visually disabled/greyed out with a
     tooltip: "This is your active system drive and cannot be selected."

4. OPERATION TYPE CHOICE (modal or full screen after device select)
   Two large, equal-weight cards side by side:
   - Left (teal accent): "Recover Data" — icon + one sentence: "Find and
     restore deleted or lost files from this device."
   - Right (red/danger accent): "Erase Data" — icon + one sentence:
     "Permanently and verifiably destroy data on this device."
   Below each: a secondary choice — "Whole Drive" or "Specific Files/Folders"
   as a small toggle/segmented control.

5. RECOVERY FLOW (3 steps shown as a horizontal stepper at the top:
   Scan → Review Results → Export)
   - Step "Scan": shows a simple progress bar, plain-language current
     action text (e.g. "Reading raw disk sectors…", "Reconstructing
     fragmented files…"), elapsed time and estimated time remaining, and a
     Pause/Cancel option. No technical jargon dominates this screen — keep
     the momentary state in one calm sentence.
   - Step "Review Results": a filterable/sortable file list. Each row shows:
     file type icon, recovered filename (or "Unnamed (recovered by content)"
     if no name survived), file size, a confidence badge (High/Medium/Low
     as green/amber/grey pill), and a checkbox to include it in export.
     Clicking a row opens a side panel with: file preview (if possible),
     the confidence score breakdown as a simple horizontal bar chart with
     labeled segments (Signature Match, Structural Validity, Decoder
     Success, Contiguity, Metadata Match), and hash value (monospace).
   - Step "Export": summary of what's being exported, destination folder
     picker, and a single "Export & Generate Report" primary button.

6. ERASE FLOW (4 steps shown as a horizontal stepper: Configure → Confirm →
   Erasing → Verified)
   - Step "Configure": shows the auto-detected recommended method in a
     highlighted card (e.g. "Recommended: NVMe Sanitize (Crypto Erase) —
     because this drive is a self-encrypting SSD"), with an "Advanced:
     override method" collapsed section below it for power users. A toggle
     for "Dry Run (simulate only, no data destroyed)" is clearly visible
     and off by default... make it OFF by default but very easy to find and
     turn on, with a short explainer tooltip.
   - Step "Confirm": a modal-style full-screen confirmation. Requires the
     user to type the device's last 4 serial digits into a text field to
     enable the final action button, which stays disabled (greyed out)
     until correctly typed. Show a clear plain-language warning: "This will
     permanently destroy all data on [Device Name]. This cannot be undone."
     The confirm button is red, and is the only colored/filled button on
     this screen.
   - Step "Erasing": progress bar with plain-language phase labels
     ("Erasing…", "Verifying…", "Running adversarial recovery check…"),
     and a visual "entropy meter" (a simple horizontal gauge moving toward
     8.0 bits/byte) to make the invisible act of erasure visible and
     satisfying to watch.
   - Step "Verified": a clear pass/fail result card. On pass, show a green
     checkmark, "0 recoverable signatures found — erasure independently
     verified," and a button to "View Certificate of Sanitization." On
     partial pass (e.g. USB with no sanitize support), show an amber
     "Best-Effort — Residual Risk" badge with a one-line plain-language
     explanation, never a false green pass.

7. VERIFICATION SCREEN (standalone, also reachable from sidebar)
   A simple two-column comparison layout: "Before" vs "After" snapshot of
   entropy/signature-scan results for a given operation, so a user can see
   at a glance that a wipe genuinely worked.

8. AUDIT & REPORTS
   - A searchable/filterable table of every logged event: timestamp (mono),
     user, action, device, result — with a filter bar above (by case, date
     range, user, operation type, status).
   - A visually distinct "Chain Integrity" status strip at the top: a green
     "Chain Verified — 0 tamper events" bar, or a red alert bar if a break
     is detected, with a "View Details" link.
   - Report cards below: Forensic Report, Erasure Report, Certificate of
     Sanitization, §65B(4) Evidence Certificate — each as a small card with
     a "Download PDF" and "Download JSON" pair of buttons.

9. CASE MANAGEMENT
   Simple kanban-style or list view of cases, each showing case name,
   linked devices, number of operations, and status. Clicking opens the
   case detail with all associated operations grouped together.

10. SETTINGS
    Simple tabbed layout: Users & Roles, Compliance Standards (toggle which
    standards to reference in reports: NIST 800-88 Rev.2, IEEE 2883-2022,
    DPDP Act, etc.), Audit Chain settings (ledger connection status),
    About/Version.

=== MICRO-INTERACTIONS TO INCLUDE ===
- Hover states on all interactive elements: subtle lightening of surface
  color, never a color hue change.
- Status pills always paired with an icon, never color alone (accessibility:
  color-blind users must be able to tell status apart by icon/shape too).
- Loading and scanning states always show a plain-language sentence
  describing what is currently happening — never a bare spinner with no
  context.
- Empty states (e.g. no devices connected yet) show a friendly instruction,
  not just blank space — e.g. "Connect a storage device to begin."

=== TONE OF UI COPY ===
Plain, calm, and precise. Buttons describe the exact action they take
("Erase This Drive", not "Continue" or "Submit"). Never use exclamation
marks. Never use fear-based language for warnings — state facts plainly
("This action cannot be undone" rather than "WARNING!!! DANGER!!!").

Generate high-fidelity, clickable prototype screens for all 10 screens
above, connected with the flows described (Device Select → Operation Choice
→ Recovery or Erase flow → Verification → back to Dashboard), using the
color tokens, typography, and spacing rules exactly as specified.
