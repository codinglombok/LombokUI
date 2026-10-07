# How To Dist LombokUI v0.1.0

## 1. Upload pertama (bootstrap)

Repo `codinglombok/LombokUI` sudah dibuat kosong. Dari folder lokal berisi proyek ini:

```powershell
git init -b main
git add -A
git status            # periksa: docs/*architecture*, docs/*masterplan*, node_modules, dist TIDAK ikut
git commit -m "feat: LombokUI v0.1.0"
git remote add origin https://github.com/codinglombok/LombokUI.git
git push -u origin main
gh repo edit codinglombok/LombokUI --add-topic lombok-ecosystem --add-topic level-l1 --add-topic headless-ui --add-topic accessibility --add-topic wai-aria --add-topic typescript --add-topic python --description "Headless, accessible UI components: WAI-ARIA state machines, positioning, pagination, server-side rendering and a DOM adapter. Part of the Lombok Ecosystem."
```

Jangan membuat tag rilis pada tahap ini; lihat syarat di `TECH_DEBT.md`.

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
