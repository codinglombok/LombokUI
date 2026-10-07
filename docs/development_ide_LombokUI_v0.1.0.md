# Development IDE LombokUI v0.1.0

## 1. Roadmap

| Versi | Isi |
|---|---|
| 0.1.1 | Tutup syarat rilis: CI dijalankan, action di-pin SHA, coverage diukur, uji di browser nyata (Playwright: Chromium, Firefox, WebKit) dan pembaca layar (NVDA, VoiceOver) |
| 0.2.0 | Port PHP (mesin, position, pagination, render); komponen `popover`, `select` (trigger + listbox), `toolbar`, `toggle-group`, `navigation-menu`, `drawer`; submenu; transisi lewat LombokAnimate; gaya pendamping di LombokCSS |
| 0.3.0 | Port Go dan Rust (`no_std`, WASM); `tree`, `grid` (dengan LombokVirtual), `menubar`, `date-picker` (dengan LombokCalendar), `number-field`, slider multi-thumb, command palette (filter fuzzy dari LombokAlgoritma) |
| 0.4.0 | Ekstraksi `position` menjadi LombokPosition dan manajemen fokus menjadi LombokFocus (`map_` bagian 3); LombokUI menjadi L1 resmi |

## 2. Deferred scope

Lihat SPEC bagian 12 (Non-goals) dan README (Batasan).

## 3. Prinsip desain kontributor

- Kontrak dulu, test dulu; semua port lulus vector yang sama dan string `render` identik byte demi byte.
- Tidak ada dependensi runtime; dev-dependency dicatat di `map_`.
- Fungsi inti murni: jam, keacakan, ukuran elemen, dan I/O dipasok pemanggil.
- Setiap perilaku keyboard mengikuti pola WAI-ARIA APG dan dicakup kasus golden.
- Adapter tidak menambah semantik; semua keputusan ada di mesin.
- Teks pengguna selalu di-escape; HTML mentah hanya lewat props yang namanya berakhiran `Html`.

## 4. Cara berkontribusi

Lihat `CONTRIBUTING.md`.

## 5. Pertanyaan terbuka

- Apakah item disabled pada menu dan listbox sebaiknya tetap dapat difokuskan (APG mengizinkan keduanya)? 0.1.0 melewatinya.
- Apakah `combobox` sebaiknya mendukung mode autocomplete `both` (sisipan inline)?
- Apakah `render` sebaiknya menghasilkan SVG ikon langsung bila port LombokIcons untuk bahasa server tersedia?
