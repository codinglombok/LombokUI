# Full Summary LombokUI v0.1.0

## Apa ini

Komponen UI headless dan aksesibel yang perilakunya (keyboard, fokus, atribut ARIA, timer) didefinisikan sebagai mesin state murni dengan kontrak lintas bahasa, ditambah penempatan elemen mengambang, model pagination, render HTML di server, dan adapter DOM untuk browser.

## Mengapa dibuat

Perilaku komponen aksesibel biasanya terkunci di dalam satu framework JavaScript, sehingga server yang me-render HTML dengan bahasa lain menulis ulang atribut ARIA dengan tangan dan hasilnya tidak cocok dengan perilaku browser. Kontrak bersama membuat state awal di server dan perilaku di browser berasal dari spesifikasi yang sama dan dapat diuji tanpa browser.

## Fitur utama

Lihat README (bagian Fitur). Semua fitur dicakup vector.

## Status saat ini

Kode lengkap untuk TypeScript dan Python; lulus 366 kasus vector di kedua port; adapter DOM lulus test jsdom; belum terbit di registry; belum memenuhi aturan skor rilis (lihat `TECH_DEBT.md`).

## Contoh pemakai

Lihat README (skenario pemakaian) dan `map_` bagian 4.

## Batasan yang Diketahui

- Pelipatan huruf hanya ASCII; belum ada pembandingan sadar locale.
- Komponen 0.1.0 belum mencakup popover, select, menubar, tree, grid, date picker, dan submenu.
- Adapter DOM belum diuji di browser nyata maupun pembaca layar; belum audit aksesibilitas pihak ketiga.
- Gaya LombokCSS untuk sebagian komponen (accordion berbasis tombol, listbox, combobox, slider, tooltip) belum ada.
- Hanya dua port (TypeScript, Python); fuzz berupa pseudo-fuzz; coverage belum diukur.

## Info lanjut

SPEC_, API_, `development_ide_`, `map_`.

## Gap vs pembanding (U6)

Perbandingan bersifat kualitatif dan berdasarkan pengetahuan umum tentang kategori library; belum diverifikasi fitur demi fitur pada 2026-10-07.

| Pembanding (kategori) | Yang dimiliki pembanding dan belum dimiliki LombokUI | Yang ditawarkan LombokUI |
|---|---|---|
| Primitive headless berbasis framework (Radix UI, React Aria, Headless UI, Ark UI, Melt UI, Bits UI) | Jumlah komponen jauh lebih banyak, integrasi framework, pengujian di banyak browser dan pembaca layar, internasionalisasi tanggal dan angka | Tidak terikat framework; kontrak normatif dengan vector; state awal dapat di-render dari Python |
| Mesin state UI agnostik framework (Zag.js) | Lebih banyak mesin, adapter React/Vue/Solid/Svelte, statechart lengkap | Mesin dapat dijalankan di bahasa server; jam dari pemanggil; vector lintas bahasa |
| Penempatan elemen mengambang (Floating UI, Popper) | Middleware `size`, `autoPlacement`, `inline`, `hide`, kontainer gulir, elemen virtual, pembaruan otomatis | Aritmetika murni yang identik di setiap port |
| Framework CSS dengan JavaScript (Bootstrap, Flowbite) | Ekosistem tema dan template yang besar | Atribut ARIA lengkap dari mesin, aman di SSR, tanpa dependensi |
