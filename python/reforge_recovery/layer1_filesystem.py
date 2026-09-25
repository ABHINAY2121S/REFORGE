"""
Layer 1 — Filesystem-aware recovery.

Tried first, always: if usable filesystem metadata ($MFT / inode /
directory entries) exists, it gives filename, timestamps, and exact
cluster locations — the highest-fidelity recovery available, so we never
fall through to carving when this succeeds.

Depends on `pytsk3` (The Sleuth Kit Python bindings). pytsk3 is a native
extension not available in every environment (it isn't installed in this
sandbox), so it's imported lazily and this layer degrades to "no metadata
available" rather than crashing the whole pipeline when it's missing —
callers (pipeline.py) then fall through to Layer 2/3 carving as normal.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator, Optional

try:
    import pytsk3  # type: ignore

    _HAS_PYTSK3 = True
except ImportError:  # pragma: no cover - environment-dependent
    pytsk3 = None  # type: ignore
    _HAS_PYTSK3 = False


@dataclass
class DeletedFileRecord:
    """One recoverable file found via filesystem metadata."""

    filename: str
    inode: int
    size: int
    is_deleted: bool
    byte_runs: list[tuple[int, int]]  # list of (offset, length) on-disk extents
    ctime: Optional[int]
    mtime: Optional[int]


class FilesystemUnavailable(Exception):
    """Raised when no parseable filesystem metadata exists on this device
    (e.g. a freshly wiped drive, or an unrecognized/corrupted filesystem).
    This is an expected, non-fatal condition — the pipeline treats it as
    a signal to fall through to Layer 2/3 carving, not as an error."""


def scan_filesystem(device_path: str) -> Iterator[DeletedFileRecord]:
    """
    Open the device/image at `device_path` with pytsk3, walk every
    partition's filesystem, and yield a DeletedFileRecord for every
    deleted-but-still-described directory entry found (i.e. an inode that
    still has a valid MFT/inode record but whose directory entry is
    marked unallocated).

    Raises FilesystemUnavailable if pytsk3 is not installed, the device
    has no recognizable filesystem, or no partition table/filesystem
    metadata parses at all (e.g. a freshly wiped drive — Erase's
    adversarial verification call goes through scan_device_for_signatures
    in pipeline.py, which intentionally skips this layer entirely for
    exactly that reason; see pipeline.py's docstring).
    """
    if not _HAS_PYTSK3:
        raise FilesystemUnavailable("pytsk3 is not installed in this environment")

    try:
        img = pytsk3.Img_Info(device_path)
    except Exception as exc:  # pytsk3 raises its own IOError subclasses
        raise FilesystemUnavailable(f"could not open device image: {exc}") from exc

    found_any_fs = False
    try:
        volume = pytsk3.Volume_Info(img)
        partitions = list(volume)
    except Exception:
        # No partition table — try the whole image as a single filesystem.
        partitions = [None]

    for part in partitions:
        offset = part.start * 512 if part is not None else 0
        try:
            fs = pytsk3.FS_Info(img, offset=offset)
        except Exception:
            continue
        found_any_fs = True
        yield from _walk_directory(fs, fs.open_dir(path="/"), "/")

    if not found_any_fs:
        raise FilesystemUnavailable("no recognizable filesystem on any partition")


def _walk_directory(fs: "pytsk3.FS_Info", directory: "pytsk3.Directory", path_prefix: str) -> Iterator[DeletedFileRecord]:
    for entry in directory:
        try:
            name = entry.info.name.name.decode("utf-8", errors="replace")
        except AttributeError:
            continue
        if name in (".", ".."):
            continue

        is_deleted = (
            entry.info.meta is not None
            and int(entry.info.meta.flags) & int(pytsk3.TSK_FS_META_FLAG_UNALLOC) != 0
        )

        meta = entry.info.meta
        if meta is None:
            continue

        try:
            is_dir = int(meta.type) == int(pytsk3.TSK_FS_META_TYPE_DIR)
        except Exception:
            is_dir = False

        full_path = f"{path_prefix.rstrip('/')}/{name}"

        if is_dir:
            if not is_deleted:
                try:
                    sub = entry.as_directory()
                    yield from _walk_directory(fs, sub, full_path)
                except Exception:
                    pass
            continue

        if not is_deleted:
            continue  # Layer 1 only reports what's deleted; live files aren't "recovery"

        byte_runs: list[tuple[int, int]] = []
        try:
            for attr in entry:
                for run in attr:
                    byte_runs.append((run.addr * fs.info.block_size, run.len * fs.info.block_size))
        except Exception:
            pass

        yield DeletedFileRecord(
            filename=full_path,
            inode=int(meta.addr),
            size=int(meta.size),
            is_deleted=True,
            byte_runs=byte_runs,
            ctime=int(meta.crtime) if hasattr(meta, "crtime") else None,
            mtime=int(meta.mtime) if hasattr(meta, "mtime") else None,
        )
