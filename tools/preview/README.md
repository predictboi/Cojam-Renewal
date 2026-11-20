# Artifact preview build

Builds a copy of `site/` that runs inside a claude.ai Artifact: Pretendard fonts bundled locally, directory links pointed at `index.html`, landing renamed to `home.html`, and `hub.html` as the review start page.

```
python3 tools/preview/build_preview.py site <out_dir> <fonts_dir>
cp tools/preview/hub.html <out_dir>/index.html
```

`<fonts_dir>` holds `PretendardVariable.woff2` (npm pretendard@1.3.9) and `PretendardJPVariable.woff2` (gh orioncactus/pretendard@v1.3.9, packages/pretendard-jp).
