# SPEC LombokUI v0.1.0

This document is the normative cross-language contract. Every language port MUST produce byte-identical output for all specified inputs. Deviations from this specification are bugs.

Key words MUST, MUST NOT, SHOULD and MAY are interpreted as in RFC 2119 and RFC 8174.

| Atribut | Nilai |
|---|---|
| Versi kontrak | 0.1.0 |
| Tanggal tinjauan standar acuan | 2026-10-07 |
| Vector | `vectors/lombokui-vectors-v1.json` |
| SHA-256 vector | `104506310e036f48fd43d8ed4c9462ed6e82021bc3c77df2a1cba8c84401cab6` |

## 0. Standar acuan (U2)

| Acuan | Versi | Pemakaian |
|---|---|---|
| WAI-ARIA | 1.2 (W3C Recommendation, Juni 2023) | Role, state dan property pada atribut (bagian 5) |
| WAI-ARIA Authoring Practices Guide (APG) | Pola terbitan 2024 | Perilaku keyboard dan fokus setiap komponen |
| WCAG | 2.2 (W3C Recommendation, Oktober 2023) | Kriteria 2.1.1 Keyboard, 2.4.3 Focus Order, 2.4.7 Focus Visible, 4.1.2 Name, Role, Value, 4.1.3 Status Messages |
| UI Events KeyboardEvent `key` Values | W3C Working Draft terbaru | Nama tombol pada event `keydown` |
| HTML Living Standard | WHATWG, ditinjau 2026-10-07 | Escaping, atribut boolean, elemen `dialog`, atribut `hidden` |
| RFC 3986 | Januari 2005 | Sintaks skema URL (bagian 8.3) |
| BCP 47 (RFC 5646) | September 2009 | Tag locale (bagian 8.2) |
| RFC 8259 | Desember 2017 | Semua masukan dan keluaran adalah data JSON |
| IEEE 754 | 2019 | Aritmetika binary64 pada bagian 5.10, 6 dan 8.4 |
| RFC 2119, RFC 8174 | 1997, 2017 | Kata kunci normatif |

## 1. Vector

Berkas vector memuat `{ format, version, specVersion, note, groups }`. Setiap kasus memuat `name`, `fn`, `args`, dan `expect` (`{ "result": ... }` atau `{ "error": code }`). Port yang diklaim MUST menjalankan seluruh kasus lewat `call(fn, args)` dan hasilnya MUST sama secara struktural: objek dibandingkan per kunci tanpa memperhatikan urutan, angka dibandingkan per nilai (`1` sama dengan `1.0`), boolean tidak pernah sama dengan angka. String hasil `render` MUST identik byte demi byte. Hash SHA-256 berkas MUST sama dengan tabel atribut. Berkas hanya berisi karakter ASCII; karakter lain ditulis sebagai escape `\uXXXX`.

## 2. Model umum

### 2.1 Teks

Panjang string diukur dalam code point Unicode. Label item, teks event `input`, dan teks props paling panjang 1000 code point kecuali disebut lain. `fold(s)` mengganti setiap huruf ASCII `A`..`Z` dengan huruf kecilnya dan tidak mengubah karakter lain. `trim` hanya membuang spasi, tab, LF, FF, dan CR di kedua ujung.

### 2.2 Id dan item

Sebuah **id** cocok dengan `^[A-Za-z][A-Za-z0-9_-]{0,63}$`. Opsi `idBase` (bawaan `"lui"`) adalah id dan menjadi awalan setiap atribut `id` yang dihasilkan.

Daftar **item** adalah array berisi 1..1000 objek `{ id, label?, disabled? }`: `id` wajib dan unik, `label` string (bawaan sama dengan `id`), `disabled` boolean (bawaan `false`). Kunci lain, id ganda, atau tipe yang salah MUST `invalid_option`.

Opsi komponen adalah objek; kunci yang tidak dikenal, tipe yang salah, atau nilai di luar rentang MUST `invalid_option`. Bilangan bulat adalah angka berhingga tanpa bagian pecahan dengan nilai mutlak paling besar 2^53-1.

### 2.3 Event

Event adalah objek dengan `type` string. Setiap komponen mendaftar tipe yang diterima beserta field wajib dan opsionalnya. Tipe tidak dikenal, field tidak dikenal, field wajib yang hilang, atau field bertipe salah MUST `invalid_event`, dan state tidak berubah. Jenis field:

| Jenis | Nilai sah |
|---|---|
| `id` | string (keberadaan item diperiksa oleh komponen; item tidak ada MUST `invalid_event`) |
| `key` | string 1..32 code point, nilai `key` UI Events |
| `at` | bilangan bulat 0..2^53-1, waktu milidetik dari pemanggil |
| `bool` | boolean |
| `number` | angka berhingga |
| `text` | string paling panjang 1000 code point |
| `check` | `true`, `false`, atau `"mixed"` |
| `duration` | `null` atau bilangan bulat 1..2147483647 |
| `kind` | `"info"`, `"success"`, `"warning"`, `"danger"` |

Event `keydown` menerima field opsional `at`, `shift`, `ctrl`, `alt`, `meta`. Bila salah satu dari `ctrl`, `alt`, `meta` bernilai `true`, tombol navigasi dan karakter diabaikan kecuali disebut lain.

### 2.4 Atribut

`attrs` menghasilkan objek `part -> atribut`. Kunci part berbentuk `nama` atau `nama:idItem`. Nilai atribut berupa string, atau `true` untuk atribut boolean yang hadir (misalnya `hidden`). Atribut yang tidak berlaku tidak dicantumkan. Urutan kunci di tabel bagian 5 adalah urutan serialisasi yang dipakai `render`.

Nilai bersama: `data-state` bernilai `open`/`closed` (disclosure, accordion, menu, combobox, dialog, tooltip), `active`/`inactive` (tabs), `checked`/`unchecked`/`indeterminate` (checkbox, switch, radio).

### 2.5 Format angka

`formatNumber(v, d)` menulis `v` sebagai desimal dengan tepat `d` digit pecahan yang dibulatkan dengan benar dari nilai binary64, lalu membuang nol di belakang dan titik yang tersisa; `-0` ditulis `0`. Tidak pernah memakai notasi eksponen. `decimals(v)` adalah jumlah digit pecahan pada representasi terpendek yang round-trip dari `|v|` (0 untuk bilangan bulat), dengan notasi eksponen diperhitungkan (`1.5e-7` memiliki 8).

### 2.6 Effect

`send` mengembalikan daftar effect berurutan. Effect adalah instruksi untuk adapter, bukan perubahan state.

| Effect | Field | Arti |
|---|---|---|
| `select` | `id` | item diaktifkan (menu, combobox) |
| `change` | `name`, `value` | nilai publik berubah (`open`, `expanded`, `selected`, `checked`, `value`) |
| `focus` | `target` | pindahkan fokus ke part (`trigger`, `menu`, `initial`, `header:id`, `tab:id`, `radio:id`) |
| `restoreFocus`, `trapFocus`, `releaseFocus`, `lockScroll`, `unlockScroll` | - | manajemen fokus dan gulir dialog modal |
| `dismiss` | `id`, `reason` (`timeout`, `manual`) | toast dihapus |
| `schedule` | `at` | adapter SHOULD mengirim `tick` dengan waktu tersebut |

Urutan dalam satu transisi: `select`, `change`, lalu effect lain sesuai bagian 5, lalu `schedule`.

## 3. Navigasi dan typeahead

### 3.1 Tombol ke gerakan

`keyMove(key, orientation, dir)`: `Home` -> `first`, `End` -> `last`. Untuk orientasi `vertical` atau `both`: `ArrowDown` -> `next`, `ArrowUp` -> `prev`. Untuk `horizontal` atau `both`: `ArrowRight` -> `next` (ltr) atau `prev` (rtl), `ArrowLeft` sebaliknya. Tombol lain tidak bergerak.

### 3.2 Gerakan

`navigate(items, current, move, loop)` hanya memilih item yang tidak disabled. `first`/`last`: item enabled pertama/terakhir. `next`: item enabled pertama sesudah indeks `current`; bila tidak ada dan `loop`, item enabled pertama sebelum `current`. `prev`: simetris. Bila `current` null, `next` mencari dari awal dan `prev` dari akhir. Bila tidak ada yang memenuhi, hasilnya `current`.

### 3.3 Typeahead

Tombol karakter adalah `key` dengan tepat satu code point yang lebih besar dari U+0020, bukan U+007F, dan bukan U+0080..U+009F. Spasi tidak pernah menjadi karakter typeahead. Event dengan tombol karakter MUST memiliki `at` (selain itu `invalid_event`).

Diberikan state `{ query, queryAt }`, karakter `ch`, waktu `at`, dan `timeout`: kueri dilanjutkan bila `queryAt` tidak null, `at >= queryAt`, dan `at - queryAt < timeout`; selain itu kueri dimulai ulang dengan `ch`. Misalkan `q = fold(query)`. Bila semua code point `q` sama, jarum adalah code point pertama dan pencarian dimulai sesudah item fokus; selain itu jarum adalah `q` dan pencarian dimulai dari item fokus (inklusif, atau indeks 0 bila tidak ada fokus). Pencarian berputar satu kali ke seluruh item dan memilih item enabled pertama yang `fold(label)` diawali jarum. Tidak cocok berarti fokus tidak berubah; `query` dan `queryAt` tetap diperbarui.

## 4. Fungsi kontrak

| `fn` | `args` | Hasil |
|---|---|---|
| `run` | `[component, options, events]` | `{ initial, steps }`. `options` MUST objek (`invalid_option`), `events` MUST array (`invalid_event`), komponen tidak dikenal `invalid_component`. Setiap langkah menghasilkan `{ state, effects }` atau `{ "$error": code }`; langkah yang gagal tidak mengubah state dan skrip berlanjut |
| `attrs` | `[component, options, events?]` | Atribut setelah semua event dijalankan; event yang gagal menggagalkan seluruh panggilan |
| `position` | `[args]` | Bagian 6 |
| `pagination` | `[args]` | Bagian 7 |
| `render` | `[component, props?]` | String HTML, bagian 8 |

`send` MUST murni: state masukan tidak pernah diubah dan hasil hanya bergantung pada opsi, state, dan event.

## 5. Komponen

Setiap subbagian mendaftar opsi (selain `idBase` yang selalu diterima), state awal dengan urutan kunci, event, transisi, dan atribut. `b` berarti `idBase`.

### 5.1 disclosure

Opsi: `defaultOpen` (false), `disabled` (false). State: `{ open }`. Event: `toggle`, `open`, `close`. Bila disabled semua event diabaikan. Perubahan menghasilkan `change open`.

Atribut: `trigger` = `id: b-trigger`, `aria-expanded`, `aria-controls: b-panel`, `aria-disabled: "true"` (bila disabled), `data-state`. `panel` = `id: b-panel`, `data-state`, `hidden` (bila tertutup).

### 5.2 accordion

Opsi: `items`, `multiple` (false), `collapsible` (true), `defaultExpanded` (array id tanpa duplikat; paling banyak satu bila tidak `multiple`), `orientation` (`vertical`/`horizontal`), `dir` (`ltr`/`rtl`), `loop` (true). State: `{ expanded, focused }` dengan `expanded` berurutan sesuai item.

Event: `toggle{id}`, `focus{id}`, `blur`, `keydown{key}`. `toggle` pada item disabled diabaikan; menutup item terakhir yang terbuka saat `collapsible` false diabaikan; membuka item pada mode tunggal menutup yang lain. `keydown` tanpa fokus atau dengan modifier diabaikan; `Enter` dan spasi men-toggle item fokus; tombol gerak (bagian 3.1) memindahkan fokus dan menghasilkan `focus header:id`.

Atribut: `root` = `data-orientation`. `header:id` = `id: b-header-id`, `aria-expanded`, `aria-controls: b-panel-id`, `aria-disabled` (item disabled, atau satu-satunya item terbuka saat tidak collapsible), `data-state`. `panel:id` = `id: b-panel-id`, `role: region`, `aria-labelledby`, `data-state`, `hidden`.

### 5.3 tabs

Opsi: `items` (MUST memiliki item enabled), `defaultSelected` (id item enabled; bawaan item enabled pertama), `activation` (`automatic`/`manual`), `orientation` (`horizontal`), `dir`, `loop` (true). State: `{ selected, focused }`.

Event: `select{id}` (item enabled: memilih dan memfokuskan), `focus{id}`, `blur`, `keydown{key}`. Gerak memindahkan fokus (`focus tab:id`) dan, pada `automatic`, juga memilih. `Enter`/spasi memilih tab fokus. Perubahan pilihan menghasilkan `change selected` di depan effect lain.

Atribut: `tablist` = `role: tablist`, `aria-orientation`. `tab:id` = `id: b-tab-id`, `role: tab`, `aria-selected`, `aria-controls`, `aria-disabled`, `tabindex` (`"0"` untuk tab fokus, atau tab terpilih bila tidak ada fokus; `"-1"` lainnya), `data-state`. `panel:id` = `id: b-panel-id`, `role: tabpanel`, `aria-labelledby`, `tabindex: "0"`, `data-state`, `hidden`.

### 5.4 listbox

Opsi: `items`, `multiple` (false), `defaultSelected` (array id), `orientation` (`vertical`), `dir`, `loop` (false), `selectionFollowsFocus` (false; MUST false bila `multiple`), `typeaheadTimeout` (0..60000, 500). State: `{ focused, selected, query, queryAt }`.

Event: `focus` (fokus ke item terpilih pertama, atau item enabled pertama, bila belum ada fokus), `blur` (fokus dan kueri dihapus), `highlight{id}` (fokus tanpa memilih), `select{id}` (memilih: mode tunggal mengganti, mode jamak men-toggle), `keydown`. Pada `keydown` dengan fokus: `Ctrl`/`Meta` + `a` pada mode jamak memilih semua item enabled, atau mengosongkan pilihan bila semuanya sudah terpilih; gerak memindahkan fokus (memilih juga bila `selectionFollowsFocus`); spasi dan `Enter` memilih item fokus; karakter menjalankan typeahead. Gerak, `highlight`, `select`, dan typeahead tidak pernah memfokuskan item disabled; item disabled di `defaultSelected` tetap terpilih. Perubahan pilihan menghasilkan `change selected`.

Atribut: `listbox` = `id: b-listbox`, `role: listbox`, `aria-multiselectable` (jamak), `aria-orientation`, `aria-activedescendant` (bila ada fokus), `tabindex: "0"`. `option:id` = `id: b-option-id`, `role: option`, `aria-selected`, `aria-disabled`, `data-highlighted` (boolean, item fokus).

### 5.5 menu

Opsi: `items`, `loop` (true), `typeaheadTimeout` (500). State: `{ open, focused, query, queryAt }`; menu tertutup selalu `{ false, null, "", null }`.

Event dan transisi:

- `triggerClick`: tertutup -> terbuka di item enabled pertama (`change open`, `focus menu`); terbuka -> tertutup (`change open`, `focus trigger`).
- `triggerKeydown{key}`: `ArrowDown`, `Enter`, spasi membuka di item pertama; `ArrowUp` di item terakhir.
- `keydown` (hanya saat terbuka): `Escape` menutup dan mengembalikan fokus; `Tab` menutup tanpa effect fokus; `Enter`/spasi mengaktifkan item fokus (`select id`, `change open`, `focus trigger`); gerak vertikal; karakter menjalankan typeahead.
- `highlight{id}` dan `itemClick{id}`: diabaikan bila tertutup atau item disabled; `itemClick` mengaktifkan.
- `outsideClick`, `close`: menutup tanpa effect fokus.

Atribut: `trigger` = `id: b-trigger`, `aria-haspopup: menu`, `aria-expanded`, `aria-controls: b-menu`, `data-state`. `menu` = `id: b-menu`, `role: menu`, `aria-labelledby: b-trigger`, `aria-activedescendant` (terbuka dan ada fokus), `tabindex: "-1"`, `data-state`, `hidden`. `item:id` = `id: b-item-id`, `role: menuitem`, `aria-disabled`, `tabindex: "-1"`, `data-highlighted`.

### 5.6 combobox

Opsi: `items`, `defaultSelected` (id atau null; mengisi `inputValue` dengan label item), `filter` (`contains`/`startsWith`/`none`), `loop` (true). State: `{ inputValue, open, active, selected, visible }`.

`visible(value)`: semua item bila filter `none` atau `fold(value)` kosong; selain itu item yang `fold(label)` memuat (`contains`) atau diawali (`startsWith`) `fold(value)`, dalam urutan item.

Event dan transisi:

- `input{value}`: `inputValue` diganti, `visible` dihitung ulang, `open` = `visible` tidak kosong, `active` null.
- `open`: `visible` dihitung ulang, `open` = `visible` tidak kosong. `close`, `blur`: `open` false, `active` null.
- `keydown` (diabaikan dengan `ctrl` atau `meta`): `ArrowDown`/`ArrowUp` saat tertutup membuka bila ada item terlihat, dengan `active` item enabled terlihat pertama/terakhir (null bila `alt`); saat terbuka (tanpa `alt`) bergerak di antara item enabled terlihat. `Enter` saat terbuka dengan `active` melakukan commit. `Escape` saat terbuka menutup; saat tertutup dengan `inputValue` tidak kosong mengosongkan `inputValue` dan `selected`. `Tab` menutup.
- `highlight{id}` dan `select{id}`: diabaikan bila tertutup, item disabled, atau tidak terlihat; `select` melakukan commit.
- Commit item: `select id`, `selected` = id, `inputValue` = label, `open` false, `active` null, `visible` dihitung ulang.

Effect sesudah `select`: `change selected` lalu `change open`, masing-masing bila berubah.

Atribut: `label` = `id: b-label`, `for: b-input`. `input` = `id: b-input`, `role: combobox`, `aria-expanded`, `aria-controls: b-listbox`, `aria-autocomplete: list`, `aria-activedescendant`, `autocomplete: off`, `data-state`. `listbox` = `id: b-listbox`, `role: listbox`, `aria-labelledby: b-label`, `data-state`, `hidden`. `option:id` (semua item) = `id: b-option-id`, `role: option`, `aria-selected`, `aria-disabled`, `data-highlighted`, `hidden` (tidak terlihat).

### 5.7 dialog

Opsi: `role` (`dialog`/`alertdialog`), `modal` (true), `defaultOpen` (false), `closeOnEscape` (true), `closeOnOutsideClick` (true untuk `dialog`, false untuk `alertdialog`), `description` (true). State: `{ open }`.

Event: `open`, `close`, `escape`, `outsideClick` (dua terakhir hanya bila diizinkan opsi). Membuka: `change open`, lalu (modal) `lockScroll`, `trapFocus`, lalu `focus initial`. Menutup: `change open`, lalu (modal) `releaseFocus`, `unlockScroll`, lalu `restoreFocus`.

Atribut: `trigger` = `aria-haspopup: dialog`, `aria-expanded`, `aria-controls: b-dialog`, `data-state`. `dialog` = `id: b-dialog`, `role`, `aria-modal: "true"` (modal), `aria-labelledby: b-title`, `aria-describedby: b-description` (bila `description`), `tabindex: "-1"`, `data-state`, `hidden`. `title` = `id: b-title`. `description` = `id: b-description` (bila `description`).

### 5.8 checkbox dan switch

Opsi: `defaultChecked` (checkbox: `true`/`false`/`"mixed"`; switch: boolean), `disabled`. State: `{ checked }`.

Event: `toggle`, `set{checked}` (`"mixed"` pada switch MUST `invalid_event`), `keydown{key}` (checkbox: spasi; switch: spasi atau `Enter`). Toggle: `"mixed"` -> `true`, `true` -> `false`, `false` -> `true`. Disabled mengabaikan semua event yang valid.

Atribut: `control` = `id: b-control`, `role` (`checkbox`/`switch`), `aria-checked` (`true`/`false`/`mixed`), `aria-disabled`, `tabindex` (`"-1"` bila disabled, selain itu `"0"`), `data-state`.

### 5.9 radiogroup

Opsi: `items`, `defaultValue` (id item enabled atau null), `dir`, `loop` (true), `disabled` (false). State: `{ value, focused }`.

Event: `select{id}`, `focus{id}`, `blur`, `keydown{key}`. Gerak memakai orientasi `both`: berpindah ke radio enabled berikutnya/sebelumnya sekaligus mencentangnya (`change value`, lalu `focus radio:id` bila berpindah). Spasi mencentang radio fokus. Grup disabled mengabaikan `select` dan `keydown`.

Atribut: `group` = `role: radiogroup`, `aria-disabled`. `radio:id` = `id: b-radio-id`, `role: radio`, `aria-checked`, `aria-disabled`, `tabindex` (`"0"` untuk radio fokus, atau yang tercentang, atau item enabled pertama; `"-1"` lainnya dan semua bila grup disabled), `data-state`.

### 5.10 slider

Opsi: `min` (0), `max` (100, MUST lebih besar dari `min`), `step` (1, MUST positif), `largeStep` (opsional, positif), `defaultValue` (`min`), `orientation` (`horizontal`), `dir`, `disabled`. State: `{ value }`.

Aritmetika grid: `d = max(decimals(min), decimals(max), decimals(step), decimals(largeStep))` dan MUST paling besar 10; `D = 10^d`; `mi`, `ma`, `st` adalah `min*D`, `max*D`, `step*D` yang dibulatkan ke bilangan bulat terdekat, dan `|mi|`, `|ma|`, `st` MUST paling besar 2^52. `kmax = (ma - mi - ((ma - mi) mod st)) / st`. Nilai langkah ke-k adalah `(mi + k*st) / D` (pembagian binary64). `snap(v) = clamp(floor((v*D - mi)/st + 0.5), 0, kmax)`. Langkah besar `kl` adalah `floor(largeStep*D/st + 0.5)` (MUST paling kecil 1) atau, bila tidak diberikan, `max(1, floor(kmax/10))`. Nilai di luar grid tidak pernah dihasilkan; `max` yang tidak berada di grid tidak tercapai.

Event: `set{value}` (snap), `keydown{key}`: `ArrowUp` +1, `ArrowDown` -1, `ArrowRight` +1 dan `ArrowLeft` -1 (dibalik bila horizontal rtl), `PageUp`/`PageDown` +-kl, `Home` 0, `End` kmax; hasil di-clamp. Perubahan menghasilkan `change value`.

Atribut: `thumb` = `id: b-thumb`, `role: slider`, `aria-valuemin`, `aria-valuemax` (nilai langkah kmax), `aria-valuenow`, `aria-orientation`, `aria-disabled`, `tabindex`, `data-orientation`. Nilai ditulis dengan `formatNumber(v, d)`.

### 5.11 tooltip

Opsi: `openDelay` (0..60000, 700), `closeDelay` (0..60000, 300). State: `{ open, pending, dueAt }` dengan `pending` null, `"open"`, atau `"close"`.

Event: `pointerEnter{at}`: terbuka atau `openDelay` 0 -> terbuka sekarang (membatalkan penutupan tertunda); selain itu membuka tertunda sampai `at + openDelay` (tidak diulang bila sudah tertunda). `pointerLeave{at}`: tertutup atau `closeDelay` 0 -> tertutup sekarang (membatalkan pembukaan tertunda); selain itu menutup tertunda. `focus` membuka sekarang; `blur` dan `escape` menutup sekarang. `tick{at}` menerapkan aksi tertunda bila `at >= dueAt`. Perubahan `open` menghasilkan `change open`; `dueAt` baru menghasilkan `schedule`.

Atribut: `trigger` = `aria-describedby: b-tooltip` (hanya saat terbuka), `data-state`. `tooltip` = `id: b-tooltip`, `role: tooltip`, `data-state`, `hidden`.

### 5.12 toast

Opsi: `max` (1..100, 3), `defaultDuration` (null atau 1..2147483647, 5000). State: `{ items, paused }`, item `{ id, kind, remaining, deadline }`. Hanya `max` item pertama yang terlihat dan berjalan; item `remaining` null bersifat persisten.

Aktivasi pada waktu `at` (bila tidak `paused`): setiap item terlihat dengan `remaining` tidak null dan `deadline` null mendapat `deadline = at + remaining`.

Event: `add{id, at, kind?, duration?}` (id MUST unik di antrean; `duration` tidak ada berarti `defaultDuration`) lalu aktivasi. `dismiss{id, at}` menghapus item bila ada (`dismiss manual`) lalu aktivasi. `pause{at}`: `remaining = max(0, deadline - at)` dan `deadline` null untuk item berjalan. `resume{at}`: aktivasi. `tick{at}`: item terlihat dengan `at >= deadline` dihapus (`dismiss timeout`) lalu aktivasi. `clear`: semua dihapus (`dismiss manual`). Bila deadline paling awal berubah dan tidak null, ditambahkan `schedule`.

Atribut: `region` = `id: b-region`, `role: region`, `tabindex: "-1"`, `data-paused`. `toast:id` = `id: b-toast-id`, `role` (`alert` untuk warning/danger, `status` lainnya), `aria-live` (`assertive`/`polite`), `aria-atomic: "true"`, `data-kind`, `hidden` (item antre).

## 6. position

Argumen: `reference` `{x, y, width, height}`, `floating` `{width, height}` (ukuran tidak negatif, semua angka berhingga), `placement` (salah satu dari 12: `top`, `bottom`, `left`, `right`, masing-masing dengan atau tanpa `-start`/`-end`; bawaan `bottom`), `offset` (0), `flip` (true), `shift` (true), `padding` (0), `boundary` (rect atau null), `arrow` (ukuran panah atau null), `arrowPadding` (0), `dir` (`ltr`). Kunci lain MUST `invalid_option`.

1. Koordinat sisi `s`: `top` y = ref.y - fl.height - offset; `bottom` y = ref.y + ref.height + offset; `left` x = ref.x - fl.width - offset; `right` x = ref.x + ref.width + offset. Sumbu silang: tengah = ref + ref.size/2 - fl.size/2, `start` = ref.x atau ref.y, `end` = ref + ref.size - fl.size. Untuk `top`/`bottom` dengan `dir` rtl, `start` dan `end` ditukar.
2. Overflow sisi utama terhadap boundary dengan padding: `top` b.y + padding - y; `bottom` y + fl.height - (b.y + b.height - padding); `left`, `right` simetris.
3. Flip (bila `flip` dan ada boundary): bila overflow sisi semula > 0 dan overflow sisi berlawanan lebih kecil secara ketat, dipakai sisi berlawanan.
4. Shift (bila `shift` dan ada boundary): koordinat sumbu silang = max(lo, min(v, hi)) dengan lo = b + padding dan hi = b + b.size - padding - fl.size.
5. Panah: offset = max(arrowPadding, min(pusatRef - posisi - arrow/2, fl.size - arrowPadding - arrow)) pada sumbu silang; `edge` adalah sisi berlawanan dari sisi akhir.

Hasil: `{ x, y, placement, side, align, arrow }` dengan `align` `start`, `end`, atau `center` dan `arrow` `{ edge, offset }` atau null. Operasi dikerjakan dalam binary64 dengan urutan di atas.

## 7. pagination

Argumen: `total` (wajib, 1..2147483647), `page` (1..total, bawaan 1), `siblings` (0..10, 1), `boundaries` (0..10, 1). Dengan s = siblings dan b = boundaries:

```
startPages = 1..min(b, total)
endPages   = max(total-b+1, b+1)..total
sibStart   = max(min(page-s, total-b-2s-1), b+2)
sibEnd     = min(max(page+s, b+2s+2), (endPages kosong ? total-1 : endPages[0]-2))
items = startPages
      + (sibStart > b+2 ? "ellipsis" : (b+1 < total-b ? [b+1] : []))
      + sibStart..sibEnd
      + (sibEnd < total-b-1 ? "ellipsis" : (total-b > b ? [total-b] : []))
      + endPages
```

Hasil `{ items, prev, next }` dengan `prev` = page-1 atau null dan `next` = page+1 atau null. Ellipsis selalu menggantikan paling sedikit dua halaman, dan untuk `total >= 2b + 2s + 3` panjang daftar konstan.

## 8. render

`render(component, props)` menghasilkan string HTML untuk komponen di tabel 8.4. Props adalah objek; kunci tidak dikenal atau nilai tidak sah MUST `invalid_props`. Galat opsi dari mesin di dalam render MUST dilaporkan sebagai `invalid_props`. Komponen yang tidak dapat di-render MUST `invalid_component`.

### 8.1 Serialisasi

Teks di-escape: `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`. Nilai atribut di-escape seperti teks, lalu `"` -> `&quot;` dan `'` -> `&#39;`. Atribut ditulis ` nama="nilai"` dalam urutan tetap, atribut boolean ditulis ` nama`, dan atribut tanpa nilai tidak ditulis. Prop `class` (paling panjang 200) di-trim (bagian 2.1) dan ditambahkan sesudah kelas bawaan. Ikon ditulis `<i data-lf="nama" aria-hidden="true"></i>` dengan nama yang cocok dengan `^[a-z0-9]+(-[a-z0-9]+)*$`.

### 8.2 Label

Komponen yang memiliki teks bawaan (`breadcrumb`, `pagination`, `dialog`) menerima `locale` (bawaan `en`) dan `labels` (objek dengan kunci `close`, `breadcrumb`, `pagination`, `previous_page`, `next_page`). Locale dipilih tanpa membedakan huruf ASCII dengan `_` dianggap `-`: tag persis, lalu subtag bahasa, lalu `en`. Katalog bawaan: `en`, `id` (Lang_ bagian 2).

### 8.3 URL

Untuk setiap `href`, salinan uji dibuat dengan membuang TAB, LF, CR, lalu membuang karakter U+0000..U+0020 di depan. Bila salinan diawali skema (`^[A-Za-z][A-Za-z0-9+.-]*:`), skema dalam huruf kecil MUST salah satu dari `http`, `https`, `mailto`, `tel`; selain itu `invalid_props`. URL relatif diterima. Yang ditulis adalah `href` asli yang di-escape.

### 8.4 Markup per komponen

Struktur dan urutan atribut yang tepat ditetapkan oleh kasus `render` di vector; ringkasannya:

| Komponen | Props | Akar |
|---|---|---|
| `button` | `label`*, `variant`, `size`, `type`, `disabled`, `block`, `icon`, `iconPosition`, `iconOnly`, `pressed`, `name`, `value`, `id`, `class` | `<button type class="btn btn-variant ...">`; `iconOnly` memakai `aria-label` |
| `badge` | `label`*, `variant`, `pill`, `class` | `<span class="badge ...">` |
| `alert` | `kind`, `title`, `body`*, `class` | `<div class="alert alert-kind" role="status|alert">` |
| `field` | `id`*, `label`*, `type`, `name`, `value`, `placeholder`, `autocomplete`, `help`, `error`, `required`, `disabled`, `readonly`, `class` | `<div class="field">` dengan `aria-describedby` ke help dan error, `aria-invalid` bila error |
| `checkbox` | `id`*, `label`*, `name`, `value`, `checked`, `disabled`, `required`, `class` | `<div class="check">` dengan input native |
| `switch` | `label`*, `id`, `name`, `value`, `checked`, `disabled`, `class` | `<label class="switch">` dengan `input role="switch"` |
| `progress` | `value`*, `max`, `label`*, `class` | `<div class="progress" role="progressbar">`; lebar `n/100` persen dengan `n = floor(value*10000/max + 0.5)`; value dan max paling banyak 6 digit desimal |
| `breadcrumb` | `items`* (`label`*, `href`), `class`, `locale`, `labels` | `<nav aria-label><ol class="breadcrumb">`; item terakhir `aria-current="page"` |
| `pagination` | `page`, `total`*, `siblings`, `boundaries`, `href` (MUST memuat `{page}`), `class`, `locale`, `labels` | `<nav aria-label><ul class="pagination">`; tanpa `href` dipakai `<button data-page>` |
| `tabs` | opsi tabs, `items` (+ `content` atau `contentHtml`), `class` | `<div class="lui-tabs" data-lui="tabs" ...>` |
| `accordion` | opsi accordion, `items` (+ konten), `headingLevel` (2..6, 3), `class` | `<div class="accordion lui-accordion" data-lui="accordion" ...>` |
| `dialog` | opsi dialog kecuali `description`, `title`*, `description`, `body` atau `bodyHtml`, `closeButton`, `trigger`, `actions`, `class`, `locale`, `labels` | `<div class="lui-dialog" data-lui="dialog">` berisi `<dialog class="modal">`; atribut `hidden` tidak ditulis pada `dialog`, dan `open` hanya ditulis untuk dialog non-modal yang `defaultOpen` |
| `menu` | opsi menu, `label`*, `items`, `variant`, `class` | `<div class="dropdown" data-lui="menu">` |

`*` = wajib. Komponen interaktif menulis atribut mesin (bagian 5) untuk state awal, ditambah `data-lui-part` dan `data-lui-id` untuk hidrasi, serta opsi ternormalisasi sebagai atribut `data-*` pada akar.

### 8.5 HTML mentah

Hanya `contentHtml` (tabs, accordion) dan `bodyHtml` (dialog) yang disisipkan tanpa escape. Pemanggil MUST hanya memasukkan HTML tepercaya atau yang sudah disanitasi.

## 9. Adapter DOM (informatif, khusus TypeScript)

`lombokui/dom` membaca `data-lui` (nama komponen), `data-lui-base`, opsi `data-*`, dan part `data-lui-part`/`data-lui-id`, lalu menerapkan bagian 5. Item dibaca dari part item (`header`, `tab`, `item`, `option`, `radio`): label dari teks, disabled dari `aria-disabled="true"` atau atribut `disabled`. Adapter tidak menambah semantik: setiap event DOM diterjemahkan menjadi event bagian 5, dan setiap effect dijalankan apa adanya. Tombol `Enter` dan spasi pada `<button>` native tidak diteruskan karena browser sudah mengubahnya menjadi `click`.

## 10. Keamanan

- Setiap teks dan nilai atribut hasil `render` MUST di-escape menurut bagian 8.1; satu-satunya pengecualian adalah bagian 8.5.
- `href` dengan skema di luar daftar izin bagian 8.3 MUST ditolak, termasuk bentuk yang disamarkan dengan huruf besar, spasi awal, TAB, atau baris baru.
- Id yang dihasilkan hanya berasal dari `idBase` dan id item yang tervalidasi (bagian 2.2), sehingga tidak dapat memuat tanda kutip atau spasi.
- Masukan apa pun MUST menghasilkan hasil atau galat dengan `code` pada bagian 11; panic, pengecualian lain, atau waktu eksekusi tak terbatas adalah bug. Ukuran masukan dibatasi (1000 item, 1000 code point per label, 2147483647 halaman).
- `send` tidak boleh mengubah state masukan, sehingga state dapat dibagikan dan diserialisasi dengan aman.

## 11. Galat

| `code` | Kondisi | `messageId` |
|---|---|---|
| `invalid_component` | nama komponen atau fungsi tidak dikenal | `lombokui.error.invalid_component` |
| `invalid_option` | opsi komponen, item, atau argumen `position`/`pagination` tidak sah | `lombokui.error.invalid_option` |
| `invalid_event` | event tidak sah, item event tidak ada, atau `events` bukan array | `lombokui.error.invalid_event` |
| `invalid_props` | props `render` tidak sah | `lombokui.error.invalid_props` |

## 12. Non-goals (0.1.0)

Case folding Unicode dan pembandingan sadar locale, seleksi rentang dengan Shift pada listbox, submenu, menu bertipe checkbox/radio, slider multi-thumb, virtualisasi daftar panjang, animasi masuk dan keluar, pengukuran DOM pada port selain TypeScript, dan komponen di luar bagian 5.

## 13. Riwayat perubahan kontrak

| Versi | Perubahan |
|---|---|
| 0.1.0 | Kontrak awal |
