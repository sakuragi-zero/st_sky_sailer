type RecordedCue = "launch" | "clear";
/** Recorded event sounds and small synthesized effects; BGM is managed separately. */
export class VoyageAudio {
  enabled = true;
  private context?: AudioContext;
  private cannonNoise?: AudioBuffer;
  private disposed = false;
  private thunderBuffer?: AudioBuffer;
  private thunderLoading?: Promise<void>;
  private thunderSource?: AudioBufferSourceNode;
  private playing = true;
  private readonly eventBuffers = new Map<string, AudioBuffer>();
  private readonly eventLoading = new Set<string>();
  private readonly eventSources = new Map<RecordedCue, AudioBufferSourceNode>();

  constructor(private readonly thunderUrl?: string, private readonly eventUrls: Partial<Record<RecordedCue,string | string[]>> = {}) {}

  private urlsFor(cue: RecordedCue): string[] {
    const urls = this.eventUrls[cue];
    return Array.isArray(urls) ? urls : urls ? [urls] : [];
  }

  private loadEvents() {
    if (!this.context || this.disposed) return;
    const context = this.context;
    for (const cue of ["launch","clear"] as const) {
      for (const url of this.urlsFor(cue)) {
        if (this.eventBuffers.has(url) || this.eventLoading.has(url)) continue;
        this.eventLoading.add(url);
        void fetch(url).then(async response => {
          if (!response.ok) throw new Error("Event audio unavailable");
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!this.disposed) this.eventBuffers.set(url,buffer);
        }).catch(() => {}).finally(() => this.eventLoading.delete(url));
      }
    }
  }

  private playEvent(cue: RecordedCue, context: AudioContext): boolean {
    this.loadEvents();
    const buffers = this.urlsFor(cue).map(url => this.eventBuffers.get(url)).filter((buffer): buffer is AudioBuffer => !!buffer);
    const buffer = buffers[Math.floor(Math.random()*buffers.length)];
    if (!buffer) return false;
    this.stopEvent(cue);
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = cue === "launch" ? 0.9 : 0.75;
    source.connect(gain); gain.connect(context.destination);
    this.eventSources.set(cue,source);
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.eventSources.get(cue) === source) this.eventSources.delete(cue);
    };
    source.start();
    return true;
  }

  private stopEvent(cue: RecordedCue) {
    this.eventSources.get(cue)?.stop();
    this.eventSources.delete(cue);
  }

  stopEvents() { this.stopEvent("launch"); this.stopEvent("clear"); }

  private loadThunder() {
    if (!this.thunderUrl || !this.context || this.thunderLoading || this.thunderBuffer || this.disposed) return;
    const context = this.context;
    this.thunderLoading = fetch(this.thunderUrl).then(async response => {
      if (!response.ok) throw new Error("Thunder unavailable");
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.thunderBuffer = buffer;
    }).catch(() => {}).finally(() => { this.thunderLoading = undefined; });
  }

  thunder(strength: number) {
    if (!this.enabled || !this.playing || this.disposed || !this.context || this.context.state !== "running" || this.thunderSource) return;
    this.loadThunder();
    if (!this.thunderBuffer) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.thunderBuffer;
    gain.gain.value = 0.55 + Math.max(0,Math.min(1,strength))*0.2;
    source.connect(gain); gain.connect(this.context.destination);
    this.thunderSource = source;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.thunderSource === source) this.thunderSource = undefined;
    };
    source.start();
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
    if (!playing) { this.stopThunder(); this.stopEvent("launch"); }
    else this.stopEvent("clear");
  }

  private stopThunder() {
    this.thunderSource?.stop();
    this.thunderSource = undefined;
  }

  /** Called synchronously from pointer/key gestures to unlock browser audio. */
  unlock() {
    if (!this.enabled || this.disposed) return;
    try {
      this.context ??= new AudioContext();
      this.loadThunder();
      this.loadEvents();
      if (this.context.state !== "running") void this.context.resume().catch(() => {});
    } catch { /* A later gesture can retry if audio is temporarily unavailable. */ }
  }

  async toggle(): Promise<boolean> {
    if (this.disposed) return false;
    this.enabled = !this.enabled;
    if (!this.enabled) { this.stopThunder(); this.stopEvents(); }
    if (this.enabled) {
      try {
        this.context ??= new AudioContext();
        this.loadThunder();
        this.loadEvents();
        await this.context.resume();
        if (this.enabled && !this.disposed) this.play("collect");
      } catch { this.enabled = false; }
    }
    return this.enabled;
  }

  play(cue: "jump" | "boost" | "collect" | "hit" | "clear" | "launch") {
    if (!this.enabled || this.disposed || !this.context || this.context.state !== "running") return;
    const context = this.context;
    if (cue === "clear") { this.stopThunder(); this.stopEvent("launch"); }
    if ((cue === "launch" || cue === "clear") && this.playEvent(cue,context)) return;
    if (cue === "launch") { this.cannon(context); return; }
    if (cue === "hit") { this.impact(context); return; }
    const frequencies = { jump: [330, 660], boost: [180, 480], collect: [880, 1320], clear: [523, 659, 784, 1047] }[cue];
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
    burst.gain.linearRampToValueAtTime(0.32,start+0.004);
    burst.gain.exponentialRampToValueAtTime(0.001,start+0.55);
    noise.connect(filter); filter.connect(burst); burst.connect(context.destination);
    noise.start(start); noise.stop(start+0.6);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); burst.disconnect(); };

    const tone = context.createOscillator(), boom = context.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(240,start);
    tone.frequency.exponentialRampToValueAtTime(65,start+0.45);
    boom.gain.setValueAtTime(0,start);
    boom.gain.linearRampToValueAtTime(0.22,start+0.008);
    boom.gain.exponentialRampToValueAtTime(0.001,start+0.6);
    tone.connect(boom); boom.connect(context.destination);
    tone.start(start); tone.stop(start+0.65);
    tone.onended = () => { tone.disconnect(); boom.disconnect(); };
  }

  private impact(context: AudioContext) {
    const start = context.currentTime;
    const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(420,start);
    oscillator.frequency.exponentialRampToValueAtTime(85,start+0.23);
    filter.type = "lowpass"; filter.frequency.value = 1600; filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime(0.16,start+0.006);
    gain.gain.exponentialRampToValueAtTime(0.001,start+0.28);
    oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start+0.3);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
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

  dispose() { this.disposed = true; this.enabled = false; this.stopThunder(); this.stopEvents(); this.eventBuffers.clear(); void this.context?.close(); }
}
