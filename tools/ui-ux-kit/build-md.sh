#!/usr/bin/env bash
# Builds two downloads in dist/ from the same skills as build.sh:
#   ui-ux-kit-guide.md  one Markdown file: the README, every SKILL.md, and ui-review-loop with its templates and scripts inline
#   ui-ux-kit-skills.zip the full skill folders (Markdown references, theme images, scripts, licenses) for .claude/skills/
# Run from the repository root: bash tools/ui-ux-kit/build-md.sh
set -euo pipefail
KIT=tools/ui-ux-kit
VER=$(python3 -c "import json;print(json.load(open('$KIT/.claude-plugin/plugin.json'))['version'])")
OPEN="hallmark impeccable web-design-guidelines redesign-existing-projects animate motion-design"
mkdir -p dist
OUT=dist/ui-ux-kit-guide.md
{
  echo "# ui-ux-kit $VER: design skills guide"
  echo
  echo "One file with every skill's main instructions. For the full skills (reference files, theme images, scripts), unzip \`ui-ux-kit-skills.zip\` into a project's \`.claude/skills/\`."
  echo
  echo "## How to use this file"
  echo
  echo "- **In a Claude chat or project:** upload this file, or add it to the project knowledge, and say which skill to follow (for example \"follow ui-review-loop\")."
  echo "- **In Claude Code, one repository:** unzip \`ui-ux-kit-skills.zip\` into \`.claude/skills/\` at the repository root and commit it. Each folder becomes a skill."
  echo "- **Single skill by hand:** copy one section below into \`.claude/skills/<name>/SKILL.md\`, keeping the front matter between the \`---\` lines."
  echo
  echo "## Contents"
  echo
  echo "- [README](#readme)"
  echo "- [ui-review-loop](#skill-ui-review-loop) (original: the build, capture, audit and review method)"
  for s in $OPEN; do echo "- [$s](#skill-$s)"; done
  echo "- [Licenses](#licenses)"
  echo
  echo "---"
  echo
  echo '<a id="readme"></a>'
  echo
  sed '1s/^# /## /' "$KIT/README.md"
  echo
  echo "---"
  echo
  echo '<a id="skill-ui-review-loop"></a>'
  echo
  echo "# Skill: ui-review-loop"
  echo
  echo "Files: \`skills/ui-review-loop/SKILL.md\`, plus the templates and scripts below."
  echo
  echo '````markdown'
  sed -e "\$a\\" "$KIT/skills/ui-review-loop/SKILL.md"
  echo '````'
  for f in templates/reviewer-brief.md templates/tokens.css templates/press.css templates/press.js scripts/contrast.js scripts/shot.js scripts/audit.js; do
    ext="${f##*.}"; lang=$ext; [ "$ext" = md ] && lang=markdown; [ "$ext" = js ] && lang=javascript
    echo; echo "### ui-review-loop/$f"; echo; echo "\`\`\`\`$lang"; sed -e "\$a\\" "$KIT/skills/ui-review-loop/$f"; echo "\`\`\`\`"
  done
  for s in $OPEN; do
    echo; echo "---"; echo; echo "<a id=\"skill-$s\"></a>"; echo; echo "# Skill: $s"; echo
    refs=$(cd ".claude/skills/$s" && find . -type f ! -name SKILL.md ! -name LICENSE | sed 's|^\./||' | sort)
    n=$(printf "%s\n" "$refs" | grep -c . || true)
    echo "File: \`skills/$s/SKILL.md\`. It refers to $n more files (references, images) that are in \`ui-ux-kit-skills.zip\`."
    echo; echo '````markdown'; sed -e "\$a\\" ".claude/skills/$s/SKILL.md"; echo '````'
  done
  echo; echo "---"; echo; echo '<a id="licenses"></a>'; echo; echo "# Licenses"; echo
  echo "ui-review-loop is original work. The other six skills keep their own licenses, included in full in \`ui-ux-kit-skills.zip\`: impeccable (pbakaus/impeccable, Apache 2.0), hallmark (Nutlope/hallmark, MIT), web-design-guidelines, redesign-existing-projects, animate and motion-design (nexu-io/open-design, Apache 2.0)."
} > "$OUT"
ZIP=dist/ui-ux-kit-skills.zip
STAGE=$(mktemp -d); mkdir -p "$STAGE/skills"
for s in $OPEN; do cp -R ".claude/skills/$s" "$STAGE/skills/"; done
cp -R "$KIT/skills/ui-review-loop" "$STAGE/skills/"
cp .claude/skills/LICENSE-open-design "$STAGE/skills/"
cp "$KIT/README.md" "$STAGE/README.md"
rm -f "$ZIP"; (cd "$STAGE" && zip -qr -X "$OLDPWD/$ZIP" README.md skills)
rm -rf "$STAGE"
echo "built $OUT ($(du -h "$OUT" | cut -f1)) and $ZIP ($(du -h "$ZIP" | cut -f1))"
