"""Server-side rendering to HTML strings with LombokCSS class names (SPEC 8)."""

from __future__ import annotations

import math
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from ._components import AccordionCtx, Dialog, Menu, Accordion, Tabs
from ._machine import Component
from ._messages import LABEL_KEYS, label as msg
from ._pagination import pagination
from ._util import MAX_LABEL, LombokUIError, Reader, decimals_of, fail, fits_text, format_number, is_finite_number, is_object, trim_ascii

AttrList = List[Tuple[str, Any]]


def escape_text(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def escape_attr(s: str) -> str:
    return escape_text(s).replace('"', "&quot;").replace("'", "&#39;")


def _attrs(lst: AttrList) -> str:
    out = []
    for k, v in lst:
        if v is None or v is False:
            continue
        out.append(f" {k}" if v is True else f' {k}="{escape_attr(v)}"')
    return "".join(out)


def _from_machine(a: Dict[str, Any], skip: Tuple[str, ...] = ()) -> AttrList:
    return [(k, v) for k, v in a.items() if k not in skip]


def _el(tag: str, lst: AttrList, inner: str) -> str:
    return f"<{tag}{_attrs(lst)}>{inner}</{tag}>"


_SAFE_SCHEMES = ("http", "https", "mailto", "tel")
_SCHEME_RE = re.compile(r"([A-Za-z][A-Za-z0-9+.-]*):")
_LEAD_RE = re.compile(r"^[\x00-\x20]+")
_ICON_RE = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*\Z")


def safe_url(href: str) -> str:
    """Rejects URLs whose scheme is not http, https, mailto or tel (SPEC 8.3)."""
    probe = _LEAD_RE.sub("", re.sub(r"[\t\n\r]", "", href))
    m = _SCHEME_RE.match(probe)
    if m is not None and m.group(1).lower() not in _SAFE_SCHEMES:
        fail("invalid_props", f'href scheme "{m.group(1)}" is not allowed')
    return href


def _icon(name: str) -> str:
    return f'<i data-lf="{name}" aria-hidden="true"></i>'


class Props(Reader):
    def __init__(self, src: Any, allowed: "tuple[str, ...]") -> None:
        super().__init__(src, "invalid_props", "props", allowed)

    def cls(self, base: List[str]) -> str:
        extra = self.text("class", None, 200)
        t = "" if extra is None else trim_ascii(extra)
        return " ".join(base) if t == "" else " ".join(base) + " " + t

    def icon_name(self, key: str) -> Optional[str]:
        v = self.src.get(key)
        if v is None:
            return None
        if not isinstance(v, str) or len(v) > 64 or _ICON_RE.match(v) is None:
            self.bad(key, "must be an icon name such as chevron-down")
        return v

    def labels(self) -> Optional[Dict[str, str]]:
        v = self.src.get("labels")
        if v is None:
            return None
        if not is_object(v):
            self.bad("labels", "must be an object")
        for k, s in v.items():
            if k not in LABEL_KEYS:
                self.bad("labels", f'has unknown key "{k}"')
            if not fits_text(s, MAX_LABEL):
                self.bad("labels", f".{k} must be a string")
        return v

    def locale(self) -> str:
        return self.text("locale", "en", 35)

    def url(self, key: str) -> Optional[str]:
        v = self.text(key, None, 2048)
        return None if v is None else safe_url(v)


def _lbl(p: Props, key: str) -> str:
    return msg(p.locale(), key, p.labels())


VARIANTS = ("primary", "secondary", "outline", "soft", "ghost", "link", "danger")


def _button(props: Any) -> str:
    p = Props(props, ("label", "variant", "size", "type", "disabled", "block", "icon", "iconPosition", "iconOnly", "pressed", "name", "value", "id", "class"))
    text = p.req_text("label")
    variant = p.one_of("variant", VARIANTS, "primary")
    size = p.one_of("size", ("sm", "md", "lg"), "md")
    ic = p.icon_name("icon")
    icon_only = p.bool("iconOnly", False)
    if icon_only and ic is None:
        p.bad("iconOnly", "requires icon")
    pos = p.one_of("iconPosition", ("start", "end"), "start")
    pressed = p.src.get("pressed")
    if pressed is not None and not isinstance(pressed, bool):
        p.bad("pressed", "must be a boolean or null")
    classes = ["btn", f"btn-{variant}"]
    if size != "md":
        classes.append(f"btn-{size}")
    if p.bool("block", False):
        classes.append("btn-block")
    if icon_only:
        classes.append("btn-icon")
    if ic is None:
        inner = escape_text(text)
    elif icon_only:
        inner = _icon(ic)
    elif pos == "start":
        inner = f"{_icon(ic)}<span>{escape_text(text)}</span>"
    else:
        inner = f"<span>{escape_text(text)}</span>{_icon(ic)}"
    return _el("button", [
        ("type", p.one_of("type", ("button", "submit", "reset"), "button")),
        ("class", p.cls(classes)),
        ("id", p.id("id", None)),
        ("name", p.text("name", None)),
        ("value", p.text("value", None)),
        ("aria-label", text if icon_only else None),
        ("aria-pressed", ("true" if pressed else "false") if isinstance(pressed, bool) else None),
        ("disabled", p.bool("disabled", False)),
    ], inner)


def _badge(props: Any) -> str:
    p = Props(props, ("label", "variant", "pill", "class"))
    text = p.req_text("label")
    variant = p.one_of("variant", ("default", "primary", "success", "warning", "danger", "info", "solid"), "default")
    classes = ["badge"]
    if variant != "default":
        classes.append(f"badge-{variant}")
    if p.bool("pill", False):
        classes.append("badge-pill")
    return _el("span", [("class", p.cls(classes))], escape_text(text))


def _alert(props: Any) -> str:
    p = Props(props, ("kind", "title", "body", "class"))
    kind = p.one_of("kind", ("info", "success", "warning", "danger"), "info")
    title = p.text("title", None)
    body = p.req_text("body", 10000)
    urgent = kind in ("warning", "danger")
    inner = ("" if title is None else f'<div class="alert-title">{escape_text(title)}</div>') + escape_text(body)
    return _el("div", [("class", p.cls(["alert", f"alert-{kind}"])), ("role", "alert" if urgent else "status")], f"<div>{inner}</div>")


INPUT_TYPES = ("text", "email", "password", "number", "tel", "url", "search", "date", "time", "datetime-local", "month", "week")


def _req_id(p: Props, key: str = "id") -> str:
    v = p.id(key, None)
    if v is None:
        p.bad(key, "is required")
    return v


def _field(props: Any) -> str:
    p = Props(props, ("id", "label", "type", "name", "value", "placeholder", "autocomplete", "help", "error", "required", "disabled", "readonly", "class"))
    fid = _req_id(p)
    text = p.req_text("label")
    help_ = p.text("help", None)
    error = p.text("error", None)
    described = " ".join(x for x in (f"{fid}-help" if help_ is not None else None, f"{fid}-error" if error is not None else None) if x is not None)
    inp = "<input" + _attrs([
        ("class", "input is-invalid" if error is not None else "input"),
        ("id", fid),
        ("type", p.one_of("type", INPUT_TYPES, "text")),
        ("name", p.text("name", None)),
        ("value", p.text("value", None, 10000)),
        ("placeholder", p.text("placeholder", None)),
        ("autocomplete", p.text("autocomplete", None, 100)),
        ("aria-describedby", None if described == "" else described),
        ("aria-invalid", "true" if error is not None else None),
        ("required", p.bool("required", False)),
        ("disabled", p.bool("disabled", False)),
        ("readonly", p.bool("readonly", False)),
    ]) + ">"
    inner = f'<label class="label" for="{fid}">{escape_text(text)}</label>{inp}'
    if help_ is not None:
        inner += f'<span class="help" id="{fid}-help">{escape_text(help_)}</span>'
    if error is not None:
        inner += f'<span class="error-text" id="{fid}-error">{escape_text(error)}</span>'
    return _el("div", [("class", p.cls(["field"]))], inner)


def _checkbox(props: Any) -> str:
    p = Props(props, ("id", "label", "name", "value", "checked", "disabled", "required", "class"))
    fid = _req_id(p)
    text = p.req_text("label")
    inp = "<input" + _attrs([
        ("type", "checkbox"),
        ("id", fid),
        ("name", p.text("name", None)),
        ("value", p.text("value", None)),
        ("checked", p.bool("checked", False)),
        ("disabled", p.bool("disabled", False)),
        ("required", p.bool("required", False)),
    ]) + ">"
    return _el("div", [("class", p.cls(["check"]))], f'{inp}<label for="{fid}">{escape_text(text)}</label>')


def _switch(props: Any) -> str:
    p = Props(props, ("id", "label", "name", "value", "checked", "disabled", "class"))
    text = p.req_text("label")
    inp = "<input" + _attrs([
        ("type", "checkbox"),
        ("role", "switch"),
        ("id", p.id("id", None)),
        ("name", p.text("name", None)),
        ("value", p.text("value", None)),
        ("checked", p.bool("checked", False)),
        ("disabled", p.bool("disabled", False)),
    ]) + ">"
    return _el("label", [("class", p.cls(["switch"]))], f'<span>{escape_text(text)}</span>{inp}<span class="track"></span>')


def _plain_number(p: Props, key: str, v: float) -> str:
    d = decimals_of(v)
    if d > 6 or abs(v) > 1e15:
        p.bad(key, "must have at most 6 decimal digits and magnitude at most 1e15")
    return format_number(v, d)


def _progress(props: Any) -> str:
    p = Props(props, ("value", "max", "label", "class"))
    if not is_finite_number(p.src.get("value")):
        p.bad("value", "is required and must be a finite number")
    value = float(p.src["value"])
    mx = p.num("max", 100)
    if not mx > 0:
        p.bad("max", "must be greater than 0")
    if value < 0 or value > mx:
        p.bad("value", "must be between 0 and max")
    text = p.req_text("label")
    vs = _plain_number(p, "value", value)
    ms = _plain_number(p, "max", mx)
    n = math.floor((value * 10000) / mx + 0.5)
    pct = format_number(n / 100, 2)
    return _el("div", [("class", p.cls(["progress"])), ("role", "progressbar"), ("aria-label", text), ("aria-valuemin", "0"), ("aria-valuemax", ms), ("aria-valuenow", vs)],
               f'<div class="bar" style="inline-size:{pct}%"></div>')


def _breadcrumb(props: Any) -> str:
    p = Props(props, ("items", "class", "locale", "labels"))
    raw = p.src.get("items")
    if not isinstance(raw, list) or len(raw) < 1 or len(raw) > 100:
        p.bad("items", "must be an array of 1..100 items")
    lis = []
    for i, it in enumerate(raw):
        r = Props(it, ("label", "href"))
        text = escape_text(r.req_text("label"))
        href = r.url("href")
        last = i == len(raw) - 1
        if href is None:
            lis.append(f'<li aria-current="page">{text}</li>' if last else f"<li>{text}</li>")
        else:
            lis.append("<li>" + _el("a", [("href", href), ("aria-current", "page" if last else None)], text) + "</li>")
    return _el("nav", [("aria-label", _lbl(p, "breadcrumb"))], _el("ol", [("class", p.cls(["breadcrumb"]))], "".join(lis)))


def _pagination_html(props: Any) -> str:
    p = Props(props, ("page", "total", "siblings", "boundaries", "href", "class", "locale", "labels"))
    try:
        model = pagination({k: p.src[k] for k in ("page", "total", "siblings", "boundaries") if k in p.src})
    except LombokUIError as e:
        fail("invalid_props", str(e))
    tpl = p.text("href", None, 2048)
    if tpl is not None and "{page}" not in tpl:
        p.bad("href", "must contain {page}")
    if tpl is not None:
        safe_url(tpl.replace("{page}", "1"))
    page = int(p.src["page"]) if "page" in p.src else 1

    def link(n: int, lst: AttrList, inner: str) -> str:
        if tpl is None:
            return _el("button", [("type", "button"), ("data-page", str(n))] + lst, inner)
        return _el("a", [("href", tpl.replace("{page}", str(n)))] + lst, inner)

    def off(lst: AttrList, inner: str) -> str:
        if tpl is None:
            return _el("button", [("type", "button"), ("disabled", True)] + lst, inner)
        return _el("a", [("aria-disabled", "true")] + lst, inner)

    prev_label = _lbl(p, "previous_page")
    next_label = _lbl(p, "next_page")
    lis = "<li>" + (off([("aria-label", prev_label)], "\u2039") if model["prev"] is None else link(model["prev"], [("rel", "prev"), ("aria-label", prev_label)], "\u2039")) + "</li>"
    for it in model["items"]:
        if it == "ellipsis":
            lis += '<li aria-hidden="true"><span>\u2026</span></li>'
        elif it == page:
            lis += '<li class="is-active">' + link(it, [("aria-current", "page")], str(it)) + "</li>"
        else:
            lis += "<li>" + link(it, [], str(it)) + "</li>"
    lis += "<li>" + (off([("aria-label", next_label)], "\u203a") if model["next"] is None else link(model["next"], [("rel", "next"), ("aria-label", next_label)], "\u203a")) + "</li>"
    return _el("nav", [("aria-label", _lbl(p, "pagination"))], _el("ul", [("class", p.cls(["pagination"]))], lis))


def _split_items(p: Props, with_content: bool) -> "tuple[list, Dict[str, str]]":
    raw = p.src.get("items")
    if not isinstance(raw, list):
        p.bad("items", "must be an array")
    items = []
    content: Dict[str, str] = {}
    for it in raw:
        r = Props(it, ("id", "label", "disabled", "content", "contentHtml") if with_content else ("id", "label", "disabled"))
        items.append({k: r.src[k] for k in ("id", "label", "disabled") if k in r.src})
        if with_content:
            if r.has("content") and r.has("contentHtml"):
                r.bad("content", "and contentHtml are mutually exclusive")
            html = r.req_text("contentHtml", 1000000) if r.has("contentHtml") else escape_text(r.text("content", "", 100000))
            content[str(r.src.get("id"))] = html
    return items, content


def _machine_attrs(c: Component, options: Dict[str, Any]) -> "tuple[Any, Dict[str, Dict[str, Any]]]":
    try:
        ctx, state = c.setup(options)
        return ctx, c.attrs(ctx, state)
    except LombokUIError as e:
        fail("invalid_props", str(e))


def _pick(p: Props, keys: "tuple[str, ...]") -> Dict[str, Any]:
    return {k: p.src[k] for k in keys if k in p.src}


def _s(v: bool) -> str:
    return "true" if v else "false"


_TABS = Tabs()
_ACCORDION = Accordion()
_DIALOG = Dialog()
_MENU = Menu()


def _tabs(props: Any) -> str:
    keys = ("idBase", "defaultSelected", "activation", "orientation", "dir", "loop")
    p = Props(props, keys + ("items", "class"))
    items, content = _split_items(p, True)
    ctx, a = _machine_attrs(_TABS, {**_pick(p, keys), "items": items})
    lst = ""
    panels = ""
    for it in ctx.items:
        lst += _el("button", [("type", "button")] + _from_machine(a[f"tab:{it.id}"]) + [("data-lui-part", "tab"), ("data-lui-id", it.id)], escape_text(it.label))
        panels += _el("div", [("class", "tab-panel")] + _from_machine(a[f"panel:{it.id}"]) + [("data-lui-part", "panel"), ("data-lui-id", it.id)], content[it.id])
    return _el("div", [
        ("class", p.cls(["lui-tabs"])),
        ("data-lui", "tabs"),
        ("data-lui-base", ctx.base),
        ("data-activation", ctx.activation),
        ("data-orientation", ctx.orientation),
        ("data-dir", ctx.dir),
        ("data-loop", _s(ctx.loop)),
    ], _el("div", [("class", "tabs")] + _from_machine(a["tablist"]) + [("data-lui-part", "tablist")], lst) + panels)


def _accordion(props: Any) -> str:
    keys = ("idBase", "multiple", "collapsible", "defaultExpanded", "orientation", "dir", "loop")
    p = Props(props, keys + ("items", "headingLevel", "class"))
    level = p.int("headingLevel", 2, 6, 3)
    items, content = _split_items(p, True)
    ctx, a = _machine_attrs(_ACCORDION, {**_pick(p, keys), "items": items})
    assert isinstance(ctx, AccordionCtx)
    inner = ""
    for it in ctx.items:
        button = _el("button", [("type", "button"), ("class", "accordion-trigger")] + _from_machine(a[f"header:{it.id}"]) + [("data-lui-part", "header"), ("data-lui-id", it.id)], escape_text(it.label))
        panel = _el("div", [("class", "accordion-body")] + _from_machine(a[f"panel:{it.id}"]) + [("data-lui-part", "panel"), ("data-lui-id", it.id)], content[it.id])
        inner += f'<div class="accordion-item"><h{level} class="accordion-heading">{button}</h{level}>{panel}</div>'
    return _el("div", [
        ("class", p.cls(["accordion", "lui-accordion"])),
        ("data-lui", "accordion"),
        ("data-lui-base", ctx.base),
        ("data-multiple", _s(ctx.multiple)),
        ("data-collapsible", _s(ctx.collapsible)),
        ("data-orientation", ctx.orientation),
        ("data-dir", ctx.dir),
        ("data-loop", _s(ctx.loop)),
    ], inner)


def _dialog(props: Any) -> str:
    keys = ("idBase", "role", "modal", "defaultOpen", "closeOnEscape", "closeOnOutsideClick")
    p = Props(props, keys + ("title", "description", "body", "bodyHtml", "closeButton", "trigger", "actions", "class", "locale", "labels"))
    title = p.req_text("title")
    description = p.text("description", None)
    if p.has("body") and p.has("bodyHtml"):
        p.bad("body", "and bodyHtml are mutually exclusive")
    if p.has("bodyHtml"):
        body = p.req_text("bodyHtml", 1000000)
    elif p.has("body"):
        body = f"<p>{escape_text(p.req_text('body', 100000))}</p>"
    else:
        body = ""
    ctx, a = _machine_attrs(_DIALOG, {**_pick(p, keys), "description": description is not None})
    open_ = p.bool("defaultOpen", False)
    trigger = ""
    if p.src.get("trigger") is not None:
        t = Props(p.src["trigger"], ("label", "variant"))
        variant = t.one_of("variant", VARIANTS, "primary")
        trigger = _el("button", [("type", "button"), ("class", f"btn btn-{variant}")] + _from_machine(a["trigger"]) + [("data-lui-part", "trigger")], escape_text(t.req_text("label")))
    header = _el("h2", [("class", "modal-title")] + _from_machine(a["title"]) + [("data-lui-part", "title")], escape_text(title))
    if p.bool("closeButton", True):
        header += _el("button", [("type", "button"), ("class", "btn btn-ghost btn-icon btn-sm"), ("aria-label", _lbl(p, "close")), ("data-lui-part", "close")], _icon("x"))
    desc = "" if description is None else _el("p", _from_machine(a["description"]) + [("data-lui-part", "description")], escape_text(description))
    footer = ""
    if p.src.get("actions") is not None:
        acts = p.src["actions"]
        if not isinstance(acts, list) or len(acts) > 10:
            p.bad("actions", "must be an array of at most 10 actions")
        parts = []
        for x in acts:
            r = Props(x, ("label", "variant", "value"))
            parts.append(_el("button", [("type", "button"), ("class", f"btn btn-{r.one_of('variant', VARIANTS, 'ghost')}"), ("value", r.text("value", None)), ("data-lui-part", "close")], escape_text(r.req_text("label"))))
        footer = f'<div class="modal-footer">{"".join(parts)}</div>'
    card = f'<div class="modal-card"><div class="modal-header">{header}</div><div class="modal-body">{desc}{body}</div>{footer}</div>'
    dlg = _el("dialog", [("class", "modal")] + _from_machine(a["dialog"], ("hidden",)) + [("open", open_ and not ctx.modal), ("data-lui-part", "dialog")], card)
    return _el("div", [
        ("class", p.cls(["lui-dialog"])),
        ("data-lui", "dialog"),
        ("data-lui-base", ctx.base),
        ("data-role", ctx.role),
        ("data-modal", _s(ctx.modal)),
        ("data-close-on-escape", _s(ctx.close_on_escape)),
        ("data-close-on-outside-click", _s(ctx.close_on_outside_click)),
    ], trigger + dlg)


def _menu(props: Any) -> str:
    keys = ("idBase", "loop", "typeaheadTimeout")
    p = Props(props, keys + ("label", "items", "variant", "class"))
    text = p.req_text("label")
    variant = p.one_of("variant", VARIANTS, "soft")
    items, _ = _split_items(p, False)
    ctx, a = _machine_attrs(_MENU, {**_pick(p, keys), "items": items})
    trigger = _el("button", [("type", "button"), ("class", f"btn btn-{variant}")] + _from_machine(a["trigger"]) + [("data-lui-part", "trigger")], f"<span>{escape_text(text)}</span>{_icon('chevron-down')}")
    lst = "".join(
        _el("button", [("type", "button"), ("class", "dropdown-item")] + _from_machine(a[f"item:{it.id}"]) + [("data-lui-part", "item"), ("data-lui-id", it.id)], escape_text(it.label))
        for it in ctx.items
    )
    m = _el("div", [("class", "dropdown-menu")] + _from_machine(a["menu"]) + [("data-lui-part", "menu")], lst)
    return _el("div", [("class", p.cls(["dropdown"])), ("data-lui", "menu"), ("data-lui-base", ctx.base), ("data-loop", _s(ctx.loop)), ("data-typeahead-timeout", str(ctx.typeahead_timeout))], trigger + m)


_RENDERERS: Dict[str, Callable[[Any], str]] = {
    "accordion": _accordion,
    "alert": _alert,
    "badge": _badge,
    "breadcrumb": _breadcrumb,
    "button": _button,
    "checkbox": _checkbox,
    "dialog": _dialog,
    "field": _field,
    "menu": _menu,
    "pagination": _pagination_html,
    "progress": _progress,
    "switch": _switch,
    "tabs": _tabs,
}

RENDERABLE = tuple(sorted(_RENDERERS))


def render(component: Any, props: Any = None) -> str:
    """Renders a component to an HTML string. Text and attribute values are escaped; only ``contentHtml`` and ``bodyHtml`` are raw."""
    fn = _RENDERERS.get(component) if isinstance(component, str) else None
    if fn is None:
        fail("invalid_component", f'component "{component}" cannot be rendered')
    return fn({} if props is None else props)
