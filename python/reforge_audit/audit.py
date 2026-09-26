"""
The audit hash chain: log_audit_event() and verify_hash_chain().

log_audit_event is, per the Shared Contract, the ONLY function any module
(including this one's own internals) may use to write to audit_log. It
computes and stores chain_hash automatically. Recovery and Erase must
never write to audit_log directly — this module's schema-creation script
enforces that at the DB engine level via append-only triggers, but the
"only through this function" rule for INSERT is a contract-level rule
enforced by convention plus (optionally) DB file permissions in
deployment, since SQLite has no per-table INSERT-only-via-function
mechanism.

Batching for Merkle anchoring: every AUDIT_ANCHOR_BATCH_SIZE new rows,
we compute a Merkle root over that batch's chain_hash values, sign it
locally (Ed25519), and offer it to the pluggable timestamp/ledger
providers (both no-op when unconfigured, per the fully-offline
constraint). This is best-effort and never blocks or fails the write to
audit_log — a failure in anchoring must not make evidence logging fail.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from reforge_audit.crypto import compute_sha256, canonical_json, merkle_root, sign_digest
from reforge_audit.db import get_connection, transaction
from reforge_audit.ledger import get_ledger_anchor
from reforge_audit.timestamp import get_timestamp_provider

# Internal-only table (not part of the Shared Contract schema, not
# depended on by Recovery or Erase). Created lazily so existing DBs from
# before this feature was added still work.
_ANCHOR_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS audit_anchors (
    id                  TEXT PRIMARY KEY,
    created_at          TEXT NOT NULL,
    first_entry_id      TEXT NOT NULL,
    last_entry_id       TEXT NOT NULL,
    entry_count         INTEGER NOT NULL,
    merkle_root         TEXT NOT NULL,
    signature           TEXT NOT NULL,
    timestamp_applied   INTEGER NOT NULL,
    timestamp_provider  TEXT NOT NULL,
    ledger_anchored     INTEGER NOT NULL,
    ledger_backend      TEXT NOT NULL
);
"""

AUDIT_ANCHOR_BATCH_SIZE = 50


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _row_for_hashing(row: dict) -> dict:
    """The exact fields fed into canonical_json() when computing
    chain_hash. Excludes chain_hash/previous_hash themselves (the thing
    being computed) — previous_hash is prepended separately as per the
    contract's chain_hash formula.
    """
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "user_id": row["user_id"],
        "case_id": row["case_id"],
        "evidence_id": row["evidence_id"],
        "action_type": row["action_type"],
        "description": row["description"],
        "result": row["result"],
        "status": row["status"],
    }


def log_audit_event(
    user_id: str,
    case_id: str,
    evidence_id: Optional[str],
    action_type: str,
    description: str,
    result: str,
    status: str,
) -> str:
    """
    Writes one append-only row to audit_log, computing chain_hash =
    SHA256(previous_row_hash + canonical_json(this_row)). Returns the
    new row's id. This is the ONLY sanctioned way to write to audit_log.

    Every action gets logged here, including failures/blocked actions —
    callers must not skip this call just because result != "success".
    """
    conn = get_connection()
    conn.executescript(_ANCHOR_TABLE_SQL)

    entry_id = str(uuid.uuid4())
    timestamp = _now_iso()

    with transaction() as tx:
        prev_row = tx.execute(
            "SELECT chain_hash FROM audit_log ORDER BY rowid DESC LIMIT 1"
        ).fetchone()
        previous_hash = prev_row["chain_hash"] if prev_row else "GENESIS"

        row = {
            "id": entry_id,
            "timestamp": timestamp,
            "user_id": user_id,
            "case_id": case_id,
            "evidence_id": evidence_id,
            "action_type": action_type,
            "description": description,
            "result": result,
            "status": status,
        }
        chain_hash = compute_sha256(
            ((previous_hash or "") + canonical_json(_row_for_hashing(row))).encode("utf-8")
        )

        tx.execute(
            """
            INSERT INTO audit_log
                (id, timestamp, user_id, case_id, evidence_id, action_type,
                 description, result, status, chain_hash, previous_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id, timestamp, user_id, case_id, evidence_id, action_type,
                description, result, status, chain_hash, previous_hash,
            ),
        )

    _maybe_anchor_batch()
    return entry_id


def _maybe_anchor_batch() -> None:
    """Best-effort Merkle batching + optional timestamp/ledger anchor.

    Never raises: any failure here is swallowed (after being logged to
    stderr) so it can never cause an evidence-logging call to fail.
    """
    try:
        conn = get_connection()
        last_anchor = conn.execute(
            "SELECT last_entry_id FROM audit_anchors ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

        if last_anchor is None:
            rows = conn.execute(
                "SELECT id, chain_hash FROM audit_log ORDER BY rowid ASC"
            ).fetchall()
        else:
            last_rowid = conn.execute(
                "SELECT rowid FROM audit_log WHERE id = ?", (last_anchor["last_entry_id"],)
            ).fetchone()
            start_rowid = last_rowid["rowid"] if last_rowid else 0
            rows = conn.execute(
                "SELECT id, chain_hash FROM audit_log WHERE rowid > ? ORDER BY rowid ASC",
                (start_rowid,),
            ).fetchall()

        if len(rows) < AUDIT_ANCHOR_BATCH_SIZE:
            return

        batch = rows[:AUDIT_ANCHOR_BATCH_SIZE]
        root = merkle_root([r["chain_hash"] for r in batch])
        signature = sign_digest(root)

        ts_result = get_timestamp_provider().timestamp(root)
        ledger_result = get_ledger_anchor().anchor(root)

        with transaction() as tx:
            tx.execute(
                """
                INSERT INTO audit_anchors
                    (id, created_at, first_entry_id, last_entry_id, entry_count,
                     merkle_root, signature, timestamp_applied, timestamp_provider,
                     ledger_anchored, ledger_backend)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()), _now_iso(), batch[0]["id"], batch[-1]["id"], len(batch),
                    root, signature, int(ts_result.applied), ts_result.provider,
                    int(ledger_result.anchored), ledger_result.backend,
                ),
            )
    except Exception as exc:  # pragma: no cover - defensive, must never propagate
        import sys
        print(f"[reforge_audit] batch anchoring skipped due to error: {exc}", file=sys.stderr)


def verify_hash_chain(case_id: Optional[str] = None) -> dict:
    """
    Walks the ENTIRE audit_log hash chain in insertion order (the chain
    itself is global — every row links to the row before it regardless
    of case) and recomputes each chain_hash to confirm nothing has been
    altered.

    If `case_id` is given, entries_checked reports only the count of
    that case's rows that were verified as part of the walk; the walk
    itself still covers the full table, because verifying a subset of a
    hash chain in isolation would prove nothing about tampering outside
    that subset.

    Returns: {"intact": bool, "entries_checked": int,
              "break_at_entry_id": str | None}
    """
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, timestamp, user_id, case_id, evidence_id, action_type,
               description, result, status, chain_hash, previous_hash
        FROM audit_log ORDER BY rowid ASC
        """
    ).fetchall()

    if not rows:
        return {
            "intact": True,
            "entries_checked": 0,
            "break_at_entry_id": None,
        }

    previous_hash = "GENESIS"
    entries_checked = 0
    break_at_entry_id = None

    for i, row in enumerate(rows):
        row_dict = dict(row)
        prev_h = row_dict.get("previous_hash")

        if i == 0:
            if prev_h not in ("GENESIS", None, ""):
                break_at_entry_id = row_dict["id"]
                break
            prev_input = prev_h or ""
            expected = compute_sha256(
                (prev_input + canonical_json(_row_for_hashing(row_dict))).encode("utf-8")
            )
        else:
            if prev_h != previous_hash:
                break_at_entry_id = row_dict["id"]
                break
            expected = compute_sha256(
                ((previous_hash or "") + canonical_json(_row_for_hashing(row_dict))).encode("utf-8")
            )

        if expected != row_dict["chain_hash"]:
            break_at_entry_id = row_dict["id"]
            break

        if case_id is None or row_dict["case_id"] == case_id:
            entries_checked += 1
        previous_hash = row_dict["chain_hash"]

    return {
        "intact": break_at_entry_id is None,
        "entries_checked": entries_checked,
        "break_at_entry_id": break_at_entry_id,
    }
