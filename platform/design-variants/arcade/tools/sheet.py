# python3 tools/sheet.py out.png file1 file2 ... : a contact sheet of captures (for review only)
import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]; ims=[Image.open(f).convert('RGB') for f in fs]
W=390; ims=[i.resize((W,int(i.height*W/i.width))) for i in ims]; H=max(i.height for i in ims)
s=Image.new('RGB',((W+12)*len(ims),H),'#888')
for k,i in enumerate(ims): s.paste(i,(k*(W+12),0))
s.save(out)
