from __future__ import annotations

import json
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = {
    "schema", "status", "updatedAt", "feed", "feedScope", "paperOnly",
    "executionModeled", "coverageCertified", "sessions", "alerts",
    "completeObservedSequenceAlerts", "targetSessions", "targetAlerts",
    "promotionStatus", "latestSessionDate", "universe", "policies",
    "latestAlerts", "checks",
}
ALERT_FIELDS = {
    "ticker", "decisionAt", "entryReference", "initialRiskPerShare",
    "evidenceQuality", "baselineGrossR", "trailGrossR", "nonfollowGrossR", "mfeR",
}


class PublicSurfaceTests(unittest.TestCase):
    def test_required_files(self):
        for relative in ("index.html", ".nojekyll", "assets/app.js", "assets/style.css", "assets/og.png", "data/public-iex.json"):
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_exact_sanitized_contract(self):
        payload = json.loads((ROOT / "data/public-iex.json").read_text())
        self.assertEqual(set(payload), TOP_LEVEL)
        self.assertEqual(payload["schema"], "dayjumper_public_iex_v1")
        self.assertEqual(payload["feed"], "IEX")
        self.assertTrue(payload["paperOnly"])
        self.assertFalse(payload["executionModeled"])
        self.assertFalse(payload["coverageCertified"])
        for alert in payload["latestAlerts"]:
            self.assertEqual(set(alert), ALERT_FIELDS)
        rendered = json.dumps(payload).lower()
        for forbidden in ("api_key", "secret", "credential", "/var/lib", "raw_quote", "bid", "ask", "file_id", "sha256"):
            self.assertNotIn(forbidden, rendered)

    def test_client_uses_safe_dom_and_new_feed_only(self):
        script = (ROOT / "assets/app.js").read_text()
        for forbidden in ("innerHTML", "outerHTML", "insertAdjacentHTML", "eval(", "public-summary.json", "public-watchlist.json"):
            self.assertNotIn(forbidden, script)
        self.assertIn('fetch("data/public-iex.json"', script)
        self.assertIn("textContent", script)

    def test_html_does_not_present_stale_sip_metrics(self):
        html = (ROOT / "index.html").read_text()
        for stale in ("Modeled outcomes", "09:29 ET frozen screen", "Catalyst news", "Four-lane research router"):
            self.assertNotIn(stale, html)
        self.assertIn("Single-exchange observations", html)

    def test_social_card_dimensions(self):
        data = (ROOT / "assets/og.png").read_bytes()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", data[16:24]), (1200, 630))


if __name__ == "__main__":
    unittest.main()
