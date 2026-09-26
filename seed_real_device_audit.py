import sys
import os
import sqlite3

sys.path.insert(0, os.path.abspath('python'))
from reforge_audit.db import initialize_database, get_connection
from reforge_audit.audit import log_audit_event, verify_hash_chain

def seed():
    initialize_database()
    conn = get_connection()
    
    # Disable triggers temporarily if needed to clear previous demo data
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("DROP TABLE IF EXISTS audit_log")
        conn.execute("DROP TABLE IF EXISTS chain_of_custody")
        conn.execute("DROP TABLE IF EXISTS audit_anchors")
        conn.commit()
    except Exception as e:
        print("Table reset info:", e)

    initialize_database()
    conn = get_connection()

    device_id = "E823_8FA6_BF53_0001_001B_448B_4A85_2466"
    case_primary = "2024-CF-0892"
    
    # Insert Device entry into devices table
    try:
        conn.execute("""
            INSERT OR REPLACE INTO devices (id, case_id, model, serial, firmware_version, interface, capacity, filesystem, firmware_reliability_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device_id,
            case_primary,
            "WD PC SN810 SDCPNRY-512G-1006",
            device_id,
            "1006",
            "NVMe PCIe Gen4 x4",
            512105932800,
            "NTFS",
            "verified"
        ))
        # Insert operations
        conn.execute("""
            INSERT OR REPLACE INTO operations (id, case_id, device_id, type, status, method_used, started_at, completed_at, performed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "REC-2026-8819",
            case_primary,
            device_id,
            "recovery",
            "completed",
            "Deep Signature & Structure Carving",
            "2026-09-24T11:00:00Z",
            "2026-09-24T11:30:00Z",
            "Inspector Abhinay (IN-DF-8819)"
        ))
        conn.execute("""
            INSERT OR REPLACE INTO operations (id, case_id, device_id, type, status, method_used, started_at, completed_at, performed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "ERASE-2026-4421",
            case_primary,
            device_id,
            "erase",
            "verified",
            "NIST SP 800-88 Rev. 1 Cryptographic Erase",
            "2026-09-25T14:00:00Z",
            "2026-09-25T14:20:00Z",
            "Supervisor Abhinay (IN-DF-8819)"
        ))
        # Insert erase attempt
        conn.execute("""
            INSERT OR REPLACE INTO erase_attempts (id, operation_id, method, attempt_number, result, entropy_result, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "att-1",
            "ERASE-2026-4421",
            "NIST SP 800-88 Rev. 1 Cryptographic Erase",
            1,
            "success",
            7.9998,
            "2026-09-25T14:20:15Z"
        ))
        conn.commit()
    except Exception as err:
        print("Device/Operation table note:", err)

    # Log genuine chronological audit events (cryptographically hash chained)
    events = [
        {
            "user_id": "examiner.abhinay",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "device_intake",
            "description": "Hardware intake: WD PC SN810 NVMe SSD (512GB) mounted on Workstation-ABHI. Forensic hardware write-block engaged.",
            "result": "success",
            "status": "info"
        },
        {
            "user_id": "examiner.abhinay",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "recovery_scan",
            "description": "Advanced forensic carve on Partition 2 (NTFS). Bi-directional signature scanning identified 6 document & image fragments. Integrity confidence >= 92%.",
            "result": "success",
            "status": "success"
        },
        {
            "user_id": "examiner.abhinay",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "recovery_export",
            "description": "Evidence extraction: 6 salvaged files exported to forensic vault with cryptographically signed RECOVERY_MANIFEST_SHA256.txt (Operation ID: REC-2026-8819).",
            "result": "success",
            "status": "success"
        },
        {
            "user_id": "operator.junior",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "erase_execute",
            "description": "Sanitization attempt halted: Direct block overwrite on NVMe PhysicalDrive0 rejected. Supervisor dual-authorization required under NIST SP 800-88 compliance protocol.",
            "result": "blocked",
            "status": "blocked"
        },
        {
            "user_id": "supervisor.abhinay",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "erase_execute",
            "description": "Supervisor authorization granted. NIST SP 800-88 Rev. 1 Cryptographic Erase (NVMe Format Sanitize) executed on target sectors (Operation ID: ERASE-2026-4421).",
            "result": "success",
            "status": "info"
        },
        {
            "user_id": "examiner.abhinay",
            "case_id": case_primary,
            "evidence_id": device_id,
            "action_type": "erase_verify",
            "description": "Adversarial verification pass complete: Entropy verified at 7.9998 bits/byte. 0 residual signatures found. Certificate of Sanitization issued.",
            "result": "success",
            "status": "success"
        },
    ]

    for ev in events:
        entry_id = log_audit_event(
            user_id=ev["user_id"],
            case_id=ev["case_id"],
            evidence_id=ev["evidence_id"],
            action_type=ev["action_type"],
            description=ev["description"],
            result=ev["result"],
            status=ev["status"]
        )
        print(f"Logged event {ev['action_type']} -> id: {entry_id}")

    # Add chain of custody records
    custody_entries = [
        ("c1", device_id, "collected", "Scene Investigation (Workstation-ABHI)", "examiner.abhinay", "Forensics Lab Alpha", "recorded", "Physical evidence acquisition for SIH-2026 PS-26149", "2026-09-24T09:00:00Z"),
        ("c2", device_id, "transferred", "examiner.abhinay", "evidence_vault", "Secure Evidence Locker A-04", "recorded", "Hardware write-block verification and custody logging", "2026-09-24T10:15:00Z"),
        ("c3", device_id, "analyzed", "evidence_vault", "examiner.abhinay", "Forensics Lab Alpha", "recorded", "Deep signature carving and structure reconstruction (REC-2026-8819)", "2026-09-24T11:30:00Z"),
        ("c4", device_id, "erased", "examiner.abhinay", "supervisor.abhinay", "Sanitization Bay", "recorded", "NIST SP 800-88 Purge Sanitization verified and certified (ERASE-2026-4421)", "2026-09-25T14:20:00Z"),
    ]

    for row in custody_entries:
        conn.execute("""
            INSERT OR REPLACE INTO chain_of_custody 
            (id, evidence_id, event_type, from_person, to_person, location, status, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, row)
    conn.commit()

    # Verify chain
    result = verify_hash_chain()
    print("Hash Chain Verification Result:", result)

if __name__ == "__main__":
    seed()
