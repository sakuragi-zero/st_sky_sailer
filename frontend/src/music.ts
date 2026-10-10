/** User-supplied, prepared loop assets. Decoded PCM looping avoids media-element gaps. */
export class VoyageMusic {
  enabled = false;
  volume = .5;
  private context?: AudioContext;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private loading?: Promise<void>;
  private playing = false;
  private disposed = false;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  constructor(private readonly urls: string[], defaultEnabled=false) { this.enabled=this.available && defaultEnabled; }
  get available() { return this.urls.length>0; }

  async toggle(): Promise<boolean> {
    if(!this.available || this.disposed) return false;
    if(this.enabled) { this.enabled=false; this.fade(0,.3,true); return false; }
    return this.enable();
  }
  async enable(): Promise<boolean> {
    if(!this.available || this.disposed) return false;
    this.enabled=true;
    try {
      this.context ??= new AudioContext();
      this.unlock(); // Loading continues even if autoplay waits for a user gesture.
      if(!this.gain) {
        this.gain=this.context.createGain(); this.gain.gain.value=0;
        this.filter=this.context.createBiquadFilter(); this.filter.type="lowpass"; this.filter.frequency.value=18000;
        this.filter.connect(this.gain); this.gain.connect(this.context.destination);
      }
      this.loading ??= this.load();
      await this.loading;
      if(this.disposed || !this.enabled) return false;
      if(!this.source) this.start();
      if(this.playing) this.fade(this.volume,.7);
      else this.fade(0,.2,true);
    } catch { this.enabled=false; this.loading=undefined; throw new Error("BGMを読み込めませんでした。もう一度お試しください。"); }
    return this.enabled;
  }
  unlock() {
    if(this.enabled && this.playing && this.context && !this.disposed) void this.context.resume().catch(()=>{});
  }
  private async load() {
    for(const url of this.urls) {
      try {
        const response=await fetch(url);
        if(!response.ok) throw new Error("Music unavailable");
        const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());
        if(!this.disposed) this.buffer=buffer;
        return;
      } catch { /* Try MP3 if the browser cannot decode Ogg. */ }
    }
    throw new Error("No supported music asset");
  }
  private start() {
    if(!this.buffer || !this.context || !this.filter) return;
    this.source=this.context.createBufferSource();
    this.source.buffer=this.buffer; this.source.loop=true;
    this.source.connect(this.filter); this.source.start();
  }
  setPlaying(playing:boolean,restart=false) {
    this.playing=playing;
    if(restart && this.source) { this.source.stop(); this.source.disconnect(); this.source=undefined; this.start(); }
    if(!this.enabled || !this.context) return;
    if(playing) {
      clearTimeout(this.suspendTimer);
      void this.context.resume().then(()=>{if(!this.disposed && this.enabled && this.playing) this.fade(this.volume,.55);}).catch(()=>{});
    } else this.fade(0,.45,true);
  }
  setVolume(value:number) { this.volume=Math.max(0,Math.min(1,value)); if(this.enabled && this.playing) this.fade(this.volume,.08); }
  setWeather(intensity:number) {
    if(this.context && this.filter) this.filter.frequency.setTargetAtTime(18000-intensity*8500,this.context.currentTime,.3);
  }
  private fade(value:number,seconds:number,suspend=false) {
    clearTimeout(this.suspendTimer);
    if(!this.context || !this.gain) return;
    const param=this.gain.gain,now=this.context.currentTime;
    param.cancelScheduledValues(now); param.setValueAtTime(param.value,now); param.linearRampToValueAtTime(value,now+seconds);
    if(suspend) this.suspendTimer=setTimeout(()=>{if(!this.disposed && (!this.enabled || !this.playing)) void this.context?.suspend();},seconds*1000+30);
  }
  dispose() {
    this.disposed=true; clearTimeout(this.suspendTimer);
    this.source?.stop(); this.source?.disconnect(); this.filter?.disconnect(); this.gain?.disconnect();
    void this.context?.close(); this.buffer=undefined;
  }
}
