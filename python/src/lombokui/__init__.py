"""LombokUI: headless, accessible UI components with a cross-language contract.

Part of the Lombok Ecosystem. The normative contract is ``docs/SPEC_LombokUI_v0.1.0.md``.
"""

from __future__ import annotations

from typing import Any, List

from . import _components  # noqa: F401  (registers the components)
from ._components import COMPONENTS, filter_items
from ._machine import Machine, attrs_after, component_names, get_component, run
from ._messages import CATALOGS, LABEL_KEYS, resolve_locale
from ._pagination import pagination
from ._position import PLACEMENTS, position
from ._render import RENDERABLE, escape_attr, escape_text, render, safe_url
from ._util import ERROR_CODES, LombokUIError, fold, is_char_key, key_move, navigate, typeahead

__version__ = "0.1.0"
VERSION = __version__

FUNCTIONS = ("attrs", "pagination", "position", "render", "run")


def call(fn: str, args: List[Any]) -> Any:
    """Dynamic entry point used by vector runners and foreign hosts (SPEC 4)."""

    def arg(i: int, default: Any) -> Any:
        return args[i] if len(args) > i and args[i] is not None else default

    if fn == "run":
        return run(args[0] if args else None, args[1] if len(args) > 1 else {}, args[2] if len(args) > 2 else None)
    if fn == "attrs":
        return attrs_after(args[0] if args else None, args[1] if len(args) > 1 else {}, arg(2, []))
    if fn == "position":
        return position(args[0] if args else None)
    if fn == "pagination":
        return pagination(args[0] if args else None)
    if fn == "render":
        return render(args[0] if args else None, arg(1, {}))
    raise LombokUIError("invalid_component", f'unknown function "{fn}"')


def create_machine(component: str, options: Any = None) -> Machine:
    return Machine(component, options)


__all__ = [
    "CATALOGS", "COMPONENTS", "ERROR_CODES", "FUNCTIONS", "LABEL_KEYS", "PLACEMENTS", "RENDERABLE", "VERSION",
    "LombokUIError", "Machine", "attrs_after", "call", "component_names", "create_machine", "escape_attr", "escape_text",
    "filter_items", "fold", "get_component", "is_char_key", "key_move", "navigate", "pagination", "position", "render",
    "resolve_locale", "run", "safe_url", "typeahead",
]
