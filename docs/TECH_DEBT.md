# Tech Debt LombokUI

Format: ID, temuan, prioritas, perbaikan, status. Prioritas P1 memblokir rilis minor; P0 memblokir tag 0.1.0.

| ID | Temuan | Prioritas | Perbaikan | Status |
|---|---|---|---|---|
| TD-01 | Action di `ci.yml` belum di-pin SHA; Dependabot belum dikonfigurasi untuk npm dan pip | P0 | Pin SHA, tambah `dependabot.yml` | OPEN |
| TD-02 | Reusable workflow `codinglombok/.github` belum ada (TD-P0-08 ekosistem); doctor dijalankan dari salinan `scripts/lombok-doctor.sh` yang diperluas agar membaca SPDX dari `typescript/package.json` dan `python/pyproject.toml` | P0 | Pakai workflow bersama setelah tersedia dan usulkan perluasan yang sama ke skrip induk | OPEN |
| TD-03 | Adapter DOM hanya diuji di jsdom; belum di browser nyata dan pembaca layar | P0 | Test Playwright lintas browser dan uji manual NVDA/VoiceOver | OPEN |
| TD-04 | Coverage belum diukur; target 90% | P1 | Job coverage TypeScript (`c8`) dan Python (`coverage`) | OPEN |
| TD-05 | Fuzz berupa pseudo-fuzz berbenih; LombokFuzzer belum dipakai | P1 | Target fuzz untuk `call` | OPEN |
| TD-06 | Hanya TypeScript dan Python; PHP, Go, Rust BELUM | P1 | Rencana 0.2.0 dan 0.3.0 | OPEN |
| TD-07 | Gaya LombokCSS untuk accordion berbasis tombol, listbox, combobox, slider, tooltip, dan toast per jenis belum ada | P1 | PR ke LombokCSS (`map_` bagian 2) | OPEN |
| TD-08 | Kasus regresi (188) berekspektasi dari TypeScript dan dikonfirmasi Python; hanya 178 golden yang independen | P3 | Tinjau manual sebagian kasus regresi | OPEN |
| TD-09 | Salinan `LICENSE-*` di `python/` | P3 | Otomatiskan salinan saat rilis | OPEN |
| TD-10 | Kinerja belum diukur (daftar 1000 item, render besar) | P2 | Benchmark sederhana per port | OPEN |
| TD-11 | Pelipatan huruf hanya ASCII | P2 | Pakai LombokLocale setelah API tersedia | OPEN |

Sudah ditutup di 0.1.0: CI dijalankan pertama kali di `main` (commit `c8b4310`) dan 13 dari 13 job hijau; 37 mutan pada inti TypeScript terbunuh oleh vector; tidak ada karakter non-ASCII pada berkas teks yang dilacak.
