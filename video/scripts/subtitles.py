"""Burned-in subtitle cues for the demo video, one per sentence (long sentences split at commas), aligned to the
voiceover by snapping each boundary to the nearest detected pause in that scene's MP3.

    python3 video/scripts/subtitles.py      # writes video/src/cut/subs.json  ($0, local ffmpeg only)
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from voiceover_elevenlabs import duration, tool  # bundled ffprobe/ffmpeg helpers

ROOT = os.path.dirname(HERE)
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
MAXC = 78  # characters per cue (two lines at most at 32 px)


def gaps(path, d=0.12):
    err = tool("ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=n=-38dB:d={d}", "-f", "null", "-").stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(st, en))


def chunks(text):
    out = []
    for s in re.split(r"(?<=[.!?])\s+", text.strip()):
        if len(s) <= MAXC:
            out.append(s); continue
        parts, cur = re.split(r"(?<=,)\s+", s), ""
        for p in parts:
            if cur and len(cur) + 1 + len(p) > MAXC:
                out.append(cur); cur = p
            else:
                cur = f"{cur} {p}".strip()
        out.append(cur)
    # merge quick-fire fragments so no cue flashes by
    merged = []
    for c in out:
        short = len(c) < 18 or len(merged[-1]) < 18 if merged else False
        if merged and (short or len(c) < 22 or len(merged[-1]) < 22) and len(merged[-1]) + 1 + len(c) <= (64 if short else 60):
            merged[-1] += " " + c
        else:
            merged.append(c)
    return merged


def main():
    res = {}
    for s in SCRIPT["scenes"]:
        path = os.path.join(ROOT, "public", "voiceover", f"{s['id']}.mp3")
        dur = duration(path)
        g = [(a, b) for a, b in gaps(path) if a > 0.05 and b < dur - 0.05]
        cs = chunks(s["text"])
        total = sum(len(c) for c in cs)
        start = 0.0
        bounds, acc = [], 0
        for c in cs[:-1]:
            acc += len(c)
            est = dur * acc / total
            near = min(g, key=lambda ab: abs((ab[0] + ab[1]) / 2 - est), default=None)
            t = (near[0] + near[1]) / 2 if near and abs((near[0] + near[1]) / 2 - est) < 0.9 else est
            bounds.append(max(t, (bounds[-1] + 0.5) if bounds else 0.5))
        edges = [start] + bounds + [dur]
        res[s["id"]] = [{"t0": round(edges[i], 2), "t1": round(edges[i + 1], 2), "text": c} for i, c in enumerate(cs)]
    out = os.path.join(ROOT, "src", "cut", "subs.json")
    json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)
    for k, v in res.items():
        print(k, [(c["t0"], c["text"][:30]) for c in v])


if __name__ == "__main__":
    main()
