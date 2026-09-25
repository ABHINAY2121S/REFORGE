"""
SQLite schema ownership and connection management for reforge_audit.

This module owns four tables: users, audit_log, chain_of_custody, and
reports. It is the only place in the whole REFORGE codebase that should
issue CREATE TABLE / migration statements for these tables.

The append-only guarantee on audit_log is enforced with SQLite triggers
(engine level), not just in application code, because a security review
will specifically try to bypass the Python layer (e.g. by opening the
.db file directly with a raw sqlite3 client or a different process).
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager

# Default location for the REFORGE database. Overridable via env var so
# tests and the packaged app can point elsewhere without code changes.
DEFAULT_DB_PATH = os.environ.get("REFORGE_DB_PATH", "reforge.db")

_local = threading.local()

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =====================================================================
-- users — owned by reforge_audit (the security/integrity-focused
-- module). Passwords are stored as Argon2id hashes only, never plaintext.
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('investigator', 'auditor')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- =====================================================================
-- audit_log — append-only. Every row is chained to the previous row's
-- hash so tampering with any historical row breaks verify_hash_chain().
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              TEXT PRIMARY KEY,
    timestamp       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    case_id         TEXT NOT NULL,
    evidence_id     TEXT,
    action_type     TEXT NOT NULL,
    description     TEXT NOT NULL,
    result          TEXT NOT NULL,
    status          TEXT NOT NULL,
    chain_hash      TEXT NOT NULL,
    previous_hash   TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON audit_log(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Engine-level append-only enforcement. These triggers fire regardless
-- of which process or client issues the UPDATE/DELETE, so bypassing the
-- Python application layer does not bypass this guarantee.
CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE is not permitted');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: DELETE is not permitted');
END;

-- =====================================================================
-- chain_of_custody
-- =====================================================================
CREATE TABLE IF NOT EXISTS chain_of_custody (
    id              TEXT PRIMARY KEY,
    evidence_id     TEXT NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN
                        ('collected', 'transferred', 'analyzed', 'erased')),
    from_person     TEXT NOT NULL,
    to_person       TEXT NOT NULL,
    location        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'recorded',
    reason          TEXT NOT NULL,
    timestamp       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custody_evidence_id ON chain_of_custody(evidence_id);

-- =====================================================================
-- reports — a record of every report generated, so the Report
-- Generation tab can show prior downloads without regenerating them.
-- =====================================================================
CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    case_id         TEXT NOT NULL,
    operation_id    TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN
                        ('forensic', 'erasure', 'sanitization_cert', 'section_65b')),
    generated_at    TEXT NOT NULL,
    file_path_pdf   TEXT NOT NULL,
    file_path_json  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_case_id ON reports(case_id);
"""


def initialize_database(db_path: str = DEFAULT_DB_PATH) -> None:
    """Creates all tables, indexes, and triggers if they do not exist yet.

    Safe to call on every application startup — every statement is
    idempotent (CREATE ... IF NOT EXISTS).
    """
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def get_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Returns a thread-local SQLite connection with sane defaults.

    Each thread gets its own connection (SQLite connections are not
    guaranteed thread-safe by default); reused across calls within the
    same thread to avoid reopening the file constantly.
    """
    conn = getattr(_local, "conn", None)
    if conn is None or getattr(_local, "db_path", None) != db_path:
        conn = sqlite3.connect(db_path, check_same_thread=True)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
        _local.db_path = db_path
    return conn


@contextmanager
def transaction(db_path: str = DEFAULT_DB_PATH):
    """Context manager for a single atomic write against the DB.

    Used anywhere we need "read previous_hash, then insert" to happen
    atomically so two concurrent log_audit_event() calls cannot both
    read the same previous_hash and corrupt the chain.
    """
    conn = get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
