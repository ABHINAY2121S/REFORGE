"""
SQLite tables owned by the Recovery module, per the Shared Contract:

    recovered_files(id, operation_id, filename, size, confidence_score,
                     confidence_tier, sha256, file_type, candidate_group_id)
    fragment_candidates(id, recovered_file_id, rank, score_breakdown_json,
                         is_selected)

Recovery is the only module that reads/writes these two tables. Recovery
never writes to audit_log / chain_of_custody / reports directly — those
belong to reforge_audit (Shared Contract Part A) and are reached only
through the calls in _integrations.py.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any, Iterator, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS recovered_files (
    id                  TEXT PRIMARY KEY,
    operation_id        TEXT NOT NULL,
    filename            TEXT,
    size                INTEGER NOT NULL,
    confidence_score    REAL NOT NULL,
    confidence_tier     TEXT NOT NULL CHECK (confidence_tier IN ('High', 'Medium', 'Low')),
    sha256              TEXT NOT NULL,
    file_type           TEXT NOT NULL,
    candidate_group_id  TEXT
);

CREATE TABLE IF NOT EXISTS fragment_candidates (
    id                  TEXT PRIMARY KEY,
    recovered_file_id   TEXT NOT NULL REFERENCES recovered_files(id),
    rank                INTEGER NOT NULL,
    score_breakdown_json TEXT NOT NULL,
    is_selected         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recovered_files_operation
    ON recovered_files(operation_id);

CREATE INDEX IF NOT EXISTS idx_fragment_candidates_file
    ON fragment_candidates(recovered_file_id);
"""


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(SCHEMA)
    return conn


@contextmanager
def session(db_path: str) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def insert_recovered_file(
    conn: sqlite3.Connection,
    operation_id: str,
    filename: Optional[str],
    size: int,
    confidence_score: float,
    confidence_tier: str,
    sha256: str,
    file_type: str,
    candidate_group_id: Optional[str] = None,
) -> str:
    row_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO recovered_files
            (id, operation_id, filename, size, confidence_score,
             confidence_tier, sha256, file_type, candidate_group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            row_id,
            operation_id,
            filename,
            size,
            confidence_score,
            confidence_tier,
            sha256,
            file_type,
            candidate_group_id,
        ),
    )
    return row_id


def insert_fragment_candidate(
    conn: sqlite3.Connection,
    recovered_file_id: str,
    rank: int,
    score_breakdown: dict[str, Any],
    is_selected: bool,
) -> str:
    row_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO fragment_candidates
            (id, recovered_file_id, rank, score_breakdown_json, is_selected)
        VALUES (?, ?, ?, ?, ?)
        """,
        (row_id, recovered_file_id, rank, json.dumps(score_breakdown), int(is_selected)),
    )
    return row_id


def get_candidates_for_group(conn: sqlite3.Connection, candidate_group_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT rf.*, fc.rank, fc.score_breakdown_json, fc.is_selected, fc.id as fragment_candidate_id
        FROM recovered_files rf
        JOIN fragment_candidates fc ON fc.recovered_file_id = rf.id
        WHERE rf.candidate_group_id = ?
        ORDER BY fc.rank ASC
        """,
        (candidate_group_id,),
    ).fetchall()


def select_candidate(conn: sqlite3.Connection, candidate_group_id: str, fragment_candidate_id: str) -> None:
    """Mark one candidate in a group as selected, deselecting the others."""
    conn.execute(
        """
        UPDATE fragment_candidates SET is_selected = 0
        WHERE id IN (
            SELECT fc.id FROM fragment_candidates fc
            JOIN recovered_files rf ON rf.id = fc.recovered_file_id
            WHERE rf.candidate_group_id = ?
        )
        """,
        (candidate_group_id,),
    )
    conn.execute(
        "UPDATE fragment_candidates SET is_selected = 1 WHERE id = ?",
        (fragment_candidate_id,),
    )
