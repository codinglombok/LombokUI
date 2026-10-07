import { readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { bool, Reader } from "../util.js";
import { stateAttr } from "./disclosure.js";

export interface DialogCtx {
  base: string;
  role: "dialog" | "alertdialog";
  modal: boolean;
  closeOnEscape: boolean;
  closeOnOutsideClick: boolean;
  description: boolean;
}
export type DialogState = { open: boolean };

const EVENTS: EventSchema = { open: {}, close: {}, escape: {}, outsideClick: {} };

export const dialog: Component<DialogCtx, DialogState> = {
  name: "dialog",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "role", "modal", "defaultOpen", "closeOnEscape", "closeOnOutsideClick", "description"]);
    const role = r.oneOf("role", ["dialog", "alertdialog"] as const, "dialog");
    const ctx: DialogCtx = {
      base: r.idBase(),
      role,
      modal: r.bool("modal", true),
      closeOnEscape: r.bool("closeOnEscape", true),
      closeOnOutsideClick: r.bool("closeOnOutsideClick", role === "dialog"),
      description: r.bool("description", true),
    };
    return { ctx, state: { open: r.bool("defaultOpen", false) } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let open = state.open;
    if (e.type === "open") open = true;
    else if (e.type === "close") open = false;
    else if (e.type === "escape" && ctx.closeOnEscape) open = false;
    else if (e.type === "outsideClick" && ctx.closeOnOutsideClick) open = false;
    if (open === state.open) return { state, effects };
    effects.push({ type: "change", name: "open", value: open });
    if (open) {
      if (ctx.modal) effects.push({ type: "lockScroll" }, { type: "trapFocus" });
      effects.push({ type: "focus", target: "initial" });
    } else {
      if (ctx.modal) effects.push({ type: "releaseFocus" }, { type: "unlockScroll" });
      effects.push({ type: "restoreFocus" });
    }
    return { state: { open }, effects };
  },
  attrs(ctx, state) {
    const d: Attrs = { id: `${ctx.base}-dialog`, role: ctx.role };
    if (ctx.modal) d["aria-modal"] = "true";
    d["aria-labelledby"] = `${ctx.base}-title`;
    if (ctx.description) d["aria-describedby"] = `${ctx.base}-description`;
    d.tabindex = "-1";
    d["data-state"] = stateAttr(state.open);
    if (!state.open) d.hidden = true;
    const out: Record<string, Attrs> = {
      trigger: { "aria-haspopup": "dialog", "aria-expanded": bool(state.open), "aria-controls": `${ctx.base}-dialog`, "data-state": stateAttr(state.open) },
      dialog: d,
      title: { id: `${ctx.base}-title` },
    };
    if (ctx.description) out.description = { id: `${ctx.base}-description` };
    return out;
  },
};
