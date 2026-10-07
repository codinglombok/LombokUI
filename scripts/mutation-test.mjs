// Mutation check (GP-11): inject one defect at a time into the compiled TypeScript core and require
// the vector runner to fail. Usage from the repo root, after `cd typescript && npm run build`:
//   node scripts/mutation-test.mjs
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "typescript", "dist");
// The copy lives at <repo>/.mut/dist so that test/helpers.js still resolves the repo root.
const tmp = join(root, ".mut", "dist");

const MUTATIONS = [
  ["util.js", "if (loop)\n            for (let i = 0; i < ci; i++)", "if (false)\n            for (let i = 0; i < ci; i++)", "navigate wraps forward"],
  ["util.js", 'return dir === "rtl" ? "prev" : "next";', 'return "next";', "rtl arrow mapping"],
  ["util.js", "const start = repeated ? ci + 1 : Math.max(ci, 0);", "const start = Math.max(ci, 0);", "typeahead cycles repeated characters"],
  ["util.js", "at - st.queryAt < timeout", "at - st.queryAt <= timeout", "typeahead timeout boundary"],
  ["util.js", "(c) => String.fromCharCode(c.charCodeAt(0) + 32)", "(c) => c", "ASCII case folding"],
  ["components/tabs.js", 'selected: ctx.activation === "automatic" ? to : state.selected', "selected: to", "manual activation"],
  ["components/tabs.js", 'tab.tabindex = it.id === tabbable ? "0" : "-1";', 'tab.tabindex = it.id === state.selected ? "0" : "-1";', "roving tabindex follows focus"],
  ["components/accordion.js", "if (!ctx.collapsible && set.size === 1)", "if (!ctx.collapsible && set.size === 0)", "non-collapsible accordion"],
  ["components/accordion.js", "if (!ctx.multiple)\n            set.clear();", "", "single expansion"],
  ["components/listbox.js", "selected = enabled.every((id) => selected.includes(id)) ? [] : enabled;", "selected = enabled;", "Ctrl+A toggles all"],
  ["components/listbox.js", "if (ctx.selectionFollowsFocus)\n            choose(id);", "", "selection follows focus"],
  ["components/menu.js", 'if (key === "Tab")\n                    return close(false, null);', 'if (key === "Tab")\n                    return close(true, null);', "Tab does not restore focus"],
  ["components/menu.js", "if (select !== null)\n            effects.push({ type: \"select\", id: select });", "", "menu select effect"],
  ["components/combobox.js", "fold(it.label).includes(needle)", "fold(it.label).startsWith(needle)", "contains filter"],
  ["components/combobox.js", "selected = null;\n                    visible", "visible", "Escape clears the selection"],
  ["components/dialog.js", 'if (ctx.modal)\n            effects.push({ type: "lockScroll" }, { type: "trapFocus" });', "", "modal effects"],
  ["components/dialog.js", 'closeOnOutsideClick: r.bool("closeOnOutsideClick", role === "dialog")', 'closeOnOutsideClick: r.bool("closeOnOutsideClick", true)', "alertdialog default"],
  ["components/toggle.js", "checked = checked !== true;", "checked = !checked;", "mixed becomes checked"],
  ["components/radiogroup.js", "if (to !== focused)\n                        effects.push", "if (false)\n                        effects.push", "radio focus effect"],
  ["components/slider.js", "/ ctx.st + 0.5);", "/ ctx.st);", "slider rounds to the nearest step"],
  ["components/slider.js", "const flip = ctx.orientation === \"horizontal\" && ctx.dir === \"rtl\" ? -1 : 1;", "const flip = 1;", "slider rtl"],
  ["components/slider.js", "let kl = Math.max(1, Math.floor(kmax / 10));", "let kl = 10;", "default large step"],
  ["components/tooltip.js", "at >= state.dueAt", "at > state.dueAt", "tooltip due boundary"],
  ["components/toast.js", "for (let i = 0; i < items.length && i < ctx.max; i++)", "for (let i = 0; i < items.length; i++)", "queued toasts wait"],
  ["components/toast.js", "t.remaining = Math.max(0, t.deadline - at);", "t.remaining = t.deadline - at + 1;", "pause keeps remaining time"],
  ["position.js", "if (o2 < o1) {", "if (o2 <= o1) {", "flip tie keeps the side"],
  ["position.js", 'const a = align === "center" ? "center" : dir === "rtl" ? (align === "start" ? "end" : "start") : align;', "const a = align;", "rtl alignment"],
  ["position.js", "p = { x: Math.max(lo, Math.min(p.x, hi)), y: p.y };", "p = { x: Math.min(hi, Math.max(p.x, lo)), y: p.y };", "shift prefers the start edge"],
  ["position.js", "offset: Math.max(arrowPadding, Math.min(raw, hi))", "offset: raw", "arrow clamp"],
  ["pagination.js", "if (sibStart > b + 2)", "if (sibStart > b + 1)", "ellipsis needs a real gap"],
  ["pagination.js", "prev: page > 1 ? page - 1 : null", "prev: page - 1", "prev on the first page"],
  ["render.js", '.replace(/"/g, "&quot;")', "", "attribute quote escaping"],
  ["render.js", ".replace(/</g, \"&lt;\")", "", "text escaping"],
  ["render.js", 'const SAFE_SCHEMES = ["http", "https", "mailto", "tel"];', 'const SAFE_SCHEMES = ["http", "https", "mailto", "tel", "javascript", "data"];', "URL scheme allowlist"],
  ["render.js", '["open", open && !c.modal]', '["open", open]', "modal dialogs are not open in SSR"],
  ["messages.js", "const lang = t.split(\"-\")[0];", "const lang = t;", "locale fallback to language"],
  ["machine.js", 'if (e[k] === undefined)\n            fail("invalid_event", `${e.type}.${k} is required`);', "", "required event fields"],
];

let survived = 0;
for (const [file, find, repl, label] of MUTATIONS) {
  const path = join(dist, "src", file);
  const src = readFileSync(path, "utf8");
  // Whitespace-insensitive match, so patterns do not depend on the compiler's indentation.
  const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "g");
  const count = (src.match(re) ?? []).length;
  if (count === 0) {
    console.log(`SKIP     ${label}: pattern not found in ${file}`);
    survived++;
    continue;
  }
  rmSync(join(root, ".mut"), { recursive: true, force: true });
  cpSync(dist, tmp, { recursive: true });
  writeFileSync(join(tmp, "src", file), src.replace(re, () => repl));
  const r = spawnSync(process.execPath, ["--test", join(tmp, "test", "vectors.test.js")], { encoding: "utf8" });
  const killed = r.status !== 0;
  if (!killed) survived++;
  console.log(`${killed ? "KILLED  " : "SURVIVED"} ${label}`);
}
rmSync(join(root, ".mut"), { recursive: true, force: true });
console.log(`\n${MUTATIONS.length - survived}/${MUTATIONS.length} mutants killed`);
process.exit(survived === 0 ? 0 : 1);
