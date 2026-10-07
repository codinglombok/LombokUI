# Vectors

`lombokui-vectors-v1.json` adalah kontrak uji lintas bahasa untuk LombokUI.

- SHA-256: `104506310e036f48fd43d8ed4c9462ed6e82021bc3c77df2a1cba8c84401cab6` (harus sama dengan `docs/SPEC_LombokUI_v0.1.0.md`).
- Dibangkitkan oleh `scripts/gen-vectors.mjs`. Grup `golden`: ekspektasi ditulis tangan dari SPEC dan dicocokkan dengan port TypeScript saat pembangkitan (pembangkit berhenti bila berbeda). Grup `generated-regression`: skrip event, argumen `position`, `pagination`, dan `render` acak berbenih; keluaran dari port TypeScript dan dikonfirmasi port Python.
- Setiap kasus memanggil fungsi `fn` dengan `args` lewat `call(fn, args)`; `expect` berbentuk `{ "result": ... }` atau `{ "error": code }`.
- Hasil dibandingkan secara struktural; string `render` dibandingkan byte demi byte.
- Berkas hanya berisi ASCII; karakter lain ditulis sebagai `\uXXXX`.
- Jumlah: 366 kasus (178 golden, 188 regresi): `run` 196, `render` 57, `position` 44, `attrs` 41, `pagination` 28; 1791 langkah event.
