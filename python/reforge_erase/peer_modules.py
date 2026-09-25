"""
Thin call-throughs to the two peer modules this package depends on, per
the Shared Contract. These are NOT reimplementations -- they exist only so
the rest of this package can `from .peer_modules import log_audit_event, ...`
and so tests can monkeypatch a single seam instead of patching
`reforge_audit` / `reforge_recovery` globally.

Contract reminder: Erase may call reforge_recovery.scan_device_for_signatures
(and nothing else in Recovery), and any of reforge_audit's public functions.
Nothing in Verification/Audit or Recovery calls into Erase.
"""

from __future__ import annotations

import importlib
from typing import Any


def _audit() -> Any:
    return importlib.import_module("reforge_audit")


def _recovery() -> Any:
    return importlib.import_module("reforge_recovery")


def log_audit_event(
    user_id: str,
    case_id: str,
    evidence_id: str | None,
    action_type: str,
    description: str,
    result: str,
    status: str,
) -> str:
    return _audit().log_audit_event(
        user_id=user_id,
        case_id=case_id,
        evidence_id=evidence_id,
        action_type=action_type,
        description=description,
        result=result,
        status=status,
    )


def generate_report(report_type: str, case_id: str, operation_id: str) -> dict:
    return _audit().generate_report(
        report_type=report_type, case_id=case_id, operation_id=operation_id
    )


def scan_device_for_signatures(device_id: str, read_only: bool = True) -> dict:
    # Contract requires read_only default True; we never override it to
    # False from Erase -- adversarial verification must never write.
    return _recovery().scan_device_for_signatures(device_id, read_only=read_only)


def record_chain_of_custody(
    evidence_id: str,
    event_type: str,
    from_person: str,
    to_person: str,
    location: str,
    reason: str,
) -> str:
    return _audit().record_chain_of_custody(
        evidence_id=evidence_id,
        event_type=event_type,
        from_person=from_person,
        to_person=to_person,
        location=location,
        reason=reason,
    )
