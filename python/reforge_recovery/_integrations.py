"""
Single, explicit boundary for everything this package imports from the
OTHER two REFORGE modules / the shared Rust core.

Per the Shared Contract:
  - reforge_audit owns hashing + audit logging + chain-of-custody. This
    package must never write to audit_log directly, and must never
    implement its own SHA-256 code path.
  - reforge_core (Rust core, Part D) owns raw device I/O. This package
    may only call its READ-ONLY surface (list_devices,
    get_device_capabilities, read_sectors). The write/destructive
    functions (write_sanitize_command, overwrite_sectors) belong
    exclusively to reforge_erase and are intentionally not imported here.

Neither `reforge_audit` nor `reforge_core` is implemented in this
codebase. In the assembled application both are real installed packages
and the imports below resolve normally. In this standalone module's own
test suite (see tests/conftest.py) they are monkeypatched at the call
site for the duration of a test only — that is a CI-only test double,
not a production stand-in, and it lives entirely in test code, never in
this file or anywhere under reforge_recovery/.
"""

from __future__ import annotations

from typing import Any, Callable


def _unavailable(name: str) -> Callable[..., Any]:
    def _raise(*_args: Any, **_kwargs: Any) -> Any:
        raise ImportError(
            f"'{name}' is provided by another REFORGE module/the Rust core "
            f"and is not available in this standalone checkout. When wired "
            f"into the full application by Antigravity, this import "
            f"resolves to the real implementation. For running this "
            f"package's own tests in isolation, see tests/conftest.py."
        )

    return _raise


# --- reforge_audit (Verification & Audit module, Shared Contract Part A) ---
try:
    from reforge_audit import (  # type: ignore
        compute_sha256,
        hash_file,
        log_audit_event,
    )
except ImportError:  # pragma: no cover - exercised via test monkeypatching
    compute_sha256 = _unavailable("reforge_audit.compute_sha256")
    hash_file = _unavailable("reforge_audit.hash_file")
    log_audit_event = _unavailable("reforge_audit.log_audit_event")


# --- reforge_core (Rust core, Shared Contract Part D) — READ-ONLY only ---
try:
    from reforge_core import (  # type: ignore
        list_devices,
        get_device_capabilities,
        read_sectors,
    )
except ImportError:  # pragma: no cover - exercised via test monkeypatching
    list_devices = _unavailable("reforge_core.list_devices")
    get_device_capabilities = _unavailable("reforge_core.get_device_capabilities")
    read_sectors = _unavailable("reforge_core.read_sectors")


__all__ = [
    "compute_sha256",
    "hash_file",
    "log_audit_event",
    "list_devices",
    "get_device_capabilities",
    "read_sectors",
]
