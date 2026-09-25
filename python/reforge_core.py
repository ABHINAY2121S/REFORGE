"""
reforge_core stub — development placeholder.

In production this is the compiled PyO3 Rust extension (.pyd / .so) built
from the reforge_core Rust crate, which calls into the OS and device drivers
for raw device I/O. Until that crate is built and the .pyd is placed on the
Python path, this stub lets the sidecar start and all non-device commands
work normally. Device commands return a clearly-labelled empty/mock result.

HOW TO REPLACE:
  1. Build the Rust crate:  cd reforge_core && cargo build --release
  2. Copy the .pyd/.so to python/:  reforge_core.pyd (Windows) or reforge_core.so (Linux)
  3. Delete this file. Python will pick up the real extension automatically.
"""

from __future__ import annotations

import random


def list_devices() -> list[dict]:
    """Returns stub device list. Replace with real Rust impl."""
    return [
        {
            "id": "dev-stub-001",
            "serial": "STUB000001",
            "model": "STUB — No Rust Core",
            "vendor": "REFORGE Dev",
            "size_bytes": 0,
            "interface": "stub",
            "is_rotational": False,
            "is_removable": True,
            "is_host_drive": False,
            "capabilities": [],
            "firmware_version": "0.0.0-stub",
        }
    ]


def get_device_capabilities(device_id: str) -> dict:
    """Returns stub capabilities. Replace with real Rust impl."""
    return {
        "device_id": device_id,
        "supports_secure_erase": False,
        "supports_sanitize": False,
        "supports_nvme_format": False,
        "supports_overwrite": True,
        "is_ssd": False,
        "is_nvme": False,
        "is_hw_encrypted": False,
        "stub": True,
    }
