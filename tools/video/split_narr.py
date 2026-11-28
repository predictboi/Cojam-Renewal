"""Split the single MiniMax narration file into one wav per script line.

usage: python3 split_narr.py [narration.mp3] [--out DIR] [-v]
  narration.mp3  defaults to the newest audio file in ../tts or ../narr
  --out DIR      defaults to ../narr (writes line_XX.wav and lines.json there)
  -v             always print the per line table

The file holds every line of script.json (scenes[].lines, in order) separated by ~0.5 s pauses inside a scene
and ~1.2 s pauses between scenes. Method:
  1. decode to 44.1 kHz mono, 10 ms RMS frames in dB
  2. adaptive threshold between the noise floor and the speech level (percentiles)
  3. speech islands: voiced runs; gaps under 0.12 s (inside words) are closed; quiet or tiny runs (breaths, clicks) dropped
  4. heuristic: every silence >= MIN_GAP is a line boundary; if the count differs from the number of script lines,
     merge across the shortest gaps (too many) or split the longest segment at its longest inner silence (too few)
  5. cross check: a dynamic programming alignment picks the boundaries that best fit the expected line lengths
     (syllable estimate, scaled to this voice) and the 0.5 s / 1.2 s pause pattern. When the heuristic needed
     corrections or fits clearly worse, the alignment wins. A warning table is printed whenever anything was corrected.
  6. each line is trimmed with a 40 ms pad (never past the middle of the gap), 5 ms edge fades, written as
     line_XX.wav (44.1 kHz mono 16 bit, XX = global line index from 00) plus lines.json [{"idx", "dur"}],
     dur = file length in seconds.
"""
import json, os, re, sys, subprocess
import numpy as np
from scipy.io import wavfile

H = os.path.dirname(os.path.abspath(__file__))
V = os.path.dirname(H)
SR = 44100
FRAME = 0.010
MIN_GAP = 0.30          # a pause this long separates lines (inserted pauses are 0.5 s and 1.2 s)
MIN_ISLAND_GAP = 0.12   # shorter silences are inside words
PAD = 0.040


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def frames_db(x):
    hop = int(FRAME * SR)
    n = len(x) // hop
    return 10 * np.log10(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)


def runs(mask):
    """[(start, end)] of True runs, end exclusive, in frames"""
    d = np.diff(np.concatenate([[0], mask.astype(int), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def detect(db):
    floor = np.percentile(db, 5)
    speech = np.percentile(db[db > floor + 6], 75) if np.any(db > floor + 6) else floor + 30
    thr = floor + 0.33 * (speech - floor)
    thr = min(max(thr, floor + 6), speech - 18)
    sm = np.convolve(db, np.ones(3) / 3, mode='same')     # plosive gaps inside words do not count as silence
    return sm > thr, thr, floor, speech


def islands(voiced, db, speech):
    out = []
    for s, e in runs(voiced):
        if (e - s) * FRAME < 0.05 or db[s:e].max() < speech - 20: continue
        if out and (s - out[-1][1]) * FRAME < MIN_ISLAND_GAP: out[-1] = (out[-1][0], e)
        else: out.append((s, e))
    return out


def gap_len(isl, j): return (isl[j + 1][0] - isl[j][1]) * FRAME
def line_cost(isl, a, b, est): return np.log(max((isl[b][1] - isl[a][0]) * FRAME, 0.05) / est) ** 2
def gap_cost(isl, j, exp): return 2.0 * np.log(gap_len(isl, j) / (exp + 0.1)) ** 2


def cost(isl, B, est, exp_gap):
    edges = [-1] + list(B) + [len(isl) - 1]
    c = sum(line_cost(isl, edges[k] + 1, edges[k + 1], est[k]) for k in range(len(edges) - 1))
    return c + sum(gap_cost(isl, j, exp_gap[k]) for k, j in enumerate(B))


def heuristic(isl, want, log):
    gaps = [gap_len(isl, j) for j in range(len(isl) - 1)]
    B = sorted(j for j, g in enumerate(gaps) if g >= MIN_GAP)
    found = len(B) + 1
    while len(B) + 1 > want:
        j = min(B, key=lambda j: gaps[j])
        log.append(f'merge across a {gaps[j]:.2f}s gap at {isl[j][1] * FRAME:.2f}s')
        B.remove(j)
    while len(B) + 1 < want:
        edges = [-1] + B + [len(isl) - 1]
        order = sorted(range(len(edges) - 1), key=lambda k: isl[edges[k + 1]][1] - isl[edges[k] + 1][0], reverse=True)
        inner = []
        for k in order:
            inner = list(range(edges[k] + 1, edges[k + 1]))
            if inner: break
        if not inner: raise SystemExit('cannot find enough silences to reach the line count')
        j = max(inner, key=lambda j: gaps[j])
        log.append(f'split at a {gaps[j]:.2f}s inner silence at {isl[j][1] * FRAME:.2f}s')
        B = sorted(B + [j])
    return B, found


def align(isl, want, est, exp_gap):
    M = len(isl); INF = 1e18
    dp = np.full((want, M), INF); bk = np.full((want, M), -1, int)
    for j in range(M): dp[0][j] = line_cost(isl, 0, j, est[0])
    for k in range(1, want):
        for j in range(k, M):
            for i in range(k - 1, j):
                if dp[k - 1][i] >= INF: continue
                v = dp[k - 1][i] + gap_cost(isl, i, exp_gap[k - 1]) + line_cost(isl, i + 1, j, est[k])
                if v < dp[k][j]: dp[k][j], bk[k][j] = v, i
    B = []; j = M - 1
    for k in range(want - 1, 0, -1):
        j = bk[k][j]; B.append(j)
    return sorted(B)


def syl(t): return len(re.findall(r'[가-힣A-Za-z0-9]', t))


def main():
    args = [a for a in sys.argv[1:] if a != '-v']
    out_dir = f'{V}/narr'
    if '--out' in args:
        i = args.index('--out'); out_dir = args[i + 1]; args = args[:i] + args[i + 2:]
    if args:
        src = args[0]
    else:
        cands = []
        for d in (f'{V}/tts', f'{V}/narr'):
            if os.path.isdir(d):
                cands += [os.path.join(d, f) for f in os.listdir(d)
                          if f.lower().endswith(('.mp3', '.wav', '.m4a', '.flac')) and not f.startswith('line_')]
        if not cands: raise SystemExit('no narration file given or found in tts/ or narr/')
        src = max(cands, key=os.path.getmtime)
    S = json.load(open(f'{V}/script.json'))
    lines = [(si, l) for si, s in enumerate(S['scenes']) for l in s['lines']]
    want = len(lines)
    exp_gap = [1.2 if k + 1 < want and lines[k + 1][0] != lines[k][0] else 0.5 for k in range(want)]

    x = decode(src)
    db = frames_db(x)
    voiced, thr, floor, speech = detect(db)
    isl = islands(voiced, db, speech)
    if len(isl) < want: raise SystemExit(f'only {len(isl)} speech islands for {want} lines')
    # expected line lengths: syllable estimate scaled so lines plus expected pauses fill the voiced span
    est0 = np.array([syl(l['say']) / 6.2 + 0.25 for _, l in lines])
    span = (isl[-1][1] - isl[0][0]) * FRAME
    est = est0 * max(0.3, span - sum(g + 0.1 for g in exp_gap[:-1])) / est0.sum()

    log = []
    Bh, found = heuristic(isl, want, log)
    Ba = align(isl, want, est, exp_gap)
    ch, ca = cost(isl, Bh, est, exp_gap), cost(isl, Ba, est, exp_gap)
    if Bh == Ba: B, method = Bh, 'silence rule (alignment agrees)'
    elif log or ch > ca + 1.0: B, method = Ba, f'alignment (cost {ca:.2f}; silence rule {ch:.2f})'
    else: B, method = Bh, f'silence rule (cost {ch:.2f}; alignment {ca:.2f} disagreed)'
    print(f'source {src}: {len(x) / SR:.2f}s, floor {floor:.1f} dB, speech {speech:.1f} dB, threshold {thr:.1f} dB')
    print(f'lines in script: {want}, segments by silence rule: {found}, used: {method}')

    edges = [-1] + B + [len(isl) - 1]
    segs = [(isl[edges[k] + 1][0], isl[edges[k + 1]][1]) for k in range(want)]
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.startswith('line_') and f.endswith('.wav'): os.remove(os.path.join(out_dir, f))
    meta, rows = [], []
    warn = bool(log) or Bh != Ba
    total = len(x) / SR
    for k, (s, e) in enumerate(segs):
        st, en = s * FRAME, e * FRAME
        prev_end = segs[k - 1][1] * FRAME if k > 0 else 0.0
        next_st = segs[k + 1][0] * FRAME if k + 1 < want else total
        a = max(st - PAD, (prev_end + st) / 2 if k > 0 else 0.0, 0.0)
        b = min(en + PAD, (en + next_st) / 2 if k + 1 < want else total, total)
        y = x[int(a * SR):int(b * SR)].copy()
        f = int(0.005 * SR)
        y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
        wavfile.write(f'{out_dir}/line_{k:02d}.wav', SR, (np.clip(y, -1, 1) * 32767).round().astype(np.int16))
        meta.append({'idx': k, 'dur': round(len(y) / SR, 3)})
        gap = next_st - en if k + 1 < want else None
        ratio = (en - st) / est[k]
        flag = []
        if gap is not None and exp_gap[k] >= 1.0 and gap < 0.85: flag.append('scene gap short')
        if gap is not None and exp_gap[k] < 1.0 and gap > 1.0: flag.append('line gap long')
        if ratio < 0.6 or ratio > 1.6: flag.append('length off')
        if flag: warn = True
        rows.append((k, st, en, en - st, est[k], gap, exp_gap[k] if k + 1 < want else None, ', '.join(flag), lines[k][1]['say']))
    json.dump(meta, open(f'{out_dir}/lines.json', 'w'), indent=1)

    if warn:
        print('\nWARNING: segmentation needed corrections or does not match the script pattern; check the table')
        for m in log: print('  silence rule: ' + m)
    if warn or '-v' in sys.argv:
        print(f'\n{"idx":>3} {"start":>7} {"end":>7} {"speech":>6} {"est":>5} {"gap":>5} {"exp":>4}  {"flag":24s} text')
        for k, st, en, sp, es, gap, eg, flag, say in rows:
            print(f'{k:3d} {st:7.2f} {en:7.2f} {sp:6.2f} {es:5.2f} {"" if gap is None else f"{gap:5.2f}":>5} '
                  f'{"" if eg is None else f"{eg:4.1f}":>4}  {flag:24s} {say[:30]}')
    print(f'\nwrote {want} lines to {out_dir} (total speech {sum(r[3] for r in rows):.1f}s)')


if __name__ == '__main__':
    main()
