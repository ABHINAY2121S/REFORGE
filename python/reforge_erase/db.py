"""
SQLite schema and data-access helpers for the tables this module owns:
    devices, operations, erase_attempts, firmware_reliability

Only reforge_erase writes to these tables. Other modules may be given
read access at the application layer, but that's outside this package's
concern.
"""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    model TEXT NOT NULL,
    serial TEXT NOT NULL,
    firmware_version TEXT,
    interface TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    filesystem TEXT,
    firmware_reliability_status TEXT
);

CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    method_used TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    performed_by TEXT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS erase_attempts (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL,
    method TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    result TEXT,
    entropy_result REAL,
    verified_at TEXT,
    FOREIGN KEY (operation_id) REFERENCES operations(id)
);

CREATE TABLE IF NOT EXISTS firmware_reliability (
    model TEXT NOT NULL,
    firmware_version TEXT NOT NULL,
    status TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    source TEXT,
    PRIMARY KEY (model, firmware_version)
);
"""


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


@contextmanager
def cursor(conn: sqlite3.Connection) -> Iterator[sqlite3.Cursor]:
    cur = conn.cursor()
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_operation(
    conn: sqlite3.Connection,
    case_id: str,
    device_id: str,
    op_type: str,
    performed_by: str,
) -> str:
    op_id = str(uuid.uuid4())
    with cursor(conn) as cur:
        cur.execute(
            """INSERT INTO operations
               (id, case_id, device_id, type, status, method_used,
                started_at, completed_at, performed_by)
               VALUES (?, ?, ?, ?, 'in_progress', NULL, ?, NULL, ?)""",
            (op_id, case_id, device_id, op_type, _now(), performed_by),
        )
    return op_id


def update_operation_status(
    conn: sqlite3.Connection,
    operation_id: str,
    status: str,
    method_used: Optional[str] = None,
    completed: bool = False,
) -> None:
    with cursor(conn) as cur:
        if completed:
            cur.execute(
                """UPDATE operations
                   SET status = ?, method_used = COALESCE(?, method_used),
                       completed_at = ?
                   WHERE id = ?""",
                (status, method_used, _now(), operation_id),
            )
        else:
            cur.execute(
                """UPDATE operations
                   SET status = ?, method_used = COALESCE(?, method_used)
                   WHERE id = ?""",
                (status, method_used, operation_id),
            )


def record_attempt(
    conn: sqlite3.Connection,
    operation_id: str,
    method: str,
    attempt_number: int,
    result: Optional[str] = None,
    entropy_result: Optional[float] = None,
    verified: bool = False,
) -> str:
    attempt_id = str(uuid.uuid4())
    with cursor(conn) as cur:
        cur.execute(
            """INSERT INTO erase_attempts
               (id, operation_id, method, attempt_number, result,
                entropy_result, verified_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                attempt_id,
                operation_id,
                method,
                attempt_number,
                result,
                entropy_result,
                _now() if verified else None,
            ),
        )
    return attempt_id


def get_attempts_for_operation(
    conn: sqlite3.Connection, operation_id: str
) -> list[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    with cursor(conn) as cur:
        cur.execute(
            "SELECT * FROM erase_attempts WHERE operation_id = ? ORDER BY attempt_number",
            (operation_id,),
        )
        return cur.fetchall()


def upsert_firmware_reliability(
    conn: sqlite3.Connection,
    model: str,
    firmware_version: str,
    status: str,
    source: str,
) -> None:
    """
    Self-improving Firmware Sanitize Reliability Database: called as a real
    side effect whenever adversarial verification finds signatures on a
    device that had reported a successful hardware sanitize.
    """
    with cursor(conn) as cur:
        cur.execute(
            """INSERT INTO firmware_reliability
               (model, firmware_version, status, last_updated, source)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(model, firmware_version) DO UPDATE SET
                   status = excluded.status,
                   last_updated = excluded.last_updated,
                   source = excluded.source""",
            (model, firmware_version, status, _now(), source),
        )


def get_operation(conn: sqlite3.Connection, operation_id: str) -> Optional[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    with cursor(conn) as cur:
        cur.execute("SELECT * FROM operations WHERE id = ?", (operation_id,))
        return cur.fetchone()


def get_device(conn: sqlite3.Connection, device_id: str) -> Optional[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    with cursor(conn) as cur:
        cur.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
        return cur.fetchone()
