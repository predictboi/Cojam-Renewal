"""Builds timeline.json from script.json.
Line speech lengths come from narr/lines.json when the narration has been split (measured), otherwise from an estimate.
Rules: a scene lasts at least its MIN seconds; lines start 0.6 s into a scene and follow each other with a 0.5 s gap;
each subtitle stays up for max(speech, 2.5 s, 0.18 s per syllable + 0.6 s) and until 0.2 s before the next line."""
import json, re, os, sys
H = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(f'{H}/script.json'))
MIN = {'hook': 10, 'explain': 22, 'login': 22, 'deposit': 15, 'browse': 18, 'trade': 22, 'swap': 22, 'polymarket': 28, 'mypage': 13, 'outro': 8}
meas = json.load(open(f'{H}/narr/lines.json')) if os.path.exists(f'{H}/narr/lines.json') else None
FPS = 30
def syl(t): return len(re.findall(r'[가-힣A-Za-z0-9]', t))
def est(say): return round(syl(say) / 6.2 + 0.25, 2)
t = 0.0; out = []; k = 0
for s in S['scenes']:
    lines = []; cur = 0.6
    for l in s['lines']:
        sp = meas[k]['dur'] if meas else est(l['say'])
        read = max(sp + 0.3, 2.5, syl(l['sub']) * 0.18 + 0.6)
        lines.append({'sub': l['sub'], 'start': round(cur, 2), 'speech': sp, 'read': round(read, 2), 'idx': k})
        cur += max(sp, read * 0.85) + 0.5; k += 1
    TAIL = {'explain': 5.0}  # explain ends with a visual reward beat (no subtitle) after its last line
    dur = max(MIN[s['id']], cur + TAIL.get(s['id'], 0.6))
    for i, l in enumerate(lines):
        nxt = lines[i + 1]['start'] - 0.2 if i + 1 < len(lines) else dur - 0.3
        l['end'] = round(max(l['start'] + l['read'], min(nxt, l['start'] + max(l['read'], l['speech'] + 0.6))), 2)
        l['end'] = round(min(l['end'], nxt), 2)
    out.append({'id': s['id'], 'kind': s['kind'], 'chip': s['chip'], 'head': s['head'], 'start': round(t, 2), 'dur': round(dur, 2), 'lines': lines})
    t += dur
tl = {'fps': FPS, 'width': 1080, 'height': 1920, 'total': round(t, 2), 'frames': int(round(t * FPS)), 'measured': bool(meas), 'scenes': out}
json.dump(tl, open(f'{H}/timeline.json', 'w'), ensure_ascii=False, indent=1)
print('total', round(t, 1), 's measured' if meas else 's (estimated)')
for s in out: print(f"{s['id']:11s} start {s['start']:6.1f} dur {s['dur']:5.1f} lines {len(s['lines'])}")
