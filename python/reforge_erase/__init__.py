"""
reforge_erase
=============

The Erase module of REFORGE. Implements Shared Contract Part C exactly.

Public interface (the ONLY things the frontend / Tauri layer should import):
    get_recommended_method(device_info: dict) -> dict
    execute_erase(device_id, method, case_id, user_id, dry_run=False) -> str
    handle_verification_failure(operation_id, device_id, failed_method) -> dict

Everything else in this package is internal.

Cross-module integration points (per the Shared Contract, these packages
are owned by other engineers and are assumed to exist exactly as specified
-- this module never implements stand-ins for them):
    reforge_audit.log_audit_event(...)
    reforge_audit.generate_report(...)
    reforge_recovery.scan_device_for_signatures(device_id, read_only=True)

Rust core integration point (Shared Contract Part D):
    rust_core.list_devices()
    rust_core.get_device_capabilities(device_id)
    rust_core.write_sanitize_command(device_id, method)   # Erase-only
    rust_core.overwrite_sectors(device_id, pattern)        # Erase-only
"""

from .methods import get_recommended_method
from .erase import execute_erase, handle_verification_failure
from .db import init_db

__all__ = [
    "get_recommended_method",
    "execute_erase",
    "handle_verification_failure",
    "init_db",
]
