# ui-ux-kit 0.2.0

Seven design skills for any project: six packaged from open source repositories, plus `ui-review-loop`, the build and review method used on the Polyquest and Cojam sites.

| Skill | Use it for | Source and license |
| --- | --- | --- |
| impeccable | Design direction, polish passes, removing generic AI looks | pbakaus/impeccable (Apache 2.0) |
| hallmark | New websites and pages that look designed, not generated | Nutlope/hallmark (MIT) |
| web-design-guidelines | Reviewing UI code against the Vercel Web Interface Guidelines | nexu-io/open-design (Apache 2.0) |
| redesign-existing-projects | Auditing and upgrading an existing site without breaking it | nexu-io/open-design (Apache 2.0) |
| animate | Interface animation: easing, springs, interruption, exits, reduced motion | nexu-io/open-design (Apache 2.0) |
| motion-design | Motion briefs, beat maps, pacing for motion graphics and videos | nexu-io/open-design (Apache 2.0) |
| **ui-review-loop** (new) | Design rules that moved scores, mobile first gate, interaction and motion rules, bold "two quiet colours and one loud" directions, the capture, audit and independent review loop, pitfalls | Original |

## What ui-review-loop adds

- `scripts/shot.js`: Playwright capture at any size, touch profile, full page, injected CSS or JS, `?state=` pages.
- `scripts/audit.js`: overflow, page errors, contrast under 4.5:1, touch targets under 44 px, monospace misuse, accent use (`AUDIT_ACCENT=#RRGGBB`).
- `scripts/contrast.js`: WCAG ratio for colour pairs.
- `templates/tokens.css`: token starter with a phone rhythm override and motion tokens.
- `templates/press.css`, `templates/press.js`: press feedback, primary ripple, scroll reveal that never hides content in captures.
- `templates/reviewer-brief.md`: the independent reviewer prompt (100 point design score plus 40 point Nielsen score).

The scripts need Node and Playwright (`npm i -D playwright`, then `npx playwright install chromium` where no browser is installed).

## Install

**As a plugin:** add the `ui-ux-kit-0.2.0.plugin` file in Claude (Customize, Plugins, upload) or with the plugin command of your Claude Code version.

**Into one repository, no plugin:** unzip and copy `skills/*` into the project's `.claude/skills/`. Commit it so every session on that repository loads the skills.

Order that works: `hallmark` or `impeccable` for direction, build with `ui-review-loop`, `impeccable` or `unslop` to polish, `web-design-guidelines` and an accessibility review to check, then the independent reviewer from `ui-review-loop`.

Skills often already on the account without this plugin: frontend-design, unslop, artifact-design, dataviz, and the design plugin skills (design-critique, accessibility-review, ux-copy, design-system, design-handoff, user-research).
