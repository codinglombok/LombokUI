# Map LombokUI v0.1.0

## 1. Posisi dependensi

Cluster 01 Frontend, UI dan Visualisasi. Peta LombokIcons v0.2.0 mencatat LombokUI sebagai L1 yang memakai LombokCSS, LombokIcons, dan LombokAnimate. Pada 0.1.0 ketiganya dipakai lewat **kontrak markup**, bukan impor kode, sehingga LombokUI tetap tanpa dependensi Lombok wajib dan dapat dipasang sendiri. Nomor katalog dan posisi cluster mengikuti dokumen induk ekosistem v3.6 (tidak di-commit, ADR-024).

```
L0  LombokCSS ----- nama kelas (btn, tabs, dropdown, modal, ...) dan token --lc-* ----+
L0  LombokIcons --- <i data-lf="nama">, diganti replaceIcons() -----------------------+--> L1 LombokUI
L0  LombokAnimate - (rencana 0.2) transisi masuk/keluar lewat data-state -------------+       |
L0  LombokLocale -- (opsional) resolve messageId dan label lewat katalog yang sama ---+       |
L1  LombokValidator (opsional) teks galat untuk props field.error --------------------+       |
L0  LombokHTML ---- (disarankan) sanitasi contentHtml dan bodyHtml -------------------+       v
                                                              aplikasi, framework, LombokCharts, ...
dependensi wajib    : (tidak ada)
dependensi opsional : (tidak ada yang diimpor; integrasi lewat markup dan messageId)
dependensi dev      : typescript, @types/node, jsdom, @types/jsdom (TS); unittest bawaan Python
```

### 1.1 Kebijakan dependensi dan salinan kode

Berlaku untuk LombokUI dan setiap library baru di bagian 3:

1. **Mandiri dan kuat.** Library MUST dapat dipasang dan dipakai sendiri, lulus seluruh vector-nya sendiri, dan tidak bergantung pada library di luar Lombok Ecosystem saat runtime.
2. **Dependensi hanya dari Lombok Ecosystem.** Dependensi runtime MAY ditambahkan bila berasal dari Lombok Ecosystem dan sudah terbit di registry (bukan `file:`, `link:`, atau path ke repo lain). Dependensi pihak ketiga hanya boleh sebagai dev-dependency.
3. **Salinan kode (vendoring) diizinkan.** Kode dari library Lombok MAY disalin ke dalam library ini bila dependensi penuh terlalu berat atau belum terbit, dengan syarat: (a) salinan ditaruh di modul tersendiri dan diberi kepala berkas yang mencatat repo asal, versi, commit, dan lisensi; (b) salinan dicatat di tabel 1.2; (c) kasus vector library asal yang relevan ikut dijalankan untuk membuktikan perilaku salinan tetap sama; (d) perbaikan dilakukan di library asal dulu, lalu disalin ulang.
4. **Pilihan per kasus.** Untuk setiap library Lombok yang dibutuhkan, pilihannya adalah kontrak markup (seperti LombokCSS dan LombokIcons pada 0.1.0), salinan kode, atau dependensi registry, dan pilihan itu dicatat di tabel bagian 2.

### 1.2 Kode salinan

| Modul | Asal | Versi/commit | Lisensi | Bukti kesetaraan |
|---|---|---|---|---|
| (belum ada pada 0.1.0) | - | - | - | - |

Kandidat salinan pertama: data path ikon `x` dan `chevron-down` dari LombokIcons agar `render` dapat menulis SVG langsung tanpa JavaScript, dan `direction(tag)` dari LombokLocale setelah API tersebut tersedia.

## 2. Library yang dibutuhkan LombokUI: yang sudah ada

Status diambil dari isi repo pada 2026-10-07. "Selaras v3.6" berarti repo memuat 10 dokumen publik, SPEC normatif, vector, dan `lombok-doctor`.

| Library | Tingkat | Versi dan status | Dipakai LombokUI untuk | Integrasi pada 0.1.0 | Saran perubahan |
|---|---|---|---|---|---|
| LombokCSS | L0 | 0.1.12, belum selaras v3.6 (lisensi MIT saja, belum ada SPEC, vector, dan dokumen standar) | Tampilan semua komponen | `render` menulis kelas LombokCSS (`btn`, `badge`, `alert`, `field`, `check`, `switch`, `progress`, `breadcrumb`, `pagination`, `tabs`, `tab-panel`, `accordion`, `modal`, `dropdown`) | (a) Tambah gaya untuk accordion berbasis tombol APG (`.accordion-trigger`, `.accordion-body`), saat ini hanya `details/summary`; (b) gaya `[role=option][data-highlighted]`, `[role=menuitem][data-highlighted]`, `[role=tooltip]`, `.toast[data-kind]`, slider dengan `--lui-value-percent`; (c) jadikan `lombok.js` lapisan tipis di atas `lombokui/dom` agar perilaku tidak diimplementasikan dua kali; (d) selaraskan ke v3.6 dengan SPEC kontrak nama kelas dan vector snapshot markup |
| LombokIcons | L0 | 0.2.0, selaras v3.6 | Ikon tombol, penutup dialog, panah menu | `<i data-lf="x">` dan `<i data-lf="chevron-down">`; `replaceIcons()` mengganti saat runtime | Port `renderIcon` ke Python dan PHP agar SSR dapat menulis SVG langsung tanpa JavaScript |
| LombokAnimate | L0 | 0.1.0, belum selaras v3.6 | Transisi buka/tutup dialog, menu, toast | Belum dipakai; komponen menulis `data-state` yang dapat menjadi pemicu CSS | API "presence" (menunggu `animationend` sebelum `hidden`), hormati `prefers-reduced-motion`, selaraskan v3.6 |
| LombokLocale | L0 | 0.2.0, selaras v3.6 (CLDR 47) | Label bawaan, pesan galat, teks nilai slider | Format `messageId` sama (`lombokui.<jenis>.<kode>`); katalog `locales/` dapat di-resolve oleh LombokLocale | Tambah `direction(tag)` (ltr/rtl) untuk opsi `dir`, dan pelipatan huruf sadar locale untuk typeahead dan filter combobox |
| LombokValidator | L1 | 0.1.0, belum memiliki dokumen standar | Pesan galat field | Teks hasil resolve dimasukkan ke `field.error` | Fungsi pembantu `fieldProps(result)` yang menghasilkan `error` dan `aria-invalid` |
| LombokHTML | L0 | 0.2.0, selaras v3.6 | Sanitasi HTML mentah | Didokumentasikan sebagai pasangan untuk `contentHtml` dan `bodyHtml` | Tidak ada perubahan; vector escape LombokUI dapat dipakai sebagai uji silang |
| LombokAlgoritma | L0 | 0.2.0 | Pencocokan kabur untuk combobox dan command palette | Belum dipakai (filter 0.1.0: `contains`, `startsWith`) | Fungsi skor fuzzy deterministik yang dapat dipanggil dari filter |
| LombokFuzzer | L0 | 0.3.0 | Fuzz masukan render dan event | Belum dipakai (pseudo-fuzz internal) | Target fuzz untuk `call` |
| LombokCharts | L0 | 0.1.10, selaras v3.4 | Pemakai, bukan dependensi | - | Memakai `position` LombokUI untuk tooltip grafik |
| LombokTableSheet | - | 1.0.1 | Pemakai potensial (grid data) | - | Memakai pola grid LombokUI setelah tersedia (rencana 0.3) |

## 3. Library yang perlu dibuat

Setiap usulan di bawah bersifat mandiri, murni (tanpa I/O, jam dan keacakan dari pemanggil), dan dapat di-port ke semua bahasa ekosistem dengan vector bersama. Kolom "Status" menunjukkan apakah inti library itu sudah ada sebagai modul di dalam LombokUI 0.1.0 dan siap diekstrak.

| Usulan | Tingkat | Isi | Mengapa dibutuhkan | Status | Pemakai lain |
|---|---|---|---|---|---|
| LombokPosition | L0 | Penempatan elemen mengambang: 12 placement, offset, flip, shift, panah; berikutnya `size`, `autoPlacement`, elemen virtual, kontainer gulir | Popover, menu, tooltip, combobox | Modul `position` (SPEC bagian 6, 44 kasus vector) siap diekstrak | LombokCharts, editor dokumen, aplikasi kanvas |
| LombokFocus (a11y) | L0 | Focus scope dan trap, roving tabindex, `inert`, live announcer, perhitungan nama aksesibel (AccName 1.2) untuk pengujian | Semua komponen interaktif | Sebagian di `lombokui/dom` (trap, restore) | Semua UI ekosistem |
| LombokTokens | L0 | Design token format W3C DTCG ke CSS custom properties, JSON, dan platform native; ruang warna OKLCH; kontras WCAG 2.2 dan APCA | Tema konsisten antara CSS, grafik, dan dokumen | Belum ada | LombokCSS, LombokCharts, LombokIcons, generator dokumen |
| LombokKeys | L0 | Parsing dan pencocokan shortcut keyboard (`Mod+K` = Cmd/Ctrl), chord berurutan, normalisasi `key`/`code` | Command palette, menubar, aplikasi | Belum ada (LombokUI 0.1.0 hanya memetakan tombol navigasi, SPEC 3.1) | Editor, CLI TUI |
| LombokVirtual | L0 | Matematika windowing untuk daftar dan grid berukuran variabel | Listbox dan tabel dengan ribuan baris | Belum ada | LombokTableSheet, LombokCharts (legenda panjang) |
| LombokCalendar | L1 (LombokLocale) | Grid kalender, awal minggu per locale, minggu ISO, rentang tanggal | Date picker | Belum ada | Form, penjadwalan |
| LombokForm | L1 (LombokValidator, LombokLocale) | State form (dirty, touched, submit), field array, pemetaan constraint validation | Form yang memakai `field` | Belum ada | Aplikasi web dan server |
| LombokMachine | L0 | Runtime statechart deterministik (subset SCXML) dengan vector | Logika aplikasi di luar komponen; ekspresi ulang mesin LombokUI secara deklaratif | Belum ada; mesin LombokUI 0.1.0 ditulis tangan | Alur kerja, wizard |

Urutan ekstraksi yang disarankan: LombokPosition (paling matang), LombokFocus, LombokTokens, lalu yang lain sesuai kebutuhan komponen 0.2 dan 0.3 (`development_ide_` bagian 1). Setelah ekstraksi, LombokUI memakai library tersebut sebagai dependensi registry atau sebagai salinan kode menurut bagian 1.1, lalu naik resmi ke L1.

## 4. Contoh dependen di ekosistem

Bagian ini satu-satunya tempat nama aplikasi atau framework boleh muncul (ADR-019). Ini ilustrasi, bukan kepemilikan; siapa pun dapat memakai LombokUI.

| Pemakai | Jenis | Pemakaian | Status integrasi |
|---|---|---|---|
| LombokClarion | Framework PHP | Komponen panel admin dengan SSR | rencana; menunggu port PHP (0.2) |
| LombokRAGDash | Aplikasi | Dialog, menu, toast, tabs dasbor | rencana |
| LombokDocFlow | Aplikasi | Antarmuka penyunting dokumen (popover, combobox) | rencana |
| LombokCharts | Library | Tooltip grafik lewat `position` | rencana |
| LombokCSS | Library | `lombok.js` digantikan atau dibungkus `lombokui/dom` | usulan (bagian 2) |

## 5. Peta fitur x port

| Fitur | TypeScript | Python | PHP | Go | Rust |
|---|---|---|---|---|---|
| 13 mesin komponen (SPEC 5) | YA | YA | rencana 0.2 | rencana 0.3 | rencana 0.3 (`no_std`, WASM) |
| position, pagination (SPEC 6-7) | YA | YA | rencana 0.2 | rencana 0.3 | rencana 0.3 |
| render SSR (SPEC 8) | YA | YA | rencana 0.2 | rencana 0.3 | - |
| adapter DOM (SPEC 9) | YA | - | - | - | - |
| vector | 366/366 | 366/366 | - | - | - |

Mesin komponen dan position tidak bergantung pada DOM, sehingga juga dapat menggerakkan UI native (Kotlin/Compose, Swift/SwiftUI) sebagai sumber state aksesibilitas; port tersebut belum direncanakan.

## 6. Jalur kontrak normatif

`docs/SPEC_LombokUI_v0.1.0.md` -> `vectors/lombokui-vectors-v1.json` (sha256 di SPEC) -> runner `typescript/test/vectors.test.ts` dan `python/tests/test_vectors.py`.

## 7. Peta folder

Lihat `structure_repo_LombokUI_v0.1.0.md`.

*Lisensi dokumen: Apache-2.0 OR MIT - (c) codinglombok*
