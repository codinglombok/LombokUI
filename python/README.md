# lombokui (Python)

Port Python dari LombokUI: mesin komponen headless dan aksesibel, `position`, `pagination`, dan `render` HTML dengan nama kelas LombokCSS. Tanpa dependensi.

```python
import lombokui

html = lombokui.render("breadcrumb", {"items": [{"label": "Beranda", "href": "/"}, {"label": "Profil"}], "locale": "id"})
```

Dokumentasi lengkap dan kontrak normatif ada di repo: https://github.com/codinglombok/LombokUI

Lisensi `Apache-2.0 OR MIT`.
