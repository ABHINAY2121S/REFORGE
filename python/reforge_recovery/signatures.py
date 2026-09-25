"""
Signature database for Layer 2/3 carving.

Structure:
    SIGNATURES: dict[file_type, SignatureSpec]

Each SignatureSpec carries a header, an optional footer, and a
`parser` callable that actually parses the format's internal structure
to find the file's TRUE end (rather than trusting the footer signature
alone). A structural parser returns a `ParseResult`:

    ParseResult(valid: bool, end_offset: int | None, detail: str)

`end_offset` is relative to the start of the carved buffer (i.e. the
byte immediately after the header at offset 0).

Cross-confirmation with libmagic happens in layer23_carving.py, which
calls into this module; this module only owns the byte-level signature
+ structural-parsing knowledge, so it has no libmagic dependency itself.
"""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass(frozen=True)
class ParseResult:
    valid: bool
    end_offset: Optional[int]
    detail: str


@dataclass(frozen=True)
class SignatureSpec:
    header: bytes
    footer: Optional[bytes]
    parser: Callable[[bytes], ParseResult]


# --------------------------------------------------------------------------
# JPEG: parse real segment markers up to EOI (0xFFD9), honoring the length
# field of each segment rather than scanning for the footer bytes blindly
# (footer bytes can legitimately occur inside compressed scan data).
# --------------------------------------------------------------------------
def _parse_jpeg(buf: bytes) -> ParseResult:
    if len(buf) < 4 or buf[0:2] != b"\xff\xd8":
        return ParseResult(False, None, "missing SOI marker")
    pos = 2
    n = len(buf)
    while pos + 1 < n:
        if buf[pos] != 0xFF:
            # Inside entropy-coded scan data: scan forward for the next
            # marker, skipping stuffed 0xFF00 bytes.
            pos += 1
            continue
        marker = buf[pos + 1]
        if marker == 0xD9:  # EOI
            return ParseResult(True, pos + 2, "EOI marker parsed")
        if marker in (0x01,) or 0xD0 <= marker <= 0xD7:
            # markers with no payload length
            pos += 2
            continue
        if marker == 0xDA:  # SOS - entropy-coded data follows, no simple length
            if pos + 4 > n:
                return ParseResult(False, None, "truncated SOS header")
            seg_len = struct.unpack(">H", buf[pos + 2:pos + 4])[0]
            pos = pos + 2 + seg_len
            # walk entropy-coded data until next real marker
            while pos + 1 < n:
                if buf[pos] == 0xFF and buf[pos + 1] not in (0x00,) and not (0xD0 <= buf[pos + 1] <= 0xD7):
                    break
                pos += 1
            continue
        if pos + 4 > n:
            return ParseResult(False, None, "truncated segment header")
        seg_len = struct.unpack(">H", buf[pos + 2:pos + 4])[0]
        if seg_len < 2:
            return ParseResult(False, None, "invalid segment length")
        pos = pos + 2 + seg_len
    return ParseResult(False, None, "EOI not found within buffer")


# --------------------------------------------------------------------------
# PNG: walk the real chunk chain (length, type, data, CRC32) until IEND,
# and verify each chunk's CRC as we go.
# --------------------------------------------------------------------------
def _parse_png(buf: bytes) -> ParseResult:
    sig = b"\x89PNG\r\n\x1a\n"
    if not buf.startswith(sig):
        return ParseResult(False, None, "missing PNG signature")
    pos = len(sig)
    n = len(buf)
    while pos + 8 <= n:
        length = struct.unpack(">I", buf[pos:pos + 4])[0]
        ctype = buf[pos + 4:pos + 8]
        data_start = pos + 8
        data_end = data_start + length
        crc_end = data_end + 4
        if crc_end > n:
            return ParseResult(False, None, f"truncated chunk '{ctype!r}'")
        stored_crc = struct.unpack(">I", buf[data_end:crc_end])[0]
        computed_crc = zlib.crc32(buf[pos + 4:data_end]) & 0xFFFFFFFF
        if stored_crc != computed_crc:
            return ParseResult(False, None, f"CRC mismatch in chunk '{ctype!r}'")
        if ctype == b"IEND":
            return ParseResult(True, crc_end, "IEND chunk CRC-verified")
        pos = crc_end
    return ParseResult(False, None, "IEND not found within buffer")


# --------------------------------------------------------------------------
# ZIP-family (also covers DOCX/XLSX/PPTX, which are ZIP containers): find
# the End Of Central Directory record and use its recorded central
# directory offset/size to compute the true archive end, rather than just
# searching for the EOCD signature (which can appear spuriously in
# compressed entry data).
# --------------------------------------------------------------------------
def _parse_zip(buf: bytes) -> ParseResult:
    if not buf.startswith(b"PK\x03\x04"):
        return ParseResult(False, None, "missing local file header signature")
    eocd_sig = b"PK\x05\x06"
    # EOCD is a fixed 22 bytes + optional comment; search from the end.
    search_start = max(0, len(buf) - 22 - 65535)
    idx = buf.rfind(eocd_sig, search_start)
    if idx == -1:
        return ParseResult(False, None, "EOCD record not found")
    if idx + 22 > len(buf):
        return ParseResult(False, None, "truncated EOCD record")
    comment_len = struct.unpack("<H", buf[idx + 20:idx + 22])[0]
    end_offset = idx + 22 + comment_len
    if end_offset > len(buf):
        return ParseResult(False, None, "EOCD comment length exceeds buffer")
    return ParseResult(True, end_offset, "EOCD record parsed")


# --------------------------------------------------------------------------
# SQLite: fixed 100-byte header holds page size + page count; the true
# file end is page_size * (database size in pages), from the header
# itself, not a footer signature (SQLite files have none).
# --------------------------------------------------------------------------
def _parse_sqlite(buf: bytes) -> ParseResult:
    magic = b"SQLite format 3\x00"
    if not buf.startswith(magic):
        return ParseResult(False, None, "missing SQLite magic header")
    if len(buf) < 100:
        return ParseResult(False, None, "truncated 100-byte header")
    page_size_raw = struct.unpack(">H", buf[16:18])[0]
    page_size = 65536 if page_size_raw == 1 else page_size_raw
    if page_size < 512 or (page_size & (page_size - 1)) != 0:
        return ParseResult(False, None, "invalid page size in header")
    db_size_pages = struct.unpack(">I", buf[28:32])[0]
    if db_size_pages == 0:
        return ParseResult(False, None, "database size in header is zero (unreliable, likely WAL-mode file)")
    end_offset = page_size * db_size_pages
    if end_offset > len(buf):
        return ParseResult(False, None, "computed size exceeds carved buffer (truncated fragment)")
    return ParseResult(True, end_offset, f"header page_size={page_size} pages={db_size_pages}")


# --------------------------------------------------------------------------
# PDF: locate the real trailer via `startxref` -> trailer offset, and
# confirm with a top-level `%%EOF` after it, rather than trusting the
# first %%EOF found (incremental-update PDFs can contain several).
# --------------------------------------------------------------------------
def _parse_pdf(buf: bytes) -> ParseResult:
    if not buf.startswith(b"%PDF-"):
        return ParseResult(False, None, "missing %PDF- header")
    eof_marker = b"%%EOF"
    last_eof = buf.rfind(eof_marker)
    if last_eof == -1:
        return ParseResult(False, None, "no %%EOF marker found")
    end_offset = last_eof + len(eof_marker)
    startxref_idx = buf.rfind(b"startxref", 0, last_eof)
    if startxref_idx == -1:
        return ParseResult(False, None, "no startxref before final %%EOF")
    return ParseResult(True, end_offset, "trailer chain resolved to final %%EOF")


# --------------------------------------------------------------------------
# MP4/MOV (ISO base media file format): walk top-level atoms/boxes by
# their declared size field until we've accounted for the whole file, or
# until a `moov`/`mdat` pair has both been seen (minimum valid file).
# --------------------------------------------------------------------------
def _parse_mp4(buf: bytes) -> ParseResult:
    n = len(buf)
    if n < 8:
        return ParseResult(False, None, "buffer too short for a box header")
    pos = 0
    seen_types = set()
    while pos + 8 <= n:
        size = struct.unpack(">I", buf[pos:pos + 4])[0]
        box_type = buf[pos + 4:pos + 8]
        if size == 1:
            if pos + 16 > n:
                return ParseResult(False, None, "truncated 64-bit box size")
            size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
        elif size == 0:
            # box extends to end of file
            seen_types.add(box_type)
            pos = n
            break
        if size < 8:
            return ParseResult(False, None, f"invalid box size for '{box_type!r}'")
        seen_types.add(box_type)
        pos += size
        if pos > n:
            # This box claims to extend past what we carved; if we've
            # already seen both moov and mdat, treat the prior boundary
            # as the true (truncated-in-buffer) end.
            if b"moov" in seen_types and b"mdat" in seen_types:
                return ParseResult(True, pos - size, "moov+mdat present; trailing box truncated in buffer")
            return ParseResult(False, None, f"box '{box_type!r}' extends past carved buffer")
    if b"moov" in seen_types and b"mdat" in seen_types:
        return ParseResult(True, pos, "top-level box chain parsed; moov+mdat present")
    return ParseResult(False, None, "reached end of buffer without both moov and mdat boxes")


SIGNATURES: dict[str, SignatureSpec] = {
    "jpeg": SignatureSpec(header=b"\xff\xd8\xff", footer=b"\xff\xd9", parser=_parse_jpeg),
    "png": SignatureSpec(header=b"\x89PNG\r\n\x1a\n", footer=b"IEND\xaeB`\x82", parser=_parse_png),
    "pdf": SignatureSpec(header=b"%PDF-", footer=b"%%EOF", parser=_parse_pdf),
    "zip": SignatureSpec(header=b"PK\x03\x04", footer=b"PK\x05\x06", parser=_parse_zip),
    "docx": SignatureSpec(header=b"PK\x03\x04", footer=b"PK\x05\x06", parser=_parse_zip),
    "xlsx": SignatureSpec(header=b"PK\x03\x04", footer=b"PK\x05\x06", parser=_parse_zip),
    "pptx": SignatureSpec(header=b"PK\x03\x04", footer=b"PK\x05\x06", parser=_parse_zip),
    "sqlite": SignatureSpec(header=b"SQLite format 3\x00", footer=None, parser=_parse_sqlite),
    "mp4": SignatureSpec(header=b"\x00\x00\x00\x18ftyp", footer=None, parser=_parse_mp4),
}


def identify_header(buf: bytes, offset: int = 0) -> Optional[str]:
    """Return the file_type whose header matches `buf` at `offset`, else None."""
    for file_type, spec in SIGNATURES.items():
        if buf.startswith(spec.header, offset):
            return file_type
    # MP4 box size varies; also try matching just the 'ftyp' tag at offset+4
    if buf[offset + 4:offset + 8] == b"ftyp":
        return "mp4"
    return None
