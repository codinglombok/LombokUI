import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, firstEnabled, isCharKey, keyMove, navigate, ordered, readItems, Reader, typeahead, type Dir, type Item } from "../util.js";
import { readIdList } from "./accordion.js";

export interface ListboxCtx {
  base: string;
  items: Item[];
  multiple: boolean;
  orientation: "vertical" | "horizontal";
  dir: Dir;
  loop: boolean;
  selectionFollowsFocus: boolean;
  typeaheadTimeout: number;
}
export type ListboxState = { focused: string | null; selected: string[]; query: string; queryAt: number | null };

const EVENTS: EventSchema = {
  focus: {},
  blur: {},
  highlight: { req: { id: "id" } },
  select: { req: { id: "id" } },
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

export const listbox: Component<ListboxCtx, ListboxState> = {
  name: "listbox",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", [
      "idBase", "items", "multiple", "defaultSelected", "orientation", "dir", "loop", "selectionFollowsFocus", "typeaheadTimeout",
    ]);
    const items = readItems(r.raw("items"), "invalid_option");
    const ctx: ListboxCtx = {
      base: r.idBase(),
      items,
      multiple: r.bool("multiple", false),
      orientation: r.oneOf("orientation", ["vertical", "horizontal"] as const, "vertical"),
      dir: r.oneOf("dir", ["ltr", "rtl"] as const, "ltr"),
      loop: r.bool("loop", false),
      selectionFollowsFocus: r.bool("selectionFollowsFocus", false),
      typeaheadTimeout: r.int("typeaheadTimeout", 0, 60000, 500),
    };
    if (ctx.multiple && ctx.selectionFollowsFocus) r.bad("selectionFollowsFocus", "requires multiple to be false");
    const selected = readIdList(r, "defaultSelected", items);
    if (!ctx.multiple && selected.length > 1) r.bad("defaultSelected", "may hold at most one id unless multiple is true");
    return { ctx, state: { focused: null, selected, query: "", queryAt: null } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let focused = state.focused;
    let selected = state.selected;
    let query = state.query;
    let queryAt = state.queryAt;

    const choose = (id: string): void => {
      if (ctx.multiple) {
        const set = new Set(selected);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        selected = ordered(ctx.items, set);
      } else if (selected.length !== 1 || selected[0] !== id) {
        selected = [id];
      }
    };
    const moveTo = (id: string | null): void => {
      if (id === null || id === focused) return;
      focused = id;
      if (ctx.selectionFollowsFocus) choose(id);
    };

    if (e.type === "focus") {
      if (focused === null) focused = selected.length > 0 ? selected[0] : firstEnabled(ctx.items);
    } else if (e.type === "blur") {
      focused = null;
      query = "";
      queryAt = null;
    } else if (e.type === "highlight" || e.type === "select") {
      const it = findItem(ctx.items, e.id);
      if (it === null) fail("invalid_event", `${e.type}: unknown item "${String(e.id)}"`);
      if (!it.disabled) {
        focused = it.id;
        if (e.type === "select") choose(it.id);
      }
    } else if (focused !== null) {
      const key = e.key as string;
      const ctrlA = ctx.multiple && (e.ctrl === true || e.meta === true) && e.alt !== true && (key === "a" || key === "A");
      if (ctrlA) {
        const enabled = ctx.items.filter((it) => !it.disabled).map((it) => it.id);
        selected = enabled.every((id) => selected.includes(id)) ? [] : enabled;
      } else if (!hasModifier(e)) {
        const move = keyMove(key, ctx.orientation, ctx.dir);
        if (move !== null) {
          moveTo(navigate(ctx.items, focused, move, ctx.loop));
        } else if (key === " " || key === "Enter") {
          if (!findItem(ctx.items, focused)?.disabled) choose(focused);
        } else if (isCharKey(key)) {
          if (e.at === undefined) fail("invalid_event", "keydown with a character key requires at");
          const t = typeahead(ctx.items, focused, { query, queryAt }, key, e.at as number, ctx.typeaheadTimeout);
          query = t.query;
          queryAt = t.queryAt;
          moveTo(t.match);
        }
      }
    }
    if (selected !== state.selected) effects.push({ type: "change", name: "selected", value: selected });
    return { state: { focused, selected, query, queryAt }, effects };
  },
  attrs(ctx, state) {
    const lb: Attrs = { id: `${ctx.base}-listbox`, role: "listbox" };
    if (ctx.multiple) lb["aria-multiselectable"] = "true";
    lb["aria-orientation"] = ctx.orientation;
    if (state.focused !== null) lb["aria-activedescendant"] = `${ctx.base}-option-${state.focused}`;
    lb.tabindex = "0";
    const out: Record<string, Attrs> = { listbox: lb };
    const sel = new Set(state.selected);
    for (const it of ctx.items) {
      const o: Attrs = { id: `${ctx.base}-option-${it.id}`, role: "option", "aria-selected": bool(sel.has(it.id)) };
      if (it.disabled) o["aria-disabled"] = "true";
      if (it.id === state.focused) o["data-highlighted"] = true;
      out[`option:${it.id}`] = o;
    }
    return out;
  },
};
