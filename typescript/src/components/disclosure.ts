import { readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, Reader } from "../util.js";

export interface DisclosureCtx {
  base: string;
  disabled: boolean;
}
export type DisclosureState = { open: boolean };

const EVENTS: EventSchema = { toggle: {}, open: {}, close: {} };

export function stateAttr(open: boolean): string {
  return open ? "open" : "closed";
}

export const disclosure: Component<DisclosureCtx, DisclosureState> = {
  name: "disclosure",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "defaultOpen", "disabled"]);
    return { ctx: { base: r.idBase(), disabled: r.bool("disabled", false) }, state: { open: r.bool("defaultOpen", false) } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    if (ctx.disabled) return { state, effects };
    const open = e.type === "toggle" ? !state.open : e.type === "open";
    if (open === state.open) return { state, effects };
    effects.push({ type: "change", name: "open", value: open });
    return { state: { open }, effects };
  },
  attrs(ctx, state) {
    const trigger: Attrs = { id: `${ctx.base}-trigger`, "aria-expanded": bool(state.open), "aria-controls": `${ctx.base}-panel` };
    if (ctx.disabled) trigger["aria-disabled"] = "true";
    trigger["data-state"] = stateAttr(state.open);
    const panel: Attrs = { id: `${ctx.base}-panel`, "data-state": stateAttr(state.open) };
    if (!state.open) panel.hidden = true;
    return { trigger, panel };
  },
};
