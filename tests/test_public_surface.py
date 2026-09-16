from __future__ import annotations

import json
import math
import struct
import unittest
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = {
    "schema", "status", "updatedAt", "feed", "feedScope", "paperOnly",
    "executionModeled", "coverageCertified", "sessions", "alerts",
    "completeObservedSequenceAlerts", "targetSessions", "targetAlerts",
    "promotionStatus", "latestSessionDate", "universe", "policies",
    "latestAlerts", "checks", "myPicks", "evidenceDiagnostics",
}
ALERT_FIELDS = {
    "ticker", "decisionAt", "entryReference", "initialRiskPerShare",
    "evidenceQuality", "baselineGrossR", "trailGrossR", "nonfollowGrossR", "mfeR",
}
MY_PICKS_FIELDS = {"shadowOnly", "lifecycleVersion", "sessionDate", "status", "counts", "items"}
MY_PICK_COUNT_FIELDS = {"WATCH", "ARMED", "TRIGGERED", "INVALIDATED", "EXPIRED"}
MY_PICK_ITEM_FIELDS = {
    "ticker", "setupType", "state", "firstObservedAt", "stateChangedAt",
    "triggerReference", "invalidationReference", "distanceToTriggerPct",
    "compressionScore", "participationScore", "resilienceScore",
    "evidenceQuality", "reasonCodes",
}


class PublicSurfaceTests(unittest.TestCase):
    def test_required_files(self):
        for relative in ("index.html", ".nojekyll", "assets/app.js", "assets/style.css", "assets/og.png", "data/public-iex.json"):
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_exact_sanitized_contract(self):
        payload = json.loads((ROOT / "data/public-iex.json").read_text())
        self.assertEqual(set(payload), TOP_LEVEL)
        self.assertEqual(payload["schema"], "dayjumper_public_iex_v3")
        self.assertEqual(payload["feed"], "IEX")
        self.assertTrue(payload["paperOnly"])
        self.assertFalse(payload["executionModeled"])
        self.assertFalse(payload["coverageCertified"])
        for alert in payload["latestAlerts"]:
            self.assertEqual(set(alert), ALERT_FIELDS)
        picks = payload["myPicks"]
        self.assertEqual(set(picks), MY_PICKS_FIELDS)
        self.assertIs(picks["shadowOnly"], True)
        self.assertEqual(picks["lifecycleVersion"], "ORB5_SHADOW_V1")
        self.assertIn(picks["status"], {"AVAILABLE", "NO_QUALIFYING_SETUPS", "UNAVAILABLE"})
        self.assertEqual(set(picks["counts"]), MY_PICK_COUNT_FIELDS)
        self.assertTrue(all(type(value) is int and value >= 0 for value in picks["counts"].values()))
        self.assertEqual(sum(picks["counts"].values()), len(picks["items"]))
        seen = set()
        for pick in picks["items"]:
            self.assertEqual(set(pick), MY_PICK_ITEM_FIELDS)
            self.assertIn(pick["state"], MY_PICK_COUNT_FIELDS)
            self.assertRegex(pick["ticker"], r"^[A-Z][A-Z0-9.]{0,9}$")
            key = (pick["ticker"], pick["setupType"])
            self.assertNotIn(key, seen)
            seen.add(key)
            for field in ("compressionScore", "participationScore", "resilienceScore"):
                self.assertTrue(math.isfinite(pick[field]))
                self.assertGreaterEqual(pick[field], 0)
                self.assertLessEqual(pick[field], 1)
            self.assertTrue(math.isfinite(pick["distanceToTriggerPct"]))
            self.assertGreaterEqual(pick["distanceToTriggerPct"], 0)
            self.assertTrue(pick["firstObservedAt"].endswith(("Z", "+00:00")))
            self.assertTrue(pick["stateChangedAt"].endswith(("Z", "+00:00")))
            datetime.fromisoformat(pick["firstObservedAt"].replace("Z", "+00:00"))
            datetime.fromisoformat(pick["stateChangedAt"].replace("Z", "+00:00"))
        for state, count in picks["counts"].items():
            self.assertEqual(count, sum(pick["state"] == state for pick in picks["items"]))
        diagnostics = payload["evidenceDiagnostics"]
        self.assertEqual(set(diagnostics), {
            "status", "sessionDate", "rejectedCandidates",
            "missedOpportunityObservability", "availabilityLag",
            "sameTimeParticipation", "regimes",
        })
        self.assertIn(diagnostics["status"], {"AVAILABLE", "UNAVAILABLE"})
        rendered = json.dumps(payload).lower()
        for forbidden in ("api_key", "secret", "credential", "/var/lib", "raw_quote", "bid", "ask", "file_id", "sha256"):
            self.assertNotIn(forbidden, rendered)

    def test_client_uses_safe_dom_and_new_feed_only(self):
        script = (ROOT / "assets/app.js").read_text()
        for forbidden in ("innerHTML", "outerHTML", "insertAdjacentHTML", "eval(", "public-summary.json", "public-watchlist.json"):
            self.assertNotIn(forbidden, script)
        self.assertIn('fetch("data/public-iex.json"', script)
        self.assertIn("textContent", script)
        self.assertIn("STALE", script)
        self.assertIn("setInterval(loadPublication, 300000)", script)
        self.assertIn("renderMyPicks", script)
        self.assertIn("renderEvidenceDiagnostics", script)
        self.assertIn("STALE — RESEARCH ONLY", script)
        self.assertIn("progress(data.completeObservedSequenceAlerts, data.targetAlerts)", script)
        self.assertNotIn("progress(data.alerts, data.targetAlerts)", script)

    def test_html_does_not_present_stale_sip_metrics(self):
        html = (ROOT / "index.html").read_text()
        for stale in ("Modeled outcomes", "09:29 ET frozen screen", "Catalyst news", "Four-lane research router"):
            self.assertNotIn(stale, html)
        self.assertIn("Single-exchange observations", html)

    def test_lifecycle_surface_is_explicitly_shadow_only(self):
        html = (ROOT / "index.html").read_text()
        for state in ("Watch", "Armed", "Triggered", "Invalidated", "Expired"):
            self.assertIn(state, html)
        self.assertIn("Shadow only · no fills", html)
        self.assertIn("No qualifying setups met the predeclared rules.", html)
        self.assertIn("Lifecycle data unavailable; no setup should be inferred.", html)

    def test_candidate_audit_surface_has_explicit_boundaries(self):
        html = (ROOT / "index.html").read_text()
        self.assertIn("Evidence diagnostics", html)
        self.assertIn("observable follow-up bars do not prove", html)
        self.assertIn("Candidate-audit evidence is unavailable", html)

    def test_lifecycle_availability_matches_content(self):
        payload = json.loads((ROOT / "data/public-iex.json").read_text())
        picks = payload["myPicks"]
        self.assertEqual(picks["sessionDate"], payload["latestSessionDate"])
        if picks["status"] in {"UNAVAILABLE", "NO_QUALIFYING_SETUPS"}:
            self.assertEqual(picks["items"], [])
            self.assertTrue(all(count == 0 for count in picks["counts"].values()))
        else:
            self.assertEqual(picks["status"], "AVAILABLE")
            self.assertTrue(picks["items"])
        self.assertEqual(payload["evidenceDiagnostics"]["sessionDate"], payload["latestSessionDate"])

    def test_social_card_dimensions(self):
        data = (ROOT / "assets/og.png").read_bytes()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", data[16:24]), (1200, 630))


if __name__ == "__main__":
    unittest.main()
