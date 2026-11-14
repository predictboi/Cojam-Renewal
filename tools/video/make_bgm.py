"""Original, royalty free background music for the Polyquest film, synthesised in code.
Bright optimistic electronic pop around 112 BPM in F major: Rhodes style FM electric piano, additive plucked arpeggio
with ping pong delay, airy detuned pad, warm sub bass, soft kick, clap and shaker, light sidechain pump,
synthetic convolution reverb and a gentle limiter.
Length = timeline total + 3 s. The tempo is nudged so that the final tonic chord lands 3 s before the film end and rings out.
Writes bgm_synth.wav (44.1 kHz stereo, 16 bit) next to this file."""
import json, os, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

H = os.path.dirname(os.path.abspath(__file__))
V = os.path.dirname(H)
SR = 44100
rng = np.random.default_rng(112)

TL = json.load(open(f'{V}/timeline.json'))
FILM = float(TL['total'])
LENGTH = FILM + 3.0
T_FINAL = FILM - 3.0                     # downbeat of the last chord
NB = max(16, int(round(T_FINAL / (240 / 112))))
BAR = T_FINAL / NB
BEAT = BAR / 4
BPM = 60 / BEAT
N = int(LENGTH * SR)
t_all = np.arange(N) / SR


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


def sos_lp(f, order=2): return butter(order, f, 'low', fs=SR, output='sos')
def sos_hp(f, order=2): return butter(order, f, 'high', fs=SR, output='sos')
def sos_bp(lo, hi, order=2): return butter(order, [lo, hi], 'band', fs=SR, output='sos')


def add(buf, start, x):
    s = int(round(start * SR))
    if s >= buf.shape[-1]: return
    if s < 0: x = x[..., -s:]; s = 0
    e = min(buf.shape[-1], s + x.shape[-1])
    buf[..., s:e] += x[..., :e - s]


def pan(x, p):
    """equal power pan, p in [-1, 1]"""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


# ---------------------------------------------------------------- harmony
# voicings (midi) for the electric piano and pad, plus bass root
CH = {
    'Fmaj9':  ([57, 64, 67, 72], 41),
    'Cadd9':  ([55, 62, 64, 72], 36),
    'C/E':    ([55, 62, 64, 72], 40),
    'Dm9':    ([53, 60, 64, 69], 38),
    'Bbmaj9': ([57, 62, 65, 72], 34),
    'Am7':    ([55, 60, 64, 69], 33),
    'C6':     ([55, 62, 64, 69], 36),
    'Gm9':    ([58, 62, 65, 69], 43),
    'C9sus':  ([55, 60, 65, 70], 36),
    'C7':     ([55, 60, 64, 70], 36),
    'Fend':   ([57, 64, 67, 72, 76], 41),
}
P1 = ['Fmaj9', 'C/E', 'Dm9', 'Bbmaj9']          # I V vi IV
P2 = ['Bbmaj9', 'C6', 'Am7', 'Dm9']             # IV V iii vi
# arrangement: intro 4 bars, then 8 bar blocks, last 4 bars cadence, then the final chord on bar NB
BLOCKS = ['A', 'B', 'C', 'B', 'D', 'C', 'C', 'B', 'C', 'C', 'B', 'C', 'C']
section = []
for b in range(NB):
    if b < 4: section.append('I')
    elif b >= NB - 4: section.append('O')
    else: section.append(BLOCKS[min((b - 4) // 8, len(BLOCKS) - 1)])
chords = []
for b in range(NB):
    if b >= NB - 4: chords.append(['Dm9', 'Bbmaj9', 'Gm9', 'C9sus'][b - (NB - 4)])
    elif section[b] in 'C' and ((b - 4) // 4) % 2 == 1: chords.append(P2[b % 4])
    else: chords.append(P1[(b - 4) % 4] if b >= 4 else P1[b])
chords.append('Fend')

# per instrument level for each section (0 = silent)
LEV = {          # pad  ep   bass kick clap shak arp  mel
    'I': dict(pad=.8, ep=.75, bass=0, kick=0, clap=0, shak=.0, arp=.35, mel=0),
    'A': dict(pad=.8, ep=.85, bass=.8, kick=.6, clap=0, shak=.6, arp=.45, mel=0),
    'B': dict(pad=.85, ep=.9, bass=.95, kick=.85, clap=.7, shak=.8, arp=.8, mel=0),
    'C': dict(pad=.9, ep=.9, bass=1, kick=.9, clap=.8, shak=.9, arp=.9, mel=.8),
    'D': dict(pad=1, ep=.9, bass=.7, kick=.0, clap=0, shak=.7, arp=.8, mel=.4),
    'O': dict(pad=.9, ep=.9, bass=.8, kick=.5, clap=.0, shak=.5, arp=.55, mel=0),
}


def level_curve(name):
    """per sample gain curve: rises step at the bar line, falls by ramping over the previous bar (no sudden drops)."""
    xs, ys = [0.0], [LEV[section[0]][name]]
    for b in range(1, NB):
        prev, cur = LEV[section[b - 1]][name], LEV[section[b]][name]
        if cur > prev:
            xs += [b * BAR - 0.002, b * BAR]; ys += [prev, cur]
        else:
            xs.append(b * BAR); ys.append(cur)
    xs.append(LENGTH); ys.append(ys[-1])
    return np.interp(t_all, xs, ys)


def lev_at(name, tsec):
    b = min(NB - 1, max(0, int(tsec / BAR)))
    return LEV[section[b]][name]


# ---------------------------------------------------------------- instruments
def ep_note(m, dur, vel):
    f = mtof(m); rel = 0.45
    n = int((dur + rel + 0.05) * SR); t = np.arange(n) / SR
    idx = vel * (1.6 * np.exp(-t * 4.0) + 0.35)
    body = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    body2 = np.sin(2 * np.pi * f * 1.0018 * t + 0.6 * idx * np.sin(2 * np.pi * f * 1.0018 * t))
    tine = np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 14) * 0.2 * vel
    dec = np.exp(-t * (0.9 + f / 900))
    a = np.minimum(1, t / 0.004)
    r = np.clip(1 - (t - dur) / rel, 0, 1)
    return (0.6 * body + 0.4 * body2 + tine) * dec * a * r * vel


def pluck(m, vel, length=0.55):
    f = mtof(m); n = int(length * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    k = 1
    while k * f < 9000 and k <= 16:
        x += np.sin(2 * np.pi * k * f * t + rng.uniform(0, 6.28) * (k > 1)) / k ** 1.1 * np.exp(-t * (3 + 4.5 * k))
        k += 1
    a = np.minimum(1, t / 0.0025)
    return x * a * np.exp(-t * 4.5) * vel * np.clip((length - t) / 0.05, 0, 1)


def bell(m, dur, vel):
    f = mtof(m); n = int((dur + 1.0) * SR); t = np.arange(n) / SR
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.4, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph) * np.exp(-t * 3) + 0.08 * np.sin(3.01 * ph) * np.exp(-t * 6)
    env = np.minimum(1, t / 0.012) * np.exp(-t * 1.6) * np.clip(1 - (t - dur) / 0.6, 0, 1)
    return x * env * vel


def pad_chord(ms, start, dur, out):
    att, rel = 0.6, 1.2
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    env = np.minimum(1, t / att) ** 1.5 * np.clip(1 - (t - dur) / rel, 0, 1)
    for i, m in enumerate(ms):
        f = mtof(m)
        for d, p in ((-9, -0.75), (0, 0.0), (8, 0.75)):
            fd = f * 2 ** (d / 1200)
            x = np.zeros(n); k = 1
            while k * fd < 4000 and k <= 9:
                x += np.sin(2 * np.pi * k * fd * t + rng.uniform(0, 6.28)) / k
                k += 1
            add(out, start, pan(x * env, p * (0.6 if i % 2 else 1)))
        shimmer = np.sin(2 * np.pi * 2 * f * t) * 0.22 + np.sin(2 * np.pi * 4.003 * f * t) * 0.05
        add(out, start, pan(shimmer * env, 0.4 if i % 2 else -0.4))


def bass_note(m, start, dur, vel, out):
    f = mtof(m); n = int((dur + 0.12) * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.008) * (0.75 + 0.25 * np.exp(-t * 6)) * np.clip(1 - (t - dur) / 0.1, 0, 1)
    add(out, start, x * env * vel)


def kick(vel):
    n = int(0.38 * SR); t = np.arange(n) / SR
    f = 52 + 85 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    click = sosfilt(sos_lp(2500), rng.standard_normal(n)) * np.exp(-t * 300) * 0.25
    return (body + click) * vel * np.minimum(1, t / 0.0015) * np.clip((0.38 - t) / 0.06, 0, 1)


def clap(vel):
    n = int(0.28 * SR); t = np.arange(n) / SR
    nz = sosfilt(sos_bp(900, 3200), rng.standard_normal(n))
    env = np.zeros(n)
    for o, g in ((0, .6), (0.011, .7), (0.022, 1.0)):
        env += g * (t >= o) * np.exp(-np.clip(t - o, 0, None) * (110 if o < 0.02 else 18))
    return nz * env * vel * 0.5


def shaker(vel):
    n = int(0.09 * SR); t = np.arange(n) / SR
    nz = sosfilt(sos_bp(4500, 9000), rng.standard_normal(n))
    env = np.minimum(1, t / 0.012) * np.exp(-t * 45)
    return nz * env * vel


def hat(vel):
    n = int(0.12 * SR); t = np.arange(n) / SR
    nz = sosfilt(sos_hp(6500), rng.standard_normal(n))
    return nz * np.exp(-t * 38) * np.minimum(1, t / 0.002) * vel


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    lo = sosfilt(sos_bp(300, 1200), nz); hi = sosfilt(sos_bp(1500, 5000), nz)
    k = (t / dur) ** 1.5
    return (lo * (1 - k) + hi * k) * k ** 2 * 0.5 * np.clip((dur - t) / 0.08, 0, 1)


# ---------------------------------------------------------------- render
EP = np.zeros((2, N)); PAD = np.zeros((2, N)); BASS = np.zeros(N); ARP = np.zeros(N); MEL = np.zeros(N)
HAT = np.zeros(N); KICK = np.zeros(N); CLAP = np.zeros(N); SHAK = np.zeros(N); FX = np.zeros(N)
SW = BEAT / 4 * 0.12   # swing for off 16ths

# electric piano comping patterns (beat offset, length in beats, velocity)
EP_PAT = {
    'I': [(0, 3.8, .8)],
    'A': [(0, 1.4, .8), (1.5, 1.0, .6), (2.5, 1.4, .7)],
    'B': [(0, 1.4, .85), (1.5, 0.9, .6), (2.5, 0.9, .7), (3.5, 0.45, .55)],
    'C': [(0, 1.4, .85), (1.5, 0.9, .6), (2.5, 0.9, .7), (3.5, 0.45, .55)],
    'D': [(0, 2.4, .75), (2.5, 1.4, .6)],
    'O': [(0, 1.4, .8), (1.5, 1.0, .6), (2.5, 1.4, .7)],
}
for b in range(NB):
    sec = section[b]; ms, root = CH[chords[b]]; t0 = b * BAR
    if chords[b] == 'C9sus':
        # sus resolves to C7 on beat 3
        for (o, ln, v) in [(0, 1.9, .8), (2, 1.9, .8)]:
            vm = CH['C9sus'][0] if o == 0 else CH['C7'][0]
            for j, m in enumerate(vm):
                x = ep_note(m, ln * BEAT, v * (0.85 + 0.15 * rng.random()))
                add(EP, t0 + o * BEAT + j * 0.008, pan(x, -0.35 + 0.7 * j / (len(vm) - 1)))
    else:
        for (o, ln, v) in EP_PAT[sec]:
            for j, m in enumerate(ms):
                x = ep_note(m, ln * BEAT, v * (0.85 + 0.15 * rng.random()))
                add(EP, t0 + o * BEAT + j * 0.007 + rng.uniform(-0.003, 0.003), pan(x, -0.35 + 0.7 * j / (len(ms) - 1)))
    pad_chord([m - 12 if m > 66 else m for m in ms] + [ms[-1]], t0, BAR, PAD)
    # bass: root on 1, push on the and of 2, 3, and of 4 (fifth or octave)
    if b > 0 or sec != 'I':
        pat = [(0, 1.3, 1.0, 0), (1.5, 0.45, .7, 0), (2, 1.3, .9, 0), (3.5, 0.45, .7, 12 if b % 2 else 7)]
        if sec == 'D': pat = [(0, 1.9, .9, 0), (2, 1.9, .85, 0)]
        for (o, ln, v, iv) in pat:
            tt = t0 + o * BEAT
            r = root
            if chords[b] == 'C9sus' and o >= 2: r = 36
            bass_note(r + iv, tt, ln * BEAT, v * lev_at('bass', tt), BASS)
    # arpeggio: 8ths with a 16th pickup, chord tones over two octaves
    tones = sorted(set([m + 12 for m in ms] + [m + 24 for m in ms[:2]]))
    order = [0, 2, 1, 3, 2, 4, 3, 5]
    for k in range(8):
        if lev_at('arp', t0) == 0: break
        tt = t0 + k * BEAT / 2 + (SW if k % 2 else 0)
        m = tones[order[k] % len(tones)]
        v = (0.9 if k % 2 == 0 else 0.7) * (0.9 + 0.1 * rng.random())
        add(ARP, tt, pluck(m, v))
        if k == 7 and sec in 'BC':
            add(ARP, tt + BEAT / 4, pluck(tones[(order[k] + 1) % len(tones)], 0.55))
    # drums
    for q in range(4):
        tq = t0 + q * BEAT
        if sec in 'BCO' or (sec == 'A' and q in (0, 2)):
            add(KICK, tq, kick(0.95 if q == 0 else 0.85))
        if q in (1, 3) and sec in 'BC':
            add(CLAP, tq, clap(1.0))
        if sec in 'BC':
            add(HAT, tq + BEAT / 2, hat(0.8 + 0.2 * rng.random()))
        for s in range(4):
            ts = tq + s * BEAT / 4 + (SW if s % 2 else 0)
            add(SHAK, ts, shaker((0.9 if s == 2 else 0.55 if s % 2 else 0.35) * (0.85 + 0.3 * rng.random())))
    # gentle riser into a C block
    if b + 1 < NB and section[b + 1] == 'C' and sec != 'C':
        add(FX, t0, riser(BAR))

# melody hook in C sections (top line, chord tones of P1 / P2)
HOOK = {
    'Fmaj9':  [(0, 81, 1.5), (1.5, 79, .5), (2, 77, 1), (3, 79, 1)],
    'C/E':    [(0, 76, 1.5), (1.5, 72, .5), (2, 74, 1), (3, 76, 1)],
    'Dm9':    [(0, 77, 1.5), (1.5, 76, .5), (2, 74, 1), (3, 72, 1)],
    'Bbmaj9': [(0, 74, 2), (2, 72, 1), (3, 69, 1)],
    'C6':     [(0, 76, 1.5), (1.5, 74, .5), (2, 72, 2)],
    'Am7':    [(0, 72, 1), (1, 76, 1), (2, 79, 2)],
}
for b in range(NB):
    if section[b] not in 'CD': continue
    c = chords[b]
    if c not in HOOK: continue
    if section[b] == 'D' and b % 2: continue
    for (o, m, d) in HOOK[c]:
        add(MEL, b * BAR + o * BEAT, bell(m, d * BEAT, 0.8 * lev_at('mel', b * BAR)))

# final chord, rings out
tf = T_FINAL
ms, root = CH['Fend']
for j, m in enumerate(ms):
    add(EP, tf + j * 0.012, pan(ep_note(m, 5.6, 0.85), -0.4 + 0.8 * j / (len(ms) - 1)))
pad_chord([57, 60, 64, 67, 72], tf, 3.0, PAD)
_t = np.arange(int(5.5 * SR)) / SR
add(BASS, tf, (np.sin(2 * np.pi * mtof(41) * _t) + 0.3 * np.sin(4 * np.pi * mtof(41) * _t)) * np.minimum(1, _t / 0.008) * np.exp(-_t * 0.9) * 0.9)
add(KICK, tf, kick(0.7))
add(MEL, tf, bell(84, 3.0, 0.35))
add(ARP, tf, pluck(77, 0.6, 1.2)); add(ARP, tf + BEAT / 2, pluck(81, 0.45, 1.2)); add(ARP, tf + BEAT, pluck(84, 0.35, 1.2))

# ---------------------------------------------------------------- processing
print(f'bars {NB} + final chord, bar {BAR:.4f}s, bpm {BPM:.2f}, final chord at {T_FINAL:.2f}s, length {LENGTH:.2f}s')
lv = {k: level_curve(k) for k in ('pad', 'ep', 'kick', 'clap', 'shak', 'arp')}
# the final chord sits after the last bar; levels hold their last value which is section O
EP = sosfilt(sos_lp(7000), sosfilt(sos_hp(110), EP)) * lv['ep']
PAD = sosfilt(sos_hp(230), sosfilt(sos_lp(3800, 2), PAD)) * lv['pad']
BASS = sosfilt(sos_lp(420, 2), sosfilt(sos_hp(32), BASS))
ARP = sosfilt(sos_lp(8000), sosfilt(sos_hp(300), ARP)) * lv['arp']
MEL = sosfilt(sos_lp(5000), MEL)
KICK = KICK * lv['kick'].clip(0.35, 1)
CLAP = CLAP * lv['clap']
SHAK = sosfilt(sos_lp(9500), SHAK) * lv['shak']
HAT = sosfilt(sos_lp(12000), HAT) * lv['clap']

# sidechain pump keyed to the kick grid, depth follows the kick level
tau = np.mod(t_all, BEAT)
kick_on = lv['kick']
pump = 1 - kick_on * 0.32 * np.exp(-tau / 0.11) * np.minimum(1, tau / 0.006 + 0.3)
pump[t_all >= T_FINAL] = 1.0

# ping pong dotted eighth delay on the arp
d = int(0.75 * BEAT * SR)
arpL = ARP.copy(); arpR = ARP.copy()
for i, g in enumerate([0.32, 0.22, 0.14, 0.09]):
    sh = d * (i + 1)
    tgt = arpR if i % 2 == 0 else arpL
    tgt[sh:] += sosfilt(sos_lp(3500 - 500 * i), ARP)[:-sh] * g
ARP2 = np.stack([arpL * 0.8 + ARP * 0.2, arpR * 0.8 + ARP * 0.2])

G = dict(ep=0.24, pad=0.032, bass=0.24, arp=0.28, mel=0.10, kick=0.42, clap=1.1, shak=0.35, hat=0.18, fx=0.05)
dry = (EP * G['ep'] * (0.85 + 0.15 * pump)
       + PAD * G['pad'] * pump
       + np.stack([BASS, BASS]) * G['bass'] * pump
       + ARP2 * G['arp'] * (0.75 + 0.25 * pump)
       + np.stack([MEL, MEL]) * pan(np.ones(1), 0.15) * G['mel']
       + np.stack([KICK, KICK]) * G['kick']
       + pan(CLAP, -0.05) * G['clap']
       + pan(SHAK, 0.35) * G['shak']
       + pan(HAT, -0.3) * G['hat']
       + pan(FX, 0) * G['fx'])
for nm, st in [('ep', EP), ('pad', PAD), ('bass', BASS), ('arp', ARP), ('mel', MEL), ('kick', KICK), ('clap', CLAP), ('shak', SHAK), ('hat', HAT)]:
    print(f'  stem {nm:5s} rms {20 * np.log10(np.sqrt(np.mean((st * G[nm]) ** 2)) + 1e-12):6.1f} dB')

send = (EP.mean(0) * G['ep'] * 0.30 + PAD.mean(0) * G['pad'] * 0.45 + ARP * G['arp'] * 0.35 + MEL * G['mel'] * 0.45
        + CLAP * G['clap'] * 0.45 + HAT * G['hat'] * 0.12 + SHAK * G['shak'] * 0.15 + FX * G['fx'] * 0.6)

# synthetic stereo reverb: decaying noise, highs decay faster, 18 ms predelay
ir_len = int(2.6 * SR); ti = np.arange(ir_len) / SR
ir = np.zeros((2, ir_len))
for ch in range(2):
    nz = rng.standard_normal(ir_len)
    low = sosfilt(sos_lp(1800), nz) * np.exp(-ti * 6.9 / 2.1)
    high = sosfilt(sos_hp(1800), nz) * np.exp(-ti * 6.9 / 0.9) * 0.6
    ir[ch] = (low + high) * np.minimum(1, ti / 0.01)
ir = sosfilt(sos_lp(7000), ir)
ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
pre = int(0.018 * SR)
wet = np.stack([fftconvolve(send, ir[c])[:N] for c in range(2)])
wet = np.concatenate([np.zeros((2, pre)), wet[:, :-pre]], axis=1)
wet = sosfilt(sos_hp(200), wet)
mix = dry + wet * 0.9

# master: tame the very top, clean the sub, soft limit
mix = sosfilt(sos_lp(15000, 2), sosfilt(sos_hp(28, 2), mix))
mix = mix - 0.3 * sosfilt(sos_bp(240, 520, 1), mix)   # ~3 dB low mid dip
fade_in = np.minimum(1, t_all / 0.03)
fade_out = np.clip((LENGTH - t_all) / 0.6, 0, 1)
mix *= fade_in * fade_out


def limiter(x, ceil=0.89, att=0.002, rel=0.12, look=0.004):
    pk = np.max(np.abs(x), axis=0)
    from scipy.ndimage import maximum_filter1d
    L = int(look * SR)
    pk = maximum_filter1d(pk, 2 * L + 1)
    g = np.minimum(1, ceil / np.maximum(pk, 1e-9))
    # smooth: fast attack, slow release (one pole, run through lfilter on the reduction)
    from scipy.signal import lfilter
    ar = np.exp(-1 / (rel * SR))
    red = 1 - g
    # peak hold release: y = max(red, ar*y_prev) approximated by lfilter of red then max
    sm = lfilter([1 - ar], [1, -ar], red)
    red = np.maximum(red, sm)
    aa = np.exp(-1 / (att * SR))
    red = lfilter([1 - aa], [1, -aa], red[::-1])[::-1]
    red = np.maximum(red, 1 - g)
    return x * (1 - red)


import pyloudnorm as pyln
meter = pyln.Meter(SR)
lufs0 = meter.integrated_loudness(mix.T)
target = -16.0
mix *= 10 ** ((target - lufs0) / 20)
mix = limiter(mix)
mix = np.clip(mix, -0.95, 0.95)
lufs = meter.integrated_loudness(mix.T)
peak = 20 * np.log10(np.max(np.abs(mix)))
rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)))
out = f'{H}/bgm_synth.wav'
pcm = (mix.T * 32767 + rng.uniform(-0.5, 0.5, mix.T.shape) + rng.uniform(-0.5, 0.5, mix.T.shape)).round().clip(-32768, 32767).astype(np.int16)
wavfile.write(out, SR, pcm)
print(f'wrote {out}: {LENGTH:.2f}s, LUFS {lufs:.1f}, peak {peak:.1f} dBFS, RMS {rms:.1f} dBFS')
