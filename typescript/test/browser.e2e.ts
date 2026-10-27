// End-to-end flows in a real Chromium (TECH_DEBT TD-03): real keyboard and pointer input, real
// focus, and the native <dialog>.showModal(). Run with `npm run test:browser` after `npm run build`.
// The browser comes from LUI_CHROMIUM, else Playwright's own install (`npx playwright-core install chromium`).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { render } from "../src/index.js";
import { ROOT } from "./helpers.js";

const DIST = join(ROOT, "typescript", "dist");

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>LombokUI e2e</title>
<style>[hidden]{display:none!important} .track{width:200px;height:20px;position:relative}</style></head><body>
<button id="before">before</button>
${render("tabs", { idBase: "t", items: [{ id: "a", label: "One", content: "1" }, { id: "b", label: "Two", content: "2", disabled: true }, { id: "c", label: "Three", content: "3" }] })}
${render("accordion", { idBase: "f", items: [{ id: "a", label: "A", content: "x" }, { id: "b", label: "B", content: "y" }] })}
${render("menu", { idBase: "m", label: "Actions", items: [{ id: "edit", label: "Edit" }, { id: "dup", label: "Duplicate", disabled: true }, { id: "del", label: "Delete" }] })}
${render("dialog", { idBase: "d", title: "Delete?", trigger: { label: "Open" }, actions: [{ label: "Cancel", value: "cancel" }, { label: "OK", value: "ok" }] })}
<div data-lui="combobox" data-lui-base="c"><label data-lui-part="label">Fruit</label><input data-lui-part="input">
<ul data-lui-part="listbox"><li data-lui-part="option" data-lui-id="apple">Apple</li><li data-lui-part="option" data-lui-id="banana">Banana</li><li data-lui-part="option" data-lui-id="cherry">Cherry</li></ul></div>
<div data-lui="slider" data-lui-base="v" data-min="0" data-max="10" data-step="1" data-value="5"><div class="track" data-lui-part="track"><span data-lui-part="thumb"></span></div></div>
<script type="module">
import { hydrate } from "/src/dom.js";
window.events = [];
for (const m of hydrate(document)) for (const t of ["lui:select", "lui:action", "lui:change"]) m.root.addEventListener(t, (e) => window.events.push([t, e.detail]));
window.ready = true;
</script></body></html>`;

const TYPES: Record<string, string> = { ".js": "text/javascript", ".html": "text/html" };
let server: Server;
let base = "";
let browser: Browser;
let page: Page;

before(async () => {
  server = createServer(async (req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/") {
      res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
      return;
    }
    const file = normalize(join(DIST, url));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    let body: Buffer;
    try {
      body = await readFile(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/`;
  browser = await chromium.launch(process.env.LUI_CHROMIUM ? { executablePath: process.env.LUI_CHROMIUM } : {});
});

after(async () => {
  await browser?.close();
  await new Promise<void>((r) => server.close(() => r()));
});

async function fresh(): Promise<Page> {
  page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
  assert.deepEqual(errors, []);
  return page;
}

const focusedId = (p: Page) => p.evaluate(() => document.activeElement?.id ?? "");

test("browser: tabs follow real Tab and arrow keys, skipping the disabled tab", async () => {
  const p = await fresh();
  await p.focus("#before");
  await p.keyboard.press("Tab");
  assert.equal(await focusedId(p), "t-tab-a", "only the selected tab is in the tab order");
  await p.keyboard.press("ArrowRight");
  assert.equal(await focusedId(p), "t-tab-c");
  assert.equal(await p.getAttribute("#t-tab-c", "aria-selected"), "true");
  assert.equal(await p.isVisible("#t-panel-c"), true);
  assert.equal(await p.isVisible("#t-panel-a"), false);
  await p.keyboard.press("Tab");
  assert.equal(await focusedId(p), "t-panel-c", "Tab leaves the tablist for the panel");
  await p.close();
});

test("browser: accordion toggles exactly once per Enter and Space on a native button", async () => {
  const p = await fresh();
  await p.focus("#f-header-a");
  await p.keyboard.press("Enter");
  assert.equal(await p.getAttribute("#f-header-a", "aria-expanded"), "true");
  await p.keyboard.press(" ");
  assert.equal(await p.getAttribute("#f-header-a", "aria-expanded"), "false");
  await p.keyboard.press("ArrowDown");
  assert.equal(await focusedId(p), "f-header-b");
  await p.close();
});

test("browser: menu opens from the keyboard, selects and returns focus", async () => {
  const p = await fresh();
  await p.focus("#m-trigger");
  await p.keyboard.press("ArrowDown");
  assert.equal(await p.isVisible("#m-menu"), true);
  assert.equal(await focusedId(p), "m-menu");
  assert.equal(await p.getAttribute("#m-menu", "aria-activedescendant"), "m-item-edit");
  await p.keyboard.press("ArrowDown");
  assert.equal(await p.getAttribute("#m-menu", "aria-activedescendant"), "m-item-del", "the disabled item is skipped");
  await p.keyboard.press("Enter");
  assert.equal(await p.isVisible("#m-menu"), false);
  assert.equal(await focusedId(p), "m-trigger");
  const events = await p.evaluate(() => (window as unknown as { events: unknown[] }).events);
  assert.deepEqual(events.filter((e) => (e as string[])[0] === "lui:select"), [["lui:select", { id: "del" }]]);
  await p.click("#m-trigger");
  assert.equal(await p.isVisible("#m-menu"), true);
  await p.mouse.click(5, 400);
  assert.equal(await p.isVisible("#m-menu"), false, "an outside click closes the menu");
  await p.close();
});

test("browser: native modal dialog, focus trap, Escape and focus return", async () => {
  const p = await fresh();
  await p.click("[data-lui=dialog] [data-lui-part=trigger]");
  assert.equal(await p.evaluate(() => (document.getElementById("d-dialog") as HTMLDialogElement).open), true);
  assert.equal(await p.evaluate(() => document.getElementById("d-dialog")?.matches(":modal")), true, "opened with showModal()");
  assert.equal(await p.evaluate(() => document.documentElement.style.overflow), "hidden");
  assert.equal(await p.evaluate(() => document.getElementById("d-dialog")?.contains(document.activeElement)), true);
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => document.getElementById("d-dialog")?.contains(document.activeElement)), true, "focus stays in the dialog");
  }
  await p.keyboard.press("Escape");
  assert.equal(await p.evaluate(() => (document.getElementById("d-dialog") as HTMLDialogElement).open), false);
  assert.equal(await p.evaluate(() => document.documentElement.style.overflow), "");
  assert.equal(await p.evaluate(() => document.activeElement?.getAttribute("data-lui-part")), "trigger");
  const changes = await p.evaluate(() => (window as unknown as { events: [string, { name?: string }][] }).events.filter((e) => e[0] === "lui:change").length);
  assert.equal(changes, 2, "one open and one close, Escape is not handled twice");
  await p.click("[data-lui=dialog] [data-lui-part=trigger]");
  await p.click('#d-dialog [value="ok"]');
  const actions = await p.evaluate(() => (window as unknown as { events: [string, unknown][] }).events.filter((e) => e[0] === "lui:action"));
  assert.deepEqual(actions, [["lui:action", { value: "ok" }]]);
  await p.close();
});

test("browser: combobox filters while typing and commits with Enter", async () => {
  const p = await fresh();
  await p.click("#c-input");
  await p.keyboard.type("an");
  assert.equal(await p.isVisible("#c-option-apple"), false);
  assert.equal(await p.isVisible("#c-option-banana"), true);
  await p.keyboard.press("ArrowDown");
  assert.equal(await p.getAttribute("#c-input", "aria-activedescendant"), "c-option-banana");
  await p.keyboard.press("Enter");
  assert.equal(await p.inputValue("#c-input"), "Banana");
  assert.equal(await p.isVisible("#c-listbox"), false);
  await p.close();
});

test("browser: slider responds to keys and to a real pointer drag", async () => {
  const p = await fresh();
  await p.focus("#v-thumb");
  await p.keyboard.press("ArrowRight");
  assert.equal(await p.getAttribute("#v-thumb", "aria-valuenow"), "6");
  const box = await p.locator("[data-lui-part=track]").boundingBox();
  assert.ok(box);
  await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 5 });
  await p.mouse.up();
  assert.equal(await p.getAttribute("#v-thumb", "aria-valuenow"), "9");
  assert.equal(await focusedId(p), "v-thumb");
  await p.close();
});
