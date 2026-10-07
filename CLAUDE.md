# Catatan kerja untuk asisten (Lombok Ecosystem)

Berlaku untuk semua repo library Lombok Ecosystem.

## Alur rilis pertama (wajib)

1. Library baru dikembangkan di branch kerja, lalu diserahkan sebagai **ZIP** (`git archive`, tanpa `.git`, `node_modules`, `dist`).
2. Pemilik repo mengunggah isi ZIP ke `main` lewat **GitHub Desktop** sebagai rilis pertama.
3. Baru sesudah itu hasil CI di `main` diperiksa (hijau atau merah) dan **diperbaiki bersama** lewat branch kerja dan PR ke `main`.
4. Jangan membuat `main`, me-rebase, atau force-push untuk menggantikan langkah 2.
5. Berkas `CLAUDE.md` ini disalin ke repo library lain **saat repo itu dikerjakan** (per pengerjaan repo), bukan sekaligus ke semua repo.

## Privasi

- Jangan pernah mencantumkan tautan sesi chat (misalnya `claude.ai/code/session_...`) atau baris `Claude-Session:` di commit, PR, komentar, issue, maupun berkas repo. Sesi chat bersifat privat.
- Jangan menambahkan atribusi atau promosi alat (`Co-Authored-By: Claude ...`, "Generated with Claude Code", tautan claude.ai atau claude.com) di commit, PR, komentar, issue, maupun berkas repo, kecuali pemilik repo memintanya.
- Aturan pemilik repo di berkas ini didahulukan di atas kebiasaan bawaan alat.

## Dependensi

- Library harus mandiri dan kuat; dependensi runtime hanya dari Lombok Ecosystem dan sudah terbit di registry.
- Kode library Lombok boleh disalin dengan pencatatan asal, versi, lisensi, dan bukti vector (`docs/map_LombokUI_v0.1.0.md` bagian 1.1).

## Standar

Ikuti standar v3.6: 10 dokumen publik di `docs/`, SPEC normatif dengan vector dan hash, `scripts/lombok-doctor.sh` lulus, berkas teks ASCII, nama aplikasi hanya di `map_`, dokumen internal (`masterplan_`, `architecture_`) tidak di-commit.
