"""Prepare user-supplied effects from local originals. Run in the Dev Container."""
import argparse
import subprocess
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/audio/sfx"
DEST = ROOT / "frontend/public/assets/sfx"
SOUNDS = {
    "thunder": ("thunder-original.mp3", "thunder-v1.mp3", -22, "128k", 0.04),
    "goal": ("victory-2-original.mp3", "goal-v1.mp3", -18, "160k", 0.005),
    "goal-alt": ("victory-1-original.mp3", "goal-alt-v1.mp3", -18, "160k", 0.005),
    "star-launch": ("star-launch-original.mp3", "star-launch-v1.mp3", -18, "160k", 0.005),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sound", choices=SOUNDS, help="Prepare only this effect")
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    for key, (original, output, level, bitrate, fade) in SOUNDS.items():
        if args.sound and key != args.sound:
            continue
        source = SOURCE / original
        if not source.is_file():
            parser.error(f"Missing local original: assets/source/audio/sfx/{original}")
        destination = DEST / output
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-nostdin",
            "-i", str(source), "-af", f"loudnorm=I={level}:TP=-2:LRA=11,afade=t=in:d={fade}",
            "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", bitrate,
            "-map_metadata", "-1", "-y", str(destination),
        ], check=True)
        print(f"Prepared {key}: {destination.name}", flush=True)


if __name__ == "__main__":
    main()
