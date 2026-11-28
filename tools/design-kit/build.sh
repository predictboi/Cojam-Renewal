#!/usr/bin/env bash
# Builds the design reference of the Cojam Daily Prediction platform for use by another project, in tools/design-kit/dist/:
#   cojam-design-reference.md  one self contained guide (guide.src.md with the real tokens and CSS rules pulled in by expand.py)
#   cojam-design-kit.zip       the runnable design (platform/design without captures, reviews, tests), the guide as README.md,
#                              HOW-TO-PREVIEW.md, fresh screenshots in screens/ and the audit script in tools/
# Then it checks both: code fences, dash breaks in prose, secrets and personal data, and a clean unzip that previews with no missing files.
# Needs python3, node with Playwright (Chromium preinstalled), zip and unzip. Run from anywhere: bash tools/design-kit/build.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
KIT=tools/design-kit
SRC=platform/design
DIST=$KIT/dist
MD=$DIST/cojam-design-reference.md
ZIP=$DIST/cojam-design-kit.zip
mkdir -p "$DIST"

STAGE=$(mktemp -d); CHECK=$(mktemp -d); PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; rm -rf "$STAGE" "$CHECK"; }
trap cleanup EXIT
free_port() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
serve() {   # serve <dir>: starts a static server and prints its base URL
  local port; port=$(free_port)
  python3 -m http.server "$port" --bind 127.0.0.1 -d "$1" >/dev/null 2>&1 & PIDS+=($!)
  for _ in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$port/" && break; sleep 0.1; done
  echo "http://127.0.0.1:$port/"
}

# 1. the guide
python3 "$KIT/expand.py" "$KIT/guide.src.md" "$SRC" > "$MD"

# 2. stage the zip: the design without review material, the guide, the preview notes, the audit script
tar -C platform -cf - --exclude=design/captures --exclude=design/reviews --exclude=design/tests --exclude=node_modules --exclude=.DS_Store design | tar -C "$STAGE" -xf -
cp "$MD" "$STAGE/README.md"
cp "$KIT/how-to-preview.md" "$STAGE/HOW-TO-PREVIEW.md"
mkdir -p "$STAGE/tools" && cp tools/design/audit.js "$STAGE/tools/audit.js"

# 3. fresh screenshots from the staged design
BASE=$(serve "$STAGE/design")
node "$KIT/shots.js" "$BASE" "$STAGE/screens"

# 4. the zip
rm -f "$ZIP"
(cd "$STAGE" && zip -qr -X "$ROOT/$ZIP" README.md HOW-TO-PREVIEW.md design screens tools)

# 5. checks
python3 - "$MD" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read().split("\n")
fence, opened, problems = None, 0, []
for n, line in enumerate(text, 1):
    m = re.match(r"^(`{3,})(\S*)\s*$", line)
    if m:
        if fence is None: fence, opened = m.group(1), n
        elif m.group(1) == fence and not m.group(2): fence = None
        continue
    if fence is None and re.search(r" [-–—] ", re.sub(r"`[^`]*`", "", line)):
        problems.append("dash used as a sentence break, line %d: %s" % (n, line[:90]))
if fence: problems.append("code fence opened on line %d is never closed" % opened)
if problems: sys.exit("\n".join(problems))
print("guide: %d lines, code fences balanced, no dash breaks in prose" % len(text))
PY
unzip -q "$ZIP" -d "$CHECK"
# secrets and personal data: key material, known secret names, and the e-mail addresses of the repository's human committers
EMAILS=$(git log --format='%ae' | grep -v 'noreply@' | sort -u | paste -sd'|' - || true)
PAT='PRIVATE[_ ]KEY|BEGIN [A-Z ]*PRIVATE|PRIVY_APP_SECRET|mnemonic|xprv|ghp_[A-Za-z0-9]{20}|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}'
[ -n "$EMAILS" ] && PAT="$PAT|$EMAILS"
if grep -rIEn "$PAT" "$MD" "$CHECK"; then echo "secret or personal data pattern found" >&2; exit 1; fi
# a 64 digit hex string could be a private key: only the mock transaction hash of components.js is allowed
HEX=$(grep -rIEoh "(0x)?[0-9a-fA-F]{64}" "$MD" "$CHECK" | sort -u | grep -v '^0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1$' || true)
if [ -n "$HEX" ]; then echo "unexpected 64 digit hex: $HEX" >&2; exit 1; fi
echo "no secrets, keys or committer e-mail addresses in the guide or the zip"
# the zip previews from a clean folder with no missing files
node "$KIT/verify.js" "$(serve "$CHECK/design")"

echo "built $MD ($(du -h "$MD" | cut -f1), $(wc -l < "$MD") lines) and $ZIP ($(du -h "$ZIP" | cut -f1), $(unzip -Z1 "$ZIP" | wc -l) files)"
