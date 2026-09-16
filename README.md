# DayJumper public IEX research dashboard

This public repository contains a sanitized, paper-only view derived from the
offline DayJumper IEX evaluator. IEX is a single-exchange feed; the dashboard
must never describe it as SIP, consolidated volume, NBBO, or observed fills.

Only `data/public-iex.json` is refreshed automatically. API credentials, raw
events, file paths, input hashes, detailed rejection events, and private reports
remain on the Oracle VM.

Run `python3 scripts/verify.py` before every publication. The public schema is
allowlisted, remote values are inserted using text nodes, and the dashboard
labels all outcomes as provisional research.

## My Picks shadow lifecycle

Public schema v2 adds a sanitized My Picks view for `WATCH`, `ARMED`, `TRIGGERED`, `INVALIDATED`, and `EXPIRED` setup states. It is additive: the frozen ORB5 baseline and completed-session research alerts remain unchanged. My Picks is paper-only, does not model fills, and must not be interpreted as investment advice. The UI distinguishes a valid zero-setup session from unavailable lifecycle data and visually demotes stale publications. Sessions captured before `ORB5_SHADOW_V1` deployment remain unavailable and are never reconstructed with hindsight.
