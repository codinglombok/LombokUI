"""Built-in message catalogs. They MUST equal ``locales/<tag>/lombokui.json`` (checked by the tests)."""

from __future__ import annotations

from typing import Dict, Optional

CATALOGS: Dict[str, Dict[str, str]] = {
    "en": {
        "lombokui.error.invalid_component": "The component name is unknown.",
        "lombokui.error.invalid_option": "A component option or function argument is invalid.",
        "lombokui.error.invalid_event": "The event is invalid for this component.",
        "lombokui.error.invalid_props": "A render property is invalid.",
        "lombokui.label.close": "Close",
        "lombokui.label.breadcrumb": "Breadcrumb",
        "lombokui.label.pagination": "Pagination",
        "lombokui.label.previous_page": "Previous page",
        "lombokui.label.next_page": "Next page",
    },
    "id": {
        "lombokui.error.invalid_component": "Nama komponen tidak dikenal.",
        "lombokui.error.invalid_option": "Opsi komponen atau argumen fungsi tidak sah.",
        "lombokui.error.invalid_event": "Event tidak sah untuk komponen ini.",
        "lombokui.error.invalid_props": "Properti render tidak sah.",
        "lombokui.label.close": "Tutup",
        "lombokui.label.breadcrumb": "Jejak navigasi",
        "lombokui.label.pagination": "Navigasi halaman",
        "lombokui.label.previous_page": "Halaman sebelumnya",
        "lombokui.label.next_page": "Halaman berikutnya",
    },
}

LABEL_KEYS = ("close", "breadcrumb", "pagination", "previous_page", "next_page")


def _ascii_lower(s: str) -> str:
    return "".join(chr(ord(c) + 32) if "A" <= c <= "Z" else c for c in s)


def resolve_locale(tag: str) -> str:
    """Exact tag, then the language subtag, then ``en`` (SPEC 8.2)."""
    t = _ascii_lower(tag).replace("_", "-")
    if t in CATALOGS:
        return t
    lang = t.split("-")[0]
    return lang if lang in CATALOGS else "en"


def label(locale: str, key: str, overrides: Optional[Dict[str, str]]) -> str:
    if overrides is not None and key in overrides:
        return overrides[key]
    return CATALOGS[resolve_locale(locale)][f"lombokui.label.{key}"]
