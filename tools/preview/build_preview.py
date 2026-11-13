# Build a preview copy of site/ that works inside a claude.ai Artifact:
# fonts bundled locally, directory links pointed at index.html files, landing renamed to home.html.
import os, re, shutil, sys
SRC, OUT, FONTS = sys.argv[1], sys.argv[2], sys.argv[3]
if os.path.exists(OUT): shutil.rmtree(OUT)
shutil.copytree(SRC, OUT)
os.makedirs(f"{OUT}/assets/fonts", exist_ok=True)
for f in ("PretendardVariable.woff2", "PretendardJPVariable.woff2"):
    shutil.copy(f"{FONTS}/{f}", f"{OUT}/assets/fonts/{f}")
open(f"{OUT}/assets/fonts.css", "w").write(
"""@font-face { font-family: "Pretendard Variable"; src: url("fonts/PretendardVariable.woff2") format("woff2-variations"); font-weight: 45 920; font-style: normal; font-display: swap; }
@font-face { font-family: "Pretendard JP Variable"; src: url("fonts/PretendardJPVariable.woff2") format("woff2-variations"); font-weight: 45 920; font-style: normal; font-display: swap; }
""")
cdn = re.compile(r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/gh/orioncactus/pretendard[^"]*">\n?')
def fix(path, text):
    depth = path.count("/")  # 0 for root files, 1 for migrate/index.html
    up = "../" * depth
    # one local font stylesheet instead of the two CDN ones
    first = [True]
    def rep(m):
        if first[0]:
            first[0] = False
            return f'<link rel="stylesheet" href="{up}assets/fonts.css">\n'
        return ""
    text = cdn.sub(rep, text)
    for d in ("migrate", "status", "docs", "admin"):
        text = re.sub(rf'href="((?:\.\./)?){d}/', rf'href="\1{d}/index.html', text)
        text = text.replace(f'href="{d}/index.html#', f'href="{d}/index.html#')
    return text
for root, _, files in os.walk(OUT):
    for f in files:
        p = os.path.join(root, f); rel = os.path.relpath(p, OUT)
        if f.endswith(".html"):
            t = open(p).read(); open(p, "w").write(fix(rel, t))
js = f"{OUT}/assets/shell.js"; s = open(js).read()
for d in ("migrate", "status", "docs"):
    s = s.replace(f'root + "{d}/"', f'root + "{d}/index.html"')
s = s.replace("class=\"cj-brand\" href=\"' + root + '\"", "class=\"cj-brand\" href=\"' + root + 'home.html\"")
open(js, "w").write(s)
mg = f"{OUT}/assets/pages/migrate.js"; s = open(mg).read()
s = s.replace('+ "docs/";', '+ "docs/index.html";'); open(mg, "w").write(s)
os.rename(f"{OUT}/index.html", f"{OUT}/home.html")
print("built", OUT)
