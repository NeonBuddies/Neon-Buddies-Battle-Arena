/* Effets sonores synthétisés (Web Audio) — aucun fichier audio nécessaire. */
(function (root) {
  'use strict';
  var ctx = null, enabled = true;
  function ac() {
    if (!ctx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slide) {
    if (!enabled) return;
    var c = ac(); if (!c) return;
    var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(vol || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  root.NBAudio = {
    setEnabled: function (v) { enabled = !!v; },
    hit: function () { tone(220, 0.12, 'square', 0.05, 90); },
    crit: function () { tone(660, 0.08, 'sawtooth', 0.06, 1200); setTimeout(function () { tone(180, 0.2, 'square', 0.06, 60); }, 70); },
    special: function () { tone(300, 0.35, 'sawtooth', 0.05, 1400); },
    dodge: function () { tone(900, 0.1, 'triangle', 0.04, 1500); },
    click: function () { tone(520, 0.05, 'triangle', 0.03); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 'triangle', 0.06); }, i * 120); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'sawtooth', 0.04); }, i * 150); }); },
    levelUp: function () { [784, 988, 1175].forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'square', 0.04); }, i * 90); }); }
  };
})(window);
