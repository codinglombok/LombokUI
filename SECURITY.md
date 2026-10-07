# Kebijakan Keamanan

## Versi yang didukung

| Versi | Dukungan |
|---|---|
| 0.1.x | Perbaikan keamanan |

## Melaporkan kerentanan

Gunakan **GitHub Private Vulnerability Reporting** pada repo ini (tab Security, "Report a vulnerability"). Jangan membuka issue publik untuk kerentanan.

- Respons awal: paling lama 48 jam.
- Perbaikan untuk temuan kritis: target 7 hari.
- Pengungkapan dikoordinasikan dengan pelapor.

## Cakupan

Dalam cakupan:

- `render`: cara apa pun agar teks atau nilai atribut keluar dari konteksnya (XSS), atau URL berskema berbahaya lolos dari daftar izin.
- Mesin komponen dan `position`/`pagination`: masukan yang menyebabkan panic, pengecualian selain `LombokUIError`, perubahan state masukan, atau waktu eksekusi tak terbatas.
- Adapter DOM: penyisipan HTML dari data pengguna (toast dan label selalu ditulis sebagai teks).

Di luar cakupan: isi `contentHtml` dan `bodyHtml`, yang menurut kontrak disisipkan tanpa escape dan menjadi tanggung jawab pemanggil (sanitasi dengan library seperti LombokHTML).

## Model ancaman ringkas

Lihat bagian Keamanan pada `docs/SPEC_LombokUI_v0.1.0.md`.
