"""ElevenLabs voiceover for the demo video, and the scene timing Remotion will read.

  python3 scripts/voiceover_elevenlabs.py                 # one MP3 per scene (skips scenes that already have one)
  python3 scripts/voiceover_elevenlabs.py --only tamper   # regenerate just these scenes (comma-separated)
  python3 scripts/voiceover_elevenlabs.py --retime        # no API calls: re-measure the MP3s and rewrite timing.json
  python3 scripts/voiceover_elevenlabs.py --estimate      # no audio: timing from word counts (2.6 w/s) plus tag pauses

Reads script.json, writes public/voiceover/<id>.mp3 and timing.json (both in video/). Run from anywhere.
The API key is read from ../.env (ELEVENLABS_API_KEY) and is never printed or written anywhere.
"""
import json, os, re, subprocess, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
VO = SCRIPT["voiceover"]
OUT = os.path.join(ROOT, VO["audio_dir"])
LEAD, TAIL = 0.3, 0.6  # silence the edit adds before and after each line
COMP = os.path.join(ROOT, "node_modules", "@remotion", "compositor-linux-x64-gnu")


def api_key():
    for line in open(os.path.join(REPO, ".env")):
        if line.strip().startswith("ELEVENLABS_API_KEY"):
            return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("ELEVENLABS_API_KEY not found in .env")


def tts(key, voice_id, text, path):
    body = json.dumps({"text": text, "model_id": VO["model"], "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                                 data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=180)
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read()[:300]!r}")
    open(path, "wb").write(resp.read())
    return int(resp.headers.get("character-cost", 0))


def tool(name, *args):
    return subprocess.run([os.path.join(COMP, name), *args], capture_output=True, text=True,
                          env={**os.environ, "LD_LIBRARY_PATH": COMP})


def duration(path):
    return float(tool("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path).stdout.strip())


def silences(path):
    """(start, end) of every silence of 0.3 s or more below -40 dB."""
    err = tool("ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=n=-40dB:d=0.3", "-f", "null", "-").stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def main():
    retime, estimate = "--retime" in sys.argv, "--estimate" in sys.argv
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    key = None if retime or estimate else api_key()
    timing_path = os.path.join(ROOT, "timing.json")
    old = json.load(open(timing_path)) if os.path.exists(timing_path) else {}
    timing, spent = {"_meta": {"model": VO["model"], "lead": LEAD, "tail": TAIL, "voices": VO["voices"]}}, 0
    for s in SCRIPT["scenes"]:
        path = os.path.join(OUT, f"{s['id']}.mp3")
        chars = old.get(s["id"], {}).get("characters", 0)
        if not retime and not estimate and (only is not None and s["id"] in only or only is None and not os.path.exists(path)):
            chars = tts(key, VO["voices"][s["voice"]]["voice_id"], s["vo"], path)
            spent += chars
        if estimate:
            words = len(re.sub(r"\[[^\]]*\]", "", s["vo"]).split())
            secs = words / 2.6 + 0.6 * s["vo"].count("[pause]") + 0.3 * s["vo"].count("[short pause]")
            timing[s["id"]] = {"audio": None, "estimated": True, "voice": s["voice"], "speech": round(secs, 2),
                               "seconds": round(LEAD + secs + TAIL, 2), "lead": LEAD, "words": words, "characters": 0}
            print(f"{s['id']:10s} ~{secs:5.1f}s (estimate)  {len(s['vo'])} chars")
            continue
        if not os.path.exists(path):
            continue
        secs = duration(path)
        words = len(re.sub(r"\[[^\]]*\]", "", s["vo"]).split())
        sil = silences(path)
        tail_quiet = next((secs - a for a, b in sil if b is None or b >= secs - 0.05), 0.0)
        inner = [round(b - a, 2) for a, b in sil if a > 0.05 and b is not None and b < secs - 0.05]
        timing[s["id"]] = {"audio": f"{VO['audio_dir'].removeprefix('public/')}/{s['id']}.mp3", "voice": s["voice"],
                           "speech": round(secs, 2), "seconds": round(LEAD + secs + TAIL, 2), "lead": LEAD,
                           "words": words, "wps": round(words / secs, 2), "trailing_silence": round(tail_quiet, 2),
                           "pauses": inner, "characters": chars}
        t = timing[s["id"]]
        print(f"{s['id']:10s} {secs:6.2f}s  {t['wps']:.2f} w/s  tail {t['trailing_silence']:.2f}s  pauses {inner}  chars {chars}")
    scenes = [v for k, v in timing.items() if k != "_meta"]
    timing["_meta"].update(total_speech=round(sum(v["speech"] for v in scenes), 2),
                           total_seconds=round(sum(v["seconds"] for v in scenes), 2),
                           total_characters=sum(v["characters"] for v in scenes),
                           characters_needed=sum(len(x["vo"]) for x in SCRIPT["scenes"]), estimated=estimate)
    json.dump(timing, open(timing_path, "w"), indent=2)
    print(f"speech {timing['_meta']['total_speech']:.1f}s, with lead/tail {timing['_meta']['total_seconds']:.1f}s; "
          f"characters billed this run {spent}")


if __name__ == "__main__":
    main()
