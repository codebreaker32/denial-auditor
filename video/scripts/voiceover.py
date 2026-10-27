"""Voiceover for the demo video, and the scene timing Remotion reads.

  python3 scripts/voiceover.py --estimate     # no audio: timing from word counts (155 wpm)
  python3 scripts/voiceover.py               # Amazon Polly (needs polly:SynthesizeSpeech), one MP3 per scene
  python3 scripts/voiceover.py --retime      # reuse the MP3s already in public/vo and only redo the timing

Writes public/vo/<id>.mp3 and src/timing.json ({id: {seconds, audio}}). Each scene lasts its narration
plus a short breath, so retiming the video is just re-running this script. Run from video/.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SCRIPT = json.load(open(os.path.join(ROOT, "src", "script.json")))
PROFILE = os.environ.get("AWS_PROFILE", "aman-deploy")
VOICE = os.environ.get("POLLY_VOICE", "Matthew")
ENGINE = os.environ.get("POLLY_ENGINE", "generative")
LEAD, TAIL = 0.5, 0.9  # seconds of silence before and after each line
MIN = {"hook": 15.0, "eval": 12.0, "close": 8.0}
MAX_RATE = 1.5  # a recording may play up to this fast so its key moment lands inside the scene
CLIPS = json.load(open(os.path.join(ROOT, "src", "clips.json")))


def probe(path):
    comp = os.path.join(ROOT, "node_modules", "@remotion", "compositor-linux-x64-gnu")
    out = subprocess.run([os.path.join(comp, "ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True, env={**os.environ, "LD_LIBRARY_PATH": comp})
    return float(out.stdout.strip())


def polly(seg, path):
    subprocess.run(["aws", "polly", "synthesize-speech", "--profile", PROFILE, "--region", "us-east-1",
                    "--engine", ENGINE, "--voice-id", VOICE, "--output-format", "mp3", "--sample-rate", "24000",
                    "--text", seg["vo"], path], check=True, capture_output=True)


def main():
    estimate, retime = "--estimate" in sys.argv, "--retime" in sys.argv
    timing = {}
    os.makedirs(os.path.join(ROOT, "public", "vo"), exist_ok=True)
    for seg in SCRIPT:
        if estimate:
            speech, audio = len(seg["vo"].split()) / (155 / 60), False
        else:
            path = os.path.join(ROOT, "public", "vo", f"{seg['id']}.mp3")
            if not retime:
                polly(seg, path)
            speech, audio = probe(path), True
        seconds = max(LEAD + speech + TAIL, MIN.get(seg["id"], 0))
        t = {"audio": audio, "lead": LEAD, "rate": 1.0}
        if seg["kind"] == "rec":
            clip = (CLIPS[seg["clip"]] - 1) / 30 - seg.get("from", 0)
            seconds = max(seconds, clip / MAX_RATE)
            t["rate"] = round(max(1.0, clip / seconds), 3)
        t["seconds"] = round(seconds, 2)
        timing[seg["id"]] = t
        print(f"{seg['id']:9s} {t['seconds']:6.2f}s  x{t['rate']}")
    json.dump(timing, open(os.path.join(ROOT, "src", "timing.json"), "w"), indent=2)
    print(f"total {sum(t['seconds'] for t in timing.values()):.1f}s")


if __name__ == "__main__":
    main()
