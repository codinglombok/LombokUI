"""Validation, keyboard navigation, typeahead and number formatting (SPEC 2 and 3)."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Optional

MAX_INT = 9007199254740991
MAX_ITEMS = 1000
MAX_LABEL = 1000
MAX_DURATION = 2147483647

_ID_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}\Z")

ERROR_CODES = ("invalid_component", "invalid_option", "invalid_event", "invalid_props")


class LombokUIError(Exception):
    """The only error raised by LombokUI. ``code`` is the cross-language contract."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message_id = f"lombokui.error.{code}"


def fail(code: str, message: str) -> "Any":
    raise LombokUIError(code, message)


def is_object(v: Any) -> bool:
    return isinstance(v, dict)


def is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def is_finite_number(v: Any) -> bool:
    return is_number(v) and math.isfinite(v)


def is_int(v: Any) -> bool:
    if not is_finite_number(v):
        return False
    if isinstance(v, float) and not v.is_integer():
        return False
    return abs(v) <= MAX_INT


def is_id(v: Any) -> bool:
    return isinstance(v, str) and _ID_RE.match(v) is not None


def fits_text(v: Any, limit: int) -> bool:
    """Strings are measured in code points (SPEC 2.1)."""
    return isinstance(v, str) and len(v) <= limit


def trim_ascii(s: str) -> str:
    return s.strip(" \t\n\f\r")


def bool_attr(v: bool) -> str:
    return "true" if v else "false"


class Reader:
    """Reads an options/props object strictly: unknown keys are an error."""

    def __init__(self, src: Any, code: str, what: str, allowed: "tuple[str, ...] | list[str]") -> None:
        if not is_object(src):
            fail(code, f"{what} must be an object")
        for k in src:
            if k not in allowed:
                fail(code, f'{what}: unknown key "{k}"')
        self.src = src
        self.code = code
        self.what = what

    def has(self, key: str) -> bool:
        return key in self.src

    def raw(self, key: str) -> Any:
        return self.src.get(key)

    def bad(self, key: str, why: str) -> "Any":
        fail(self.code, f"{self.what}.{key} {why}")

    def bool(self, key: str, default: bool) -> bool:
        if key not in self.src:
            return default
        v = self.src[key]
        if not isinstance(v, bool):
            self.bad(key, "must be a boolean")
        return v

    def one_of(self, key: str, values: "tuple[str, ...]", default: str) -> str:
        if key not in self.src:
            return default
        v = self.src[key]
        if not isinstance(v, str) or v not in values:
            self.bad(key, "must be one of " + ", ".join(values))
        return v

    def int(self, key: str, lo: int, hi: int, default: int) -> int:
        if key not in self.src:
            return default
        v = self.src[key]
        if not is_int(v) or v < lo or v > hi:
            self.bad(key, f"must be an integer in {lo}..{hi}")
        return int(v)

    def num(self, key: str, default: float) -> float:
        if key not in self.src:
            return float(default)
        v = self.src[key]
        if not is_finite_number(v):
            self.bad(key, "must be a finite number")
        return float(v)

    def text(self, key: str, default: Optional[str], limit: int = MAX_LABEL) -> Optional[str]:
        v = self.src.get(key)
        if v is None:
            return default
        if not fits_text(v, limit):
            self.bad(key, f"must be a string of at most {limit} characters")
        return v

    def req_text(self, key: str, limit: int = MAX_LABEL) -> str:
        v = self.src.get(key)
        if not fits_text(v, limit):
            self.bad(key, f"must be a string of at most {limit} characters")
        return v

    def id(self, key: str, default: Optional[str]) -> Optional[str]:
        v = self.src.get(key)
        if v is None:
            return default
        if not is_id(v):
            self.bad(key, "must be an id ([A-Za-z][A-Za-z0-9_-]{0,63})")
        return v

    def id_base(self) -> str:
        return self.id("idBase", "lui")


@dataclass(frozen=True)
class Item:
    id: str
    label: str
    disabled: bool


def read_items(v: Any, code: str, what: str = "items", minimum: int = 1) -> "list[Item]":
    if not isinstance(v, list) or len(v) < minimum or len(v) > MAX_ITEMS:
        fail(code, f"{what} must be an array of {minimum}..{MAX_ITEMS} items")
    seen: "set[str]" = set()
    out: "list[Item]" = []
    for i, raw in enumerate(v):
        r = Reader(raw, code, f"{what}[{i}]", ("id", "label", "disabled"))
        item_id = r.id("id", None)
        if item_id is None:
            r.bad("id", "is required")
        if item_id in seen:
            r.bad("id", f'duplicates "{item_id}"')
        seen.add(item_id)
        out.append(Item(item_id, r.text("label", item_id), r.bool("disabled", False)))
    return out


def index_of(items: "list[Item]", item_id: Optional[str]) -> int:
    if item_id is None:
        return -1
    for i, it in enumerate(items):
        if it.id == item_id:
            return i
    return -1


def find_item(items: "list[Item]", item_id: Any) -> Optional[Item]:
    if not isinstance(item_id, str):
        return None
    i = index_of(items, item_id)
    return None if i < 0 else items[i]


def ordered(items: "list[Item]", ids: "set[str]") -> "list[str]":
    return [it.id for it in items if it.id in ids]


def first_enabled(items: "list[Item]") -> Optional[str]:
    for it in items:
        if not it.disabled:
            return it.id
    return None


def key_move(key: str, orientation: str, direction: str) -> Optional[str]:
    """Maps a UI Events ``key`` to a move (SPEC 3.1)."""
    if key == "Home":
        return "first"
    if key == "End":
        return "last"
    vertical = orientation in ("vertical", "both")
    horizontal = orientation in ("horizontal", "both")
    if vertical and key == "ArrowDown":
        return "next"
    if vertical and key == "ArrowUp":
        return "prev"
    if horizontal and key == "ArrowRight":
        return "prev" if direction == "rtl" else "next"
    if horizontal and key == "ArrowLeft":
        return "next" if direction == "rtl" else "prev"
    return None


def navigate(items: "list[Item]", current: Optional[str], move: str, loop: bool) -> Optional[str]:
    """Moves among enabled items (SPEC 3.2). Returns ``current`` when nothing qualifies."""
    n = len(items)
    if move == "first":
        for it in items:
            if not it.disabled:
                return it.id
        return current
    if move == "last":
        for it in reversed(items):
            if not it.disabled:
                return it.id
        return current
    ci = index_of(items, current)
    if move == "next":
        for i in range(ci + 1, n):
            if not items[i].disabled:
                return items[i].id
        if loop:
            for i in range(0, ci):
                if not items[i].disabled:
                    return items[i].id
        return current
    start = n if ci < 0 else ci
    for i in range(start - 1, -1, -1):
        if not items[i].disabled:
            return items[i].id
    if loop:
        for i in range(n - 1, start, -1):
            if not items[i].disabled:
                return items[i].id
    return current


def fold(s: str) -> str:
    """ASCII-only lowercase (SPEC 3.3)."""
    return "".join(chr(ord(c) + 32) if "A" <= c <= "Z" else c for c in s)


def is_char_key(key: str) -> bool:
    if len(key) != 1:
        return False
    cp = ord(key)
    return cp > 0x20 and cp != 0x7F and not (0x80 <= cp <= 0x9F)


def typeahead(items: "list[Item]", current: Optional[str], query: str, query_at: Optional[int], ch: str, at: int, timeout: int) -> "tuple[str, int, Optional[str]]":
    """Typeahead (SPEC 3.3). Returns (query, queryAt, match)."""
    cont = query_at is not None and at >= query_at and at - query_at < timeout
    q_raw = query + ch if cont else ch
    q = fold(q_raw)
    repeated = all(c == q[0] for c in q)
    needle = q[0] if repeated else q
    ci = index_of(items, current)
    n = len(items)
    start = ci + 1 if repeated else max(ci, 0)
    match = None
    for k in range(n):
        it = items[(start + k) % n]
        if not it.disabled and fold(it.label).startswith(needle):
            match = it.id
            break
    return q_raw, at, match


def format_number(v: float, decimals: int) -> str:
    """Formats a number for an attribute value (SPEC 2.5)."""
    s = f"{float(v):.{decimals}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s == "-0":
        s = "0"
    return s


def decimals_of(v: float) -> int:
    """Decimal digits in the shortest round-trip representation of ``v``."""
    f = abs(float(v))
    if f.is_integer():
        return 0
    s = repr(f)
    if "e" in s:
        mant, exp = s.split("e")
        md = len(mant) - mant.index(".") - 1 if "." in mant else 0
        return max(0, md - int(exp))
    return len(s) - s.index(".") - 1 if "." in s else 0
