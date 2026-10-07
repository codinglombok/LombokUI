import { fail } from "../errors.js";
import { hasModifier, KEY_FIELDS, readEvent, type Attrs, type Component, type Effect, type EventSchema } from "../machine.js";
import { Reader } from "../util.js";

export type Checked = boolean | "mixed";

export interface ToggleCtx {
  base: string;
  disabled: boolean;
}
export type ToggleState = { checked: Checked };

const EVENTS: EventSchema = {
  toggle: {},
  set: { req: { checked: "check" } },
  keydown: { req: { key: "key" }, opt: KEY_FIELDS },
};

function checkedAttr(c: Checked): string {
  return c === "mixed" ? "mixed" : c ? "true" : "false";
}

function makeToggle(name: "checkbox" | "switch"): Component<ToggleCtx, ToggleState> {
  const tri = name === "checkbox";
  const keys = tri ? [" "] : [" ", "Enter"];
  return {
    name,
    setup(options) {
      const r: Reader = new Reader(options, "invalid_option", "options", ["idBase", "defaultChecked", "disabled"]);
      let checked: Checked = false;
      if (r.has("defaultChecked")) {
        const v = r.raw("defaultChecked");
        if (!(typeof v === "boolean" || (tri && v === "mixed"))) r.bad("defaultChecked", tri ? "must be true, false or \"mixed\"" : "must be a boolean");
        checked = v as Checked;
      }
      return { ctx: { base: r.idBase(), disabled: r.bool("disabled", false) }, state: { checked } };
    },
    send(ctx, state, event) {
      const e = readEvent(EVENTS, event);
      const effects: Effect[] = [];
      let checked = state.checked;
      if (e.type === "set") {
        if (!tri && e.checked === "mixed") fail("invalid_event", "set.checked must be a boolean for switch");
        if (!ctx.disabled) checked = e.checked as Checked;
      } else if (!ctx.disabled && (e.type === "toggle" || (!hasModifier(e) && keys.includes(e.key as string)))) {
        checked = checked !== true;
      }
      if (checked === state.checked) return { state, effects };
      effects.push({ type: "change", name: "checked", value: checked });
      return { state: { checked }, effects };
    },
    attrs(ctx, state) {
      const control: Attrs = { id: `${ctx.base}-control`, role: name, "aria-checked": checkedAttr(state.checked) };
      if (ctx.disabled) control["aria-disabled"] = "true";
      control.tabindex = ctx.disabled ? "-1" : "0";
      control["data-state"] = state.checked === "mixed" ? "indeterminate" : state.checked ? "checked" : "unchecked";
      return { control };
    },
  };
}

export const checkbox = makeToggle("checkbox");
export const switchComponent = makeToggle("switch");
