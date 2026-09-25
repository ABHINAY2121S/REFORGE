"""Shannon entropy of sampled bytes, used to drive the entropy-meter gauge
during the verification phase (target: ~8.0 bits/byte for a properly
randomized overwrite)."""

from __future__ import annotations

import math
from collections import Counter


def shannon_entropy_bits_per_byte(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    length = len(data)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy
