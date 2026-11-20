"""Gentle UI sounds for the Polyquest film, synthesised in code. Writes sfx/*.wav, 48 kHz, 16 bit.
Every file is normalised to a -6 dBFS peak; mix.py sets the playback level."""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

H = os.path.dirname(os.path.abspath(__file__))
OUT = f'{H}/sfx'; os.makedirs(OUT, exist_ok=True)
SR = 48000
rng = np.random.default_rng(7)


def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def tt(sec): return np.arange(int(sec * SR)) / SR


def write(name, x, stereo=False):
    x = np.asarray(x, float)
    fade = np.clip((x.shape[-1] - np.arange(x.shape[-1])) / (0.004 * SR), 0, 1)
    x = x * fade
    x = x / (np.max(np.abs(x)) + 1e-12) * 10 ** (-6 / 20)
    pcm = (x.T * 32767).round().astype(np.int16)
    wavfile.write(f'{OUT}/{name}', SR, pcm)
    print(f'{name}: {x.shape[-1] / SR:.3f}s')


def tap():
    t = tt(0.07)
    body = np.sin(2 * np.pi * 1250 * t + 2 * np.sin(2 * np.pi * 620 * t) * np.exp(-t * 80)) * np.exp(-t * 95)
    tick = bp(rng.standard_normal(len(t)), 2000, 5500) * np.exp(-t * 420) * 0.7
    thump = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60) * 0.5
    return lp(body * 0.8 + tick + thump, 7000) * np.minimum(1, t / 0.0008)


def type_tick():
    t = tt(0.035)
    tick = bp(rng.standard_normal(len(t)), 2500, 6000) * np.exp(-t * 650)
    body = np.sin(2 * np.pi * 2100 * t) * np.exp(-t * 220) * 0.35
    return lp(tick + body, 7500) * np.minimum(1, t / 0.0005)


def whoosh():
    d = 0.7; t = tt(d); n = len(t)
    nz = rng.standard_normal(n)
    # crossfade a bank of band passes so the centre sweeps up then settles: 300 Hz -> 2 kHz -> 750 Hz
    centres = [300, 500, 800, 1300, 2000]
    bands = [bp(nz, c / 1.6, c * 1.6) for c in centres]
    path = np.interp(t / d, [0, 0.55, 1], [0, len(centres) - 1, 2.2])
    x = np.zeros(n)
    for i, b in enumerate(bands):
        w = np.clip(1 - np.abs(path - i), 0, 1)
        x += b * w
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
    x = lp(x * env, 4500)
    p = np.interp(t / d, [0, 1], [-0.5, 0.5]); a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def bell(f, t, start):
    u = np.clip(t - start, 0, None); on = t >= start
    x = np.sin(2 * np.pi * f * u) + 0.22 * np.sin(2 * np.pi * 2 * f * u) * np.exp(-u * 8) + 0.06 * np.sin(2 * np.pi * 3.01 * f * u) * np.exp(-u * 14)
    return x * np.exp(-u * 4.2) * np.minimum(1, u / 0.003) * on


def success():
    t = tt(1.0)
    # C6 then F6: a rising fourth that resolves to the tonic of the music (F major)
    x = bell(1046.5, t, 0.0) * 0.75 + bell(1396.9, t, 0.10) * 0.85
    return lp(x, 6500)


def pop():
    t = tt(0.11)
    f = 380 + 620 * (1 - np.exp(-t * 55))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 34) * np.minimum(1, t / 0.002)
    return lp(x + 0.15 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.exp(-t * 60), 5000)


if __name__ == '__main__':
    write('tap.wav', tap()); write('type.wav', type_tick()); write('whoosh.wav', whoosh())
    write('success.wav', success()); write('pop.wav', pop())
