# python3 tools/sheet.py out.png a.png b.png ... : contact sheet of captures side by side at half of the 2x capture (so 1:1 CSS pixels)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
h = max(i.height for i in ims); W = sum(i.width for i in ims) + 20 * (len(ims) - 1)
o = Image.new('RGB', (W, h), '#777'); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 20
o.resize((o.width // 2, o.height // 2), Image.LANCZOS).save(out)
