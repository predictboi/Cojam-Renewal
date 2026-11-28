# python3 e2e/sidebyside.py : joins captures/compare/<name>-app.png and -proto.png side by side and prints the pixel difference
import glob, os
from PIL import Image, ImageChops
for a in sorted(glob.glob('captures/compare/*-app.png')):
    name = os.path.basename(a)[:-8]; b = a.replace('-app.png', '-proto.png')
    A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
    h = max(A.height, B.height); im = Image.new('RGB', (A.width + B.width + 24, h), 'white'); im.paste(A, (0, 0)); im.paste(B, (A.width + 24, 0))
    im.save(f'captures/compare/{name}-side.png')
    w = max(A.width, B.width); X = Image.new('RGB', (w, h), 'white'); X.paste(A); Y = Image.new('RGB', (w, h), 'white'); Y.paste(B)
    d = ImageChops.difference(X, Y).convert('L').point(lambda v: 255 if v > 40 else 0)
    cnt = sum(1 for v in d.tobytes() if v)
    print(f'{name:10s} app {A.size} prototype {B.size} differing pixels {cnt/(w*h)*100:.3f}%')
