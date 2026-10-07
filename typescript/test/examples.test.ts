// Every code example in README and the guide is executed here, and the documented output is
// checked against the text of the document.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMachine, position, render, run } from "../src/index.js";
import { readRepo } from "./helpers.js";

const readme = readRepo("README.md");
const guide = readRepo("docs/guide_how_to_use_LombokUI_v0.1.0.md");

test("README: tabs machine quick start", () => {
  const tabs = createMachine("tabs", { idBase: "t", items: [{ id: "a" }, { id: "b", disabled: true }, { id: "c" }] });
  tabs.send({ type: "focus", id: "a" });
  const fx = tabs.send({ type: "keydown", key: "ArrowRight" });
  assert.deepEqual(fx, [{ type: "change", name: "selected", value: "c" }, { type: "focus", target: "tab:c" }]);
  assert.deepEqual(tabs.attrs()["tab:c"], { id: "t-tab-c", role: "tab", "aria-selected": "true", "aria-controls": "t-panel-c", tabindex: "0", "data-state": "active" });
  assert.ok(readme.includes('// [{ type: "change", name: "selected", value: "c" }, { type: "focus", target: "tab:c" }]'));
  assert.ok(readme.includes('// { id: "t-tab-c", role: "tab", "aria-selected": "true", "aria-controls": "t-panel-c", tabindex: "0", "data-state": "active" }'));
});

test("README: vector counts match the vector file", () => {
  const doc = JSON.parse(readRepo("vectors/lombokui-vectors-v1.json")) as { groups: { cases: unknown[] }[] };
  const [golden, regression] = doc.groups.map((g) => g.cases.length);
  assert.ok(readme.includes(`Vector: ${golden + regression} kasus (${golden} golden`));
  assert.ok(readme.includes(`${regression} regresi`));
});

test("guide: menu script effects", () => {
  const out = run("menu", { items: [{ id: "edit" }, { id: "del" }] }, [{ type: "triggerClick" }, { type: "keydown", key: "ArrowDown" }, { type: "keydown", key: "Enter" }]);
  assert.deepEqual((out.steps[2] as { effects: unknown }).effects, [{ type: "select", id: "del" }, { type: "change", name: "open", value: false }, { type: "focus", target: "trigger" }]);
  assert.ok(guide.includes('// [{ type: "select", id: "del" }, { type: "change", name: "open", value: false }, { type: "focus", target: "trigger" }]'));
});

test("guide: position recipe", () => {
  const p = position({ reference: { x: 100, y: 10, width: 40, height: 20 }, floating: { width: 60, height: 30 }, placement: "top", boundary: { x: 0, y: 0, width: 400, height: 400 }, arrow: 10 });
  assert.deepEqual(p, { x: 90, y: 30, placement: "bottom", side: "bottom", align: "center", arrow: { edge: "top", offset: 25 } });
  assert.ok(guide.includes('// { x: 90, y: 30, placement: "bottom", side: "bottom", align: "center", arrow: { edge: "top", offset: 25 } }'));
});

test("guide: switch machine recipe", () => {
  const sw = createMachine("switch", { idBase: "notif" });
  const seen: unknown[] = [];
  sw.subscribe((s) => seen.push(s.checked));
  sw.send({ type: "keydown", key: " " });
  assert.deepEqual(seen, [true]);
  assert.deepEqual(sw.attrs().control, { id: "notif-control", role: "switch", "aria-checked": "true", tabindex: "0", "data-state": "checked" });
  assert.ok(guide.includes('// { id: "notif-control", role: "switch", "aria-checked": "true", tabindex: "0", "data-state": "checked" }'));
});

test("guide: pagination labels and dialog recipe render", () => {
  const html = render("pagination", { page: 2, total: 9, href: "?hal={page}", labels: { previous_page: "Sebelumnya", next_page: "Berikutnya" } });
  assert.ok(html.includes('aria-label="Sebelumnya"') && html.includes('href="?hal=3"'));
  const dlg = render("dialog", {
    idBase: "hapus",
    title: "Hapus berkas?",
    description: "Tindakan ini tidak dapat dibatalkan.",
    trigger: { label: "Hapus", variant: "danger" },
    actions: [{ label: "Batal", value: "batal" }, { label: "Hapus", variant: "danger", value: "ok" }],
    locale: "id",
  });
  assert.ok(dlg.includes('aria-label="Tutup"') && dlg.includes('value="batal"'));
});
