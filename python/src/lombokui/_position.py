"""Floating-element positioning (SPEC 6)."""

from __future__ import annotations

from typing import Any, Dict

from ._util import Reader, is_finite_number

PLACEMENTS = (
    "top", "top-start", "top-end", "bottom", "bottom-start", "bottom-end",
    "left", "left-start", "left-end", "right", "right-start", "right-end",
)
_OPPOSITE = {"top": "bottom", "bottom": "top", "left": "right", "right": "left"}


def _read_rect(v: Any, key: str, size: bool = False) -> Dict[str, float]:
    keys = ("width", "height") if size else ("x", "y", "width", "height")
    r = Reader(v, "invalid_option", key, keys)
    for k in keys:
        if not is_finite_number(r.raw(k)):
            r.bad(k, "must be a finite number")
    width = float(r.raw("width"))
    height = float(r.raw("height"))
    if width < 0 or height < 0:
        r.bad("width", "and height must not be negative")
    return {"x": 0.0 if size else float(r.raw("x")), "y": 0.0 if size else float(r.raw("y")), "width": width, "height": height}


def position(args: Any) -> Dict[str, Any]:
    """Places a floating element next to a reference element: placement, offset, flip, shift and arrow."""
    r = Reader(args, "invalid_option", "position", ("reference", "floating", "placement", "offset", "flip", "shift", "padding", "boundary", "arrow", "arrowPadding", "dir"))
    ref = _read_rect(r.raw("reference"), "reference")
    fl = _read_rect(r.raw("floating"), "floating", True)
    placement = r.one_of("placement", PLACEMENTS, "bottom")
    offset = r.num("offset", 0)
    flip = r.bool("flip", True)
    shift = r.bool("shift", True)
    padding = r.num("padding", 0)
    boundary = None if r.raw("boundary") is None else _read_rect(r.raw("boundary"), "boundary")
    arrow_size = None if r.raw("arrow") is None else r.num("arrow", 0)
    if arrow_size is not None and arrow_size < 0:
        r.bad("arrow", "must not be negative")
    arrow_padding = r.num("arrowPadding", 0)
    direction = r.one_of("dir", ("ltr", "rtl"), "ltr")

    parts = placement.split("-")
    side = parts[0]
    align = parts[1] if len(parts) > 1 else "center"

    def coords(s: str) -> "tuple[float, float]":
        if s in ("top", "bottom"):
            y = ref["y"] - fl["height"] - offset if s == "top" else ref["y"] + ref["height"] + offset
            a = align
            if align != "center" and direction == "rtl":
                a = "end" if align == "start" else "start"
            if a == "start":
                x = ref["x"]
            elif a == "end":
                x = ref["x"] + ref["width"] - fl["width"]
            else:
                x = ref["x"] + ref["width"] / 2 - fl["width"] / 2
        else:
            x = ref["x"] - fl["width"] - offset if s == "left" else ref["x"] + ref["width"] + offset
            if align == "start":
                y = ref["y"]
            elif align == "end":
                y = ref["y"] + ref["height"] - fl["height"]
            else:
                y = ref["y"] + ref["height"] / 2 - fl["height"] / 2
        return x, y

    def overflow(s: str, p: "tuple[float, float]", b: Dict[str, float]) -> float:
        if s == "top":
            return b["y"] + padding - p[1]
        if s == "bottom":
            return p[1] + fl["height"] - (b["y"] + b["height"] - padding)
        if s == "left":
            return b["x"] + padding - p[0]
        return p[0] + fl["width"] - (b["x"] + b["width"] - padding)

    p = coords(side)
    if flip and boundary is not None:
        o1 = overflow(side, p, boundary)
        if o1 > 0:
            opp = _OPPOSITE[side]
            q = coords(opp)
            if overflow(opp, q, boundary) < o1:
                side = opp
                p = q
    if shift and boundary is not None:
        if side in ("top", "bottom"):
            lo = boundary["x"] + padding
            hi = boundary["x"] + boundary["width"] - padding - fl["width"]
            p = (max(lo, min(p[0], hi)), p[1])
        else:
            lo = boundary["y"] + padding
            hi = boundary["y"] + boundary["height"] - padding - fl["height"]
            p = (p[0], max(lo, min(p[1], hi)))
    arrow = None
    if arrow_size is not None:
        vertical = side in ("top", "bottom")
        raw = ref["x"] + ref["width"] / 2 - p[0] - arrow_size / 2 if vertical else ref["y"] + ref["height"] / 2 - p[1] - arrow_size / 2
        hi = (fl["width"] if vertical else fl["height"]) - arrow_padding - arrow_size
        arrow = {"edge": _OPPOSITE[side], "offset": max(arrow_padding, min(raw, hi))}
    final = side if align == "center" else f"{side}-{align}"
    return {"x": p[0], "y": p[1], "placement": final, "side": side, "align": align, "arrow": arrow}
