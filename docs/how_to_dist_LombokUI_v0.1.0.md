# How To Dist LombokUI v0.1.0

## 1. Upload pertama (bootstrap)

Alur yang berlaku untuk semua library Lombok Ecosystem:

1. Isi repo diserahkan sebagai ZIP (`git archive --format=zip --prefix=LombokUI/ HEAD`), tanpa `.git`, `node_modules`, dan `dist`.
2. Pemilik mengekstrak ZIP, membuat repository lokal dengan branch `main` di GitHub Desktop, membuat commit pertama, lalu publish atau push ke `codinglombok/LombokUI`.
3. CI di `main` diperiksa. Perbaikan berikutnya dikerjakan bersama di branch kerja dan masuk lewat PR ke `main`.

Rilis pertama LombokUI dilakukan dengan alur ini pada 2026-10-07 (commit `c8b4310`); 13 dari 13 job CI hijau. Jangan membuat tag rilis pada tahap ini; lihat syarat di `TECH_DEBT.md`.

## 2. Alur rilis reguler

Target (ADR-011): release-please membuka PR rilis; merge PR membuat tag `vX.Y.Z`; publish membaca versi dari tag. Reusable workflow `codinglombok/.github` belum ada (TD-P0-08), sehingga `ci.yml` repo ini mandiri sementara.

## 3. Publish per registry

| Registry | Paket | Pemeriksaan pra-publish |
|---|---|---|
| npm | `lombokui` | `cd typescript && npm pack --dry-run`; publish dengan `--provenance` |
| PyPI | `lombokui` | `cd python && python -m build` lalu `twine check dist/*`; publish dengan Trusted Publishing |
| Packagist, Go, crates.io, Maven, NuGet | belum ada port | - |

Urutan: tag, CI hijau, `npm publish --provenance --access public`, publish PyPI.

## 4-7. Server, Docker, shared hosting, lokal

Library tidak dideploy. Pemakaian lokal: `npm install ./typescript` atau `pip install ./python`. Untuk halaman statis tanpa bundler, berkas `typescript/dist/src/*.js` dapat dimuat sebagai ES module.

## 8. Verifikasi

```bash
bash scripts/lombok-doctor.sh LombokUI                     # dari root repo
sha256sum vectors/lombokui-vectors-v1.json                 # harus sama dengan hash di SPEC_
git ls-files | grep -E 'architecture|masterplan'           # harus kosong (ADR-024)
```
