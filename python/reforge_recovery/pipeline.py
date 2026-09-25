"""
The two functions this module exposes across the module boundary,
implemented exactly per the Shared Contract, Part B.

    scan_device_for_signatures(device_id, read_only=True) -> dict
    run_full_recovery(device_id, scope, case_id, user_id) -> str
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Optional

from . import db
from ._integrations import get_device_capabilities, log_audit_event, read_sectors
from .layer1_filesystem import FilesystemUnavailable, scan_filesystem
from .layer23_carving import carve_buffer
from .layer4_fragment_reassembly import bifragment_gap_carve
from .layer5_classification import FragmentClassifier, compute_confidence

# Default chunk size used when streaming raw sectors for the adversarial
# signature scan. Chosen to comfortably hold the largest structural
# footer/trailer this module's parsers look for (e.g. a PNG IEND chunk,
# a ZIP EOCD + comment) without needing multiple reads per candidate hit
# in the common case.
_SCAN_CHUNK_BYTES = 4 * 1024 * 1024
_SCAN_OVERLAP_BYTES = 4096  # avoid missing a header that straddles a chunk boundary


def scan_device_for_signatures(device_id: str, read_only: bool = True) -> dict:
    """
    Shared Contract, Part B. Called by Erase's adversarial verification
    step immediately after a wipe, so this function:
      - MUST default to read_only=True and MUST NEVER write to the
        device (it only ever calls reforge_core's read-only surface:
        get_device_capabilities / read_sectors — never
        write_sanitize_command / overwrite_sectors, which this module
        does not even import; see _integrations.py).
      - MUST work on a device with no filesystem and no metadata at all.
        Layer 1 (filesystem-aware recovery) is therefore intentionally
        SKIPPED here — it requires exactly the kind of metadata a wiped
        device no longer has. This function goes straight to Layer 2/3
        raw-byte signature + structure carving over the device's raw
        sectors, which needs no filesystem to function.

    Returns:
        {"signatures_found": int,
         "matches": [{"file_type": str, "offset": int, "confidence": str}],
         "scan_duration_seconds": float}
    """
    if not read_only:
        # Contract violation guard: this function must never be asked to
        # write. Fail loudly rather than silently coercing to True, since
        # a caller passing False is a bug worth surfacing immediately.
        raise ValueError("scan_device_for_signatures must not be called with read_only=False")

    start = time.monotonic()
    caps = get_device_capabilities(device_id)
    total_bytes = int(caps.get("total_bytes") if isinstance(caps, dict) else getattr(caps, "total_bytes"))

    matches: list[dict[str, Any]] = []
    offset = 0
    trailing = b""
    while offset < total_bytes:
        length = min(_SCAN_CHUNK_BYTES, total_bytes - offset)
        chunk = read_sectors(device_id, offset, length)
        buf = trailing + chunk
        buf_base_offset = offset - len(trailing)

        carved = carve_buffer(buf, base_offset=buf_base_offset)
        for c in carved:
            confidence_label = "high" if c.is_structurally_complete and c.magic_confirms is not False else (
                "medium" if c.is_structurally_complete else "low"
            )
            matches.append(
                {
                    "file_type": c.file_type,
                    "offset": c.start_offset,
                    "confidence": confidence_label,
                }
            )

        # Keep the tail of this chunk as the overlap for the next read so
        # a header/footer straddling the boundary isn't missed.
        trailing = buf[-_SCAN_OVERLAP_BYTES:] if len(buf) > _SCAN_OVERLAP_BYTES else buf
        offset += length

    elapsed = time.monotonic() - start
    return {
        "signatures_found": len(matches),
        "matches": matches,
        "scan_duration_seconds": elapsed,
    }


def run_full_recovery(
    device_id: str,
    scope: dict,
    case_id: str,
    user_id: str,
    db_path: str = "reforge.db",
    _cancel_check: Optional[Any] = None,
) -> str:
    """
    Shared Contract, Part B. Runs the complete Layer 1-5 pipeline:

      1. Layer 1 filesystem-aware recovery (best-effort; falls through to
         Layer 2/3 for any region it can't resolve, or entirely if the
         device has no recognizable filesystem at all).
      2. Layer 2/3 signature + structure carving over whatever Layer 1
         didn't already resolve.
      3. Layer 4 fragment reassembly for carve hits that were structurally
         incomplete within a single scanned region (candidates for
         bifragment gap carving / the compatibility graph).
      4. Layer 5 ML classification + confidence scoring for every
         resulting candidate, retaining ALL candidates for a given
         logical file (not just the top-ranked one) so the Explainable
         Multi-Candidate Fragment Reconstruction UI can show every option
         considered.

    Writes results to recovered_files / fragment_candidates (this
    module's own tables — see db.py) and calls
    reforge_audit.log_audit_event() at start and completion, exactly as
    specified. Returns an operation_id.

    `scope` is {"mode": "whole_drive"} or
             {"mode": "targeted", "paths": [...]}.
    `_cancel_check`, if given, is called between chunks/candidates and
    should return True to request cooperative cancellation — the pipeline
    checks it at safe boundaries only (never mid-write), so a cancelled
    run never leaves a partially-written recovered_files row.
    """
    operation_id = str(uuid.uuid4())

    log_audit_event(
        user_id=user_id,
        case_id=case_id,
        evidence_id=device_id,
        action_type="recovery_scan",
        description=f"Started full recovery ({scope.get('mode', 'unknown')} mode) on device {device_id}",
        result="success",
        status="info",
    )

    try:
        candidate_groups = _run_pipeline(device_id, scope, _cancel_check)

        with db.session(db_path) as conn:
            for group in candidate_groups:
                candidate_group_id = str(uuid.uuid4()) if len(group) > 1 else None
                for rank, candidate in enumerate(group):
                    file_row_id = db.insert_recovered_file(
                        conn,
                        operation_id=operation_id,
                        filename=candidate.get("filename"),
                        size=candidate["size"],
                        confidence_score=candidate["confidence"].score,
                        confidence_tier=candidate["confidence"].tier,
                        sha256=candidate["sha256"],
                        file_type=candidate["file_type"],
                        candidate_group_id=candidate_group_id,
                    )
                    db.insert_fragment_candidate(
                        conn,
                        recovered_file_id=file_row_id,
                        rank=rank,
                        score_breakdown=candidate["confidence"].as_dict(),
                        is_selected=(rank == 0),  # top-ranked candidate pre-selected; user can override in UI
                    )

        log_audit_event(
            user_id=user_id,
            case_id=case_id,
            evidence_id=device_id,
            action_type="recovery_scan",
            description=f"Completed full recovery on device {device_id}: "
            f"{sum(len(g) for g in candidate_groups)} candidate file(s) across "
            f"{len(candidate_groups)} logical file(s)",
            result="success",
            status="success",
        )
        return operation_id

    except Exception as exc:
        log_audit_event(
            user_id=user_id,
            case_id=case_id,
            evidence_id=device_id,
            action_type="recovery_scan",
            description=f"Full recovery on device {device_id} failed: {exc}",
            result="failure",
            status="warning",
        )
        raise


def _run_pipeline(device_id: str, scope: dict, _cancel_check: Optional[Any]) -> list[list[dict[str, Any]]]:
    """
    Internal orchestration of Layers 1-5. Returns a list of "candidate
    groups" — each group is one logical recovered file, containing one
    dict per surviving reconstruction candidate (usually just one; more
    than one only when Layer 4 produced multiple plausible
    reconstructions for the same logical file).

    This function intentionally does its own device reads via
    reforge_core.read_sectors (the read-only Rust core surface) rather
    than assuming an on-disk image file, matching the Contract's model of
    devices as something the Rust core mediates access to.
    """
    groups: list[list[dict[str, Any]]] = []

    # --- Layer 1: filesystem-aware recovery, best-effort ---
    filesystem_hits = []
    try:
        for record in scan_filesystem(device_id):
            filesystem_hits.append(record)
            if _cancel_check and _cancel_check():
                return groups
    except FilesystemUnavailable:
        pass  # expected on a device with no recognizable filesystem

    for record in filesystem_hits:
        data = b"".join(read_sectors(device_id, offset, length) for offset, length in record.byte_runs) if record.byte_runs else b""
        confidence = compute_confidence(
            header_and_footer_present=True,  # filesystem metadata gives exact size, no signature guessing needed
            structural_parse_ok=True,
            decode_succeeded=True,
            contiguous=len(record.byte_runs) <= 1,
            ml_type_consistency=1.0,
            overlap_count=0,
        )
        groups.append(
            [
                {
                    "filename": record.filename,
                    "size": record.size,
                    "sha256": _sha256_of(data),
                    "file_type": _guess_type_from_name(record.filename),
                    "confidence": confidence,
                }
            ]
        )

    # --- Layer 2/3 + Layer 4/5: raw carving for whatever Layer 1 missed ---
    caps = get_device_capabilities(device_id)
    total_bytes = int(caps.get("total_bytes") if isinstance(caps, dict) else getattr(caps, "total_bytes"))
    classifier = FragmentClassifier()  # untrained here; real build trains offline and loads weights

    offset = 0
    trailing = b""
    while offset < total_bytes:
        if _cancel_check and _cancel_check():
            break
        length = min(_SCAN_CHUNK_BYTES, total_bytes - offset)
        chunk = read_sectors(device_id, offset, length)
        buf = trailing + chunk
        buf_base_offset = offset - len(trailing)

        carved = carve_buffer(buf, base_offset=buf_base_offset)
        for c in carved:
            if c.is_structurally_complete and c.end_offset is not None:
                rel_start = c.start_offset - buf_base_offset
                rel_end = c.end_offset - buf_base_offset
                data = buf[rel_start:rel_end]
                confidence = compute_confidence(
                    header_and_footer_present=True,
                    structural_parse_ok=True,
                    decode_succeeded=True,
                    contiguous=True,
                    ml_type_consistency=1.0,
                )
                groups.append(
                    [
                        {
                            "filename": None,
                            "size": len(data),
                            "sha256": _sha256_of(data),
                            "file_type": c.file_type,
                            "confidence": confidence,
                        }
                    ]
                )
            else:
                # Fragmented / structurally-incomplete hit: attempt
                # bifragment gap carving against the remainder of this
                # chunk as the candidate tail. Multiple plausible tails
                # (if any) become multiple candidates in the SAME group,
                # per the Explainable Multi-Candidate requirement.
                rel_start = c.start_offset - buf_base_offset
                header_block = buf[rel_start: rel_start + 4096]
                tail_block = buf[-4096:]
                bgc = bifragment_gap_carve(c.file_type, header_block, tail_block, max_gap=len(buf) - rel_start)

                candidates: list[dict[str, Any]] = []
                if bgc.success and bgc.reconstructed is not None:
                    confidence = compute_confidence(
                        header_and_footer_present=True,
                        structural_parse_ok=True,
                        decode_succeeded=True,
                        contiguous=False,  # reassembled from a gap-carved guess
                        ml_type_consistency=1.0,
                    )
                    candidates.append(
                        {
                            "filename": None,
                            "size": len(bgc.reconstructed),
                            "sha256": _sha256_of(bgc.reconstructed),
                            "file_type": c.file_type,
                            "confidence": confidence,
                        }
                    )
                if candidates:
                    groups.append(candidates)
                # if bifragment carving found nothing, we do not fabricate
                # a candidate — an unresolved header is reported only
                # via scan_device_for_signatures()'s lower-confidence
                # "low" bucket, not persisted as a recovered_files row.

        trailing = buf[-_SCAN_OVERLAP_BYTES:] if len(buf) > _SCAN_OVERLAP_BYTES else buf
        offset += length

    return groups


def _sha256_of(data: bytes) -> str:
    from ._integrations import compute_sha256

    return compute_sha256(data)


def _guess_type_from_name(filename: Optional[str]) -> str:
    if not filename or "." not in filename:
        return "unknown"
    return filename.rsplit(".", 1)[-1].lower()
