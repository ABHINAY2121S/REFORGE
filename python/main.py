"""
REFORGE Python sidecar — entry point.

This process is spawned once by Tauri as a long-lived sidecar. It:
  1. Initialises the shared SQLite database (all three modules' tables).
  2. Listens for JSON-RPC 2.0 requests on stdin, one per line.
  3. Dispatches to the appropriate module function.
  4. Writes JSON-RPC 2.0 responses to stdout, one per line.

Protocol: newline-delimited JSON (ndjson), matching Tauri's sidecar IPC
expectation. Each request: {"id": N, "method": "command_name", "params": {...}}
Each response: {"id": N, "result": <value>} or {"id": N, "error": "<msg>"}

All module imports are deferred inside each handler so that if one module
fails to import (e.g. pytsk3 not installed), only that command fails —
the sidecar stays alive for every other command.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from typing import Any

# ── DB bootstrap ──────────────────────────────────────────────────────────────
# All three modules init their own tables on the shared DB. Safe to call
# on every startup — every CREATE TABLE uses IF NOT EXISTS.

DB_PATH = os.environ.get("REFORGE_DB_PATH", os.path.join(
    os.path.dirname(__file__), "..", "reforge.db"
))
os.environ["REFORGE_DB_PATH"] = os.path.abspath(DB_PATH)

# Insert python/ dir into path so imports resolve without install.
_PYTHON_DIR = os.path.dirname(__file__)
if _PYTHON_DIR not in sys.path:
    sys.path.insert(0, _PYTHON_DIR)


def _bootstrap_db() -> None:
    from reforge_audit.db import initialize_database
    from reforge_recovery.db import connect as recovery_connect
    from reforge_erase.db import init_db as erase_init_db
    import sqlite3

    initialize_database(os.environ["REFORGE_DB_PATH"])

    conn = recovery_connect(os.environ["REFORGE_DB_PATH"])
    conn.close()

    erase_conn = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
    erase_init_db(erase_conn)
    erase_conn.close()


# ── Dispatcher ────────────────────────────────────────────────────────────────

def _dispatch(method: str, params: dict) -> Any:
    # ── Auth ──────────────────────────────────────────────────────────────────
    if method == "login":
        from reforge_audit.auth import verify_login
        return verify_login(params["username"], params["password"])

    if method == "setup_first_account":
        from reforge_audit.sidecar_helpers import create_account
        return create_account(
            params["username"], params["password"], params["role"]
        )

    if method == "needs_first_run":
        from reforge_audit.sidecar_helpers import needs_first_run
        return needs_first_run()

    # ── Audit ─────────────────────────────────────────────────────────────────
    if method == "fetch_audit_log":
        from reforge_audit.sidecar_helpers import fetch_audit_log
        return fetch_audit_log(params.get("caseId"))

    if method == "log_audit_event":
        from reforge_audit.audit import log_audit_event
        return log_audit_event(
            user_id=params["userId"],
            case_id=params["caseId"],
            evidence_id=params.get("evidenceId"),
            action_type=params["actionType"],
            description=params["description"],
            result=params["result"],
            status=params["status"],
        )

    if method == "verify_hash_chain":
        from reforge_audit.audit import verify_hash_chain
        return verify_hash_chain(params.get("caseId"))

    if method == "generate_report":
        from reforge_audit.reports import generate_report
        return generate_report(
            report_type=params["reportType"],
            case_id=params["caseId"],
            operation_id=params["operationId"],
        )

    if method == "fetch_reports":
        from reforge_audit.sidecar_helpers import fetch_reports
        return fetch_reports(params["caseId"])

    if method == "record_chain_of_custody":
        from reforge_audit.custody import record_chain_of_custody
        return record_chain_of_custody(
            evidence_id=params["evidenceId"],
            event_type=params["eventType"],
            from_person=params["fromPerson"],
            to_person=params["toPerson"],
            location=params["location"],
            reason=params["reason"],
        )

    if method == "fetch_evidence_items":
        from reforge_audit.sidecar_helpers import fetch_evidence_items
        return fetch_evidence_items(params.get("caseId"))

    # ── Devices ───────────────────────────────────────────────────────────────
    if method == "list_devices":
        import reforge_core  # type: ignore[import]
        import sqlite3
        from reforge_erase.db import init_db
        db = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        db.row_factory = sqlite3.Row
        init_db(db)
        devices = reforge_core.list_devices()
        # Annotate each with firmware_reliability status from DB.
        for d in devices:
            row = db.execute(
                "SELECT status FROM firmware_reliability WHERE model=? AND firmware_version=?",
                (d.get("model", ""), d.get("firmware_version", "")),
            ).fetchone()
            d["firmwareStatus"] = row["status"] if row else "unverified"
        db.close()
        return devices

    if method == "get_device_capabilities":
        import reforge_core  # type: ignore[import]
        return reforge_core.get_device_capabilities(params["deviceId"])

    if method == "validate_serial_confirmation":
        import reforge_core  # type: ignore[import]
        devices = reforge_core.list_devices()
        match = next((d for d in devices if d.get("id") == params["deviceId"]), None)
        if match is None:
            raise ValueError("Unknown device")
        serial = match.get("serial", "")
        return serial.endswith(params["input"]) and len(params["input"]) == 4

    # ── Recovery ──────────────────────────────────────────────────────────────
    if method == "run_full_recovery":
        from reforge_recovery.pipeline import run_full_recovery
        return run_full_recovery(
            device_id=params["deviceId"],
            scope=params["scope"],
            case_id=params["caseId"],
            user_id=params["userId"],
        )

    if method == "get_recovered_files":
        import sqlite3
        db = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT * FROM recovered_files WHERE operation_id=? ORDER BY confidence_score DESC",
            (params["operationId"],),
        ).fetchall()
        db.close()
        return [dict(r) for r in rows]

    if method == "get_fragment_candidates":
        from reforge_recovery.db import connect, get_candidates_for_group
        conn = connect(os.environ["REFORGE_DB_PATH"])
        rows = get_candidates_for_group(conn, params["candidateGroupId"])
        conn.close()
        return [dict(r) for r in rows]

    if method == "select_candidate":
        from reforge_recovery.db import connect, select_candidate
        conn = connect(os.environ["REFORGE_DB_PATH"])
        select_candidate(conn, params["candidateGroupId"], params["fragmentCandidateId"])
        conn.commit()
        conn.close()
        return True

    if method == "get_file_preview":
        from reforge_recovery.preview import get_preview
        return get_preview(params["fileId"], os.environ["REFORGE_DB_PATH"])

    if method == "scan_device_for_signatures":
        from reforge_recovery.pipeline import scan_device_for_signatures
        return scan_device_for_signatures(params["deviceId"], read_only=True)

    # ── Erase ─────────────────────────────────────────────────────────────────
    if method == "get_recommended_method":
        import reforge_core  # type: ignore[import]
        from reforge_erase.methods import get_recommended_method
        caps = reforge_core.get_device_capabilities(params["deviceId"])
        return get_recommended_method(caps)

    if method == "execute_erase":
        import sqlite3
        from reforge_erase.erase import execute_erase
        from reforge_erase.db import init_db
        conn = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        init_db(conn)
        op_id = execute_erase(
            device_id=params["deviceId"],
            method=params["method"],
            case_id=params["caseId"],
            user_id=params["userId"],
            dry_run=params.get("dryRun", False),
            conn=conn,
        )
        conn.close()
        return op_id

    if method == "handle_verification_failure":
        import sqlite3
        from reforge_erase.erase import handle_verification_failure
        from reforge_erase.db import init_db
        conn = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        init_db(conn)
        result = handle_verification_failure(
            operation_id=params["operationId"],
            device_id=params["deviceId"],
            failed_method=params["failedMethod"],
            conn=conn,
        )
        conn.close()
        return result

    # ── Dashboard / Case data ─────────────────────────────────────────────────
    if method == "get_dashboard_stats":
        import sqlite3
        db = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        db.row_factory = sqlite3.Row
        stats = {
            "activeOperations": db.execute(
                "SELECT COUNT(*) FROM operations WHERE status='in_progress'"
            ).fetchone()[0],
            "casesOpen": db.execute(
                "SELECT COUNT(*) FROM cases WHERE status='open'"
            ).fetchone()[0] if _table_exists(db, "cases") else 0,
            "pendingVerifications": db.execute(
                "SELECT COUNT(*) FROM operations WHERE status='verification_failed'"
            ).fetchone()[0],
            "devicesConnected": 0,  # filled by caller via list_devices
        }
        db.close()
        return stats

    if method == "get_recent_operations":
        import sqlite3
        db = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT * FROM operations ORDER BY started_at DESC LIMIT 20"
        ).fetchall()
        db.close()
        return [dict(r) for r in rows]

    # ── Firmware reliability DB ───────────────────────────────────────────────
    if method == "get_firmware_reliability":
        import sqlite3
        db = sqlite3.connect(os.environ["REFORGE_DB_PATH"])
        db.row_factory = sqlite3.Row
        rows = db.execute("SELECT * FROM firmware_reliability").fetchall()
        db.close()
        return [dict(r) for r in rows]

    raise ValueError(f"Unknown method: {method!r}")


def _table_exists(conn, name: str) -> bool:
    return bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone())


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    _bootstrap_db()
    # Signal readiness to Tauri.
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        req: dict = {}
        try:
            req = json.loads(raw)
            result = _dispatch(req["method"], req.get("params", {}))
            # Convert non-serialisable objects (sqlite3.Row, etc.) to plain dicts.
            response = {"id": req.get("id"), "result": result}
        except Exception as exc:
            response = {
                "id": req.get("id"),
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            }
        sys.stdout.write(json.dumps(response, default=str) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
