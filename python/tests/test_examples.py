"""The Python examples in README, the guide and python/README run and produce what they claim."""

from __future__ import annotations

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python" / "src"))

import lombokui  # noqa: E402


class ExamplesTest(unittest.TestCase):
    def test_readme_tabs(self):
        html = lombokui.render("tabs", {"idBase": "t", "items": [
            {"id": "a", "label": "Profil", "content": "Isi profil"},
            {"id": "b", "label": "Keamanan", "content": "Isi keamanan"},
        ]})
        self.assertIn('id="t-tab-a" role="tab" aria-selected="true"', html)
        self.assertIn('data-lui="tabs"', html)

    def test_guide_dialog(self):
        html = lombokui.render("dialog", {
            "idBase": "hapus",
            "title": "Hapus berkas?",
            "description": "Tindakan ini tidak dapat dibatalkan.",
            "trigger": {"label": "Hapus", "variant": "danger"},
            "actions": [{"label": "Batal", "value": "batal"}, {"label": "Hapus", "variant": "danger", "value": "ok"}],
            "locale": "id",
        })
        self.assertIn('aria-label="Tutup"', html)
        self.assertIn('aria-describedby="hapus-description"', html)

    def test_python_readme_breadcrumb(self):
        html = lombokui.render("breadcrumb", {"items": [{"label": "Beranda", "href": "/"}, {"label": "Profil"}], "locale": "id"})
        self.assertEqual(html, '<nav aria-label="Jejak navigasi"><ol class="breadcrumb"><li><a href="/">Beranda</a></li><li aria-current="page">Profil</li></ol></nav>')

    def test_machine_wrapper(self):
        seen = []
        m = lombokui.create_machine("switch", {"idBase": "notif"})
        m.subscribe(lambda s, fx: seen.append(s["checked"]))
        m.send({"type": "keydown", "key": " "})
        self.assertEqual(seen, [True])
        self.assertEqual(m.attrs()["control"]["aria-checked"], "true")

    def test_errors_carry_codes(self):
        with self.assertRaises(lombokui.LombokUIError) as cm:
            lombokui.render("breadcrumb", {"items": [{"label": "x", "href": "javascript:alert(1)"}]})
        self.assertEqual(cm.exception.code, "invalid_props")
        self.assertEqual(cm.exception.message_id, "lombokui.error.invalid_props")

    def test_state_is_not_mutated(self):
        c = lombokui.get_component("toast")
        ctx, state = c.setup({})
        state2, _ = c.send(ctx, state, {"type": "add", "id": "a", "at": 0})
        before = repr(state2)
        c.send(ctx, state2, {"type": "pause", "at": 10})
        self.assertEqual(repr(state2), before)


if __name__ == "__main__":
    unittest.main()
