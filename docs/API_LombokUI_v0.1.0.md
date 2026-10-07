# API LombokUI v0.1.0

Semantik normatif ada di `SPEC_LombokUI_v0.1.0.md`; dokumen ini hanya mendaftar antarmuka yang benar-benar diekspor. Stabilitas: 0.x, dapat berubah pada rilis minor.

## 1. TypeScript (paket `lombokui`)

| Simbol | Tanda tangan | Keterangan |
|---|---|---|
| `call` | `(fn: string, args: unknown[]) => Json` | Titik masuk kontrak (SPEC 4) |
| `FUNCTIONS` | `readonly ["attrs", "pagination", "position", "render", "run"]` | |
| `run` | `(component, options, events) => { initial, steps }` | SPEC 4 |
| `attrsAfter` | `(component, options, events = []) => Record<string, Attrs>` | Fungsi kontrak `attrs` |
| `createMachine` | `(component: string, options?) => Machine` | Pembungkus berstate |
| `Machine` | `state`, `send(event) => Effect[]`, `attrs()`, `subscribe(fn) => unsubscribe` | |
| `getComponent`, `componentNames`, `COMPONENTS` | registri komponen | Setiap `Component` memiliki `setup`, `send`, `attrs` murni |
| `position` | `(args) => PositionResult` | SPEC 6; `PLACEMENTS` |
| `pagination` | `(args) => { items, prev, next }` | SPEC 7 |
| `render` | `(component: string, props?) => string` | SPEC 8; `RENDERABLE` |
| `escapeText`, `escapeAttr`, `safeUrl` | `(s: string) => string` | SPEC 8.1, 8.3 |
| `keyMove`, `navigate`, `typeahead`, `fold`, `isCharKey` | utilitas SPEC 3 | |
| `CATALOGS`, `LABEL_KEYS`, `resolveLocale` | katalog bawaan `en`, `id` | Lang_ bagian 2 |
| `LombokUIError` | `extends Error`; `code`, `messageId` | Kode: SPEC bagian 11; `ERROR_CODES` |
| `VERSION` | `"0.1.0"` | |
| Tipe | `Attrs`, `Effect`, `Event`, `Component`, `StepOutput`, `Item`, `Json`, `Dir`, `Orientation`, `Move`, `Placement`, `Rect`, `Side`, `PageItem` | |

## 2. TypeScript (subpath `lombokui/dom`)

| Simbol | Tanda tangan | Keterangan |
|---|---|---|
| `hydrate` | `(scope: ParentNode, opts?) => Mounted[]` | Me-mount setiap `[data-lui]` yang belum ter-mount; menandai `data-lui-mounted="true"` |
| `mount` | `(root: HTMLElement, component?: string, opts?: MountOptions) => Mounted` | Nama komponen bawaan dari `data-lui` |
| `MountOptions` | `{ options?, onChange?(state, effects), timer?: Timer }` | `options` mengganti pembacaan dari markup |
| `Mounted` | `{ root, machine, send(event), destroy() }` | |
| `toaster` | `(region, opts?) => { show(input) => id, dismiss(id), destroy(), mounted }` | Membuat elemen toast sebagai teks |
| `readOptions` | `(root, component) => options` | Membaca opsi dari atribut `data-*` (SPEC 9) |
| `Timer` | `{ now(), setTimeout(fn, ms), clearTimeout(h) }` | Dapat diganti untuk test |

Event DOM yang dipancarkan pada akar komponen: `lui:change` (`{ name, value }`), `lui:select` (`{ id }`), `lui:dismiss` (`{ id, reason }`), `lui:action` (`{ value }`, tombol aksi dialog).

## 3. Python (paket `lombokui`)

| Simbol | Keterangan |
|---|---|
| `call(fn, args)` | Titik masuk kontrak |
| `run(component, options, events)`, `attrs_after(component, options, events=None)` | SPEC 4 |
| `create_machine(component, options=None)`, `Machine` | `state`, `send(event)`, `attrs()`, `subscribe(fn)` |
| `get_component`, `component_names`, `COMPONENTS` | Registri; setiap komponen memiliki `setup`, `send`, `attrs` |
| `position(args)`, `PLACEMENTS` | SPEC 6 |
| `pagination(args)` | SPEC 7 |
| `render(component, props=None)`, `RENDERABLE` | SPEC 8 |
| `escape_text`, `escape_attr`, `safe_url` | SPEC 8.1, 8.3 |
| `key_move`, `navigate`, `typeahead`, `fold`, `is_char_key`, `filter_items` | SPEC 3 dan 5.6 |
| `CATALOGS`, `LABEL_KEYS`, `resolve_locale` | |
| `LombokUIError` | `code`, `message_id` |
| `__version__`, `VERSION` | `"0.1.0"` |

Nama kunci opsi, event, state, dan props sama dengan TypeScript (camelCase, misalnya `idBase`, `typeaheadTimeout`) karena merupakan data kontrak.

## 4. Port lain

Belum ada.

## 5. Kompatibilitas lintas bahasa

Untuk masukan yang sama, TypeScript dan Python menghasilkan keluaran identik pada seluruh vector (366 kasus); string `render` identik byte demi byte.
