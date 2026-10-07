// Property tests (pseudo-fuzz with fixed seeds): purity, cross-reference integrity of ARIA
// attributes, and per-component invariants that must hold after any sequence of events.
import assert from "node:assert/strict";
import { test } from "node:test";
import { call, COMPONENTS, LombokUIError, pagination, position, render, type Event } from "../src/index.js";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === "object") {
    Object.freeze(v);
    for (const x of Object.values(v as object)) deepFreeze(x);
  }
  return v;
}

const KEYS = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "Escape", "Tab", "PageUp", "PageDown", "a", "b", "c", "A", "z"];
const LABELS = ["Apple", "apricot", "Banana", "berry", "Cherry", "citrus", "Date"];

function items(r: () => number): { id: string; label: string; disabled?: boolean }[] {
  const n = 1 + Math.floor(r() * 7);
  const out = [];
  for (let i = 0; i < n; i++) {
    const it: { id: string; label: string; disabled?: boolean } = { id: `i${i}`, label: pick(r, LABELS) };
    if (r() < 0.3) it.disabled = true;
    out.push(it);
  }
  if (out.every((x) => x.disabled)) delete out[0].disabled;
  return out;
}

function randomEvent(r: () => number, its: { id: string }[], t: () => number, n: () => number): Event {
  const id = its.length > 0 ? pick(r, its).id : "i0";
  const k = pick(r, KEYS);
  const choices: Event[] = [
    { type: "keydown", key: k, at: t() },
    { type: "keydown", key: k, at: t(), ...(r() < 0.3 ? { ctrl: true } : {}), ...(r() < 0.2 ? { alt: true } : {}) },
    { type: "toggle", id },
    { type: "toggle" },
    { type: "select", id },
    { type: "focus", id },
    { type: "focus" },
    { type: "blur" },
    { type: "highlight", id },
    { type: "open" },
    { type: "close" },
    { type: "escape" },
    { type: "outsideClick" },
    { type: "triggerClick" },
    { type: "triggerKeydown", key: k },
    { type: "itemClick", id },
    { type: "input", value: pick(r, ["", "a", "an", "B", "rr", "zz"]) },
    { type: "set", value: Math.round((r() * 300 - 50) * 100) / 100 },
    { type: "set", checked: pick(r, [true, false, "mixed"]) },
    { type: "pointerEnter", at: t() },
    { type: "pointerLeave", at: t() },
    { type: "tick", at: t() },
    { type: "add", id: `t${n()}`, kind: pick(r, ["info", "danger"]), duration: pick(r, [null, 100, 2000]), at: t() },
    { type: "dismiss", id: `t${Math.floor(r() * 5)}`, at: t() },
    { type: "pause", at: t() },
    { type: "resume", at: t() },
    { type: "clear" },
  ];
  return pick(r, choices);
}

const OPTIONS: Record<string, (r: () => number, its: unknown[]) => Record<string, unknown>> = {
  disclosure: (r) => ({ defaultOpen: r() < 0.5, disabled: r() < 0.2 }),
  accordion: (r, its) => ({ items: its, multiple: r() < 0.5, collapsible: r() < 0.6, orientation: pick(r, ["vertical", "horizontal"]), dir: pick(r, ["ltr", "rtl"]) }),
  tabs: (r, its) => ({ items: its, activation: pick(r, ["automatic", "manual"]), dir: pick(r, ["ltr", "rtl"]), loop: r() < 0.5 }),
  listbox: (r, its) => (r() < 0.5 ? { items: its, multiple: true } : { items: its, selectionFollowsFocus: r() < 0.5 }),
  menu: (r, its) => ({ items: its, loop: r() < 0.5 }),
  combobox: (r, its) => ({ items: its, filter: pick(r, ["contains", "startsWith", "none"]) }),
  dialog: (r) => ({ role: pick(r, ["dialog", "alertdialog"]), modal: r() < 0.5 }),
  checkbox: (r) => ({ defaultChecked: pick(r, [true, false, "mixed"]) }),
  switch: (r) => ({ defaultChecked: r() < 0.5 }),
  radiogroup: (r, its) => ({ items: its, dir: pick(r, ["ltr", "rtl"]) }),
  slider: (r) => pick(r, [{ min: 0, max: 1, step: 0.1 }, { min: -3, max: 7, step: 0.25, dir: "rtl" }, { min: 0, max: 10, step: 3 }, { min: 0.05, max: 0.95, step: 0.05 }]),
  tooltip: (r) => ({ openDelay: pick(r, [0, 200]), closeDelay: pick(r, [0, 100]) }),
  toast: (r) => ({ max: pick(r, [1, 2]), defaultDuration: pick(r, [null, 300]) }),
};

/** Every id is unique and every id reference points at an id of the same component. */
function checkReferences(name: string, attrs: Record<string, Record<string, string | true>>): void {
  const ids = new Set<string>();
  for (const a of Object.values(attrs)) {
    if (typeof a.id === "string") {
      assert.ok(!ids.has(a.id), `${name}: duplicate id ${a.id}`);
      ids.add(a.id);
    }
  }
  for (const [part, a] of Object.entries(attrs)) {
    for (const ref of ["aria-controls", "aria-labelledby", "aria-describedby", "aria-activedescendant", "for"]) {
      const v = a[ref];
      if (typeof v === "string") for (const id of v.split(" ")) assert.ok(ids.has(id), `${name}.${part}.${ref} -> ${id} is not an id of the component`);
    }
  }
}

function checkState(name: string, opts: Record<string, unknown>, s: Record<string, unknown>): void {
  const its = (opts.items ?? []) as { id: string; disabled?: boolean }[];
  const enabled = new Set(its.filter((x) => !x.disabled).map((x) => x.id));
  switch (name) {
    case "tabs":
      assert.ok(enabled.has(s.selected as string), "tabs: selected tab is enabled");
      break;
    case "accordion":
      if (!opts.multiple) assert.ok((s.expanded as string[]).length <= 1, "accordion: single mode");
      break;
    case "listbox":
      if (!opts.multiple) assert.ok((s.selected as string[]).length <= 1, "listbox: single selection");
      break;
    case "menu":
      if (!s.open) assert.equal(s.focused, null, "menu: closed menu has no focus");
      if (s.focused !== null) assert.ok(enabled.has(s.focused as string), "menu: focused item enabled");
      break;
    case "combobox":
      if (s.active !== null) {
        assert.ok(s.open, "combobox: active only when open");
        assert.ok((s.visible as string[]).includes(s.active as string) && enabled.has(s.active as string), "combobox: active is visible and enabled");
      }
      break;
    case "slider": {
      const v = s.value as number;
      const step = opts.step as number;
      const k = Math.round((v - (opts.min as number)) / step);
      assert.ok(v >= (opts.min as number) - 1e-12 && v <= (opts.max as number) + 1e-12, "slider: value in range");
      assert.ok(Math.abs((opts.min as number) + k * step - v) < 1e-9, "slider: value on the grid");
      assert.equal(String(v).length <= 18, true, "slider: no binary noise like 0.30000000000000004");
      break;
    }
    case "tooltip":
      assert.equal(s.pending === null, s.dueAt === null, "tooltip: pending and dueAt agree");
      break;
    case "toast": {
      const list = s.items as { deadline: number | null }[];
      list.forEach((t, i) => {
        if (i >= (opts.max as number)) assert.equal(t.deadline, null, "toast: queued toasts have no deadline");
      });
      break;
    }
  }
}

test("machines: pure transitions, valid references and invariants under random scripts", () => {
  let scripts = 0;
  for (const c of COMPONENTS) {
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed * 7919 + c.name.length);
      const its = items(r);
      const opts = OPTIONS[c.name](r, its);
      const { ctx, state } = c.setup(opts);
      let cur = deepFreeze(state);
      let clock = 0;
      let counter = 0;
      const t = () => (clock += Math.floor(r() * 700));
      const n = () => counter++;
      for (let i = 0; i < 40; i++) {
        const e = randomEvent(r, its, t, n);
        try {
          const out = c.send(ctx, cur, e);
          assert.deepEqual(JSON.parse(JSON.stringify(out.state)), out.state, "state is JSON data");
          cur = deepFreeze(out.state);
        } catch (err) {
          if (!(err instanceof LombokUIError)) throw err;
          assert.equal(err.code, "invalid_event");
        }
        checkState(c.name, opts, cur as Record<string, unknown>);
        checkReferences(c.name, c.attrs(ctx, cur) as Record<string, Record<string, string | true>>);
      }
      scripts++;
    }
  }
  assert.equal(scripts, COMPONENTS.length * 60);
});

test("slider: decimal steps never accumulate binary error", () => {
  const out = call("run", ["slider", { min: 0, max: 1, step: 0.1 }, Array.from({ length: 10 }, () => ({ type: "keydown", key: "ArrowRight" }))]) as {
    steps: { state: { value: number } }[];
  };
  assert.deepEqual(out.steps.map((s) => s.state.value), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
});

test("pagination: invariants for every small configuration", () => {
  for (let total = 1; total <= 60; total++) {
    for (let siblings = 0; siblings <= 3; siblings++) {
      for (let boundaries = 0; boundaries <= 3; boundaries++) {
        let len = -1;
        for (let page = 1; page <= total; page++) {
          const { items } = pagination({ page, total, siblings, boundaries });
          const nums = items.filter((x): x is number => x !== "ellipsis");
          assert.ok(nums.includes(page), "contains the current page");
          if (boundaries > 0) assert.ok(nums.includes(1) && nums.includes(total), "contains first and last page");
          for (let i = 1; i < items.length; i++) {
            const a = items[i - 1];
            const b = items[i];
            assert.ok(!(a === "ellipsis" && b === "ellipsis"), "no adjacent ellipses");
            if (typeof a === "number" && typeof b === "number") assert.equal(b, a + 1, "consecutive pages");
          }
          for (let i = 1; i + 1 < items.length; i++) {
            if (items[i] === "ellipsis") assert.ok((items[i + 1] as number) - (items[i - 1] as number) >= 3, "an ellipsis hides at least two pages");
          }
          assert.ok(nums.every((x) => x >= 1 && x <= total));
          if (total >= 2 * boundaries + 2 * siblings + 3 && boundaries > 0) {
            if (len < 0) len = items.length;
            assert.equal(items.length, len, "constant length while paging");
          }
        }
      }
    }
  }
});

test("position: shift keeps the element in the boundary and the arrow on the element", () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const r = rng(seed);
    const boundary = { x: 0, y: 0, width: 500, height: 400 };
    const padding = pick(r, [0, 6]);
    const fl = { width: 1 + Math.floor(r() * 300), height: 1 + Math.floor(r() * 200) };
    const ref = { x: Math.floor(r() * 520) - 10, y: Math.floor(r() * 420) - 10, width: Math.floor(r() * 80), height: Math.floor(r() * 40) };
    const arrow = pick(r, [null, 8, 12]);
    const arrowPadding = pick(r, [0, 4]);
    const p = position({ reference: ref, floating: fl, placement: pick(r, ["top", "bottom-start", "left-end", "right", "top-end"]), boundary, padding, arrow, arrowPadding, offset: pick(r, [0, 6]) });
    const vertical = p.side === "top" || p.side === "bottom";
    if (vertical && fl.width <= boundary.width - 2 * padding) assert.ok(p.x >= padding && p.x + fl.width <= boundary.width - padding, `x in boundary (seed ${seed})`);
    if (!vertical && fl.height <= boundary.height - 2 * padding) assert.ok(p.y >= padding && p.y + fl.height <= boundary.height - padding, `y in boundary (seed ${seed})`);
    if (p.arrow !== null && arrow !== null) {
      const size = vertical ? fl.width : fl.height;
      if (size - 2 * arrowPadding >= arrow) assert.ok(p.arrow.offset >= arrowPadding && p.arrow.offset + arrow <= size - arrowPadding, `arrow on element (seed ${seed})`);
    }
  }
});

test("render: text props never break out of their context", () => {
  const evil = ['<script>alert(1)</script>', '"><img src=x onerror=1>', "'><svg onload=1>", "&lt;already&gt;", "a\u0000b"];
  for (const s of evil) {
    const outs = [
      render("button", { label: s, name: s, value: s }),
      render("badge", { label: s }),
      render("alert", { title: s, body: s }),
      render("field", { id: "f", label: s, value: s, placeholder: s, help: s, error: s }),
      render("breadcrumb", { items: [{ label: s, href: `/x?q=${s}` }, { label: s }] }),
      render("tabs", { items: [{ id: "a", label: s, content: s }] }),
      render("dialog", { title: s, description: s, body: s, actions: [{ label: s, value: s }] }),
      render("menu", { label: s, items: [{ id: "a", label: s }] }),
      render("pagination", { total: 3, labels: { next_page: s, previous_page: s, pagination: s } }),
    ];
    for (const html of outs) {
      assert.ok(!html.includes("<script") && !html.includes("<img") && !html.includes("<svg"), html);
      assert.ok(!/=\s*"[^"]*"[^ >/]/.test(html.replace(/="[^"]*"/g, '=""')), "attribute values stay quoted");
    }
  }
});

test("render: only http, https, mailto, tel and relative URLs are accepted", () => {
  const bad = ["javascript:alert(1)", "JaVaScRiPt:1", " \tjavascript:1", "java\nscript:1", "vbscript:1", "data:text/html,1", "file:///etc/passwd"];
  for (const href of bad) assert.throws(() => render("breadcrumb", { items: [{ label: "x", href }] }), (e: unknown) => e instanceof LombokUIError && e.code === "invalid_props", href);
  const good = ["/a", "a/b", "?q=1", "#top", "https://example.com", "http://example.com", "mailto:a@example.com", "tel:+620000", "//example.com/x", "./a:b"];
  for (const href of good) assert.ok(render("breadcrumb", { items: [{ label: "x", href }] }).includes("href="), href);
});
