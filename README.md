# DayJumper public dashboard

This repository is intentionally public and contains aggregate shadow-research statistics only.
It must never receive API keys, raw quotes, candidate evidence, point-in-time news, borrow records,
locate quotes, or symbol-level outcomes.

On GitHub Free, enable **Settings → Pages → Deploy from a branch**, select `main` and `/(root)`.
The Oracle publisher updates only `data/public-summary.json` through a repository-scoped deploy key.

The initial `SETUP REQUIRED` state is genuine. It remains until the private collector produces a
validated summary.

Verify the public-surface contract before each push:

```bash
python scripts/verify.py
```

The checks confirm the exact JSON allowlist, social-card dimensions, required static files, and
that remote JSON values are inserted as text rather than executable HTML.
