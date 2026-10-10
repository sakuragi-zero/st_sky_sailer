/** Small synthesized effects; recorded BGM is managed separately by VoyageMusic. */
export class VoyageAudio {
  enabled = false;
  private context?: AudioContext;

  async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        this.context ??= new AudioContext();
        await this.context.resume();
        this.play("collect");
      } catch { this.enabled = false; }
    }
    return this.enabled;
  }

  play(cue: "jump" | "boost" | "collect" | "hit" | "clear") {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const context = this.context;
    const frequencies = { jump: [330, 660], boost: [180, 480], collect: [880, 1320], hit: [180, 80], clear: [523, 659, 784, 1047] }[cue];
    frequencies.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.075;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  splash() {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const context = this.context, start = context.currentTime;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.22), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer; filter.type = "lowpass"; filter.frequency.value = 1700;
    gain.gain.setValueAtTime(0.045, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    source.connect(filter); filter.connect(gain); gain.connect(context.destination);
    source.start(start);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  dispose() { void this.context?.close(); }
}
