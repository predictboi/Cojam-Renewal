#!/bin/sh
# Runs the repository audit (tools/design/audit.js) on every screen. Usage: sh tools/audit-all.sh [lang] [width] [height]
L=${1:-en}; W=${2:-390}; H=${3:-844}
cd "$(dirname "$0")/../../../.." || exit 1
for p in "index.html" "login.html" "login.html?state=code" "login.html?state=wrong" "first-run.html" "first-run.html?step=2" "first-run.html?step=3" "first-run.html?state=codeok" "home.html" "home.html?state=partial" "home.html?state=hold" "home.html?state=empty" "home.html?state=loading" "home.html?state=error" "home.html?state=offline" "home-list.html" "home-list.html?state=partial" "done.html" "done.html?state=saving" "results.html" "results.html?state=empty" "ranking.html" "ranking.html?state=lastweek" "ranking.html?state=norank" "ranking.html?state=hold" "staking.html" "staking.html?state=review" "staking.html?state=errmin" "staking.html?state=hold" "stakes.html" "stakes.html?state=empty" "wallet.html" "wallet.html?state=deposit" "wallet.html?state=withdraw" "wallet.html?state=hold" "wallet.html?state=offline" "convert.html" "convert.html?state=short" "convert.html?state=wait" "profile.html" "invite.html" "invite.html?state=hold" "hold.html"; do
  case "$p" in *\?*) u="$p&lang=$L";; *) u="$p?lang=$L";; esac
  out=$(AUDIT_ACCENT="#FFD400" node tools/design/audit.js "http://localhost:8856/$u" $W $H --mobile 2>&1 | awk '/^overflow/{print} /^CONTRAST/{f=1;print;next} /^TARGETS/{f=1;print;next} /^(MONO|ACCENT)/{f=0} f&&/^  /{print}')
  echo "== $u"; echo "$out"
done
