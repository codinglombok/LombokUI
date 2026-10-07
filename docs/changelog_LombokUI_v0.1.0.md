# Changelog LombokUI (ringkasan)

Entri terbaru di depan. Rincian ada di `CHANGELOG.md`.

## 0.1.0 - 2026-10-07

### Added
- 13 mesin komponen murni mengikuti WAI-ARIA APG; `run`, `attrs`, `createMachine`.
- `position`, `pagination`, dan `render` HTML di server dengan nama kelas LombokCSS.
- Adapter DOM TypeScript (`hydrate`, `mount`, `toaster`).
- Port TypeScript dan Python; vector 366 kasus; test properti, jsdom, dan uji mutasi.

### Security
- Escape menyeluruh pada `render`; daftar izin skema URL; transisi tidak mengubah state masukan.
