# python3 e2e/diff.py a.png b.png out.png : percentage of differing pixels and a diff image
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
w, h = max(a.width, b.width), max(a.height, b.height)
A = Image.new('RGB', (w, h), 'white'); A.paste(a); B = Image.new('RGB', (w, h), 'white'); B.paste(b)
d = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 40 else 0)
bbox = d.getbbox()
cnt = sum(1 for v in d.getdata() if v)
print(f"size a={a.size} b={b.size} diff={cnt/(w*h)*100:.3f}% bbox={bbox}")
if len(sys.argv) > 3: d.save(sys.argv[3])
