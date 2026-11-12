# Cojam Renewal

The relaunch site for Cojam and the migration from the old token to the new one.

| Path | What it holds |
| --- | --- |
| `site/` | The static site served by Render (EN / KO / JA toggle) |
| `brand/` | Logo files and brand notes |
| `research/` | Project history and prediction market research |
| `docs/` | Working method and specs |
| `tools/` | Capture, audit and video scripts |

## Preview locally

```
python3 -m http.server 8811 -d site
```

Open `http://localhost:8811/` and switch the language with the buttons, or use `?lang=ko` and `?lang=ja`.

## Deploy

`render.yaml` defines a Render static site that publishes `site/`. In Render, choose New, Blueprint, and select this repository. Pull requests get preview deploys.
