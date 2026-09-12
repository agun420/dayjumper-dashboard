# Deploy charts and news — beginner guide

## What this release actually does

TradingView embedded chart with ticker selection and an external chart fallback. Alpaca streaming news intake, linked tickers and original articles. Rule-based headline catalyst/sentiment analysis stored at first receipt in SQLite. These are uncalibrated directional hypotheses, not machine-learned probabilities, social/order-flow sentiment, verified FDA decisions, or trade instructions. Merger roles remain ambiguous; duplicate IDs retain the original assessment. Headline rules can misread negation, complex wording and multiple companies. Outcomes are explicitly not evaluated.

No historical backfill or reconnect gap recovery is implemented. Connection failures retry after 30 seconds and publish disconnected status. During a network outage, snapshots may remain stale; the UI labels snapshots older than ten minutes. Storage is append-only and requires disk monitoring. Only the latest 100 records are exported. Full article bodies are not stored or exported. Confirm your data subscription permits public headline redistribution before enabling the publisher.

Streaming intake is separate from the existing stock capture connection. Existing stock/news entitlement and connection limits still require live verification. GitHub Pages publishes every five minutes plus its own deployment/cache delay; this is not a real-time public dashboard. Busy DayJumper runtime locks skip publication until the next timer. A failed push leaves a local commit; a later publisher attempt retries via pull/push, but dirty files stop publication for review. There is no automatic cleanup/reset.

## 1. Update the dashboard on Windows

Extract the ZIP. In GitHub Desktop choose dayjumper-dashboard and Repository → Show in Explorer. Copy index.html, assets/app.js, assets/style.css, DEPLOY_NEWS.md and the news-worker folder into the matching locations. Keep the existing data folder; don't replace it with old snapshots from this ZIP. Commit and Push origin.

## 2. Transfer the worker package

In Windows PowerShell, using the working SSH key:

```powershell
scp -i "$env:USERPROFILE\Downloads\ssh-key-2026-08-20 (3).key" "$env:USERPROFILE\Downloads\DayJumper_News_Charts.zip" ubuntu@129.213.63.194:/home/ubuntu/
```

## 3. Install on Ubuntu

At ubuntu@daybreaker:~$, run one command at a time:

```bash
python3 -m zipfile -e ~/DayJumper_News_Charts.zip ~/dayjumper-news-release
sudo bash ~/dayjumper-news-release/dayjumper-dashboard-main/news-worker/install.sh
```

Installer adds a separate worker and publisher timer. It does not change core strategy files or enable services. It refuses if already installed. It uses the existing Alpaca credentials, Python environment, dashboard deploy key and publisher configuration. No credential values go into the website.

## 4. Start intake only, then inspect

```bash
sudo systemctl enable --now dayjumper-news.service
sudo journalctl -u dayjumper-news.service --no-pager -n 30
sudo python3 -c 'import json; d=json.load(open("/var/lib/dayjumper/news/public-news.json")); print({"status":d["status"],"updatedAt":d["updatedAt"],"items":len(d["items"])})'
```

If the snapshot isn't created yet, repeat the last command after a few seconds. CONNECTED with zero items is possible outside active news hours. DISCONNECTED requires checking entitlement/connection limits; don't repeatedly install. No auth keys or full response bodies are logged.

## 5. Publish and enable the schedule

After intake is CONNECTED and you have public redistribution permission:

```bash
sudo systemctl start dayjumper-news-publish.service
sudo journalctl -u dayjumper-news-publish.service --no-pager -n 40
```

If publication succeeds:

```bash
sudo systemctl enable --now dayjumper-news-publish.timer
```

The publisher pulls dashboard main with --ff-only and uses the existing runtime lock. If there is divergence or a dirty checkout, it stops; share the error rather than force-pushing or resetting.

## 6. Open and verify

Visit https://agun420.github.io/dayjumper-dashboard/ after the Pages deployment finishes. Select a watchlist ticker, check the exchange in the chart, and inspect news timestamps. If the embed is blocked, use the TradingView link. Test on phone and desktop before relying on the layout. External widgets contact TradingView and have their own data coverage/delays.

No browser rendering verification was possible in the build environment because the Chromium download failed. The provider integration has not been run with your credentials. Five public-surface tests, five news rule/storage tests, JavaScript syntax and worker shell syntax passed locally.

## Stop the new features

```bash
sudo systemctl disable --now dayjumper-news-publish.timer dayjumper-news.service
sudo systemctl stop dayjumper-news-publish.service
```

This leaves original capture timers and evidence untouched. Historical public news may remain on GitHub Pages and is marked stale as it ages. No prediction performance is claimed. Additional work needed: licensed social sentiment, calibrated modeling, price-linked outcome evaluation, disconnect backfill, capacity validation and faster serving if second-level public delivery is required.

## Official integration references

https://docs.alpaca.markets/us/docs/streaming-real-time-news
https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
