"""
Extra helpers needed by the sidecar dispatcher that weren't part of the
original standalone module:
  - needs_first_run()     — check if the users table is empty
  - create_account()      — alias for create_user(), first-run flow
  - fetch_audit_log()     — query audit_log table for the frontend
  - fetch_reports()       — query reports table for the frontend
"""

from __future__ import annotations

from reforge_audit.auth import create_user
from reforge_audit.db import get_connection


def needs_first_run() -> bool:
    """True if no accounts have been created yet (first-run setup required)."""
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM users LIMIT 1").fetchone()
    return row is None


def create_account(username: str, password: str, role: str) -> dict:
    """First-run account creation. Maps frontend role names to DB role values."""
    # Frontend sends 'investigator' or 'auditor'; map to what the DB accepts.
    _role_map = {
        "investigator": "investigator",
        "auditor": "auditor",
        # Legacy values from original module — kept for forward compat.
        "examiner": "investigator",
        "supervisor": "auditor",
    }
    db_role = _role_map.get(role.lower(), role.lower())
    user_id = create_user(username, password, db_role)
    return {"id": user_id, "username": username, "role": db_role}


def fetch_audit_log(case_id: str | None = None) -> list[dict]:
    """Returns all audit_log rows, optionally filtered by case_id."""
    conn = get_connection()
    if case_id:
        rows = conn.execute(
            """
            SELECT id, timestamp, user_id, case_id, evidence_id, action_type,
                   description, result, status, chain_hash, previous_hash
            FROM audit_log WHERE case_id = ? ORDER BY timestamp ASC
            """,
            (case_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, timestamp, user_id, case_id, evidence_id, action_type,
                   description, result, status, chain_hash, previous_hash
            FROM audit_log ORDER BY timestamp ASC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def fetch_reports(case_id: str) -> list[dict]:
    """Returns all report records for a case."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM reports WHERE case_id = ? ORDER BY generated_at DESC",
        (case_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def fetch_evidence_items(case_id: str | None = None) -> list[dict]:
    """
    Builds the EvidenceItem list for the Chain of Custody tab.
    Bridges case -> evidence via evidence_ids seen in audit_log, then joins
    chain_of_custody events, and pulls device label from the devices table.
    """
    conn = get_connection()

    # Find all evidence IDs relevant to this case from audit_log.
    if case_id:
        rows = conn.execute(
            "SELECT DISTINCT evidence_id FROM audit_log WHERE case_id=? AND evidence_id IS NOT NULL",
            (case_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT DISTINCT evidence_id FROM audit_log WHERE evidence_id IS NOT NULL"
        ).fetchall()

    evidence_ids = [r["evidence_id"] for r in rows]
    if not evidence_ids:
        return []

    result = []
    for eid in evidence_ids:
        # Try to get device label from devices table (owned by Erase module).
        device_row = conn.execute(
            "SELECT model, serial FROM devices WHERE id=?", (eid,)
        ).fetchone()
        if device_row:
            label = f"{device_row['model']} (SN: {device_row['serial']})"
        else:
            label = eid  # fall back to the ID itself

        custody_rows = conn.execute(
            """
            SELECT id, evidence_id, event_type, from_person, to_person,
                   location, status, reason, timestamp
            FROM chain_of_custody WHERE evidence_id=? ORDER BY timestamp ASC
            """,
            (eid,),
        ).fetchall()

        result.append({
            "evidence_id": eid,
            "case_id": case_id or "all",
            "device_label": label,
            "sha256": "",  # populated by context provider when available
            "md5": "",
            "events": [dict(r) for r in custody_rows],
        })
    return result
