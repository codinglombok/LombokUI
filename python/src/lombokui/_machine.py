"""Event validation, component registry and the contract entry points ``run`` and ``attrs`` (SPEC 2.3, 4)."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from ._util import MAX_DURATION, MAX_INT, MAX_LABEL, LombokUIError, fail, fits_text, is_finite_number, is_int, is_object

KEY_MAX = 32
KEY_FIELDS = {"at": "at", "shift": "bool", "ctrl": "bool", "alt": "bool", "meta": "bool"}


def _field_ok(kind: str, v: Any) -> bool:
    if kind == "id":
        return isinstance(v, str)
    if kind == "key":
        return isinstance(v, str) and len(v) >= 1 and fits_text(v, KEY_MAX)
    if kind == "at":
        return is_int(v) and 0 <= v <= MAX_INT
    if kind == "bool":
        return isinstance(v, bool)
    if kind == "number":
        return is_finite_number(v)
    if kind == "text":
        return fits_text(v, MAX_LABEL)
    if kind == "check":
        return v is True or v is False or v == "mixed"
    if kind == "duration":
        return v is None or (is_int(v) and 1 <= v <= MAX_DURATION)
    if kind == "kind":
        return v in ("info", "success", "warning", "danger")
    return False


def read_event(schema: Dict[str, Dict[str, Dict[str, str]]], e: Any) -> Dict[str, Any]:
    """Validates an event against a schema. Unknown types and keys are ``invalid_event``."""
    if not is_object(e) or not isinstance(e.get("type"), str):
        fail("invalid_event", "event must be an object with a string type")
    spec = schema.get(e["type"])
    if spec is None:
        fail("invalid_event", f'unknown event type "{e["type"]}"')
    req = spec.get("req", {})
    opt = spec.get("opt", {})
    out: Dict[str, Any] = {"type": e["type"]}
    for k, v in e.items():
        if k == "type":
            continue
        kind = req.get(k) or opt.get(k)
        if kind is None:
            fail("invalid_event", f'{e["type"]}: unknown field "{k}"')
        if not _field_ok(kind, v):
            fail("invalid_event", f'{e["type"]}.{k} is invalid')
        if kind in ("at", "duration") and v is not None:
            v = int(v)
        elif kind == "number":
            v = float(v)
        out[k] = v
    for k in req:
        if k not in e:
            fail("invalid_event", f'{e["type"]}.{k} is required')
    return out


def has_modifier(e: Dict[str, Any]) -> bool:
    return e.get("ctrl") is True or e.get("alt") is True or e.get("meta") is True


class Component:
    """A pure component: ``setup`` validates options, ``send`` is a transition, ``attrs`` maps state to attributes."""

    name = ""

    def setup(self, options: Any) -> "tuple[Any, dict]":
        raise NotImplementedError

    def send(self, ctx: Any, state: dict, event: Any) -> "tuple[dict, list]":
        raise NotImplementedError

    def attrs(self, ctx: Any, state: dict) -> Dict[str, Dict[str, Any]]:
        raise NotImplementedError


_REGISTRY: Dict[str, Component] = {}


def register(c: Component) -> None:
    _REGISTRY[c.name] = c


def get_component(name: Any) -> Component:
    c = _REGISTRY.get(name) if isinstance(name, str) else None
    if c is None:
        fail("invalid_component", f'unknown component "{name}"')
    return c


def component_names() -> List[str]:
    return sorted(_REGISTRY)


def run(component: Any, options: Any, events: Any) -> Dict[str, Any]:
    """Runs a script of events from the initial state (SPEC 4)."""
    c = get_component(component)
    if not isinstance(events, list):
        fail("invalid_event", "events must be an array")
    ctx, state = c.setup(options)
    initial = state
    steps: List[Any] = []
    for e in events:
        try:
            state, effects = c.send(ctx, state, e)
            steps.append({"state": state, "effects": effects})
        except LombokUIError as err:
            steps.append({"$error": err.code})
    return {"initial": initial, "steps": steps}


def attrs_after(component: Any, options: Any, events: Any = None) -> Dict[str, Dict[str, Any]]:
    """Attributes after a script of events; any failing event fails the call (SPEC 4)."""
    c = get_component(component)
    if events is None:
        events = []
    if not isinstance(events, list):
        fail("invalid_event", "events must be an array")
    ctx, state = c.setup(options)
    for e in events:
        state, _ = c.send(ctx, state, e)
    return c.attrs(ctx, state)


class Machine:
    """A stateful convenience wrapper around a pure component."""

    def __init__(self, component: str, options: Optional[dict] = None) -> None:
        self.component = get_component(component)
        self.ctx, self._state = self.component.setup({} if options is None else options)
        self._listeners: List[Callable[[dict, list], None]] = []

    @property
    def state(self) -> dict:
        return self._state

    def send(self, event: dict) -> list:
        self._state, effects = self.component.send(self.ctx, self._state, event)
        for fn in list(self._listeners):
            fn(self._state, effects)
        return effects

    def attrs(self) -> Dict[str, Dict[str, Any]]:
        return self.component.attrs(self.ctx, self._state)

    def subscribe(self, fn: Callable[[dict, list], None]) -> Callable[[], None]:
        self._listeners.append(fn)
        return lambda: self._listeners.remove(fn)
