// Procedural WebAudio engine, sirens, gunfire, radio and UI sounds; no audio files.

const MASTER_VOLUME = 0.5;

/** Procedural sound system driven by oscillators and generated noise buffers. */
export class AudioSys {
  /** Build the system; the AudioContext is deferred until the first user gesture. */
  constructor(ctx) {
    this.ctx = ctx;
    this.audioCtx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.engine = null;
    this.siren = null;
    this.radio = { mode: 'off', station: 0, step: 0, nextStepTime: 0 };
  }

  /** Lazily create the AudioContext, master gain and shared noise buffer on a gesture. */
  ensureContext() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const audioCtx = new AC();
    const master = audioCtx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(audioCtx.destination);
    this.audioCtx = audioCtx;
    this.master = master;
    this.noiseBuffer = this.makeNoiseBuffer(1.0);
    this.ctx.audioCtx = audioCtx;
  }

  /** Fill a one-second mono buffer with white noise for reuse by all effects. */
  makeNoiseBuffer(seconds) {
    const audioCtx = this.audioCtx;
    const length = Math.floor(audioCtx.sampleRate * seconds);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Start the two detuned saw oscillators of the engine voice (silent by default). */
  startEngine() {
    if (!this.audioCtx || this.engine) return;
    const audioCtx = this.audioCtx;
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const oscA = audioCtx.createOscillator();
    oscA.type = 'sawtooth';
    const oscB = audioCtx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.detune.value = 12;
    oscA.frequency.value = 60;
    oscB.frequency.value = 60;
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    this.engine = { oscA, oscB, filter, gain };
  }

  /** Map rpm01 (0..1) and inCar to a 40-130 Hz pitch and engine loudness. */
  setEngine(rpm01, inCar) {
    if (!this.engine) return;
    const now = this.audioCtx.currentTime;
    const freq = 40 + Math.max(0, Math.min(1, rpm01)) * 90;
    this.engine.oscA.frequency.setTargetAtTime(freq, now, 0.05);
    this.engine.oscB.frequency.setTargetAtTime(freq * 1.01, now, 0.05);
    this.engine.filter.frequency.setTargetAtTime(500 + freq * 6, now, 0.05);
    this.engine.gain.gain.setTargetAtTime(inCar ? 0.18 : 0, now, 0.08);
  }

  /** Toggle a two-tone police wail alternating 760/560 Hz at time t. */
  setSiren(active, t) {
    if (!this.audioCtx) return;
    if (!active) {
      if (this.siren) this.siren.gain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    if (!this.siren) {
      const audioCtx = this.audioCtx;
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 760;
      const lfo = audioCtx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.7;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.09;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, lfoGain, gain, high: true, next: t };
    }
    const s = this.siren;
    s.gain.gain.setTargetAtTime(0.1, t, 0.05);
    if (t >= s.next) {
      s.high = !s.high;
      s.osc.frequency.setValueAtTime(s.high ? 760 : 560, t);
      s.next = t + 0.7;
    }
  }

  /** Fire a noise-burst gunshot through a bandpass, pitched per weapon kind. */
  shot(kind) {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const pitch = kind === 'pistol' ? 1400 : kind === 'rifle' ? 900
      : kind === 'shotgun' ? 600 : 1200;
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = pitch;
    bp.Q.value = 0.8;
    const env = this.audioCtx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(bp);
    bp.connect(env);
    env.connect(this.master);
    src.start(t);
    src.stop(t + 0.15);
  }

/** Low, gated noise boom for a car or barrel explosion. */
  explosion() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const env = this.audioCtx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    const oenv = this.audioCtx.createGain();
    oenv.gain.setValueAtTime(0.7, t);
    oenv.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(lp);
    lp.connect(env);
    env.connect(this.master);
    osc.connect(oenv);
    oenv.connect(this.master);
    src.start(t);
    osc.start(t);
    src.stop(t + 0.85);
    osc.stop(t + 0.75);
  }

  /** Short bright blip used for pickups and cash pickups. */
  pickupBlip() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'square';
    const env = this.audioCtx.createGain();
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.06);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Rising triangle fanfare played when a mission objective is completed. */
  missionDoneJingle() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const env = this.audioCtx.createGain();
      const start = t + i * 0.1;
      env.gain.setValueAtTime(0.001, start);
      env.gain.linearRampToValueAtTime(0.25, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(env);
      env.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  /** Radio: three procedural stations built from small generative loops. */
  static STATIONS() {
    return ['Sol FM', 'Puerto Beats', 'Nocturna'];
  }

  /** Pre-build the generative voices for a station and start them. */
  startRadio(station) {
    if (!this.audioCtx) return;
    this.stopRadio();
    const audioCtx = this.audioCtx;
    const scales = [
      [261.63, 293.66, 329.63, 392.0, 440.0],
      [220.0, 246.94, 277.18, 329.63, 369.99],
      [174.61, 196.0, 220.0, 261.63, 293.66]
    ];
    const tempos = [0.16, 0.11, 0.24];
    const scale = scales[station];
    const tempo = tempos[station];
    const bass = audioCtx.createOscillator();
    bass.type = 'square';
    const bassGain = audioCtx.createGain();
    bassGain.gain.value = 0.0;
    const lead = audioCtx.createOscillator();
    lead.type = 'triangle';
    const leadGain = audioCtx.createGain();
    leadGain.gain.value = 0.0;
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const hatGain = audioCtx.createGain();
    hatGain.gain.value = 0.0;
    bass.connect(bassGain);
    bassGain.connect(this.master);
    lead.connect(leadGain);
    leadGain.connect(this.master);
    noise.connect(hp);
    hp.connect(hatGain);
    hatGain.connect(this.master);
    bass.start();
    lead.start();
    noise.start();
    this.radio = {
      mode: 'on',
      station,
      step: 0,
      nextStepTime: this.audioCtx.currentTime,
      tempo,
      scale,
      bass,
      bassGain,
      lead,
      leadGain,
      hatGain
    };
  }

  /** Turn the radio off and silence its voices. */
  stopRadio() {
    const r = this.radio;
    if (r.mode === 'on') {
      if (r.bassGain) r.bassGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.02);
      if (r.leadGain) r.leadGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.02);
      if (r.hatGain) r.hatGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.02);
    }
    r.mode = 'off';
  }

  /** Set radio mode: false/'off' to stop, a station index to switch, or 'on' to resume. */
  setRadio(mode) {
    if (!this.audioCtx) return;
    if (mode === 'off' || mode === false) {
      this.stopRadio();
    } else if (typeof mode === 'number') {
      this.startRadio(mode);
    } else if (mode === 'on') {
      if (this.radio.mode !== 'on') this.startRadio(this.radio.station || 0);
    } else {
      this.stopRadio();
    }
  }

  /** Advance the generative 8-step pattern on each update tick. */
  tick(dt) {
    const r = this.radio;
    if (!this.audioCtx || r.mode !== 'on') return;
    const now = this.audioCtx.currentTime;
    if (now < r.nextStepTime) return;
    r.nextStepTime = now + r.tempo;
    const step = r.step % 8;
    r.step++;
    const sc = r.scale;
    const bassFreq = sc[step % sc.length] / 2;
    r.bass.frequency.setValueAtTime(bassFreq, now);
    r.bassGain.gain.setValueAtTime(0.25, now);
    r.bassGain.gain.exponentialRampToValueAtTime(0.001, now + r.tempo * 0.9);
    if (step % 2 === 0) {
      const leadFreq = sc[(step * 2) % sc.length];
      r.lead.frequency.setValueAtTime(leadFreq, now);
      r.leadGain.gain.setValueAtTime(0.16, now);
      r.leadGain.gain.exponentialRampToValueAtTime(0.001, now + r.tempo * 0.8);
    }
    if (step % 4 === 0) {
      r.hatGain.gain.setValueAtTime(0.12, now);
      r.hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    }
  }

  /** Short UI click for menus and buttons. */
  uiClick() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    const env = this.audioCtx.createGain();
    env.gain.setValueAtTime(0.15, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Two-note descending sting played when the player gets busted. */
  bustSting() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    [330, 220].forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const env = this.audioCtx.createGain();
      const start = t + i * 0.25;
      env.gain.setValueAtTime(0.001, start);
      env.gain.linearRampToValueAtTime(0.3, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.connect(env);
      env.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }

  /** Rising blips that scale with the wanted level (1..5 stars). */
  wantedUp(stars) {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    for (let i = 0; i < stars; i++) {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 700 + i * 60;
      const env = this.audioCtx.createGain();
      const start = t + i * 0.08;
      env.gain.setValueAtTime(0.001, start);
      env.gain.linearRampToValueAtTime(0.2, start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(env);
      env.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.22);
    }
  }

  /** Stop oscillators and release the audio graph when no longer needed. */
  dispose() {
    if (this.engine) {
      try {
        this.engine.oscA.stop();
        this.engine.oscB.stop();
      } catch (e) {}
      this.engine = null;
    }
    this.stopRadio();
    if (this.audioCtx) {
      this.master.disconnect();
      this.audioCtx.close();
      this.audioCtx = null;
      this.master = null;
    }
    this.ctx.audioCtx = null;
  }
}
