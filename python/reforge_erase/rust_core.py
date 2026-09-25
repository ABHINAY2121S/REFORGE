"""
Integration point for the shared Rust core (Shared Contract Part D).

This module is NOT implemented here -- it is out of scope for the Erase
module, per the build contract. We import it lazily so that:
  * unit tests can inject a fake `rust_core` module via sys.modules without
    this package needing any test-only branching in production code, and
  * a clear ImportError is raised at call time (not import time) if the
    real Rust bindings aren't wired up yet, rather than failing to import
    reforge_erase entirely during development.

Per the contract:
  - list_devices(), get_device_capabilities(), read_sectors() are
    read-only and safe for any module to call.
  - write_sanitize_command() and overwrite_sectors() are destructive and
    MUST ONLY be called from reforge_erase.erase (centralized here for
    auditability). No other function in this package may call them.
"""

from __future__ import annotations

import importlib
from typing import Any


def _rust_core() -> Any:
    """Resolve the real `rust_core` bindings at call time."""
    return importlib.import_module("rust_core")


def get_device_capabilities(device_id: str) -> dict:
    """Read-only. See Shared Contract Part D: DeviceCapabilities."""
    return _rust_core().get_device_capabilities(device_id)


def list_devices() -> list[dict]:
    """Read-only. Rust core guarantees the host boot drive is excluded."""
    return _rust_core().list_devices()


def write_sanitize_command(device_id: str, method: str) -> dict:
    """
    DESTRUCTIVE. Only reforge_erase.erase.execute_erase() may call this.
    Returns a SanitizeResult-shaped dict, e.g.
    {"success": bool, "reported_status": str, "raw_output": str}
    """
    return _rust_core().write_sanitize_command(device_id, method)


def overwrite_sectors(device_id: str, pattern: dict) -> None:
    """
    DESTRUCTIVE. Only reforge_erase.erase.execute_erase() may call this.
    `pattern` is an OverwritePattern-shaped dict, e.g.
    {"passes": int, "fill": "zeros" | "random" | "complement", "verify_entropy": bool}
    Raises on failure (mirrors the Rust Result<(), Error> contract).
    """
    _rust_core().overwrite_sectors(device_id, pattern)
