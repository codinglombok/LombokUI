# LombokUI

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue)](LICENSE-APACHE)

Komponen UI **headless dan aksesibel** dengan kontrak lintas bahasa: 13 mesin state komponen mengikuti pola WAI-ARIA APG, penempatan elemen mengambang, model pagination, render HTML di server dengan nama kelas LombokCSS, dan adapter DOM yang menghidrasi markup tersebut di browser. Tanpa dependensi runtime. Perilaku TypeScript dan Python identik dan dibuktikan dengan vector bersama.

Part of the [Lombok Ecosystem](https://github.com/codinglombok).

## Mengapa library ini?

Komponen interaktif yang benar (fokus, keyboard, atribut ARIA) sulit ditulis dan biasanya terikat pada satu framework JavaScript. Server yang me-render HTML dengan Python atau bahasa lain harus menulis ulang atribut ARIA dengan tangan, dan hasilnya sering tidak cocok dengan perilaku di browser. LombokUI memisahkan perilaku dari tampilan dan dari bahasa:

- **Mesin murni.** Setiap komponen adalah fungsi `state + event -> state + effects`. Jam dipasok pemanggil, sehingga delay tooltip dan timer toast dapat diuji tanpa `sleep`.
- **Satu kontrak, banyak bahasa.** Mesin, `position`, `pagination`, dan `render` dispesifikasikan normatif dan dibuktikan dengan 366 kasus vector di setiap port.
- **SSR lalu hidrasi.** HTML dari server (bahasa apa pun) memuat atribut ARIA state awal dan atribut `data-lui-*`; `hydrate()` di browser melanjutkan dari state yang sama.
- **Aman secara bawaan.** Semua teks di-escape, URL dengan skema berbahaya (`javascript:`, `data:`) ditolak, id hanya dari karakter yang tervalidasi.

Skenario pemakaian:

- **Aplikasi web dengan render server** (Python, dan bahasa lain setelah port tersedia): menulis tabs, accordion, dialog, menu, breadcrumb, dan pagination yang langsung aksesibel.
- **Single-page app tanpa framework**: `lombokui/dom` cukup untuk dialog modal, menu, combobox, tooltip, dan toast.
- **Framework komponen sendiri**: memakai mesin sebagai inti perilaku dan menulis tampilan sendiri.
- **Pengujian aksesibilitas**: memutar skrip event dan memeriksa atribut ARIA tanpa browser.

Contoh dependen lain di ekosistem Lombok dicantumkan di `docs/map_LombokUI_v0.1.0.md`.

## Fitur

Setiap fitur di bawah ini dicakup vector di `vectors/` dan test di kedua port.

- Komponen: `disclosure`, `accordion`, `tabs`, `listbox`, `menu`, `combobox`, `dialog`, `checkbox`, `switch`, `radiogroup`, `slider`, `tooltip`, `toast`.
- Keyboard menurut APG: roving tabindex, `aria-activedescendant`, Home/End, loop, arah `rtl`, typeahead dengan timeout.
- `position`: 12 placement, offset, flip, shift, panah, `rtl`.
- `pagination`: daftar halaman dengan ellipsis yang panjangnya konstan.
- `render`: `button`, `badge`, `alert`, `field`, `checkbox`, `switch`, `progress`, `breadcrumb`, `pagination`, `tabs`, `accordion`, `dialog`, `menu`, dengan label `en` dan `id`.
- Adapter DOM (TypeScript): `hydrate`, `mount`, `toaster`; fokus, focus trap, kunci gulir, `<dialog>` native, timer.

## Instalasi

Belum terbit di registry. Setelah rilis pertama:

```bash
npm install lombokui      # TypeScript / JavaScript
pip install lombokui      # Python
```

## Quick Start

### TypeScript: mesin

```ts
import { createMachine } from "lombokui";

const tabs = createMachine("tabs", { idBase: "t", items: [{ id: "a" }, { id: "b", disabled: true }, { id: "c" }] });
tabs.send({ type: "focus", id: "a" });
tabs.send({ type: "keydown", key: "ArrowRight" });
// [{ type: "change", name: "selected", value: "c" }, { type: "focus", target: "tab:c" }]
tabs.attrs()["tab:c"];
// { id: "t-tab-c", role: "tab", "aria-selected": "true", "aria-controls": "t-panel-c", tabindex: "0", "data-state": "active" }
```

### Python: render di server

```python
import lombokui

html = lombokui.render("tabs", {"idBase": "t", "items": [
    {"id": "a", "label": "Profil", "content": "Isi profil"},
    {"id": "b", "label": "Keamanan", "content": "Isi keamanan"},
]})
```

### Browser: hidrasi

```ts
import { hydrate } from "lombokui/dom";

hydrate(document); // semua [data-lui] menjadi interaktif
```

## Status port

| Port | Status | Bukti |
|---|---|---|
| TypeScript | YA, lulus vector | `typescript/test/vectors.test.ts` menjalankan seluruh vector; ditambah test properti, alur DOM (jsdom), dan uji mutasi |
| Python | YA, lulus vector | `python/tests/test_vectors.py` menjalankan seluruh vector |
| PHP, Go, Rust | BELUM | Direncanakan (`docs/development_ide_LombokUI_v0.1.0.md`) |
| Java, Kotlin, C#, C/C++, Swift, Perl | BELUM | Tidak direncanakan pada 0.x |

Vector: 366 kasus (178 golden berekspektasi tulis tangan, 188 regresi hasil pembangkit; 1791 langkah event).

## Standar yang diimplementasikan

WAI-ARIA 1.2, pola WAI-ARIA APG, WCAG 2.2 (2.1.1, 2.4.3, 2.4.7, 4.1.2, 4.1.3), nilai `key` UI Events, HTML Living Standard (escaping, `dialog`, `hidden`), RFC 3986 (skema URL), BCP 47. Rincian di `docs/SPEC_LombokUI_v0.1.0.md` bagian 0.

## Batasan yang diketahui

- Pelipatan huruf untuk typeahead dan filter hanya ASCII; pembandingan sadar locale belum ada.
- Belum ada submenu, menu checkbox/radio, seleksi rentang Shift, slider multi-thumb, virtualisasi, dan animasi.
- Adapter DOM diuji di jsdom dan Chromium; Firefox, WebKit, dan pembaca layar belum (lihat `docs/TECH_DEBT.md`).
- Gaya untuk accordion berbasis tombol, listbox, combobox, slider, dan tooltip belum ada di LombokCSS.
- Hanya TypeScript dan Python yang memiliki kode.

## Ekosistem Lombok

LombokUI 0.1.0 tidak mengimpor library Lombok lain. Kebijakannya: dependensi runtime hanya dari Lombok Ecosystem, dan kode library Lombok boleh disalin dengan pencatatan asal dan bukti vector (`docs/map_LombokUI_v0.1.0.md` bagian 1.1). Markup memakai nama kelas LombokCSS dan atribut ikon LombokIcons, dan `messageId` dapat di-resolve dengan LombokLocale. Peta lengkap, termasuk library yang masih perlu dibuat, ada di `docs/map_LombokUI_v0.1.0.md`.

## Contributing

Lihat [CONTRIBUTING.md](CONTRIBUTING.md). Untuk melaporkan kerentanan lihat [SECURITY.md](SECURITY.md).

## Lisensi

`Apache-2.0 OR MIT`. Lihat [LICENSE-APACHE](LICENSE-APACHE) dan [LICENSE-MIT](LICENSE-MIT).
