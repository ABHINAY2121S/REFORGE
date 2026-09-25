"""
Chain of custody: record_chain_of_custody().

Unlike audit_log, chain_of_custody is not hash-chained (it's a
structured record of physical/logical evidence handling, not a security
event log), but every write is still routed through this one function so
the shape is consistent and the module retains ownership of the table.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from reforge_audit.db import transaction

VALID_EVENT_TYPES = {"collected", "transferred", "analyzed", "erased"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def record_chain_of_custody(
    evidence_id: str,
    event_type: str,
    from_person: str,
    to_person: str,
    location: str,
    reason: str,
) -> str:
    """Writes one chain-of-custody row. Returns the new row's id."""
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(
            f"event_type must be one of {sorted(VALID_EVENT_TYPES)}, got {event_type!r}"
        )

    row_id = str(uuid.uuid4())
    timestamp = _now_iso()

    with transaction() as tx:
        tx.execute(
            """
            INSERT INTO chain_of_custody
                (id, evidence_id, event_type, from_person, to_person,
                 location, status, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (row_id, evidence_id, event_type, from_person, to_person,
             location, "recorded", reason, timestamp),
        )

    return row_id
