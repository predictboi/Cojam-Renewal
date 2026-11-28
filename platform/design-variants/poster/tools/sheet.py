# python3 tools/sheet.py out.png a.png b.png ... : a contact sheet for review (side by side, scaled to 390 wide each)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
ims = [i.resize((390, round(i.height * 390 / i.width))) for i in ims]
H = max(i.height for i in ims); sheet = Image.new('RGB', (len(ims) * 400, H), '#888')
for k, i in enumerate(ims): sheet.paste(i, (k * 400, 0))
sheet.save(out)
