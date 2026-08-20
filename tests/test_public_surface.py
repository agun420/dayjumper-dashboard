from __future__ import annotations

import json
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PublicSurfaceTests(unittest.TestCase):
    def test_required_static_files_exist(self) -> None:
        for relative in (
            "index.html",
            ".nojekyll",
            "assets/app.js",
            "assets/style.css",
            "assets/og.png",
            "data/public-summary.json",
        ):
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_public_json_has_only_allowlisted_shape(self) -> None:
        payload = json.loads((ROOT / "data/public-summary.json").read_text(encoding="utf-8"))
        self.assertEqual(
            set(payload),
            {
                "status",
                "updatedAt",
                "sessions",
                "selectedSignals",
                "modeledOutcomes",
                "targetSessions",
                "targetSignals",
                "lanes",
                "checks",
            },
        )
        rendered = json.dumps(payload).lower()
        for forbidden in ("api_key", "secret", "credential", "/var/lib", "raw_quote", "ticker"):
            self.assertNotIn(forbidden, rendered)

    def test_client_uses_text_nodes_for_remote_values(self) -> None:
        script = (ROOT / "assets/app.js").read_text(encoding="utf-8")
        for forbidden in ("innerHTML", "outerHTML", "insertAdjacentHTML", "eval("):
            self.assertNotIn(forbidden, script)
        self.assertIn("textContent", script)

    def test_social_card_is_1200_by_630(self) -> None:
        data = (ROOT / "assets/og.png").read_bytes()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", data[16:24])
        self.assertEqual((width, height), (1200, 630))


if __name__ == "__main__":
    unittest.main()
