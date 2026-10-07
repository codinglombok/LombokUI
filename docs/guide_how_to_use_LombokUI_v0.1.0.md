# Guide How To Use LombokUI v0.1.0

## Instalasi

Belum terbit. Setelah rilis: `npm install lombokui` atau `pip install lombokui`. Sebelum itu, bangun dari repo (lihat `CONTRIBUTING.md`) atau pasang lokal dengan `npm install ./typescript` dan `pip install ./python`.

## Konsep dasar

1. **Komponen** adalah mesin murni: `setup(options)` memvalidasi opsi dan membuat state awal; `send(state, event)` menghasilkan state baru dan daftar effect; `attrs(state)` memetakan state ke atribut ARIA per part.
2. **Event** adalah data (`{ type: "keydown", key: "ArrowDown" }`). Waktu (`at`) dipasok pemanggil, sehingga delay dan timeout dapat diuji tanpa menunggu.
3. **Effect** adalah instruksi untuk lapisan tampilan: pindahkan fokus, kunci gulir, jadwalkan `tick`. Adapter DOM menjalankannya; framework sendiri dapat menjalankannya dengan cara lain.
4. **Render** menulis HTML state awal dengan nama kelas LombokCSS dan atribut `data-lui-*`; **hydrate** melanjutkan dari markup itu di browser.

## Contoh

### Menjalankan skrip event (pengujian tanpa browser)

```ts
import { run } from "lombokui";

const out = run("menu", { items: [{ id: "edit" }, { id: "del" }] }, [
  { type: "triggerClick" },
  { type: "keydown", key: "ArrowDown" },
  { type: "keydown", key: "Enter" },
]);
out.steps[2].effects;
// [{ type: "select", id: "del" }, { type: "change", name: "open", value: false }, { type: "focus", target: "trigger" }]
```

### Render di server dengan Python lalu hidrasi

```python
import lombokui

html = lombokui.render("dialog", {
    "idBase": "hapus",
    "title": "Hapus berkas?",
    "description": "Tindakan ini tidak dapat dibatalkan.",
    "trigger": {"label": "Hapus", "variant": "danger"},
    "actions": [{"label": "Batal", "value": "batal"}, {"label": "Hapus", "variant": "danger", "value": "ok"}],
    "locale": "id",
})
```

```ts
import { hydrate } from "lombokui/dom";

for (const m of hydrate(document)) {
  m.root.addEventListener("lui:action", (e) => console.log((e as CustomEvent).detail.value)); // "batal" atau "ok"
}
```

## Recipes

### Markup sendiri tanpa render

Adapter hanya membutuhkan `data-lui`, `data-lui-base`, dan part `data-lui-part`/`data-lui-id`:

```html
<div data-lui="combobox" data-lui-base="buah">
  <label data-lui-part="label">Buah</label>
  <input data-lui-part="input">
  <ul data-lui-part="listbox">
    <li data-lui-part="option" data-lui-id="apel">Apel</li>
    <li data-lui-part="option" data-lui-id="pisang">Pisang</li>
  </ul>
</div>
```

`hydrate(document)` menambahkan `role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, dan id sesuai SPEC 5.6.

### Toast

```ts
import { toaster } from "lombokui/dom";

const toasts = toaster(document.querySelector("[data-lui=toast]") as HTMLElement);
toasts.show({ kind: "success", title: "Tersimpan", body: "Perubahan berhasil disimpan.", duration: 4000 });
```

Isi toast selalu ditulis sebagai teks. Toast `warning` dan `danger` memakai `role="alert"`; lainnya `role="status"`. Hover pada region menjeda timer.

### Penempatan popover

```ts
import { position } from "lombokui";

const p = position({
  reference: { x: 100, y: 10, width: 40, height: 20 },
  floating: { width: 60, height: 30 },
  placement: "top",
  boundary: { x: 0, y: 0, width: 400, height: 400 },
  arrow: 10,
});
// { x: 90, y: 30, placement: "bottom", side: "bottom", align: "center", arrow: { edge: "top", offset: 25 } }
```

Di browser, ambil `reference` dari `getBoundingClientRect()` dan `boundary` dari ukuran viewport.

### Label dalam bahasa lain

```ts
import { render } from "lombokui";

render("pagination", { page: 2, total: 9, href: "?hal={page}", labels: { previous_page: "Sebelumnya", next_page: "Berikutnya" } });
```

### Memakai mesin dari framework sendiri

```ts
import { createMachine } from "lombokui";

const sw = createMachine("switch", { idBase: "notif" });
sw.subscribe((state) => console.log(state.checked));
sw.send({ type: "keydown", key: " " }); // true
sw.attrs().control; // { id: "notif-control", role: "switch", "aria-checked": "true", tabindex: "0", "data-state": "checked" }
```

## Catatan keamanan

`contentHtml` (tabs, accordion) dan `bodyHtml` (dialog) disisipkan tanpa escape. Masukkan hanya HTML tepercaya atau yang sudah disanitasi, misalnya dengan LombokHTML. Semua props lain di-escape.
