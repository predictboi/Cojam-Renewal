#!/usr/bin/env bash
# Builds dist/ui-ux-kit-<version>.plugin: the six open source skills from .claude/skills plus ui-review-loop from here.
# Run from the repository root: bash tools/ui-ux-kit/build.sh
set -euo pipefail
KIT=tools/ui-ux-kit
VER=$(python3 -c "import json;print(json.load(open('$KIT/.claude-plugin/plugin.json'))['version'])")
OUT=dist/ui-ux-kit-$VER.plugin
STAGE=$(mktemp -d)
mkdir -p "$STAGE/skills" dist
for s in impeccable hallmark web-design-guidelines redesign-existing-projects animate motion-design; do cp -R ".claude/skills/$s" "$STAGE/skills/"; done
cp -R "$KIT/skills/ui-review-loop" "$STAGE/skills/"
cp -R "$KIT/.claude-plugin" "$KIT/README.md" "$STAGE/"
cp .claude/skills/LICENSE-open-design "$STAGE/"
rm -f "$OUT"; (cd "$STAGE" && zip -qr -X "$OLDPWD/$OUT" .claude-plugin README.md LICENSE-open-design skills)
rm -rf "$STAGE"
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
