"""
Pluggable RFC 3161 trusted-timestamp interface.

REFORGE is fully offline by default. This module defines the interface a
future TSA (Time-Stamping Authority) integration would implement, plus a
NoopTimestampProvider that is used whenever no TSA is configured.

IMPORTANT: the no-op provider must NEVER fabricate a timestamp using the
system clock and label it as if it were a trusted third-party timestamp.
The system clock time is already recorded on every audit_log row via the
`timestamp` column — that is a local claim, not a trusted one. This
module's job is only to optionally add an independently-verifiable
timestamp on top of that; when it can't, it says so explicitly rather
than papering over the gap.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass
class TimestampResult:
    applied: bool               # True only if a real TSA timestamp was obtained
    provider: str                # e.g. "none", "rfc3161:freetsa.org"
    token: str | None = None     # the raw TSA response token, if any
    reason: str | None = None    # why it was skipped, when applied=False


class TimestampProvider(abc.ABC):
    @abc.abstractmethod
    def timestamp(self, digest_hex: str) -> TimestampResult:
        """Requests a trusted timestamp over a hex digest (e.g. a Merkle
        root). Must not raise for "not configured" — return a
        TimestampResult(applied=False, ...) instead, so a missing TSA
        never fails the audit-logging operation it's attached to.
        """
        raise NotImplementedError


class NoopTimestampProvider(TimestampProvider):
    """Default provider when REFORGE is running fully offline (the
    normal case). Logs locally only and is explicit about not having
    obtained a trusted timestamp.
    """

    def timestamp(self, digest_hex: str) -> TimestampResult:
        return TimestampResult(
            applied=False,
            provider="none",
            token=None,
            reason="No RFC 3161 TSA configured; running fully offline. "
                   "Local system-clock timestamp only (see audit_log.timestamp).",
        )


# Real integration point for later: an RFC3161TimestampProvider would live
# here, making an outbound HTTP request to a configured TSA URL and
# returning TimestampResult(applied=True, provider=..., token=<TSA reply>).
# It must be opt-in via explicit configuration (a TSA URL + network
# permission), never enabled by default, per the fully-offline constraint.


def get_timestamp_provider(config: dict | None = None) -> TimestampProvider:
    """Factory: returns the configured provider, or the no-op provider
    when nothing is configured. `config` would carry a TSA URL/cert once
    a real provider exists; currently always returns NoopTimestampProvider
    since REFORGE ships fully offline.
    """
    if not config or not config.get("tsa_url"):
        return NoopTimestampProvider()
    raise NotImplementedError(
        "An RFC 3161 TSA was configured, but no online provider is "
        "implemented in this offline build. Remove `tsa_url` from config "
        "or implement RFC3161TimestampProvider before enabling it."
    )
