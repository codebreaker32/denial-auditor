"""Amazon Polly voiceover for the demo video (generative engine), and the scene timing Remotion reads.

  python3 scripts/voiceover_polly.py                 # one MP3 per scene into public/voiceover/, then timing.json
  python3 scripts/voiceover_polly.py --only tamper   # regenerate just these scenes (comma-separated)
  python3 scripts/voiceover_polly.py --retime        # no API calls: re-measure the MP3s and rewrite timing.json

The eleven_v3 tags in script.json's `vo` are translated to the SSML subset Polly generative accepts
(<speak>, <break time>, <prosody rate>): [pause] -> 0.6 s, [short pause] -> 0.3 s, expression tags are
dropped in favour of phrasing, and EMPHASIS lines are read a little slower after a short break.
The exact SSML sent is written back to script.json (`ssml`). Uses AWS profile aman-deploy, us-east-1.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from voiceover_elevenlabs import duration, silences  # bundled ffprobe/ffmpeg helpers

ROOT = os.path.dirname(HERE)
SCRIPT_PATH = os.path.join(ROOT, "script.json")
SCRIPT = json.load(open(SCRIPT_PATH))
OUT = os.path.join(ROOT, "public", "voiceover")
PROFILE, REGION, ENGINE = "aman-deploy", "us-east-1", "generative"
VOICES = {"narrator": "Matthew", "biller": "Ruth"}
PRICE_PER_M = 30.0  # USD per 1M characters, Polly generative
LEAD, TAIL = 0.3, 0.6

# Lines that land a point: read slightly slower, after a short beat.
EMPHASIS = ["Nothing here asks for an x-ray first.", "Twenty-two of twenty-two match.", "export locks.",
            "Not accuracy on real charts.", "Denial Auditor, by Road House.", "With proof.",
            "And the appeal clock is already running."]
# Per-scene phrasing that stands in for v3 expression tags Polly can't perform.
REWRITE = {"biller": ("[sighs] Another MRI denied.", 'Oh, no. <break time="0.3s"/> Another MRI, denied.')}


def to_ssml(s):
    if s.get("ssml_raw"):  # hand-written SSML (the opening): sent as is
        return s["ssml_raw"]
    t = s["vo"]
    if s["id"] in REWRITE:
        t = t.replace(*REWRITE[s["id"]])
    for line in EMPHASIS:
        t = t.replace(line, f'<break time="0.2s"/><prosody rate="92%">{line}</prosody>')
    t = t.replace("[pause]", '<break time="0.6s"/>').replace("[short pause]", '<break time="0.3s"/>')
    t = re.sub(r"\[[a-z\- ]+\]\s*", "", t)  # expression tags: carried by phrasing instead
    t = re.sub(r"\s+", " ", t).strip()
    if s["id"] in ("greet", "close"):  # warm open and close: a touch slower overall
        t = f'<prosody rate="96%">{t}</prosody>'
    if s["id"] in ("pitch", "worklist", "check"):  # dense lines came out above 3 words/s at 100%
        t = f'<prosody rate="93%">{t}</prosody>'
    return f"<speak>{t}</speak>"


def polly(ssml, voice, path):
    out = subprocess.run(["aws", "polly", "synthesize-speech", "--profile", PROFILE, "--region", REGION, "--engine", ENGINE,
                          "--voice-id", voice, "--output-format", "mp3", "--sample-rate", "24000", "--text-type", "ssml",
                          "--text", ssml, path], capture_output=True, text=True)
    if out.returncode:
        sys.exit(f"Polly error: {out.stderr.strip()}")
    return json.loads(out.stdout)["RequestCharacters"]


def main():
    retime = "--retime" in sys.argv
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    tpath = os.path.join(ROOT, "timing.json")
    old = json.load(open(tpath)) if os.path.exists(tpath) else {}
    timing = {"_meta": {"engine": f"polly-{ENGINE}", "voices": VOICES, "lead": LEAD, "tail": TAIL}}
    for s in SCRIPT["scenes"]:
        s["ssml"] = to_ssml(s)
        path = os.path.join(OUT, f"{s['id']}.mp3")
        chars = old.get(s["id"], {}).get("characters", 0) if old.get("_meta", {}).get("engine") == f"polly-{ENGINE}" else 0
        if not retime and (only is None or s["id"] in only):
            chars = polly(s["ssml"], VOICES[s["voice"]], path)
        secs = duration(path)
        words = len(re.sub(r"\[[^\]]*\]", "", s["vo"]).split())
        sil = silences(path)
        tail_quiet = next((secs - a for a, b in sil if b is None or b >= secs - 0.05), 0.0)
        inner = [round(b - a, 2) for a, b in sil if a > 0.05 and b is not None and b < secs - 0.05]
        timing[s["id"]] = {"audio": f"voiceover/{s['id']}.mp3", "voice": VOICES[s["voice"]], "speech": round(secs, 2),
                           "seconds": round(LEAD + secs + TAIL, 2), "lead": LEAD, "words": words,
                           "wps": round(words / secs, 2), "trailing_silence": round(tail_quiet, 2), "pauses": inner,
                           "characters": chars}
        t = timing[s["id"]]
        print(f"{s['id']:10s} {secs:6.2f}s  {t['wps']:.2f} w/s  tail {t['trailing_silence']:.2f}s  pauses {inner}  chars {chars}")
    scenes = [v for k, v in timing.items() if k != "_meta"]
    chars = sum(v["characters"] for v in scenes)
    timing["_meta"].update(total_speech=round(sum(v["speech"] for v in scenes), 2),
                           total_seconds=round(sum(v["seconds"] for v in scenes), 2), total_characters=chars,
                           cost_usd=round(chars * PRICE_PER_M / 1e6, 4), estimated=False)
    json.dump(timing, open(tpath, "w"), indent=2)
    SCRIPT["voiceover"] = {"engine": f"amazon-polly-{ENGINE}", "voices": VOICES, "audio_dir": "public/voiceover",
                           "note": SCRIPT["voiceover"].get("note", "") + " vo keeps the eleven_v3 tags; ssml is the exact Polly request."}
    json.dump(SCRIPT, open(SCRIPT_PATH, "w"), indent=2, ensure_ascii=False)
    print(f"speech {timing['_meta']['total_speech']:.1f}s, with lead/tail {timing['_meta']['total_seconds']:.1f}s; "
          f"{chars} characters billed, about ${timing['_meta']['cost_usd']:.3f}")


if __name__ == "__main__":
    main()
