# DayJumper public dashboard

This repository is intentionally public. It contains a sanitized morning candidate watchlist and
aggregate shadow-research statistics. It must never receive API keys, raw quotes, point-in-time
news, borrow records, locate quotes, or symbol-level outcomes.

On GitHub Free, enable **Settings → Pages → Deploy from a branch**, select `main` and `/(root)`.
The Oracle publishers update only `data/public-watchlist.json` and `data/public-summary.json`
through a repository-scoped deploy key.

The initial `SETUP REQUIRED` state is genuine. It remains until the private collector produces a
validated summary.

Verify the public-surface contract before each push:

```bash
python scripts/verify.py
```

The checks confirm the exact JSON allowlist, social-card dimensions, required static files, and
that remote JSON values are inserted as text rather than executable HTML.
