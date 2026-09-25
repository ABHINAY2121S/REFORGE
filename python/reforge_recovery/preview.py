"""
File preview backend.

Rules (Shared Contract / module prompt):
  - images (jpg/png/gif)  -> raw bytes, for direct <img> rendering
  - PDF                   -> raw bytes, for a bundled offline PDF.js viewer
                             (frontend must not fetch PDF.js from a CDN)
  - plain text / CSV      -> decoded text
  - anything else         -> metadata only + "no preview available" flag

NEVER shell out to the OS's default file handler for a recovered file.
Recovered content is untrusted (it came off a device under forensic
examination) and handing it to an arbitrary OS-registered handler is a
real code-execution / exploit risk. This module never calls
os.system / subprocess / os.startfile / the `open` CLI or anything
equivalent, on principle, even for types it doesn't have a native
preview for.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

_IMAGE_TYPES = {"jpeg", "jpg", "png", "gif"}
_TEXT_TYPES = {"txt", "csv", "text", "json", "log"}


@dataclass
class PreviewResult:
    kind: str  # "image" | "pdf" | "text" | "unsupported"
    raw_bytes: Optional[bytes]
    text: Optional[str]
    metadata: dict
    preview_available: bool


def get_preview(
    file_type: str,
    data: bytes,
    filename: Optional[str],
    size: int,
    sha256: str,
) -> PreviewResult:
    """
    Build a preview payload for the frontend. `data` is the already-
    recovered file's bytes (read from wherever the pipeline persisted
    recovered content) — this function performs no device or filesystem
    I/O of its own and never invokes an external program on `data`.
    """
    normalized_type = file_type.lower()
    metadata = {"file_type": file_type, "filename": filename, "size": size, "sha256": sha256}

    if normalized_type in _IMAGE_TYPES:
        return PreviewResult(kind="image", raw_bytes=data, text=None, metadata=metadata, preview_available=True)

    if normalized_type == "pdf":
        # Raw bytes handed to the frontend's bundled, offline PDF.js
        # viewer component; this module does not render PDFs itself and
        # does not fetch any viewer assets from a CDN.
        return PreviewResult(kind="pdf", raw_bytes=data, text=None, metadata=metadata, preview_available=True)

    if normalized_type in _TEXT_TYPES:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("utf-8", errors="replace")
        return PreviewResult(kind="text", raw_bytes=None, text=text, metadata=metadata, preview_available=True)

    return PreviewResult(kind="unsupported", raw_bytes=None, text=None, metadata=metadata, preview_available=False)
