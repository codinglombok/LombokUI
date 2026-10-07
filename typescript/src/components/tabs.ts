import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, firstEnabled, keyMove, navigate, readItems, Reader, type Dir, type Item } from "../util.js";

export interface TabsCtx {
  base: string;
  items: Item[];
  activation: "automatic" | "manual";
  orientation: "horizontal" | "vertical";
  dir: Dir;
  loop: boolean;
}
export type TabsState = { selected: string; focused: string | null };

const EVENTS: EventSchema = {
  select: { req: { id: "id" } },
  focus: { req: { id: "id" } },
  blur: {},
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

function item(ctx: TabsCtx, id: unknown, ev: string): Item {
  const it = findItem(ctx.items, id);
  if (it === null) fail("invalid_event", `${ev}: unknown item "${String(id)}"`);
  return it;
}

export const tabs: Component<TabsCtx, TabsState> = {
  name: "tabs",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "items", "defaultSelected", "activation", "orientation", "dir", "loop"]);
    const items = readItems(r.raw("items"), "invalid_option");
    const ctx: TabsCtx = {
      base: r.idBase(),
      items,
      activation: r.oneOf("activation", ["automatic", "manual"] as const, "automatic"),
      orientation: r.oneOf("orientation", ["horizontal", "vertical"] as const, "horizontal"),
      dir: r.oneOf("dir", ["ltr", "rtl"] as const, "ltr"),
      loop: r.bool("loop", true),
    };
    const first = firstEnabled(items);
    if (first === null) r.bad("items", "must contain at least one enabled item");
    let selected = first;
    if (r.has("defaultSelected")) {
      const it = findItem(items, r.raw("defaultSelected"));
      if (it === null || it.disabled) r.bad("defaultSelected", "must be the id of an enabled item");
      selected = it.id;
    }
    return { ctx, state: { selected, focused: null } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let next = state;
    if (e.type === "select") {
      const it = item(ctx, e.id, "select");
      if (!it.disabled) next = { selected: it.id, focused: it.id };
    } else if (e.type === "focus") {
      next = { selected: state.selected, focused: item(ctx, e.id, "focus").id };
    } else if (e.type === "blur") {
      next = { selected: state.selected, focused: null };
    } else if (state.focused !== null && !hasModifier(e)) {
      const key = e.key as string;
      if (key === "Enter" || key === " ") {
        if (!item(ctx, state.focused, "keydown").disabled) next = { selected: state.focused, focused: state.focused };
      } else {
        const move = keyMove(key, ctx.orientation, ctx.dir);
        if (move !== null) {
          const to = navigate(ctx.items, state.focused, move, ctx.loop);
          if (to !== null && to !== state.focused) {
            next = { selected: ctx.activation === "automatic" ? to : state.selected, focused: to };
            effects.push({ type: "focus", target: `tab:${to}` });
          }
        }
      }
    }
    if (next.selected !== state.selected) effects.unshift({ type: "change", name: "selected", value: next.selected });
    return { state: next, effects };
  },
  attrs(ctx, state) {
    const out: Record<string, Attrs> = { tablist: { role: "tablist", "aria-orientation": ctx.orientation } };
    const tabbable = state.focused ?? state.selected;
    for (const it of ctx.items) {
      const sel = it.id === state.selected;
      const tid = `${ctx.base}-tab-${it.id}`;
      const pid = `${ctx.base}-panel-${it.id}`;
      const tab: Attrs = { id: tid, role: "tab", "aria-selected": bool(sel), "aria-controls": pid };
      if (it.disabled) tab["aria-disabled"] = "true";
      tab.tabindex = it.id === tabbable ? "0" : "-1";
      tab["data-state"] = sel ? "active" : "inactive";
      const panel: Attrs = { id: pid, role: "tabpanel", "aria-labelledby": tid, tabindex: "0", "data-state": sel ? "active" : "inactive" };
      if (!sel) panel.hidden = true;
      out[`tab:${it.id}`] = tab;
      out[`panel:${it.id}`] = panel;
    }
    return out;
  },
};
