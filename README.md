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
