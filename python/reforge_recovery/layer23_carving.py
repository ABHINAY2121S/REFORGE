"""
Layer 2/3 — Signature + structure carving.

Used whenever Layer 1 finds no usable filesystem metadata for a region
(or none at all, e.g. an unpartitioned/freshly-wiped device). Scans raw
bytes for known file headers, then hands off to that file type's
structural parser (signatures.py) to compute the file's TRUE end by
actually parsing the format, rather than trusting a footer signature
alone (footer byte sequences can occur spuriously inside compressed or
binary payloads).

Cross-confirms the header-based type guess with libmagic where available.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .signatures import SIGNATURES, ParseResult

try:
    import magic  # type: ignore

    _HAS_LIBMAGIC = True
except ImportError:  # pragma: no cover - environment-dependent
    magic = None  # type: ignore
    _HAS_LIBMAGIC = False


@dataclass
class CarvedFile:
    file_type: str
    start_offset: int
    end_offset: Optional[int]  # None if structural parse failed (footer-only fallback)
    is_structurally_complete: bool  # True iff the structural parser fully validated it
    is_fragmented: bool  # True iff header found but structural end lies beyond scanned region
    magic_confirms: Optional[bool]  # None if libmagic unavailable
    detail: str


def _magic_type_for(buf: bytes) -> Optional[str]:
    if not _HAS_LIBMAGIC:
        return None
    try:
        return magic.from_buffer(buf, mime=True)  # type: ignore[union-attr]
    except Exception:
        return None


_MIME_BY_TYPE = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "pdf": "application/pdf",
    "zip": "application/zip",
    "docx": "application/zip",  # office formats report as zip via bare libmagic without deeper inspection
    "xlsx": "application/zip",
    "pptx": "application/zip",
    "sqlite": "application/x-sqlite3",
    "mp4": "video/mp4",
}


def carve_buffer(buf: bytes, base_offset: int = 0) -> list[CarvedFile]:
    """
    Scan `buf` for every known header signature (at any offset, since a
    carved region may contain several files back-to-back or overlapping
    due to fragmentation) and structurally parse each hit found.

    `base_offset` lets callers report absolute device offsets while this
    function itself only ever indexes into the buffer it was given.
    """
    results: list[CarvedFile] = []
    n = len(buf)
    pos = 0
    while pos < n:
        matched_type = None
        for file_type, spec in SIGNATURES.items():
            if buf.startswith(spec.header, pos):
                matched_type = file_type
                break
        if matched_type is None:
            pos += 1
            continue

        spec = SIGNATURES[matched_type]
        candidate = buf[pos:]
        parse: ParseResult = spec.parser(candidate)

        magic_type = _magic_type_for(candidate[: min(len(candidate), 4096)])
        magic_confirms: Optional[bool]
        if magic_type is None:
            magic_confirms = None
        else:
            magic_confirms = magic_type == _MIME_BY_TYPE.get(matched_type)

        if parse.valid and parse.end_offset is not None:
            results.append(
                CarvedFile(
                    file_type=matched_type,
                    start_offset=base_offset + pos,
                    end_offset=base_offset + pos + parse.end_offset,
                    is_structurally_complete=True,
                    is_fragmented=False,
                    magic_confirms=magic_confirms,
                    detail=parse.detail,
                )
            )
            pos = pos + max(parse.end_offset, 1)
        else:
            # Header found but structure didn't resolve within this
            # buffer: either genuinely fragmented (true end lies in a
            # later, non-adjacent region) or corrupted. Flag it for
            # Layer 4 fragment reassembly rather than discarding it.
            results.append(
                CarvedFile(
                    file_type=matched_type,
                    start_offset=base_offset + pos,
                    end_offset=None,
                    is_structurally_complete=False,
                    is_fragmented=True,
                    magic_confirms=magic_confirms,
                    detail=parse.detail,
                )
            )
            pos += 1  # keep scanning; don't skip potential overlapping headers

    return results
