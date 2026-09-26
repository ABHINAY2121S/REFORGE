import { useState } from 'react';
import {
  IconSearch, IconShieldCheck, IconShieldLock, IconHardDrive,
  IconDocument, IconActivity, IconInfo, IconX, IconCheck
} from './Icons';

interface AssistantProps {
  activeCaseName?: string;
  userRole?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  tags?: string[];
}

const PRESET_QUERIES = [
  {
    label: '⚖️ Section 65B Admissibility',
    query: 'What are the statutory requirements for Section 65B(4) evidence certificate admissibility in court?',
    answer: `### Section 65B(4) Electronic Evidence Admissibility (IEA / BSA §63)

Under **Anvar P.V. v. P.K. Basheer (2014)** and **Arjun Panditrao Khotkar (2020)**:
1. **Mandatory Certificate:** A written certificate under Section 65B(4) is an absolute condition precedent for admitting secondary electronic records (printouts, copies, forensic dumps).
2. **Identification:** The certificate must explicitly identify the electronic record containing the statement and describe the manner in which it was produced.
3. **Computer Operation:** Attestation that the computer/storage device was operating properly throughout the material period, and reproduction integrity was maintained without unauthorized alteration.
4. **Lawful Custody:** Executed by a person occupying a responsible official position in relation to the device or management of the relevant activity.

*REFORGE generates pre-formatted, SHA-256 sealed 65B certificates in the **Reports & Certificates** tab.*`
  },
  {
    label: '🛡️ NIST 800-88: Purge vs Clear',
    query: 'When should I select NIST 800-88 Purge vs Clear for SSD and NVMe drives?',
    answer: `### NIST SP 800-88 Rev. 2 Guidelines: Clear vs Purge

- **Clear:** Logical overwrite of all addressable storage locations with a fixed or pseudorandom pattern.
  - *Applicability:* Good for magnetic HDDs intended for internal reuse within the same security perimeter.
  - *Limitation on Flash/SSD:* Fails to sanitize over-provisioned blocks, bad blocks, or wear-leveling reserves.
- **Purge:** Executes physical or cryptographic commands that render target data infeasible to recover even using state-of-the-art laboratory techniques.
  - *Applicability:* **Mandatory for SSDs & NVMe drives.** Uses hardware-level commands: **NVMe Format (User Data Erase / Cryptographic Erase)**, ATA Sanitize Block Erase, or SCSI Cryptographic Erase.
- **Destroy:** Physical destruction (shredding, degaussing for magnetic, incineration).

*Recommendation for your detected NVMe SSD: Always use **Purge (Cryptographic Erase + Block Verification)**.*`
  },
  {
    label: '🔍 File Carving Strategy',
    query: 'How does REFORGE handle fragmented file recovery without file system tables?',
    answer: `### Fragmented File Carving & Recovery Strategy

When the MFT (NTFS) or FAT directory table is zeroed:
1. **Bilevel Heuristic Carving:**
   - Detects standard magic header bytes (e.g., \`%PDF-1.\`, \`\\xFF\\xD8\\xFF\\xE0\` for JPEG, \`PK\\x03\\x04\` for DOCX/ZIP).
   - Scans sequential clusters until EOF marker or entropy discontinuity.
2. **Fragment Candidate Scoring:**
   - REFORGE assigns a **Confidence Score (High / Medium / Low)** using Markov chain byte-transition analysis and structural parser checks.
3. **Write-Blocked Pipeline:**
   - Raw disk reads are performed strictly read-only (\`O_RDONLY\` with software write-blockers). Hashes are verified prior to parsing.`
  },
  {
    label: '🔐 Chain of Custody Integrity',
    query: 'How is the append-only hash chain verified against tampering?',
    answer: `### Append-Only Hash Chain Architecture

1. **Sequential SHA-256 Merkle Ledger:**
   - Every audit event (logins, scans, erasure triggers, report downloads) calculates:
     \`chain_hash = SHA256(prev_hash + timestamp + user_id + action + evidence_id)\`
2. **Database Engine Triggers:**
   - SQLite level triggers (\`trg_audit_log_no_update\` and \`trg_audit_log_no_delete\`) block direct \`UPDATE\` or \`DELETE\` queries even if someone opens the \`.db\` file directly.
3. **Verification Scan:**
   - If even a single byte of a past event is altered, all downstream hashes break, flagging **TAMPER EVIDENT** immediately.`
  }
];

export default function ForensicAssistant({ activeCaseName = 'State v. Meridian Corp', userRole = 'Investigator' }: AssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-init',
      sender: 'assistant',
      text: `Hello ${userRole}. I am your **REFORGE Forensic Copilot**. I can provide legal admissibility guidelines (Section 65B, BSA 2023), media sanitization standards (NIST SP 800-88), file carving strategies, and verify cryptographic chain-of-custody protocols. How can I assist with your investigation today?`,
      timestamp: 'Just now',
    }
  ]);

  const handleSend = (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now',
    };

    // Find pre-set match or generate contextual response
    const preset = PRESET_QUERIES.find(p => p.query.toLowerCase() === textToSend.toLowerCase() || p.label.toLowerCase() === textToSend.toLowerCase());
    
    let replyText = '';
    if (preset) {
      replyText = preset.answer;
    } else {
      replyText = `### Forensic Analysis Guidance for "${textToSend}"

- **Active Case Context:** ${activeCaseName}
- **Standard Protocol:** Ensure all media interactions maintain write-blocking integrity.
- **Verification Rule:** Every artifact acquired must be hashed immediately (MD5 + SHA-256) and logged to the tamper-evident ledger.
- **Next Step:** You can generate a formal **Certificate of Media Sanitization** or **Section 65B(4) Declaration** from the **Reports & Certificates** screen.`;
    }

    const assistantMsg: Message = {
      id: `a-${Date.now() + 1}`,
      sender: 'assistant',
      text: replyText,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="forensic-assistant-root" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 90 }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
            borderRadius: 30, border: 'none', backgroundColor: '#1E8F7A',
            color: '#FFFFFF', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(30, 143, 122, 0.35)',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'transform 0.15s ease, background-color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#178269')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E8F7A')}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#5FCA85', boxShadow: '0 0 6px #5FCA85' }} />
          <span>Forensic Assistant</span>
          {isOpen ? <IconX size={16} style={{ stroke: '#fff' }} /> : <IconSearch size={16} style={{ stroke: '#fff' }} />}
        </button>
      </div>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', bottom: 84, right: 24, width: 440, height: 580,
            backgroundColor: '#FFFFFF', borderRadius: 14, border: '1px solid #DDE3EA',
            boxShadow: '0 12px 36px rgba(16,21,27,0.16)', zIndex: 95,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #DDE3EA', backgroundColor: '#F8FAFC',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, backgroundColor: '#E8F5F2',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <IconShieldCheck size={18} style={{ color: '#1E8F7A', stroke: '#1E8F7A' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2330' }}>REFORGE AI Copilot</div>
                <div style={{ fontSize: 11, color: '#647184' }}>Forensic Guidance & Statutory Admissibility</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#647184'
              }}
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Quick Questions Pills */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFFFFF',
            display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap'
          }}>
            {PRESET_QUERIES.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p.query)}
                style={{
                  padding: '5px 10px', borderRadius: 16, border: '1px solid #DDE3EA',
                  backgroundColor: '#F8FAFC', color: '#1A2330', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', flexShrink: 0
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Chat Messages Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    backgroundColor: m.sender === 'user' ? '#1E8F7A' : '#F4F6F9',
                    color: m.sender === 'user' ? '#FFFFFF' : '#1A2330',
                    fontSize: 13, lineHeight: 1.55,
                    border: m.sender === 'user' ? 'none' : '1px solid #E2E8F0',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: '#8FA0B3', marginTop: 4, textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                  {m.timestamp}
                </div>
              </div>
            ))}
          </div>

          {/* Input Footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #DDE3EA', backgroundColor: '#FFFFFF' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Section 65B, NIST 800-88, or device carving..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #DDE3EA',
                  fontSize: 13, outline: 'none', backgroundColor: '#F8FAFC'
                }}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  backgroundColor: input.trim() ? '#1E8F7A' : '#DDE3EA',
                  color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: input.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
