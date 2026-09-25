"""
User accounts and login verification.

This module owns the `users` table because it's the security/integrity
module. Credentials for REFORGE's two role accounts (examiner,
supervisor) are hashed with Argon2id — never stored in plaintext, never
hashed with a fast general-purpose hash like SHA-256.

Every login attempt, success or failure, is logged via log_audit_event()
(action_type="login") so failed/blocked logins are auditable, per the
"every action gets logged, not just successes" constraint.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

from reforge_audit.db import transaction, get_connection
from reforge_audit.audit import log_audit_event

_hasher = PasswordHasher()  # library defaults are current OWASP-recommended params

VALID_ROLES = {"examiner", "supervisor", "admin"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def create_user(username: str, password: str, role: str) -> str:
    """Creates a role account with an Argon2id password hash. Returns the
    new user's id. Not part of the cross-module contract — used by
    REFORGE's setup/admin flow only.
    """
    if role not in VALID_ROLES:
        raise ValueError(f"role must be one of {sorted(VALID_ROLES)}, got {role!r}")

    user_id = str(uuid.uuid4())
    password_hash = _hasher.hash(password)

    with transaction() as tx:
        tx.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, username, password_hash, role, _now_iso()),
        )
    return user_id


def verify_login(username: str, password: str, case_id: str = "system") -> Optional[dict]:
    """Verifies a login attempt against the stored Argon2id hash.

    Returns the user record (id, username, role) on success, or None on
    failure. Every attempt is logged via log_audit_event regardless of
    outcome. `case_id` defaults to "system" since login is not always
    scoped to a specific case; callers operating within a case should
    pass its case_id so the login event shows up in that case's timeline.
    """
    conn = get_connection()
    row = conn.execute(
        "SELECT id, username, password_hash, role FROM users WHERE username = ?",
        (username,),
    ).fetchone()

    if row is None:
        log_audit_event(
            user_id="unknown",
            case_id=case_id,
            evidence_id=None,
            action_type="login",
            description=f"Login attempt for unknown username '{username}'",
            result="failure",
            status="blocked",
        )
        return None

    try:
        _hasher.verify(row["password_hash"], password)
    except (VerifyMismatchError, InvalidHash):
        log_audit_event(
            user_id=row["id"],
            case_id=case_id,
            evidence_id=None,
            action_type="login",
            description=f"Failed login attempt for user '{username}'",
            result="failure",
            status="blocked",
        )
        return None

    log_audit_event(
        user_id=row["id"],
        case_id=case_id,
        evidence_id=None,
        action_type="login",
        description=f"Successful login for user '{username}'",
        result="success",
        status="success",
    )
    return {"id": row["id"], "username": row["username"], "role": row["role"]}
