Add the following 5 unique-selling-point features to the existing REFORGE
prototype. Keep the same color tokens, typography, spacing, and "calm not
flashy" design principle already established. These are advanced features on
top of the base flows — reachable via clearly labeled entry points, never
replacing the simple default path for a first-time user.

=== USP 1: EXPLAINABLE MULTI-CANDIDATE FRAGMENT RECONSTRUCTION ===
Add a new state to the existing Recovery Flow's "Review Results" step:
when a recovered file was fragmented and multiple plausible reconstructions
exist, replace the single-file row with a small "Multiple Candidates Found"
badge. Clicking it opens a "Compare Candidates" panel:
- 2-3 candidate cards shown side by side, each with: a thumbnail/preview if
  possible, its confidence score, and file size.
- Below each card, an expandable "Why this candidate?" section showing a
  short vertical timeline/log of the reasoning: e.g. "Fragment B chosen over
  Fragment D — entropy match 92% vs 61%; ML type consistency higher; header
  continuity confirmed." Use the monospace font for the percentage/technical
  values, sans-serif for the explanation text.
- A single button "Use This Candidate" per card, disabled on all but the one
  currently selected via radio-style selection.
This entire panel is optional/expandable — a simple single-candidate
recovery should never show this UI at all.

=== USP 2: EVIDENCE-AWARE ERASURE GUARD ===
Add a new gate screen inside the existing Erase Flow, between "Configure"
and "Confirm". Title: "Pre-Erasure Checklist". Show a simple vertical
checklist of required preconditions, each with a status icon (checkmark =
complete, empty circle = incomplete):
- Case linked to this operation
- Forensic image / backup completed (if applicable)
- Required authorization / sign-off recorded
- Chain-of-custody entry created
If any item is incomplete, the "Continue to Confirmation" button stays
disabled (greyed out), and the incomplete item shows a small inline link
"Complete this step" next to it. Add one plain-language sentence at the top:
"These steps must be complete before this device can be erased." Never let
a user bypass this screen via a hidden shortcut — there should be no way to
reach the Confirm step without passing through this gate.

=== USP 3: FIRMWARE SANITIZE RELIABILITY DATABASE ===
(a) On the Device Detection & Selection screen, add a small badge next to
each device's details: "Firmware: Verified Reliable" (green icon+text),
"Firmware: Unverified" (amber), or "Firmware: Known Unreliable" (red). Use
the same small informational-badge style already defined for "Encrypted
Volume Found" / "Hidden Area Detected".
(b) In the Erase Flow's "Configure" step, if a device's firmware badge is
Amber or Red, show a highlighted callout card above the recommended method:
"This device's firmware has not been verified as fully reliable for
hardware Sanitize. Recommending Overwrite + Adversarial Verification as a
stronger fallback." with a small "Why?" link that explains the concept in
one sentence.
(c) Add a new tab under Settings: "Firmware Reliability Database" — a
searchable, sortable table with columns: Device Model, Firmware Version,
Status (Verified/Unverified/Unreliable as colored pills), Last Updated,
Source (e.g. "Adversarial verification failure — Case #114"). Include a
short explanatory sentence at the top: "This list grows automatically
every time REFORGE's own adversarial verification finds recoverable data
after a device reported successful sanitization."

=== USP 4: CROSS-DEVICE CASE CORRELATION ===
Add a new tab inside Case Management (when a case with 2+ devices is open):
"Correlation View". Show a simple node graph: each connected device as a
circular node (with its device icon), connected by lines to other device
nodes when shared evidence is found between them. Line thickness or a small
number badge on the line indicates how many matches were found (shared file
hashes, fragment signatures, timestamps, or metadata).
Clicking a connecting line opens a side panel: "3 matches between Device A
and Device B" listing each match as a row (match type icon, file name or
hash, confidence). Keep the graph simple and uncluttered — this is meant to
give an investigator one clear insight ("these devices are related"), not a
dense data-science visualization.

=== USP 5: ADAPTIVE SANITIZATION FALLBACK ===
Modify the existing Erase Flow's "Verified" step's fail state. Currently on
fail it just shows "Erase Incomplete." Extend it:
- Show the failure clearly first: red status, plain-language reason (e.g.
  "Verification found residual signatures using the Overwrite method").
- Below it, show a highlighted suggestion card: "Try Alternate Method:
  Crypto Erase (recommended for this device type)" with a single button
  "Retry with This Method".
- Clicking it loops back into the Configure step with the new method
  pre-selected, and adds an entry to a small visible "Attempt History"
  stepper at the top of the Erase Flow showing all attempts so far, e.g.:
  "Attempt 1: Overwrite — Failed  →  Attempt 2: Crypto Erase — In Progress".
- Once an attempt succeeds, show the full attempt history in the final
  Certificate of Sanitization as a transparency record — this should never
  be hidden, since showing the failed-then-corrected attempt is itself
  evidence of thorough verification.