"""Page list with ellipses (SPEC 7)."""

from __future__ import annotations

from typing import Any, Dict, List, Union

from ._util import Reader

MAX_PAGES = 2147483647


def _range(a: int, b: int) -> List[int]:
    return list(range(a, b + 1))


def pagination(args: Any) -> Dict[str, Any]:
    r = Reader(args, "invalid_option", "pagination", ("page", "total", "siblings", "boundaries"))
    total = r.int("total", 1, MAX_PAGES, 1)
    if not r.has("total"):
        r.bad("total", "is required")
    page = r.int("page", 1, total, 1)
    s = r.int("siblings", 0, 10, 1)
    b = r.int("boundaries", 0, 10, 1)

    start_pages = _range(1, min(b, total))
    end_pages = _range(max(total - b + 1, b + 1), total)
    sib_start = max(min(page - s, total - b - s * 2 - 1), b + 2)
    sib_end = min(max(page + s, b + s * 2 + 2), end_pages[0] - 2 if end_pages else total - 1)

    items: List[Union[int, str]] = list(start_pages)
    if sib_start > b + 2:
        items.append("ellipsis")
    elif b + 1 < total - b:
        items.append(b + 1)
    items.extend(_range(sib_start, sib_end))
    if sib_end < total - b - 1:
        items.append("ellipsis")
    elif total - b > b:
        items.append(total - b)
    items.extend(end_pages)
    return {"items": items, "prev": page - 1 if page > 1 else None, "next": page + 1 if page < total else None}
