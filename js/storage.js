/* Sauvegarde locale (localStorage) — progression, personnages ajoutés, réglages. */
(function (root) {
  'use strict';
  var KEY = 'neonBuddiesArena.save.v1';
  var VERSION = 1;

  function defaultSave() {
    return {
      version: VERSION,
      profile: { points: 0, wins: 0, losses: 0, battles: 0, streak: 0, bestStreak: 0 },
      chars: {},
      custom: [],
      history: [],
      missions: { day: '', progress: {}, done: {} },
      settings: { sound: true, speed: 1, lastA: '', mode: 'duel', difficulty: 'normal' },
      local: { bossDay: '', bossUsed: 0, tourDay: '' }, // limites quotidiennes du mode hors ligne
      starter: null
    };
  }

  function sanitize(data) {
    var d = defaultSave();
    if (!data || typeof data !== 'object') return d;
    if (data.profile && typeof data.profile === 'object') {
      Object.keys(d.profile).forEach(function (k) {
        var v = Number(data.profile[k]);
        d.profile[k] = isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      });
    }
    if (data.chars && typeof data.chars === 'object') {
      Object.keys(data.chars).forEach(function (id) {
        var c = data.chars[id] || {};
        d.chars[id] = {
          xp: Math.max(0, Math.floor(Number(c.xp) || 0)),
          wins: Math.max(0, Math.floor(Number(c.wins) || 0)),
          losses: Math.max(0, Math.floor(Number(c.losses) || 0))
        };
      });
    }
    if (Array.isArray(data.custom)) {
      d.custom = data.custom.filter(function (c) {
        return c && typeof c.id === 'string' && typeof c.image === 'string' && /^data:image\//.test(c.image);
      }).map(function (c) {
        return { id: c.id, name: String(c.name || 'Mon NFT').slice(0, 40), rarity: String(c.rarity || 'Commun'),
          image: c.image, createdAt: Number(c.createdAt) || 0, traits: c.traits && typeof c.traits === 'object' ? c.traits : { famille: 'Personnalisé' } };
      });
    }
    if (Array.isArray(data.history)) d.history = data.history.slice(0, 20).filter(function (h) { return h && typeof h === 'object'; }).map(function (h) {
      return { a: String(h.a || ''), b: String(h.b || ''), win: !!h.win, pts: Math.floor(Number(h.pts) || 0), t: Number(h.t) || 0, bName: h.bName ? String(h.bName).slice(0, 40) : undefined, mode: h.mode ? String(h.mode).slice(0, 10) : undefined };
    });
    if (data.missions && typeof data.missions === 'object' && typeof data.missions.day === 'string') {
      var clean = function (o, num) {
        var out = {};
        if (o && typeof o === 'object') Object.keys(o).slice(0, 20).forEach(function (k) { out[String(k).slice(0, 20)] = num ? Math.max(0, Math.floor(Number(o[k]) || 0)) : !!o[k]; });
        return out;
      };
      d.missions = { day: data.missions.day.slice(0, 10), progress: clean(data.missions.progress, true), done: clean(data.missions.done, false) };
    }
    if (data.settings && typeof data.settings === 'object') {
      d.settings.sound = data.settings.sound !== false;
      d.settings.speed = [1, 2, 4].indexOf(Number(data.settings.speed)) >= 0 ? Number(data.settings.speed) : 1;
      d.settings.lastA = typeof data.settings.lastA === 'string' ? data.settings.lastA.slice(0, 40) : '';
      d.settings.mode = ['duel', 'solo', 'pvp', 'tournoi', 'boss'].indexOf(data.settings.mode) >= 0 ? data.settings.mode : 'duel';
      d.settings.difficulty = ['facile', 'normal', 'difficile', 'cauchemar'].indexOf(data.settings.difficulty) >= 0 ? data.settings.difficulty : 'normal';
    }
    if (data.starter && typeof data.starter === 'object' && Array.isArray(data.starter.offer)) {
      var offer = data.starter.offer.map(function (id) { return String(id).slice(0, 8); }).filter(function (id, i, a) { return /^\d{4}$/.test(id) && a.indexOf(id) === i; }).slice(0, 3);
      if (offer.length === 3) d.starter = { offer: offer, chosen: /^\d{4}$/.test(String(data.starter.chosen || '')) && offer.indexOf(String(data.starter.chosen)) >= 0 ? String(data.starter.chosen) : null };
    }
    if (data.local && typeof data.local === 'object') {
      d.local.bossDay = String(data.local.bossDay || '').slice(0, 10);
      d.local.bossUsed = Math.max(0, Math.min(99, Math.floor(Number(data.local.bossUsed) || 0)));
      d.local.tourDay = String(data.local.tourDay || '').slice(0, 10);
    }
    return d;
  }

  function createStore(backend) {
    backend = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
    var memory = null;
    return {
      KEY: KEY,
      load: function () {
        try {
          var raw = backend ? backend.getItem(KEY) : memory;
          return raw ? sanitize(JSON.parse(raw)) : defaultSave();
        } catch (e) { return defaultSave(); }
      },
      save: function (data) {
        var raw = JSON.stringify(sanitize(data));
        try {
          if (backend) backend.setItem(KEY, raw); else memory = raw;
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e && e.name === 'QuotaExceededError') ? 'quota' : 'erreur' };
        }
      },
      reset: function () {
        try { if (backend) backend.removeItem(KEY); else memory = null; } catch (e) { /* ignore */ }
        return defaultSave();
      },
      exportJson: function (data) { return JSON.stringify(sanitize(data)); },
      importJson: function (txt) { return sanitize(JSON.parse(txt)); }
    };
  }

  var api = { KEY: KEY, VERSION: VERSION, defaultSave: defaultSave, sanitize: sanitize, createStore: createStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NBStorage = api;
})(typeof window !== 'undefined' ? window : this);
