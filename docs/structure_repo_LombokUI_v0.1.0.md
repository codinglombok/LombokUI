# Structure Repo LombokUI v0.1.0

## 1. Struktur folder

```
LombokUI/
  README.md  CHANGELOG.md  SECURITY.md  CONTRIBUTING.md  version.txt
  LICENSE-APACHE  LICENSE-MIT  .gitignore  .gitattributes
  docs/            10 dokumen standar + TECH_DEBT.md (masterplan_ dan architecture_ tidak di-commit)
  vectors/         lombokui-vectors-v1.json  README.md
  locales/         en/lombokui.json  id/lombokui.json
  typescript/      package.json  package-lock.json  tsconfig.json  run-tests.mjs  src/  test/
    src/           index.ts contract.ts machine.ts util.ts errors.ts messages.ts
                   position.ts pagination.ts render.ts dom.ts components/*.ts
    test/          vectors.test.ts invariants.test.ts dom.test.ts docs.test.ts examples.test.ts helpers.ts
  python/          pyproject.toml  README.md  LICENSE-*  src/lombokui/  tests/test_vectors.py
  scripts/         gen-vectors.mjs  mutation-test.mjs  lombok-doctor.sh
  .github/workflows/  ci.yml
```

## 2. Konvensi penamaan

Dokumen: `<jenis>_LombokUI_v<semver>.md`. Paket: npm `lombokui` (subpath `lombokui/dom`), PyPI `lombokui`. Rencana: Packagist `codinglombok/lombokui`, Go `github.com/codinglombok/lombokui/go`, crates.io `lombokui`.

## 3. Berkas wajib di root

README, LICENSE-APACHE, LICENSE-MIT, CHANGELOG, SECURITY, CONTRIBUTING, `.gitignore` dengan tiga baris ADR-024, `version.txt`.

## 4. Struktur per port

| Port | Isi |
|---|---|
| `typescript/` | `machine.ts` (validasi event, registri, `run`, `attrsAfter`, `Machine`), `util.ts` (validasi opsi, navigasi, typeahead, format angka), `components/` (satu berkas per komponen; `toggle.ts` memuat checkbox dan switch), `position.ts`, `pagination.ts`, `render.ts`, `messages.ts`, `contract.ts` (`call`), `dom.ts` (adapter, subpath terpisah). `test/` dikompilasi bersama ke `dist/test/` |
| `python/` | Modul privat `_util`, `_machine`, `_components`, `_position`, `_pagination`, `_render`, `_messages`; API publik di `__init__.py`. Test memakai `unittest` bawaan |

## 5. Catatan

`LICENSE-*` di `python/` adalah salinan dari root agar ikut paket wheel. `typescript/` menyalin README, LICENSE, dan `locales/` saat `npm pack` (skrip `prepack`/`postpack`). Fungsi `call(fn, args)` di kedua port adalah titik masuk dinamis yang dipakai runner vector dan host FFI.
