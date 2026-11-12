import json, subprocess, numpy as np, sys
import os; V=os.environ.get('VIDEO_ROOT', os.path.dirname(os.path.abspath(__file__)))
TL=json.load(open(f'{V}/timeline.json'))
def frames(path, w=110, h=180):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-vf',f'scale={w}:{h},format=gray','-f','rawvideo','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.uint8).reshape(-1,h,w).astype(np.int16)
res={}
for s in TL['scenes']:
    if s['kind']!='demo': continue
    f=frames(f"{V}/clips/{s['id']}.mp4")
    d=np.abs(np.diff(f,axis=0)).mean(axis=(1,2))  # per frame change
    mov=d>0.35
    runs=[];i=0;n=len(mov)
    while i<n:
        if not mov[i]:
            j=i
            while j<n and not mov[j]: j+=1
            if (j-i)/30>=0.6: runs.append((round((i+1)/30,2),round((j+1)/30,2)))
            i=j
        else: i+=1
    clipend=len(f)/30
    if s['dur']-clipend>0.05: runs.append((round(clipend,2),s['dur']))
    last=s['lines'][-1]['end']
    res[s['id']]={'dur':s['dur'],'clip':round(clipend,2),'lastLineEnd':last,'static':runs}
    print(f"{s['id']:10s} dur {s['dur']:5.1f} clip {clipend:5.2f} lastLineEnd {last:5.2f} lines {[ (l['start'],l['end']) for l in s['lines']]}\n   static {runs}")
json.dump(res,open(f'{V}/static.json','w'),indent=1)
