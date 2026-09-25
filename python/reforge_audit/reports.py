"""
generate_report(report_type, case_id, operation_id) -> dict

Renders one of four report types to PDF (via Jinja2 -> WeasyPrint) and a
parallel JSON file with the same underlying data, and records the result
in the `reports` table.

=== INTEGRATION NOTE — please read before wiring this into Antigravity ===
Per the Shared Contract, this module owns only audit_log, chain_of_custody,
reports, and users. It does NOT own case/device/operation/recovered-file
data — that lives in tables owned by the Recovery and Erase modules (per
the main build prompt's Section 8 schema), which were not included in the
context this module was built from. Rather than invent new cross-module
calls or a new shared schema silently (against the contract's rule 2),
this file does two things:

  1. Assembles everything a report needs that IS derivable from this
     module's own tables: the audit trail for the case, chain-of-custody
     events for evidence IDs seen in that case's audit trail (a
     best-effort join, since chain_of_custody has no case_id column and
     audit_log has no operation_id column — see the two `NOTE:` comments
     below), and the live hash-chain verification result.

  2. Exposes `register_context_provider(report_type, fn)` as the
     integration seam: Antigravity (or whoever wires the three modules
     together) can register a callable that pulls the richer
     Recovery/Erase-owned fields (recovered file list, entropy
     measurements, device make/model/serial, method used, etc.) and
     merges them into the report context. Until a provider is
     registered, those fields render as explicit "not available in this
     build" notes in the PDF/JSON rather than being silently faked —
     this is real reporting behavior, not a mocked template; the
     rendering pipeline itself (Jinja2 -> WeasyPrint, real QR codes, a
     real hash-chain check) is fully functional today.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from reforge_audit.db import get_connection, transaction
from reforge_audit.audit import verify_hash_chain

try:
    import qrcode
    _HAVE_QRCODE = True
except ImportError:  # pragma: no cover
    _HAVE_QRCODE = False

try:
    from weasyprint import HTML
    _HAVE_WEASYPRINT = True
except ImportError:  # pragma: no cover
    _HAVE_WEASYPRINT = False


VALID_REPORT_TYPES = {"forensic", "erasure", "sanitization_cert", "section_65b"}

TEMPLATE_DIR = Path(__file__).parent / "templates"
OUTPUT_DIR = Path(os.environ.get("REFORGE_REPORTS_DIR", "reforge_reports"))

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)

_TEMPLATE_FILES = {
    "forensic": "forensic_report.html",
    "erasure": "erasure_report.html",
    "sanitization_cert": "sanitization_certificate.html",
    "section_65b": "section_65b_certificate.html",
}

# Integration seam described above.
_context_providers: dict[str, Callable[[str, str], dict]] = {}


def register_context_provider(report_type: str, provider: Callable[[str, str], dict]) -> None:
    """Registers a callable(case_id, operation_id) -> dict that supplies
    report_type-specific fields owned by other modules (Recovery/Erase).
    The returned dict is merged into the report context, overriding the
    "not available" placeholders this module fills in by default.
    """
    if report_type not in VALID_REPORT_TYPES:
        raise ValueError(f"report_type must be one of {sorted(VALID_REPORT_TYPES)}")
    _context_providers[report_type] = provider


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _fetch_audit_trail(case_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, timestamp, user_id, evidence_id, action_type,
               description, result, status
        FROM audit_log WHERE case_id = ? ORDER BY timestamp ASC
        """,
        (case_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _fetch_custody_events(evidence_ids: list[str]) -> list[dict]:
    if not evidence_ids:
        return []
    conn = get_connection()
    placeholders = ",".join("?" for _ in evidence_ids)
    rows = conn.execute(
        f"""
        SELECT id, evidence_id, event_type, from_person, to_person,
               location, status, reason, timestamp
        FROM chain_of_custody WHERE evidence_id IN ({placeholders})
        ORDER BY timestamp ASC
        """,
        evidence_ids,
    ).fetchall()
    return [dict(r) for r in rows]


def _base_context(report_type: str, case_id: str, operation_id: str) -> dict:
    """Assembles everything derivable from this module's own tables."""
    audit_trail = _fetch_audit_trail(case_id)

    # NOTE: audit_log has no operation_id column in the contracted schema,
    # so we cannot filter the trail strictly to one operation; the full
    # case timeline is included instead and each report template makes
    # clear it is showing case-wide audit context, not operation-only.
    evidence_ids = sorted({row["evidence_id"] for row in audit_trail if row["evidence_id"]})

    # NOTE: chain_of_custody has no case_id column, so we bridge case ->
    # evidence via evidence IDs observed in this case's audit trail. An
    # evidence item handled for this case but never referenced in an
    # audit_log row (unlikely, since evidence actions are logged) would
    # be missed here; a proper evidence<->case mapping table, if one
    # exists in Section 8's schema, should replace this bridge.
    custody_events = _fetch_custody_events(evidence_ids)

    integrity = verify_hash_chain(case_id=case_id)

    return {
        "report_type": report_type,
        "case_id": case_id,
        "operation_id": operation_id,
        "generated_at": _now_iso(),
        "audit_trail": audit_trail,
        "custody_events": custody_events,
        "evidence_ids": evidence_ids,
        "integrity": integrity,
        "tool_version": os.environ.get("REFORGE_VERSION", "REFORGE 0.1.0"),
        # Fields owned by Recovery/Erase — filled by a registered context
        # provider when available; explicit placeholders otherwise so the
        # report never silently pretends to have data it doesn't.
        "examiner_name": os.environ.get("REFORGE_EXAMINER_NAME", "(not available in this build)"),
        "device_info": {"note": "Device details require a Recovery/Erase context provider."},
        "recovered_files": [],
        "erase_methods": [],
        "entropy_before": None,
        "entropy_after": None,
    }


def _generate_qr_code_png(data: str, out_path: Path) -> None:
    if not _HAVE_QRCODE:
        raise RuntimeError(
            "The `qrcode` package is required for the sanitization certificate's "
            "QR code but is not installed. Install with `pip install qrcode[pil]`."
        )
    img = qrcode.make(data)
    img.save(str(out_path))


def generate_report(report_type: str, case_id: str, operation_id: str) -> dict:
    """
    Renders the requested report from real case/operation data via the
    HTML -> PDF pipeline. Returns: {"pdf_path": str, "json_path": str}
    """
    if report_type not in VALID_REPORT_TYPES:
        raise ValueError(f"report_type must be one of {sorted(VALID_REPORT_TYPES)}, got {report_type!r}")
    if not _HAVE_WEASYPRINT:
        raise RuntimeError(
            "WeasyPrint is required to render reports but is not installed. "
            "Install with `pip install weasyprint`."
        )

    context = _base_context(report_type, case_id, operation_id)

    provider = _context_providers.get(report_type)
    if provider is not None:
        context.update(provider(case_id, operation_id) or {})

    report_id = str(uuid.uuid4())
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    base_name = f"{report_type}_{case_id}_{operation_id}_{report_id[:8]}"
    pdf_path = OUTPUT_DIR / f"{base_name}.pdf"
    json_path = OUTPUT_DIR / f"{base_name}.json"

    if report_type == "sanitization_cert":
        verification_hash = context["integrity"].get("break_at_entry_id") or (
            context["audit_trail"][-1]["id"] if context["audit_trail"] else "no-audit-entries"
        )
        qr_path = OUTPUT_DIR / f"{base_name}_qr.png"
        _generate_qr_code_png(verification_hash, qr_path)
        context["qr_code_path"] = str(qr_path)
        context["verification_hash"] = verification_hash

    template = _jinja_env.get_template(_TEMPLATE_FILES[report_type])
    html_string = template.render(**context)
    HTML(string=html_string, base_url=str(TEMPLATE_DIR)).write_pdf(str(pdf_path))

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(context, f, indent=2, default=str)

    with transaction() as tx:
        tx.execute(
            """
            INSERT INTO reports (id, case_id, operation_id, type, generated_at,
                                  file_path_pdf, file_path_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (report_id, case_id, operation_id, report_type, context["generated_at"],
             str(pdf_path), str(json_path)),
        )

    return {"pdf_path": str(pdf_path), "json_path": str(json_path)}
