"""
Progress event streaming.

In production this is wired to Tauri's event system (e.g. a pytauri
`AppHandle.emit(event_name, payload)` call, or a bridge that forwards to
`window.__TAURI__.event` on the frontend). That wiring is an integration
point outside this package's scope, so `execute_erase` accepts an
`emit` callable (defaulting to a Tauri-shaped emitter) rather than
importing a concrete Tauri binding directly -- this keeps the module
testable and keeps the real Tauri wiring a one-line swap at the call site.

Emitted event name: "erase-progress"
Payload shape:
    {
      "operation_id": str,
      "phase": "erasing" | "verifying" | "running_adversarial_check",
      "bytes_written": int,
      "bytes_total": int,
      "speed_bytes_per_sec": float,
      "eta_seconds": float | None,
      "entropy_bits_per_byte": float | None,   # only during "verifying"
    }
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, Optional

EmitFn = Callable[[str, dict], None]

EVENT_NAME = "erase-progress"

# Phase labels shown verbatim in the UI, per the build prompt.
PHASE_ERASING = "Erasing..."
PHASE_VERIFYING = "Verifying..."
PHASE_ADVERSARIAL = "Running adversarial recovery check..."

THROTTLE_SECONDS = 0.25


def default_emit(event_name: str, payload: dict) -> None:
    """
    Fallback emitter used only when no Tauri-wired emitter is supplied
    (e.g. in tests or a headless CLI run). Production callers should pass
    the real Tauri emit function in.
    """
    try:
        import tauri  # type: ignore  # pragma: no cover - real integration point

        tauri.emit(event_name, payload)  # pragma: no cover
    except ImportError:
        # No Tauri runtime available (tests, CLI, dry runs without a UI).
        pass


@dataclass
class ProgressStreamer:
    operation_id: str
    bytes_total: int
    emit: EmitFn = default_emit
    _last_emit_at: float = field(default=0.0, init=False)
    _last_bytes: int = field(default=0, init=False)
    _last_time: float = field(default_factory=time.monotonic, init=False)
    _speed_samples: list[float] = field(default_factory=list, init=False)

    def report(
        self,
        phase_label: str,
        bytes_written: int,
        entropy_bits_per_byte: Optional[float] = None,
        force: bool = False,
    ) -> None:
        now = time.monotonic()
        if not force and (now - self._last_emit_at) < THROTTLE_SECONDS:
            return

        elapsed = max(now - self._last_time, 1e-6)
        instantaneous_speed = (bytes_written - self._last_bytes) / elapsed
        self._speed_samples.append(instantaneous_speed)
        self._speed_samples = self._speed_samples[-5:]
        smoothed_speed = sum(self._speed_samples) / len(self._speed_samples)

        remaining_bytes = max(self.bytes_total - bytes_written, 0)
        eta_seconds = remaining_bytes / smoothed_speed if smoothed_speed > 0 else None

        self.emit(
            EVENT_NAME,
            {
                "operation_id": self.operation_id,
                "phase": phase_label,
                "bytes_written": bytes_written,
                "bytes_total": self.bytes_total,
                "speed_bytes_per_sec": smoothed_speed,
                "eta_seconds": eta_seconds,
                "entropy_bits_per_byte": entropy_bits_per_byte,
            },
        )

        self._last_emit_at = now
        self._last_bytes = bytes_written
        self._last_time = now
