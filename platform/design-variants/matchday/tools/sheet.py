# python3 tools/sheet.py out.png a.png b.png ... : places captures side by side (cropped to the first 1800 px) for review.
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
ims = [i.crop((0, 0, i.width, min(i.height, 2400))) for i in ims]
h = max(i.height for i in ims); w = sum(i.width for i in ims) + 20 * (len(ims) - 1)
s = Image.new('RGB', (w, h), (120, 120, 120)); x = 0
for i in ims: s.paste(i, (x, 0)); x += i.width + 20
s.thumbnail((2000, 2000)); s.save(out)
