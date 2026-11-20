"""Final audio mix for the Polyquest film.

usage: python3 mix.py narr     -> mix_narr.wav   (voice + ducked music + UI sounds)
       python3 mix.py narr --keep-voice   keep the voice at exactly -16 LUFS and let the overall level fall where it lands
                                          (by default the whole mix is normalised to -14 LUFS, which lifts the voice ~1 to 3 dB:
                                          with the music 14 dB under the voice the two targets cannot both hold exactly)
       python3 mix.py silent   -> mix_silent.wav (music + UI sounds, for the subtitle only version)

Inputs (all optional except timeline.json):
  ../timeline.json               scene start / dur, line start per scene, film total
  ../clips/<scene>.events.json   [{"t", "type": tap|type|scroll|success|pop, "label"}], t relative to the scene start
  bgm.mp3 (user supplied, preferred) or bgm_synth.wav
  ../narr/line_XX.wav            narration lines (narr mode), placed at scene.start + line.start
  sfx/*.wav                      UI sounds (make_sfx.py)
Testing: env NARR_DIR (default ../narr) and MIX_OUT (default mix_<mode>.wav next to this file).
Targets: narr: voice -16 LUFS, music ~14 dB under the voice while speaking (250 ms ramps), overall -14 LUFS;
         silent: overall -18 LUFS. True peak below -1 dBTP in both. Output 48 kHz stereo 16 bit."""
import json, os, re, sys, subprocess
import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile
from scipy.signal import resample_poly, lfilter
from scipy.ndimage import maximum_filter1d

H = os.path.dirname(os.path.abspath(__file__))
V = os.path.dirname(H)
SR = 48000
MODE = sys.argv[1] if len(sys.argv) > 1 else 'silent'
KEEP_VOICE = '--keep-voice' in sys.argv
assert MODE in ('narr', 'silent'), 'mode must be narr or silent'

VOICE_LUFS = -16.0
DUCK_UNDER_VOICE = 14.0      # dB, music loudness under the voice while speaking
DUCK_DEPTH = 8.0             # dB, how far the music dips when the voice comes in
TARGET = {'narr': -14.0, 'silent': -18.0}[MODE]
TP_CEIL = -1.5               # dBTP, leaves room under -1 dBTP after encoding
# UI sound gains (dB on files normalised to -6 dBFS peak); narr mode sits 4 dB louder overall so lift them a little
SFX_GAIN = {'tap': 0, 'type': -12, 'success': -5, 'pop': -6, 'whoosh': -12}
SFX_NARR_LIFT = 2.0
TYPE_MAP = {'tap': 'tap', 'click': 'tap', 'type': 'type', 'success': 'success', 'done': 'success',
            'pop': 'pop', 'badge': 'pop', 'appear': 'pop', 'whoosh': 'whoosh'}

NARR_DIR = os.environ.get('NARR_DIR', f'{V}/narr')
meter = pyln.Meter(SR)


def load(path, channels=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, channels).T.copy()


def lufs(x):
    v = meter.integrated_loudness(x.T)
    return v if np.isfinite(v) else -99.0


def db2g(d): return 10 ** (d / 20)


SEGS = json.load(open(os.environ['CUTS'])) if os.environ.get('CUTS') else None
INS = os.environ.get('INSERT')            # "at_seconds:dur_seconds:events.json" a clip spliced into the trimmed film
INS_AT, INS_DUR, INS_EV = (float(INS.split(':')[0]), float(INS.split(':')[1]), INS.split(':')[2]) if INS else (None, 0.0, None)
def mapT(t):
    m = mapT0(t)
    if m is not None and INS_AT is not None and m >= INS_AT - 1e-6: m += INS_DUR
    return m


def mapT0(t):
    """master time -> trimmed film time (None inside a cut)"""
    if not SEGS: return t
    off = 0.0
    for a, b in SEGS:
        if a - 1e-6 <= t < b: return off + t - a
        off += b - a
    return None


def snapT(t):
    """like mapT, but a time inside a cut lands on the first kept moment after it"""
    m = mapT(t)
    if m is not None or not SEGS: return m
    nxt = min((a for a, b in SEGS if a >= t), default=SEGS[-1][1] - 1e-3)
    return mapT(nxt)


def add(buf, start_s, x, gain=1.0, raw=False):
    if not raw:
        start_s = mapT(start_s)
        if start_s is None: return
    s = int(round(start_s * SR))
    if s < 0: x = x[:, -s:]; s = 0
    e = min(buf.shape[1], s + x.shape[1])
    if e > s: buf[:, s:e] += x[:, :e - s] * gain


def true_peak_env(x):
    """per sample max of |x| at 4x oversampling across channels"""
    up = np.abs(resample_poly(x, 4, 1, axis=1)).max(axis=0)
    n = x.shape[1]
    return up[:n * 4].reshape(n, 4).max(axis=1)


def limit(x, ceil_db=TP_CEIL, look=0.005, rel=0.10):
    c = db2g(ceil_db)
    pk = maximum_filter1d(true_peak_env(x), 2 * int(look * SR) + 1)
    red = 1 - np.minimum(1, c / np.maximum(pk, 1e-9))
    ar = np.exp(-1 / (rel * SR))
    red = np.maximum(red, lfilter([1 - ar], [1, -ar], red))
    aa = np.exp(-1 / (0.002 * SR))
    red = np.maximum(lfilter([1 - aa], [1, -aa], red[::-1])[::-1], red)
    return x * (1 - red)


def measure_ffmpeg(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    tail = r[r.rfind('Summary:'):]
    I = re.search(r'I:\s+(-?[\d.]+) LUFS', tail); LRA = re.search(r'LRA:\s+([\d.]+) LU', tail)
    TP = re.search(r'True peak:\s+Peak:\s+(-?[\d.inf]+) dBFS', tail)
    return float(I.group(1)), float(LRA.group(1)), float(TP.group(1))


TL = json.load(open(f'{V}/timeline.json'))
TOTAL = (float(TL['total']) if not SEGS else sum(b - a for a, b in SEGS)) + INS_DUR
N = int(round(TOTAL * SR))

# ---------------------------------------------------------------- music
music_src = f'{H}/bgm.mp3' if os.path.exists(f'{H}/bgm.mp3') else f'{H}/bgm_synth.wav'
mus = load(music_src)
if mus.shape[1] < N:                       # loop a short licensed track with a 2 s crossfade
    xf = 2 * SR; out = mus.copy()
    while out.shape[1] < N:
        ramp = np.linspace(0, 1, xf)
        out[:, -xf:] = out[:, -xf:] * (1 - ramp) + mus[:, :xf] * ramp
        out = np.concatenate([out, mus[:, xf:]], axis=1)
    mus = out
mus = mus[:, :N]
t = np.arange(N) / SR
mus *= np.clip((TOTAL - t) / 2.0, 0, 1) ** 1.5      # 2 s fade out ending at the film end
mus *= np.minimum(1, t / 0.02)
mus_l = lufs(mus)

# ---------------------------------------------------------------- voice
voice = np.zeros((2, N)); placed = []
if MODE == 'narr':
    missing = []
    for sc in TL['scenes']:
        for ln in sc['lines']:
            p = f"{NARR_DIR}/line_{ln['idx']:02d}.wav"
            if not os.path.exists(p): missing.append(ln['idx']); continue
            v = load(p, 1)
            st = mapT(sc['start'] + ln['start'])
            if st is None: print(f"WARNING: line {ln['idx']} starts inside a cut"); continue
            add(voice, st, np.vstack([v, v]), raw=True)
            placed.append((ln['idx'], st, st + v.shape[1] / SR))
    if missing: print(f'WARNING: missing narration lines {missing}')
    if not placed: raise SystemExit('narr mode: no narration lines found in ../narr (run split_narr.py first)')
    placed.sort(key=lambda r: r[1])
    for a, b in zip(placed, placed[1:]):
        if a[2] > b[1] + 0.01: print(f'WARNING: line {a[0]} ({a[2]:.2f}s) overlaps line {b[0]} ({b[1]:.2f}s)')
    if placed[-1][2] > TOTAL: print(f'WARNING: last line ends at {placed[-1][2]:.2f}s, after the film end {TOTAL:.2f}s')
    voice *= db2g(VOICE_LUFS - lufs(voice))

    # ducking: speech mask, gaps under 1 s bridged, 250 ms raised cosine ramps that finish as the voice starts
    mask = np.zeros(N)
    for _, a, b in placed: mask[int(a * SR):int(min(b, TOTAL) * SR)] = 1
    on = np.flatnonzero(np.diff(np.concatenate([[0], mask, [0]])) != 0).reshape(-1, 2)
    for (a0, a1), (b0, b1) in zip(on, on[1:]):
        if (b0 - a1) / SR < 1.0: mask[a1:b0] = 1
    k = int(0.25 * SR); kern = np.hanning(k); kern /= kern.sum()
    sh = int(0.125 * SR)                  # shift so the ramp is complete at speech onset and starts at speech end
    dil = maximum_filter1d(mask, 2 * sh + 1)
    duck = np.convolve(dil, kern, mode='same')
    mus_gain_db = (VOICE_LUFS - DUCK_UNDER_VOICE + DUCK_DEPTH) - mus_l
    mus *= db2g(mus_gain_db) * db2g(-DUCK_DEPTH * duck)
else:
    mus *= db2g(TARGET - mus_l)

bed = mus + voice
g1 = 0.0 if (MODE == 'narr' and KEEP_VOICE) else TARGET - lufs(bed)
bed *= db2g(g1)

# ---------------------------------------------------------------- UI sounds
TYPE_DEFAULT = {'email': 18, 'code': 6, 'otp': 6, 'amount': 3, 'search': 6}
def type_chars(e):
    """how many key ticks a single "type" event gets: explicit chars/n field, else the text after "type ", else a guess by field name"""
    for k in ('chars', 'n', 'count'):
        if isinstance(e.get(k), (int, float)): return int(max(1, min(40, e[k])))
    lab = str(e.get('label', '')).strip()
    if lab.lower().startswith('type '):
        text = lab[5:]
        if re.match(r'^[\d,.]+ ', text): text = text.split(' ')[0]      # "2,500,000 BONK": only the number is typed
        return max(1, min(40, len(re.findall(r'[0-9A-Za-z@._]', text))))
    return TYPE_DEFAULT.get(lab.lower(), 8)


sfx_cache = {}
def sfx(name):
    if name not in sfx_cache: sfx_cache[name] = load(f'{H}/sfx/{name}.wav')
    return sfx_cache[name]

S = np.zeros((2, N)); counts = {}
lift = SFX_NARR_LIFT if MODE == 'narr' else 0.0
rng = np.random.default_rng(3)
last_pop = -9.0
for sc in TL['scenes']:
    p = f"{V}/clips/{sc['id']}.events.json"
    if not os.path.exists(p): continue
    try: ev = sorted(json.load(open(p)), key=lambda e: e['t'])
    except Exception as e: print(f'WARNING: cannot read {p}: {e}'); continue
    for i, e in enumerate(ev):
        name = TYPE_MAP.get(str(e.get('type', '')).lower())
        if not name: continue
        t0 = sc['start'] + float(e['t'])
        if t0 >= sc['start'] + sc['dur']: continue
        if name == 'type':
            nxt = next((f for f in ev[i + 1:] if f.get('type') == 'type'), None)
            per_char = nxt is not None and float(nxt['t']) - float(e['t']) < 0.25
            n = 1 if per_char else type_chars(e)
            for c in range(n):
                add(S, t0 + c * 0.09, sfx('type'), db2g(SFX_GAIN['type'] + lift + rng.uniform(-2, 1)))
            counts['type'] = counts.get('type', 0) + n
            continue
        if name == 'pop':                         # thin rapid pop runs (tiles, coins) to one every 0.2 s, slightly varied
            if t0 - last_pop < 0.2: continue
            last_pop = t0
            add(S, t0, sfx(name), db2g(SFX_GAIN[name] + lift + rng.uniform(-2, 0)))
        else:
            add(S, t0, sfx(name), db2g(SFX_GAIN[name] + lift))
        counts[name] = counts.get(name, 0) + 1
if INS_EV:
    for e in json.load(open(INS_EV)):
        name = TYPE_MAP.get(str(e.get('type', '')).lower())
        if name: add(S, INS_AT + float(e['t']), sfx(name), db2g(SFX_GAIN[name] + lift), raw=True); counts[name] = counts.get(name, 0) + 1
for sc in TL['scenes'][1:]:                       # a soft whoosh peaking on every scene cut
    add(S, snapT(sc['start']) - 0.35, sfx('whoosh'), db2g(SFX_GAIN['whoosh'] + lift), raw=True)
    counts['whoosh'] = counts.get('whoosh', 0) + 1

mix = bed + S
g2 = 0.0 if (MODE == 'narr' and KEEP_VOICE) else TARGET - lufs(mix)
mix *= db2g(g2)
mix = limit(mix)
out = os.environ.get('MIX_OUT', f'{H}/mix_{MODE}.wav')
pcm = (mix.T * 32767 + rng.uniform(-.5, .5, mix.T.shape) + rng.uniform(-.5, .5, mix.T.shape)).round().clip(-32768, 32767).astype(np.int16)
wavfile.write(out, SR, pcm)

I, LRA, TP = measure_ffmpeg(out)
print(f'music: {os.path.basename(music_src)}; ui sounds: {counts or "none (no events files)"}')
if MODE == 'narr':
    v_final = VOICE_LUFS + g1 + g2
    print(f'voice lines placed: {len(placed)}, voice in the final mix {v_final:.1f} LUFS, music while speaking about {v_final - DUCK_UNDER_VOICE:.1f} LUFS, between lines {v_final - DUCK_UNDER_VOICE + DUCK_DEPTH:.1f} LUFS')
print(f'wrote {out}: {N / SR:.2f}s 48 kHz stereo | integrated {I:.1f} LUFS, LRA {LRA:.1f} LU, true peak {TP:.1f} dBTP')
