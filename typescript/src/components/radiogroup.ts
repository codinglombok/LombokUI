import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, findItem, firstEnabled, keyMove, navigate, readItems, Reader, type Dir, type Item } from "../util.js";

export interface RadioCtx {
  base: string;
  items: Item[];
  dir: Dir;
  loop: boolean;
  disabled: boolean;
}
export type RadioState = { value: string | null; focused: string | null };

const EVENTS: EventSchema = {
  select: { req: { id: "id" } },
  focus: { req: { id: "id" } },
  blur: {},
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

export const radiogroup: Component<RadioCtx, RadioState> = {
  name: "radiogroup",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "items", "defaultValue", "dir", "loop", "disabled"]);
    const ctx: RadioCtx = {
      base: r.idBase(),
      items: readItems(r.raw("items"), "invalid_option"),
      dir: r.oneOf("dir", ["ltr", "rtl"] as const, "ltr"),
      loop: r.bool("loop", true),
      disabled: r.bool("disabled", false),
    };
    let value: string | null = null;
    if (r.has("defaultValue") && r.raw("defaultValue") !== null) {
      const it = findItem(ctx.items, r.raw("defaultValue"));
      if (it === null || it.disabled) r.bad("defaultValue", "must be the id of an enabled item");
      value = it.id;
    }
    return { ctx, state: { value, focused: null } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let { value, focused } = state;
    if (e.type === "select" || e.type === "focus") {
      const it = findItem(ctx.items, e.id);
      if (it === null) fail("invalid_event", `${e.type}: unknown item "${String(e.id)}"`);
      if (e.type === "focus") focused = it.id;
      else if (!ctx.disabled && !it.disabled) {
        value = it.id;
        focused = it.id;
      }
    } else if (e.type === "blur") {
      focused = null;
    } else if (focused !== null && !ctx.disabled && !hasModifier(e)) {
      const key = e.key as string;
      if (key === " ") {
        if (!(findItem(ctx.items, focused) as Item).disabled) value = focused;
      } else {
        const move = keyMove(key, "both", ctx.dir);
        if (move !== null) {
          const to = navigate(ctx.items, focused, move, ctx.loop);
          if (to !== null && !(findItem(ctx.items, to) as Item).disabled) {
            if (to !== focused) effects.push({ type: "focus", target: `radio:${to}` });
            focused = to;
            value = to;
          }
        }
      }
    }
    if (value !== state.value) effects.unshift({ type: "change", name: "value", value });
    return { state: { value, focused }, effects };
  },
  attrs(ctx, state) {
    const group: Attrs = { role: "radiogroup" };
    if (ctx.disabled) group["aria-disabled"] = "true";
    const out: Record<string, Attrs> = { group };
    const tabbable = state.focused ?? state.value ?? firstEnabled(ctx.items);
    for (const it of ctx.items) {
      const on = it.id === state.value;
      const a: Attrs = { id: `${ctx.base}-radio-${it.id}`, role: "radio", "aria-checked": bool(on) };
      if (it.disabled || ctx.disabled) a["aria-disabled"] = "true";
      a.tabindex = !ctx.disabled && it.id === tabbable ? "0" : "-1";
      a["data-state"] = on ? "checked" : "unchecked";
      out[`radio:${it.id}`] = a;
    }
    return out;
  },
};
