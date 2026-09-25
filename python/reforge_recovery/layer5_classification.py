"""
Layer 5 — ML classification + confidence scoring.

Classifier choice: the Shared Contract asks for a gradient-boosting
classifier (XGBoost or LightGBM) trained on byte-histogram + entropy +
bigram-frequency features. We target **LightGBM** for production: it
trains faster than XGBoost on this feature shape (a dense, moderate-width
numeric vector with no missing values) and its leaf-wise growth tends to
need fewer trees for the same accuracy on byte-frequency-style features,
which matters here since classification runs inline during a scan the
user is watching a progress bar for.

This sandbox has no network access to install lightgbm/xgboost, so the
implementation below runs on scikit-learn's HistGradientBoostingClassifier
(same gradient-boosted-trees family, zero extra dependency) behind a
single factory function, `_build_classifier()`. Swapping to LightGBM in
the real build is a one-function change; nothing else in this module or
its callers needs to know which library is behind it.

Confidence score: exact weighted composite the Contract specifies,
weights documented at the point of use.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

FILE_TYPES = ["jpeg", "png", "pdf", "zip", "docx", "xlsx", "pptx", "sqlite", "mp4", "unknown"]


# --------------------------------------------------------------------------
# Feature extraction: 256-dim byte histogram + Shannon entropy +
# bigram-frequency features.
# --------------------------------------------------------------------------

def _byte_histogram(data: bytes) -> np.ndarray:
    hist = np.zeros(256, dtype=np.float64)
    if not data:
        return hist
    counts = np.bincount(np.frombuffer(data, dtype=np.uint8), minlength=256)
    return counts / len(data)


def _shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = np.bincount(np.frombuffer(data, dtype=np.uint8), minlength=256)
    probs = counts[counts > 0] / len(data)
    return float(-(probs * np.log2(probs)).sum())


def _bigram_frequency(data: bytes, top_k: int = 32) -> np.ndarray:
    """
    Full 65536-dim bigram space is wasteful for short carved fragments;
    we instead hash each bigram into a fixed top_k-width feature vector
    (a simple feature-hashing trick), which keeps the feature vector
    small and fixed-size regardless of fragment length.
    """
    vec = np.zeros(top_k, dtype=np.float64)
    if len(data) < 2:
        return vec
    arr = np.frombuffer(data, dtype=np.uint8)
    bigrams = (arr[:-1].astype(np.uint16) << 8) | arr[1:]
    buckets = bigrams.astype(np.uint32) % top_k
    counts = np.bincount(buckets, minlength=top_k)
    return counts / len(bigrams)


def extract_features(data: bytes) -> np.ndarray:
    """256 (histogram) + 1 (entropy) + 32 (hashed bigram) = 289-dim vector."""
    hist = _byte_histogram(data)
    entropy = np.array([_shannon_entropy(data)])
    bigrams = _bigram_frequency(data)
    return np.concatenate([hist, entropy, bigrams])


FEATURE_DIM = 256 + 1 + 32


# --------------------------------------------------------------------------
# Classifier
# --------------------------------------------------------------------------

def _build_classifier() -> HistGradientBoostingClassifier:
    # Swap this single call for lightgbm.LGBMClassifier(...) in the real
    # build; extract_features() / predict_file_type() below are agnostic
    # to which library backs this factory.
    return HistGradientBoostingClassifier(max_iter=150, max_depth=6, random_state=0)


class FragmentClassifier:
    """Thin wrapper so the pipeline can train once and reuse across a scan."""

    def __init__(self) -> None:
        self._model: Optional[HistGradientBoostingClassifier] = None
        self._classes: list[str] = []

    def fit(self, samples: list[bytes], labels: list[str]) -> None:
        X = np.stack([extract_features(s) for s in samples])
        self._model = _build_classifier()
        self._model.fit(X, labels)
        self._classes = list(self._model.classes_)

    def predict(self, data: bytes) -> tuple[str, float]:
        """Returns (predicted_type, probability_of_predicted_type)."""
        if self._model is None:
            return "unknown", 0.0
        X = extract_features(data).reshape(1, -1)
        proba = self._model.predict_proba(X)[0]
        best_idx = int(np.argmax(proba))
        return self._classes[best_idx], float(proba[best_idx])


# --------------------------------------------------------------------------
# Confidence scoring — exact composite from the Shared Contract.
#
#   score = w1*(header+footer both present)
#         + w2*(structural parser completed without error)
#         + w3*(decoder/render actually succeeded)
#         + w4*(fragments were contiguous, not reassembled from a guess)
#         + w5*(ML type consistency across all constituent blocks)
#         - penalty*(overlap with another carved file's claimed region)
#
# Weights (documented here, not buried in a config file, since they are
# the load-bearing numbers behind the Explainable Fragment Reconstruction
# UI's "why this candidate" breakdown):
#   w1 = 0.20  header+footer both present is a cheap, strong signal
#   w2 = 0.25  structural parser succeeding (real format-aware validation)
#              is weighted highest among the "positive" terms
#   w3 = 0.25  an actual successful decode/render is equally strong
#              independent evidence (a structurally-valid-looking file
#              can still fail to decode if bytes were corrupted)
#   w4 = 0.15  contiguous (non-reassembled) files are inherently more
#              trustworthy than a bifragment-gap-carved guess
#   w5 = 0.15  ML type agreement across constituent blocks is corroborating
#              but the weakest signal (models can be wrong)
#   penalty = 0.30 per overlapping claim; capped so score never goes
#             negative
# --------------------------------------------------------------------------

W1_HEADER_FOOTER = 0.20
W2_STRUCTURAL_PARSE = 0.25
W3_DECODE_SUCCESS = 0.25
W4_CONTIGUOUS = 0.15
W5_ML_CONSISTENCY = 0.15
PENALTY_OVERLAP = 0.30


@dataclass
class ConfidenceBreakdown:
    header_and_footer_present: bool
    structural_parse_ok: bool
    decode_succeeded: bool
    contiguous: bool
    ml_type_consistency: float  # 0..1, fraction of constituent blocks agreeing
    overlap_count: int
    score: float
    tier: str  # "High" | "Medium" | "Low"

    def as_dict(self) -> dict:
        return {
            "header_and_footer_present": self.header_and_footer_present,
            "structural_parse_ok": self.structural_parse_ok,
            "decode_succeeded": self.decode_succeeded,
            "contiguous": self.contiguous,
            "ml_type_consistency": self.ml_type_consistency,
            "overlap_count": self.overlap_count,
            "weights": {
                "header_footer": W1_HEADER_FOOTER,
                "structural_parse": W2_STRUCTURAL_PARSE,
                "decode_success": W3_DECODE_SUCCESS,
                "contiguous": W4_CONTIGUOUS,
                "ml_consistency": W5_ML_CONSISTENCY,
                "overlap_penalty_each": PENALTY_OVERLAP,
            },
            "score": self.score,
            "tier": self.tier,
        }


def compute_confidence(
    header_and_footer_present: bool,
    structural_parse_ok: bool,
    decode_succeeded: bool,
    contiguous: bool,
    ml_type_consistency: float,
    overlap_count: int = 0,
) -> ConfidenceBreakdown:
    raw = (
        W1_HEADER_FOOTER * float(header_and_footer_present)
        + W2_STRUCTURAL_PARSE * float(structural_parse_ok)
        + W3_DECODE_SUCCESS * float(decode_succeeded)
        + W4_CONTIGUOUS * float(contiguous)
        + W5_ML_CONSISTENCY * max(0.0, min(1.0, ml_type_consistency))
        - PENALTY_OVERLAP * overlap_count
    )
    score = max(0.0, min(1.0, raw))

    if score >= 0.75:
        tier = "High"
    elif score >= 0.40:
        tier = "Medium"
    else:
        tier = "Low"

    return ConfidenceBreakdown(
        header_and_footer_present=header_and_footer_present,
        structural_parse_ok=structural_parse_ok,
        decode_succeeded=decode_succeeded,
        contiguous=contiguous,
        ml_type_consistency=ml_type_consistency,
        overlap_count=overlap_count,
        score=score,
        tier=tier,
    )
