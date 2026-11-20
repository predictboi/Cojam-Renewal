import json
import os; V=os.environ.get('VIDEO_ROOT', os.path.dirname(os.path.abspath(__file__)))
TL=json.load(open(f'{V}/timeline.json')); ST=json.load(open(f'{V}/static.json'))
TAIL={'login':18.6,'deposit':12.2,'browse':14.3,'trade':11.2,'swap':15.0,'polymarket':24.4,'mypage':9.0}
FPS=30; q=lambda x: round(x*FPS)/FPS
def sub(iv, P):  # interval minus protected list
    out=[iv]
    for a,b in P:
        nxt=[]
        for x,y in out:
            if b<=x or a>=y: nxt.append((x,y))
            else:
                if a>x: nxt.append((x,a))
                if b<y: nxt.append((b,y))
        out=nxt
    return out
cuts=[]  # master seconds
for s in TL['scenes']:
    if s['kind']!='demo': continue
    S0,D=s['start'],s['dur']
    P=[(l['start']-0.15,l['end']+0.25) for l in s['lines']]+[(0,0.5)]
    T=TAIL[s['id']]
    loc=[]
    for a,b in ST[s['id']]['static']:
        for x,y in sub((a+0.35,min(b,T)-0.1),P):
            if y-x>=0.4: loc.append((x,y))
    loc.append((T,D+(0.24 if s['id'] in ('trade','swap') else -0.25)))
    for x,y in loc: cuts.append((q(S0+x),q(S0+y),s['id']))
cuts.sort()
keep=[];t=0.0
for a,b,_ in cuts:
    if a-t<0.4 and keep: t=max(t,b); continue
    if a>t: keep.append([t,a])
    t=max(t,b)
keep.append([t,TL['total']])
new=sum(b-a for a,b in keep)
json.dump(keep,open(f'{V}/keep.json','w'))
print('cuts:'); [print(f'  {sid:10s} {a:7.2f} -> {b:7.2f} ({b-a:4.2f}s)') for a,b,sid in cuts]
print(f'total {TL["total"]:.1f}s -> {new:.1f}s, segments {len(keep)}')
