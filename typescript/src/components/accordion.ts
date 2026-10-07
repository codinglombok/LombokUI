import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, indexOf, keyMove, navigate, ordered, readItems, Reader, type Dir, type Item } from "../util.js";
import { stateAttr } from "./disclosure.js";

export interface AccordionCtx {
  base: string;
  items: Item[];
  multiple: boolean;
  collapsible: boolean;
  orientation: "vertical" | "horizontal";
  dir: Dir;
  loop: boolean;
}
export type AccordionState = { expanded: string[]; focused: string | null };

const EVENTS: EventSchema = {
  toggle: { req: { id: "id" } },
  focus: { req: { id: "id" } },
  blur: {},
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

export function readIdList(r: Reader, key: string, items: readonly Item[]): string[] {
  const v = r.raw(key);
  if (v === undefined) return [];
  if (!Array.isArray(v)) r.bad(key, "must be an array of item ids");
  const set = new Set<string>();
  for (const id of v) {
    if (findItem(items, id) === null || set.has(id as string)) r.bad(key, "must list existing item ids without duplicates");
    set.add(id as string);
  }
  return ordered(items, set);
}

function toggle(ctx: AccordionCtx, state: AccordionState, id: string): AccordionState {
  const it = findItem(ctx.items, id);
  if (it === null) fail("invalid_event", `toggle: unknown item "${id}"`);
  if (it.disabled) return state;
  const set = new Set(state.expanded);
  if (set.has(id)) {
    if (!ctx.collapsible && set.size === 1) return state;
    set.delete(id);
  } else {
    if (!ctx.multiple) set.clear();
    set.add(id);
  }
  return { expanded: ordered(ctx.items, set), focused: state.focused };
}

export const accordion: Component<AccordionCtx, AccordionState> = {
  name: "accordion",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "items", "multiple", "collapsible", "defaultExpanded", "orientation", "dir", "loop"]);
    const items = readItems(r.raw("items"), "invalid_option");
    const ctx: AccordionCtx = {
      base: r.idBase(),
      items,
      multiple: r.bool("multiple", false),
      collapsible: r.bool("collapsible", true),
      orientation: r.oneOf("orientation", ["vertical", "horizontal"] as const, "vertical"),
      dir: r.oneOf("dir", ["ltr", "rtl"] as const, "ltr"),
      loop: r.bool("loop", true),
    };
    const expanded = readIdList(r, "defaultExpanded", items);
    if (!ctx.multiple && expanded.length > 1) r.bad("defaultExpanded", "may hold at most one id unless multiple is true");
    return { ctx, state: { expanded, focused: null } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let next = state;
    if (e.type === "toggle") {
      next = toggle(ctx, state, e.id as string);
    } else if (e.type === "focus") {
      if (indexOf(ctx.items, e.id as string) < 0) fail("invalid_event", `focus: unknown item "${String(e.id)}"`);
      next = { expanded: state.expanded, focused: e.id as string };
    } else if (e.type === "blur") {
      next = { expanded: state.expanded, focused: null };
    } else if (state.focused !== null && !hasModifier(e)) {
      const key = e.key as string;
      if (key === "Enter" || key === " ") {
        next = toggle(ctx, state, state.focused);
      } else {
        const move = keyMove(key, ctx.orientation, ctx.dir);
        if (move !== null) {
          const to = navigate(ctx.items, state.focused, move, ctx.loop);
          if (to !== null && to !== state.focused) {
            next = { expanded: state.expanded, focused: to };
            effects.push({ type: "focus", target: `header:${to}` });
          }
        }
      }
    }
    if (next.expanded !== state.expanded) effects.unshift({ type: "change", name: "expanded", value: next.expanded });
    return { state: next, effects };
  },
  attrs(ctx, state) {
    const out: Record<string, Attrs> = { root: { "data-orientation": ctx.orientation } };
    const set = new Set(state.expanded);
    for (const it of ctx.items) {
      const open = set.has(it.id);
      const hid = `${ctx.base}-header-${it.id}`;
      const pid = `${ctx.base}-panel-${it.id}`;
      const header: Attrs = { id: hid, "aria-expanded": bool(open), "aria-controls": pid };
      if (it.disabled || (open && !ctx.collapsible && set.size === 1)) header["aria-disabled"] = "true";
      header["data-state"] = stateAttr(open);
      const panel: Attrs = { id: pid, role: "region", "aria-labelledby": hid, "data-state": stateAttr(open) };
      if (!open) panel.hidden = true;
      out[`header:${it.id}`] = header;
      out[`panel:${it.id}`] = panel;
    }
    return out;
  },
};
