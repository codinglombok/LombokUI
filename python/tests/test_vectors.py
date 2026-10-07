"""Runs every case of vectors/lombokui-vectors-v1.json against the Python port (SPEC 1)."""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python" / "src"))

import lombokui  # noqa: E402

VECTORS = ROOT / "vectors" / "lombokui-vectors-v1.json"
SPEC = ROOT / "docs" / "SPEC_LombokUI_v0.1.0.md"


def same(a, b) -> bool:
    """Structural JSON equality; numbers compare by value (1 == 1.0), booleans never equal numbers."""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b or (math.isnan(a) and math.isnan(b))
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    return type(a) is type(b) and a == b


def execute(fn, args):
    try:
        return {"result": lombokui.call(fn, args)}
    except lombokui.LombokUIError as e:
        return {"error": e.code}


class VectorTest(unittest.TestCase):
    def test_hash_matches_spec(self):
        digest = hashlib.sha256(VECTORS.read_bytes()).hexdigest()
        self.assertIn(digest, SPEC.read_text(encoding="utf-8"))

    def test_all_cases(self):
        doc = json.loads(VECTORS.read_text(encoding="utf-8"))
        total = 0
        failures = []
        for group in doc["groups"]:
            for case in group["cases"]:
                total += 1
                got = execute(case["fn"], case["args"])
                if not same(got, case["expect"]):
                    failures.append(f'{case["name"]}\n  expect {json.dumps(case["expect"])[:400]}\n  got    {json.dumps(got)[:400]}')
        self.assertGreaterEqual(total, 100)
        self.assertEqual(failures, [], "\n".join(failures[:10]) + f"\n{len(failures)} of {total} cases failed")

    def test_catalogs_match_locales(self):
        for tag, cat in lombokui.CATALOGS.items():
            on_disk = json.loads((ROOT / "locales" / tag / "lombokui.json").read_text(encoding="utf-8"))
            self.assertEqual(cat, on_disk, tag)

    def test_version_matches(self):
        self.assertEqual(lombokui.__version__, (ROOT / "version.txt").read_text().strip())
        text = (ROOT / "python" / "pyproject.toml").read_text()
        self.assertEqual(re.search(r'^version = "([^"]+)"', text, re.M).group(1), lombokui.__version__)


if __name__ == "__main__":
    unittest.main()
