"""
Pluggable Hyperledger Fabric anchoring interface.

Same shape as timestamp.py: REFORGE is fully offline by default, so the
default LedgerAnchor is a no-op that records locally and is explicit
about not having reached an external ledger. A real Fabric integration
would implement LedgerAnchor.anchor() to submit a transaction to a
configured channel/peer and return the resulting transaction ID.

Anchoring input is always a Merkle root over a batch of audit_log
chain_hash values (see crypto.merkle_root), never individual rows, to
keep the on-chain footprint small.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass
class AnchorResult:
    anchored: bool                # True only if an external ledger tx succeeded
    backend: str                   # e.g. "none", "fabric:channel1"
    tx_id: str | None = None
    reason: str | None = None      # why it was skipped, when anchored=False


class LedgerAnchor(abc.ABC):
    @abc.abstractmethod
    def anchor(self, merkle_root_hex: str) -> AnchorResult:
        """Anchors a Merkle root externally. Must not raise for "not
        configured" — return AnchorResult(anchored=False, ...) instead,
        so a missing ledger never fails the local audit chain it's
        attached to. The local hash chain in audit_log is always
        independently verifiable via verify_hash_chain() regardless of
        whether this step ever runs.
        """
        raise NotImplementedError


class NoopLedgerAnchor(LedgerAnchor):
    """Default anchor when no Hyperledger Fabric network is configured
    (the normal, fully-offline case)."""

    def anchor(self, merkle_root_hex: str) -> AnchorResult:
        return AnchorResult(
            anchored=False,
            backend="none",
            tx_id=None,
            reason="No Hyperledger Fabric network configured; running "
                   "fully offline. Integrity relies on the local "
                   "hash chain (see verify_hash_chain()).",
        )


# Real integration point for later: a FabricLedgerAnchor would live here,
# using the Fabric Gateway SDK to submit merkle_root_hex to a configured
# chaincode/channel and returning AnchorResult(anchored=True, ...). Must
# be opt-in via explicit configuration, never enabled by default.


def get_ledger_anchor(config: dict | None = None) -> LedgerAnchor:
    """Factory: returns the configured anchor, or the no-op anchor when
    nothing is configured.
    """
    if not config or not config.get("fabric_gateway"):
        return NoopLedgerAnchor()
    raise NotImplementedError(
        "A Hyperledger Fabric gateway was configured, but no online "
        "anchor backend is implemented in this offline build. Remove "
        "`fabric_gateway` from config or implement FabricLedgerAnchor "
        "before enabling it."
    )
