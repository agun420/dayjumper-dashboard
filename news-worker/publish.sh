#!/usr/bin/env bash
set -euo pipefail
set -a
source /etc/dayjumper/dayjumper.env
set +a
exec 9>/var/lib/dayjumper/runtime.lock
flock -n 9 || exit 0
DASHBOARD=${DAYJUMPER_DASHBOARD_REPO:?}
BRANCH=${DAYJUMPER_DASHBOARD_BRANCH:-main}
export GIT_SSH_COMMAND="ssh -i ${DAYJUMPER_DASHBOARD_DEPLOY_KEY:?} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${DAYJUMPER_GITHUB_KNOWN_HOSTS:?}"
[[ -f /var/lib/dayjumper/news/public-news.json ]] || exit 0
[[ -z $(git -C "$DASHBOARD" status --porcelain) ]] || { echo 'Dashboard has pending changes; publication stopped.'; exit 2; }
git -C "$DASHBOARD" pull --ff-only origin "$BRANCH"
install -m 0644 /var/lib/dayjumper/news/public-news.json "$DASHBOARD/data/public-news.json"
git -C "$DASHBOARD" add -- data/public-news.json
git -C "$DASHBOARD" diff --cached --quiet && exit 0
git -C "$DASHBOARD" -c user.name='DayJumper News Publisher' -c user.email='dayjumper-news@users.noreply.github.com' commit -m 'Publish news research snapshot' -- data/public-news.json
git -C "$DASHBOARD" push origin "HEAD:$BRANCH"
