import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { decimalsOf, formatNumber, Reader, type Dir } from "../util.js";

/** Grid arithmetic is done on scaled integers (SPEC 5.10) so every port gets identical values. */
export interface SliderCtx {
  base: string;
  d: number;
  D: number;
  mi: number;
  st: number;
  kmax: number;
  kl: number;
  orientation: "horizontal" | "vertical";
  dir: Dir;
  disabled: boolean;
}
export type SliderState = { value: number };

const EVENTS: EventSchema = {
  set: { req: { value: "number" } },
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

const LIMIT = 2 ** 52;

export function sliderValue(ctx: SliderCtx, k: number): number {
  return (ctx.mi + k * ctx.st) / ctx.D;
}

export function snap(ctx: SliderCtx, v: number): number {
  const k = Math.floor((v * ctx.D - ctx.mi) / ctx.st + 0.5);
  return Math.min(Math.max(k, 0), ctx.kmax);
}

export const slider: Component<SliderCtx, SliderState> = {
  name: "slider",
  setup(options) {
    const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "min", "max", "step", "largeStep", "defaultValue", "orientation", "dir", "disabled"]);
    const min = r.num("min", 0);
    const max = r.num("max", 100);
    const step = r.num("step", 1);
    if (!(min < max)) r.bad("max", "must be greater than min");
    if (!(step > 0)) r.bad("step", "must be greater than 0");
    const large = r.has("largeStep") ? r.num("largeStep", 0) : null;
    if (large !== null && !(large > 0)) r.bad("largeStep", "must be greater than 0");
    const d = Math.max(decimalsOf(min), decimalsOf(max), decimalsOf(step), large === null ? 0 : decimalsOf(large));
    if (d > 10) r.bad("step", "values may have at most 10 decimal digits");
    const D = 10 ** d;
    const mi = Math.round(min * D);
    const ma = Math.round(max * D);
    const st = Math.round(step * D);
    if (Math.abs(mi) > LIMIT || Math.abs(ma) > LIMIT || st > LIMIT || st < 1) r.bad("max", "range is too large for exact arithmetic");
    const span = ma - mi;
    const kmax = (span - (span % st)) / st;
    let kl = Math.max(1, Math.floor(kmax / 10));
    if (large !== null) {
      kl = Math.floor((large * D) / st + 0.5);
      if (kl < 1) r.bad("largeStep", "must be at least one step");
    }
    const ctx: SliderCtx = {
      base: r.idBase(),
      d,
      D,
      mi,
      st,
      kmax,
      kl,
      orientation: r.oneOf("orientation", ["horizontal", "vertical"] as const, "horizontal"),
      dir: r.oneOf("dir", ["ltr", "rtl"] as const, "ltr"),
      disabled: r.bool("disabled", false),
    };
    const k = snap(ctx, r.num("defaultValue", min));
    return { ctx, state: { value: sliderValue(ctx, k) } };
  },
  send(ctx, state, event) {
    const e = readEvent(EVENTS, event);
    const effects: Effect[] = [];
    if (ctx.disabled) return { state, effects };
    const k0 = snap(ctx, state.value);
    let k = k0;
    if (e.type === "set") {
      k = snap(ctx, e.value as number);
    } else if (!hasModifier(e)) {
      const flip = ctx.orientation === "horizontal" && ctx.dir === "rtl" ? -1 : 1;
      switch (e.key) {
        case "ArrowUp":
          k = k0 + 1;
          break;
        case "ArrowDown":
          k = k0 - 1;
          break;
        case "ArrowRight":
          k = k0 + flip;
          break;
        case "ArrowLeft":
          k = k0 - flip;
          break;
        case "PageUp":
          k = k0 + ctx.kl;
          break;
        case "PageDown":
          k = k0 - ctx.kl;
          break;
        case "Home":
          k = 0;
          break;
        case "End":
          k = ctx.kmax;
          break;
      }
      k = Math.min(Math.max(k, 0), ctx.kmax);
    }
    if (k === k0) return { state, effects };
    const value = sliderValue(ctx, k);
    effects.push({ type: "change", name: "value", value });
    return { state: { value }, effects };
  },
  attrs(ctx, state) {
    const fmt = (v: number): string => formatNumber(v, ctx.d);
    const thumb: Attrs = {
      id: `${ctx.base}-thumb`,
      role: "slider",
      "aria-valuemin": fmt(sliderValue(ctx, 0)),
      "aria-valuemax": fmt(sliderValue(ctx, ctx.kmax)),
      "aria-valuenow": fmt(state.value),
      "aria-orientation": ctx.orientation,
    };
    if (ctx.disabled) thumb["aria-disabled"] = "true";
    thumb.tabindex = ctx.disabled ? "-1" : "0";
    thumb["data-orientation"] = ctx.orientation;
    return { thumb };
  },
};
