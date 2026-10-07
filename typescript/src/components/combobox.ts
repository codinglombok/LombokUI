import { fail } from "../errors.js";
import { KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, fold, navigate, readItems, Reader, type Item } from "../util.js";
import { stateAttr } from "./disclosure.js";

export type FilterMode = "contains" | "startsWith" | "none";

export interface ComboboxCtx {
  base: string;
  items: Item[];
  filter: FilterMode;
  loop: boolean;
}
export type ComboboxState = { inputValue: string; open: boolean; active: string | null; selected: string | null; visible: string[] };

const EVENTS: EventSchema = {
  input: { req: { value: "text" } },
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
  highlight: { req: { id: "id" } },
  select: { req: { id: "id" } },
  open: {},
  close: {},
  blur: {},
};

/** Filters items by their label (SPEC 5.6): ASCII case-insensitive. */
export function filterItems(items: readonly Item[], value: string, mode: FilterMode): string[] {
  const needle = fold(value);
  return items
    .filter((it) => mode === "none" || needle === "" || (mode === "contains" ? fold(it.label).includes(needle) : fold(it.label).startsWith(needle)))
    .map((it) => it.id);
}

export const combobox: Component<ComboboxCtx, ComboboxState> = {
  name: "combobox",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "items", "defaultSelected", "filter", "loop"]);
    const ctx: ComboboxCtx = {
      base: r.idBase(),
      items: readItems(r.raw("items"), "invalid_option"),
      filter: r.oneOf("filter", ["contains", "startsWith", "none"] as const, "contains"),
      loop: r.bool("loop", true),
    };
    let selected: string | null = null;
    let inputValue = "";
    if (r.has("defaultSelected") && r.raw("defaultSelected") !== null) {
      const it = findItem(ctx.items, r.raw("defaultSelected"));
      if (it === null) r.bad("defaultSelected", "must be the id of an item");
      selected = it.id;
      inputValue = it.label;
    }
    return { ctx, state: { inputValue, open: false, active: null, selected, visible: filterItems(ctx.items, inputValue, ctx.filter) } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    let { inputValue, open, active, selected, visible } = state;
    const selectEffects: Effect[] = [];
    const visibleItems = (): Item[] => {
      const set = new Set(visible);
      return ctx.items.filter((it) => set.has(it.id));
    };
    const commit = (it: Item): void => {
      selectEffects.push({ type: "select", id: it.id });
      selected = it.id;
      inputValue = it.label;
      open = false;
      active = null;
      visible = filterItems(ctx.items, inputValue, ctx.filter);
    };
    const usable = (id: unknown): Item | null => {
      const it = findItem(ctx.items, id);
      if (it === null) fail("invalid_event", `${e.type}: unknown item "${String(id)}"`);
      return !it.disabled && visible.includes(it.id) ? it : null;
    };

    switch (e.type) {
      case "input":
        inputValue = e.value as string;
        visible = filterItems(ctx.items, inputValue, ctx.filter);
        open = visible.length > 0;
        active = null;
        break;
      case "open":
        visible = filterItems(ctx.items, inputValue, ctx.filter);
        open = visible.length > 0;
        break;
      case "close":
      case "blur":
        open = false;
        active = null;
        break;
      case "highlight": {
        const it = usable(e.id);
        if (it !== null && open) active = it.id;
        break;
      }
      case "select": {
        const it = usable(e.id);
        if (it !== null && open) commit(it);
        break;
      }
      case "keydown": {
        const key = e.key as string;
        if (e.ctrl === true || e.meta === true) break;
        if (key === "ArrowDown" || key === "ArrowUp") {
          const down = key === "ArrowDown";
          if (!open) {
            visible = filterItems(ctx.items, inputValue, ctx.filter);
            if (visible.length === 0) break;
            open = true;
            active = e.alt === true ? null : navigate(visibleItems(), null, down ? "first" : "last", false);
          } else if (e.alt !== true) {
            active = navigate(visibleItems(), active, down ? "next" : "prev", ctx.loop);
          }
        } else if (key === "Enter") {
          if (open && active !== null) commit(findItem(ctx.items, active) as Item);
        } else if (key === "Escape") {
          if (open) {
            open = false;
            active = null;
          } else if (inputValue !== "") {
            inputValue = "";
            selected = null;
            visible = filterItems(ctx.items, inputValue, ctx.filter);
          }
        } else if (key === "Tab") {
          open = false;
          active = null;
        }
        break;
      }
    }
    const effects: Effect[] = [...selectEffects];
    if (selected !== state.selected) effects.push({ type: "change", name: "selected", value: selected });
    if (open !== state.open) effects.push({ type: "change", name: "open", value: open });
    return { state: { inputValue, open, active, selected, visible }, effects };
  },
  attrs(ctx, state) {
    const label: Attrs = { id: `${ctx.base}-label`, for: `${ctx.base}-input` };
    const input: Attrs = {
      id: `${ctx.base}-input`,
      role: "combobox",
      "aria-expanded": bool(state.open),
      "aria-controls": `${ctx.base}-listbox`,
      "aria-autocomplete": "list",
    };
    if (state.active !== null) input["aria-activedescendant"] = `${ctx.base}-option-${state.active}`;
    input.autocomplete = "off";
    input["data-state"] = stateAttr(state.open);
    const lb: Attrs = { id: `${ctx.base}-listbox`, role: "listbox", "aria-labelledby": `${ctx.base}-label`, "data-state": stateAttr(state.open) };
    if (!state.open) lb.hidden = true;
    const out: Record<string, Attrs> = { label, input, listbox: lb };
    const vis = new Set(state.visible);
    for (const it of ctx.items) {
      const o: Attrs = { id: `${ctx.base}-option-${it.id}`, role: "option", "aria-selected": bool(it.id === state.selected) };
      if (it.disabled) o["aria-disabled"] = "true";
      if (it.id === state.active) o["data-highlighted"] = true;
      if (!vis.has(it.id)) o.hidden = true;
      out[`option:${it.id}`] = o;
    }
    return out;
  },
};
