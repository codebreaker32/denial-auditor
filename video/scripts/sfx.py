"""Synthesise the video's sound effects and music bed with numpy (no third-party audio; see video/CREDITS.md).

    python3 video/scripts/sfx.py      # writes video/public/sfx/*.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / "public" / "sfx"
rng = np.random.default_rng(7)


def write(name, x, peak=0.9):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    m = np.max(np.abs(x)) or 1
    x = (x / m * peak * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(x.tobytes())


def t(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc); y[i] = acc
    return y


def env(n, att, dec):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / max(att, 1e-4)) * np.exp(-tt / dec)


# whoosh: band-limited noise swelling and sweeping, for whip pans
def whoosh():
    d = 0.42; n = int(d * SR); tt = t(d)
    noise = rng.standard_normal(n)
    a = np.interp(tt, [0, d], [0.02, 0.35])  # opening filter = sweep up
    y = np.empty(n); acc = 0.0
    for i in range(n):
        acc += a[i] * (noise[i] - acc); y[i] = acc
    y = y - lowpass(y, 0.01)
    shape = np.sin(np.pi * tt / d) ** 2
    pan = np.interp(tt, [0, d], [0.2, 0.8])
    return np.stack([y * shape * (1 - pan), y * shape * pan], 1)


# stamp: low thud + paper slap
def thump():
    tt = t(0.5); n = len(tt)
    f = 70 * np.exp(-tt * 8) + 45
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.12)
    slap = lowpass(rng.standard_normal(n), 0.25) * env(n, 0.0005, 0.025)
    return body * 1.0 + slap * 0.9


# lock click: two short metallic ticks
def click():
    tt = t(0.18); n = len(tt); y = np.zeros(n)
    for at, fr in ((0.0, 2400), (0.045, 1700)):
        i = int(at * SR); m = n - i
        y[i:] += np.sin(2 * np.pi * fr * tt[:m]) * env(m, 0.0003, 0.012) + rng.standard_normal(m) * env(m, 0.0002, 0.004) * 0.4
    return y


# unlock / verified: a soft two-note chime (major third, up)
def chime():
    tt = t(0.9); n = len(tt); y = np.zeros(n)
    for at, fr in ((0.0, 880.0), (0.09, 1108.7)):
        i = int(at * SR); m = n - i
        y[i:] += (np.sin(2 * np.pi * fr * tt[:m]) + 0.3 * np.sin(2 * np.pi * 2 * fr * tt[:m])) * env(m, 0.003, 0.28)
    return y


# pop: a quick pitched blip for numbers landing
def pop():
    tt = t(0.14); n = len(tt)
    f = 900 * np.exp(-tt * 30) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.04)


# tick: clock tick
def tick():
    tt = t(0.06); n = len(tt)
    return np.sin(2 * np.pi * 3200 * tt) * env(n, 0.0002, 0.006) + rng.standard_normal(n) * env(n, 0.0001, 0.002) * 0.3


# music bed: 96 bpm, warm electric-piano chords (Imaj7–vi7–IVmaj7–V), soft kick, brushed hats. Mixed quiet.
def bed(seconds=170):
    bpm = 96; beat = 60 / bpm; n = int(seconds * SR); out = np.zeros((n, 2))
    def note(midi):
        return 440 * 2 ** ((midi - 69) / 12)
    chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]
    bar = 4 * beat
    nb = int(seconds / bar) + 1
    for b in range(nb):
        ch = chords[b % 4]
        for hit, vel in ((0, 1.0), (1.5, 0.55), (2.5, 0.7)):
            st = int((b * bar + hit * beat) * SR)
            if st >= n: continue
            d = 1.6; m = min(int(d * SR), n - st); tt = np.arange(m) / SR
            e = env(m, 0.004, 0.55) * vel
            for k, md in enumerate(ch):
                fr = note(md); ph = k * 0.7
                s = (np.sin(2 * np.pi * fr * tt + ph) + 0.25 * np.sin(2 * np.pi * 2 * fr * tt) * np.exp(-tt * 6)) * e
                pan = 0.35 + 0.1 * k
                out[st:st + m, 0] += s * (1 - pan); out[st:st + m, 1] += s * pan
        # bass on the root
        st = int(b * bar * SR); m = min(int(bar * SR), n - st)
        if m > 0:
            tt = np.arange(m) / SR; fr = note(ch[0] - 24)
            s = np.sin(2 * np.pi * fr * tt) * env(m, 0.01, 1.2) * 0.9
            out[st:st + m] += s[:, None]
    for i in range(int(seconds / beat)):
        st = int(i * beat * SR)
        if i % 2 == 0:  # kick on 1 and 3
            m = min(int(0.3 * SR), n - st); tt = np.arange(m) / SR
            f = 110 * np.exp(-tt * 25) + 48
            out[st:st + m] += (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(m, 0.001, 0.09) * 0.9)[:, None]
        for off in (0.5,):  # off-beat hat
            s2 = int((i + off) * beat * SR); m = min(int(0.05 * SR), n - s2)
            if m > 0:
                h = rng.standard_normal(m); h = h - lowpass(h, 0.3)
                out[s2:s2 + m, 1] += h * env(m, 0.0005, 0.012) * 0.25
                out[s2:s2 + m, 0] += h * env(m, 0.0005, 0.012) * 0.15
    fade = np.minimum(1, np.minimum(np.arange(n) / (2 * SR), (n - np.arange(n)) / (3 * SR)))
    return out * fade[:, None]


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("whoosh", whoosh), ("thump", thump), ("click", click), ("chime", chime), ("pop", pop), ("tick", tick)):
        write(name, fn())
    write("bed", bed(), peak=0.8)
    print("wrote", sorted(p.name for p in OUT.glob("*.wav")))
