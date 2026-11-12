# Cojam Renewal: working notes for Claude sessions

Read `docs/HANDOFF.md` once per session for the full method (review loop, migration spec, pitfalls, video pipeline).
This file holds what is specific to Cojam and overrides the handoff where they differ.

## Working agreements

- Talk to the founder in Korean: complete sentences with particles and endings, no noun phrase endings, no em dash, precise Sino Korean vocabulary.
- Every deliverable is in English (UI copy, docs, specs, code comments). The site ships an EN / KO / JA toggle; English is the source text.
- No dash punctuation as a sentence break anywhere (" - " or " — "). Use a colon, a comma, a conjunction or two sentences. List bullets are fine.
- Work fast: run independent work in parallel (at most 5 agents), fix small things without asking, ask only when a wrong guess is expensive.
- Big deliverables: show the structure in one message, get a yes, then build without stopping.

## Brand (confirmed so far)

| Field | Value |
| --- | --- |
| Name | Cojam (capital C, rest lower case) |
| Primary | `#124CC4`, text on it is white (7.35:1) |
| Secondary candidates | `#3E58E3` (app background blue), `#97DBFF` (sky) |
| Logo | `brand/logo/cojam-mark.svg` (original), `brand/logo/cojam-mark-centered.svg` (geometry centred, used on the site until the founder decides) |
| Type | Pretendard Variable for EN and KO, Pretendard JP Variable for JA (switched by `:lang(ja)`), tabular numerals |
| Deploy | Render static site from `site/` via `render.yaml` |
| Everything else | TBD: see the Brand sheet in `docs/HANDOFF.md` section 2 and `brand/BRAND.md` |

Colour rules learned so far: `#124CC4` and `#3E58E3` sit at 1.3:1 against each other, so never put one on the other for text or the mark. `#97DBFF` fails as text on white (1.5:1) but works as text on a dark ground (12.6:1). The blue mark on a near black ground is only 2.6:1: give it a light tile or a ring there when it must read at small sizes.

## Repository map

- `site/`: what Render serves. `assets/base.css` (tokens), `assets/i18n.js` (EN / KO / JA dictionary and toggle).
- `brand/`: logo files and `BRAND.md`.
- `research/`: market and project research that feeds planning.
- `docs/HANDOFF.md`: method carried over from the previous project.
- `tools/design/`: `shot.js` (captures) and `audit.js` (contrast, targets, overflow, accent use; `AUDIT_ACCENT` defaults to `#124CC4`; extra shell files via `CJ_EXTRA_CSS` and `CJ_EXTRA_JS`).
- `tools/video/`: video pipeline scripts; set `VIDEO_ROOT` to the working folder before use.
- `.claude/skills/`: ui-ux-kit skills (impeccable, hallmark, web-design-guidelines, redesign-existing-projects, animate, motion-design).

## Local preview

`python3 -m http.server 8811 -d site` then open `http://localhost:8811/?lang=ko`.

## Design skill order

hallmark or frontend-design for direction, build, impeccable or unslop to polish, web-design-guidelines and design:accessibility-review to check, then the independent reviewer loop from the handoff. Load a skill only after the content is gathered.
