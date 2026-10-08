# Berkontribusi

1. **Kontrak dulu.** Perubahan perilaku dimulai dari `docs/SPEC_LombokUI_v0.1.0.md` dan `scripts/gen-vectors.mjs`, bukan dari kode.
2. **Test dulu.** Tambahkan kasus golden dengan ekspektasi yang ditulis tangan dari SPEC atau dari pola WAI-ARIA APG. Pembangkit berhenti bila port TypeScript tidak setuju.
3. **Semua port harus lulus.** Jalankan:

```bash
cd typescript && npm ci && npm test        # build + vector + properti + DOM (jsdom) + dokumen
cd .. && node scripts/gen-vectors.mjs      # setelah mengubah vector; catat sha256 baru di SPEC dan vectors/README.md
npm run coverage                           # dari typescript/: gerbang coverage
LUI_CHROMIUM=/path/ke/chrome npm run test:browser   # dari typescript/: alur di Chromium nyata
node scripts/mutation-test.mjs             # semua mutan harus terbunuh
cd python && python -m unittest discover -s tests
bash scripts/lombok-doctor.sh LombokUI     # dari root repo
```

4. Perubahan vector mengubah hash di `SPEC_`; perbarui `SPEC_`, `vectors/README.md`, `CHANGELOG.md`, dan `API_` pada PR yang sama.
5. Port baru (misalnya PHP) MUST menjalankan seluruh vector dan menghasilkan string `render` yang identik byte demi byte.
6. Pesan commit mengikuti Conventional Commits (`feat:`, `fix:`, `docs:`) dan bersifat fungsional.
7. Jangan menyertakan data nyata, nama klien, atau domain organisasi nyata di contoh, test, atau pesan commit; gunakan data sintetis dan domain `example.com`.
8. Dependensi runtime baru hanya boleh dari Lombok Ecosystem. Menyalin kode dari library Lombok diizinkan bila memenuhi `docs/map_LombokUI_v0.1.0.md` bagian 1.1 (kepala berkas asal, tabel 1.2, vector asal ikut dijalankan).
9. Dokumen berbahasa formal tanpa emoji. Berkas teks yang dilacak hanya berisi karakter ASCII; karakter lain ditulis sebagai escape.
