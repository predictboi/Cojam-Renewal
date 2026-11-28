#!/bin/sh
# sh tools/audit-all.sh [lang] [width] [height] : runs the repository audit on every screen and state through the local preview (port 8857).
L=${1:-en}; W=${2:-390}; H=${3:-844}
cd "$(dirname "$0")/../../../.." || exit 1
node -e "require('./platform/design-variants/matchday/tools/pages').forEach(p=>console.log(p[1]))" | while read -r p; do
  case "$p" in *\?*) u="$p&lang=$L";; *) u="$p?lang=$L";; esac
  r=$(AUDIT_ACCENT=#124CC4 node tools/design/audit.js "http://localhost:8857/$u" "$W" "$H" --mobile 2>&1)
  o=$(echo "$r" | grep -c "overflow px: 0$"); c=$(echo "$r" | grep "CONTRAST" | sed 's/.*: //'); t=$(echo "$r" | grep "TARGETS" | sed 's/.*: //'); m=$(echo "$r" | grep "MONO" | sed 's/.*: //')
  echo "$p  overflow_ok=$o contrast=$c targets=$t mono=$m"
  if [ "$o" != "1" ] || [ "$c" != "0" ] || [ "$t" != "0" ]; then echo "$r" | grep -v "^  text\|^  fill\|^  border" | sed -n '1,40p' | sed 's/^/      /'; fi
done
