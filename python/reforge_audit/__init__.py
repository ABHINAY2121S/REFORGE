"""
reforge_audit — Verification & Audit module for REFORGE.

This package is the SOLE owner of the audit_log, chain_of_custody,
reports, and users SQLite tables. Per the Shared Contract, Recovery and
Erase must call into this package's public functions rather than ever
touching those tables directly.

Public contract surface (Shared Contract Part A) — do not change these
names, parameter orders, or return shapes without updating the contract
document and notifying the other two module owners:

    compute_sha256(data: bytes) -> str
    hash_file(file_path: str) -> str
    log_audit_event(user_id, case_id, evidence_id, action_type,
                     description, result, status) -> str
    record_chain_of_custody(evidence_id, event_type, from_person,
                             to_person, location, reason) -> str
    verify_hash_chain(case_id: str | None = None) -> dict
    generate_report(report_type, case_id, operation_id) -> dict
"""

from reforge_audit.crypto import compute_sha256, hash_file
from reforge_audit.audit import log_audit_event, verify_hash_chain
from reforge_audit.custody import record_chain_of_custody
from reforge_audit.reports import generate_report
from reforge_audit.db import get_connection, initialize_database

__all__ = [
    "compute_sha256",
    "hash_file",
    "log_audit_event",
    "verify_hash_chain",
    "record_chain_of_custody",
    "generate_report",
    "get_connection",
    "initialize_database",
]

__version__ = "0.1.0"
