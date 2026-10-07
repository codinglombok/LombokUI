import { readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { Reader } from "../util.js";
import { stateAttr } from "./disclosure.js";

export interface TooltipCtx {
  base: string;
  openDelay: number;
  closeDelay: number;
}
export type TooltipState = { open: boolean; pending: "open" | "close" | null; dueAt: number | null };

const EVENTS: EventSchema = {
  pointerEnter: { req: { at: "at" } },
  pointerLeave: { req: { at: "at" } },
  focus: { opt: { at: "at" } },
  blur: { opt: { at: "at" } },
  escape: { opt: { at: "at" } },
  tick: { req: { at: "at" } },
};

export const tooltip: Component<TooltipCtx, TooltipState> = {
  name: "tooltip",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "openDelay", "closeDelay"]);
    return {
      ctx: { base: r.idBase(), openDelay: r.int("openDelay", 0, 60000, 700), closeDelay: r.int("closeDelay", 0, 60000, 300) },
      state: { open: false, pending: null, dueAt: null },
    };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    let next: TooltipState = state;
    const at = e.at as number;
    const settle = (open: boolean): TooltipState => ({ open, pending: null, dueAt: null });
    switch (e.type) {
      case "pointerEnter":
        if (state.open) next = settle(true);
        else if (ctx.openDelay === 0) next = settle(true);
        else if (state.pending !== "open") next = { open: false, pending: "open", dueAt: at + ctx.openDelay };
        break;
      case "pointerLeave":
        if (!state.open) next = settle(false);
        else if (ctx.closeDelay === 0) next = settle(false);
        else if (state.pending !== "close") next = { open: true, pending: "close", dueAt: at + ctx.closeDelay };
        break;
      case "focus":
        next = settle(true);
        break;
      case "blur":
      case "escape":
        next = settle(false);
        break;
      case "tick":
        if (state.pending !== null && at >= (state.dueAt as number)) next = settle(state.pending === "open");
        break;
    }
    if (next.open === state.open && next.pending === state.pending && next.dueAt === state.dueAt) next = state;
    const effects: Effect[] = [];
    if (next.open !== state.open) effects.push({ type: "change", name: "open", value: next.open });
    if (next.dueAt !== null && next.dueAt !== state.dueAt) effects.push({ type: "schedule", at: next.dueAt });
    return { state: next, effects };
  },
  attrs(ctx, state) {
    const trigger: Attrs = {};
    if (state.open) trigger["aria-describedby"] = `${ctx.base}-tooltip`;
    trigger["data-state"] = stateAttr(state.open);
    const tip: Attrs = { id: `${ctx.base}-tooltip`, role: "tooltip", "data-state": stateAttr(state.open) };
    if (!state.open) tip.hidden = true;
    return { trigger, tooltip: tip };
  },
};
