// Sunfall City — audio.js
// A tiny WebAudio synth: no audio files, every sound is an oscillator or a
// burst of filtered noise. The context is created lazily on the first user
// gesture (the start button), which is what browsers require. Press M to mute.

var Sfx = {
  ctx: null,
  muted: false,
  engineOsc: null, engineGain: null,
  sirenOsc: null, sirenGain: null, sirenLfo: null,

  init: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  },

  tone: function (freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise: function (dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource(); src.buffer = buf;
    var f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 900;
    var g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },

  shot: function () { this.noise(0.09, 0.25, 1400); this.tone(160, 0.08, 'square', 0.10, 60); },
  guardShot: function () { this.noise(0.07, 0.12, 1100); },
  hit: function () { this.tone(90, 0.12, 'sawtooth', 0.16, 45); },
  crash: function () { this.noise(0.22, 0.3, 300); this.tone(70, 0.2, 'sawtooth', 0.14, 40); },
  pickup: function () { this.tone(660, 0.09, 'sine', 0.16); var s = this; setTimeout(function () { s.tone(990, 0.12, 'sine', 0.16); }, 70); },
  cash: function () {
    var s = this, notes = [880, 1108, 1318, 1760];
    notes.forEach(function (n, i) { setTimeout(function () { s.tone(n, 0.12, 'triangle', 0.15); }, i * 70); });
  },
  busted: function () { this.tone(392, 0.18, 'triangle', 0.18); var s = this; setTimeout(function () { s.tone(311, 0.3, 'triangle', 0.18); }, 160); },
  toggleMute: function () { this.muted = !this.muted; if (this.muted) { this.stopEngine(); this.stopSiren(); } return this.muted; }
};

// Continuous loops, driven from the game loop each frame: the engine hum tracks
// the player's car speed, and the siren wails whenever the wanted level is up.
Sfx.startEngine = function () {
  if (!this.ctx || this.muted || this.engineOsc) return;
  var o = this.ctx.createOscillator(), g = this.ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 55;
  g.gain.value = 0.0;
  o.connect(g); g.connect(this.ctx.destination);
  o.start();
  this.engineOsc = o; this.engineGain = g;
};
Sfx.setEngine = function (speedFrac) {
  if (!this.engineOsc) return;
  var t = this.ctx.currentTime;
  this.engineOsc.frequency.setTargetAtTime(50 + speedFrac * 130, t, 0.08);
  this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05 + speedFrac * 0.05, t, 0.1);
};
Sfx.stopEngine = function () {
  if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; this.engineGain = null; }
};
Sfx.startSiren = function () {
  if (!this.ctx || this.muted || this.sirenOsc) return;
  var o = this.ctx.createOscillator(), g = this.ctx.createGain();
  var lfo = this.ctx.createOscillator(), lfoGain = this.ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 760;
  lfo.frequency.value = 0.65; lfoGain.gain.value = 190;
  lfo.connect(lfoGain); lfoGain.connect(o.frequency);
  g.gain.value = 0.035;
  o.connect(g); g.connect(this.ctx.destination);
  o.start(); lfo.start();
  this.sirenOsc = o; this.sirenGain = g; this.sirenLfo = lfo;
};
Sfx.stopSiren = function () {
  if (this.sirenOsc) {
    try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
    this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
  }
};
