# codinglombok/lombokui (PHP)

Port PHP dari LombokUI: mesin komponen headless dan aksesibel, `position`, `pagination`, dan `render` HTML dengan nama kelas LombokCSS. Tanpa dependensi selain ekstensi `mbstring` dan `json`.

```php
use Lombok\UI\LombokUI;

echo LombokUI::render('breadcrumb', ['items' => [['label' => 'Beranda', 'href' => '/'], ['label' => 'Profil']], 'locale' => 'id']);
```

Objek boleh berupa array asosiatif atau `stdClass` (hasil `json_decode`). Dokumentasi lengkap dan kontrak normatif ada di repo: https://github.com/codinglombok/LombokUI

Lisensi `Apache-2.0 OR MIT`.
