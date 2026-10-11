"""Analyze supplied music and prepare loop assets. Run only in the Dev Container.

Dependencies: numpy, matplotlib, imageio-ffmpeg. Originals are never overwritten.
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/audio/music"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
RATE = 44100
TRACKS = [("1-1", "Beyond_the_Far_Horizon.mp3"), ("2-1", "Before_the_Morning_Thaw.mp3"), ("3-1", "The_Well_of_Golden_Light.mp3"), ("4-1", "Crown_of_the_Sky.mp3")]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--course", choices=[course for course, _ in TRACKS], help="Prepare only this course's music")
args = parser.parse_args()
if args.course:
    TRACKS = [(course, filename) for course, filename in TRACKS if course == args.course]
DEST = ROOT / "frontend/public/assets/music"
REPORT = ROOT / "docs/audio"
DEST.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True, exist_ok=True)


def run(args, data=None):
    return subprocess.run([FFMPEG, "-hide_banner", "-nostdin", *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)


def loudness(path):
    log = run(["-i", str(path), "-af", "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr.decode()
    return json.loads(re.findall(r"\{[^{}]+\}", log)[-1])


def envelope(samples, hz=40):
    frame = RATE // hz
    trimmed = samples[:len(samples) // frame * frame]
    return np.sqrt(np.mean(trimmed.reshape(-1, frame, 2) ** 2, axis=(1, 2)) + 1e-12)


def tempo_estimate(rms):
    onset = np.maximum(0, np.diff(rms))
    onset -= onset.mean()
    spectrum = np.fft.rfft(onset, n=2 ** int(np.ceil(np.log2(len(onset) * 2))))
    corr = np.fft.irfft(spectrum * np.conj(spectrum))[:len(onset)]
    lags = np.arange(14, 41)  # 60–171 BPM; half/double time is inherently ambiguous.
    best = int(lags[np.argmax(corr[lags])])
    return 2400 / best


def features(samples, time):
    mono = samples[int(time * RATE):int((time + 1.2) * RATE)].mean(axis=1)[::4]
    mono = mono[:8192]
    if len(mono) < 8192:
        mono = np.pad(mono, (0, 8192 - len(mono)))
    power = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    freq = np.fft.rfftfreq(len(mono), 4 / RATE)
    bands = np.geomspace(60, 5500, 25)
    values = np.array([power[(freq >= lo) & (freq < hi)].sum() for lo, hi in zip(bands[:-1], bands[1:])])
    values = np.log1p(values)
    return values / (np.linalg.norm(values) + 1e-8)


records = []
for course, filename in TRACKS:
    source = SOURCE / filename
    decoded = run(["-i", str(source), "-f", "f32le", "-ac", "2", "-ar", str(RATE), "-"])
    samples = np.frombuffer(decoded.stdout, np.float32).reshape(-1, 2).copy()
    duration = len(samples) / RATE
    rms = envelope(samples)
    audible = np.flatnonzero(rms > max(10 ** (-45 / 20), rms.max() * .015))
    active_start, active_end = audible[0] / 40, (audible[-1] + 1) / 40
    bpm = tempo_estimate(rms)
    # Search phrases of 16/24/32/40 bars at the estimated pulse. Prefer 45–80s.
    beat = 60 / bpm
    candidates = []
    for start in np.arange(max(active_start + 4, 4), min(36, active_end - 35), beat):
        head = features(samples, start)
        for bars in (16, 24, 32, 40):
            length = bars * 4 * beat
            end = start + length
            if not 32 <= length <= 92 or end > active_end - 3:
                continue
            tail = features(samples, end - 1.2)
            head_rms = np.mean(rms[int(start * 40):int((start + 1.2) * 40)])
            tail_rms = np.mean(rms[int((end - 1.2) * 40):int(end * 40)])
            score = np.dot(head, tail) - .10 * abs(np.log((head_rms + 1e-6) / (tail_rms + 1e-6))) - .0008 * abs(length - 60)
            candidates.append((score, float(start), float(end), bars))
    _, start, end, bars = max(candidates)
    clip = samples[round(start * RATE):round(end * RATE)]
    crossfade = min(1.8, beat * 2)
    overlap = round(crossfade * RATE)
    phase = np.linspace(0, np.pi / 2, overlap, endpoint=False)[:, None]
    bridge = clip[-overlap:] * np.cos(phase) + clip[:overlap] * np.sin(phase)
    # Rotate the clip: its last sample naturally precedes its first at the original
    # overlap boundary. This avoids adding silence or a fade-out at every loop.
    loop = np.concatenate([clip[overlap:-overlap], bridge]).astype(np.float32)
    with tempfile.TemporaryDirectory(prefix="sky-sailer-bgm-") as temp:
        raw = Path(temp) / "loop.wav"
        run(["-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", "-y", str(raw)], loop.tobytes())
        measured = loudness(raw)
        normalizer = f"loudnorm=I=-18:TP=-1.5:LRA=11:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:linear=true"
        for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "5"]), ("mp3", ["-c:a", "libmp3lame", "-b:a", "160k"])):
            output = DEST / f"course-{course}-loop.{ext}"
            run(["-i", str(raw), "-af", normalizer, "-ar", str(RATE), *codec, "-map_metadata", "-1", "-y", str(output)])
        output_pcm = run(["-i", str(DEST / f"course-{course}-loop.ogg"), "-f", "f32le", "-ac", "2", "-ar", str(RATE), "-"])
        prepared = np.frombuffer(output_pcm.stdout, np.float32).reshape(-1, 2)
        final_loudness = loudness(DEST / f"course-{course}-loop.ogg")
    source_loudness = loudness(source)
    # Spectrum summary is a measurable texture, not an instrument identification.
    mono = samples[round(start * RATE):round((start + 10) * RATE)].mean(axis=1)
    windows = mono[:len(mono) // 4096 * 4096].reshape(-1, 4096) * np.hanning(4096)
    spectrum = (np.abs(np.fft.rfft(windows, axis=1)) ** 2).mean(axis=0)
    freq = np.fft.rfftfreq(4096, 1 / RATE)
    centroid = float(np.dot(spectrum, freq) / spectrum.sum())
    record = {"course": course, "source": filename, "source_seconds": round(duration, 3), "active_seconds": [round(active_start, 3), round(active_end, 3)], "estimated_pulse_bpm": round(bpm, 1), "pulse_caution": "Envelope autocorrelation estimate; half/double-time and phrase boundaries are not certified.", "spectral_centroid_hz": round(centroid), "source_lufs": float(source_loudness["input_i"]), "selected_source_seconds": [round(start, 3), round(end, 3)], "estimated_bars": bars, "crossfade_seconds": round(crossfade, 3), "loop_seconds": round(len(prepared) / RATE, 3), "output_lufs": float(final_loudness["input_i"]), "output_true_peak_db": float(final_loudness["input_tp"]), "decoded_seam_step": round(float(np.max(np.abs(prepared[-1] - prepared[0]))), 6), "runtime": f"assets/music/course-{course}-loop.ogg", "fallback": f"assets/music/course-{course}-loop.mp3"}
    records.append(record)
    fig, axes = plt.subplots(3, 1, figsize=(12, 8), layout="constrained")
    stride = max(1, len(samples) // 16000)
    axes[0].plot(np.arange(0, len(samples), stride) / RATE, samples[::stride, 0], color="#376694", lw=.35, alpha=.8)
    axes[0].axvspan(start, end, color="#e4b558", alpha=.25, label="Selected loop section")
    axes[0].set(title=f"{course} · {source.stem.replace('_', ' ')} — source waveform", ylabel="Amplitude")
    axes[0].legend(loc="upper right")
    axes[1].plot(np.arange(len(rms)) / 40, 20 * np.log10(rms + 1e-8), color="#468b7a", lw=.7)
    axes[1].set(title=f"Source envelope · {duration:.1f}s · {float(source_loudness['input_i']):.1f} LUFS · pulse estimate {bpm:.1f} BPM", ylabel="RMS dBFS", ylim=(-65, 0), xlabel="Source time (seconds)")
    seam_seconds = .12
    n = round(seam_seconds * RATE)
    seam = np.concatenate([prepared[-n:, 0], prepared[:n, 0]])
    axes[2].plot(np.arange(-n, n) / RATE, seam, color="#a6793d", lw=.6)
    axes[2].axvline(0, color="#df6e69", ls="--", lw=1)
    axes[2].set(title=f"Decoded loop seam · {len(prepared)/RATE:.2f}s loop · {float(final_loudness['input_i']):.1f} LUFS", xlabel="Time relative to loop seam (seconds)", ylabel="Amplitude")
    for ax in axes:
        ax.grid(alpha=.17)
    fig.savefig(REPORT / f"course-{course}-waveform.png", dpi=140)
    plt.close(fig)
    print(json.dumps(record), flush=True)

if args.course and (REPORT / "analysis.json").exists():
    previous = json.loads((REPORT / "analysis.json").read_text())
    records = sorted([record for record in previous.get("tracks", []) if record["course"] != args.course] + records, key=lambda record: record["course"])
(REPORT / "analysis.json").write_text(json.dumps({"sample_rate": RATE, "normalization_target_lufs": -18, "true_peak_target_db": -1.5, "method": "PCM analysis, envelope-based pulse estimate, spectral/dynamic endpoint matching, equal-power wrap crossfade, two-pass loudness normalization. Instrumentation cannot be identified from waveform alone.", "tracks": records}, indent=2) + "\n")
