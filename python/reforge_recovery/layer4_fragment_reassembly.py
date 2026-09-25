"""
Layer 4 — Fragment reassembly.

Two pieces:

1. Bifragment Gap Carving (BGC) for the 2-fragment case: given a known
   header block and a known footer/tail block that don't sit adjacently,
   exhaustively try candidate gap sizes between them and use the format's
   own structural parser (signatures.py) as the validator — accept the
   first gap size that makes the reconstructed buffer structurally valid
   (CRC passes, box chain resolves, etc.), not just "footer bytes found".

2. The fragment compatibility graph: for the general case of many
   candidate blocks, build a weighted graph over blocks where edge weight
   is a composite of:
     - byte-entropy similarity between adjacent blocks
     - sector adjacency (blocks that are physically close on disk are
       more likely to belong to the same original file)
     - file-type-specific rules (e.g. a block whose content-type guess
       matches the candidate file's type scores higher)
   Layer 5's ranking scores walk this graph's connected candidate chains.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Optional

from .signatures import SIGNATURES, ParseResult


# --------------------------------------------------------------------------
# 1. Bifragment Gap Carving
# --------------------------------------------------------------------------

@dataclass
class BifragmentResult:
    success: bool
    gap_size: Optional[int]
    reconstructed: Optional[bytes]
    detail: str
    attempts: int


def bifragment_gap_carve(
    file_type: str,
    header_block: bytes,
    tail_block: bytes,
    max_gap: int,
    step: int = 512,
) -> BifragmentResult:
    """
    Try inserting a gap of `0, step, 2*step, ..., max_gap` bytes between
    `header_block` and `tail_block`, and structurally validate each
    candidate with the real parser for `file_type`. Returns as soon as a
    gap size structurally validates (smallest-gap-first, since that is
    both the most likely real answer and the cheapest to test).

    A production implementation would fill the gap with the actual
    intervening disk sectors (read via reforge_core.read_sectors, per the
    Rust core integration point in _integrations.py) rather than zero
    bytes; this function is parser-agnostic about gap contents and takes
    whatever bytes the caller supplies as `header_block`/`tail_block`, so
    callers are expected to pass real sector data where the two blocks
    aren't logically adjacent.
    """
    if file_type not in SIGNATURES:
        return BifragmentResult(False, None, None, f"unknown file_type '{file_type}'", 0)

    parser = SIGNATURES[file_type].parser
    attempts = 0
    for gap in range(0, max_gap + 1, max(step, 1)):
        attempts += 1
        candidate = header_block + (b"\x00" * gap) + tail_block
        result: ParseResult = parser(candidate)
        if result.valid:
            return BifragmentResult(
                success=True,
                gap_size=gap,
                reconstructed=candidate[: result.end_offset],
                detail=f"validated at gap={gap} bytes ({result.detail})",
                attempts=attempts,
            )
    return BifragmentResult(
        success=False,
        gap_size=None,
        reconstructed=None,
        detail=f"no gap in [0, {max_gap}] step {step} structurally validated",
        attempts=attempts,
    )


# --------------------------------------------------------------------------
# 2. Fragment compatibility graph
# --------------------------------------------------------------------------

@dataclass
class Block:
    block_id: str
    offset: int
    length: int
    data: bytes
    type_hint: Optional[str] = None  # from Layer 5's per-block ML classification


@dataclass
class CompatibilityEdge:
    a: str
    b: str
    weight: float
    components: dict[str, float] = field(default_factory=dict)


def _shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    n = len(data)
    entropy = 0.0
    for c in counts:
        if c:
            p = c / n
            entropy -= p * math.log2(p)
    return entropy  # 0..8


# Weights for the compatibility-edge composite score. Documented here
# (mirrors the confidence-score weighting convention in layer5) so the
# graph-construction rationale stays next to the numbers that drive it.
_W_ENTROPY_SIMILARITY = 0.4
_W_SECTOR_ADJACENCY = 0.4
_W_TYPE_CONSISTENCY = 0.2


def build_compatibility_graph(
    blocks: list[Block],
    expected_type: Optional[str] = None,
    sector_size: int = 512,
) -> list[CompatibilityEdge]:
    """
    Build weighted edges between every pair of blocks. For real disks
    the candidate set is pre-filtered to physically nearby blocks before
    calling this (an O(n^2) all-pairs pass is only fine for the small
    candidate windows Layer 4 operates on, not a whole-device scan).
    """
    edges: list[CompatibilityEdge] = []
    entropies = {b.block_id: _shannon_entropy(b.data) for b in blocks}

    for i, a in enumerate(blocks):
        for b in blocks[i + 1:]:
            entropy_delta = abs(entropies[a.block_id] - entropies[b.block_id])
            entropy_similarity = max(0.0, 1.0 - (entropy_delta / 8.0))

            gap_sectors = abs((b.offset - (a.offset + a.length)) / sector_size)
            sector_adjacency = 1.0 / (1.0 + gap_sectors)  # 1.0 if adjacent, decays with distance

            if expected_type is None or a.type_hint is None or b.type_hint is None:
                type_consistency = 0.5  # unknown -> neutral
            else:
                type_consistency = 1.0 if (a.type_hint == expected_type and b.type_hint == expected_type) else 0.0

            weight = (
                _W_ENTROPY_SIMILARITY * entropy_similarity
                + _W_SECTOR_ADJACENCY * sector_adjacency
                + _W_TYPE_CONSISTENCY * type_consistency
            )
            edges.append(
                CompatibilityEdge(
                    a=a.block_id,
                    b=b.block_id,
                    weight=weight,
                    components={
                        "entropy_similarity": entropy_similarity,
                        "sector_adjacency": sector_adjacency,
                        "type_consistency": type_consistency,
                    },
                )
            )
    return edges


def best_chain(blocks: list[Block], edges: list[CompatibilityEdge]) -> list[str]:
    """
    Greedy nearest-neighbor walk from the lowest-offset block, always
    extending the chain to the highest-weight not-yet-used neighbor. This
    is the graph structure Layer 5 scores full reconstructions against;
    swapping in a proper max-weight Hamiltonian-path solver is a drop-in
    replacement for this function if reconstruction quality needs to
    improve beyond the greedy heuristic.
    """
    if not blocks:
        return []
    remaining = {b.block_id for b in blocks}
    ordered_start = min(blocks, key=lambda b: b.offset).block_id
    chain = [ordered_start]
    remaining.discard(ordered_start)

    adjacency: dict[str, list[CompatibilityEdge]] = {}
    for e in edges:
        adjacency.setdefault(e.a, []).append(e)
        adjacency.setdefault(e.b, []).append(e)

    current = ordered_start
    while remaining:
        candidates = [
            e for e in adjacency.get(current, [])
            if (e.a == current and e.b in remaining) or (e.b == current and e.a in remaining)
        ]
        if not candidates:
            # no scored edge to any remaining block; append arbitrarily
            # by offset order rather than leaving it out entirely
            nxt = min(remaining, key=lambda bid: next(b.offset for b in blocks if b.block_id == bid))
        else:
            best_edge = max(candidates, key=lambda e: e.weight)
            nxt = best_edge.b if best_edge.a == current else best_edge.a
        chain.append(nxt)
        remaining.discard(nxt)
        current = nxt
    return chain
