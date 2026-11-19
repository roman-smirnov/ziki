// Synthesized flight cues and Dabi's recorded victory applause.
export class GardenAudio {
  private context?: AudioContext;
  private volume?: GainNode;
  private sources = new Set<AudioScheduledSourceNode>();
  private cheers?: Promise<AudioBuffer | undefined>;
  private generation = 0;
  private muted = true;
  enable(muted: boolean) {
    this.muted = muted;
    if (muted) { this.stop(); return; }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.volume = this.context.createGain();
        this.volume.gain.value = .55;
        this.volume.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
      this.loadCheers();
    } catch { /* The lesson is also playable with audio unavailable. */ }
  }
  cue(cue: 'fly' | 'step' | 'harvest' | 'blocked' | 'plant' | 'victory') {
    if (this.muted || this.context?.state !== 'running') return;
    const c = this.context;
    if (cue === 'victory') void this.playCheers(c, this.generation);
    const tones: Record<typeof cue, [number, number, number, OscillatorType][]> = {
      fly: [[210,0,.22,'triangle'],[310,.05,.24,'sine']],
      step: [[370,0,.064,'sine']],
      harvest: [[523.25,0,.16,'triangle'],[659.25,.07,.17,'triangle'],[783.99,.14,.24,'triangle']],
      blocked: [[165,0,.17,'triangle'],[120,.10,.23,'sine']],
      plant: [[440,0,.13,'sine'],[660,.08,.18,'triangle']],
      victory: [[659.25,.22,.22,'sine'],[783.99,.33,.23,'triangle'],[1046.50,.46,.40,'triangle'],[1318.51,.56,.37,'sine']],
    };
    for (const [frequency, delay, duration, type] of tones[cue]) {
      const start = c.currentTime + delay, osc = c.createOscillator(), gain = c.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(cue === 'step' ? .023 : .095,start+.014);
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);
      gain.connect(this.volume!);
      this.sources.add(osc);
      osc.onended=()=>{ osc.disconnect(); gain.disconnect(); this.sources.delete(osc); };
      osc.start(start);
      osc.stop(start+duration+.02);
    }
  }
  private loadCheers() {
    const context = this.context;
    if (!context) return;
    this.cheers ??= fetch(`${import.meta.env.BASE_URL}assets/audio/applause-01.wav`)
      .then(response => {
        if (!response.ok) throw new Error('Applause audio unavailable.');
        return response.arrayBuffer();
      })
      .then(data => context.decodeAudioData(data))
      .catch(() => { this.cheers = undefined; return undefined; });
    return this.cheers;
  }
  private async playCheers(context: AudioContext, generation: number) {
    const intendedStart = context.currentTime + .35;
    const buffer = await this.loadCheers();
    if (!buffer || this.muted || generation !== this.generation || context.state !== 'running' || document.hidden) return;
    const start = Math.max(intendedStart, context.currentTime);
    const offset = Math.max(0, start - intendedStart);
    const duration = buffer.duration - offset;
    if (duration <= 0) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.72, start + Math.min(.04, duration / 2));
    gain.gain.setValueAtTime(.72, start + Math.max(duration / 2, duration - 1.8));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(gain);
    gain.connect(this.volume!);
    this.sources.add(source);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.sources.delete(source); };
    source.start(start, offset);
    source.stop(start + duration);
  }
  stop() {
    this.generation++;
    for (const source of this.sources) { try { source.stop(); } catch { /* already stopped */ } }
    this.sources.clear();
  }
  dispose() { this.stop(); void this.context?.close().catch(()=>{}); this.context=undefined; }
}
