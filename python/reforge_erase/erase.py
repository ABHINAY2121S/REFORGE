"""
execute_erase / handle_verification_failure

Implements Shared Contract Part C's destructive-operation functions plus
the Adaptive Sanitization Fallback USP. All calls into the Rust core's
write functions are centralized in reforge_erase.rust_core and are only
ever invoked from execute_erase() in this file -- no other function in
this package touches write_sanitize_command or overwrite_sectors.
"""

from __future__ import annotations

import sqlite3
from typing import Optional

from . import db
from . import rust_core
from .entropy import shannon_entropy_bits_per_byte
from .events import (
    EmitFn,
    ProgressStreamer,
    PHASE_ADVERSARIAL,
    PHASE_ERASING,
    PHASE_VERIFYING,
    default_emit,
)
from .methods import get_recommended_method
from .peer_modules import generate_report, log_audit_event, scan_device_for_signatures

MAX_TOTAL_ATTEMPTS = 3

# Methods that resolve to a hardware Sanitize / Secure Erase style command
# (routed through write_sanitize_command) vs. methods that resolve to a
# raw logical-block overwrite (routed through overwrite_sectors).
_HARDWARE_SANITIZE_METHODS = {
    "ata_scsi_sanitize_overwrite_ext",
    "sanitize_block_erase",
    "nvme_sanitize_block_or_crypto_erase",
    "nvme_format_ses1",
    "nvme_format_ses2",
    "psid_revert_crypto_erase",
    "psid_revert_crypto_erase_plus_overwrite_verify",
    "erase_sanitize_secure_trim",
}


def _uses_hardware_sanitize(method: str) -> bool:
    return method in _HARDWARE_SANITIZE_METHODS


def _validate_device(device_id: str) -> dict:
    """
    Safety constraint: never accept a raw device_id from the frontend
    without checking it against the Rust-provided device list first. This
    is what guarantees the host boot drive (already excluded by Rust) can
    never be selected, and that we're not acting on an unknown/fabricated
    device_id.
    """
    known_devices = rust_core.list_devices()
    match = next((d for d in known_devices if d.get("id") == device_id), None)
    if match is None:
        raise ValueError(
            f"device_id '{device_id}' is not present in the Rust core's "
            f"validated device list; refusing to act on it."
        )
    return match


def execute_erase(
    device_id: str,
    method: str,
    case_id: str,
    user_id: str,
    dry_run: bool = False,
    *,
    conn: Optional[sqlite3.Connection] = None,
    emit: EmitFn = default_emit,
    _operation_id: Optional[str] = None,
    _attempt_number: Optional[int] = None,
) -> str:
    """
    Shared Contract Part C. `conn` and `emit` are dependency-injection
    seams (a real SQLite connection and the real Tauri emitter respectively
    are wired in at the application entry point); they default sensibly so
    the documented 5-argument call shape still works unchanged.

    `_operation_id` / `_attempt_number` are private continuation hooks used
    only by handle_verification_failure() to keep a retry attached to the
    same operation record instead of opening a new one -- not part of the
    public contract and never passed by the frontend.
    """
    if conn is None:
        conn = sqlite3.connect(":memory:")
        db.init_db(conn)

    device_info = _validate_device(device_id)

    if _operation_id is None:
        operation_id = db.create_operation(conn, case_id, device_id, "erase", user_id)
        attempt_number = 1
    else:
        operation_id = _operation_id
        attempt_number = _attempt_number or 1

    log_audit_event(
        user_id=user_id,
        case_id=case_id,
        evidence_id=device_id,
        action_type="erase_execute",
        description=f"{'Dry run' if dry_run else 'Erase'} started using method '{method}' "
        f"(attempt {attempt_number}).",
        result="in_progress",
        status="info",
    )

    capacity = device_info.get("capacity", 0) or 0
    streamer = ProgressStreamer(operation_id=operation_id, bytes_total=capacity, emit=emit)

    if dry_run:
        _simulate_progress(streamer)
        db.update_operation_status(
            conn, operation_id, status="dry_run_complete", method_used=method, completed=True
        )
        db.record_attempt(conn, operation_id, method, attempt_number, result="dry_run_complete")
        log_audit_event(
            user_id=user_id,
            case_id=case_id,
            evidence_id=device_id,
            action_type="erase_execute",
            description=f"Dry run completed for method '{method}'. No device writes occurred.",
            result="success",
            status="success",
        )
        return operation_id

    # --- Real, destructive path -------------------------------------------------
    streamer.report(PHASE_ERASING, bytes_written=0, force=True)
    if _uses_hardware_sanitize(method):
        sanitize_result = rust_core.write_sanitize_command(device_id, method)
        hardware_reported_success = bool(sanitize_result.get("success"))
    else:
        rust_core.overwrite_sectors(
            device_id, {"passes": 1, "fill": "random", "verify_entropy": True}
        )
        hardware_reported_success = True
    streamer.report(PHASE_ERASING, bytes_written=capacity, force=True)

    # Verification / entropy phase.
    sample = device_info.get("post_erase_sample_bytes", b"")
    entropy = shannon_entropy_bits_per_byte(sample) if sample else None
    streamer.report(
        PHASE_VERIFYING, bytes_written=capacity, entropy_bits_per_byte=entropy, force=True
    )

    # Mandatory adversarial verification -- there is no code path that
    # marks an erase Verified without this having run.
    streamer.report(PHASE_ADVERSARIAL, bytes_written=capacity, force=True)
    scan_result = scan_device_for_signatures(device_id, read_only=True)
    signatures_found = scan_result.get("signatures_found", 0)
    verified = signatures_found == 0

    db.record_attempt(
        conn,
        operation_id,
        method,
        attempt_number,
        result="verified" if verified else "failed_verification",
        entropy_result=entropy,
        verified=verified,
    )

    if verified:
        db.update_operation_status(
            conn, operation_id, status="verified", method_used=method, completed=True
        )
        log_audit_event(
            user_id=user_id,
            case_id=case_id,
            evidence_id=device_id,
            action_type="erase_verify",
            description=f"Erase using '{method}' passed adversarial verification "
            f"(0 recoverable signatures).",
            result="success",
            status="success",
        )
        # Finding 2 fix (Session 4 audit): log custody "erased" event and
        # auto-generate Certificate of Sanitization on every verified erase.
        # Both were imported but never called — now they are.
        from .peer_modules import generate_report as _gen_report
        record_chain_of_custody(
            evidence_id=device_id,
            event_type="erased",
            from_person=user_id,
            to_person=user_id,
            location="REFORGE automated",
            reason=f"Sanitization verified via adversarial check; method={method}",
        )
        try:
            _gen_report("sanitization_cert", case_id, operation_id)
        except Exception as _exc:
            # Report generation failure must never block the verified status
            # being returned — log it to stderr for diagnostics.
            import sys
            print(
                f"[reforge_erase] sanitization_cert generation failed: {_exc}",
                file=sys.stderr,
            )
    else:
        db.update_operation_status(
            conn, operation_id, status="verification_failed", method_used=method, completed=False
        )
        log_audit_event(
            user_id=user_id,
            case_id=case_id,
            evidence_id=device_id,
            action_type="erase_verify",
            description=f"Erase using '{method}' FAILED adversarial verification: "
            f"{signatures_found} signature(s) found.",
            result="failure",
            status="warning",
        )
        # Self-improving Firmware Sanitize Reliability Database: a
        # hardware-reported "success" that adversarial verification then
        # contradicts means that model/firmware combo can't be trusted.
        if hardware_reported_success and _uses_hardware_sanitize(method):
            db.upsert_firmware_reliability(
                conn,
                model=device_info.get("model", "unknown"),
                firmware_version=device_info.get("firmware_version", "unknown"),
                status="unreliable",
                source=case_id,
            )

    return operation_id


def _simulate_progress(streamer: ProgressStreamer) -> None:
    """Fake but real-timed progress animation for Dry Run mode -- no device
    writes, but the full stepper UI (including the entropy sweep) still has
    something to animate against."""
    steps = 10
    for i in range(1, steps + 1):
        streamer.report(
            PHASE_ERASING if i < steps else PHASE_VERIFYING,
            bytes_written=int(streamer.bytes_total * i / steps),
            entropy_bits_per_byte=7.2 + (0.08 * i) if i >= steps - 2 else None,
            force=True,
        )


def handle_verification_failure(
    operation_id: str,
    device_id: str,
    failed_method: str,
    *,
    conn: Optional[sqlite3.Connection] = None,
    emit: EmitFn = default_emit,
) -> dict:
    """Shared Contract Part C -- Adaptive Sanitization Fallback."""
    if conn is None:
        conn = sqlite3.connect(":memory:")
        db.init_db(conn)

    operation = db.get_operation(conn, operation_id)
    if operation is None:
        raise ValueError(f"Unknown operation_id: {operation_id}")

    attempts = db.get_attempts_for_operation(conn, operation_id)
    attempted_methods = {row["method"] for row in attempts}
    attempt_count = len(attempts)

    if attempt_count >= MAX_TOTAL_ATTEMPTS:
        db.update_operation_status(
            conn, operation_id, status="incomplete", completed=True
        )
        log_audit_event(
            user_id=operation["performed_by"],
            case_id=operation["case_id"],
            evidence_id=device_id,
            action_type="erase_verify",
            description=f"Adaptive fallback stopped after {attempt_count} attempts "
            f"(cap reached). Investigator acknowledgment required before this "
            f"case record can be closed.",
            result="blocked",
            status="blocked",
        )
        return {"fallback_attempted": False, "new_method": None, "final_status": "incomplete"}

    device_info = _validate_device(device_id)
    candidate = _next_candidate_method(device_info, attempted_methods)

    if candidate is None:
        db.update_operation_status(conn, operation_id, status="incomplete", completed=True)
        log_audit_event(
            user_id=operation["performed_by"],
            case_id=operation["case_id"],
            evidence_id=device_id,
            action_type="erase_verify",
            description="No untried applicable sanitization method remains for this "
            "device. Investigator acknowledgment required before this case "
            "record can be closed.",
            result="blocked",
            status="blocked",
        )
        return {"fallback_attempted": False, "new_method": None, "final_status": "incomplete"}

    execute_erase(
        device_id,
        candidate,
        operation["case_id"],
        operation["performed_by"],
        dry_run=False,
        conn=conn,
        emit=emit,
        _operation_id=operation_id,
        _attempt_number=attempt_count + 1,
    )

    return {"fallback_attempted": True, "new_method": candidate, "final_status": "retrying"}


def _next_candidate_method(device_info: dict, attempted_methods: set[str]) -> Optional[str]:
    """
    Escalation ladder derived from the same decision table as
    get_recommended_method(), minus whatever's already been tried.
    """
    primary = get_recommended_method(device_info)["method"]
    interface = (device_info.get("interface") or "").lower()
    media_type = (device_info.get("media_type") or "").lower()
    is_opal = bool(device_info.get("is_opal_sed"))

    if is_opal:
        ladder = ["psid_revert_crypto_erase", "psid_revert_crypto_erase_plus_overwrite_verify"]
    elif interface in ("sata", "sas") and media_type == "hdd":
        ladder = ["ata_scsi_sanitize_overwrite_ext", "full_overwrite_multipass_ext"]
    elif interface == "sata" and media_type == "ssd":
        ladder = [
            "sanitize_block_erase",
            "ata_secure_erase_enhanced",
            "full_overwrite_multipass_ext",
        ]
    elif interface == "nvme":
        ladder = [
            "nvme_sanitize_block_or_crypto_erase",
            "nvme_format_ses1",
            "nvme_format_ses2",
            "full_overwrite_multipass_ext",
        ]
    elif interface in ("usb", "sd"):
        ladder = ["wear_aware_multipass_overwrite", "full_overwrite_multipass_ext"]
    elif interface in ("emmc", "ufs"):
        ladder = ["erase_sanitize_secure_trim", "full_overwrite_multipass_ext"]
    else:
        ladder = [primary, "full_overwrite_multipass_ext"]

    for candidate in ladder:
        if candidate not in attempted_methods:
            return candidate
    return None
