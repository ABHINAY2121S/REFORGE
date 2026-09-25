"""
Cryptographic primitives owned by reforge_audit:

  - SHA-256 hashing (compute_sha256, hash_file) — used across the whole
    application, not just inside this module.
  - Deterministic canonical JSON serialization, used as the input to the
    audit hash chain so verification is reproducible byte-for-byte.
  - Merkle tree batching over audit_log entries, so a batch of N rows
    can be anchored (e.g. to Hyperledger Fabric, see ledger.py) with a
    single root hash instead of N separate anchors.
  - Ed25519 signing of Merkle roots / report digests.

Nothing in this file makes network calls. Signing keys are generated and
stored locally; there is no dependency on any external CA or KMS.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable

try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.encoding import HexEncoder
    _HAVE_NACL = True
except ImportError:  # pragma: no cover - degrade gracefully if PyNaCl absent
    _HAVE_NACL = False


# ---------------------------------------------------------------------------
# SHA-256 (Shared Contract Part A)
# ---------------------------------------------------------------------------

def compute_sha256(data: bytes) -> str:
    """Returns lowercase hex SHA-256 digest of the given bytes."""
    return hashlib.sha256(data).hexdigest()


def hash_file(file_path: str) -> str:
    """Returns lowercase hex SHA-256 digest of a file's full contents.

    Streams the file in fixed-size chunks so this works for large disk
    images without loading them fully into memory.
    """
    sha256 = hashlib.sha256()
    chunk_size = 1024 * 1024  # 1 MiB
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def compute_md5(data: bytes) -> str:
    """Secondary hash for the Chain of Custody UI, shown alongside SHA-256
    for compatibility with legacy forensic tooling. Never used for the
    integrity chain itself — SHA-256 is the only hash relied on for that.
    """
    return hashlib.md5(data).hexdigest()


# ---------------------------------------------------------------------------
# Canonical JSON
# ---------------------------------------------------------------------------

def canonical_json(obj: Any) -> str:
    """Deterministic JSON serialization: sorted keys, fixed separators,
    no insignificant whitespace, UTF-8 text. Given the same dict, this
    always produces the same string, which is required for
    verify_hash_chain() to be able to recompute chain_hash values.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


# ---------------------------------------------------------------------------
# Merkle tree batching
# ---------------------------------------------------------------------------

def _pair_hash(left: str, right: str) -> str:
    return compute_sha256((left + right).encode("utf-8"))


def merkle_root(leaf_hashes: Iterable[str]) -> str | None:
    """Computes the Merkle root of a list of hex-digest leaves.

    Used to batch a set of audit_log chain_hash values into a single
    root before an optional external anchor (RFC 3161 / Hyperledger),
    so anchoring cost is O(1) per batch rather than O(N) per row.
    Returns None for an empty input.
    """
    level = list(leaf_hashes)
    if not level:
        return None
    while len(level) > 1:
        next_level = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else level[i]
            next_level.append(_pair_hash(left, right))
        level = next_level
    return level[0]


# ---------------------------------------------------------------------------
# Ed25519 signing of Merkle roots / report digests
# ---------------------------------------------------------------------------

DEFAULT_KEY_PATH = os.environ.get("REFORGE_SIGNING_KEY_PATH", "reforge_signing_key.hex")


def _load_or_create_signing_key(key_path: str = DEFAULT_KEY_PATH):
    """Loads the local Ed25519 signing key, generating one on first run.

    The key never leaves disk and is never transmitted anywhere — signing
    is purely a local integrity feature (proves "this device generated
    this artifact"), not a network-dependent PKI step.
    """
    if not _HAVE_NACL:
        raise RuntimeError(
            "PyNaCl is required for Ed25519 signing but is not installed. "
            "Install with `pip install pynacl`."
        )
    path = Path(key_path)
    if path.exists():
        hex_key = path.read_text().strip()
        return SigningKey(hex_key, encoder=HexEncoder)
    signing_key = SigningKey.generate()
    path.write_text(signing_key.encode(encoder=HexEncoder).decode("ascii"))
    return signing_key


def sign_digest(digest_hex: str, key_path: str = DEFAULT_KEY_PATH) -> str:
    """Signs a hex digest (e.g. a Merkle root) with the local Ed25519
    key and returns the signature as a hex string.
    """
    signing_key = _load_or_create_signing_key(key_path)
    signed = signing_key.sign(digest_hex.encode("utf-8"))
    return signed.signature.hex()


def verify_signature(digest_hex: str, signature_hex: str, key_path: str = DEFAULT_KEY_PATH) -> bool:
    """Verifies a signature produced by sign_digest() using the local
    public key. Returns False on any mismatch rather than raising, so
    callers (e.g. the Integrity Check tab) can render a simple bool.
    """
    if not _HAVE_NACL:
        raise RuntimeError("PyNaCl is required for Ed25519 verification but is not installed.")
    signing_key = _load_or_create_signing_key(key_path)
    verify_key: VerifyKey = signing_key.verify_key
    try:
        verify_key.verify(digest_hex.encode("utf-8"), bytes.fromhex(signature_hex))
        return True
    except Exception:
        return False
