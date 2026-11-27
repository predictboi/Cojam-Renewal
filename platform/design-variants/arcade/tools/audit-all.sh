#!/bin/sh
# Runs the repository audit (tools/design/audit.js) on every screen at 390 x 844, mobile. Usage: sh tools/audit-all.sh [lang] [width] [height]
L=${1:-en}; W=${2:-390}; H=${3:-844}
cd "$(dirname "$0")/../../../.." || exit 1
for p in "login.html" "login.html?state=code" "first-run.html" "home.html?state=fresh" "home.html?state=partial" "home.html?state=hold" "home.html?state=empty" "home.html?state=loading" "home.html?state=error" "home-list.html?state=fresh" "home-list.html" "done.html" "results.html" "results.html?state=empty" "ranking.html" "ranking.html?state=lastweek" "staking.html" "staking.html?state=review" "staking.html?state=hold" "stakes.html" "stakes.html?state=empty" "wallet.html" "wallet.html?state=deposit" "wallet.html?state=withdraw" "wallet.html?state=hold" "convert.html" "convert.html?state=short" "profile.html" "invite.html" "hold.html" "index.html"; do
  case "$p" in *\?*) u="$p&lang=$L";; *) u="$p?lang=$L";; esac
  echo "== $u"
  node tools/design/audit.js "http://localhost:8855/$u" $W $H --mobile 2>&1 | grep -v "^$"
done
