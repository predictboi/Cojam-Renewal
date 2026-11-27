# python3 tools/sheet.py out.png a.png b.png ...   contact sheet for review
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
h = 1500
ims = [i.resize((int(i.width * min(1, h / i.height)), int(i.height * min(1, h / i.height)))) if i.height > h else i for i in ims]
W = sum(i.width for i in ims) + 16 * (len(ims) + 1); H = max(i.height for i in ims) + 32
s = Image.new('RGB', (W, H), (60, 60, 60)); x = 16
for i in ims: s.paste(i, (x, 16)); x += i.width + 16
s.save(out)
