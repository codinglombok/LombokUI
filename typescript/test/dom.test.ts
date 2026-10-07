// DOM adapter flows in jsdom: hydration of server-rendered markup, keyboard and pointer wiring,
// focus effects, and timers driven by an injected clock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { render } from "../src/index.js";
import { hydrate, mount, toaster, type Timer } from "../src/dom.js";

function page(html: string): { doc: Document; win: Window & typeof globalThis } {
  const dom = new JSDOM(`<!doctype html><html><body>${html}<button id="outside">outside</button></body></html>`, { pretendToBeVisual: true });
  return { doc: dom.window.document, win: dom.window as unknown as Window & typeof globalThis };
}

function key(win: Window & typeof globalThis, el: Element, k: string, init: KeyboardEventInit = {}): void {
  el.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
}

function fakeTimer(): Timer & { advance(ms: number): void } {
  let now = 0;
  let seq = 0;
  const queue = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const h = ++seq;
      queue.set(h, { at: now + ms, fn });
      return h;
    },
    clearTimeout(h) {
      queue.delete(h as number);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...queue.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

test("dom: tabs hydrate from SSR markup and follow the keyboard", () => {
  const html = render("tabs", { idBase: "t", items: [{ id: "a", label: "One", content: "1" }, { id: "b", label: "Two", content: "2", disabled: true }, { id: "c", label: "Three", content: "3" }] });
  const { doc, win } = page(html);
  const [m] = hydrate(doc);
  const tabA = doc.getElementById("t-tab-a") as HTMLElement;
  const tabC = doc.getElementById("t-tab-c") as HTMLElement;
  tabA.focus();
  assert.equal(m.machine.state.focused, "a");
  key(win, tabA, "ArrowRight");
  assert.equal(doc.activeElement, tabC, "focus moved past the disabled tab");
  assert.equal(tabC.getAttribute("aria-selected"), "true");
  assert.equal(tabC.getAttribute("tabindex"), "0");
  assert.equal(tabA.getAttribute("tabindex"), "-1");
  assert.equal(doc.getElementById("t-panel-a")?.hasAttribute("hidden"), true);
  assert.equal(doc.getElementById("t-panel-c")?.hasAttribute("hidden"), false);
  assert.equal((doc.querySelector("[data-lui]") as HTMLElement).dataset.luiMounted, "true");
  assert.equal(hydrate(doc).length, 0, "hydrate is idempotent");
});

test("dom: menu opens, navigates, selects and restores focus", () => {
  const { doc, win } = page(render("menu", { idBase: "m", label: "Actions", items: [{ id: "edit", label: "Edit" }, { id: "dup", label: "Duplicate", disabled: true }, { id: "del", label: "Delete" }] }));
  const root = doc.querySelector<HTMLElement>("[data-lui=menu]") as HTMLElement;
  const selected: string[] = [];
  root.addEventListener("lui:select", (e) => selected.push((e as CustomEvent).detail.id));
  mount(root);
  const trigger = doc.getElementById("m-trigger") as HTMLElement;
  const menu = doc.getElementById("m-menu") as HTMLElement;
  assert.equal(menu.hasAttribute("hidden"), true);
  key(win, trigger, "ArrowDown");
  assert.equal(menu.hasAttribute("hidden"), false);
  assert.equal(doc.activeElement, menu);
  assert.equal(menu.getAttribute("aria-activedescendant"), "m-item-edit");
  key(win, menu, "ArrowDown");
  assert.equal(menu.getAttribute("aria-activedescendant"), "m-item-del");
  key(win, menu, "Enter");
  assert.deepEqual(selected, ["del"]);
  assert.equal(menu.hasAttribute("hidden"), true);
  assert.equal(doc.activeElement, trigger);
  trigger.click();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  doc.getElementById("outside")?.dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true }));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("dom: modal dialog locks scroll, traps focus and restores focus", () => {
  const { doc, win } = page(render("dialog", { idBase: "d", title: "Delete?", trigger: { label: "Open" }, actions: [{ label: "Cancel", value: "cancel" }, { label: "OK", value: "ok" }] }));
  const [m] = hydrate(doc);
  const trigger = doc.querySelector<HTMLElement>("[data-lui-part=trigger]") as HTMLElement;
  const actions: string[] = [];
  m.root.addEventListener("lui:action", (e) => actions.push((e as CustomEvent).detail.value));
  trigger.focus();
  trigger.click();
  assert.equal(m.machine.state.open, true);
  assert.equal(doc.documentElement.style.overflow, "hidden");
  const dialog = doc.getElementById("d-dialog") as HTMLElement;
  assert.ok(dialog.contains(doc.activeElement), "initial focus is inside the dialog");
  const buttons = [...dialog.querySelectorAll("button")];
  buttons[buttons.length - 1].focus();
  key(win, buttons[buttons.length - 1], "Tab");
  assert.equal(doc.activeElement, buttons[0], "Tab wraps to the first focusable element");
  key(win, dialog, "Escape");
  assert.equal(m.machine.state.open, false);
  assert.equal(doc.documentElement.style.overflow, "");
  assert.equal(doc.activeElement, trigger, "focus returns to the trigger");
  trigger.click();
  (dialog.querySelector('[value="ok"]') as HTMLElement).click();
  assert.deepEqual(actions, ["ok"]);
  assert.equal(m.machine.state.open, false);
});

test("dom: accordion toggles by click and moves focus by arrows", () => {
  const { doc, win } = page(render("accordion", { idBase: "f", items: [{ id: "a", label: "A", content: "x" }, { id: "b", label: "B", content: "y" }] }));
  hydrate(doc);
  const a = doc.getElementById("f-header-a") as HTMLElement;
  const b = doc.getElementById("f-header-b") as HTMLElement;
  a.click();
  assert.equal(a.getAttribute("aria-expanded"), "true");
  assert.equal(doc.getElementById("f-panel-a")?.hasAttribute("hidden"), false);
  b.click();
  assert.equal(a.getAttribute("aria-expanded"), "false", "single mode closes the other item");
  a.focus();
  key(win, a, "ArrowDown");
  assert.equal(doc.activeElement, b);
  key(win, b, "Enter");
  assert.equal(b.getAttribute("aria-expanded"), "true", "Enter on a native button is left to the click");
});

test("dom: combobox filters options and commits with Enter", () => {
  const html = `<div data-lui="combobox" data-lui-base="c">
    <label data-lui-part="label">Fruit</label><input data-lui-part="input">
    <ul data-lui-part="listbox"><li data-lui-part="option" data-lui-id="apple">Apple</li><li data-lui-part="option" data-lui-id="banana">Banana</li><li data-lui-part="option" data-lui-id="cherry">Cherry</li></ul></div>`;
  const { doc, win } = page(html);
  const [m] = hydrate(doc);
  const input = doc.getElementById("c-input") as HTMLInputElement;
  assert.equal(input.getAttribute("role"), "combobox");
  assert.equal(doc.getElementById("c-label")?.getAttribute("for"), "c-input");
  input.value = "an";
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
  assert.equal(doc.getElementById("c-option-apple")?.hasAttribute("hidden"), true);
  assert.equal(doc.getElementById("c-option-banana")?.hasAttribute("hidden"), false);
  key(win, input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), "c-option-banana");
  key(win, input, "Enter");
  assert.equal(input.value, "Banana");
  assert.equal(m.machine.state.selected, "banana");
  assert.equal(doc.getElementById("c-listbox")?.hasAttribute("hidden"), true);
});

test("dom: tooltip uses the injected clock", () => {
  const html = `<span data-lui="tooltip" data-lui-base="tip" data-open-delay="300" data-close-delay="100"><button data-lui-part="trigger">i</button><span data-lui-part="tooltip">Help</span></span>`;
  const { doc, win } = page(html);
  const timer = fakeTimer();
  const [m] = hydrate(doc, { timer });
  const trigger = doc.querySelector("button") as HTMLElement;
  trigger.dispatchEvent(new win.PointerEvent("pointerenter"));
  timer.advance(299);
  assert.equal(m.machine.state.open, false);
  timer.advance(1);
  assert.equal(m.machine.state.open, true);
  assert.equal(trigger.getAttribute("aria-describedby"), "tip-tooltip");
  trigger.dispatchEvent(new win.PointerEvent("pointerleave"));
  timer.advance(100);
  assert.equal(m.machine.state.open, false);
  assert.equal(doc.getElementById("tip-tooltip")?.hasAttribute("hidden"), true);
});

test("dom: toaster creates, queues, pauses and expires toasts", () => {
  const { doc, win } = page(`<div data-lui="toast" data-lui-base="n" data-max="1" class="toast-region"></div>`);
  const timer = fakeTimer();
  const region = doc.querySelector<HTMLElement>("[data-lui=toast]") as HTMLElement;
  const t = toaster(region, { timer });
  const a = t.show({ body: "<b>Saved</b>", kind: "success", duration: 1000 });
  const b = t.show({ body: "Second", duration: 1000 });
  assert.equal(doc.getElementById(`n-toast-${a}`)?.textContent?.includes("<b>Saved</b>"), true, "body is text, not HTML");
  assert.equal(doc.getElementById(`n-toast-${b}`)?.hasAttribute("hidden"), true, "queued beyond max");
  assert.equal(doc.getElementById(`n-toast-${a}`)?.getAttribute("role"), "status");
  region.dispatchEvent(new win.PointerEvent("pointerenter"));
  timer.advance(5000);
  assert.ok(doc.getElementById(`n-toast-${a}`), "paused while hovered");
  region.dispatchEvent(new win.PointerEvent("pointerleave"));
  timer.advance(1000);
  assert.equal(doc.getElementById(`n-toast-${a}`), null, "expired");
  assert.equal(doc.getElementById(`n-toast-${b}`)?.hasAttribute("hidden"), false, "next toast shown");
  (doc.querySelector(`[data-lui-part=close][data-lui-id="${b}"]`) as HTMLElement).click();
  assert.equal(doc.getElementById(`n-toast-${b}`), null, "dismissed by its close button");
  t.destroy();
});

test("dom: slider keyboard and pointer", () => {
  const html = `<div data-lui="slider" data-lui-base="v" data-min="0" data-max="10" data-step="1" data-value="5"><div data-lui-part="track"><span data-lui-part="thumb"></span></div></div>`;
  const { doc, win } = page(html);
  const [m] = hydrate(doc);
  const thumb = doc.getElementById("v-thumb") as HTMLElement;
  assert.equal(thumb.getAttribute("aria-valuenow"), "5");
  key(win, thumb, "End");
  assert.equal(thumb.getAttribute("aria-valuenow"), "10");
  assert.equal(m.root.style.getPropertyValue("--lui-value-percent"), "100%");
  const track = doc.querySelector<HTMLElement>("[data-lui-part=track]") as HTMLElement;
  track.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON() {} }) as DOMRect;
  track.dispatchEvent(new win.PointerEvent("pointerdown", { clientX: 61, bubbles: true }));
  assert.equal(thumb.getAttribute("aria-valuenow"), "3");
});

test("dom: destroy removes listeners", () => {
  const { doc } = page(render("tabs", { idBase: "t", items: [{ id: "a", content: "1" }, { id: "b", content: "2" }] }));
  const [m] = hydrate(doc);
  m.destroy();
  (doc.getElementById("t-tab-b") as HTMLElement).click();
  assert.equal(m.machine.state.selected, "a");
});
