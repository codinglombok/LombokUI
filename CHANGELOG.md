# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/); entri terbaru di depan. Versi mengikuti [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Test end-to-end di Chromium nyata (`npm run test:browser`): tabs, accordion, menu, dialog modal native, combobox, slider dengan keyboard dan pointer sungguhan.
- Gerbang coverage di CI (TypeScript `c8`, Python `coverage`) dan Dependabot.

### Fixed
- Adapter DOM slider: fokus tidak lagi lepas dari thumb ketika track diseret dengan pointer.

### Changed
- Semua GitHub Action di CI di-pin ke SHA commit.

## [0.1.0] - 2026-10-07

### Added
- 13 mesin komponen murni: `disclosure`, `accordion`, `tabs`, `listbox`, `menu`, `combobox`, `dialog`, `checkbox`, `switch`, `radiogroup`, `slider`, `tooltip`, `toast`, dengan `run`, `attrs`, `createMachine`.
- Navigasi keyboard menurut WAI-ARIA APG, termasuk `rtl`, loop, dan typeahead dengan timeout.
- `position` (placement, offset, flip, shift, panah) dan `pagination` (ellipsis dengan panjang konstan).
- `render` HTML di server untuk 13 komponen dengan nama kelas LombokCSS, ikon LombokIcons (`data-lf`), dan label `en`/`id`.
- Adapter DOM TypeScript `lombokui/dom`: `hydrate`, `mount`, `toaster`.
- Port TypeScript dan Python tanpa dependensi runtime.
- Vector bersama 366 kasus (178 golden, 188 regresi; 1791 langkah event), dijalankan kedua port; test properti, alur DOM di jsdom, dan uji mutasi (37 mutan).

### Security
- Semua teks dan atribut hasil `render` di-escape; URL berskema selain `http`, `https`, `mailto`, `tel` ditolak, termasuk bentuk yang disamarkan.
- `send` tidak pernah mengubah state masukan; masukan tak sah selalu menghasilkan `LombokUIError` dengan kode kontrak.
