import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, isCharKey, keyMove, navigate, readItems, Reader, typeahead, type Item } from "../util.js";
import { stateAttr } from "./disclosure.js";

export interface MenuCtx {
  base: string;
  items: Item[];
  loop: boolean;
  typeaheadTimeout: number;
}
export type MenuState = { open: boolean; focused: string | null; query: string; queryAt: number | null };

const EVENTS: EventSchema = {
  triggerClick: {},
  triggerKeydown: { req: { key: "key" }, opt: KEY_FIELDS },
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
  highlight: { req: { id: "id" } },
  itemClick: { req: { id: "id" } },
  outsideClick: {},
  close: {},
};

export const menu: Component<MenuCtx, MenuState> = {
  name: "menu",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "items", "loop", "typeaheadTimeout"]);
    const ctx: MenuCtx = {
      base: r.idBase(),
      items: readItems(r.raw("items"), "invalid_option"),
      loop: r.bool("loop", true),
      typeaheadTimeout: r.int("typeaheadTimeout", 0, 60000, 500),
    };
    return { ctx, state: { open: false, focused: null, query: "", queryAt: null } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    const closed: MenuState = { open: false, focused: null, query: "", queryAt: null };
    const openAt = (move: "first" | "last"): MenuState => ({ open: true, focused: navigate(ctx.items, null, move, false), query: "", queryAt: null });
    const close = (restore: boolean, select: string | null): { state: MenuState; effects: Effect[] } => {
      if (select !== null) effects.push({ type: "select", id: select });
      effects.push({ type: "change", name: "open", value: false });
      if (restore) effects.push({ type: "focus", target: "trigger" });
      return { state: closed, effects };
    };
    const opened = (s: MenuState): { state: MenuState; effects: Effect[] } => {
      if (!state.open) effects.push({ type: "change", name: "open", value: true });
      effects.push({ type: "focus", target: "menu" });
      return { state: s, effects };
    };

    switch (e.type) {
      case "triggerClick":
        return state.open ? close(true, null) : opened(openAt("first"));
      case "triggerKeydown": {
        if (hasModifier(e)) break;
        const key = e.key as string;
        if (key === "ArrowDown" || key === "Enter" || key === " ") return opened(openAt("first"));
        if (key === "ArrowUp") return opened(openAt("last"));
        break;
      }
      case "outsideClick":
      case "close":
        if (state.open) return close(false, null);
        break;
      case "highlight":
      case "itemClick": {
        const it = findItem(ctx.items, e.id);
        if (it === null) fail("invalid_event", `${e.type}: unknown item "${String(e.id)}"`);
        if (!state.open || it.disabled) break;
        if (e.type === "itemClick") return close(true, it.id);
        return { state: { open: true, focused: it.id, query: state.query, queryAt: state.queryAt }, effects };
      }
      case "keydown": {
        if (!state.open) break;
        const key = e.key as string;
        if (key === "Escape") return close(true, null);
        if (key === "Tab") return close(false, null);
        if (hasModifier(e)) break;
        if ((key === "Enter" || key === " ") && state.focused !== null) return close(true, state.focused);
        const move = keyMove(key, "vertical", "ltr");
        if (move !== null) {
          return { state: { open: true, focused: navigate(ctx.items, state.focused, move, ctx.loop), query: state.query, queryAt: state.queryAt }, effects };
        }
        if (isCharKey(key)) {
          if (e.at === undefined) fail("invalid_event", "keydown with a character key requires at");
          const t = typeahead(ctx.items, state.focused, state, key, e.at as number, ctx.typeaheadTimeout);
          return { state: { open: true, focused: t.match ?? state.focused, query: t.query, queryAt: t.queryAt }, effects };
        }
        break;
      }
    }
    return { state, effects };
  },
  attrs(ctx, state) {
    const trigger: Attrs = {
      id: `${ctx.base}-trigger`,
      "aria-haspopup": "menu",
      "aria-expanded": bool(state.open),
      "aria-controls": `${ctx.base}-menu`,
      "data-state": stateAttr(state.open),
    };
    const m: Attrs = { id: `${ctx.base}-menu`, role: "menu", "aria-labelledby": `${ctx.base}-trigger` };
    if (state.open && state.focused !== null) m["aria-activedescendant"] = `${ctx.base}-item-${state.focused}`;
    m.tabindex = "-1";
    m["data-state"] = stateAttr(state.open);
    if (!state.open) m.hidden = true;
    const out: Record<string, Attrs> = { trigger, menu: m };
    for (const it of ctx.items) {
      const a: Attrs = { id: `${ctx.base}-item-${it.id}`, role: "menuitem" };
      if (it.disabled) a["aria-disabled"] = "true";
      a.tabindex = "-1";
      if (state.open && it.id === state.focused) a["data-highlighted"] = true;
      out[`item:${it.id}`] = a;
    }
    return out;
  },
};
