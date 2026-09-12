# Core-to-dashboard publication contract

The browser reads `data/public-iex.json`. The VM evaluator/publisher is the sole writer of that file. It must publish atomically, retain `paperOnly: true`, and keep the strict public allowlist tested in `tests/test_public_surface.py`.

The evaluator/publisher source was not present in the reviewed repository archives. Preserve the installed VM files until they have been copied into version control and reviewed. The browser marks publications older than 72 hours as stale and reloads every five minutes.

The news worker preserves the first-seen assessment in `news` and stores each distinct provider edit in `news_versions`. Headline rules are uncalibrated research annotations, not trading signals.
