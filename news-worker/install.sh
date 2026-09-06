#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 2; }
HERE=$(cd "$(dirname "$0")" && pwd)
[[ ! -e /etc/systemd/system/dayjumper-news.service ]] || { echo 'Already installed; review before update'; exit 2; }
/opt/dayjumper/venv/bin/python -c 'import websockets'
install -d -m 0755 /opt/dayjumper/news-worker
install -m 0644 "$HERE/worker.py" /opt/dayjumper/news-worker/worker.py
install -m 0755 "$HERE/publish.sh" /opt/dayjumper/news-worker/publish.sh
install -d -o dayjumper -g dayjumper -m 0750 /var/lib/dayjumper/news
cat > /etc/systemd/system/dayjumper-news.service <<'EOF'
[Unit]
Description=DayJumper news-only research stream
After=network-online.target
Wants=network-online.target
[Service]
User=dayjumper
Group=dayjumper
EnvironmentFile=/etc/dayjumper/alpaca.env
ExecStart=/opt/dayjumper/venv/bin/python /opt/dayjumper/news-worker/worker.py
Restart=on-failure
RestartSec=30
UMask=0027
MemoryMax=128M
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/dayjumper/news
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/dayjumper-news-publish.service <<'EOF'
[Unit]
Description=Publish DayJumper news snapshot
[Service]
Type=oneshot
User=dayjumper
Group=dayjumper
ExecStart=/opt/dayjumper/news-worker/publish.sh
TimeoutStartSec=120
MemoryMax=128M
EOF
cat > /etc/systemd/system/dayjumper-news-publish.timer <<'EOF'
[Unit]
Description=Publish news every five minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
echo 'Installed only. Start services after reviewing DEPLOY_NEWS.md.'
