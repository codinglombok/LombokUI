# Lang LombokUI v0.1.0

## 1. Tingkat i18n

Tingkat **L** (label antarmuka, pesan galat, dan dokumentasi). `render` menghasilkan teks untuk pengguna akhir pada `breadcrumb`, `pagination`, dan `dialog` (label aksesibel). Teks lain (label item, judul, isi) selalu dipasok pemanggil, sehingga sudah dalam bahasa aplikasi. Arah teks dikendalikan opsi `dir` (`ltr`/`rtl`) pada komponen yang menavigasi secara horizontal dan pada `position`.

## 2. Katalog ID pesan (normatif)

Format `lombokui.<jenis>.<kode>`. Berkas katalog: `locales/<bcp47>/lombokui.json`, satu berkas untuk semua port. Port TypeScript dan Python menyematkan salinan yang diuji sama dengan berkas tersebut.

| ID | Teks sumber (en) | Pemakaian |
|---|---|---|
| `lombokui.error.invalid_component` | The component name is unknown. | galat `invalid_component` |
| `lombokui.error.invalid_option` | A component option or function argument is invalid. | galat `invalid_option` |
| `lombokui.error.invalid_event` | The event is invalid for this component. | galat `invalid_event` |
| `lombokui.error.invalid_props` | A render property is invalid. | galat `invalid_props` |
| `lombokui.label.close` | Close | `aria-label` tombol tutup dialog |
| `lombokui.label.breadcrumb` | Breadcrumb | `aria-label` navigasi breadcrumb |
| `lombokui.label.pagination` | Pagination | `aria-label` navigasi pagination |
| `lombokui.label.previous_page` | Previous page | tombol halaman sebelumnya |
| `lombokui.label.next_page` | Next page | tombol halaman berikutnya |

Galat membawa `code` (kontrak, sama di semua port) dan `messageId`. Pesan `message` di objek galat berbahasa Inggris dan tidak bersifat normatif.

## 3. Pemilihan locale

Props `locale` (bawaan `en`) dicocokkan tanpa membedakan huruf ASCII, `_` dianggap `-`: tag persis, lalu subtag bahasa (`id-ID` -> `id`), lalu `en` (SPEC 8.2). Props `labels` mengganti label per kunci (`close`, `breadcrumb`, `pagination`, `previous_page`, `next_page`) untuk bahasa yang belum tersedia.

## 4. Cakupan saat ini

Core-20: 2 dari 20 (`en`, `id`). Paket Nusantara: 0 dari 6. Bahasa lain belum ada. Katalog bahasa tambahan harus ditinjau penutur asli sebelum diterima.

## 5. Cara menambah bahasa

1. Salin `locales/en/lombokui.json` ke `locales/<bcp47>/lombokui.json`.
2. Terjemahkan nilai; kunci tidak diubah.
3. Tambahkan katalog yang sama ke `typescript/src/messages.ts` dan `python/src/lombokui/_messages.py` (test memeriksa kesamaannya).
4. Minta tinjauan penutur asli, lalu ajukan PR.

## 6. Ketergantungan LombokLocale

Tidak ada pada 0.1.0. Konsumen yang memakai LombokLocale dapat me-resolve `messageId` dan label terhadap katalog di atas lalu memasukkannya lewat props `labels`. Rencana: memakai arah teks dan pelipatan huruf sadar locale dari LombokLocale untuk opsi `dir`, typeahead, dan filter combobox (`map_` bagian 2).
