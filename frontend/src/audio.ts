/** Small synthesized effects; recorded BGM is managed separately by VoyageMusic. */
export class VoyageAudio {
  enabled = false;
  private context?: AudioContext;
  private cannonNoise?: AudioBuffer;

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

  play(cue: "jump" | "boost" | "collect" | "hit" | "clear" | "launch") {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const context = this.context;
    if (cue === "launch") { this.cannon(context); return; }
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

  private cannon(context: AudioContext) {
    const start = context.currentTime;
    // A filtered burst supplies the crack; a falling low tone supplies the boom.
    // Reuse the noise buffer rather than allocate it on every ring crossing.
    if (!this.cannonNoise) {
      this.cannonNoise = context.createBuffer(1, Math.floor(context.sampleRate * 0.6), context.sampleRate);
      const samples = this.cannonNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const noise = context.createBufferSource(), filter = context.createBiquadFilter(), burst = context.createGain();
    noise.buffer = this.cannonNoise;
    filter.type = "lowpass"; filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(3200,start);
    filter.frequency.exponentialRampToValueAtTime(180,start+0.5);
    burst.gain.setValueAtTime(0,start);
    burst.gain.linearRampToValueAtTime(0.2,start+0.004);
    burst.gain.exponentialRampToValueAtTime(0.001,start+0.55);
    noise.connect(filter); filter.connect(burst); burst.connect(context.destination);
    noise.start(start); noise.stop(start+0.6);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); burst.disconnect(); };

    const tone = context.createOscillator(), boom = context.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(140,start);
    tone.frequency.exponentialRampToValueAtTime(38,start+0.45);
    boom.gain.setValueAtTime(0,start);
    boom.gain.linearRampToValueAtTime(0.14,start+0.008);
    boom.gain.exponentialRampToValueAtTime(0.001,start+0.6);
    tone.connect(boom); boom.connect(context.destination);
    tone.start(start); tone.stop(start+0.65);
    tone.onended = () => { tone.disconnect(); boom.disconnect(); };
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
