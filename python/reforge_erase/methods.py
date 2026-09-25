"""
get_recommended_method(device_info) -> dict

Decision table aligned to NIST SP 800-88 Rev.2 / IEEE 2883-2022, per the
Shared Contract. `device_info` is expected to carry at least:
    {
      "interface": "sata" | "sas" | "nvme" | "usb" | "sd" | "emmc" | "ufs",
      "media_type": "hdd" | "ssd",
      "is_opal_sed": bool,
      "model": str,
      "firmware_version": str,
      "firmware_reliability_status": "verified" | "unverified" | "unreliable" | None,
    }
The firmware_reliability_status field is looked up by the caller (frontend
/ settings module) against the firmware_reliability table this module
maintains -- get_recommended_method does not query the DB itself, it only
reacts to what's handed in, keeping it a pure function per the contract.
"""

from __future__ import annotations

UNRELIABLE_STATUSES = {"unverified", "unreliable"}


def get_recommended_method(device_info: dict) -> dict:
    interface = (device_info.get("interface") or "").lower()
    media_type = (device_info.get("media_type") or "").lower()
    is_opal = bool(device_info.get("is_opal_sed"))
    firmware_status = device_info.get("firmware_reliability_status")

    method, reasoning, is_fallback_flagged = _base_recommendation(
        interface, media_type, is_opal
    )

    if firmware_status in UNRELIABLE_STATUSES:
        stronger = _stronger_fallback(interface, media_type, is_opal, method)
        is_fallback_flagged = True
        method = stronger
        reasoning = (
            f"This device's firmware ({device_info.get('model', 'unknown model')} "
            f"{device_info.get('firmware_version', 'unknown firmware')}) has not been "
            f"verified as fully reliable for hardware Sanitize, so a stronger "
            f"method ({stronger}) is recommended even though hardware Sanitize "
            f"is technically available."
        )

    return {
        "method": method,
        "reasoning": reasoning,
        "is_fallback_flagged": is_fallback_flagged,
    }


def _base_recommendation(interface: str, media_type: str, is_opal: bool) -> tuple[str, str, bool]:
    if is_opal:
        return (
            "psid_revert_crypto_erase",
            "SED/Opal drive detected: PSID Revert triggers a cryptographic "
            "erase of the media encryption key, which is the fastest and "
            "most reliable sanitization method for self-encrypting drives.",
            False,
        )

    if interface in ("sata", "sas") and media_type == "hdd":
        return (
            "ata_scsi_sanitize_overwrite_ext",
            "HDD over SATA/SAS: ATA/SCSI Sanitize overwrite-ext (or Secure "
            "Erase where overwrite-ext isn't supported) is the standard "
            "NIST 800-88 Clear/Purge method for spinning media.",
            False,
        )

    if interface == "sata" and media_type == "ssd":
        return (
            "sanitize_block_erase",
            "SATA SSD: Sanitize block-erase (or crypto scramble) is "
            "recommended, with ATA Secure Erase (Enhanced) as the fallback "
            "if block-erase isn't supported by the controller.",
            False,
        )

    if interface == "nvme":
        return (
            "nvme_sanitize_block_or_crypto_erase",
            "NVMe SSD: nvme-sanitize (block erase or crypto erase) is the "
            "primary method, falling back to nvme format with a secure "
            "erase setting (ses=1 user data erase, or ses=2 crypto erase) "
            "if sanitize isn't supported.",
            False,
        )

    if interface in ("usb", "sd"):
        return (
            "wear_aware_multipass_overwrite",
            "USB flash / SD media often lacks hardware Sanitize support "
            "behind its controller. Recommending a wear-aware multi-pass "
            "overwrite as a best-effort, controller-limited method.",
            True,
        )

    if interface in ("emmc", "ufs"):
        return (
            "erase_sanitize_secure_trim",
            "eMMC/UFS (mobile) storage: the device's native ERASE / "
            "SANITIZE / Secure Trim command is recommended per the "
            "controller's supported feature set.",
            False,
        )

    return (
        "sanitize_block_erase",
        f"No specific decision-table entry for interface '{interface or 'unknown'}' "
        f"/ media type '{media_type or 'unknown'}'; defaulting to a conservative "
        f"Sanitize block-erase and flagging for manual review.",
        True,
    )


def _stronger_fallback(interface: str, media_type: str, is_opal: bool, current_method: str) -> str:
    """
    When firmware reliability is unverified/unreliable, step up to a method
    that doesn't depend on trusting the controller's own Sanitize/Secure
    Erase implementation.
    """
    if is_opal:
        # Cryptographic erase is already the strongest option; pair it with
        # a verification-heavy overwrite pass as belt-and-suspenders.
        return "psid_revert_crypto_erase_plus_overwrite_verify"
    if media_type == "hdd":
        return "full_overwrite_multipass_ext"
    # SSD/NVMe/USB/SD/eMMC with unreliable firmware: don't trust the
    # controller's own erase command; force a full logical-block overwrite.
    return "full_overwrite_multipass_ext"
