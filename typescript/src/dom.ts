/**
 * DOM adapter (TypeScript only, SPEC 9). It binds the pure machines to real elements:
 * DOM events become machine events, machine attributes are written back, and effects
 * (focus, focus trap, scroll lock, timers, native <dialog>) are executed.
 *
 * Markup produced by `render` (or written by hand with the same `data-lui-*` attributes)
 * is hydrated with `hydrate()`. Nothing runs on import, so the module is safe for SSR.
 */
import "./components/index.js";
import { LombokUIError } from "./errors.js";
import { createMachine, type Attrs, type Effect, type Event, type Machine } from "./machine.js";
import { sliderValue, type SliderCtx } from "./components/slider.js";

export interface Timer {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface MountOptions {
  /** Machine options; when omitted they are read from the `data-*` attributes of the root. */
  options?: Record<string, unknown>;
  /** Called after every transition. */
  onChange?: (state: Record<string, unknown>, effects: Effect[]) => void;
  /** Clock and timers (tests inject fakes). Defaults to `Date.now` and the global timers. */
  timer?: Timer;
}

export interface Mounted {
  readonly root: HTMLElement;
  readonly machine: Machine;
  send(event: Event): Effect[];
  destroy(): void;
}

const ITEM_PART: Record<string, string> = {
  accordion: "header",
  tabs: "tab",
  menu: "item",
  listbox: "option",
  combobox: "option",
  radiogroup: "radio",
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const defaultTimer: Timer = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

function bool(v: string | undefined, def: boolean): boolean {
  return v === undefined ? def : v === "true";
}

/** Reads machine options from the root's data attributes and the item parts (SPEC 9.2). */
export function readOptions(root: HTMLElement, component: string): Record<string, unknown> {
  const d = root.dataset;
  const o: Record<string, unknown> = {};
  if (d.luiBase) o.idBase = d.luiBase;
  const part = ITEM_PART[component];
  if (part) {
    o.items = parts(root, part).map((el) => {
      const it: Record<string, unknown> = { id: el.dataset.luiId as string, label: (el.textContent ?? "").trim() || (el.dataset.luiId as string) };
      if (el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled")) it.disabled = true;
      return it;
    });
  }
  const str = (key: string, opt: string) => {
    if (d[key] !== undefined) o[opt] = d[key];
  };
  const flag = (key: string, opt: string) => {
    if (d[key] !== undefined) o[opt] = bool(d[key], false);
  };
  const num = (key: string, opt: string) => {
    if (d[key] !== undefined) o[opt] = Number(d[key]);
  };
  const int = num;
  switch (component) {
    case "tabs": {
      str("activation", "activation");
      str("orientation", "orientation");
      str("dir", "dir");
      flag("loop", "loop");
      const sel = parts(root, "tab").find((el) => el.getAttribute("aria-selected") === "true");
      if (sel) o.defaultSelected = sel.dataset.luiId;
      break;
    }
    case "accordion": {
      flag("multiple", "multiple");
      flag("collapsible", "collapsible");
      str("orientation", "orientation");
      str("dir", "dir");
      flag("loop", "loop");
      o.defaultExpanded = parts(root, "header").filter((el) => el.getAttribute("aria-expanded") === "true").map((el) => el.dataset.luiId);
      break;
    }
    case "menu":
      flag("loop", "loop");
      int("typeaheadTimeout", "typeaheadTimeout");
      break;
    case "dialog":
      str("role", "role");
      flag("modal", "modal");
      flag("closeOnEscape", "closeOnEscape");
      flag("closeOnOutsideClick", "closeOnOutsideClick");
      o.description = parts(root, "description").length > 0;
      break;
    case "disclosure":
      flag("disabled", "disabled");
      if (part1(root, "trigger")?.getAttribute("aria-expanded") === "true") o.defaultOpen = true;
      break;
    case "listbox":
      flag("multiple", "multiple");
      str("orientation", "orientation");
      flag("selectionFollowsFocus", "selectionFollowsFocus");
      o.defaultSelected = parts(root, "option").filter((el) => el.getAttribute("aria-selected") === "true").map((el) => el.dataset.luiId);
      break;
    case "combobox":
      str("filter", "filter");
      break;
    case "radiogroup": {
      str("dir", "dir");
      flag("disabled", "disabled");
      const on = parts(root, "radio").find((el) => el.getAttribute("aria-checked") === "true");
      if (on) o.defaultValue = on.dataset.luiId;
      break;
    }
    case "slider":
      for (const k of ["min", "max", "step", "largeStep"]) num(k, k);
      if (d.value !== undefined) o.defaultValue = Number(d.value);
      str("orientation", "orientation");
      str("dir", "dir");
      flag("disabled", "disabled");
      break;
    case "tooltip":
      int("openDelay", "openDelay");
      int("closeDelay", "closeDelay");
      break;
    case "toast":
      int("max", "max");
      if (d.defaultDuration !== undefined) o.defaultDuration = d.defaultDuration === "null" ? null : Number(d.defaultDuration);
      break;
    case "checkbox":
    case "switch": {
      flag("disabled", "disabled");
      const c = part1(root, "control")?.getAttribute("aria-checked");
      if (c === "true") o.defaultChecked = true;
      else if (c === "mixed" && component === "checkbox") o.defaultChecked = "mixed";
      break;
    }
  }
  return o;
}

/** Parts that belong to this root, not to a nested component. */
function parts(root: HTMLElement, name: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(`[data-lui-part="${name}"]`).forEach((el) => {
    if (el.parentElement?.closest("[data-lui]") === root || el.closest("[data-lui]") === root) out.push(el);
  });
  return out;
}

function part1(root: HTMLElement, name: string): HTMLElement | null {
  return parts(root, name)[0] ?? null;
}

function partFor(root: HTMLElement, key: string): HTMLElement | null {
  const i = key.indexOf(":");
  if (i < 0) return part1(root, key);
  const name = key.slice(0, i);
  const id = key.slice(i + 1);
  return parts(root, name).find((el) => el.dataset.luiId === id) ?? null;
}

function keyEvent(e: KeyboardEvent, at: number): Event {
  const ev: Event = { type: "keydown", key: e.key, at };
  if (e.shiftKey) ev.shift = true;
  if (e.ctrlKey) ev.ctrl = true;
  if (e.altKey) ev.alt = true;
  if (e.metaKey) ev.meta = true;
  return ev;
}

/** Native buttons turn Enter and Space into a click; forwarding those keys too would act twice. */
function nativeActivation(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return (e.key === "Enter" || e.key === " ") && t !== null && (t.tagName === "BUTTON" || (t.tagName === "A" && e.key === "Enter"));
}

const HANDLED_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", " ", "Enter", "Escape"]);

/**
 * Mounts a component on `root`. The component name defaults to `root.dataset.lui`.
 * Throws `LombokUIError` when the options read from the markup are invalid.
 */
export function mount(root: HTMLElement, component?: string, opts: MountOptions = {}): Mounted {
  const name = component ?? root.dataset.lui;
  if (!name) throw new LombokUIError("invalid_component", "root has no data-lui attribute");
  const timer = opts.timer ?? defaultTimer;
  const doc = root.ownerDocument;
  const machine = createMachine(name, opts.options ?? readOptions(root, name));
  const managed = new Map<HTMLElement, Set<string>>();
  const cleanups: Array<() => void> = [];
  let restoreTarget: HTMLElement | null = null;
  let scrollPrev: string | null = null;
  let trap: ((e: KeyboardEvent) => void) | null = null;
  let scheduled: unknown = null;

  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget | null, type: K | string, fn: (e: never) => void, capture = false): void => {
    if (!el) return;
    el.addEventListener(type, fn as EventListener, capture);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, capture));
  };

  const apply = (): void => {
    const all = machine.attrs();
    for (const [key, attrs] of Object.entries(all)) {
      const el = key === "root" ? root : (partFor(root, key) ?? (key === "region" ? root : null));
      if (el) write(el, attrs);
    }
    if (name === "combobox") {
      const input = part1(root, "input") as HTMLInputElement | null;
      const v = machine.state.inputValue as string;
      if (input && input.value !== v) input.value = v;
    }
    if (name === "slider") {
      const ctx = machine.ctx as SliderCtx;
      const lo = sliderValue(ctx, 0);
      const hi = sliderValue(ctx, ctx.kmax);
      const pct = hi === lo ? 0 : (((machine.state.value as number) - lo) / (hi - lo)) * 100;
      root.style.setProperty("--lui-value-percent", `${pct}%`);
    }
  };

  const write = (el: HTMLElement, attrs: Attrs): void => {
    const prev = managed.get(el) ?? new Set<string>();
    const next = new Set<string>();
    const nativeDialog = el.tagName === "DIALOG";
    for (const [k, v] of Object.entries(attrs)) {
      if (nativeDialog && k === "hidden") continue;
      next.add(k);
      const s = v === true ? "" : v;
      if (el.getAttribute(k) !== s) el.setAttribute(k, s);
    }
    for (const k of prev) if (!next.has(k)) el.removeAttribute(k);
    managed.set(el, next);
  };

  const focusTarget = (target: string): void => {
    let el: HTMLElement | null;
    if (target === "initial") {
      const dlg = part1(root, "dialog");
      el = dlg?.querySelector<HTMLElement>("[autofocus]") ?? dlg?.querySelector<HTMLElement>(FOCUSABLE) ?? dlg;
    } else {
      el = partFor(root, target);
    }
    el?.focus();
  };

  const run = (effects: Effect[]): void => {
    for (const fx of effects) {
      switch (fx.type) {
        case "focus":
          focusTarget(fx.target as string);
          break;
        case "restoreFocus":
          restoreTarget?.focus();
          restoreTarget = null;
          break;
        case "lockScroll":
          scrollPrev = doc.documentElement.style.overflow;
          doc.documentElement.style.overflow = "hidden";
          break;
        case "unlockScroll":
          doc.documentElement.style.overflow = scrollPrev ?? "";
          scrollPrev = null;
          break;
        case "trapFocus": {
          const dlg = part1(root, "dialog");
          trap = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || !dlg) return;
            const items = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)];
            if (items.length === 0) {
              e.preventDefault();
              return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && doc.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && doc.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          };
          doc.addEventListener("keydown", trap, true);
          break;
        }
        case "releaseFocus":
          if (trap) doc.removeEventListener("keydown", trap, true);
          trap = null;
          break;
        case "schedule": {
          if (scheduled !== null) timer.clearTimeout(scheduled);
          const at = fx.at as number;
          scheduled = timer.setTimeout(() => {
            scheduled = null;
            send({ type: "tick", at: Math.max(at, timer.now()) });
          }, Math.max(0, at - timer.now()));
          break;
        }
        case "change":
          if (name === "dialog" && fx.name === "open") {
            if (fx.value === true && restoreTarget === null) restoreTarget = doc.activeElement as HTMLElement | null;
            nativeDialog(fx.value === true);
          }
          root.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).CustomEvent("lui:change", { detail: { name: fx.name, value: fx.value } }));
          break;
        case "select":
          root.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).CustomEvent("lui:select", { detail: { id: fx.id } }));
          break;
        case "dismiss":
          partFor(root, `toast:${fx.id as string}`)?.remove();
          root.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).CustomEvent("lui:dismiss", { detail: { id: fx.id, reason: fx.reason } }));
          break;
      }
    }
  };

  const nativeDialog = (open: boolean): void => {
    const dlg = part1(root, "dialog") as HTMLDialogElement | null;
    if (!dlg || dlg.tagName !== "DIALOG") return;
    const modal = (machine.ctx as { modal: boolean }).modal;
    if (open && !dlg.open) {
      if (modal && typeof dlg.showModal === "function") dlg.showModal();
      else if (typeof dlg.show === "function") dlg.show();
      else dlg.setAttribute("open", "");
    } else if (!open && dlg.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  };

  const send = (event: Event): Effect[] => {
    const effects = machine.send(event);
    apply();
    run(effects);
    opts.onChange?.(machine.state, effects);
    return effects;
  };

  const idOf = (el: EventTarget | null, part: string): string | null => {
    const hit = (el as HTMLElement | null)?.closest?.(`[data-lui-part="${part}"]`) as HTMLElement | null;
    return hit && (hit.closest("[data-lui]") === root || hit.parentElement?.closest("[data-lui]") === root) ? (hit.dataset.luiId ?? null) : null;
  };

  const forwardKeys = (el: HTMLElement | null, prevent: (key: string) => boolean = (k) => HANDLED_KEYS.has(k)): void => {
    on(el, "keydown", (e: KeyboardEvent) => {
      if (nativeActivation(e)) return;
      if (prevent(e.key)) e.preventDefault();
      send(keyEvent(e, timer.now()));
    });
  };

  const roving = (part: string, click: "toggle" | "select"): void => {
    for (const el of parts(root, part)) {
      const id = el.dataset.luiId as string;
      on(el, "click", () => send({ type: click, id }));
      on(el, "focus", () => send({ type: "focus", id }));
      on(el, "blur", (e: FocusEvent) => {
        if (idOf(e.relatedTarget, part) === null) send({ type: "blur" });
      });
      forwardKeys(el);
    }
  };

  const outside = (fn: () => void): void => {
    on(doc, "pointerdown", (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) fn();
    }, true);
  };

  switch (name) {
    case "disclosure":
      on(part1(root, "trigger"), "click", () => send({ type: "toggle" }));
      break;
    case "accordion":
      roving("header", "toggle");
      break;
    case "tabs":
      roving("tab", "select");
      break;
    case "radiogroup":
      roving("radio", "select");
      break;
    case "listbox": {
      const lb = part1(root, "listbox");
      on(lb, "focus", () => send({ type: "focus" }));
      on(lb, "blur", () => send({ type: "blur" }));
      forwardKeys(lb);
      on(lb, "click", (e: MouseEvent) => {
        const id = idOf(e.target, "option");
        if (id) send({ type: "select", id });
      });
      on(lb, "pointermove", (e: PointerEvent) => {
        const id = idOf(e.target, "option");
        if (id && id !== machine.state.focused) send({ type: "highlight", id });
      });
      break;
    }
    case "menu": {
      const trigger = part1(root, "trigger");
      const m = part1(root, "menu");
      on(trigger, "click", () => send({ type: "triggerClick" }));
      on(trigger, "keydown", (e: KeyboardEvent) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          send({ type: "triggerKeydown", key: e.key });
        }
      });
      forwardKeys(m, (k) => k !== "Tab");
      on(m, "click", (e: MouseEvent) => {
        const id = idOf(e.target, "item");
        if (id) send({ type: "itemClick", id });
      });
      on(m, "pointermove", (e: PointerEvent) => {
        const id = idOf(e.target, "item");
        if (id && id !== machine.state.focused) send({ type: "highlight", id });
      });
      outside(() => send({ type: "outsideClick" }));
      break;
    }
    case "combobox": {
      const input = part1(root, "input") as HTMLInputElement | null;
      const lb = part1(root, "listbox");
      on(input, "input", () => send({ type: "input", value: input?.value ?? "" }));
      on(input, "keydown", (e: KeyboardEvent) => {
        const open = machine.state.open === true;
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || (open && (e.key === "Enter" || e.key === "Escape"))) e.preventDefault();
        const ev = keyEvent(e, timer.now());
        delete ev.at;
        send(ev);
      });
      on(input, "blur", () => send({ type: "blur" }));
      on(lb, "pointerdown", (e: PointerEvent) => e.preventDefault());
      on(lb, "click", (e: MouseEvent) => {
        const id = idOf(e.target, "option");
        if (id) send({ type: "select", id });
      });
      on(lb, "pointermove", (e: PointerEvent) => {
        const id = idOf(e.target, "option");
        if (id && id !== machine.state.active) send({ type: "highlight", id });
      });
      break;
    }
    case "dialog": {
      const dlg = part1(root, "dialog");
      on(part1(root, "trigger"), "click", (e: MouseEvent) => {
        if (machine.state.open !== true) restoreTarget = e.currentTarget as HTMLElement;
        send({ type: "open" });
      });
      for (const c of parts(root, "close")) {
        on(c, "click", () => {
          const v = (c as HTMLButtonElement).value;
          if (v) root.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).CustomEvent("lui:action", { detail: { value: v } }));
          send({ type: "close" });
        });
      }
      on(dlg, "cancel", (e: globalThis.Event) => {
        e.preventDefault();
        send({ type: "escape" });
      });
      on(dlg, "keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          send({ type: "escape" });
        }
      });
      on(dlg, "click", (e: MouseEvent) => {
        if (e.target === dlg && dlg?.tagName === "DIALOG") send({ type: "outsideClick" });
      });
      if (dlg && dlg.tagName !== "DIALOG") outside(() => send({ type: "outsideClick" }));
      break;
    }
    case "checkbox":
    case "switch": {
      const c = part1(root, "control");
      on(c, "click", () => send({ type: "toggle" }));
      forwardKeys(c, (k) => k === " ");
      break;
    }
    case "slider": {
      const thumb = part1(root, "thumb");
      const track = part1(root, "track") ?? root;
      forwardKeys(thumb);
      const fromPointer = (e: PointerEvent): void => {
        const ctx = machine.ctx as SliderCtx;
        const r = track.getBoundingClientRect();
        const vertical = ctx.orientation === "vertical";
        const size = vertical ? r.height : r.width;
        if (size <= 0) return;
        let ratio = vertical ? (r.bottom - e.clientY) / size : (e.clientX - r.left) / size;
        if (!vertical && ctx.dir === "rtl") ratio = 1 - ratio;
        const lo = sliderValue(ctx, 0);
        const hi = sliderValue(ctx, ctx.kmax);
        send({ type: "set", value: lo + Math.min(Math.max(ratio, 0), 1) * (hi - lo) });
      };
      let dragging = false;
      on(track, "pointerdown", (e: PointerEvent) => {
        // Without this the browser's default mousedown handling moves focus away from the thumb.
        e.preventDefault();
        dragging = true;
        thumb?.focus();
        fromPointer(e);
      });
      on(doc, "pointermove", (e: PointerEvent) => {
        if (dragging) fromPointer(e);
      });
      on(doc, "pointerup", () => {
        dragging = false;
      });
      break;
    }
    case "tooltip": {
      const trigger = part1(root, "trigger");
      on(trigger, "pointerenter", () => send({ type: "pointerEnter", at: timer.now() }));
      on(trigger, "pointerleave", () => send({ type: "pointerLeave", at: timer.now() }));
      on(trigger, "focus", () => send({ type: "focus" }));
      on(trigger, "blur", () => send({ type: "blur" }));
      on(doc, "keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape" && machine.state.open === true) send({ type: "escape" });
      });
      break;
    }
    case "toast": {
      const region = part1(root, "region") ?? root;
      on(region, "pointerenter", () => send({ type: "pause", at: timer.now() }));
      on(region, "pointerleave", () => send({ type: "resume", at: timer.now() }));
      on(region, "click", (e: MouseEvent) => {
        const id = idOf(e.target, "close");
        if (id) send({ type: "dismiss", id, at: timer.now() });
      });
      break;
    }
  }

  apply();

  return {
    root,
    machine,
    send,
    destroy() {
      for (const c of cleanups.splice(0)) c();
      if (trap) doc.removeEventListener("keydown", trap, true);
      if (scrollPrev !== null) doc.documentElement.style.overflow = scrollPrev;
      if (scheduled !== null) timer.clearTimeout(scheduled);
    },
  };
}

/** Mounts every `[data-lui]` element under `scope` that is not mounted yet. */
export function hydrate(scope: ParentNode, opts: Omit<MountOptions, "options"> = {}): Mounted[] {
  const out: Mounted[] = [];
  scope.querySelectorAll<HTMLElement>("[data-lui]").forEach((el) => {
    if (el.dataset.luiMounted === "true") return;
    out.push(mount(el, undefined, opts));
    el.dataset.luiMounted = "true";
  });
  return out;
}

export interface ToastInput {
  id?: string;
  kind?: "info" | "success" | "warning" | "danger";
  title?: string;
  body: string;
  duration?: number | null;
}

/**
 * A toast region: creates the toast elements (text only, escaped by the DOM) and drives the
 * queue machine. `region` should be an element with `data-lui="toast"`.
 */
export function toaster(region: HTMLElement, opts: Omit<MountOptions, "options"> & { options?: Record<string, unknown>; closeLabel?: string } = {}) {
  const m = mount(region, "toast", { ...opts, options: opts.options ?? readOptions(region, "toast") });
  const doc = region.ownerDocument;
  const timer = opts.timer ?? defaultTimer;
  let n = 0;
  return {
    mounted: m,
    show(t: ToastInput): string {
      const id = t.id ?? `t${++n}`;
      const el = doc.createElement("div");
      el.className = `toast toast-${t.kind ?? "info"}`;
      el.dataset.luiPart = "toast";
      el.dataset.luiId = id;
      if (t.title) {
        const h = doc.createElement("div");
        h.className = "toast-title";
        h.textContent = t.title;
        el.append(h);
      }
      const b = doc.createElement("div");
      b.textContent = t.body;
      el.append(b);
      const close = doc.createElement("button");
      close.type = "button";
      close.className = "btn btn-ghost btn-icon btn-sm";
      close.setAttribute("aria-label", opts.closeLabel ?? "Close");
      close.dataset.luiPart = "close";
      close.dataset.luiId = id;
      close.innerHTML = '<i data-lf="x" aria-hidden="true"></i>';
      el.append(close);
      region.append(el);
      const ev: Event = { type: "add", id, kind: t.kind ?? "info", at: timer.now() };
      if (t.duration !== undefined) ev.duration = t.duration;
      try {
        m.send(ev);
      } catch (e) {
        el.remove();
        throw e;
      }
      return id;
    },
    dismiss(id: string): void {
      m.send({ type: "dismiss", id, at: timer.now() });
    },
    destroy(): void {
      m.destroy();
    },
  };
}
