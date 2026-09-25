"""
reforge_recovery
=================

REFORGE Recovery module. Owns the full Scan -> Review -> Export recovery
pipeline (filesystem-aware recovery, signature/structure carving, fragment
reassembly, ML classification + confidence scoring), the file-preview
backend, and the two functions exposed across module boundaries per the
Shared Contract, Part B:

    scan_device_for_signatures(device_id, read_only=True) -> dict
    run_full_recovery(device_id, scope, case_id, user_id) -> str

Cross-module integration points (NOT implemented in this package):

  * `reforge_audit` — Verification & Audit module. This package calls
    reforge_audit.compute_sha256 / hash_file / log_audit_event exactly as
    specified in the Shared Contract, Part A. We do not implement hashing
    or audit logging ourselves anywhere in this package.

  * `reforge_core` — the shared Rust core (Part D of the contract),
    exposed to Python via bindings assumed to be named `reforge_core`.
    We only ever call its read-only functions (list_devices,
    get_device_capabilities, read_sectors); we never call the
    write/destructive functions, which belong exclusively to
    `reforge_erase`.

Both of `reforge_audit` and `reforge_core` are external dependencies of
this package and are NOT vendored, mocked, or reimplemented here. See
reforge_recovery/_integrations.py for the single place those imports
happen, and see tests/README.md for how the test suite exercises this
package without those real modules present.
"""

from .pipeline import scan_device_for_signatures, run_full_recovery

__all__ = ["scan_device_for_signatures", "run_full_recovery"]

__version__ = "0.1.0"
