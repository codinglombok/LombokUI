// Generates vectors/lombokui-vectors-v1.json.
//
// Group "golden": the expected value of every case is written by hand in this file from the SPEC,
// and the generator aborts when the TypeScript port disagrees. Group "generated-regression":
// seeded random scripts whose expected values come from the TypeScript port and are confirmed by
// the Python port (python/tests/test_vectors.py).
//
// Usage: (cd typescript && npm run build) && node scripts/gen-vectors.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { call, LombokUIError } from "../typescript/dist/src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "vectors", "lombokui-vectors-v1.json");

function exec(fn, args) {
  try {
    return { result: call(fn, args) };
  } catch (e) {
    if (e instanceof LombokUIError) return { error: e.code };
    throw e;
  }
}

function canon(v) {
  return JSON.stringify(v);
}

const golden = [];
const regression = [];
let failures = 0;

function gold(name, fn, args, expect) {
  const got = exec(fn, args);
  if (canon(got) !== canon(expect)) {
    failures++;
    console.error(`golden mismatch: ${name}\n  expect ${canon(expect)}\n  got    ${canon(got)}`);
  }
  golden.push({ name, fn, args, expect });
}

function regress(name, fn, args) {
  regression.push({ name, fn, args, expect: exec(fn, args) });
}

// ---------------------------------------------------------------- helpers for hand-written expectations
const ok = (result) => ({ result });
const err = (code) => ({ error: code });
const step = (state, effects = []) => ({ state, effects });
const change = (name, value) => ({ type: "change", name, value });
const focus = (target) => ({ type: "focus", target });
const E = (type, extra = {}) => ({ type, ...extra });
const key = (k, extra = {}) => ({ type: "keydown", key: k, ...extra });
const runOk = (initial, steps) => ok({ initial, steps });

const ABC = [{ id: "a", label: "Alpha" }, { id: "b", label: "Bravo", disabled: true }, { id: "c", label: "Charlie" }];
const FRUIT = [
  { id: "apple", label: "Apple" },
  { id: "apricot", label: "Apricot" },
  { id: "banana", label: "Banana" },
  { id: "blueberry", label: "Blueberry", disabled: true },
  { id: "cherry", label: "Cherry" },
];

// ================================================================ errors and validation (SPEC 2, 12)
gold("run: unknown component", "run", ["carousel", {}, []], err("invalid_component"));
gold("run: component name must be a string", "run", [42, {}, []], err("invalid_component"));
gold("run: events must be an array", "run", ["disclosure", {}, {}], err("invalid_event"));
gold("run: options must be an object", "run", ["disclosure", [], []], err("invalid_option"));
gold("run: unknown option key", "run", ["disclosure", { open: true }, []], err("invalid_option"));
gold("run: idBase must be an id", "run", ["disclosure", { idBase: "9x" }, []], err("invalid_option"));
gold("run: idBase rejects spaces", "run", ["disclosure", { idBase: "a b" }, []], err("invalid_option"));
gold("run: items must not be empty", "run", ["tabs", { items: [] }, []], err("invalid_option"));
gold("run: item ids must be unique", "run", ["tabs", { items: [{ id: "a" }, { id: "a" }] }, []], err("invalid_option"));
gold("run: item unknown key", "run", ["tabs", { items: [{ id: "a", value: 1 }] }, []], err("invalid_option"));
gold("run: item disabled must be boolean", "run", ["tabs", { items: [{ id: "a", disabled: 1 }] }, []], err("invalid_option"));
gold("run: tabs needs an enabled item", "run", ["tabs", { items: [{ id: "a", disabled: true }] }, []], err("invalid_option"));
gold("run: tabs defaultSelected must be enabled", "run", ["tabs", { items: ABC, defaultSelected: "b" }, []], err("invalid_option"));
gold("run: accordion single mode allows one default", "run", ["accordion", { items: ABC, defaultExpanded: ["a", "c"] }, []], err("invalid_option"));
gold("run: accordion defaultExpanded unknown id", "run", ["accordion", { items: ABC, defaultExpanded: ["z"] }, []], err("invalid_option"));
gold("run: enum option", "run", ["tabs", { items: ABC, activation: "auto" }, []], err("invalid_option"));
gold("run: listbox selectionFollowsFocus needs single", "run", ["listbox", { items: ABC, multiple: true, selectionFollowsFocus: true }, []], err("invalid_option"));
gold("run: slider min must be below max", "run", ["slider", { min: 5, max: 5 }, []], err("invalid_option"));
gold("run: slider step must be positive", "run", ["slider", { step: 0 }, []], err("invalid_option"));
gold("run: slider at most 10 decimals", "run", ["slider", { min: 0, max: 1, step: 1e-11 }, []], err("invalid_option"));
gold("run: toast max range", "run", ["toast", { max: 0 }, []], err("invalid_option"));
gold("run: tooltip delay range", "run", ["tooltip", { openDelay: -1 }, []], err("invalid_option"));
gold("run: a failing event yields $error and the script continues", "run", ["disclosure", {}, [E("toggle"), E("explode"), E("toggle", { id: "x" }), E("toggle")]],
  runOk({ open: false }, [step({ open: true }, [change("open", true)]), { $error: "invalid_event" }, { $error: "invalid_event" }, step({ open: false }, [change("open", false)])]));
gold("run: unknown item id in an event", "run", ["tabs", { items: ABC }, [E("select", { id: "zz" })]], runOk({ selected: "a", focused: null }, [{ $error: "invalid_event" }]));
gold("run: key field type", "run", ["tabs", { items: ABC }, [key(5)]], runOk({ selected: "a", focused: null }, [{ $error: "invalid_event" }]));
gold("run: at must be a non-negative integer", "run", ["tooltip", {}, [E("pointerEnter", { at: -1 }), E("pointerEnter", { at: 1.5 })]],
  runOk({ open: false, pending: null, dueAt: null }, [{ $error: "invalid_event" }, { $error: "invalid_event" }]));
gold("attrs: a failing event fails the call", "attrs", ["disclosure", {}, [E("nope")]], err("invalid_event"));

// ================================================================ disclosure (SPEC 5.1)
gold("disclosure: toggle, open, close", "run", ["disclosure", {}, [E("toggle"), E("open"), E("close"), E("close")]],
  runOk({ open: false }, [step({ open: true }, [change("open", true)]), step({ open: true }), step({ open: false }, [change("open", false)]), step({ open: false })]));
gold("disclosure: disabled ignores events", "run", ["disclosure", { disabled: true, defaultOpen: true }, [E("toggle"), E("close")]],
  runOk({ open: true }, [step({ open: true }), step({ open: true })]));
gold("disclosure: attrs closed", "attrs", ["disclosure", { idBase: "faq" }],
  ok({ trigger: { id: "faq-trigger", "aria-expanded": "false", "aria-controls": "faq-panel", "data-state": "closed" }, panel: { id: "faq-panel", "data-state": "closed", hidden: true } }));
gold("disclosure: attrs open and disabled", "attrs", ["disclosure", { defaultOpen: true, disabled: true }],
  ok({ trigger: { id: "lui-trigger", "aria-expanded": "true", "aria-controls": "lui-panel", "aria-disabled": "true", "data-state": "open" }, panel: { id: "lui-panel", "data-state": "open" } }));

// ================================================================ accordion (SPEC 5.2)
const acc = (expanded, focused = null) => ({ expanded, focused });
gold("accordion: single mode replaces the expanded item", "run", ["accordion", { items: ABC }, [E("toggle", { id: "a" }), E("toggle", { id: "c" }), E("toggle", { id: "c" })]],
  runOk(acc([]), [step(acc(["a"]), [change("expanded", ["a"])]), step(acc(["c"]), [change("expanded", ["c"])]), step(acc([]), [change("expanded", [])])]));
gold("accordion: multiple keeps item order", "run", ["accordion", { items: ABC, multiple: true }, [E("toggle", { id: "c" }), E("toggle", { id: "a" })]],
  runOk(acc([]), [step(acc(["c"]), [change("expanded", ["c"])]), step(acc(["a", "c"]), [change("expanded", ["a", "c"])])]));
gold("accordion: not collapsible keeps the last item open", "run", ["accordion", { items: ABC, collapsible: false, defaultExpanded: ["a"] }, [E("toggle", { id: "a" }), E("toggle", { id: "c" })]],
  runOk(acc(["a"]), [step(acc(["a"])), step(acc(["c"]), [change("expanded", ["c"])])]));
gold("accordion: disabled item does not toggle", "run", ["accordion", { items: ABC }, [E("toggle", { id: "b" })]], runOk(acc([]), [step(acc([]))]));
gold("accordion: arrows skip disabled and wrap", "run", ["accordion", { items: ABC }, [E("focus", { id: "a" }), key("ArrowDown"), key("ArrowDown"), key("ArrowUp"), key("Home"), key("End")]],
  runOk(acc([]), [step(acc([], "a")), step(acc([], "c"), [focus("header:c")]), step(acc([], "a"), [focus("header:a")]), step(acc([], "c"), [focus("header:c")]), step(acc([], "a"), [focus("header:a")]), step(acc([], "c"), [focus("header:c")])]));
gold("accordion: loop false stops at the ends", "run", ["accordion", { items: ABC, loop: false }, [E("focus", { id: "c" }), key("ArrowDown")]], runOk(acc([]), [step(acc([], "c")), step(acc([], "c"))]));
gold("accordion: Enter and Space toggle the focused header", "run", ["accordion", { items: ABC }, [E("focus", { id: "c" }), key("Enter"), key(" "), E("blur"), key("Enter")]],
  runOk(acc([]), [step(acc([], "c")), step(acc(["c"], "c"), [change("expanded", ["c"])]), step(acc([], "c"), [change("expanded", [])]), step(acc([])), step(acc([]))]));
gold("accordion: modifier keys are ignored", "run", ["accordion", { items: ABC }, [E("focus", { id: "a" }), key("ArrowDown", { ctrl: true })]], runOk(acc([]), [step(acc([], "a")), step(acc([], "a"))]));
gold("accordion: horizontal rtl maps ArrowLeft to next", "run", ["accordion", { items: ABC, orientation: "horizontal", dir: "rtl" }, [E("focus", { id: "a" }), key("ArrowLeft"), key("ArrowDown")]],
  runOk(acc([]), [step(acc([], "a")), step(acc([], "c"), [focus("header:c")]), step(acc([], "c"))]));
gold("accordion: attrs", "attrs", ["accordion", { idBase: "q", items: [{ id: "a" }, { id: "b", disabled: true }], collapsible: false, defaultExpanded: ["a"] }],
  ok({
    root: { "data-orientation": "vertical" },
    "header:a": { id: "q-header-a", "aria-expanded": "true", "aria-controls": "q-panel-a", "aria-disabled": "true", "data-state": "open" },
    "panel:a": { id: "q-panel-a", role: "region", "aria-labelledby": "q-header-a", "data-state": "open" },
    "header:b": { id: "q-header-b", "aria-expanded": "false", "aria-controls": "q-panel-b", "aria-disabled": "true", "data-state": "closed" },
    "panel:b": { id: "q-panel-b", role: "region", "aria-labelledby": "q-header-b", "data-state": "closed", hidden: true },
  }));

// ================================================================ tabs (SPEC 5.3)
const tb = (selected, focused = null) => ({ selected, focused });
gold("tabs: automatic activation follows focus and skips disabled", "run", ["tabs", { items: ABC }, [E("focus", { id: "a" }), key("ArrowRight"), key("ArrowRight"), key("End")]],
  runOk(tb("a"), [step(tb("a", "a")), step(tb("c", "c"), [change("selected", "c"), focus("tab:c")]), step(tb("a", "a"), [change("selected", "a"), focus("tab:a")]), step(tb("c", "c"), [change("selected", "c"), focus("tab:c")])]));
gold("tabs: manual activation selects on Enter or Space", "run", ["tabs", { items: ABC, activation: "manual" }, [E("focus", { id: "a" }), key("ArrowLeft"), key("Enter"), key("Home"), key(" ")]],
  runOk(tb("a"), [step(tb("a", "a")), step(tb("a", "c"), [focus("tab:c")]), step(tb("c", "c"), [change("selected", "c")]), step(tb("c", "a"), [focus("tab:a")]), step(tb("a", "a"), [change("selected", "a")])]));
gold("tabs: vertical uses ArrowDown and ignores ArrowRight", "run", ["tabs", { items: ABC, orientation: "vertical" }, [E("focus", { id: "a" }), key("ArrowRight"), key("ArrowDown")]],
  runOk(tb("a"), [step(tb("a", "a")), step(tb("a", "a")), step(tb("c", "c"), [change("selected", "c"), focus("tab:c")])]));
gold("tabs: rtl reverses horizontal arrows", "run", ["tabs", { items: ABC, dir: "rtl" }, [E("focus", { id: "c" }), key("ArrowLeft")]],
  runOk(tb("a"), [step(tb("a", "c")), step(tb("a", "a"), [focus("tab:a")])]));
gold("tabs: select a disabled tab is ignored", "run", ["tabs", { items: ABC }, [E("select", { id: "b" }), E("select", { id: "c" })]],
  runOk(tb("a"), [step(tb("a")), step(tb("c", "c"), [change("selected", "c")])]));
gold("tabs: keys without focus are ignored", "run", ["tabs", { items: ABC }, [key("ArrowRight")]], runOk(tb("a"), [step(tb("a"))]));
gold("tabs: attrs use roving tabindex", "attrs", ["tabs", { idBase: "t", items: [{ id: "x" }, { id: "y" }], activation: "manual" }, [E("focus", { id: "y" })]],
  ok({
    tablist: { role: "tablist", "aria-orientation": "horizontal" },
    "tab:x": { id: "t-tab-x", role: "tab", "aria-selected": "true", "aria-controls": "t-panel-x", tabindex: "-1", "data-state": "active" },
    "panel:x": { id: "t-panel-x", role: "tabpanel", "aria-labelledby": "t-tab-x", tabindex: "0", "data-state": "active" },
    "tab:y": { id: "t-tab-y", role: "tab", "aria-selected": "false", "aria-controls": "t-panel-y", tabindex: "0", "data-state": "inactive" },
    "panel:y": { id: "t-panel-y", role: "tabpanel", "aria-labelledby": "t-tab-y", tabindex: "0", "data-state": "inactive", hidden: true },
  }));

// ================================================================ listbox (SPEC 5.4) and typeahead (SPEC 3.3)
const lb = (focused, selected = [], query = "", queryAt = null) => ({ focused, selected, query, queryAt });
gold("listbox: typeahead single, multi-character, timeout and repeated character", "run", ["listbox", { items: FRUIT }, [E("focus"), key("b", { at: 0 }), key("a", { at: 100 }), key("a", { at: 1000 }), key("a", { at: 1100 }), key("c", { at: 5000 })]],
  runOk(lb(null), [step(lb("apple")), step(lb("banana", [], "b", 0)), step(lb("banana", [], "ba", 100)), step(lb("apple", [], "a", 1000)), step(lb("apricot", [], "aa", 1100)), step(lb("cherry", [], "c", 5000))]));
gold("listbox: typeahead is ASCII case-insensitive and skips disabled", "run", ["listbox", { items: FRUIT }, [E("focus"), key("B", { at: 0 }), key("l", { at: 10 })]],
  runOk(lb(null), [step(lb("apple")), step(lb("banana", [], "B", 0)), step(lb("banana", [], "Bl", 10))]));
gold("listbox: typeahead resets exactly at the timeout", "run", ["listbox", { items: FRUIT, typeaheadTimeout: 500 }, [E("focus"), key("b", { at: 1000 }), key("a", { at: 1499 }), key("c", { at: 1999 })]],
  runOk(lb(null), [step(lb("apple")), step(lb("banana", [], "b", 1000)), step(lb("banana", [], "ba", 1499)), step(lb("cherry", [], "c", 1999))]));
gold("listbox: character key without at is invalid", "run", ["listbox", { items: FRUIT }, [E("focus"), key("b")]], runOk(lb(null), [step(lb("apple")), { $error: "invalid_event" }]));
gold("listbox: focus starts at the first selected option", "run", ["listbox", { items: FRUIT, defaultSelected: ["banana"] }, [E("focus"), key("ArrowDown"), key("ArrowDown")]],
  runOk(lb(null, ["banana"]), [step(lb("banana", ["banana"])), step(lb("cherry", ["banana"])), step(lb("cherry", ["banana"]))]));
gold("listbox: single select with Space, blur resets typeahead", "run", ["listbox", { items: FRUIT }, [E("focus"), key("ArrowDown"), key(" "), key("x", { at: 3 }), E("blur")]],
  runOk(lb(null), [step(lb("apple")), step(lb("apricot")), step(lb("apricot", ["apricot"]), [change("selected", ["apricot"])]), step(lb("apricot", ["apricot"], "x", 3)), step(lb(null, ["apricot"]))]));
gold("listbox: selection follows focus", "run", ["listbox", { items: FRUIT, selectionFollowsFocus: true }, [E("focus"), key("End"), key("ArrowUp")]],
  runOk(lb(null), [step(lb("apple")), step(lb("cherry", ["cherry"]), [change("selected", ["cherry"])]), step(lb("banana", ["banana"]), [change("selected", ["banana"])])]));
gold("listbox: multiple toggles and Ctrl+A selects all enabled, then none", "run", ["listbox", { items: FRUIT, multiple: true }, [E("select", { id: "cherry" }), E("select", { id: "apple" }), key("a", { ctrl: true }), key("a", { ctrl: true }), E("select", { id: "blueberry" })]],
  runOk(lb(null), [
    step(lb("cherry", ["cherry"]), [change("selected", ["cherry"])]),
    step(lb("apple", ["apple", "cherry"]), [change("selected", ["apple", "cherry"])]),
    step(lb("apple", ["apple", "apricot", "banana", "cherry"]), [change("selected", ["apple", "apricot", "banana", "cherry"])]),
    step(lb("apple", []), [change("selected", [])]),
    step(lb("apple", [])),
  ]));
gold("listbox: highlight moves focus without selecting", "run", ["listbox", { items: FRUIT }, [E("highlight", { id: "cherry" }), E("highlight", { id: "blueberry" })]],
  runOk(lb(null), [step(lb("cherry")), step(lb("cherry"))]));
gold("listbox: attrs", "attrs", ["listbox", { idBase: "fr", items: [{ id: "a" }, { id: "b", disabled: true }], multiple: true, defaultSelected: ["a"] }, [E("focus")]],
  ok({
    listbox: { id: "fr-listbox", role: "listbox", "aria-multiselectable": "true", "aria-orientation": "vertical", "aria-activedescendant": "fr-option-a", tabindex: "0" },
    "option:a": { id: "fr-option-a", role: "option", "aria-selected": "true", "data-highlighted": true },
    "option:b": { id: "fr-option-b", role: "option", "aria-selected": "false", "aria-disabled": "true" },
  }));

// ================================================================ menu (SPEC 5.5)
const mn = (open, focused = null, query = "", queryAt = null) => ({ open, focused, query, queryAt });
const sel = (id) => ({ type: "select", id });
gold("menu: click opens on the first item, Escape restores focus", "run", ["menu", { items: ABC }, [E("triggerClick"), key("ArrowDown"), key("Escape")]],
  runOk(mn(false), [step(mn(true, "a"), [change("open", true), focus("menu")]), step(mn(true, "c")), step(mn(false), [change("open", false), focus("trigger")])]));
gold("menu: ArrowUp on the trigger opens on the last item", "run", ["menu", { items: ABC }, [E("triggerKeydown", { key: "ArrowUp" }), key("Home")]],
  runOk(mn(false), [step(mn(true, "c"), [change("open", true), focus("menu")]), step(mn(true, "a"))]));
gold("menu: Enter activates and closes", "run", ["menu", { items: ABC }, [E("triggerKeydown", { key: "Enter" }), key("End"), key("Enter")]],
  runOk(mn(false), [step(mn(true, "a"), [change("open", true), focus("menu")]), step(mn(true, "c")), step(mn(false), [sel("c"), change("open", false), focus("trigger")])]));
gold("menu: Tab and outside click close without restoring focus", "run", ["menu", { items: ABC }, [E("triggerClick"), key("Tab"), E("triggerClick"), E("outsideClick"), E("outsideClick")]],
  runOk(mn(false), [step(mn(true, "a"), [change("open", true), focus("menu")]), step(mn(false), [change("open", false)]), step(mn(true, "a"), [change("open", true), focus("menu")]), step(mn(false), [change("open", false)]), step(mn(false))]));
gold("menu: item click, disabled item and closed menu", "run", ["menu", { items: ABC }, [E("itemClick", { id: "a" }), E("triggerClick"), E("itemClick", { id: "b" }), E("highlight", { id: "c" }), E("itemClick", { id: "c" })]],
  runOk(mn(false), [step(mn(false)), step(mn(true, "a"), [change("open", true), focus("menu")]), step(mn(true, "a")), step(mn(true, "c")), step(mn(false), [sel("c"), change("open", false), focus("trigger")])]));
gold("menu: typeahead", "run", ["menu", { items: FRUIT }, [E("triggerClick"), key("c", { at: 0 }), key("z", { at: 10 }), E("triggerClick")]],
  runOk(mn(false), [step(mn(true, "apple"), [change("open", true), focus("menu")]), step(mn(true, "cherry", "c", 0)), step(mn(true, "cherry", "cz", 10)), step(mn(false), [change("open", false), focus("trigger")])]));
gold("menu: attrs open", "attrs", ["menu", { idBase: "m", items: [{ id: "a" }, { id: "b", disabled: true }] }, [E("triggerClick")]],
  ok({
    trigger: { id: "m-trigger", "aria-haspopup": "menu", "aria-expanded": "true", "aria-controls": "m-menu", "data-state": "open" },
    menu: { id: "m-menu", role: "menu", "aria-labelledby": "m-trigger", "aria-activedescendant": "m-item-a", tabindex: "-1", "data-state": "open" },
    "item:a": { id: "m-item-a", role: "menuitem", tabindex: "-1", "data-highlighted": true },
    "item:b": { id: "m-item-b", role: "menuitem", "aria-disabled": "true", tabindex: "-1" },
  }));

// ================================================================ combobox (SPEC 5.6)
const ALL = FRUIT.map((f) => f.id);
const cb = (inputValue, open, active, selected, visible) => ({ inputValue, open, active, selected, visible });
gold("combobox: typing filters by contains and opens", "run", ["combobox", { items: FRUIT }, [E("input", { value: "ER" }), E("input", { value: "zz" })]],
  runOk(cb("", false, null, null, ALL), [step(cb("ER", true, null, null, ["blueberry", "cherry"]), [change("open", true)]), step(cb("zz", false, null, null, []), [change("open", false)])]));
gold("combobox: startsWith filter", "run", ["combobox", { items: FRUIT, filter: "startsWith" }, [E("input", { value: "ap" })]],
  runOk(cb("", false, null, null, ALL), [step(cb("ap", true, null, null, ["apple", "apricot"]), [change("open", true)])]));
gold("combobox: arrows skip disabled options, Enter commits", "run", ["combobox", { items: FRUIT }, [E("input", { value: "b" }), key("ArrowDown"), key("ArrowDown"), key("Enter")]],
  runOk(cb("", false, null, null, ALL), [
    step(cb("b", true, null, null, ["banana", "blueberry"]), [change("open", true)]),
    step(cb("b", true, "banana", null, ["banana", "blueberry"])),
    step(cb("b", true, "banana", null, ["banana", "blueberry"])),
    step(cb("Banana", false, null, "banana", ["banana"]), [sel("banana"), change("selected", "banana"), change("open", false)]),
  ]));
gold("combobox: ArrowDown opens on the first option, Alt+ArrowDown without one", "run", ["combobox", { items: FRUIT }, [key("ArrowDown"), key("Escape"), key("ArrowDown", { alt: true }), key("ArrowUp")]],
  runOk(cb("", false, null, null, ALL), [
    step(cb("", true, "apple", null, ALL), [change("open", true)]),
    step(cb("", false, null, null, ALL), [change("open", false)]),
    step(cb("", true, null, null, ALL), [change("open", true)]),
    step(cb("", true, "cherry", null, ALL)),
  ]));
gold("combobox: Escape on a closed popup clears the value", "run", ["combobox", { items: FRUIT, defaultSelected: "cherry" }, [key("Escape")]],
  runOk(cb("Cherry", false, null, "cherry", ["cherry"]), [step(cb("", false, null, null, ALL), [change("selected", null)])]));
gold("combobox: click selects only visible enabled options", "run", ["combobox", { items: FRUIT }, [E("input", { value: "a" }), E("select", { id: "blueberry" }), E("select", { id: "cherry" }), E("highlight", { id: "apple" }), E("select", { id: "apricot" })]],
  runOk(cb("", false, null, null, ALL), [
    step(cb("a", true, null, null, ["apple", "apricot", "banana"]), [change("open", true)]),
    step(cb("a", true, null, null, ["apple", "apricot", "banana"])),
    step(cb("a", true, null, null, ["apple", "apricot", "banana"])),
    step(cb("a", true, "apple", null, ["apple", "apricot", "banana"])),
    step(cb("Apricot", false, null, "apricot", ["apricot"]), [sel("apricot"), change("selected", "apricot"), change("open", false)]),
  ]));
gold("combobox: blur closes", "run", ["combobox", { items: FRUIT }, [E("open"), E("blur")]],
  runOk(cb("", false, null, null, ALL), [step(cb("", true, null, null, ALL), [change("open", true)]), step(cb("", false, null, null, ALL), [change("open", false)])]));
gold("combobox: attrs", "attrs", ["combobox", { idBase: "c", items: [{ id: "x", label: "Xa" }, { id: "y", label: "Yb" }] }, [E("input", { value: "x" }), key("ArrowDown")]],
  ok({
    label: { id: "c-label", for: "c-input" },
    input: { id: "c-input", role: "combobox", "aria-expanded": "true", "aria-controls": "c-listbox", "aria-autocomplete": "list", "aria-activedescendant": "c-option-x", autocomplete: "off", "data-state": "open" },
    listbox: { id: "c-listbox", role: "listbox", "aria-labelledby": "c-label", "data-state": "open" },
    "option:x": { id: "c-option-x", role: "option", "aria-selected": "false", "data-highlighted": true },
    "option:y": { id: "c-option-y", role: "option", "aria-selected": "false", hidden: true },
  }));

// ================================================================ dialog (SPEC 5.7)
const MODAL_OPEN = [change("open", true), { type: "lockScroll" }, { type: "trapFocus" }, focus("initial")];
const MODAL_CLOSE = [change("open", false), { type: "releaseFocus" }, { type: "unlockScroll" }, { type: "restoreFocus" }];
gold("dialog: modal open and close effects", "run", ["dialog", {}, [E("open"), E("open"), E("escape")]],
  runOk({ open: false }, [step({ open: true }, MODAL_OPEN), step({ open: true }), step({ open: false }, MODAL_CLOSE)]));
gold("dialog: outside click closes a dialog", "run", ["dialog", {}, [E("open"), E("outsideClick")]], runOk({ open: false }, [step({ open: true }, MODAL_OPEN), step({ open: false }, MODAL_CLOSE)]));
gold("dialog: alertdialog ignores outside click by default", "run", ["dialog", { role: "alertdialog" }, [E("open"), E("outsideClick"), E("close")]],
  runOk({ open: false }, [step({ open: true }, MODAL_OPEN), step({ open: true }), step({ open: false }, MODAL_CLOSE)]));
gold("dialog: closeOnEscape false", "run", ["dialog", { closeOnEscape: false, defaultOpen: true }, [E("escape")]], runOk({ open: true }, [step({ open: true })]));
gold("dialog: non-modal effects", "run", ["dialog", { modal: false }, [E("open"), E("close")]],
  runOk({ open: false }, [step({ open: true }, [change("open", true), focus("initial")]), step({ open: false }, [change("open", false), { type: "restoreFocus" }])]));
gold("dialog: attrs without description", "attrs", ["dialog", { idBase: "d", role: "alertdialog", description: false }],
  ok({
    trigger: { "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "d-dialog", "data-state": "closed" },
    dialog: { id: "d-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "d-title", tabindex: "-1", "data-state": "closed", hidden: true },
    title: { id: "d-title" },
  }));

// ================================================================ checkbox and switch (SPEC 5.8)
gold("checkbox: mixed becomes checked, Space toggles", "run", ["checkbox", { defaultChecked: "mixed" }, [E("toggle"), key(" "), key("Enter"), E("set", { checked: "mixed" })]],
  runOk({ checked: "mixed" }, [step({ checked: true }, [change("checked", true)]), step({ checked: false }, [change("checked", false)]), step({ checked: false }), step({ checked: "mixed" }, [change("checked", "mixed")])]));
gold("switch: Enter toggles, mixed is invalid", "run", ["switch", {}, [key("Enter"), E("set", { checked: "mixed" }), E("set", { checked: true })]],
  runOk({ checked: false }, [step({ checked: true }, [change("checked", true)]), { $error: "invalid_event" }, step({ checked: true })]));
gold("switch: defaultChecked mixed is invalid", "run", ["switch", { defaultChecked: "mixed" }, []], err("invalid_option"));
gold("checkbox: disabled", "run", ["checkbox", { disabled: true }, [E("toggle"), E("set", { checked: true })]], runOk({ checked: false }, [step({ checked: false }), step({ checked: false })]));
gold("checkbox: attrs mixed", "attrs", ["checkbox", { idBase: "agree", defaultChecked: "mixed" }],
  ok({ control: { id: "agree-control", role: "checkbox", "aria-checked": "mixed", tabindex: "0", "data-state": "indeterminate" } }));
gold("switch: attrs disabled", "attrs", ["switch", { disabled: true, defaultChecked: true }],
  ok({ control: { id: "lui-control", role: "switch", "aria-checked": "true", "aria-disabled": "true", tabindex: "-1", "data-state": "checked" } }));

// ================================================================ radiogroup (SPEC 5.9)
const rg = (value, focused = null) => ({ value, focused });
gold("radiogroup: arrows move and check, skipping disabled, wrapping", "run", ["radiogroup", { items: ABC }, [E("focus", { id: "a" }), key("ArrowDown"), key("ArrowRight"), key("ArrowUp")]],
  runOk(rg(null), [step(rg(null, "a")), step(rg("c", "c"), [change("value", "c"), focus("radio:c")]), step(rg("a", "a"), [change("value", "a"), focus("radio:a")]), step(rg("c", "c"), [change("value", "c"), focus("radio:c")])]));
gold("radiogroup: Space checks the focused radio", "run", ["radiogroup", { items: ABC }, [E("focus", { id: "c" }), key(" ")]], runOk(rg(null), [step(rg(null, "c")), step(rg("c", "c"), [change("value", "c")])]));
gold("radiogroup: rtl ArrowLeft is next", "run", ["radiogroup", { items: ABC, dir: "rtl", defaultValue: "a" }, [E("focus", { id: "a" }), key("ArrowLeft")]],
  runOk(rg("a"), [step(rg("a", "a")), step(rg("c", "c"), [change("value", "c"), focus("radio:c")])]));
gold("radiogroup: disabled group", "run", ["radiogroup", { items: ABC, disabled: true }, [E("select", { id: "a" }), E("focus", { id: "a" }), key("ArrowDown")]],
  runOk(rg(null), [step(rg(null)), step(rg(null, "a")), step(rg(null, "a"))]));
gold("radiogroup: defaultValue must be enabled", "run", ["radiogroup", { items: ABC, defaultValue: "b" }, []], err("invalid_option"));
gold("radiogroup: attrs, first enabled is tabbable without a value", "attrs", ["radiogroup", { idBase: "r", items: [{ id: "x", disabled: true }, { id: "y" }] }],
  ok({
    group: { role: "radiogroup" },
    "radio:x": { id: "r-radio-x", role: "radio", "aria-checked": "false", "aria-disabled": "true", tabindex: "-1", "data-state": "unchecked" },
    "radio:y": { id: "r-radio-y", role: "radio", "aria-checked": "false", tabindex: "0", "data-state": "unchecked" },
  }));

// ================================================================ slider (SPEC 5.10)
const sv = (value) => ({ value });
gold("slider: decimal steps are exact", "run", ["slider", { min: 0, max: 1, step: 0.1, defaultValue: 0.33 }, [key("ArrowRight"), key("ArrowUp"), key("PageUp"), key("End"), key("ArrowRight")]],
  runOk(sv(0.3), [step(sv(0.4), [change("value", 0.4)]), step(sv(0.5), [change("value", 0.5)]), step(sv(0.6), [change("value", 0.6)]), step(sv(1), [change("value", 1)]), step(sv(1))]));
gold("slider: largeStep and Home", "run", ["slider", { min: -1, max: 1, step: 0.25, largeStep: 0.5 }, [key("PageUp"), key("PageUp"), key("PageDown"), key("Home"), key("ArrowLeft")]],
  runOk(sv(-1), [step(sv(-0.5), [change("value", -0.5)]), step(sv(0), [change("value", 0)]), step(sv(-0.5), [change("value", -0.5)]), step(sv(-1), [change("value", -1)]), step(sv(-1))]));
gold("slider: off-grid max is not reachable", "run", ["slider", { min: 0, max: 10, step: 3 }, [key("End"), E("set", { value: 100 }), E("set", { value: 4.4 }), E("set", { value: 4.5 })]],
  runOk(sv(0), [step(sv(9), [change("value", 9)]), step(sv(9)), step(sv(3), [change("value", 3)]), step(sv(6), [change("value", 6)])]));
gold("slider: rtl horizontal flips left and right", "run", ["slider", { dir: "rtl", defaultValue: 50 }, [key("ArrowLeft"), key("ArrowRight"), key("ArrowUp")]],
  runOk(sv(50), [step(sv(51), [change("value", 51)]), step(sv(50), [change("value", 50)]), step(sv(51), [change("value", 51)])]));
gold("slider: default largeStep is a tenth of the range", "run", ["slider", { min: 0, max: 200, step: 5 }, [key("PageUp")]], runOk(sv(0), [step(sv(20), [change("value", 20)])]));
gold("slider: disabled ignores input", "run", ["slider", { disabled: true }, [key("End"), E("set", { value: 3 })]], runOk(sv(0), [step(sv(0)), step(sv(0))]));
gold("slider: attrs format numbers without exponent or trailing zeros", "attrs", ["slider", { idBase: "vol", min: 0.5, max: 2, step: 0.05, defaultValue: 1.2, orientation: "vertical" }],
  ok({ thumb: { id: "vol-thumb", role: "slider", "aria-valuemin": "0.5", "aria-valuemax": "2", "aria-valuenow": "1.2", "aria-orientation": "vertical", tabindex: "0", "data-orientation": "vertical" } }));

// ================================================================ tooltip (SPEC 5.11)
const tt = (open, pending = null, dueAt = null) => ({ open, pending, dueAt });
const sched = (at) => ({ type: "schedule", at });
gold("tooltip: open and close delays", "run", ["tooltip", { openDelay: 500, closeDelay: 200 }, [E("pointerEnter", { at: 0 }), E("tick", { at: 499 }), E("tick", { at: 500 }), E("pointerLeave", { at: 600 }), E("tick", { at: 800 })]],
  runOk(tt(false), [step(tt(false, "open", 500), [sched(500)]), step(tt(false, "open", 500)), step(tt(true), [change("open", true)]), step(tt(true, "close", 800), [sched(800)]), step(tt(false), [change("open", false)])]));
gold("tooltip: leaving before the delay cancels, re-entering cancels a close", "run", ["tooltip", {}, [E("pointerEnter", { at: 0 }), E("pointerLeave", { at: 100 }), E("focus"), E("pointerLeave", { at: 200 }), E("pointerEnter", { at: 300 })]],
  runOk(tt(false), [step(tt(false, "open", 700), [sched(700)]), step(tt(false)), step(tt(true), [change("open", true)]), step(tt(true, "close", 500), [sched(500)]), step(tt(true))]));
gold("tooltip: zero delays and Escape", "run", ["tooltip", { openDelay: 0, closeDelay: 0 }, [E("pointerEnter", { at: 5 }), E("escape"), E("pointerEnter", { at: 6 }), E("pointerLeave", { at: 7 })]],
  runOk(tt(false), [step(tt(true), [change("open", true)]), step(tt(false), [change("open", false)]), step(tt(true), [change("open", true)]), step(tt(false), [change("open", false)])]));
gold("tooltip: attrs open", "attrs", ["tooltip", { idBase: "tip" }, [E("focus")]],
  ok({ trigger: { "aria-describedby": "tip-tooltip", "data-state": "open" }, tooltip: { id: "tip-tooltip", role: "tooltip", "data-state": "open" } }));

// ================================================================ toast (SPEC 5.12)
const ts = (items, paused = false) => ({ items, paused });
const T = (id, kind, remaining, deadline) => ({ id, kind, remaining, deadline });
const dis = (id, reason) => ({ type: "dismiss", id, reason });
gold("toast: queue, pause, resume and timeout", "run", ["toast", { max: 1 }, [E("add", { id: "t1", at: 0 }), E("add", { id: "t2", kind: "danger", duration: 1000, at: 10 }), E("pause", { at: 2000 }), E("resume", { at: 3000 }), E("tick", { at: 6000 }), E("tick", { at: 7000 })]],
  runOk(ts([]), [
    step(ts([T("t1", "info", 5000, 5000)]), [sched(5000)]),
    step(ts([T("t1", "info", 5000, 5000), T("t2", "danger", 1000, null)])),
    step(ts([T("t1", "info", 3000, null), T("t2", "danger", 1000, null)], true)),
    step(ts([T("t1", "info", 3000, 6000), T("t2", "danger", 1000, null)]), [sched(6000)]),
    step(ts([T("t2", "danger", 1000, 7000)]), [dis("t1", "timeout"), sched(7000)]),
    step(ts([]), [dis("t2", "timeout")]),
  ]));
gold("toast: persistent toasts, manual dismiss and clear", "run", ["toast", { defaultDuration: null }, [E("add", { id: "a", at: 0 }), E("add", { id: "b", kind: "success", duration: 100, at: 1 }), E("dismiss", { id: "a", at: 2 }), E("dismiss", { id: "zz", at: 3 }), E("clear")]],
  runOk(ts([]), [
    step(ts([T("a", "info", null, null)])),
    step(ts([T("a", "info", null, null), T("b", "success", 100, 101)]), [sched(101)]),
    step(ts([T("b", "success", 100, 101)]), [dis("a", "manual")]),
    step(ts([T("b", "success", 100, 101)])),
    step(ts([]), [dis("b", "manual")]),
  ]));
gold("toast: at is required", "run", ["toast", {}, [E("add", { id: "a" }), E("tick", {})]], runOk(ts([]), [{ $error: "invalid_event" }, { $error: "invalid_event" }]));
gold("toast: duplicate id is invalid", "run", ["toast", {}, [E("add", { id: "a", at: 0 }), E("add", { id: "a", at: 1 })]],
  runOk(ts([]), [step(ts([T("a", "info", 5000, 5000)]), [sched(5000)]), { $error: "invalid_event" }]));
gold("toast: attrs, queued toasts are hidden", "attrs", ["toast", { idBase: "n", max: 1 }, [E("add", { id: "a", kind: "warning", at: 0 }), E("add", { id: "b", at: 0 })]],
  ok({
    region: { id: "n-region", role: "region", tabindex: "-1", "data-paused": "false" },
    "toast:a": { id: "n-toast-a", role: "alert", "aria-live": "assertive", "aria-atomic": "true", "data-kind": "warning" },
    "toast:b": { id: "n-toast-b", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-kind": "info", hidden: true },
  }));

// ================================================================ position (SPEC 6)
const REF = { x: 100, y: 100, width: 40, height: 20 };
const FL = { width: 60, height: 30 };
const pos = (x, y, placement, arrow = null) => {
  const [side, align = "center"] = placement.split("-");
  return ok({ x, y, placement, side, align, arrow });
};
gold("position: bottom centered", "position", [{ reference: REF, floating: FL }], pos(90, 120, "bottom"));
gold("position: top with offset", "position", [{ reference: REF, floating: FL, placement: "top", offset: 8 }], pos(90, 62, "top"));
gold("position: right-start", "position", [{ reference: REF, floating: FL, placement: "right-start" }], pos(140, 100, "right-start"));
gold("position: left-end", "position", [{ reference: REF, floating: FL, placement: "left-end" }], pos(40, 90, "left-end"));
gold("position: bottom-end", "position", [{ reference: REF, floating: FL, placement: "bottom-end" }], pos(80, 120, "bottom-end"));
gold("position: rtl swaps start and end on top and bottom", "position", [{ reference: REF, floating: FL, placement: "bottom-start", dir: "rtl" }], pos(80, 120, "bottom-start"));
gold("position: rtl does not affect left and right", "position", [{ reference: REF, floating: FL, placement: "right-end", dir: "rtl" }], pos(140, 90, "right-end"));
gold("position: flips to the opposite side when it fits better", "position", [{ reference: { x: 100, y: 10, width: 40, height: 20 }, floating: FL, placement: "top", boundary: { x: 0, y: 0, width: 400, height: 400 } }], pos(90, 30, "bottom"));
gold("position: keeps the side when the opposite overflows as much", "position", [{ reference: { x: 100, y: 10, width: 40, height: 20 }, floating: { width: 60, height: 30 }, placement: "top", boundary: { x: 0, y: 0, width: 400, height: 40 } }], pos(90, -20, "top"));
gold("position: flip disabled", "position", [{ reference: { x: 100, y: 10, width: 40, height: 20 }, floating: FL, placement: "top", flip: false, boundary: { x: 0, y: 0, width: 400, height: 400 } }], pos(90, -20, "top"));
gold("position: shift keeps the element inside the boundary with padding", "position", [{ reference: { x: 0, y: 100, width: 20, height: 20 }, floating: FL, boundary: { x: 0, y: 0, width: 400, height: 400 }, padding: 8 }], pos(8, 120, "bottom"));
gold("position: shift on the vertical axis for side placements", "position", [{ reference: { x: 100, y: 390, width: 20, height: 10 }, floating: FL, placement: "right", boundary: { x: 0, y: 0, width: 400, height: 400 } }], pos(120, 370, "right"));
gold("position: wider than the boundary aligns to the start edge", "position", [{ reference: { x: 50, y: 50, width: 10, height: 10 }, floating: { width: 500, height: 10 }, boundary: { x: 0, y: 0, width: 300, height: 300 } }], pos(0, 60, "bottom"));
gold("position: arrow centred on the reference", "position", [{ reference: REF, floating: FL, arrow: 10 }], pos(90, 120, "bottom", { edge: "top", offset: 25 }));
gold("position: arrow clamped by arrowPadding", "position", [{ reference: { x: 0, y: 100, width: 10, height: 10 }, floating: FL, boundary: { x: 0, y: 0, width: 400, height: 400 }, arrow: 10, arrowPadding: 6 }], pos(0, 110, "bottom", { edge: "top", offset: 6 }));
gold("position: arrow on a side placement", "position", [{ reference: REF, floating: FL, placement: "left", arrow: 8 }], pos(40, 95, "left", { edge: "right", offset: 11 }));
gold("position: unknown placement", "position", [{ reference: REF, floating: FL, placement: "middle" }], err("invalid_option"));
gold("position: negative size", "position", [{ reference: REF, floating: { width: -1, height: 1 } }], err("invalid_option"));
gold("position: reference required", "position", [{ floating: FL }], err("invalid_option"));
gold("position: non-finite coordinate", "position", [{ reference: { x: "1", y: 0, width: 1, height: 1 }, floating: FL }], err("invalid_option"));

// ================================================================ pagination (SPEC 7)
const pg = (items, prev, next) => ok({ items, prev, next });
gold("pagination: middle page", "pagination", [{ page: 5, total: 10 }], pg([1, "ellipsis", 4, 5, 6, "ellipsis", 10], 4, 6));
gold("pagination: first page", "pagination", [{ page: 1, total: 10 }], pg([1, 2, 3, 4, 5, "ellipsis", 10], null, 2));
gold("pagination: last page", "pagination", [{ page: 10, total: 10 }], pg([1, "ellipsis", 6, 7, 8, 9, 10], 9, null));
gold("pagination: page 4 fills the gap instead of an ellipsis", "pagination", [{ page: 4, total: 10 }], pg([1, 2, 3, 4, 5, "ellipsis", 10], 3, 5));
gold("pagination: small totals list every page", "pagination", [{ page: 2, total: 3 }], pg([1, 2, 3], 1, 3));
gold("pagination: single page", "pagination", [{ page: 1, total: 1 }], pg([1], null, null));
gold("pagination: two boundaries and two siblings", "pagination", [{ page: 10, total: 20, siblings: 2, boundaries: 2 }], pg([1, 2, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 19, 20], 9, 11));
gold("pagination: no siblings", "pagination", [{ page: 5, total: 9, siblings: 0 }], pg([1, "ellipsis", 5, "ellipsis", 9], 4, 6));
gold("pagination: page defaults to 1", "pagination", [{ total: 2 }], pg([1, 2], null, 2));
gold("pagination: page out of range", "pagination", [{ page: 4, total: 3 }], err("invalid_option"));
gold("pagination: total required", "pagination", [{ page: 1 }], err("invalid_option"));
gold("pagination: siblings out of range", "pagination", [{ total: 5, siblings: 11 }], err("invalid_option"));

// ================================================================ render (SPEC 8)
gold("render: button default", "render", ["button", { label: "Save" }], ok('<button type="button" class="btn btn-primary">Save</button>'));
gold("render: button with options", "render", ["button", { label: "Send", variant: "outline", size: "lg", type: "submit", block: true, name: "op", value: "send", disabled: true, pressed: false, class: "mt-2" }],
  ok('<button type="submit" class="btn btn-outline btn-lg btn-block mt-2" name="op" value="send" aria-pressed="false" disabled>Send</button>'));
gold("render: button with icon at the end", "render", ["button", { label: "Next", icon: "arrow-right", iconPosition: "end" }],
  ok('<button type="button" class="btn btn-primary"><span>Next</span><i data-lf="arrow-right" aria-hidden="true"></i></button>'));
gold("render: icon-only button gets an accessible name", "render", ["button", { label: "Delete", icon: "trash", iconOnly: true, variant: "ghost" }],
  ok('<button type="button" class="btn btn-ghost btn-icon" aria-label="Delete"><i data-lf="trash" aria-hidden="true"></i></button>'));
gold("render: iconOnly requires icon", "render", ["button", { label: "x", iconOnly: true }], err("invalid_props"));
gold("render: icon name pattern", "render", ["button", { label: "x", icon: "Bad Icon" }], err("invalid_props"));
gold("render: text is escaped", "render", ["button", { label: "<b>&\"'</b>" }], ok('<button type="button" class="btn btn-primary">&lt;b&gt;&amp;"\'&lt;/b&gt;</button>'));
gold("render: badge", "render", ["badge", { label: "New", variant: "success", pill: true }], ok('<span class="badge badge-success badge-pill">New</span>'));
gold("render: alert info", "render", ["alert", { title: "Saved", body: "All good." , kind: "success"}], ok('<div class="alert alert-success" role="status"><div><div class="alert-title">Saved</div>All good.</div></div>'));
gold("render: alert danger uses role alert", "render", ["alert", { kind: "danger", body: "Failed." }], ok('<div class="alert alert-danger" role="alert"><div>Failed.</div></div>'));
gold("render: field with help and error", "render", ["field", { id: "email", label: "Email", type: "email", help: "Never shared.", error: "Invalid.", required: true, value: '"x"' }],
  ok('<div class="field"><label class="label" for="email">Email</label><input class="input is-invalid" id="email" type="email" value="&quot;x&quot;" aria-describedby="email-help email-error" aria-invalid="true" required><span class="help" id="email-help">Never shared.</span><span class="error-text" id="email-error">Invalid.</span></div>'));
gold("render: field minimal", "render", ["field", { id: "q", label: "Search", type: "search", name: "q", placeholder: "Type\u2026" }],
  ok('<div class="field"><label class="label" for="q">Search</label><input class="input" id="q" type="search" name="q" placeholder="Type\u2026"></div>'));
gold("render: field id required", "render", ["field", { label: "x" }], err("invalid_props"));
gold("render: checkbox", "render", ["checkbox", { id: "tos", label: "I agree", checked: true, required: true }], ok('<div class="check"><input type="checkbox" id="tos" checked required><label for="tos">I agree</label></div>'));
gold("render: switch", "render", ["switch", { label: "Notify me", name: "notify", checked: true }], ok('<label class="switch"><span>Notify me</span><input type="checkbox" role="switch" name="notify" checked><span class="track"></span></label>'));
gold("render: progress", "render", ["progress", { value: 1, max: 3, label: "Upload" }],
  ok('<div class="progress" role="progressbar" aria-label="Upload" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"><div class="bar" style="inline-size:33.33%"></div></div>'));
gold("render: progress decimals", "render", ["progress", { value: 0.125, max: 1, label: "L" }],
  ok('<div class="progress" role="progressbar" aria-label="L" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0.125"><div class="bar" style="inline-size:12.5%"></div></div>'));
gold("render: progress value above max", "render", ["progress", { value: 5, max: 4, label: "L" }], err("invalid_props"));
gold("render: breadcrumb", "render", ["breadcrumb", { items: [{ label: "Home", href: "/" }, { label: "Docs", href: "https://example.com/docs?a=1&b=2" }, { label: "Page" }] }],
  ok('<nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="https://example.com/docs?a=1&amp;b=2">Docs</a></li><li aria-current="page">Page</li></ol></nav>'));
gold("render: breadcrumb current item with link and Indonesian label", "render", ["breadcrumb", { items: [{ label: "Beranda", href: "/" }, { label: "Profil", href: "/profil" }], locale: "id" }],
  ok('<nav aria-label="Jejak navigasi"><ol class="breadcrumb"><li><a href="/">Beranda</a></li><li><a href="/profil" aria-current="page">Profil</a></li></ol></nav>'));
gold("render: javascript URL is rejected", "render", ["breadcrumb", { items: [{ label: "x", href: " Java\tScript:alert(1)" }] }], err("invalid_props"));
gold("render: data URL is rejected", "render", ["breadcrumb", { items: [{ label: "x", href: "data:text/html,x" }] }], err("invalid_props"));
gold("render: mailto URL is allowed", "render", ["breadcrumb", { items: [{ label: "Mail", href: "mailto:team@example.com" }] }],
  ok('<nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="mailto:team@example.com" aria-current="page">Mail</a></li></ol></nav>'));
gold("render: pagination links", "render", ["pagination", { page: 2, total: 3, href: "/list?page={page}" }],
  ok('<nav aria-label="Pagination"><ul class="pagination"><li><a href="/list?page=1" rel="prev" aria-label="Previous page">\u2039</a></li><li><a href="/list?page=1">1</a></li><li class="is-active"><a href="/list?page=2" aria-current="page">2</a></li><li><a href="/list?page=3">3</a></li><li><a href="/list?page=3" rel="next" aria-label="Next page">\u203a</a></li></ul></nav>'));
gold("render: pagination buttons, ellipsis and custom labels", "render", ["pagination", { page: 1, total: 9, labels: { next_page: "Lanjut" } }],
  ok('<nav aria-label="Pagination"><ul class="pagination"><li><button type="button" disabled aria-label="Previous page">\u2039</button></li><li class="is-active"><button type="button" data-page="1" aria-current="page">1</button></li><li><button type="button" data-page="2">2</button></li><li><button type="button" data-page="3">3</button></li><li><button type="button" data-page="4">4</button></li><li><button type="button" data-page="5">5</button></li><li aria-hidden="true"><span>\u2026</span></li><li><button type="button" data-page="9">9</button></li><li><button type="button" data-page="2" rel="next" aria-label="Lanjut">\u203a</button></li></ul></nav>'));
gold("render: pagination href needs {page}", "render", ["pagination", { total: 3, href: "/list" }], err("invalid_props"));
gold("render: pagination unknown label key", "render", ["pagination", { total: 3, labels: { first: "x" } }], err("invalid_props"));
gold("render: tabs", "render", ["tabs", { idBase: "t", items: [{ id: "a", label: "One", content: "<b>1</b>" }, { id: "b", label: "Two", contentHtml: "<b>2</b>" }], activation: "manual" }],
  ok('<div class="lui-tabs" data-lui="tabs" data-lui-base="t" data-activation="manual" data-orientation="horizontal" data-dir="ltr" data-loop="true"><div class="tabs" role="tablist" aria-orientation="horizontal" data-lui-part="tablist"><button type="button" id="t-tab-a" role="tab" aria-selected="true" aria-controls="t-panel-a" tabindex="0" data-state="active" data-lui-part="tab" data-lui-id="a">One</button><button type="button" id="t-tab-b" role="tab" aria-selected="false" aria-controls="t-panel-b" tabindex="-1" data-state="inactive" data-lui-part="tab" data-lui-id="b">Two</button></div><div class="tab-panel" id="t-panel-a" role="tabpanel" aria-labelledby="t-tab-a" tabindex="0" data-state="active" data-lui-part="panel" data-lui-id="a">&lt;b&gt;1&lt;/b&gt;</div><div class="tab-panel" id="t-panel-b" role="tabpanel" aria-labelledby="t-tab-b" tabindex="0" data-state="inactive" hidden data-lui-part="panel" data-lui-id="b"><b>2</b></div></div>'));
gold("render: tabs content and contentHtml are exclusive", "render", ["tabs", { items: [{ id: "a", content: "x", contentHtml: "y" }] }], err("invalid_props"));
gold("render: tabs option errors become invalid_props", "render", ["tabs", { items: [] }], err("invalid_props"));
gold("render: accordion", "render", ["accordion", { idBase: "f", headingLevel: 2, defaultExpanded: ["a"], items: [{ id: "a", label: "What?", content: "A library." }, { id: "b", label: "Why?", disabled: true }] }],
  ok('<div class="accordion lui-accordion" data-lui="accordion" data-lui-base="f" data-multiple="false" data-collapsible="true" data-orientation="vertical" data-dir="ltr" data-loop="true"><div class="accordion-item"><h2 class="accordion-heading"><button type="button" class="accordion-trigger" id="f-header-a" aria-expanded="true" aria-controls="f-panel-a" data-state="open" data-lui-part="header" data-lui-id="a">What?</button></h2><div class="accordion-body" id="f-panel-a" role="region" aria-labelledby="f-header-a" data-state="open" data-lui-part="panel" data-lui-id="a">A library.</div></div><div class="accordion-item"><h2 class="accordion-heading"><button type="button" class="accordion-trigger" id="f-header-b" aria-expanded="false" aria-controls="f-panel-b" aria-disabled="true" data-state="closed" data-lui-part="header" data-lui-id="b">Why?</button></h2><div class="accordion-body" id="f-panel-b" role="region" aria-labelledby="f-header-b" data-state="closed" hidden data-lui-part="panel" data-lui-id="b"></div></div></div>'));
gold("render: dialog", "render", ["dialog", { idBase: "d", title: "Delete?", description: "This cannot be undone.", trigger: { label: "Delete", variant: "danger" }, actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", variant: "danger", value: "ok" }], locale: "id" }],
  ok('<div class="lui-dialog" data-lui="dialog" data-lui-base="d" data-role="dialog" data-modal="true" data-close-on-escape="true" data-close-on-outside-click="true"><button type="button" class="btn btn-danger" aria-haspopup="dialog" aria-expanded="false" aria-controls="d-dialog" data-state="closed" data-lui-part="trigger">Delete</button><dialog class="modal" id="d-dialog" role="dialog" aria-modal="true" aria-labelledby="d-title" aria-describedby="d-description" tabindex="-1" data-state="closed" data-lui-part="dialog"><div class="modal-card"><div class="modal-header"><h2 class="modal-title" id="d-title" data-lui-part="title">Delete?</h2><button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Tutup" data-lui-part="close"><i data-lf="x" aria-hidden="true"></i></button></div><div class="modal-body"><p id="d-description" data-lui-part="description">This cannot be undone.</p></div><div class="modal-footer"><button type="button" class="btn btn-ghost" value="cancel" data-lui-part="close">Cancel</button><button type="button" class="btn btn-danger" value="ok" data-lui-part="close">Delete</button></div></div></dialog></div>'));
gold("render: non-modal dialog open by default", "render", ["dialog", { idBase: "n", title: "Hi", modal: false, defaultOpen: true, closeButton: false, body: "Body" }],
  ok('<div class="lui-dialog" data-lui="dialog" data-lui-base="n" data-role="dialog" data-modal="false" data-close-on-escape="true" data-close-on-outside-click="true"><dialog class="modal" id="n-dialog" role="dialog" aria-labelledby="n-title" tabindex="-1" data-state="open" open data-lui-part="dialog"><div class="modal-card"><div class="modal-header"><h2 class="modal-title" id="n-title" data-lui-part="title">Hi</h2></div><div class="modal-body"><p>Body</p></div></div></dialog></div>'));
gold("render: modal dialog is never rendered open", "render", ["dialog", { idBase: "m", title: "T", defaultOpen: true, closeButton: false }],
  ok('<div class="lui-dialog" data-lui="dialog" data-lui-base="m" data-role="dialog" data-modal="true" data-close-on-escape="true" data-close-on-outside-click="true"><dialog class="modal" id="m-dialog" role="dialog" aria-modal="true" aria-labelledby="m-title" tabindex="-1" data-state="open" data-lui-part="dialog"><div class="modal-card"><div class="modal-header"><h2 class="modal-title" id="m-title" data-lui-part="title">T</h2></div><div class="modal-body"></div></div></dialog></div>'));
gold("render: menu", "render", ["menu", { idBase: "m", label: "Actions", items: [{ id: "edit", label: "Edit" }, { id: "del", label: "Delete", disabled: true }] }],
  ok('<div class="dropdown" data-lui="menu" data-lui-base="m" data-loop="true" data-typeahead-timeout="500"><button type="button" class="btn btn-soft" id="m-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="m-menu" data-state="closed" data-lui-part="trigger"><span>Actions</span><i data-lf="chevron-down" aria-hidden="true"></i></button><div class="dropdown-menu" id="m-menu" role="menu" aria-labelledby="m-trigger" tabindex="-1" data-state="closed" hidden data-lui-part="menu"><button type="button" class="dropdown-item" id="m-item-edit" role="menuitem" tabindex="-1" data-lui-part="item" data-lui-id="edit">Edit</button><button type="button" class="dropdown-item" id="m-item-del" role="menuitem" aria-disabled="true" tabindex="-1" data-lui-part="item" data-lui-id="del">Delete</button></div></div>'));
gold("render: unknown component", "render", ["carousel", {}], err("invalid_component"));
gold("render: unknown prop", "render", ["badge", { label: "x", color: "red" }], err("invalid_props"));
gold("render: locale id-ID resolves to id", "render", ["breadcrumb", { items: [{ label: "x" }], locale: "id-ID" }],
  ok('<nav aria-label="Jejak navigasi"><ol class="breadcrumb"><li aria-current="page">x</li></ol></nav>'));
gold("render: locale falls back to the language subtag then en", "render", ["breadcrumb", { items: [{ label: "x" }], locale: "fr-CA" }],
  ok('<nav aria-label="Breadcrumb"><ol class="breadcrumb"><li aria-current="page">x</li></ol></nav>'));

// ================================================================ generated regression
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "Escape", "Tab", "PageUp", "PageDown", "a", "b", "c", "x"];
const LABELS = ["Apple", "apricot", "Banana", "berry", "Cherry", "citrus", "Date", "Elder"];

function genItems(r, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const it = { id: `i${i}`, label: LABELS[Math.floor(r() * LABELS.length)] };
    if (r() < 0.25) it.disabled = true;
    out.push(it);
  }
  return out;
}

function pickOf(r, xs) {
  return xs[Math.floor(r() * xs.length)];
}

const EVENT_GEN = {
  disclosure: (r) => ({ type: pickOf(r, ["toggle", "open", "close"]) }),
  accordion: (r, items) => pickOf(r, [() => ({ type: "toggle", id: pickOf(r, items).id }), () => ({ type: "focus", id: pickOf(r, items).id }), () => ({ type: "blur" }), () => key(pickOf(r, KEYS))])(),
  tabs: (r, items) => pickOf(r, [() => ({ type: "select", id: pickOf(r, items).id }), () => ({ type: "focus", id: pickOf(r, items).id }), () => key(pickOf(r, KEYS)), () => key(pickOf(r, KEYS))])(),
  listbox: (r, items, t) => pickOf(r, [() => ({ type: "focus" }), () => ({ type: "select", id: pickOf(r, items).id }), () => ({ type: "highlight", id: pickOf(r, items).id }), () => key(pickOf(r, KEYS), { at: t() }), () => key("a", { at: t(), ctrl: true })])(),
  menu: (r, items, t) => pickOf(r, [() => ({ type: "triggerClick" }), () => ({ type: "triggerKeydown", key: pickOf(r, ["ArrowDown", "ArrowUp", "Enter", " "]) }), () => key(pickOf(r, KEYS), { at: t() }), () => key(pickOf(r, KEYS), { at: t() }), () => ({ type: "itemClick", id: pickOf(r, items).id }), () => ({ type: "highlight", id: pickOf(r, items).id }), () => ({ type: "outsideClick" })])(),
  combobox: (r, items) => pickOf(r, [() => ({ type: "input", value: pickOf(r, ["", "a", "an", "B", "rr", "zz", "Ch"]) }), () => key(pickOf(r, ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"])), () => key("ArrowDown", { alt: true }), () => ({ type: "select", id: pickOf(r, items).id }), () => ({ type: "highlight", id: pickOf(r, items).id }), () => ({ type: pickOf(r, ["open", "close", "blur"]) })])(),
  dialog: (r) => ({ type: pickOf(r, ["open", "close", "escape", "outsideClick"]) }),
  checkbox: (r) => pickOf(r, [() => ({ type: "toggle" }), () => ({ type: "set", checked: pickOf(r, [true, false, "mixed"]) }), () => key(pickOf(r, [" ", "Enter"]))])(),
  switch: (r) => pickOf(r, [() => ({ type: "toggle" }), () => ({ type: "set", checked: pickOf(r, [true, false]) }), () => key(pickOf(r, [" ", "Enter"]))])(),
  radiogroup: (r, items) => pickOf(r, [() => ({ type: "select", id: pickOf(r, items).id }), () => ({ type: "focus", id: pickOf(r, items).id }), () => key(pickOf(r, KEYS)), () => key(pickOf(r, KEYS))])(),
  slider: (r) => pickOf(r, [() => key(pickOf(r, KEYS)), () => key(pickOf(r, KEYS)), () => ({ type: "set", value: Math.round((r() * 240 - 20) * 100) / 100 })])(),
  tooltip: (r, _items, t) => pickOf(r, [() => ({ type: "pointerEnter", at: t() }), () => ({ type: "pointerLeave", at: t() }), () => ({ type: "tick", at: t() }), () => ({ type: "tick", at: t() }), () => ({ type: pickOf(r, ["focus", "blur", "escape"]) })])(),
  toast: (r, _items, t, n) => pickOf(r, [() => ({ type: "add", id: `t${n()}`, kind: pickOf(r, ["info", "success", "warning", "danger"]), duration: pickOf(r, [null, 100, 1000, 2500]), at: t() }), () => ({ type: "tick", at: t() }), () => ({ type: "tick", at: t() }), () => ({ type: pickOf(r, ["pause", "resume"]), at: t() }), () => ({ type: "dismiss", id: `t${Math.floor(r() * 6)}`, at: t() })])(),
};

const OPTION_GEN = {
  disclosure: (r) => ({ defaultOpen: r() < 0.5, disabled: r() < 0.15 }),
  accordion: (r, items) => ({ items, multiple: r() < 0.5, collapsible: r() < 0.7, orientation: pickOf(r, ["vertical", "horizontal"]), dir: pickOf(r, ["ltr", "rtl"]), loop: r() < 0.7 }),
  tabs: (r, items) => ({ items, activation: pickOf(r, ["automatic", "manual"]), orientation: pickOf(r, ["horizontal", "vertical"]), dir: pickOf(r, ["ltr", "rtl"]), loop: r() < 0.7 }),
  listbox: (r, items) => {
    const multiple = r() < 0.4;
    return { items, multiple, selectionFollowsFocus: !multiple && r() < 0.4, loop: r() < 0.5, typeaheadTimeout: pickOf(r, [300, 500, 1000]) };
  },
  menu: (r, items) => ({ items, loop: r() < 0.7 }),
  combobox: (r, items) => ({ items, filter: pickOf(r, ["contains", "startsWith", "none"]), loop: r() < 0.7 }),
  dialog: (r) => ({ role: pickOf(r, ["dialog", "alertdialog"]), modal: r() < 0.7, closeOnEscape: r() < 0.8 }),
  checkbox: (r) => ({ defaultChecked: pickOf(r, [true, false, "mixed"]), disabled: r() < 0.15 }),
  switch: (r) => ({ defaultChecked: r() < 0.5, disabled: r() < 0.15 }),
  radiogroup: (r, items) => ({ items, dir: pickOf(r, ["ltr", "rtl"]), loop: r() < 0.7, disabled: r() < 0.1 }),
  slider: (r) => pickOf(r, [
    () => ({ min: 0, max: 100, step: 1 }),
    () => ({ min: -5, max: 5, step: 0.5, dir: "rtl" }),
    () => ({ min: 0, max: 1, step: 0.01, largeStep: 0.1 }),
    () => ({ min: 10, max: 200, step: 7, orientation: "vertical" }),
    () => ({ min: 0.1, max: 0.9, step: 0.2 }),
  ])(),
  tooltip: (r) => ({ openDelay: pickOf(r, [0, 300, 700]), closeDelay: pickOf(r, [0, 150, 300]) }),
  toast: (r) => ({ max: pickOf(r, [1, 2, 3]), defaultDuration: pickOf(r, [null, 500, 5000]) }),
};

const NEEDS_ITEMS = new Set(["accordion", "tabs", "listbox", "menu", "combobox", "radiogroup"]);
let seed = 1;
for (const name of Object.keys(EVENT_GEN)) {
  for (let c = 0; c < 8; c++) {
    const r = rng(seed++);
    let items = genItems(r, 2 + Math.floor(r() * 5));
    if (name === "tabs" && items.every((it) => it.disabled)) items[0] = { id: items[0].id, label: items[0].label };
    let clock = 0;
    const t = () => (clock += Math.floor(r() * 900));
    let counter = 0;
    const n = () => counter++;
    const options = OPTION_GEN[name](r, items);
    const events = [];
    const len = 8 + Math.floor(r() * 18);
    for (let i = 0; i < len; i++) events.push(EVENT_GEN[name](r, items, t, n));
    regress(`regression ${name} #${c + 1}`, "run", [name, options, events]);
    if (c < 2) regress(`regression ${name} attrs #${c + 1}`, "attrs", [name, options, events.filter((e) => exec("run", [name, options, [e]]).result?.steps[0]?.$error === undefined).slice(0, 6)]);
    if (!NEEDS_ITEMS.has(name)) items = [];
  }
}

for (let c = 0; c < 24; c++) {
  const r = rng(1000 + c);
  const ref = { x: Math.floor(r() * 400), y: Math.floor(r() * 400), width: Math.floor(r() * 120), height: Math.floor(r() * 60) };
  const fl = { width: Math.floor(r() * 200) + 1, height: Math.floor(r() * 150) + 1 };
  const args = { reference: ref, floating: fl, placement: pickOf(r, ["top", "top-start", "top-end", "bottom", "bottom-start", "bottom-end", "left", "left-start", "left-end", "right", "right-start", "right-end"]), offset: pickOf(r, [0, 4, 8.5]), padding: pickOf(r, [0, 8]), dir: pickOf(r, ["ltr", "rtl"]) };
  if (r() < 0.8) args.boundary = { x: 0, y: 0, width: 480, height: 480 };
  if (r() < 0.5) args.arrow = pickOf(r, [6, 10, 13]);
  if (r() < 0.2) args.flip = false;
  if (r() < 0.2) args.shift = false;
  regress(`regression position #${c + 1}`, "position", [args]);
}

for (let c = 0; c < 16; c++) {
  const r = rng(2000 + c);
  const total = 1 + Math.floor(r() * 60);
  regress(`regression pagination #${c + 1}`, "pagination", [{ page: 1 + Math.floor(r() * total), total, siblings: Math.floor(r() * 3), boundaries: Math.floor(r() * 3) }]);
}

for (let c = 0; c < 6; c++) {
  const r = rng(3000 + c);
  const total = 2 + Math.floor(r() * 30);
  regress(`regression render pagination #${c + 1}`, "render", ["pagination", { page: 1 + Math.floor(r() * total), total, siblings: Math.floor(r() * 2), href: r() < 0.5 ? "?p={page}" : null, locale: pickOf(r, ["en", "id"]) }]);
  const items = genItems(r, 2 + Math.floor(r() * 3)).map((it) => ({ ...it, content: `Panel ${it.id} <${it.label}>` }));
  if (items.every((it) => it.disabled)) delete items[0].disabled;
  regress(`regression render tabs #${c + 1}`, "render", ["tabs", { idBase: `r${c}`, items, activation: pickOf(r, ["automatic", "manual"]), dir: pickOf(r, ["ltr", "rtl"]) }]);
  regress(`regression render accordion #${c + 1}`, "render", ["accordion", { idBase: `a${c}`, items, multiple: true, defaultExpanded: items.filter((_, i) => i % 2 === 0).map((it) => it.id) }]);
}

if (failures > 0) {
  console.error(`${failures} golden case(s) disagree with the TypeScript port`);
  process.exit(1);
}

const doc = {
  format: "lombokui-vectors",
  version: 1,
  specVersion: "0.1.0",
  note: "Cross-language contract for LombokUI. Each case calls fn with args; expect is {result} or {error: code}. Results compare structurally (JSON values).",
  groups: [
    { name: "golden", cases: golden },
    { name: "generated-regression", cases: regression },
  ],
};
// ASCII-only file (style rule): every non-ASCII character is written as a \uXXXX escape.
const text = JSON.stringify(doc, null, 1).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
writeFileSync(OUT, text);
const hash = createHash("sha256").update(readFileSync(OUT)).digest("hex");
console.log(`golden ${golden.length}, regression ${regression.length}, total ${golden.length + regression.length}`);
console.log(`sha256 ${hash}`);
