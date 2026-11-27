#!/bin/sh
# Runs the repository audit (tools/design/audit.js) on the screens of this variant. Usage: sh tools/audit-all.sh [lang] [width] [height] [all|base]
#   all  : every screen in every state of assets/states.js (214 URLs)
#   base : every screen in its first state plus the hub (default)
# Prints one line per URL: overflow, contrast failures, small targets. Details of any failure follow the line.
L=${1:-en}; W=${2:-390}; H=${3:-844}; M=${4:-base}
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE/../../.." || exit 1
node -e '
const S=require(process.argv[1]+"/assets/states.js"), m=process.argv[2];
for(const s of S){ const st=m==="all"?s[4]:[s[4][0]]; for(const x of st) console.log(s[3]+(x?"?state="+x:"")); }
if(m!=="all") console.log("index.html");' "$HERE" "$M" | while read -r p; do
  case "$p" in *\?*) u="$p&lang=$L";; *) u="$p?lang=$L";; esac
  out=$(node tools/design/audit.js "http://localhost:8851/$u" $W $H --mobile 2>&1)
  o=$(echo "$out" | sed -n 's/^overflow px: //p'); c=$(echo "$out" | sed -n 's/^CONTRAST under 4.5:1: //p'); t=$(echo "$out" | sed -n 's/^TARGETS under 44px tall: //p')
  echo "$u overflow=$o contrast=$c targets=$t"
  if [ "$o" != "0" ] || [ "$c" != "0" ] || [ "$t" != "0" ]; then echo "$out" | awk '/^CONTRAST|^TARGETS/{f=1} f' | sed 's/^/    /'; fi
done
