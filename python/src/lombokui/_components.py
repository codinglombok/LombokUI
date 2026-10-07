"""The thirteen component state machines (SPEC 5). Each is pure: ``send`` never mutates its input state."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ._machine import KEY_FIELDS, Component, has_modifier, read_event, register
from ._util import (
    MAX_DURATION,
    Item,
    Reader,
    bool_attr,
    decimals_of,
    fail,
    find_item,
    first_enabled,
    fold,
    format_number,
    index_of,
    is_char_key,
    is_id,
    key_move,
    navigate,
    ordered,
    read_items,
    typeahead,
)

Attrs = Dict[str, Any]


def _change(name: str, value: Any) -> dict:
    return {"type": "change", "name": name, "value": value}


def _focus(target: str) -> dict:
    return {"type": "focus", "target": target}


def state_attr(open_: bool) -> str:
    return "open" if open_ else "closed"


def _item(items: List[Item], item_id: Any, ev: str) -> Item:
    it = find_item(items, item_id)
    if it is None:
        fail("invalid_event", f'{ev}: unknown item "{item_id}"')
    return it


def _read_id_list(r: Reader, key: str, items: List[Item]) -> List[str]:
    if key not in r.src:
        return []
    v = r.src[key]
    if not isinstance(v, list):
        r.bad(key, "must be an array of item ids")
    seen: "set[str]" = set()
    for x in v:
        if find_item(items, x) is None or x in seen:
            r.bad(key, "must list existing item ids without duplicates")
        seen.add(x)
    return ordered(items, seen)


KEYDOWN = {"req": {"key": "key"}, "opt": KEY_FIELDS}

# ---------------------------------------------------------------- disclosure (SPEC 5.1)


@dataclass
class _DisclosureCtx:
    base: str
    disabled: bool


class Disclosure(Component):
    name = "disclosure"
    EVENTS = {"toggle": {}, "open": {}, "close": {}}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "defaultOpen", "disabled"))
        return _DisclosureCtx(r.id_base(), r.bool("disabled", False)), {"open": r.bool("defaultOpen", False)}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        if ctx.disabled:
            return state, []
        open_ = (not state["open"]) if e["type"] == "toggle" else e["type"] == "open"
        if open_ == state["open"]:
            return state, []
        return {"open": open_}, [_change("open", open_)]

    def attrs(self, ctx, state):
        b = ctx.base
        trigger: Attrs = {"id": f"{b}-trigger", "aria-expanded": bool_attr(state["open"]), "aria-controls": f"{b}-panel"}
        if ctx.disabled:
            trigger["aria-disabled"] = "true"
        trigger["data-state"] = state_attr(state["open"])
        panel: Attrs = {"id": f"{b}-panel", "data-state": state_attr(state["open"])}
        if not state["open"]:
            panel["hidden"] = True
        return {"trigger": trigger, "panel": panel}


# ---------------------------------------------------------------- accordion (SPEC 5.2)


@dataclass
class AccordionCtx:
    base: str
    items: List[Item]
    multiple: bool
    collapsible: bool
    orientation: str
    dir: str
    loop: bool


class Accordion(Component):
    name = "accordion"
    EVENTS = {"toggle": {"req": {"id": "id"}}, "focus": {"req": {"id": "id"}}, "blur": {}, "keydown": KEYDOWN}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "multiple", "collapsible", "defaultExpanded", "orientation", "dir", "loop"))
        items = read_items(r.raw("items"), "invalid_option")
        ctx = AccordionCtx(
            r.id_base(),
            items,
            r.bool("multiple", False),
            r.bool("collapsible", True),
            r.one_of("orientation", ("vertical", "horizontal"), "vertical"),
            r.one_of("dir", ("ltr", "rtl"), "ltr"),
            r.bool("loop", True),
        )
        expanded = _read_id_list(r, "defaultExpanded", items)
        if not ctx.multiple and len(expanded) > 1:
            r.bad("defaultExpanded", "may hold at most one id unless multiple is true")
        return ctx, {"expanded": expanded, "focused": None}

    def _toggle(self, ctx: AccordionCtx, state: dict, item_id: Any) -> dict:
        it = _item(ctx.items, item_id, "toggle")
        if it.disabled:
            return state
        s = set(state["expanded"])
        if it.id in s:
            if not ctx.collapsible and len(s) == 1:
                return state
            s.discard(it.id)
        else:
            if not ctx.multiple:
                s.clear()
            s.add(it.id)
        return {"expanded": ordered(ctx.items, s), "focused": state["focused"]}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        effects: list = []
        nxt = state
        t = e["type"]
        if t == "toggle":
            nxt = self._toggle(ctx, state, e["id"])
        elif t == "focus":
            if index_of(ctx.items, e["id"]) < 0:
                fail("invalid_event", f'focus: unknown item "{e["id"]}"')
            nxt = {"expanded": state["expanded"], "focused": e["id"]}
        elif t == "blur":
            nxt = {"expanded": state["expanded"], "focused": None}
        elif state["focused"] is not None and not has_modifier(e):
            key = e["key"]
            if key in ("Enter", " "):
                nxt = self._toggle(ctx, state, state["focused"])
            else:
                move = key_move(key, ctx.orientation, ctx.dir)
                if move is not None:
                    to = navigate(ctx.items, state["focused"], move, ctx.loop)
                    if to is not None and to != state["focused"]:
                        nxt = {"expanded": state["expanded"], "focused": to}
                        effects.append(_focus(f"header:{to}"))
        if nxt["expanded"] is not state["expanded"]:
            effects.insert(0, _change("expanded", nxt["expanded"]))
        return nxt, effects

    def attrs(self, ctx, state):
        out: Dict[str, Attrs] = {"root": {"data-orientation": ctx.orientation}}
        s = set(state["expanded"])
        for it in ctx.items:
            open_ = it.id in s
            hid = f"{ctx.base}-header-{it.id}"
            pid = f"{ctx.base}-panel-{it.id}"
            header: Attrs = {"id": hid, "aria-expanded": bool_attr(open_), "aria-controls": pid}
            if it.disabled or (open_ and not ctx.collapsible and len(s) == 1):
                header["aria-disabled"] = "true"
            header["data-state"] = state_attr(open_)
            panel: Attrs = {"id": pid, "role": "region", "aria-labelledby": hid, "data-state": state_attr(open_)}
            if not open_:
                panel["hidden"] = True
            out[f"header:{it.id}"] = header
            out[f"panel:{it.id}"] = panel
        return out


# ---------------------------------------------------------------- tabs (SPEC 5.3)


@dataclass
class TabsCtx:
    base: str
    items: List[Item]
    activation: str
    orientation: str
    dir: str
    loop: bool


class Tabs(Component):
    name = "tabs"
    EVENTS = {"select": {"req": {"id": "id"}}, "focus": {"req": {"id": "id"}}, "blur": {}, "keydown": KEYDOWN}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "defaultSelected", "activation", "orientation", "dir", "loop"))
        items = read_items(r.raw("items"), "invalid_option")
        ctx = TabsCtx(
            r.id_base(),
            items,
            r.one_of("activation", ("automatic", "manual"), "automatic"),
            r.one_of("orientation", ("horizontal", "vertical"), "horizontal"),
            r.one_of("dir", ("ltr", "rtl"), "ltr"),
            r.bool("loop", True),
        )
        first = first_enabled(items)
        if first is None:
            r.bad("items", "must contain at least one enabled item")
        selected = first
        if r.has("defaultSelected"):
            it = find_item(items, r.raw("defaultSelected"))
            if it is None or it.disabled:
                r.bad("defaultSelected", "must be the id of an enabled item")
            selected = it.id
        return ctx, {"selected": selected, "focused": None}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        effects: list = []
        nxt = state
        t = e["type"]
        if t == "select":
            it = _item(ctx.items, e["id"], "select")
            if not it.disabled:
                nxt = {"selected": it.id, "focused": it.id}
        elif t == "focus":
            nxt = {"selected": state["selected"], "focused": _item(ctx.items, e["id"], "focus").id}
        elif t == "blur":
            nxt = {"selected": state["selected"], "focused": None}
        elif state["focused"] is not None and not has_modifier(e):
            key = e["key"]
            if key in ("Enter", " "):
                if not _item(ctx.items, state["focused"], "keydown").disabled:
                    nxt = {"selected": state["focused"], "focused": state["focused"]}
            else:
                move = key_move(key, ctx.orientation, ctx.dir)
                if move is not None:
                    to = navigate(ctx.items, state["focused"], move, ctx.loop)
                    if to is not None and to != state["focused"]:
                        nxt = {"selected": to if ctx.activation == "automatic" else state["selected"], "focused": to}
                        effects.append(_focus(f"tab:{to}"))
        if nxt["selected"] != state["selected"]:
            effects.insert(0, _change("selected", nxt["selected"]))
        return nxt, effects

    def attrs(self, ctx, state):
        out: Dict[str, Attrs] = {"tablist": {"role": "tablist", "aria-orientation": ctx.orientation}}
        tabbable = state["focused"] if state["focused"] is not None else state["selected"]
        for it in ctx.items:
            sel = it.id == state["selected"]
            tid = f"{ctx.base}-tab-{it.id}"
            pid = f"{ctx.base}-panel-{it.id}"
            tab: Attrs = {"id": tid, "role": "tab", "aria-selected": bool_attr(sel), "aria-controls": pid}
            if it.disabled:
                tab["aria-disabled"] = "true"
            tab["tabindex"] = "0" if it.id == tabbable else "-1"
            tab["data-state"] = "active" if sel else "inactive"
            panel: Attrs = {"id": pid, "role": "tabpanel", "aria-labelledby": tid, "tabindex": "0", "data-state": "active" if sel else "inactive"}
            if not sel:
                panel["hidden"] = True
            out[f"tab:{it.id}"] = tab
            out[f"panel:{it.id}"] = panel
        return out


# ---------------------------------------------------------------- listbox (SPEC 5.4)


@dataclass
class ListboxCtx:
    base: str
    items: List[Item]
    multiple: bool
    orientation: str
    dir: str
    loop: bool
    selection_follows_focus: bool
    typeahead_timeout: int


class Listbox(Component):
    name = "listbox"
    EVENTS = {"focus": {}, "blur": {}, "highlight": {"req": {"id": "id"}}, "select": {"req": {"id": "id"}}, "keydown": KEYDOWN}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "multiple", "defaultSelected", "orientation", "dir", "loop", "selectionFollowsFocus", "typeaheadTimeout"))
        items = read_items(r.raw("items"), "invalid_option")
        ctx = ListboxCtx(
            r.id_base(),
            items,
            r.bool("multiple", False),
            r.one_of("orientation", ("vertical", "horizontal"), "vertical"),
            r.one_of("dir", ("ltr", "rtl"), "ltr"),
            r.bool("loop", False),
            r.bool("selectionFollowsFocus", False),
            r.int("typeaheadTimeout", 0, 60000, 500),
        )
        if ctx.multiple and ctx.selection_follows_focus:
            r.bad("selectionFollowsFocus", "requires multiple to be false")
        selected = _read_id_list(r, "defaultSelected", items)
        if not ctx.multiple and len(selected) > 1:
            r.bad("defaultSelected", "may hold at most one id unless multiple is true")
        return ctx, {"focused": None, "selected": selected, "query": "", "queryAt": None}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        focused = state["focused"]
        selected = state["selected"]
        query = state["query"]
        query_at = state["queryAt"]

        def choose(item_id: str) -> None:
            nonlocal selected
            if ctx.multiple:
                s = set(selected)
                if item_id in s:
                    s.discard(item_id)
                else:
                    s.add(item_id)
                selected = ordered(ctx.items, s)
            elif len(selected) != 1 or selected[0] != item_id:
                selected = [item_id]

        def move_to(item_id: Optional[str]) -> None:
            nonlocal focused
            if item_id is None or item_id == focused:
                return
            focused = item_id
            if ctx.selection_follows_focus:
                choose(item_id)

        t = e["type"]
        if t == "focus":
            if focused is None:
                focused = selected[0] if selected else first_enabled(ctx.items)
        elif t == "blur":
            focused = None
            query = ""
            query_at = None
        elif t in ("highlight", "select"):
            it = _item(ctx.items, e["id"], t)
            if not it.disabled:
                focused = it.id
                if t == "select":
                    choose(it.id)
        elif focused is not None:
            key = e["key"]
            ctrl_a = ctx.multiple and (e.get("ctrl") is True or e.get("meta") is True) and e.get("alt") is not True and key in ("a", "A")
            if ctrl_a:
                enabled = [it.id for it in ctx.items if not it.disabled]
                selected = [] if all(x in selected for x in enabled) else enabled
            elif not has_modifier(e):
                move = key_move(key, ctx.orientation, ctx.dir)
                if move is not None:
                    move_to(navigate(ctx.items, focused, move, ctx.loop))
                elif key in (" ", "Enter"):
                    it = find_item(ctx.items, focused)
                    if it is not None and not it.disabled:
                        choose(focused)
                elif is_char_key(key):
                    if "at" not in e:
                        fail("invalid_event", "keydown with a character key requires at")
                    query, query_at, match = typeahead(ctx.items, focused, query, query_at, key, e["at"], ctx.typeahead_timeout)
                    move_to(match)
        effects = [_change("selected", selected)] if selected is not state["selected"] else []
        return {"focused": focused, "selected": selected, "query": query, "queryAt": query_at}, effects

    def attrs(self, ctx, state):
        lb: Attrs = {"id": f"{ctx.base}-listbox", "role": "listbox"}
        if ctx.multiple:
            lb["aria-multiselectable"] = "true"
        lb["aria-orientation"] = ctx.orientation
        if state["focused"] is not None:
            lb["aria-activedescendant"] = f"{ctx.base}-option-{state['focused']}"
        lb["tabindex"] = "0"
        out: Dict[str, Attrs] = {"listbox": lb}
        sel = set(state["selected"])
        for it in ctx.items:
            o: Attrs = {"id": f"{ctx.base}-option-{it.id}", "role": "option", "aria-selected": bool_attr(it.id in sel)}
            if it.disabled:
                o["aria-disabled"] = "true"
            if it.id == state["focused"]:
                o["data-highlighted"] = True
            out[f"option:{it.id}"] = o
        return out


# ---------------------------------------------------------------- menu (SPEC 5.5)


@dataclass
class MenuCtx:
    base: str
    items: List[Item]
    loop: bool
    typeahead_timeout: int


class Menu(Component):
    name = "menu"
    EVENTS = {
        "triggerClick": {},
        "triggerKeydown": KEYDOWN,
        "keydown": KEYDOWN,
        "highlight": {"req": {"id": "id"}},
        "itemClick": {"req": {"id": "id"}},
        "outsideClick": {},
        "close": {},
    }

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "loop", "typeaheadTimeout"))
        ctx = MenuCtx(r.id_base(), read_items(r.raw("items"), "invalid_option"), r.bool("loop", True), r.int("typeaheadTimeout", 0, 60000, 500))
        return ctx, {"open": False, "focused": None, "query": "", "queryAt": None}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        effects: list = []
        closed = {"open": False, "focused": None, "query": "", "queryAt": None}

        def open_at(move: str) -> dict:
            return {"open": True, "focused": navigate(ctx.items, None, move, False), "query": "", "queryAt": None}

        def close(restore: bool, select: Optional[str]):
            if select is not None:
                effects.append({"type": "select", "id": select})
            effects.append(_change("open", False))
            if restore:
                effects.append(_focus("trigger"))
            return closed, effects

        def opened(s: dict):
            if not state["open"]:
                effects.append(_change("open", True))
            effects.append(_focus("menu"))
            return s, effects

        t = e["type"]
        if t == "triggerClick":
            return close(True, None) if state["open"] else opened(open_at("first"))
        if t == "triggerKeydown":
            if not has_modifier(e):
                key = e["key"]
                if key in ("ArrowDown", "Enter", " "):
                    return opened(open_at("first"))
                if key == "ArrowUp":
                    return opened(open_at("last"))
        elif t in ("outsideClick", "close"):
            if state["open"]:
                return close(False, None)
        elif t in ("highlight", "itemClick"):
            it = _item(ctx.items, e["id"], t)
            if state["open"] and not it.disabled:
                if t == "itemClick":
                    return close(True, it.id)
                return {"open": True, "focused": it.id, "query": state["query"], "queryAt": state["queryAt"]}, effects
        elif t == "keydown" and state["open"]:
            key = e["key"]
            if key == "Escape":
                return close(True, None)
            if key == "Tab":
                return close(False, None)
            if not has_modifier(e):
                if key in ("Enter", " ") and state["focused"] is not None:
                    return close(True, state["focused"])
                move = key_move(key, "vertical", "ltr")
                if move is not None:
                    return {"open": True, "focused": navigate(ctx.items, state["focused"], move, ctx.loop), "query": state["query"], "queryAt": state["queryAt"]}, effects
                if is_char_key(key):
                    if "at" not in e:
                        fail("invalid_event", "keydown with a character key requires at")
                    q, qa, match = typeahead(ctx.items, state["focused"], state["query"], state["queryAt"], key, e["at"], ctx.typeahead_timeout)
                    return {"open": True, "focused": match if match is not None else state["focused"], "query": q, "queryAt": qa}, effects
        return state, effects

    def attrs(self, ctx, state):
        b = ctx.base
        trigger: Attrs = {"id": f"{b}-trigger", "aria-haspopup": "menu", "aria-expanded": bool_attr(state["open"]), "aria-controls": f"{b}-menu", "data-state": state_attr(state["open"])}
        m: Attrs = {"id": f"{b}-menu", "role": "menu", "aria-labelledby": f"{b}-trigger"}
        if state["open"] and state["focused"] is not None:
            m["aria-activedescendant"] = f"{b}-item-{state['focused']}"
        m["tabindex"] = "-1"
        m["data-state"] = state_attr(state["open"])
        if not state["open"]:
            m["hidden"] = True
        out: Dict[str, Attrs] = {"trigger": trigger, "menu": m}
        for it in ctx.items:
            a: Attrs = {"id": f"{b}-item-{it.id}", "role": "menuitem"}
            if it.disabled:
                a["aria-disabled"] = "true"
            a["tabindex"] = "-1"
            if state["open"] and it.id == state["focused"]:
                a["data-highlighted"] = True
            out[f"item:{it.id}"] = a
        return out


# ---------------------------------------------------------------- combobox (SPEC 5.6)


def filter_items(items: List[Item], value: str, mode: str) -> List[str]:
    needle = fold(value)
    out = []
    for it in items:
        lab = fold(it.label)
        if mode == "none" or needle == "" or (needle in lab if mode == "contains" else lab.startswith(needle)):
            out.append(it.id)
    return out


@dataclass
class ComboboxCtx:
    base: str
    items: List[Item]
    filter: str
    loop: bool


class Combobox(Component):
    name = "combobox"
    EVENTS = {
        "input": {"req": {"value": "text"}},
        "keydown": KEYDOWN,
        "highlight": {"req": {"id": "id"}},
        "select": {"req": {"id": "id"}},
        "open": {},
        "close": {},
        "blur": {},
    }

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "defaultSelected", "filter", "loop"))
        ctx = ComboboxCtx(r.id_base(), read_items(r.raw("items"), "invalid_option"), r.one_of("filter", ("contains", "startsWith", "none"), "contains"), r.bool("loop", True))
        selected = None
        input_value = ""
        if r.has("defaultSelected") and r.raw("defaultSelected") is not None:
            it = find_item(ctx.items, r.raw("defaultSelected"))
            if it is None:
                r.bad("defaultSelected", "must be the id of an item")
            selected = it.id
            input_value = it.label
        return ctx, {"inputValue": input_value, "open": False, "active": None, "selected": selected, "visible": filter_items(ctx.items, input_value, ctx.filter)}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        input_value = state["inputValue"]
        open_ = state["open"]
        active = state["active"]
        selected = state["selected"]
        visible = state["visible"]
        select_effects: list = []

        def visible_items() -> List[Item]:
            s = set(visible)
            return [it for it in ctx.items if it.id in s]

        def commit(it: Item) -> None:
            nonlocal selected, input_value, open_, active, visible
            select_effects.append({"type": "select", "id": it.id})
            selected = it.id
            input_value = it.label
            open_ = False
            active = None
            visible = filter_items(ctx.items, input_value, ctx.filter)

        def usable(item_id: Any) -> Optional[Item]:
            it = _item(ctx.items, item_id, e["type"])
            return it if not it.disabled and it.id in visible else None

        t = e["type"]
        if t == "input":
            input_value = e["value"]
            visible = filter_items(ctx.items, input_value, ctx.filter)
            open_ = len(visible) > 0
            active = None
        elif t == "open":
            visible = filter_items(ctx.items, input_value, ctx.filter)
            open_ = len(visible) > 0
        elif t in ("close", "blur"):
            open_ = False
            active = None
        elif t == "highlight":
            it = usable(e["id"])
            if it is not None and open_:
                active = it.id
        elif t == "select":
            it = usable(e["id"])
            if it is not None and open_:
                commit(it)
        elif t == "keydown":
            key = e["key"]
            if not (e.get("ctrl") is True or e.get("meta") is True):
                if key in ("ArrowDown", "ArrowUp"):
                    down = key == "ArrowDown"
                    if not open_:
                        visible = filter_items(ctx.items, input_value, ctx.filter)
                        if visible:
                            open_ = True
                            active = None if e.get("alt") is True else navigate(visible_items(), None, "first" if down else "last", False)
                    elif e.get("alt") is not True:
                        active = navigate(visible_items(), active, "next" if down else "prev", ctx.loop)
                elif key == "Enter":
                    if open_ and active is not None:
                        commit(find_item(ctx.items, active))
                elif key == "Escape":
                    if open_:
                        open_ = False
                        active = None
                    elif input_value != "":
                        input_value = ""
                        selected = None
                        visible = filter_items(ctx.items, input_value, ctx.filter)
                elif key == "Tab":
                    open_ = False
                    active = None
        effects = list(select_effects)
        if selected != state["selected"]:
            effects.append(_change("selected", selected))
        if open_ != state["open"]:
            effects.append(_change("open", open_))
        return {"inputValue": input_value, "open": open_, "active": active, "selected": selected, "visible": visible}, effects

    def attrs(self, ctx, state):
        b = ctx.base
        label: Attrs = {"id": f"{b}-label", "for": f"{b}-input"}
        inp: Attrs = {"id": f"{b}-input", "role": "combobox", "aria-expanded": bool_attr(state["open"]), "aria-controls": f"{b}-listbox", "aria-autocomplete": "list"}
        if state["active"] is not None:
            inp["aria-activedescendant"] = f"{b}-option-{state['active']}"
        inp["autocomplete"] = "off"
        inp["data-state"] = state_attr(state["open"])
        lb: Attrs = {"id": f"{b}-listbox", "role": "listbox", "aria-labelledby": f"{b}-label", "data-state": state_attr(state["open"])}
        if not state["open"]:
            lb["hidden"] = True
        out: Dict[str, Attrs] = {"label": label, "input": inp, "listbox": lb}
        vis = set(state["visible"])
        for it in ctx.items:
            o: Attrs = {"id": f"{b}-option-{it.id}", "role": "option", "aria-selected": bool_attr(it.id == state["selected"])}
            if it.disabled:
                o["aria-disabled"] = "true"
            if it.id == state["active"]:
                o["data-highlighted"] = True
            if it.id not in vis:
                o["hidden"] = True
            out[f"option:{it.id}"] = o
        return out


# ---------------------------------------------------------------- dialog (SPEC 5.7)


@dataclass
class DialogCtx:
    base: str
    role: str
    modal: bool
    close_on_escape: bool
    close_on_outside_click: bool
    description: bool


class Dialog(Component):
    name = "dialog"
    EVENTS = {"open": {}, "close": {}, "escape": {}, "outsideClick": {}}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "role", "modal", "defaultOpen", "closeOnEscape", "closeOnOutsideClick", "description"))
        role = r.one_of("role", ("dialog", "alertdialog"), "dialog")
        ctx = DialogCtx(r.id_base(), role, r.bool("modal", True), r.bool("closeOnEscape", True), r.bool("closeOnOutsideClick", role == "dialog"), r.bool("description", True))
        return ctx, {"open": r.bool("defaultOpen", False)}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        t = e["type"]
        open_ = state["open"]
        if t == "open":
            open_ = True
        elif t == "close":
            open_ = False
        elif t == "escape" and ctx.close_on_escape:
            open_ = False
        elif t == "outsideClick" and ctx.close_on_outside_click:
            open_ = False
        if open_ == state["open"]:
            return state, []
        effects = [_change("open", open_)]
        if open_:
            if ctx.modal:
                effects += [{"type": "lockScroll"}, {"type": "trapFocus"}]
            effects.append(_focus("initial"))
        else:
            if ctx.modal:
                effects += [{"type": "releaseFocus"}, {"type": "unlockScroll"}]
            effects.append({"type": "restoreFocus"})
        return {"open": open_}, effects

    def attrs(self, ctx, state):
        b = ctx.base
        d: Attrs = {"id": f"{b}-dialog", "role": ctx.role}
        if ctx.modal:
            d["aria-modal"] = "true"
        d["aria-labelledby"] = f"{b}-title"
        if ctx.description:
            d["aria-describedby"] = f"{b}-description"
        d["tabindex"] = "-1"
        d["data-state"] = state_attr(state["open"])
        if not state["open"]:
            d["hidden"] = True
        out: Dict[str, Attrs] = {
            "trigger": {"aria-haspopup": "dialog", "aria-expanded": bool_attr(state["open"]), "aria-controls": f"{b}-dialog", "data-state": state_attr(state["open"])},
            "dialog": d,
            "title": {"id": f"{b}-title"},
        }
        if ctx.description:
            out["description"] = {"id": f"{b}-description"}
        return out


# ---------------------------------------------------------------- checkbox and switch (SPEC 5.8)


@dataclass
class ToggleCtx:
    base: str
    disabled: bool


class _Toggle(Component):
    EVENTS = {"toggle": {}, "set": {"req": {"checked": "check"}}, "keydown": KEYDOWN}

    def __init__(self, name: str) -> None:
        self.name = name
        self.tri = name == "checkbox"
        self.keys = (" ",) if self.tri else (" ", "Enter")

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "defaultChecked", "disabled"))
        checked: Any = False
        if r.has("defaultChecked"):
            v = r.raw("defaultChecked")
            if not (isinstance(v, bool) or (self.tri and v == "mixed")):
                r.bad("defaultChecked", 'must be true, false or "mixed"' if self.tri else "must be a boolean")
            checked = v
        return ToggleCtx(r.id_base(), r.bool("disabled", False)), {"checked": checked}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        checked = state["checked"]
        if e["type"] == "set":
            if not self.tri and e["checked"] == "mixed":
                fail("invalid_event", "set.checked must be a boolean for switch")
            if not ctx.disabled:
                checked = e["checked"]
        elif not ctx.disabled and (e["type"] == "toggle" or (not has_modifier(e) and e["key"] in self.keys)):
            checked = checked is not True
        if checked == state["checked"] and type(checked) is type(state["checked"]):
            return state, []
        return {"checked": checked}, [_change("checked", checked)]

    def attrs(self, ctx, state):
        c = state["checked"]
        control: Attrs = {"id": f"{ctx.base}-control", "role": self.name, "aria-checked": "mixed" if c == "mixed" else bool_attr(c)}
        if ctx.disabled:
            control["aria-disabled"] = "true"
        control["tabindex"] = "-1" if ctx.disabled else "0"
        control["data-state"] = "indeterminate" if c == "mixed" else "checked" if c else "unchecked"
        return {"control": control}


# ---------------------------------------------------------------- radiogroup (SPEC 5.9)


@dataclass
class RadioCtx:
    base: str
    items: List[Item]
    dir: str
    loop: bool
    disabled: bool


class RadioGroup(Component):
    name = "radiogroup"
    EVENTS = {"select": {"req": {"id": "id"}}, "focus": {"req": {"id": "id"}}, "blur": {}, "keydown": KEYDOWN}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "items", "defaultValue", "dir", "loop", "disabled"))
        ctx = RadioCtx(r.id_base(), read_items(r.raw("items"), "invalid_option"), r.one_of("dir", ("ltr", "rtl"), "ltr"), r.bool("loop", True), r.bool("disabled", False))
        value = None
        if r.has("defaultValue") and r.raw("defaultValue") is not None:
            it = find_item(ctx.items, r.raw("defaultValue"))
            if it is None or it.disabled:
                r.bad("defaultValue", "must be the id of an enabled item")
            value = it.id
        return ctx, {"value": value, "focused": None}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        effects: list = []
        value = state["value"]
        focused = state["focused"]
        t = e["type"]
        if t in ("select", "focus"):
            it = _item(ctx.items, e["id"], t)
            if t == "focus":
                focused = it.id
            elif not ctx.disabled and not it.disabled:
                value = it.id
                focused = it.id
        elif t == "blur":
            focused = None
        elif focused is not None and not ctx.disabled and not has_modifier(e):
            key = e["key"]
            if key == " ":
                if not find_item(ctx.items, focused).disabled:
                    value = focused
            else:
                move = key_move(key, "both", ctx.dir)
                if move is not None:
                    to = navigate(ctx.items, focused, move, ctx.loop)
                    if to is not None and not find_item(ctx.items, to).disabled:
                        if to != focused:
                            effects.append(_focus(f"radio:{to}"))
                        focused = to
                        value = to
        if value != state["value"]:
            effects.insert(0, _change("value", value))
        return {"value": value, "focused": focused}, effects

    def attrs(self, ctx, state):
        group: Attrs = {"role": "radiogroup"}
        if ctx.disabled:
            group["aria-disabled"] = "true"
        out: Dict[str, Attrs] = {"group": group}
        tabbable = state["focused"]
        if tabbable is None:
            tabbable = state["value"]
        if tabbable is None:
            tabbable = first_enabled(ctx.items)
        for it in ctx.items:
            on = it.id == state["value"]
            a: Attrs = {"id": f"{ctx.base}-radio-{it.id}", "role": "radio", "aria-checked": bool_attr(on)}
            if it.disabled or ctx.disabled:
                a["aria-disabled"] = "true"
            a["tabindex"] = "0" if not ctx.disabled and it.id == tabbable else "-1"
            a["data-state"] = "checked" if on else "unchecked"
            out[f"radio:{it.id}"] = a
        return out


# ---------------------------------------------------------------- slider (SPEC 5.10)

_LIMIT = 2**52


@dataclass
class SliderCtx:
    base: str
    d: int
    D: int
    mi: int
    st: int
    kmax: int
    kl: int
    orientation: str
    dir: str
    disabled: bool


def slider_value(ctx: SliderCtx, k: int) -> float:
    return (ctx.mi + k * ctx.st) / ctx.D


def snap(ctx: SliderCtx, v: float) -> int:
    k = math.floor((float(v) * ctx.D - ctx.mi) / ctx.st + 0.5)
    return min(max(k, 0), ctx.kmax)


class Slider(Component):
    name = "slider"
    EVENTS = {"set": {"req": {"value": "number"}}, "keydown": KEYDOWN}

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "min", "max", "step", "largeStep", "defaultValue", "orientation", "dir", "disabled"))
        lo = r.num("min", 0)
        hi = r.num("max", 100)
        step = r.num("step", 1)
        if not lo < hi:
            r.bad("max", "must be greater than min")
        if not step > 0:
            r.bad("step", "must be greater than 0")
        large = r.num("largeStep", 0) if r.has("largeStep") else None
        if large is not None and not large > 0:
            r.bad("largeStep", "must be greater than 0")
        d = max(decimals_of(lo), decimals_of(hi), decimals_of(step), 0 if large is None else decimals_of(large))
        if d > 10:
            r.bad("step", "values may have at most 10 decimal digits")
        D = 10**d
        mi = round(lo * D)
        ma = round(hi * D)
        st = round(step * D)
        if abs(mi) > _LIMIT or abs(ma) > _LIMIT or st > _LIMIT or st < 1:
            r.bad("max", "range is too large for exact arithmetic")
        span = ma - mi
        kmax = (span - span % st) // st
        kl = max(1, kmax // 10)
        if large is not None:
            kl = math.floor((large * D) / st + 0.5)
            if kl < 1:
                r.bad("largeStep", "must be at least one step")
        ctx = SliderCtx(
            r.id_base(), d, D, mi, st, kmax, kl,
            r.one_of("orientation", ("horizontal", "vertical"), "horizontal"),
            r.one_of("dir", ("ltr", "rtl"), "ltr"),
            r.bool("disabled", False),
        )
        k = snap(ctx, r.num("defaultValue", lo))
        return ctx, {"value": slider_value(ctx, k)}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        if ctx.disabled:
            return state, []
        k0 = snap(ctx, state["value"])
        k = k0
        if e["type"] == "set":
            k = snap(ctx, e["value"])
        elif not has_modifier(e):
            flip = -1 if ctx.orientation == "horizontal" and ctx.dir == "rtl" else 1
            key = e["key"]
            if key == "ArrowUp":
                k = k0 + 1
            elif key == "ArrowDown":
                k = k0 - 1
            elif key == "ArrowRight":
                k = k0 + flip
            elif key == "ArrowLeft":
                k = k0 - flip
            elif key == "PageUp":
                k = k0 + ctx.kl
            elif key == "PageDown":
                k = k0 - ctx.kl
            elif key == "Home":
                k = 0
            elif key == "End":
                k = ctx.kmax
            k = min(max(k, 0), ctx.kmax)
        if k == k0:
            return state, []
        value = slider_value(ctx, k)
        return {"value": value}, [_change("value", value)]

    def attrs(self, ctx, state):
        def fmt(v: float) -> str:
            return format_number(v, ctx.d)

        thumb: Attrs = {
            "id": f"{ctx.base}-thumb",
            "role": "slider",
            "aria-valuemin": fmt(slider_value(ctx, 0)),
            "aria-valuemax": fmt(slider_value(ctx, ctx.kmax)),
            "aria-valuenow": fmt(state["value"]),
            "aria-orientation": ctx.orientation,
        }
        if ctx.disabled:
            thumb["aria-disabled"] = "true"
        thumb["tabindex"] = "-1" if ctx.disabled else "0"
        thumb["data-orientation"] = ctx.orientation
        return {"thumb": thumb}


# ---------------------------------------------------------------- tooltip (SPEC 5.11)


@dataclass
class TooltipCtx:
    base: str
    open_delay: int
    close_delay: int


class Tooltip(Component):
    name = "tooltip"
    EVENTS = {
        "pointerEnter": {"req": {"at": "at"}},
        "pointerLeave": {"req": {"at": "at"}},
        "focus": {"opt": {"at": "at"}},
        "blur": {"opt": {"at": "at"}},
        "escape": {"opt": {"at": "at"}},
        "tick": {"req": {"at": "at"}},
    }

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "openDelay", "closeDelay"))
        return TooltipCtx(r.id_base(), r.int("openDelay", 0, 60000, 700), r.int("closeDelay", 0, 60000, 300)), {"open": False, "pending": None, "dueAt": None}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        at = e.get("at")
        nxt = state
        t = e["type"]

        def settle(o: bool) -> dict:
            return {"open": o, "pending": None, "dueAt": None}

        if t == "pointerEnter":
            if state["open"] or ctx.open_delay == 0:
                nxt = settle(True)
            elif state["pending"] != "open":
                nxt = {"open": False, "pending": "open", "dueAt": at + ctx.open_delay}
        elif t == "pointerLeave":
            if not state["open"] or ctx.close_delay == 0:
                nxt = settle(False)
            elif state["pending"] != "close":
                nxt = {"open": True, "pending": "close", "dueAt": at + ctx.close_delay}
        elif t == "focus":
            nxt = settle(True)
        elif t in ("blur", "escape"):
            nxt = settle(False)
        elif t == "tick":
            if state["pending"] is not None and at >= state["dueAt"]:
                nxt = settle(state["pending"] == "open")
        if nxt["open"] == state["open"] and nxt["pending"] == state["pending"] and nxt["dueAt"] == state["dueAt"]:
            nxt = state
        effects = []
        if nxt["open"] != state["open"]:
            effects.append(_change("open", nxt["open"]))
        if nxt["dueAt"] is not None and nxt["dueAt"] != state["dueAt"]:
            effects.append({"type": "schedule", "at": nxt["dueAt"]})
        return nxt, effects

    def attrs(self, ctx, state):
        trigger: Attrs = {}
        if state["open"]:
            trigger["aria-describedby"] = f"{ctx.base}-tooltip"
        trigger["data-state"] = state_attr(state["open"])
        tip: Attrs = {"id": f"{ctx.base}-tooltip", "role": "tooltip", "data-state": state_attr(state["open"])}
        if not state["open"]:
            tip["hidden"] = True
        return {"trigger": trigger, "tooltip": tip}


# ---------------------------------------------------------------- toast (SPEC 5.12)


@dataclass
class ToastCtx:
    base: str
    max: int
    default_duration: Optional[int]


def _earliest(items: List[dict]) -> Optional[int]:
    m = None
    for t in items:
        if t["deadline"] is not None and (m is None or t["deadline"] < m):
            m = t["deadline"]
    return m


class Toast(Component):
    name = "toast"
    EVENTS = {
        "add": {"req": {"id": "id", "at": "at"}, "opt": {"kind": "kind", "duration": "duration"}},
        "dismiss": {"req": {"id": "id", "at": "at"}},
        "pause": {"req": {"at": "at"}},
        "resume": {"req": {"at": "at"}},
        "tick": {"req": {"at": "at"}},
        "clear": {},
    }

    def setup(self, options: Any):
        r = Reader(options, "invalid_option", "options", ("idBase", "max", "defaultDuration"))
        dd = None if r.has("defaultDuration") and r.raw("defaultDuration") is None else r.int("defaultDuration", 1, MAX_DURATION, 5000)
        return ToastCtx(r.id_base(), r.int("max", 1, 100, 3), dd), {"items": [], "paused": False}

    def send(self, ctx, state, event):
        e = read_event(self.EVENTS, event)
        effects: list = []
        items = [dict(t) for t in state["items"]]
        paused = state["paused"]
        at = e.get("at")

        def activate() -> None:
            if paused:
                return
            for t in items[: ctx.max]:
                if t["remaining"] is not None and t["deadline"] is None:
                    t["deadline"] = at + t["remaining"]

        kind = e["type"]
        if kind == "add":
            tid = e["id"]
            if not is_id(tid):
                fail("invalid_event", "add.id must be an id")
            if any(t["id"] == tid for t in items):
                fail("invalid_event", f'add: duplicate toast "{tid}"')
            duration = e["duration"] if "duration" in e else ctx.default_duration
            items.append({"id": tid, "kind": e.get("kind", "info"), "remaining": duration, "deadline": None})
            activate()
        elif kind == "dismiss":
            before = len(items)
            items = [t for t in items if t["id"] != e["id"]]
            if len(items) != before:
                effects.append({"type": "dismiss", "id": e["id"], "reason": "manual"})
            activate()
        elif kind == "pause":
            if not paused:
                paused = True
                for t in items:
                    if t["deadline"] is not None:
                        t["remaining"] = max(0, t["deadline"] - at)
                        t["deadline"] = None
        elif kind == "resume":
            if paused:
                paused = False
                activate()
        elif kind == "tick":
            keep = []
            for i, t in enumerate(items):
                if i < ctx.max and t["deadline"] is not None and at >= t["deadline"]:
                    effects.append({"type": "dismiss", "id": t["id"], "reason": "timeout"})
                else:
                    keep.append(t)
            items = keep
            activate()
        elif kind == "clear":
            for t in items:
                effects.append({"type": "dismiss", "id": t["id"], "reason": "manual"})
            items = []
        nxt = _earliest(items)
        if nxt is not None and nxt != _earliest(state["items"]):
            effects.append({"type": "schedule", "at": nxt})
        return {"items": items, "paused": paused}, effects

    def attrs(self, ctx, state):
        out: Dict[str, Attrs] = {"region": {"id": f"{ctx.base}-region", "role": "region", "tabindex": "-1", "data-paused": bool_attr(state["paused"])}}
        for i, t in enumerate(state["items"]):
            urgent = t["kind"] in ("warning", "danger")
            a: Attrs = {
                "id": f"{ctx.base}-toast-{t['id']}",
                "role": "alert" if urgent else "status",
                "aria-live": "assertive" if urgent else "polite",
                "aria-atomic": "true",
                "data-kind": t["kind"],
            }
            if i >= ctx.max:
                a["hidden"] = True
            out[f"toast:{t['id']}"] = a
        return out


COMPONENTS = [Accordion(), _Toggle("checkbox"), Combobox(), Dialog(), Disclosure(), Listbox(), Menu(), RadioGroup(), Slider(), _Toggle("switch"), Tabs(), Toast(), Tooltip()]
for _c in COMPONENTS:
    register(_c)
