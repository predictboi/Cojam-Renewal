#!/bin/bash
# bash tools/audit-all.sh [lang]   runs tools/design/audit.js on every screen and state at 390x844 mobile and prints one summary line each
cd "$(dirname "$0")/../../../.." || exit 1
L=${1:-en}
for p in login.html "login.html?state=code" "login.html?state=setup" "login.html?state=error" first-run.html "first-run.html?state=2" "first-run.html?state=3" home.html "home.html?state=fresh" "home.html?state=last" "home.html?state=offline" "home.html?state=empty" "home.html?state=error" "home.html?state=hold" "home.html?state=loading" home-list.html done.html "done.html?state=saving" results.html "results.html?state=empty" ranking.html "ranking.html?state=last" "ranking.html?state=none" "ranking.html?state=hold" staking.html "staking.html?state=review" "staking.html?state=zero" "staking.html?state=hold" stakes.html "stakes.html?state=empty" wallet.html "wallet.html?state=deposit" "wallet.html?state=withdraw" "wallet.html?state=offline" "wallet.html?state=hold" convert.html "convert.html?state=wait" "convert.html?state=short" "convert.html?state=ok" profile.html invite.html "invite.html?state=empty" hold.html index.html; do
  case "$p" in *\?*) u="$p&lang=$L";; *) u="$p?lang=$L";; esac
  o=$(AUDIT_ACCENT=#124CC4 node tools/design/audit.js "http://localhost:8858/$u" 390 844 --mobile 2>&1)
  echo "$p | $(echo "$o" | grep -E '^(overflow|MONO|CONTRAST|TARGETS)' | sed -E 's/ \(.*\)//; s/ under [^:]*//' | tr '\n' ' ')"
  echo "$o" | awk '/^(MONO|CONTRAST|TARGETS)/{f=1;next} /^(ACCENT|overflow)/{f=0} /^$/{next} f' | sed 's/^/     /'
done
