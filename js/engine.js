/* NEON BUDDIES — NFT BATTLE ARENA : moteur de jeu (stats, XP, combat, classement)
   Fonctionne dans le navigateur (window.NBEngine) et dans Node (module.exports). */
(function (root) {
  'use strict';

  var RARITIES = ['Commun', 'Rare', 'Épique', 'Légendaire'];
  var RARITY_MULT = { 'Commun': 1.0, 'Rare': 1.04, 'Épique': 1.09, 'Légendaire': 1.15 };
  var RARITY_POINTS = { 'Commun': 0, 'Rare': 20, 'Épique': 45, 'Légendaire': 80 };
  var MAX_LEVEL = 50;
  var MAX_TURNS = 80;

  // Bonus de famille (en points ajoutés aux stats de base)
  var FAMILY_BONUS = {
    'Robot Couronne':    { def: 3, hp: 6 },
    'Robot Glacé':       { def: 4, spd: -1 },
    'Lapin Pastel':      { spd: 3, crit: 1 },
    'Lapin Cyber':       { spd: 2, atk: 2 },
    'Lapin Holo':        { spd: 2, crit: 2 },
    'Mage Encapuchonné': { atk: 3, crit: 1 },
    'Panda Néon':        { hp: 14, def: 1 },
    'Petit Démon':       { atk: 3, crit: 2, hp: -4 },
    'Ange Doré':         { hp: 8, def: 2 },
    'Renard Ailé':       { spd: 3, crit: 2 }
  };

  var SPECIALS = {
    'Robot Couronne': 'Laser Royal', 'Robot Glacé': 'Blizzard Binaire',
    'Lapin Pastel': 'Bond Sucré', 'Lapin Cyber': 'Coup Cybernétique', 'Lapin Holo': 'Éclat Holographique',
    'Mage Encapuchonné': 'Sort Néon', 'Panda Néon': 'Paume du Panda', 'Petit Démon': 'Flamme Fourchue',
    'Ange Doré': 'Rayon Céleste', 'Renard Ailé': 'Plongeon Ailé'
  };

  // Hachage FNV-1a 32 bits
  function hash(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // Générateur pseudo-aléatoire déterministe (mulberry32)
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normRarity(r) {
    return RARITIES.indexOf(r) >= 0 ? r : 'Commun';
  }

  /** Stats de base déterministes à partir de l'id, des traits et de la rareté. */
  var baseStatsCache = new Map();
  function baseStats(ch) {
    var rarity = normRarity(ch.rarity);
    var traits = ch.traits || {};
    var keys = Object.keys(traits).sort();
    var traitKey = keys.map(function (k) { return k + '=' + traits[k]; }).join('|');
    var cacheKey = String(ch.id) + '|' + rarity + '|' + (ch.name || '') + '|' + traitKey;
    var cached = baseStatsCache.get(cacheKey);
    if (cached) return cached;
    var seedStr = String(ch.id) + '|' + traitKey + '|' + (ch.name || '');
    var r = rng(hash(seedStr));
    var m = RARITY_MULT[rarity];
    var s = {
      hp: 100 + Math.floor(r() * 31),     // 100–130
      atk: 15 + Math.floor(r() * 9),      // 15–23
      def: 6 + Math.floor(r() * 7),       // 6–12
      spd: 8 + Math.floor(r() * 9),       // 8–16
      crit: 5 + Math.floor(r() * 9)       // 5–13 %
    };
    var tier = RARITIES.indexOf(rarity); // bonus fixe par rareté
    s.hp += [0, 4, 8, 14][tier]; s.atk += [0, 1, 2, 3][tier]; s.def += [0, 0, 1, 2][tier];
    var fb = FAMILY_BONUS[traits.famille] || {};
    Object.keys(fb).forEach(function (k) { s[k] += fb[k]; });
    var out = {
      hp: Math.round(s.hp * m),
      atk: Math.round(s.atk * m),
      def: Math.round(s.def * m),
      spd: Math.round(s.spd * (1 + (m - 1) / 2)),
      crit: Math.min(40, Math.round(s.crit + (m - 1) * 20))
    };
    baseStatsCache.set(cacheKey, out);
    return out;
  }

  /** XP nécessaire pour passer du niveau L au niveau L+1. */
  function xpForLevel(level) { return 100 * level; }

  /** Calcule niveau et XP restante à partir de l'XP totale. */
  function levelFromXp(totalXp) {
    var level = 1, xp = Math.max(0, Math.floor(totalXp || 0));
    while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }
    return { level: level, xpInLevel: xp, xpNeeded: level >= MAX_LEVEL ? 0 : xpForLevel(level) };
  }

  /** Stats effectives : base + bonus de niveau. */
  function statsAtLevel(base, level) {
    var l = Math.max(1, Math.min(MAX_LEVEL, level || 1)) - 1;
    return {
      hp: Math.round(base.hp * (1 + 0.05 * l)),
      atk: Math.round(base.atk * (1 + 0.04 * l)),
      def: Math.round(base.def * (1 + 0.04 * l)),
      spd: Math.round(base.spd * (1 + 0.02 * l)),
      crit: Math.min(50, Math.round((base.crit + 0.3 * l) * 10) / 10)
    };
  }

  function power(st) {
    return Math.round(st.hp * 0.5 + st.atk * 3 + st.def * 2.5 + st.spd * 2 + st.crit * 1.5);
  }

  function makeFighter(ch, level, side) {
    var base = baseStats(ch);
    var st = statsAtLevel(base, level);
    return {
      id: ch.id, name: ch.name, rarity: normRarity(ch.rarity), side: side,
      level: level || 1, stats: st, hp: st.hp, maxHp: st.hp,
      special: SPECIALS[(ch.traits || {}).famille] || 'Frappe Néon', charge: 0
    };
  }

  /**
   * Combat automatique tour par tour, entièrement déterministe pour une graine donnée.
   * Retourne { winner: 'A'|'B', winnerId, loserId, turns, events, fighters }.
   */
  function scaleFighter(f, hpM, atkM, defM) {
    f.stats.hp = Math.round(f.stats.hp * hpM); f.stats.atk = Math.round(f.stats.atk * atkM); f.stats.def = Math.round(f.stats.def * defM);
    f.hp = f.maxHp = f.stats.hp;
  }
  /* opts (facultatif) : { scaleB: 1.1 } adversaire bot renforcé, { boss: BOSS } boss multi-phases. */
  function simulateBattle(chA, levelA, chB, levelB, seed, opts) {
    opts = opts || {};
    var r = rng(seed == null ? hash(chA.id + 'vs' + chB.id) : seed);
    var A = makeFighter(chA, levelA, 'A');
    var B = makeFighter(chB, levelB, 'B');
    if (opts.scaleB && opts.scaleB !== 1) scaleFighter(B, opts.scaleB, opts.scaleB, opts.scaleB);
    var boss = opts.boss || null, phase = 0;
    if (boss) { scaleFighter(B, boss.hpMult, boss.atkMult, boss.defMult); B.boss = true; B.special = boss.special; }
    var maxTurns = boss ? 140 : MAX_TURNS;
    var events = [];
    // Initiative : vitesse + un peu de hasard
    var first = (A.stats.spd + r() * 4) >= (B.stats.spd + r() * 4) ? A : B;
    var order = first === A ? [A, B] : [B, A];
    events.push({ type: 'start', first: first.side, text: first.name + ' prend l\u2019initiative !' });

    var turn = 0;
    while (A.hp > 0 && B.hp > 0 && turn < maxTurns) {
      var att = order[turn % 2];
      var def = att === A ? B : A;
      turn++;
      att.charge++;
      var special = att.charge >= 3;
      if (special) att.charge = 0;

      // Esquive : dépend de l'écart de vitesse (3 % à 20 %)
      var dodge = Math.max(3, Math.min(20, 6 + (def.stats.spd - att.stats.spd) * 1.2));
      if (!special && r() * 100 < dodge) {
        events.push({ type: 'dodge', turn: turn, attacker: att.side, defender: def.side,
          text: def.name + ' esquive l\u2019attaque de ' + att.name + ' !' });
        continue;
      }
      var crit = r() * 100 < att.stats.crit;
      var variance = 0.75 + r() * 0.5;
      var raw = att.stats.atk * variance * (special ? 1.6 : 1);
      var reduced = raw * (100 / (100 + def.stats.def * 4));
      var dmg = Math.max(1, Math.round(reduced * (crit ? 1.75 : 1)));
      def.hp = Math.max(0, def.hp - dmg);
      events.push({
        type: special ? 'special' : 'attack', turn: turn, attacker: att.side, defender: def.side,
        damage: dmg, crit: crit, hpAfter: def.hp, maxHp: def.maxHp, move: special ? att.special : 'Attaque',
        text: att.name + (special ? ' lance ' + att.special : ' attaque') + ' : ' + dmg + ' dégâts' + (crit ? ' (CRITIQUE !)' : '')
      });
      // Boss : changement de phase sous certains seuils de PV
      if (boss && def === B && B.hp > 0) {
        while (phase < boss.phases.length && B.hp <= B.maxHp * boss.phases[phase].at) {
          var ph = boss.phases[phase++];
          B.stats.atk = Math.round(B.stats.atk * (ph.atk || 1)); B.stats.def = Math.round(B.stats.def * (ph.def || 1));
          B.stats.spd = Math.round(B.stats.spd * (ph.spd || 1)); B.stats.crit = Math.min(60, B.stats.crit + (ph.crit || 0));
          var heal = Math.round(B.maxHp * (ph.heal || 0)); B.hp = Math.min(B.maxHp, B.hp + heal);
          events.push({ type: 'phase', turn: turn, side: 'B', phase: phase + 1, hpAfter: B.hp, maxHp: B.maxHp, text: B.name + ' — ' + ph.text + (heal ? ' (+' + heal + ' PV)' : '') });
        }
      }
    }

    var winner;
    if (A.hp <= 0) winner = 'B';
    else if (B.hp <= 0) winner = 'A';
    else winner = (A.hp / A.maxHp) >= (B.hp / B.maxHp) ? 'A' : 'B'; // limite de tours
    var w = winner === 'A' ? A : B, l = winner === 'A' ? B : A;
    events.push({ type: 'end', winner: winner, timeout: A.hp > 0 && B.hp > 0, text: w.name + ' remporte le combat !' });
    return { winner: winner, winnerId: w.id, loserId: l.id, turns: turn, events: events, fighters: { A: A, B: B }, bossPhase: boss ? phase + 1 : 0,
      damageToB: B.maxHp - B.hp };
  }

  /** Inverse le point de vue d'un combat (A <-> B), pour que chaque joueur PvP se voie à gauche. */
  function flipResult(res) {
    var sw = function (x) { return x === 'A' ? 'B' : x === 'B' ? 'A' : x; };
    function copyFighter(f, side) {
      var o = {};
      for (var k in f) o[k] = k === 'stats' ? Object.assign({}, f.stats) : f[k];
      o.side = side;
      return o;
    }
    var events = res.events.map(function (ev) {
      var o = {};
      for (var k in ev) o[k] = ev[k];
      ['attacker', 'defender', 'first', 'winner', 'side'].forEach(function (k) { if (o[k]) o[k] = sw(o[k]); });
      return o;
    });
    var o = {};
    for (var k in res) o[k] = res[k];
    o.winner = sw(res.winner);
    o.fighters = { A: copyFighter(res.fighters.B, 'A'), B: copyFighter(res.fighters.A, 'B') };
    o.events = events;
    return o;
  }

  /* ---------- Solo contre des bots : niveaux de difficulté ---------- */
  var DIFFICULTIES = {
    facile:    { id: 'facile', label: 'Facile', levelDelta: -2, scale: 0.85, points: 0.6 },
    normal:    { id: 'normal', label: 'Normal', levelDelta: 0, scale: 1.0, points: 1.0 },
    difficile: { id: 'difficile', label: 'Difficile', levelDelta: 1, scale: 1.06, points: 1.5 },
    cauchemar: { id: 'cauchemar', label: 'Cauchemar', levelDelta: 3, scale: 1.15, points: 2.2 }
  };
  function botLevel(diff, playerLevel) { return Math.max(1, Math.min(MAX_LEVEL, (playerLevel || 1) + (DIFFICULTIES[diff] || DIFFICULTIES.normal).levelDelta)); }

  /* ---------- Boss ---------- */
  var BOSSES = [
    { id: 'boss-roi', baseId: '0001', name: 'ROI CHROME OMEGA', special: 'Couronne Orbitale', hpMult: 1.8, atkMult: 0.3, defMult: 0.8,
      phases: [{ at: 0.6, atk: 1.12, text: 'PHASE 2 : surcharge royale ! Attaque +12 %' }, { at: 0.25, atk: 1.1, crit: 8, heal: 0.06, text: 'PHASE 3 : mode Oméga, il se répare !' }] },
    { id: 'boss-demon', baseId: '0007', name: 'ARCHIDÉMON NÉON', special: 'Brasier Infernal', hpMult: 1.6, atkMult: 0.38, defMult: 0.75,
      phases: [{ at: 0.5, atk: 1.12, spd: 1.1, text: 'PHASE 2 : rage infernale ! Vitesse et attaque augmentées' }, { at: 0.2, atk: 1.1, crit: 10, text: 'PHASE 3 : dernier souffle brûlant !' }] },
    { id: 'boss-givre', baseId: '0010', name: 'TITAN DE GIVRE', special: 'Hiver Éternel', hpMult: 2.1, atkMult: 0.36, defMult: 0.95,
      phases: [{ at: 0.66, def: 1.15, text: 'PHASE 2 : armure de glace ! Défense +15 %' }, { at: 0.33, atk: 1.2, def: 0.8, text: 'PHASE 3 : l’armure se brise, il frappe plus fort !' }] }
  ];
  var BOSS_ATTEMPTS_PER_DAY = 3;
  function dailyBoss(day) { return BOSSES[hash('boss|' + day) % BOSSES.length]; }
  function bossCharacter(boss, collection) {
    var base = (collection || []).filter(function (c) { return c.id === boss.baseId; })[0] || { traits: {} };
    return { id: boss.id, name: boss.name, rarity: 'Légendaire', traits: base.traits, baseId: boss.baseId, boss: true };
  }
  function bossLevel(playerLevel) { return Math.max(1, playerLevel || 1); }
  /** Points de boss : victoire = 900, sinon proportionnel aux dégâts infligés (max 400). */
  function bossPoints(result) {
    if (result.winner === 'A') return 900;
    return Math.round(400 * Math.min(1, result.damageToB / result.fighters.B.maxHp));
  }

  /* ---------- Tournoi à élimination directe (8 places) ---------- */
  var TOURNAMENT_POINTS = { 1: 600, 2: 300, 3: 150, 5: 60 }; // 1er, finaliste, demi-finalistes, quarts
  /** entrants : [{ ch, level, label, player? }] (8 éléments). Renvoie le tableau complet et le classement. */
  function runTournament(entrants, seed) {
    if (entrants.length !== 8) throw new Error('8 participants requis');
    var r = rng(seed >>> 0), round = entrants.map(function (e, i) { return Object.assign({ slot: i }, e); });
    var rounds = [], names = ['Quarts de finale', 'Demi-finales', 'Finale'], placement = {};
    for (var k = 0; k < 3; k++) {
      var matches = [], next = [];
      for (var i = 0; i < round.length; i += 2) {
        var a = round[i], b = round[i + 1];
        var res = simulateBattle(a.ch, a.level, b.ch, b.level, Math.floor(r() * 4294967296));
        var w = res.winner === 'A' ? a : b, l = res.winner === 'A' ? b : a;
        placement[l.slot] = [5, 3, 2][k];
        matches.push({ a: a.slot, b: b.slot, winner: w.slot, turns: res.turns, result: (a.player || b.player) ? res : null });
        next.push(w);
      }
      rounds.push({ name: names[k], matches: matches });
      round = next;
    }
    placement[round[0].slot] = 1;
    return { rounds: rounds, placement: placement, champion: round[0].slot,
      entrants: entrants.map(function (e, i) { return { slot: i, id: e.ch.id, name: e.label || e.ch.name, level: e.level, player: !!e.player, bot: !!e.bot }; }) };
  }

  /* ---------- Classement ELO (PvP) ---------- */
  function elo(ra, rb, scoreA, k) {
    k = k || 32;
    var ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    var d = Math.round(k * (scoreA - ea));
    return { a: ra + d, b: rb - d, delta: d };
  }

  function emptyCharProgress() { return { xp: 0, wins: 0, losses: 0 }; }

  /**
   * Applique le résultat d'un combat à la progression (fonction pure : renvoie une copie).
   * playerSide : 'A' (le combattant du joueur est toujours A).
   */
  function applyBattleResult(progress, result, rarities) {
    var p = JSON.parse(JSON.stringify(progress));
    p.chars = p.chars || {};
    p.profile = p.profile || defaultProfile();
    var wId = result.winnerId, lId = result.loserId;
    var cw = p.chars[wId] = p.chars[wId] || emptyCharProgress();
    var cl = p.chars[lId] = p.chars[lId] || emptyCharProgress();
    var lvW = levelFromXp(cw.xp).level, lvL = levelFromXp(cl.xp).level;

    var xpWin = 50 + 10 * lvL + Math.max(0, (lvL - lvW) * 8);
    var xpLose = 20 + 2 * lvW;
    cw.xp += xpWin; cw.wins++;
    cl.xp += xpLose; cl.losses++;

    var playerWon = result.winner === 'A';
    var opp = result.fighters.B;
    var pts;
    if (playerWon) {
      // Les points dépendent de la difficulté : battre plus faible que soi rapporte moins.
      var ratio = Math.max(0.4, Math.min(1.5, power(opp.stats) / power(result.fighters.A.stats)));
      pts = Math.round((100 + (RARITY_POINTS[opp.rarity] || 0) + Math.max(0, (opp.level - result.fighters.A.level) * 10)) * ratio);
      p.profile.wins++; p.profile.streak++;
      p.profile.bestStreak = Math.max(p.profile.bestStreak, p.profile.streak);
      pts += Math.min(100, (p.profile.streak - 1) * 10); // bonus de série
    } else {
      pts = 10;
      p.profile.losses++; p.profile.streak = 0;
    }
    p.profile.points += pts;
    p.profile.battles++;
    p.history = (p.history || []);
    p.history.unshift({ a: result.fighters.A.id, b: opp.id, win: playerWon, pts: pts, t: Date.now() });
    p.history = p.history.slice(0, 20);

    return {
      progress: p,
      summary: {
        playerWon: playerWon, points: pts,
        xpWinner: xpWin, xpLoser: xpLose,
        winnerLevelBefore: lvW, winnerLevelAfter: levelFromXp(cw.xp).level,
        loserLevelBefore: lvL, loserLevelAfter: levelFromXp(cl.xp).level
      }
    };
  }

  function defaultProfile() {
    return { points: 0, wins: 0, losses: 0, battles: 0, streak: 0, bestStreak: 0 };
  }

  /** Classement : victoires, puis niveau, puis taux de victoire, puis puissance. */
  function leaderboard(characters, progress) {
    var chars = (progress && progress.chars) || {};
    return characters.map(function (ch) {
      var cp = chars[ch.id] || emptyCharProgress();
      var lv = levelFromXp(cp.xp);
      var total = cp.wins + cp.losses;
      return {
        id: ch.id, name: ch.name, rarity: normRarity(ch.rarity), level: lv.level, xp: cp.xp,
        wins: cp.wins, losses: cp.losses, battles: total,
        winRate: total ? Math.round(cp.wins / total * 100) : 0,
        power: power(statsAtLevel(baseStats(ch), lv.level))
      };
    }).sort(function (a, b) {
      return (b.wins - a.wins) || (b.level - a.level) || (b.winRate - a.winRate) || (b.power - a.power) || (a.id < b.id ? -1 : 1);
    }).map(function (row, i) { row.rank = i + 1; return row; });
  }


  /* ---------- Missions quotidiennes ---------- */
  var MISSION_POOL = [
    { id: 'win3', text: 'Gagne 3 combats', type: 'wins', target: 3, points: 120 },
    { id: 'win5', text: 'Gagne 5 combats', type: 'wins', target: 5, points: 200 },
    { id: 'fight5', text: 'Dispute 5 combats', type: 'battles', target: 5, points: 80 },
    { id: 'fight10', text: 'Dispute 10 combats', type: 'battles', target: 10, points: 150 },
    { id: 'common', text: 'Gagne avec un personnage Commun', type: 'winWith', rarity: 'Commun', target: 1, points: 100 },
    { id: 'rare2', text: 'Gagne 2 fois avec un personnage Rare', type: 'winWith', rarity: 'Rare', target: 2, points: 120 },
    { id: 'beatEpic', text: 'Bats un adversaire Épique', type: 'beat', rarity: 'Épique', target: 1, points: 120 },
    { id: 'beatLeg', text: 'Bats un adversaire Légendaire', type: 'beat', rarity: 'Légendaire', target: 1, points: 180 },
    { id: 'crit5', text: 'Inflige 5 coups critiques', type: 'crits', target: 5, points: 100 },
    { id: 'special6', text: 'Lance 6 attaques spéciales', type: 'specials', target: 6, points: 90 },
    { id: 'streak3', text: 'Enchaîne 3 victoires d\u2019affilée', type: 'streak', target: 3, points: 160 }
  ];

  function dayKey(date) {
    var d = date ? new Date(date) : new Date();
    return d.toISOString().slice(0, 10); // jour UTC
  }

  /** 3 missions du jour, identiques pour tous les joueurs (choix déterministe selon la date). */
  function dailyMissions(day) {
    var r = rng(hash('missions|' + day));
    var pool = MISSION_POOL.slice(), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }

  /** Met à jour l'état des missions après un combat (fonction pure). */
  function updateMissions(state, result, streakAfter, day) {
    var st = state && state.day === day ? JSON.parse(JSON.stringify(state)) : { day: day, progress: {}, done: {} };
    st.progress = st.progress || {}; st.done = st.done || {};
    var won = result.winner === 'A';
    var crits = 0, specials = 0;
    result.events.forEach(function (ev) {
      if (ev.attacker === 'A' && ev.crit) crits++;
      if (ev.attacker === 'A' && ev.type === 'special') specials++;
    });
    var completed = [], bonus = 0;
    dailyMissions(day).forEach(function (m) {
      if (st.done[m.id]) return;
      var cur = st.progress[m.id] || 0;
      if (m.type === 'wins' && won) cur++;
      else if (m.type === 'battles') cur++;
      else if (m.type === 'winWith' && won && result.fighters.A.rarity === m.rarity) cur++;
      else if (m.type === 'beat' && won && result.fighters.B.rarity === m.rarity) cur++;
      else if (m.type === 'crits') cur += crits;
      else if (m.type === 'specials') cur += specials;
      else if (m.type === 'streak') cur = Math.max(cur, streakAfter);
      cur = Math.min(cur, m.target);
      st.progress[m.id] = cur;
      if (cur >= m.target) { st.done[m.id] = true; completed.push(m); bonus += m.points; }
    });
    return { state: st, completed: completed, bonusPoints: bonus };
  }

  var api = {
    RARITIES: RARITIES, RARITY_MULT: RARITY_MULT, MAX_LEVEL: MAX_LEVEL, MAX_TURNS: MAX_TURNS, SPECIALS: SPECIALS,
    hash: hash, rng: rng, baseStats: baseStats, xpForLevel: xpForLevel, levelFromXp: levelFromXp,
    statsAtLevel: statsAtLevel, power: power, makeFighter: makeFighter, simulateBattle: simulateBattle,
    applyBattleResult: applyBattleResult, leaderboard: leaderboard, defaultProfile: defaultProfile,
    MISSION_POOL: MISSION_POOL, dayKey: dayKey, dailyMissions: dailyMissions, updateMissions: updateMissions,
    flipResult: flipResult, DIFFICULTIES: DIFFICULTIES, botLevel: botLevel, BOSSES: BOSSES, BOSS_ATTEMPTS_PER_DAY: BOSS_ATTEMPTS_PER_DAY, dailyBoss: dailyBoss,
    bossCharacter: bossCharacter, bossLevel: bossLevel, bossPoints: bossPoints, TOURNAMENT_POINTS: TOURNAMENT_POINTS, runTournament: runTournament, elo: elo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NBEngine = api;
})(typeof window !== 'undefined' ? window : this);
