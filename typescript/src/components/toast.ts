import { fail } from "../errors.js";
import { MAX_DURATION, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { isId, Reader } from "../util.js";

export type ToastKind = "info" | "success" | "warning" | "danger";

export interface ToastCtx {
  base: string;
  max: number;
  defaultDuration: number | null;
}
export type ToastItem = { id: string; kind: ToastKind; remaining: number | null; deadline: number | null };
export type ToastState = { items: ToastItem[]; paused: boolean };

const EVENTS: EventSchema = {
  add: { req: { id: "id", at: "at" }, opt: { kind: "kind", duration: "duration" } },
  dismiss: { req: { id: "id", at: "at" } },
  pause: { req: { at: "at" } },
  resume: { req: { at: "at" } },
  tick: { req: { at: "at" } },
  clear: {},
};

function earliest(items: readonly ToastItem[]): number | null {
  let m: number | null = null;
  for (const t of items) if (t.deadline !== null && (m === null || t.deadline < m)) m = t.deadline;
  return m;
}

export const toast: Component<ToastCtx, ToastState> = {
  name: "toast",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "max", "defaultDuration"]);
    const defaultDuration = r.raw("defaultDuration") === null ? null : r.int("defaultDuration", 1, MAX_DURATION, 5000);
    return { ctx: { base: r.idBase(), max: r.int("max", 1, 100, 3), defaultDuration }, state: { items: [], paused: false } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    let items = state.items.map((t) => ({ ...t }));
    let paused = state.paused;
    const at = e.at as number;
    const activate = (): void => {
      if (paused) return;
      for (let i = 0; i < items.length && i < ctx.max; i++) {
        const t = items[i];
        if (t.remaining !== null && t.deadline === null) t.deadline = at + t.remaining;
      }
    };
    switch (e.type) {
      case "add": {
        const id = e.id as string;
        if (!isId(id)) fail("invalid_event", "add.id must be an id");
        if (items.some((t) => t.id === id)) fail("invalid_event", `add: duplicate toast "${id}"`);
        const duration = e.duration === undefined ? ctx.defaultDuration : (e.duration as number | null);
        items.push({ id, kind: (e.kind as ToastKind | undefined) ?? "info", remaining: duration, deadline: null });
        activate();
        break;
      }
      case "dismiss": {
        const before = items.length;
        items = items.filter((t) => t.id !== e.id);
        if (items.length !== before) effects.push({ type: "dismiss", id: e.id as string, reason: "manual" });
        activate();
        break;
      }
      case "pause":
        if (!paused) {
          paused = true;
          for (const t of items) {
            if (t.deadline !== null) {
              t.remaining = Math.max(0, t.deadline - at);
              t.deadline = null;
            }
          }
        }
        break;
      case "resume":
        if (paused) {
          paused = false;
          activate();
        }
        break;
      case "tick": {
        const keep: ToastItem[] = [];
        items.forEach((t, i) => {
          if (i < ctx.max && t.deadline !== null && at >= t.deadline) effects.push({ type: "dismiss", id: t.id, reason: "timeout" });
          else keep.push(t);
        });
        items = keep;
        activate();
        break;
      }
      case "clear":
        for (const t of items) effects.push({ type: "dismiss", id: t.id, reason: "manual" });
        items = [];
        break;
    }
    const next = earliest(items);
    if (next !== null && next !== earliest(state.items)) effects.push({ type: "schedule", at: next });
    return { state: { items, paused }, effects };
  },
  attrs(ctx, state) {
    const out: Record<string, Attrs> = { region: { id: `${ctx.base}-region`, role: "region", tabindex: "-1", "data-paused": state.paused ? "true" : "false" } };
    state.items.forEach((t, i) => {
      const urgent = t.kind === "warning" || t.kind === "danger";
      const a: Attrs = {
        id: `${ctx.base}-toast-${t.id}`,
        role: urgent ? "alert" : "status",
        "aria-live": urgent ? "assertive" : "polite",
        "aria-atomic": "true",
        "data-kind": t.kind,
      };
      if (i >= ctx.max) a.hidden = true;
      out[`toast:${t.id}`] = a;
    });
    return out;
  },
};
