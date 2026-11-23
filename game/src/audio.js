// audio.js - WebAudio procedural sound: engine, siren, guns, radio music, and UI cues for Solmar Bay.

/**
 * AudioSys - builds every sound in the game from oscillators and noise buffers
 * at init time (no audio files). The AudioContext stays suspended until the
 * first user gesture (the start button) calls resume(). All timing uses
 * ctx.audioCtx.currentTime.
 */
export class AudioSys {

  /** Create the system; the real AudioContext is built lazily on first gesture. */
  constructor(ctx) {
    this.ctx = ctx;
    this.AC = null;        // lazily created AudioContext
    this.master = null;    // master gain into destination
    this.masterVol = 0.5;  // keep the whole mix modest
    this.started = false;  // true once the user has interacted
    this.engine = null;    // active engine node graph
    this.siren = null;     // active siren node graph
    this.radio = null;     // active radio sequencer
    this._t = 0;           // accumulated audio time (advances on gesture only)
  }

  /** Lazily build the AudioContext + master bus, then resume on first gesture. */
  start() {
    if (this.started) return;
    this.started = true;
    const AC = (this.AC = new (window.AudioContext || window.webkitAudioContext)());
    this.master = AC.createGain();
    this.master.gain.value = this.masterVol;
    this.master.connect(AC.destination);
    AC.resume();
  }

  /** Build a reusable 1s white-noise buffer for gunshots and explosions. */
  _noiseBuffer() {
    const AC = this.AC;
    const len = AC.sampleRate;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Helper: fire one short oscillator note through a gain into the master. */
  _note(type, freq, t0, dur, vol) {
    const AC = this.AC;
    const o = AC.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = AC.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /**
   * Build the car engine: two detuned saw oscillators through a lowpass.
   * Pitch sweeps 40-130 Hz; setEngine updates it each frame.
   */
  startEngine() {
    if (!this.AC || this.engine) return;
    const AC = this.AC;
    const lp = AC.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = AC.createGain();
    g.gain.value = 0;
    lp.connect(this.master);
    g.connect(lp);
    const osc = [];
    for (let i = 0; i < 2; i++) {
      const o = AC.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      o.detune.value = i ? 12 : -12;
      o.connect(g);
      o.start();
      osc.push(o);
    }
    this.engine = { osc, lp, g };
  }

  /** Update the engine pitch/volume with a normalized rpm and an in-car flag. */
  setEngine(rpm01, inCar) {
    if (!this.engine) return;
    const base = 40 + 90 * rpm01;
    for (const o of this.engine.osc) o.frequency.value = base;
    this.engine.lp.frequency.value = 400 + 1600 * rpm01;
    this.engine.g.gain.value = inCar ? 0.5 : 0.28;
  }

  /**
   * Two-tone police wail. active when wanted>0; alternates 760/560 Hz square
   * through a slow LFO-modulated gain for the rising/falling siren sweep.
   */
  setSiren(active, t) {
    if (!this.AC) return;
    if (active && !this.siren) {
      const AC = this.AC;
      const o = AC.createOscillator();
      o.type = 'square';
      o.frequency.value = 760;
      const g = AC.createGain();
      g.gain.value = 0;
      const lfo = AC.createOscillator();
      lfo.frequency.value = 0.66;   // ~1.5s full up-down cycle
      const lfoG = AC.createGain();
      lfoG.gain.value = 0.12;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      o.connect(g);
      g.connect(this.master);
      o.start();
      lfo.start();
      this.siren = { osc: o, lfo, gain: g, t0: t };
    } else if (!active && this.siren) {
      this.siren.osc.stop();
      this.siren.lfo.stop();
      this.siren = null;
    }
    if (this.siren) {
      // alternate the carrier between the two wail tones each half cycle
      const phase = (t - this.siren.t0) % 1.5;
      this.siren.osc.frequency.value = phase < 0.75 ? 760 : 560;
      this.siren.gain.gain.value = 0.14;
    }
  }

// audio-CHUNK-2-PLACEHOLDER