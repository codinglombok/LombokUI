import { accordion, type AccordionCtx } from "./components/accordion.js";
import { dialog, type DialogCtx } from "./components/dialog.js";
import { menu, type MenuCtx } from "./components/menu.js";
import { tabs, type TabsCtx } from "./components/tabs.js";
import { fail, LombokUIError } from "./errors.js";
import { label as msg, LABEL_KEYS, type LabelKey } from "./messages.js";
import type { AnyComponent, Attrs } from "./machine.js";
import { pagination } from "./pagination.js";
import { decimalsOf, fitsText, formatNumber, isFiniteNumber, isObject, MAX_LABEL, Reader, trimAscii } from "./util.js";

/** Escapes text content (SPEC 8.1). */
export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes an attribute value (SPEC 8.1). */
export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type AttrList = Array<[string, string | true | null | undefined | false]>;

function attrs(list: AttrList): string {
  let out = "";
  for (const [k, v] of list) {
    if (v === null || v === undefined || v === false) continue;
    out += v === true ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`;
  }
  return out;
}

function fromMachine(a: Attrs, skip: readonly string[] = []): AttrList {
  return Object.entries(a).filter(([k]) => !skip.includes(k));
}

function el(tag: string, list: AttrList, inner: string): string {
  return `<${tag}${attrs(list)}>${inner}</${tag}>`;
}

const SAFE_SCHEMES = ["http", "https", "mailto", "tel"];

/** Rejects URLs with a scheme other than http, https, mailto and tel (SPEC 8.3). */
export function safeUrl(href: string): string {
  // eslint-disable-next-line no-control-regex
  const probe = href.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+/, "");
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(probe);
  if (m !== null && !SAFE_SCHEMES.includes(m[1].toLowerCase())) fail("invalid_props", `href scheme "${m[1]}" is not allowed`);
  return href;
}

const ICON_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function icon(name: string): string {
  return `<i data-lf="${name}" aria-hidden="true"></i>`;
}

class Props extends Reader {
  constructor(src: unknown, allowed: readonly string[]) {
    super(src, "invalid_props", "props", allowed);
  }

  cls(base: string[]): string {
    const extra = this.text("class", null, 200);
    const t = extra === null ? "" : trimAscii(extra);
    return t === "" ? base.join(" ") : `${base.join(" ")} ${t}`;
  }

  iconName(key: string): string | null {
    const v = this.raw(key);
    if (v === undefined || v === null) return null;
    if (typeof v !== "string" || v.length > 64 || !ICON_RE.test(v)) this.bad(key, "must be an icon name such as chevron-down");
    return v;
  }

  labels(): Record<string, string> | null {
    const v = this.raw("labels");
    if (v === undefined || v === null) return null;
    if (!isObject(v)) this.bad("labels", "must be an object");
    for (const [k, s] of Object.entries(v)) {
      if (!(LABEL_KEYS as readonly string[]).includes(k)) this.bad("labels", `has unknown key "${k}"`);
      if (!fitsText(s, MAX_LABEL)) this.bad("labels", `.${k} must be a string`);
    }
    return v as Record<string, string>;
  }

  locale(): string {
    return this.text("locale", "en", 35) as string;
  }

  url(key: string): string | null {
    const v = this.text(key, null, 2048);
    return v === null ? null : safeUrl(v);
  }
}

function lbl(p: Props, key: LabelKey): string {
  return msg(p.locale(), key, p.labels());
}

const VARIANTS = ["primary", "secondary", "outline", "soft", "ghost", "link", "danger"] as const;

function renderButton(props: unknown): string {
  const p: Props = new Props(props, ["label", "variant", "size", "type", "disabled", "block", "icon", "iconPosition", "iconOnly", "pressed", "name", "value", "id", "class"]);
  const text = p.reqText("label");
  const variant = p.oneOf("variant", VARIANTS, "primary");
  const size = p.oneOf("size", ["sm", "md", "lg"] as const, "md");
  const ic = p.iconName("icon");
  const iconOnly = p.bool("iconOnly", false);
  if (iconOnly && ic === null) p.bad("iconOnly", "requires icon");
  const pos = p.oneOf("iconPosition", ["start", "end"] as const, "start");
  const pressed = p.raw("pressed");
  if (pressed !== undefined && pressed !== null && typeof pressed !== "boolean") p.bad("pressed", "must be a boolean or null");
  const classes = ["btn", `btn-${variant}`];
  if (size !== "md") classes.push(`btn-${size}`);
  if (p.bool("block", false)) classes.push("btn-block");
  if (iconOnly) classes.push("btn-icon");
  let inner: string;
  if (ic === null) inner = escapeText(text);
  else if (iconOnly) inner = icon(ic);
  else inner = pos === "start" ? `${icon(ic)}<span>${escapeText(text)}</span>` : `<span>${escapeText(text)}</span>${icon(ic)}`;
  return el(
    "button",
    [
      ["type", p.oneOf("type", ["button", "submit", "reset"] as const, "button")],
      ["class", p.cls(classes)],
      ["id", p.id("id", null)],
      ["name", p.text("name", null)],
      ["value", p.text("value", null)],
      ["aria-label", iconOnly ? text : null],
      ["aria-pressed", typeof pressed === "boolean" ? String(pressed) : null],
      ["disabled", p.bool("disabled", false)],
    ],
    inner,
  );
}

function renderBadge(props: unknown): string {
  const p: Props = new Props(props, ["label", "variant", "pill", "class"]);
  const text = p.reqText("label");
  const variant = p.oneOf("variant", ["default", "primary", "success", "warning", "danger", "info", "solid"] as const, "default");
  const classes = ["badge"];
  if (variant !== "default") classes.push(`badge-${variant}`);
  if (p.bool("pill", false)) classes.push("badge-pill");
  return el("span", [["class", p.cls(classes)]], escapeText(text));
}

function renderAlert(props: unknown): string {
  const p: Props = new Props(props, ["kind", "title", "body", "class"]);
  const kind = p.oneOf("kind", ["info", "success", "warning", "danger"] as const, "info");
  const title = p.text("title", null);
  const body = p.reqText("body", 10000);
  const urgent = kind === "warning" || kind === "danger";
  const inner = (title === null ? "" : `<div class="alert-title">${escapeText(title)}</div>`) + escapeText(body);
  return el("div", [["class", p.cls(["alert", `alert-${kind}`])], ["role", urgent ? "alert" : "status"]], `<div>${inner}</div>`);
}

const INPUT_TYPES = ["text", "email", "password", "number", "tel", "url", "search", "date", "time", "datetime-local", "month", "week"] as const;

function reqId(p: Props, key = "id"): string {
  const id = p.id(key, null);
  if (id === null) p.bad(key, "is required");
  return id;
}

function renderField(props: unknown): string {
  const p: Props = new Props(props, ["id", "label", "type", "name", "value", "placeholder", "autocomplete", "help", "error", "required", "disabled", "readonly", "class"]);
  const id = reqId(p);
  const text = p.reqText("label");
  const help = p.text("help", null);
  const error = p.text("error", null);
  const described = [help !== null ? `${id}-help` : null, error !== null ? `${id}-error` : null].filter((x) => x !== null).join(" ");
  const input = `<input${attrs([
    ["class", error !== null ? "input is-invalid" : "input"],
    ["id", id],
    ["type", p.oneOf("type", INPUT_TYPES, "text")],
    ["name", p.text("name", null)],
    ["value", p.text("value", null, 10000)],
    ["placeholder", p.text("placeholder", null)],
    ["autocomplete", p.text("autocomplete", null, 100)],
    ["aria-describedby", described === "" ? null : described],
    ["aria-invalid", error !== null ? "true" : null],
    ["required", p.bool("required", false)],
    ["disabled", p.bool("disabled", false)],
    ["readonly", p.bool("readonly", false)],
  ])}>`;
  let inner = `<label class="label" for="${id}">${escapeText(text)}</label>${input}`;
  if (help !== null) inner += `<span class="help" id="${id}-help">${escapeText(help)}</span>`;
  if (error !== null) inner += `<span class="error-text" id="${id}-error">${escapeText(error)}</span>`;
  return el("div", [["class", p.cls(["field"])]], inner);
}

function renderCheckbox(props: unknown): string {
  const p: Props = new Props(props, ["id", "label", "name", "value", "checked", "disabled", "required", "class"]);
  const id = reqId(p);
  const text = p.reqText("label");
  const input = `<input${attrs([
    ["type", "checkbox"],
    ["id", id],
    ["name", p.text("name", null)],
    ["value", p.text("value", null)],
    ["checked", p.bool("checked", false)],
    ["disabled", p.bool("disabled", false)],
    ["required", p.bool("required", false)],
  ])}>`;
  return el("div", [["class", p.cls(["check"])]], `${input}<label for="${id}">${escapeText(text)}</label>`);
}

function renderSwitch(props: unknown): string {
  const p: Props = new Props(props, ["id", "label", "name", "value", "checked", "disabled", "class"]);
  const text = p.reqText("label");
  const input = `<input${attrs([
    ["type", "checkbox"],
    ["role", "switch"],
    ["id", p.id("id", null)],
    ["name", p.text("name", null)],
    ["value", p.text("value", null)],
    ["checked", p.bool("checked", false)],
    ["disabled", p.bool("disabled", false)],
  ])}>`;
  return el("label", [["class", p.cls(["switch"])]], `<span>${escapeText(text)}</span>${input}<span class="track"></span>`);
}

function plainNumber(p: Props, key: string, v: number): string {
  const d = decimalsOf(v);
  if (d > 6 || Math.abs(v) > 1e15) p.bad(key, "must have at most 6 decimal digits and magnitude at most 1e15");
  return formatNumber(v, d);
}

function renderProgress(props: unknown): string {
  const p: Props = new Props(props, ["value", "max", "label", "class"]);
  if (!isFiniteNumber(p.raw("value"))) p.bad("value", "is required and must be a finite number");
  const value = p.raw("value") as number;
  const max = p.num("max", 100);
  if (!(max > 0)) p.bad("max", "must be greater than 0");
  if (value < 0 || value > max) p.bad("value", "must be between 0 and max");
  const text = p.reqText("label");
  const vs = plainNumber(p, "value", value);
  const ms = plainNumber(p, "max", max);
  const n = Math.floor((value * 10000) / max + 0.5);
  const pct = formatNumber(n / 100, 2);
  return el(
    "div",
    [["class", p.cls(["progress"])], ["role", "progressbar"], ["aria-label", text], ["aria-valuemin", "0"], ["aria-valuemax", ms], ["aria-valuenow", vs]],
    `<div class="bar" style="inline-size:${pct}%"></div>`,
  );
}

function renderBreadcrumb(props: unknown): string {
  const p: Props = new Props(props, ["items", "class", "locale", "labels"]);
  const raw = p.raw("items");
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) p.bad("items", "must be an array of 1..100 items");
  const lis = raw.map((it, i) => {
    const r: Props = new Props(it, ["label", "href"]);
    const text = escapeText(r.reqText("label"));
    const href = r.url("href");
    const last = i === raw.length - 1;
    if (href === null) return last ? `<li aria-current="page">${text}</li>` : `<li>${text}</li>`;
    return `<li>${el("a", [["href", href], ["aria-current", last ? "page" : null]], text)}</li>`;
  });
  return el("nav", [["aria-label", lbl(p, "breadcrumb")]], el("ol", [["class", p.cls(["breadcrumb"])]], lis.join("")));
}

function renderPagination(props: unknown): string {
  const p: Props = new Props(props, ["page", "total", "siblings", "boundaries", "href", "class", "locale", "labels"]);
  let model;
  try {
    const args: Record<string, unknown> = {};
    for (const k of ["page", "total", "siblings", "boundaries"]) if (p.has(k)) args[k] = p.raw(k);
    model = pagination(args);
  } catch (e) {
    if (e instanceof LombokUIError) fail("invalid_props", e.message);
    throw e;
  }
  const tpl = p.text("href", null, 2048);
  if (tpl !== null && !tpl.includes("{page}")) p.bad("href", "must contain {page}");
  if (tpl !== null) safeUrl(tpl.split("{page}").join("1"));
  const page = (p.raw("page") as number | undefined) ?? 1;
  const link = (n: number, list: AttrList, inner: string): string =>
    tpl === null ? el("button", [["type", "button"], ["data-page", String(n)], ...list], inner) : el("a", [["href", tpl.split("{page}").join(String(n))], ...list], inner);
  const off = (list: AttrList, inner: string): string =>
    tpl === null ? el("button", [["type", "button"], ["disabled", true], ...list], inner) : el("a", [["aria-disabled", "true"], ...list], inner);
  const prevLabel = lbl(p, "previous_page");
  const nextLabel = lbl(p, "next_page");
  let lis = `<li>${model.prev === null ? off([["aria-label", prevLabel]], "\u2039") : link(model.prev, [["rel", "prev"], ["aria-label", prevLabel]], "\u2039")}</li>`;
  for (const it of model.items) {
    if (it === "ellipsis") lis += `<li aria-hidden="true"><span>\u2026</span></li>`;
    else if (it === page) lis += `<li class="is-active">${link(it, [["aria-current", "page"]], String(it))}</li>`;
    else lis += `<li>${link(it, [], String(it))}</li>`;
  }
  lis += `<li>${model.next === null ? off([["aria-label", nextLabel]], "\u203a") : link(model.next, [["rel", "next"], ["aria-label", nextLabel]], "\u203a")}</li>`;
  return el("nav", [["aria-label", lbl(p, "pagination")]], el("ul", [["class", p.cls(["pagination"])]], lis));
}

interface ContentItem {
  id: string;
  html: string;
}

/** Splits rich items into machine items and their content (text escaped, `contentHtml` raw). */
function splitItems(p: Props, withContent: boolean): { items: unknown[]; content: ContentItem[] } {
  const raw = p.raw("items");
  if (!Array.isArray(raw)) p.bad("items", "must be an array");
  const items: unknown[] = [];
  const content: ContentItem[] = [];
  for (const it of raw) {
    const r: Props = new Props(it, withContent ? ["id", "label", "disabled", "content", "contentHtml"] : ["id", "label", "disabled"]);
    const m: Record<string, unknown> = {};
    for (const k of ["id", "label", "disabled"]) if (r.has(k)) m[k] = r.raw(k);
    items.push(m);
    if (withContent) {
      if (r.has("content") && r.has("contentHtml")) r.bad("content", "and contentHtml are mutually exclusive");
      const html = r.has("contentHtml") ? r.reqText("contentHtml", 1000000) : escapeText(r.text("content", "", 100000) as string);
      content.push({ id: String(r.raw("id")), html });
    }
  }
  return { items, content };
}

/** Builds machine options from props, re-labelling option errors as `invalid_props`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function machineAttrs(c: AnyComponent, options: Record<string, unknown>): { ctx: any; a: Record<string, Attrs> } {
  try {
    const { ctx, state } = c.setup(options);
    return { ctx, a: c.attrs(ctx, state) };
  } catch (e) {
    if (e instanceof LombokUIError) fail("invalid_props", e.message);
    throw e;
  }
}

function pick(p: Props, keys: readonly string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of keys) if (p.has(k)) o[k] = p.raw(k);
  return o;
}

function renderTabs(props: unknown): string {
  const keys = ["idBase", "defaultSelected", "activation", "orientation", "dir", "loop"];
  const p: Props = new Props(props, [...keys, "items", "class"]);
  const { items, content } = splitItems(p, true);
  const { ctx, a } = machineAttrs(tabs as AnyComponent, { ...pick(p, keys), items });
  const c = ctx as TabsCtx;
  const html = new Map(content.map((x) => [x.id, x.html]));
  let list = "";
  let panels = "";
  for (const it of c.items) {
    list += el("button", [["type", "button"], ...fromMachine(a[`tab:${it.id}`]), ["data-lui-part", "tab"], ["data-lui-id", it.id]], escapeText(it.label));
    panels += el("div", [["class", "tab-panel"], ...fromMachine(a[`panel:${it.id}`]), ["data-lui-part", "panel"], ["data-lui-id", it.id]], html.get(it.id) as string);
  }
  return el(
    "div",
    [
      ["class", p.cls(["lui-tabs"])],
      ["data-lui", "tabs"],
      ["data-lui-base", c.base],
      ["data-activation", c.activation],
      ["data-orientation", c.orientation],
      ["data-dir", c.dir],
      ["data-loop", String(c.loop)],
    ],
    el("div", [["class", "tabs"], ...fromMachine(a.tablist), ["data-lui-part", "tablist"]], list) + panels,
  );
}

function renderAccordion(props: unknown): string {
  const keys = ["idBase", "multiple", "collapsible", "defaultExpanded", "orientation", "dir", "loop"];
  const p: Props = new Props(props, [...keys, "items", "headingLevel", "class"]);
  const level = p.int("headingLevel", 2, 6, 3);
  const { items, content } = splitItems(p, true);
  const { ctx, a } = machineAttrs(accordion as AnyComponent, { ...pick(p, keys), items });
  const c = ctx as AccordionCtx;
  const html = new Map(content.map((x) => [x.id, x.html]));
  let inner = "";
  for (const it of c.items) {
    const button = el("button", [["type", "button"], ["class", "accordion-trigger"], ...fromMachine(a[`header:${it.id}`]), ["data-lui-part", "header"], ["data-lui-id", it.id]], escapeText(it.label));
    const panel = el("div", [["class", "accordion-body"], ...fromMachine(a[`panel:${it.id}`]), ["data-lui-part", "panel"], ["data-lui-id", it.id]], html.get(it.id) as string);
    inner += `<div class="accordion-item"><h${level} class="accordion-heading">${button}</h${level}>${panel}</div>`;
  }
  return el(
    "div",
    [
      ["class", p.cls(["accordion", "lui-accordion"])],
      ["data-lui", "accordion"],
      ["data-lui-base", c.base],
      ["data-multiple", String(c.multiple)],
      ["data-collapsible", String(c.collapsible)],
      ["data-orientation", c.orientation],
      ["data-dir", c.dir],
      ["data-loop", String(c.loop)],
    ],
    inner,
  );
}

function renderDialog(props: unknown): string {
  const keys = ["idBase", "role", "modal", "defaultOpen", "closeOnEscape", "closeOnOutsideClick"];
  const p: Props = new Props(props, [...keys, "title", "description", "body", "bodyHtml", "closeButton", "trigger", "actions", "class", "locale", "labels"]);
  const title = p.reqText("title");
  const description = p.text("description", null);
  if (p.has("body") && p.has("bodyHtml")) p.bad("body", "and bodyHtml are mutually exclusive");
  const body = p.has("bodyHtml") ? p.reqText("bodyHtml", 1000000) : p.has("body") ? `<p>${escapeText(p.reqText("body", 100000))}</p>` : "";
  const { ctx, a } = machineAttrs(dialog as AnyComponent, { ...pick(p, keys), description: description !== null });
  const c = ctx as DialogCtx;
  const open = p.bool("defaultOpen", false);
  let trigger = "";
  if (p.has("trigger") && p.raw("trigger") !== null) {
    const t: Props = new Props(p.raw("trigger"), ["label", "variant"]);
    const variant = t.oneOf("variant", VARIANTS, "primary");
    trigger = el("button", [["type", "button"], ["class", `btn btn-${variant}`], ...fromMachine(a.trigger), ["data-lui-part", "trigger"]], escapeText(t.reqText("label")));
  }
  let header = el("h2", [["class", "modal-title"], ...fromMachine(a.title), ["data-lui-part", "title"]], escapeText(title));
  if (p.bool("closeButton", true)) {
    header += el("button", [["type", "button"], ["class", "btn btn-ghost btn-icon btn-sm"], ["aria-label", lbl(p, "close")], ["data-lui-part", "close"]], icon("x"));
  }
  const desc = description === null ? "" : el("p", [...fromMachine(a.description), ["data-lui-part", "description"]], escapeText(description));
  let footer = "";
  if (p.has("actions") && p.raw("actions") !== null) {
    const acts = p.raw("actions");
    if (!Array.isArray(acts) || acts.length > 10) p.bad("actions", "must be an array of at most 10 actions");
    footer = acts
      .map((x) => {
        const r: Props = new Props(x, ["label", "variant", "value"]);
        return el(
          "button",
          [["type", "button"], ["class", `btn btn-${r.oneOf("variant", VARIANTS, "ghost")}`], ["value", r.text("value", null)], ["data-lui-part", "close"]],
          escapeText(r.reqText("label")),
        );
      })
      .join("");
    footer = `<div class="modal-footer">${footer}</div>`;
  }
  const card = `<div class="modal-card"><div class="modal-header">${header}</div><div class="modal-body">${desc}${body}</div>${footer}</div>`;
  const dlg = el("dialog", [["class", "modal"], ...fromMachine(a.dialog, ["hidden"]), ["open", open && !c.modal], ["data-lui-part", "dialog"]], card);
  return el(
    "div",
    [
      ["class", p.cls(["lui-dialog"])],
      ["data-lui", "dialog"],
      ["data-lui-base", c.base],
      ["data-role", c.role],
      ["data-modal", String(c.modal)],
      ["data-close-on-escape", String(c.closeOnEscape)],
      ["data-close-on-outside-click", String(c.closeOnOutsideClick)],
    ],
    trigger + dlg,
  );
}

function renderMenu(props: unknown): string {
  const keys = ["idBase", "loop", "typeaheadTimeout"];
  const p: Props = new Props(props, [...keys, "label", "items", "variant", "class"]);
  const text = p.reqText("label");
  const variant = p.oneOf("variant", VARIANTS, "soft");
  const { items } = splitItems(p, false);
  const { ctx, a } = machineAttrs(menu as AnyComponent, { ...pick(p, keys), items });
  const c = ctx as MenuCtx;
  const trigger = el("button", [["type", "button"], ["class", `btn btn-${variant}`], ...fromMachine(a.trigger), ["data-lui-part", "trigger"]], `<span>${escapeText(text)}</span>${icon("chevron-down")}`);
  const list = c.items
    .map((it) => el("button", [["type", "button"], ["class", "dropdown-item"], ...fromMachine(a[`item:${it.id}`]), ["data-lui-part", "item"], ["data-lui-id", it.id]], escapeText(it.label)))
    .join("");
  const m = el("div", [["class", "dropdown-menu"], ...fromMachine(a.menu), ["data-lui-part", "menu"]], list);
  return el(
    "div",
    [["class", p.cls(["dropdown"])], ["data-lui", "menu"], ["data-lui-base", c.base], ["data-loop", String(c.loop)], ["data-typeahead-timeout", String(c.typeaheadTimeout)]],
    trigger + m,
  );
}

const RENDERERS: Record<string, (props: unknown) => string> = {
  accordion: renderAccordion,
  alert: renderAlert,
  badge: renderBadge,
  breadcrumb: renderBreadcrumb,
  button: renderButton,
  checkbox: renderCheckbox,
  dialog: renderDialog,
  field: renderField,
  menu: renderMenu,
  pagination: renderPagination,
  progress: renderProgress,
  switch: renderSwitch,
  tabs: renderTabs,
};

export const RENDERABLE: readonly string[] = Object.keys(RENDERERS).sort();

/**
 * Server-side rendering to an HTML string with LombokCSS class names (SPEC 8).
 * Every text and attribute value is escaped; only `contentHtml` and `bodyHtml` are inserted raw.
 */
export function render(component: unknown, props: unknown = {}): string {
  const fn = typeof component === "string" && Object.prototype.hasOwnProperty.call(RENDERERS, component) ? RENDERERS[component] : undefined;
  if (!fn) fail("invalid_component", `component "${String(component)}" cannot be rendered`);
  return fn(props);
}
