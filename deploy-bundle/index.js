var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod2) => function __require() {
  try {
    return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
  } catch (e) {
    throw mod2 = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
  mod2
));

// ../js/engine.js
var require_engine = __commonJS({
  "../js/engine.js"(exports, module) {
    (function(root) {
      "use strict";
      var RARITIES = ["Commun", "Rare", "\xC9pique", "L\xE9gendaire"];
      var RARITY_MULT = { "Commun": 1, "Rare": 1.04, "\xC9pique": 1.09, "L\xE9gendaire": 1.15 };
      var RARITY_POINTS = { "Commun": 0, "Rare": 20, "\xC9pique": 45, "L\xE9gendaire": 80 };
      var MAX_LEVEL = 50;
      var MAX_TURNS = 80;
      var FAMILY_BONUS = {
        "Robot Couronne": { def: 3, hp: 6 },
        "Robot Glac\xE9": { def: 4, spd: -1 },
        "Lapin Pastel": { spd: 3, crit: 1 },
        "Lapin Cyber": { spd: 2, atk: 2 },
        "Lapin Holo": { spd: 2, crit: 2 },
        "Mage Encapuchonn\xE9": { atk: 3, crit: 1 },
        "Panda N\xE9on": { hp: 14, def: 1 },
        "Petit D\xE9mon": { atk: 3, crit: 2, hp: -4 },
        "Ange Dor\xE9": { hp: 8, def: 2 },
        "Renard Ail\xE9": { spd: 3, crit: 2 }
      };
      var SPECIALS = {
        "Robot Couronne": "Laser Royal",
        "Robot Glac\xE9": "Blizzard Binaire",
        "Lapin Pastel": "Bond Sucr\xE9",
        "Lapin Cyber": "Coup Cybern\xE9tique",
        "Lapin Holo": "\xC9clat Holographique",
        "Mage Encapuchonn\xE9": "Sort N\xE9on",
        "Panda N\xE9on": "Paume du Panda",
        "Petit D\xE9mon": "Flamme Fourchue",
        "Ange Dor\xE9": "Rayon C\xE9leste",
        "Renard Ail\xE9": "Plongeon Ail\xE9"
      };
      function hash(str) {
        var h = 2166136261;
        str = String(str);
        for (var i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
      }
      __name(hash, "hash");
      function rng(seed) {
        var a = seed >>> 0;
        return function() {
          a = a + 1831565813 >>> 0;
          var t = a;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }
      __name(rng, "rng");
      function normRarity(r) {
        return RARITIES.indexOf(r) >= 0 ? r : "Commun";
      }
      __name(normRarity, "normRarity");
      var baseStatsCache = /* @__PURE__ */ new Map();
      function baseStats(ch) {
        var rarity = normRarity(ch.rarity);
        var traits = ch.traits || {};
        var keys = Object.keys(traits).sort();
        var traitKey = keys.map(function(k) {
          return k + "=" + traits[k];
        }).join("|");
        var cacheKey = String(ch.id) + "|" + rarity + "|" + (ch.name || "") + "|" + traitKey;
        var cached = baseStatsCache.get(cacheKey);
        if (cached) return cached;
        var seedStr = String(ch.id) + "|" + traitKey + "|" + (ch.name || "");
        var r = rng(hash(seedStr));
        var m = RARITY_MULT[rarity];
        var s = {
          hp: 100 + Math.floor(r() * 31),
          // 100–130
          atk: 15 + Math.floor(r() * 9),
          // 15–23
          def: 6 + Math.floor(r() * 7),
          // 6–12
          spd: 8 + Math.floor(r() * 9),
          // 8–16
          crit: 5 + Math.floor(r() * 9)
          // 5–13 %
        };
        var tier = RARITIES.indexOf(rarity);
        s.hp += [0, 4, 8, 14][tier];
        s.atk += [0, 1, 2, 3][tier];
        s.def += [0, 0, 1, 2][tier];
        var fb = FAMILY_BONUS[traits.famille] || {};
        Object.keys(fb).forEach(function(k) {
          s[k] += fb[k];
        });
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
      __name(baseStats, "baseStats");
      function xpForLevel(level) {
        return 100 * level;
      }
      __name(xpForLevel, "xpForLevel");
      function levelFromXp(totalXp) {
        var level = 1, xp = Math.max(0, Math.floor(totalXp || 0));
        while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level++;
        }
        return { level, xpInLevel: xp, xpNeeded: level >= MAX_LEVEL ? 0 : xpForLevel(level) };
      }
      __name(levelFromXp, "levelFromXp");
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
      __name(statsAtLevel, "statsAtLevel");
      function power(st) {
        return Math.round(st.hp * 0.5 + st.atk * 3 + st.def * 2.5 + st.spd * 2 + st.crit * 1.5);
      }
      __name(power, "power");
      function makeFighter(ch, level, side) {
        var base = baseStats(ch);
        var st = statsAtLevel(base, level);
        return {
          id: ch.id,
          name: ch.name,
          rarity: normRarity(ch.rarity),
          side,
          level: level || 1,
          stats: st,
          hp: st.hp,
          maxHp: st.hp,
          special: SPECIALS[(ch.traits || {}).famille] || "Frappe N\xE9on",
          charge: 0
        };
      }
      __name(makeFighter, "makeFighter");
      function scaleFighter(f, hpM, atkM, defM) {
        f.stats.hp = Math.round(f.stats.hp * hpM);
        f.stats.atk = Math.round(f.stats.atk * atkM);
        f.stats.def = Math.round(f.stats.def * defM);
        f.hp = f.maxHp = f.stats.hp;
      }
      __name(scaleFighter, "scaleFighter");
      function simulateBattle(chA, levelA, chB, levelB, seed, opts) {
        opts = opts || {};
        var r = rng(seed == null ? hash(chA.id + "vs" + chB.id) : seed);
        var A = makeFighter(chA, levelA, "A");
        var B = makeFighter(chB, levelB, "B");
        if (opts.scaleB && opts.scaleB !== 1) scaleFighter(B, opts.scaleB, opts.scaleB, opts.scaleB);
        var boss = opts.boss || null, phase = 0;
        if (boss) {
          scaleFighter(B, boss.hpMult, boss.atkMult, boss.defMult);
          B.boss = true;
          B.special = boss.special;
        }
        var maxTurns = boss ? 140 : MAX_TURNS;
        var events = [];
        var first = A.stats.spd + r() * 4 >= B.stats.spd + r() * 4 ? A : B;
        var order = first === A ? [A, B] : [B, A];
        events.push({ type: "start", first: first.side, text: first.name + " prend l\u2019initiative !" });
        var turn = 0;
        while (A.hp > 0 && B.hp > 0 && turn < maxTurns) {
          var att = order[turn % 2];
          var def = att === A ? B : A;
          turn++;
          att.charge++;
          var special = att.charge >= 3;
          if (special) att.charge = 0;
          var dodge = Math.max(3, Math.min(20, 6 + (def.stats.spd - att.stats.spd) * 1.2));
          if (!special && r() * 100 < dodge) {
            events.push({
              type: "dodge",
              turn,
              attacker: att.side,
              defender: def.side,
              text: def.name + " esquive l\u2019attaque de " + att.name + " !"
            });
            continue;
          }
          var crit = r() * 100 < att.stats.crit;
          var variance = 0.75 + r() * 0.5;
          var raw = att.stats.atk * variance * (special ? 1.6 : 1);
          var reduced = raw * (100 / (100 + def.stats.def * 4));
          var dmg = Math.max(1, Math.round(reduced * (crit ? 1.75 : 1)));
          def.hp = Math.max(0, def.hp - dmg);
          events.push({
            type: special ? "special" : "attack",
            turn,
            attacker: att.side,
            defender: def.side,
            damage: dmg,
            crit,
            hpAfter: def.hp,
            maxHp: def.maxHp,
            move: special ? att.special : "Attaque",
            text: att.name + (special ? " lance " + att.special : " attaque") + " : " + dmg + " d\xE9g\xE2ts" + (crit ? " (CRITIQUE !)" : "")
          });
          if (boss && def === B && B.hp > 0) {
            while (phase < boss.phases.length && B.hp <= B.maxHp * boss.phases[phase].at) {
              var ph = boss.phases[phase++];
              B.stats.atk = Math.round(B.stats.atk * (ph.atk || 1));
              B.stats.def = Math.round(B.stats.def * (ph.def || 1));
              B.stats.spd = Math.round(B.stats.spd * (ph.spd || 1));
              B.stats.crit = Math.min(60, B.stats.crit + (ph.crit || 0));
              var heal = Math.round(B.maxHp * (ph.heal || 0));
              B.hp = Math.min(B.maxHp, B.hp + heal);
              events.push({ type: "phase", turn, side: "B", phase: phase + 1, hpAfter: B.hp, maxHp: B.maxHp, text: B.name + " \u2014 " + ph.text + (heal ? " (+" + heal + " PV)" : "") });
            }
          }
        }
        var winner;
        if (A.hp <= 0) winner = "B";
        else if (B.hp <= 0) winner = "A";
        else winner = A.hp / A.maxHp >= B.hp / B.maxHp ? "A" : "B";
        var w = winner === "A" ? A : B, l = winner === "A" ? B : A;
        events.push({ type: "end", winner, timeout: A.hp > 0 && B.hp > 0, text: w.name + " remporte le combat !" });
        return {
          winner,
          winnerId: w.id,
          loserId: l.id,
          turns: turn,
          events,
          fighters: { A, B },
          bossPhase: boss ? phase + 1 : 0,
          damageToB: B.maxHp - B.hp
        };
      }
      __name(simulateBattle, "simulateBattle");
      function flipResult(res) {
        var sw = /* @__PURE__ */ __name(function(x) {
          return x === "A" ? "B" : x === "B" ? "A" : x;
        }, "sw");
        function copyFighter(f, side) {
          var o2 = {};
          for (var k2 in f) o2[k2] = k2 === "stats" ? Object.assign({}, f.stats) : f[k2];
          o2.side = side;
          return o2;
        }
        __name(copyFighter, "copyFighter");
        var events = res.events.map(function(ev) {
          var o2 = {};
          for (var k2 in ev) o2[k2] = ev[k2];
          ["attacker", "defender", "first", "winner", "side"].forEach(function(k3) {
            if (o2[k3]) o2[k3] = sw(o2[k3]);
          });
          return o2;
        });
        var o = {};
        for (var k in res) o[k] = res[k];
        o.winner = sw(res.winner);
        o.fighters = { A: copyFighter(res.fighters.B, "A"), B: copyFighter(res.fighters.A, "B") };
        o.events = events;
        return o;
      }
      __name(flipResult, "flipResult");
      var DIFFICULTIES = {
        facile: { id: "facile", label: "Facile", levelDelta: -2, scale: 0.85, points: 0.6 },
        normal: { id: "normal", label: "Normal", levelDelta: 0, scale: 1, points: 1 },
        difficile: { id: "difficile", label: "Difficile", levelDelta: 1, scale: 1.06, points: 1.5 },
        cauchemar: { id: "cauchemar", label: "Cauchemar", levelDelta: 3, scale: 1.15, points: 2.2 }
      };
      function botLevel(diff, playerLevel) {
        return Math.max(1, Math.min(MAX_LEVEL, (playerLevel || 1) + (DIFFICULTIES[diff] || DIFFICULTIES.normal).levelDelta));
      }
      __name(botLevel, "botLevel");
      var BOSSES = [
        {
          id: "boss-roi",
          baseId: "0001",
          name: "ROI CHROME OMEGA",
          special: "Couronne Orbitale",
          hpMult: 1.8,
          atkMult: 0.3,
          defMult: 0.8,
          phases: [{ at: 0.6, atk: 1.12, text: "PHASE 2 : surcharge royale ! Attaque +12 %" }, { at: 0.25, atk: 1.1, crit: 8, heal: 0.06, text: "PHASE 3 : mode Om\xE9ga, il se r\xE9pare !" }]
        },
        {
          id: "boss-demon",
          baseId: "0007",
          name: "ARCHID\xC9MON N\xC9ON",
          special: "Brasier Infernal",
          hpMult: 1.6,
          atkMult: 0.38,
          defMult: 0.75,
          phases: [{ at: 0.5, atk: 1.12, spd: 1.1, text: "PHASE 2 : rage infernale ! Vitesse et attaque augment\xE9es" }, { at: 0.2, atk: 1.1, crit: 10, text: "PHASE 3 : dernier souffle br\xFBlant !" }]
        },
        {
          id: "boss-givre",
          baseId: "0010",
          name: "TITAN DE GIVRE",
          special: "Hiver \xC9ternel",
          hpMult: 2.1,
          atkMult: 0.36,
          defMult: 0.95,
          phases: [{ at: 0.66, def: 1.15, text: "PHASE 2 : armure de glace ! D\xE9fense +15 %" }, { at: 0.33, atk: 1.2, def: 0.8, text: "PHASE 3 : l\u2019armure se brise, il frappe plus fort !" }]
        }
      ];
      var BOSS_ATTEMPTS_PER_DAY = 3;
      function dailyBoss(day) {
        return BOSSES[hash("boss|" + day) % BOSSES.length];
      }
      __name(dailyBoss, "dailyBoss");
      function bossCharacter(boss, collection) {
        var base = (collection || []).filter(function(c) {
          return c.id === boss.baseId;
        })[0] || { traits: {} };
        return { id: boss.id, name: boss.name, rarity: "L\xE9gendaire", traits: base.traits, baseId: boss.baseId, boss: true };
      }
      __name(bossCharacter, "bossCharacter");
      function bossLevel(playerLevel) {
        return Math.max(1, playerLevel || 1);
      }
      __name(bossLevel, "bossLevel");
      function bossPoints(result) {
        if (result.winner === "A") return 900;
        return Math.round(400 * Math.min(1, result.damageToB / result.fighters.B.maxHp));
      }
      __name(bossPoints, "bossPoints");
      var TOURNAMENT_POINTS = { 1: 600, 2: 300, 3: 150, 5: 60 };
      function runTournament(entrants, seed) {
        if (entrants.length !== 8) throw new Error("8 participants requis");
        var r = rng(seed >>> 0), round = entrants.map(function(e, i2) {
          return Object.assign({ slot: i2 }, e);
        });
        var rounds = [], names = ["Quarts de finale", "Demi-finales", "Finale"], placement = {};
        for (var k = 0; k < 3; k++) {
          var matches = [], next = [];
          for (var i = 0; i < round.length; i += 2) {
            var a = round[i], b = round[i + 1];
            var res = simulateBattle(a.ch, a.level, b.ch, b.level, Math.floor(r() * 4294967296));
            var w = res.winner === "A" ? a : b, l = res.winner === "A" ? b : a;
            placement[l.slot] = [5, 3, 2][k];
            matches.push({ a: a.slot, b: b.slot, winner: w.slot, turns: res.turns, result: a.player || b.player ? res : null });
            next.push(w);
          }
          rounds.push({ name: names[k], matches });
          round = next;
        }
        placement[round[0].slot] = 1;
        return {
          rounds,
          placement,
          champion: round[0].slot,
          entrants: entrants.map(function(e, i2) {
            return { slot: i2, id: e.ch.id, name: e.label || e.ch.name, level: e.level, player: !!e.player, bot: !!e.bot };
          })
        };
      }
      __name(runTournament, "runTournament");
      function elo(ra, rb, scoreA, k) {
        k = k || 32;
        var ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
        var d = Math.round(k * (scoreA - ea));
        return { a: ra + d, b: rb - d, delta: d };
      }
      __name(elo, "elo");
      function emptyCharProgress() {
        return { xp: 0, wins: 0, losses: 0 };
      }
      __name(emptyCharProgress, "emptyCharProgress");
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
        cw.xp += xpWin;
        cw.wins++;
        cl.xp += xpLose;
        cl.losses++;
        var playerWon = result.winner === "A";
        var opp = result.fighters.B;
        var pts;
        if (playerWon) {
          var ratio = Math.max(0.4, Math.min(1.5, power(opp.stats) / power(result.fighters.A.stats)));
          pts = Math.round((100 + (RARITY_POINTS[opp.rarity] || 0) + Math.max(0, (opp.level - result.fighters.A.level) * 10)) * ratio);
          p.profile.wins++;
          p.profile.streak++;
          p.profile.bestStreak = Math.max(p.profile.bestStreak, p.profile.streak);
          pts += Math.min(100, (p.profile.streak - 1) * 10);
        } else {
          pts = 10;
          p.profile.losses++;
          p.profile.streak = 0;
        }
        p.profile.points += pts;
        p.profile.battles++;
        p.history = p.history || [];
        p.history.unshift({ a: result.fighters.A.id, b: opp.id, win: playerWon, pts, t: Date.now() });
        p.history = p.history.slice(0, 20);
        return {
          progress: p,
          summary: {
            playerWon,
            points: pts,
            xpWinner: xpWin,
            xpLoser: xpLose,
            winnerLevelBefore: lvW,
            winnerLevelAfter: levelFromXp(cw.xp).level,
            loserLevelBefore: lvL,
            loserLevelAfter: levelFromXp(cl.xp).level
          }
        };
      }
      __name(applyBattleResult, "applyBattleResult");
      function defaultProfile() {
        return { points: 0, wins: 0, losses: 0, battles: 0, streak: 0, bestStreak: 0 };
      }
      __name(defaultProfile, "defaultProfile");
      function leaderboard(characters, progress) {
        var chars = progress && progress.chars || {};
        return characters.map(function(ch) {
          var cp = chars[ch.id] || emptyCharProgress();
          var lv = levelFromXp(cp.xp);
          var total = cp.wins + cp.losses;
          return {
            id: ch.id,
            name: ch.name,
            rarity: normRarity(ch.rarity),
            level: lv.level,
            xp: cp.xp,
            wins: cp.wins,
            losses: cp.losses,
            battles: total,
            winRate: total ? Math.round(cp.wins / total * 100) : 0,
            power: power(statsAtLevel(baseStats(ch), lv.level))
          };
        }).sort(function(a, b) {
          return b.wins - a.wins || b.level - a.level || b.winRate - a.winRate || b.power - a.power || (a.id < b.id ? -1 : 1);
        }).map(function(row, i) {
          row.rank = i + 1;
          return row;
        });
      }
      __name(leaderboard, "leaderboard");
      var MISSION_POOL = [
        { id: "win3", text: "Gagne 3 combats", type: "wins", target: 3, points: 120 },
        { id: "win5", text: "Gagne 5 combats", type: "wins", target: 5, points: 200 },
        { id: "fight5", text: "Dispute 5 combats", type: "battles", target: 5, points: 80 },
        { id: "fight10", text: "Dispute 10 combats", type: "battles", target: 10, points: 150 },
        { id: "common", text: "Gagne avec un personnage Commun", type: "winWith", rarity: "Commun", target: 1, points: 100 },
        { id: "rare2", text: "Gagne 2 fois avec un personnage Rare", type: "winWith", rarity: "Rare", target: 2, points: 120 },
        { id: "beatEpic", text: "Bats un adversaire \xC9pique", type: "beat", rarity: "\xC9pique", target: 1, points: 120 },
        { id: "beatLeg", text: "Bats un adversaire L\xE9gendaire", type: "beat", rarity: "L\xE9gendaire", target: 1, points: 180 },
        { id: "crit5", text: "Inflige 5 coups critiques", type: "crits", target: 5, points: 100 },
        { id: "special6", text: "Lance 6 attaques sp\xE9ciales", type: "specials", target: 6, points: 90 },
        { id: "streak3", text: "Encha\xEEne 3 victoires d\u2019affil\xE9e", type: "streak", target: 3, points: 160 }
      ];
      function dayKey2(date) {
        var d = date ? new Date(date) : /* @__PURE__ */ new Date();
        return d.toISOString().slice(0, 10);
      }
      __name(dayKey2, "dayKey");
      function dailyMissions(day) {
        var r = rng(hash("missions|" + day));
        var pool = MISSION_POOL.slice(), out = [];
        while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
        return out;
      }
      __name(dailyMissions, "dailyMissions");
      function updateMissions(state, result, streakAfter, day) {
        var st = state && state.day === day ? JSON.parse(JSON.stringify(state)) : { day, progress: {}, done: {} };
        st.progress = st.progress || {};
        st.done = st.done || {};
        var won = result.winner === "A";
        var crits = 0, specials = 0;
        result.events.forEach(function(ev) {
          if (ev.attacker === "A" && ev.crit) crits++;
          if (ev.attacker === "A" && ev.type === "special") specials++;
        });
        var completed = [], bonus = 0;
        dailyMissions(day).forEach(function(m) {
          if (st.done[m.id]) return;
          var cur = st.progress[m.id] || 0;
          if (m.type === "wins" && won) cur++;
          else if (m.type === "battles") cur++;
          else if (m.type === "winWith" && won && result.fighters.A.rarity === m.rarity) cur++;
          else if (m.type === "beat" && won && result.fighters.B.rarity === m.rarity) cur++;
          else if (m.type === "crits") cur += crits;
          else if (m.type === "specials") cur += specials;
          else if (m.type === "streak") cur = Math.max(cur, streakAfter);
          cur = Math.min(cur, m.target);
          st.progress[m.id] = cur;
          if (cur >= m.target) {
            st.done[m.id] = true;
            completed.push(m);
            bonus += m.points;
          }
        });
        return { state: st, completed, bonusPoints: bonus };
      }
      __name(updateMissions, "updateMissions");
      var MANUAL = { MIN_MS: 15e4, MAX_EXTRA_MS: 6e4, ATTACK_CD: 4e3, SPELL_CD: 14e3, NPC_CD: 4500, HIT_FRAC: 0.02 };
      var SPELL_BY_FAMILY = {
        "Robot Couronne": { key: "brise", title: "Couronne", mult: 1.25, ignoreDef: 0.35, blurb: "Ignore 35 % de la d\xE9fense." },
        "Lapin Pastel": { key: "siphon", title: "Pastel", mult: 1.1, healOfDmg: 0.2, blurb: "D\xE9g\xE2ts \xD71,10 et soin de 20 % des d\xE9g\xE2ts." },
        "Mage Encapuchonn\xE9": { key: "eclat", title: "Mage", mult: 1.4, blurb: "D\xE9g\xE2ts \xD71,40." },
        "Panda N\xE9on": { key: "garde", title: "Panda", mult: 0.9, shieldFrac: 0.04, blurb: "Coup r\xE9duit et un bouclier absorbe une partie du prochain coup." },
        "Renard Ail\xE9": { key: "tempo", title: "Renard", mult: 1.3, blurb: "D\xE9g\xE2ts \xD71,30." },
        "Robot Glac\xE9": { key: "glace", title: "Glace", mult: 1.1, slowMs: 1e3, blurb: "D\xE9g\xE2ts \xD71,10 et le prochain coup adverse est retard\xE9." },
        "Petit D\xE9mon": { key: "braise", title: "Braise", mult: 1.15, burnFrac: 0.02, blurb: "D\xE9g\xE2ts \xD71,15 plus une br\xFBlure." },
        "Lapin Holo": { key: "focal", title: "Holo", mult: 1.05, critBonus: 25, blurb: "D\xE9g\xE2ts \xD71,05 et +25 points de critique sur ce coup." },
        "Ange Dor\xE9": { key: "onde", title: "Ange", mult: 0.95, selfHealFrac: 0.04, blurb: "D\xE9g\xE2ts \xD70,95 et un soin." },
        "Lapin Cyber": { key: "cyber", title: "Cyber", mult: 1.2, blurb: "D\xE9g\xE2ts \xD71,20." }
      };
      function characterSpell(ch) {
        var id = String(ch && ch.id || "");
        var fam = ch && ch.traits && ch.traits.famille || "";
        if (!/^\d{4}$/.test(id)) {
          return { id: "frappe-importee", name: "Import", key: "import", mult: 1.15, ignoreDef: 0, healOfDmg: 0, blurb: "Frappe import\xE9e \xD71,15. La raret\xE9 choisie ne compte pas en class\xE9." };
        }
        var s = SPELL_BY_FAMILY[fam] || { key: "onde", title: "Neon", mult: 1.1, blurb: "D\xE9g\xE2ts \xD71,10." };
        return {
          id: "spell-" + id,
          name: s.title + " #" + id,
          key: s.key,
          mult: s.mult,
          ignoreDef: s.ignoreDef || 0,
          healOfDmg: s.healOfDmg || 0,
          shieldFrac: s.shieldFrac || 0,
          slowMs: s.slowMs || 0,
          burnFrac: s.burnFrac || 0,
          critBonus: s.critBonus || 0,
          selfHealFrac: s.selfHealFrac || 0,
          blurb: s.blurb
        };
      }
      __name(characterSpell, "characterSpell");
      function nextRoll(a) {
        a = a + 1831565813 >>> 0;
        var t = Math.imul(a ^ a >>> 15, a | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return { state: a, value: ((t ^ t >>> 14) >>> 0) / 4294967296 };
      }
      __name(nextRoll, "nextRoll");
      function bootFighter(f, readyAt) {
        return {
          id: f.id,
          name: f.name,
          rarity: f.rarity,
          level: f.level,
          stats: f.stats,
          side: f.side,
          hp: f.hp,
          maxHp: f.maxHp,
          spell: f.spell,
          atkReadyAt: readyAt,
          spellReadyAt: readyAt,
          shield: 0,
          slowMs: 0,
          actions: 0,
          actionTimes: []
        };
      }
      __name(bootFighter, "bootFighter");
      function createManualBattle(chA, levelA, chB, levelB, seed, opts) {
        opts = opts || {};
        var now2 = opts.now || 0;
        var minMs = opts.minMs == null ? MANUAL.MIN_MS : opts.minMs;
        var maxMs = opts.maxMs == null ? minMs + MANUAL.MAX_EXTRA_MS : opts.maxMs;
        var A = makeFighter(chA, levelA, "A");
        var B = makeFighter(chB, levelB, "B");
        A.spell = characterSpell(chA);
        B.spell = opts.boss ? { id: "boss-spell", name: opts.boss.special, key: "boss", mult: 1.15, blurb: opts.boss.special, ignoreDef: 0, healOfDmg: 0 } : characterSpell(chB);
        if (opts.scaleB && opts.scaleB !== 1) scaleFighter(B, opts.scaleB, opts.scaleB, opts.scaleB);
        if (opts.boss) {
          scaleFighter(B, opts.boss.hpMult, opts.boss.atkMult, opts.boss.defMult);
          B.boss = true;
        }
        return {
          v: 1,
          seed: seed >>> 0,
          rng: seed >>> 0,
          startedAt: now2,
          readyAt: now2 + minMs,
          deadlineAt: now2 + Math.max(minMs, maxMs),
          minMs,
          status: "active",
          seq: 0,
          mode: opts.mode || "duel",
          difficulty: opts.difficulty || null,
          boss: opts.boss ? { id: opts.boss.id, phases: opts.boss.phases, phase: 0 } : null,
          A: bootFighter(A, now2),
          B: bootFighter(B, now2 + 1500),
          events: [{ type: "start", text: A.name + " entre dans l\u2019ar\xE8ne. \xC0 toi de frapper." }],
          playerActions: 0,
          damageToB: 0,
          winner: null,
          forfeit: false
        };
      }
      __name(createManualBattle, "createManualBattle");
      function pushEvent(state, ev) {
        state.events.push(ev);
        if (state.events.length > 40) state.events = state.events.slice(-40);
      }
      __name(pushEvent, "pushEvent");
      function applyHit(state, att, def, kind, now2) {
        var spell = kind === "spell" ? att.spell : null;
        var roll = nextRoll(state.rng);
        state.rng = roll.state;
        var variance = 0.9 + roll.value * 0.2;
        roll = nextRoll(state.rng);
        state.rng = roll.state;
        var critChance = att.stats.crit + (spell ? spell.critBonus || 0 : 0);
        var crit = roll.value * 100 < critChance;
        var defStat = Math.max(1, def.stats.def * (1 - (spell ? spell.ignoreDef || 0 : 0)));
        var ratio = Math.max(0.7, Math.min(1.45, att.stats.atk / defStat));
        var mult = spell ? spell.mult : 1;
        var frac = MANUAL.HIT_FRAC * variance * ratio * mult * (crit ? 1.35 : 1);
        var dmg = Math.max(1, Math.round(def.maxHp * frac));
        if (spell && spell.burnFrac) dmg += Math.max(1, Math.round(def.maxHp * spell.burnFrac));
        var absorbed = 0;
        if (def.shield > 0) {
          absorbed = Math.min(def.shield, dmg - 1);
          if (absorbed < 0) absorbed = 0;
          def.shield -= absorbed;
          dmg -= absorbed;
        }
        var floored = false;
        if (now2 < state.readyAt && def.hp - dmg < 1) {
          def.hp = 1;
          floored = true;
        } else def.hp = Math.max(0, def.hp - dmg);
        if (def === state.B) state.damageToB += dmg;
        var heal = 0;
        if (spell) {
          heal = Math.round(dmg * (spell.healOfDmg || 0) + att.maxHp * (spell.selfHealFrac || 0));
          heal = Math.min(Math.round(att.maxHp * 0.12), Math.max(0, heal));
          if (heal) att.hp = Math.min(att.maxHp, att.hp + heal);
          if (spell.shieldFrac) att.shield = Math.min(Math.round(att.maxHp * 0.12), Math.round(att.maxHp * spell.shieldFrac));
          if (spell.slowMs) def.slowMs = (def.slowMs || 0) + spell.slowMs;
        }
        var move = spell ? spell.name : "Attaque";
        var text = att.name + (spell ? " lance " + spell.name : " attaque") + " : " + dmg + " d\xE9g\xE2ts" + (crit ? " (CRITIQUE !)" : "");
        pushEvent(state, {
          type: spell ? "special" : "attack",
          attacker: att.side,
          defender: def.side,
          damage: dmg,
          crit,
          heal,
          absorbed,
          floored,
          hpAfter: def.hp,
          maxHp: def.maxHp,
          move,
          spellId: spell ? spell.id : "",
          text
        });
        if (heal) pushEvent(state, { type: "heal", side: att.side, heal, text: att.name + " r\xE9cup\xE8re " + heal + " PV" });
        if (absorbed) pushEvent(state, { type: "shield", side: def.side, absorbed, text: def.name + " absorbe " + absorbed + " d\xE9g\xE2ts" });
        if (def === state.B && def.hp > 1) applyBossPhase(state);
        if (def.hp <= 0 && now2 >= state.readyAt) finishKo(state, att.side);
      }
      __name(applyHit, "applyHit");
      function applyBossPhase(state) {
        if (!state.boss) return;
        var phases = state.boss.phases || [];
        while (state.boss.phase < phases.length && state.B.hp <= state.B.maxHp * phases[state.boss.phase].at && state.B.hp > 1) {
          var ph = phases[state.boss.phase++];
          if (ph.atk) state.B.stats.atk = Math.round(state.B.stats.atk * ph.atk);
          if (ph.def) state.B.stats.def = Math.round(state.B.stats.def * ph.def);
          if (ph.spd) state.B.stats.spd = Math.round(state.B.stats.spd * ph.spd);
          if (ph.crit) state.B.stats.crit = Math.min(60, state.B.stats.crit + ph.crit);
          var heal = Math.round(state.B.maxHp * (ph.heal || 0));
          if (heal) state.B.hp = Math.min(state.B.maxHp, state.B.hp + heal);
          pushEvent(state, { type: "phase", side: "B", phase: state.boss.phase + 1, hpAfter: state.B.hp, maxHp: state.B.maxHp, text: state.B.name + " \u2014 " + ph.text + (heal ? " (+" + heal + " PV)" : "") });
        }
      }
      __name(applyBossPhase, "applyBossPhase");
      function finishKo(state, winner) {
        if (state.status !== "active") return;
        state.status = "finished";
        state.winner = winner;
        state.forfeit = !isEngaged(state);
        var w = winner === "A" ? state.A : state.B;
        pushEvent(state, { type: "end", winner, text: state.forfeit ? "Actions insuffisantes : pas de victoire ni de points." : w.name + " remporte le combat !" });
      }
      __name(finishKo, "finishKo");
      function isEngaged(state) {
        if (state.playerActions < 1) return false;
        if (state.minMs < 15e4) return true;
        var need = Math.ceil(state.minMs / 3e4), seen = {};
        state.A.actionTimes.forEach(function(t) {
          var b = Math.floor((t - state.startedAt) / 3e4);
          if (b >= 0 && b < need) seen[b] = 1;
        });
        return Object.keys(seen).length >= need;
      }
      __name(isEngaged, "isEngaged");
      function catchUpNpc(state, now2) {
        var guard = 0;
        while (state.status === "active" && state.B.atkReadyAt <= now2 && guard++ < 80) {
          var at = state.B.atkReadyAt;
          var kind = state.B.spellReadyAt <= at ? "spell" : "attack";
          var slow = state.B.slowMs || 0;
          state.B.slowMs = 0;
          applyHit(state, state.B, state.A, kind, at);
          state.B.atkReadyAt = at + MANUAL.NPC_CD + slow;
          if (kind === "spell") state.B.spellReadyAt = at + MANUAL.SPELL_CD;
        }
      }
      __name(catchUpNpc, "catchUpNpc");
      function manualAct(state, action, now2, seq) {
        var next = JSON.parse(JSON.stringify(state));
        if (next.status !== "active") return { ok: false, reason: "finished", state: next };
        catchUpNpc(next, now2);
        if (next.status !== "active") return { ok: true, reason: "resolved", state: next };
        if (seq != null && seq !== next.seq + 1) return { ok: false, reason: "seq", state };
        if (action !== "attack" && action !== "spell") return { ok: false, reason: "action", state };
        var ready = action === "spell" ? next.A.spellReadyAt : next.A.atkReadyAt;
        if (now2 < ready) return { ok: false, reason: "cooldown", readyAt: ready, state: next };
        var slow = next.A.slowMs || 0;
        next.A.slowMs = 0;
        next.A.actions++;
        next.playerActions++;
        next.A.actionTimes.push(now2);
        next.seq++;
        if (action === "spell") next.A.spellReadyAt = now2 + MANUAL.SPELL_CD + slow;
        else next.A.atkReadyAt = now2 + MANUAL.ATTACK_CD + slow;
        applyHit(next, next.A, next.B, action, now2);
        return { ok: true, reason: "ok", state: next };
      }
      __name(manualAct, "manualAct");
      function manualFinish(state, now2) {
        var next = JSON.parse(JSON.stringify(state));
        catchUpNpc(next, now2);
        if (next.status === "finished") return { ok: true, reason: "done", state: next };
        if (now2 < next.readyAt) return { ok: false, reason: "early", state: next };
        if (next.A.hp <= 0 || next.B.hp <= 0) return { ok: true, reason: "done", state: next };
        if (now2 < next.deadlineAt) return { ok: false, reason: "continue", state: next };
        if (!isEngaged(next)) {
          next.status = "forfeit";
          next.forfeit = true;
          next.winner = "B";
          pushEvent(next, { type: "end", winner: "B", text: "Aucune s\xE9rie d\u2019actions : pas de victoire ni de points." });
          return { ok: true, reason: "forfeit", state: next };
        }
        var ratioA = next.A.hp / next.A.maxHp, ratioB = next.B.hp / next.B.maxHp;
        finishKo(next, ratioA >= ratioB ? "A" : "B");
        next.forfeit = next.winner === "A" && !isEngaged(next);
        return { ok: true, reason: "deadline", state: next };
      }
      __name(manualFinish, "manualFinish");
      function manualResult(state) {
        var winner = state.winner || "B";
        var w = winner === "A" ? state.A : state.B, l = winner === "A" ? state.B : state.A;
        return {
          winner,
          winnerId: w.id,
          loserId: l.id,
          turns: state.playerActions,
          events: state.events,
          fighters: { A: snapFighter(state.A), B: snapFighter(state.B) },
          damageToB: Math.min(state.B.maxHp, state.damageToB || state.B.maxHp - state.B.hp),
          bossPhase: state.boss ? state.boss.phase + 1 : 0,
          manual: true,
          playerActions: state.playerActions,
          forfeit: !!state.forfeit
        };
      }
      __name(manualResult, "manualResult");
      function snapFighter(f) {
        return { id: f.id, name: f.name, rarity: f.rarity, level: f.level, stats: f.stats, side: f.side, hp: f.hp, maxHp: f.maxHp, spell: f.spell ? f.spell.name : "" };
      }
      __name(snapFighter, "snapFighter");
      function manualTick(state, now2) {
        var next = JSON.parse(JSON.stringify(state));
        catchUpNpc(next, now2);
        return next;
      }
      __name(manualTick, "manualTick");
      function manualView(state, now2) {
        return {
          status: state.status,
          seq: state.seq,
          mode: state.mode,
          difficulty: state.difficulty,
          startedAt: state.startedAt,
          readyAt: state.readyAt,
          deadlineAt: state.deadlineAt,
          now: now2,
          minMs: state.minMs,
          winner: state.winner,
          forfeit: !!state.forfeit,
          playerActions: state.playerActions,
          engaged: isEngaged(state),
          you: { id: state.A.id, name: state.A.name, hp: state.A.hp, maxHp: state.A.maxHp, shield: state.A.shield, atkReadyAt: state.A.atkReadyAt, spellReadyAt: state.A.spellReadyAt, spell: state.A.spell, actions: state.A.actions },
          foe: { id: state.B.id, name: state.B.name, hp: state.B.hp, maxHp: state.B.maxHp, shield: state.B.shield, spell: state.B.spell ? state.B.spell.name : "", boss: !!state.boss },
          events: state.events.slice(-12)
        };
      }
      __name(manualView, "manualView");
      var api = {
        RARITIES,
        RARITY_MULT,
        MAX_LEVEL,
        MAX_TURNS,
        SPECIALS,
        hash,
        rng,
        baseStats,
        xpForLevel,
        levelFromXp,
        statsAtLevel,
        power,
        makeFighter,
        simulateBattle,
        applyBattleResult,
        leaderboard,
        defaultProfile,
        MISSION_POOL,
        dayKey: dayKey2,
        dailyMissions,
        updateMissions,
        flipResult,
        DIFFICULTIES,
        botLevel,
        BOSSES,
        BOSS_ATTEMPTS_PER_DAY,
        dailyBoss,
        bossCharacter,
        bossLevel,
        bossPoints,
        TOURNAMENT_POINTS,
        runTournament,
        elo,
        MANUAL,
        characterSpell,
        createManualBattle,
        manualAct,
        manualFinish,
        manualTick,
        manualResult,
        manualView,
        isEngaged
      };
      if (typeof module !== "undefined" && module.exports) module.exports = api;
      else root.NBEngine = api;
    })(typeof window !== "undefined" ? window : exports);
  }
});

// ../js/collection.js
var require_collection = __commonJS({
  "../js/collection.js"(exports, module) {
    var NB_COLLECTION = [
      {
        "id": "0001",
        "tokenId": 1,
        "name": "Neon Buddies #0001",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "gold & black",
          "tenue": "puffer jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/1.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/1.json",
        "rank": 88,
        "rarity": "Commun"
      },
      {
        "id": "0002",
        "tokenId": 2,
        "name": "Neon Buddies #0002",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "rose gold & cream",
          "tenue": "varsity jacket",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/2.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/2.json",
        "rank": 96,
        "rarity": "Commun"
      },
      {
        "id": "0003",
        "tokenId": 3,
        "name": "Neon Buddies #0003",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "emerald & silver",
          "tenue": "oversized hoodie",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/3.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/3.json",
        "rank": 64,
        "rarity": "Commun"
      },
      {
        "id": "0004",
        "tokenId": 4,
        "name": "Neon Buddies #0004",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "crimson & black",
          "tenue": "techwear vest",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/4.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/4.json",
        "rank": 4,
        "rarity": "L\xE9gendaire"
      },
      {
        "id": "0005",
        "tokenId": 5,
        "name": "Neon Buddies #0005",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "sapphire & white",
          "tenue": "bomber jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/5.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/5.json",
        "rank": 54,
        "rarity": "Commun"
      },
      {
        "id": "0006",
        "tokenId": 6,
        "name": "Neon Buddies #0006",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "violet & lime",
          "tenue": "denim jacket",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/6.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/6.json",
        "rank": 23,
        "rarity": "Rare"
      },
      {
        "id": "0007",
        "tokenId": 7,
        "name": "Neon Buddies #0007",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "copper & teal",
          "tenue": "tracksuit",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/7.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/7.json",
        "rank": 90,
        "rarity": "Commun"
      },
      {
        "id": "0008",
        "tokenId": 8,
        "name": "Neon Buddies #0008",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "pearl white & lavender",
          "tenue": "raincoat",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/8.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/8.json",
        "rank": 55,
        "rarity": "Commun"
      },
      {
        "id": "0009",
        "tokenId": 9,
        "name": "Neon Buddies #0009",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "sunset orange & magenta",
          "tenue": "leather biker jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/9.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/9.json",
        "rank": 34,
        "rarity": "Rare"
      },
      {
        "id": "0010",
        "tokenId": 10,
        "name": "Neon Buddies #0010",
        "traits": {
          "famille": "Robot Couronne",
          "palette": "chrome & electric blue",
          "tenue": "knit sweater",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/10.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/10.json",
        "rank": 67,
        "rarity": "Commun"
      },
      {
        "id": "0011",
        "tokenId": 11,
        "name": "Neon Buddies #0011",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "crimson & black",
          "tenue": "varsity jacket",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/11.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/11.json",
        "rank": 22,
        "rarity": "Rare"
      },
      {
        "id": "0012",
        "tokenId": 12,
        "name": "Neon Buddies #0012",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "sapphire & white",
          "tenue": "oversized hoodie",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/12.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/12.json",
        "rank": 49,
        "rarity": "Commun"
      },
      {
        "id": "0013",
        "tokenId": 13,
        "name": "Neon Buddies #0013",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "violet & lime",
          "tenue": "techwear vest",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/13.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/13.json",
        "rank": 42,
        "rarity": "Commun"
      },
      {
        "id": "0014",
        "tokenId": 14,
        "name": "Neon Buddies #0014",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "copper & teal",
          "tenue": "bomber jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/14.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/14.json",
        "rank": 80,
        "rarity": "Commun"
      },
      {
        "id": "0015",
        "tokenId": 15,
        "name": "Neon Buddies #0015",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "pearl white & lavender",
          "tenue": "denim jacket",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/15.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/15.json",
        "rank": 92,
        "rarity": "Commun"
      },
      {
        "id": "0016",
        "tokenId": 16,
        "name": "Neon Buddies #0016",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "sunset orange & magenta",
          "tenue": "tracksuit",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/16.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/16.json",
        "rank": 44,
        "rarity": "Commun"
      },
      {
        "id": "0017",
        "tokenId": 17,
        "name": "Neon Buddies #0017",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "chrome & electric blue",
          "tenue": "raincoat",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/17.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/17.json",
        "rank": 3,
        "rarity": "L\xE9gendaire"
      },
      {
        "id": "0018",
        "tokenId": 18,
        "name": "Neon Buddies #0018",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "gold & black",
          "tenue": "leather biker jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/18.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/18.json",
        "rank": 52,
        "rarity": "Commun"
      },
      {
        "id": "0019",
        "tokenId": 19,
        "name": "Neon Buddies #0019",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "rose gold & cream",
          "tenue": "knit sweater",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/19.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/19.json",
        "rank": 77,
        "rarity": "Commun"
      },
      {
        "id": "0020",
        "tokenId": 20,
        "name": "Neon Buddies #0020",
        "traits": {
          "famille": "Lapin Pastel",
          "palette": "emerald & silver",
          "tenue": "puffer jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/20.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/20.json",
        "rank": 46,
        "rarity": "Commun"
      },
      {
        "id": "0021",
        "tokenId": 21,
        "name": "Neon Buddies #0021",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "copper & teal",
          "tenue": "oversized hoodie",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/21.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/21.json",
        "rank": 6,
        "rarity": "\xC9pique"
      },
      {
        "id": "0022",
        "tokenId": 22,
        "name": "Neon Buddies #0022",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "pearl white & lavender",
          "tenue": "techwear vest",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/22.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/22.json",
        "rank": 45,
        "rarity": "Commun"
      },
      {
        "id": "0023",
        "tokenId": 23,
        "name": "Neon Buddies #0023",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "sunset orange & magenta",
          "tenue": "bomber jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/23.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/23.json",
        "rank": 51,
        "rarity": "Commun"
      },
      {
        "id": "0024",
        "tokenId": 24,
        "name": "Neon Buddies #0024",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "chrome & electric blue",
          "tenue": "denim jacket",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/24.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/24.json",
        "rank": 19,
        "rarity": "Rare"
      },
      {
        "id": "0025",
        "tokenId": 25,
        "name": "Neon Buddies #0025",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "gold & black",
          "tenue": "tracksuit",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/25.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/25.json",
        "rank": 15,
        "rarity": "\xC9pique"
      },
      {
        "id": "0026",
        "tokenId": 26,
        "name": "Neon Buddies #0026",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "rose gold & cream",
          "tenue": "raincoat",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/26.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/26.json",
        "rank": 74,
        "rarity": "Commun"
      },
      {
        "id": "0027",
        "tokenId": 27,
        "name": "Neon Buddies #0027",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "emerald & silver",
          "tenue": "leather biker jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/27.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/27.json",
        "rank": 2,
        "rarity": "L\xE9gendaire"
      },
      {
        "id": "0028",
        "tokenId": 28,
        "name": "Neon Buddies #0028",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "crimson & black",
          "tenue": "knit sweater",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/28.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/28.json",
        "rank": 38,
        "rarity": "Rare"
      },
      {
        "id": "0029",
        "tokenId": 29,
        "name": "Neon Buddies #0029",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "sapphire & white",
          "tenue": "puffer jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/29.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/29.json",
        "rank": 79,
        "rarity": "Commun"
      },
      {
        "id": "0030",
        "tokenId": 30,
        "name": "Neon Buddies #0030",
        "traits": {
          "famille": "Mage Encapuchonn\xE9",
          "palette": "violet & lime",
          "tenue": "varsity jacket",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/30.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/30.json",
        "rank": 70,
        "rarity": "Commun"
      },
      {
        "id": "0031",
        "tokenId": 31,
        "name": "Neon Buddies #0031",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "chrome & electric blue",
          "tenue": "techwear vest",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/31.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/31.json",
        "rank": 65,
        "rarity": "Commun"
      },
      {
        "id": "0032",
        "tokenId": 32,
        "name": "Neon Buddies #0032",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "gold & black",
          "tenue": "bomber jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/32.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/32.json",
        "rank": 35,
        "rarity": "Rare"
      },
      {
        "id": "0033",
        "tokenId": 33,
        "name": "Neon Buddies #0033",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "rose gold & cream",
          "tenue": "denim jacket",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/33.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/33.json",
        "rank": 29,
        "rarity": "Rare"
      },
      {
        "id": "0034",
        "tokenId": 34,
        "name": "Neon Buddies #0034",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "emerald & silver",
          "tenue": "tracksuit",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/34.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/34.json",
        "rank": 18,
        "rarity": "Rare"
      },
      {
        "id": "0035",
        "tokenId": 35,
        "name": "Neon Buddies #0035",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "crimson & black",
          "tenue": "raincoat",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/35.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/35.json",
        "rank": 82,
        "rarity": "Commun"
      },
      {
        "id": "0036",
        "tokenId": 36,
        "name": "Neon Buddies #0036",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "sapphire & white",
          "tenue": "leather biker jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/36.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/36.json",
        "rank": 69,
        "rarity": "Commun"
      },
      {
        "id": "0037",
        "tokenId": 37,
        "name": "Neon Buddies #0037",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "violet & lime",
          "tenue": "knit sweater",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/37.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/37.json",
        "rank": 21,
        "rarity": "Rare"
      },
      {
        "id": "0038",
        "tokenId": 38,
        "name": "Neon Buddies #0038",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "copper & teal",
          "tenue": "puffer jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/38.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/38.json",
        "rank": 93,
        "rarity": "Commun"
      },
      {
        "id": "0039",
        "tokenId": 39,
        "name": "Neon Buddies #0039",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "pearl white & lavender",
          "tenue": "varsity jacket",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/39.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/39.json",
        "rank": 95,
        "rarity": "Commun"
      },
      {
        "id": "0040",
        "tokenId": 40,
        "name": "Neon Buddies #0040",
        "traits": {
          "famille": "Panda N\xE9on",
          "palette": "sunset orange & magenta",
          "tenue": "oversized hoodie",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/40.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/40.json",
        "rank": 25,
        "rarity": "Rare"
      },
      {
        "id": "0041",
        "tokenId": 41,
        "name": "Neon Buddies #0041",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "emerald & silver",
          "tenue": "bomber jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/41.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/41.json",
        "rank": 73,
        "rarity": "Commun"
      },
      {
        "id": "0042",
        "tokenId": 42,
        "name": "Neon Buddies #0042",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "crimson & black",
          "tenue": "denim jacket",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/42.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/42.json",
        "rank": 56,
        "rarity": "Commun"
      },
      {
        "id": "0043",
        "tokenId": 43,
        "name": "Neon Buddies #0043",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "sapphire & white",
          "tenue": "tracksuit",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/43.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/43.json",
        "rank": 40,
        "rarity": "Rare"
      },
      {
        "id": "0044",
        "tokenId": 44,
        "name": "Neon Buddies #0044",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "violet & lime",
          "tenue": "raincoat",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/44.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/44.json",
        "rank": 28,
        "rarity": "Rare"
      },
      {
        "id": "0045",
        "tokenId": 45,
        "name": "Neon Buddies #0045",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "copper & teal",
          "tenue": "leather biker jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/45.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/45.json",
        "rank": 84,
        "rarity": "Commun"
      },
      {
        "id": "0046",
        "tokenId": 46,
        "name": "Neon Buddies #0046",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "pearl white & lavender",
          "tenue": "knit sweater",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/46.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/46.json",
        "rank": 12,
        "rarity": "\xC9pique"
      },
      {
        "id": "0047",
        "tokenId": 47,
        "name": "Neon Buddies #0047",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "sunset orange & magenta",
          "tenue": "puffer jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/47.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/47.json",
        "rank": 16,
        "rarity": "Rare"
      },
      {
        "id": "0048",
        "tokenId": 48,
        "name": "Neon Buddies #0048",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "chrome & electric blue",
          "tenue": "varsity jacket",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/48.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/48.json",
        "rank": 60,
        "rarity": "Commun"
      },
      {
        "id": "0049",
        "tokenId": 49,
        "name": "Neon Buddies #0049",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "gold & black",
          "tenue": "oversized hoodie",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/49.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/49.json",
        "rank": 11,
        "rarity": "\xC9pique"
      },
      {
        "id": "0050",
        "tokenId": 50,
        "name": "Neon Buddies #0050",
        "traits": {
          "famille": "Renard Ail\xE9",
          "palette": "rose gold & cream",
          "tenue": "techwear vest",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/50.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/50.json",
        "rank": 100,
        "rarity": "Commun"
      },
      {
        "id": "0051",
        "tokenId": 51,
        "name": "Neon Buddies #0051",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "violet & lime",
          "tenue": "denim jacket",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/51.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/51.json",
        "rank": 72,
        "rarity": "Commun"
      },
      {
        "id": "0052",
        "tokenId": 52,
        "name": "Neon Buddies #0052",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "copper & teal",
          "tenue": "tracksuit",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/52.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/52.json",
        "rank": 63,
        "rarity": "Commun"
      },
      {
        "id": "0053",
        "tokenId": 53,
        "name": "Neon Buddies #0053",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "pearl white & lavender",
          "tenue": "raincoat",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/53.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/53.json",
        "rank": 31,
        "rarity": "Rare"
      },
      {
        "id": "0054",
        "tokenId": 54,
        "name": "Neon Buddies #0054",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "sunset orange & magenta",
          "tenue": "leather biker jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/54.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/54.json",
        "rank": 83,
        "rarity": "Commun"
      },
      {
        "id": "0055",
        "tokenId": 55,
        "name": "Neon Buddies #0055",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "chrome & electric blue",
          "tenue": "knit sweater",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/55.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/55.json",
        "rank": 24,
        "rarity": "Rare"
      },
      {
        "id": "0056",
        "tokenId": 56,
        "name": "Neon Buddies #0056",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "gold & black",
          "tenue": "puffer jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/56.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/56.json",
        "rank": 94,
        "rarity": "Commun"
      },
      {
        "id": "0057",
        "tokenId": 57,
        "name": "Neon Buddies #0057",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "rose gold & cream",
          "tenue": "varsity jacket",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/57.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/57.json",
        "rank": 97,
        "rarity": "Commun"
      },
      {
        "id": "0058",
        "tokenId": 58,
        "name": "Neon Buddies #0058",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "emerald & silver",
          "tenue": "oversized hoodie",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/58.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/58.json",
        "rank": 87,
        "rarity": "Commun"
      },
      {
        "id": "0059",
        "tokenId": 59,
        "name": "Neon Buddies #0059",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "crimson & black",
          "tenue": "techwear vest",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/59.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/59.json",
        "rank": 48,
        "rarity": "Commun"
      },
      {
        "id": "0060",
        "tokenId": 60,
        "name": "Neon Buddies #0060",
        "traits": {
          "famille": "Robot Glac\xE9",
          "palette": "sapphire & white",
          "tenue": "bomber jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/60.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/60.json",
        "rank": 47,
        "rarity": "Commun"
      },
      {
        "id": "0061",
        "tokenId": 61,
        "name": "Neon Buddies #0061",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "sunset orange & magenta",
          "tenue": "tracksuit",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/61.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/61.json",
        "rank": 62,
        "rarity": "Commun"
      },
      {
        "id": "0062",
        "tokenId": 62,
        "name": "Neon Buddies #0062",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "chrome & electric blue",
          "tenue": "raincoat",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/62.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/62.json",
        "rank": 75,
        "rarity": "Commun"
      },
      {
        "id": "0063",
        "tokenId": 63,
        "name": "Neon Buddies #0063",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "gold & black",
          "tenue": "leather biker jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/63.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/63.json",
        "rank": 59,
        "rarity": "Commun"
      },
      {
        "id": "0064",
        "tokenId": 64,
        "name": "Neon Buddies #0064",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "rose gold & cream",
          "tenue": "knit sweater",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/64.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/64.json",
        "rank": 41,
        "rarity": "Commun"
      },
      {
        "id": "0065",
        "tokenId": 65,
        "name": "Neon Buddies #0065",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "emerald & silver",
          "tenue": "puffer jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/65.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/65.json",
        "rank": 98,
        "rarity": "Commun"
      },
      {
        "id": "0066",
        "tokenId": 66,
        "name": "Neon Buddies #0066",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "crimson & black",
          "tenue": "varsity jacket",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/66.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/66.json",
        "rank": 1,
        "rarity": "L\xE9gendaire"
      },
      {
        "id": "0067",
        "tokenId": 67,
        "name": "Neon Buddies #0067",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "sapphire & white",
          "tenue": "oversized hoodie",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/67.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/67.json",
        "rank": 37,
        "rarity": "Rare"
      },
      {
        "id": "0068",
        "tokenId": 68,
        "name": "Neon Buddies #0068",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "violet & lime",
          "tenue": "techwear vest",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/68.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/68.json",
        "rank": 39,
        "rarity": "Rare"
      },
      {
        "id": "0069",
        "tokenId": 69,
        "name": "Neon Buddies #0069",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "copper & teal",
          "tenue": "bomber jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/69.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/69.json",
        "rank": 9,
        "rarity": "\xC9pique"
      },
      {
        "id": "0070",
        "tokenId": 70,
        "name": "Neon Buddies #0070",
        "traits": {
          "famille": "Petit D\xE9mon",
          "palette": "pearl white & lavender",
          "tenue": "denim jacket",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/70.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/70.json",
        "rank": 99,
        "rarity": "Commun"
      },
      {
        "id": "0071",
        "tokenId": 71,
        "name": "Neon Buddies #0071",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "rose gold & cream",
          "tenue": "raincoat",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/71.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/71.json",
        "rank": 89,
        "rarity": "Commun"
      },
      {
        "id": "0072",
        "tokenId": 72,
        "name": "Neon Buddies #0072",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "emerald & silver",
          "tenue": "leather biker jacket",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/72.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/72.json",
        "rank": 5,
        "rarity": "L\xE9gendaire"
      },
      {
        "id": "0073",
        "tokenId": 73,
        "name": "Neon Buddies #0073",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "crimson & black",
          "tenue": "knit sweater",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/73.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/73.json",
        "rank": 53,
        "rarity": "Commun"
      },
      {
        "id": "0074",
        "tokenId": 74,
        "name": "Neon Buddies #0074",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "sapphire & white",
          "tenue": "puffer jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/74.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/74.json",
        "rank": 33,
        "rarity": "Rare"
      },
      {
        "id": "0075",
        "tokenId": 75,
        "name": "Neon Buddies #0075",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "violet & lime",
          "tenue": "varsity jacket",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/75.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/75.json",
        "rank": 78,
        "rarity": "Commun"
      },
      {
        "id": "0076",
        "tokenId": 76,
        "name": "Neon Buddies #0076",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "copper & teal",
          "tenue": "oversized hoodie",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/76.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/76.json",
        "rank": 27,
        "rarity": "Rare"
      },
      {
        "id": "0077",
        "tokenId": 77,
        "name": "Neon Buddies #0077",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "pearl white & lavender",
          "tenue": "techwear vest",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/77.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/77.json",
        "rank": 10,
        "rarity": "\xC9pique"
      },
      {
        "id": "0078",
        "tokenId": 78,
        "name": "Neon Buddies #0078",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "sunset orange & magenta",
          "tenue": "bomber jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/78.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/78.json",
        "rank": 20,
        "rarity": "Rare"
      },
      {
        "id": "0079",
        "tokenId": 79,
        "name": "Neon Buddies #0079",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "chrome & electric blue",
          "tenue": "denim jacket",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/79.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/79.json",
        "rank": 8,
        "rarity": "\xC9pique"
      },
      {
        "id": "0080",
        "tokenId": 80,
        "name": "Neon Buddies #0080",
        "traits": {
          "famille": "Lapin Holo",
          "palette": "gold & black",
          "tenue": "tracksuit",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/80.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/80.json",
        "rank": 58,
        "rarity": "Commun"
      },
      {
        "id": "0081",
        "tokenId": 81,
        "name": "Neon Buddies #0081",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "sapphire & white",
          "tenue": "leather biker jacket",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/81.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/81.json",
        "rank": 71,
        "rarity": "Commun"
      },
      {
        "id": "0082",
        "tokenId": 82,
        "name": "Neon Buddies #0082",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "violet & lime",
          "tenue": "knit sweater",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/82.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/82.json",
        "rank": 81,
        "rarity": "Commun"
      },
      {
        "id": "0083",
        "tokenId": 83,
        "name": "Neon Buddies #0083",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "copper & teal",
          "tenue": "puffer jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/83.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/83.json",
        "rank": 85,
        "rarity": "Commun"
      },
      {
        "id": "0084",
        "tokenId": 84,
        "name": "Neon Buddies #0084",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "pearl white & lavender",
          "tenue": "varsity jacket",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/84.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/84.json",
        "rank": 14,
        "rarity": "\xC9pique"
      },
      {
        "id": "0085",
        "tokenId": 85,
        "name": "Neon Buddies #0085",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "sunset orange & magenta",
          "tenue": "oversized hoodie",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/85.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/85.json",
        "rank": 26,
        "rarity": "Rare"
      },
      {
        "id": "0086",
        "tokenId": 86,
        "name": "Neon Buddies #0086",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "chrome & electric blue",
          "tenue": "techwear vest",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/86.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/86.json",
        "rank": 17,
        "rarity": "Rare"
      },
      {
        "id": "0087",
        "tokenId": 87,
        "name": "Neon Buddies #0087",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "gold & black",
          "tenue": "bomber jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/87.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/87.json",
        "rank": 66,
        "rarity": "Commun"
      },
      {
        "id": "0088",
        "tokenId": 88,
        "name": "Neon Buddies #0088",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "rose gold & cream",
          "tenue": "denim jacket",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/88.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/88.json",
        "rank": 7,
        "rarity": "\xC9pique"
      },
      {
        "id": "0089",
        "tokenId": 89,
        "name": "Neon Buddies #0089",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "emerald & silver",
          "tenue": "tracksuit",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/89.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/89.json",
        "rank": 57,
        "rarity": "Commun"
      },
      {
        "id": "0090",
        "tokenId": 90,
        "name": "Neon Buddies #0090",
        "traits": {
          "famille": "Ange Dor\xE9",
          "palette": "crimson & black",
          "tenue": "raincoat",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/90.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/90.json",
        "rank": 36,
        "rarity": "Rare"
      },
      {
        "id": "0091",
        "tokenId": 91,
        "name": "Neon Buddies #0091",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "pearl white & lavender",
          "tenue": "knit sweater",
          "yeux": "crescent moon eyes",
          "couvre-chef": "bucket hat",
          "accessoire": "gaming controller"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/91.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/91.json",
        "rank": 91,
        "rarity": "Commun"
      },
      {
        "id": "0092",
        "tokenId": 92,
        "name": "Neon Buddies #0092",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "sunset orange & magenta",
          "tenue": "puffer jacket",
          "yeux": "heart-shaped eyes",
          "couvre-chef": "headband",
          "accessoire": "backpack"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/92.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/92.json",
        "rank": 61,
        "rarity": "Commun"
      },
      {
        "id": "0093",
        "tokenId": 93,
        "name": "Neon Buddies #0093",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "chrome & electric blue",
          "tenue": "varsity jacket",
          "yeux": "X-shaped eyes",
          "couvre-chef": "bandana",
          "accessoire": "chain necklace"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/93.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/93.json",
        "rank": 86,
        "rarity": "Commun"
      },
      {
        "id": "0094",
        "tokenId": 94,
        "name": "Neon Buddies #0094",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "gold & black",
          "tenue": "oversized hoodie",
          "yeux": "big sparkly eyes",
          "couvre-chef": "halo ring",
          "accessoire": "bubble tea"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/94.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/94.json",
        "rank": 43,
        "rarity": "Commun"
      },
      {
        "id": "0095",
        "tokenId": 95,
        "name": "Neon Buddies #0095",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "rose gold & cream",
          "tenue": "techwear vest",
          "yeux": "star-shaped eyes",
          "couvre-chef": "beret",
          "accessoire": "sunglasses"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/95.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/95.json",
        "rank": 76,
        "rarity": "Commun"
      },
      {
        "id": "0096",
        "tokenId": 96,
        "name": "Neon Buddies #0096",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "emerald & silver",
          "tenue": "bomber jacket",
          "yeux": "spiral eyes",
          "couvre-chef": "top hat",
          "accessoire": "skateboard"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/96.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/96.json",
        "rank": 50,
        "rarity": "Commun"
      },
      {
        "id": "0097",
        "tokenId": 97,
        "name": "Neon Buddies #0097",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "crimson & black",
          "tenue": "denim jacket",
          "yeux": "visor goggles",
          "couvre-chef": "no hat",
          "accessoire": "balloon"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/97.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/97.json",
        "rank": 32,
        "rarity": "Rare"
      },
      {
        "id": "0098",
        "tokenId": 98,
        "name": "Neon Buddies #0098",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "sapphire & white",
          "tenue": "tracksuit",
          "yeux": "round glowing eyes",
          "couvre-chef": "crown",
          "accessoire": "scarf"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/98.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/98.json",
        "rank": 13,
        "rarity": "\xC9pique"
      },
      {
        "id": "0099",
        "tokenId": 99,
        "name": "Neon Buddies #0099",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "violet & lime",
          "tenue": "raincoat",
          "yeux": "sleepy half-closed eyes",
          "couvre-chef": "beanie",
          "accessoire": "boombox"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/99.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/99.json",
        "rank": 68,
        "rarity": "Commun"
      },
      {
        "id": "0100",
        "tokenId": 100,
        "name": "Neon Buddies #0100",
        "traits": {
          "famille": "Lapin Cyber",
          "palette": "copper & teal",
          "tenue": "leather biker jacket",
          "yeux": "diamond eyes",
          "couvre-chef": "baseball cap",
          "accessoire": "big headphones"
        },
        "image_ipfs": "ipfs://bafybeigx2wlwkgo64athodvlvswiegkdlrl5c2nawndf36nufep3irlngi/100.jpg",
        "metadata": "ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/100.json",
        "rank": 30,
        "rarity": "Rare"
      }
    ];
    if (typeof module !== "undefined" && module.exports) module.exports = NB_COLLECTION;
    else window.NB_COLLECTION = NB_COLLECTION;
  }
});

// node_modules/@noble/hashes/esm/_u64.js
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK64, _32n, rotlSH, rotlSL, rotlBH, rotlBL;
var init_u64 = __esm({
  "node_modules/@noble/hashes/esm/_u64.js"() {
    U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n = /* @__PURE__ */ BigInt(32);
    __name(fromBig, "fromBig");
    __name(split, "split");
    rotlSH = /* @__PURE__ */ __name((h, l, s) => h << s | l >>> 32 - s, "rotlSH");
    rotlSL = /* @__PURE__ */ __name((h, l, s) => l << s | h >>> 32 - s, "rotlSL");
    rotlBH = /* @__PURE__ */ __name((h, l, s) => l << s - 32 | h >>> 64 - s, "rotlBH");
    rotlBL = /* @__PURE__ */ __name((h, l, s) => h << s - 32 | l >>> 64 - s, "rotlBL");
  }
});

// node_modules/@noble/hashes/esm/crypto.js
var crypto2;
var init_crypto = __esm({
  "node_modules/@noble/hashes/esm/crypto.js"() {
    crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  }
});

// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg) => hashCons().update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return Uint8Array.from(crypto2.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
var isLE, swap32IfBE, hasHexBuiltin, hexes, asciis, Hash;
var init_utils = __esm({
  "node_modules/@noble/hashes/esm/utils.js"() {
    init_crypto();
    __name(isBytes, "isBytes");
    __name(anumber, "anumber");
    __name(abytes, "abytes");
    __name(ahash, "ahash");
    __name(aexists, "aexists");
    __name(aoutput, "aoutput");
    __name(u32, "u32");
    __name(clean, "clean");
    __name(createView, "createView");
    __name(rotr, "rotr");
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    __name(byteSwap, "byteSwap");
    __name(byteSwap32, "byteSwap32");
    swap32IfBE = isLE ? (u) => u : byteSwap32;
    hasHexBuiltin = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    __name(bytesToHex, "bytesToHex");
    asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
    __name(asciiToBase16, "asciiToBase16");
    __name(hexToBytes, "hexToBytes");
    __name(utf8ToBytes, "utf8ToBytes");
    __name(toBytes, "toBytes");
    __name(concatBytes, "concatBytes");
    Hash = class {
      static {
        __name(this, "Hash");
      }
    };
    __name(createHasher, "createHasher");
    __name(randomBytes, "randomBytes");
  }
});

// node_modules/@noble/hashes/esm/sha3.js
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var _0n, _1n, _2n, _7n, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L, rotlH, rotlL, Keccak, gen, keccak_256;
var init_sha3 = __esm({
  "node_modules/@noble/hashes/esm/sha3.js"() {
    init_u64();
    init_utils();
    _0n = BigInt(0);
    _1n = BigInt(1);
    _2n = BigInt(2);
    _7n = BigInt(7);
    _256n = BigInt(256);
    _0x71n = BigInt(113);
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
    for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI.push(2 * (5 * y + x));
      SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
        if (R & _2n)
          t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
      }
      _SHA3_IOTA.push(t);
    }
    IOTAS = split(_SHA3_IOTA, true);
    SHA3_IOTA_H = IOTAS[0];
    SHA3_IOTA_L = IOTAS[1];
    rotlH = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s), "rotlH");
    rotlL = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s), "rotlL");
    __name(keccakP, "keccakP");
    Keccak = class _Keccak extends Hash {
      static {
        __name(this, "Keccak");
      }
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        this.enableXOF = false;
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        anumber(outputLen);
        if (!(0 < blockLen && blockLen < 200))
          throw new Error("only keccak-f1600 function is supported");
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists(this);
        data = toBytes(data);
        abytes(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not possible for this instance");
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        clean(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    gen = /* @__PURE__ */ __name((suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen)), "gen");
    keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();
  }
});

// src/crypto.js
function isAddress(a) {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}
function lower(a) {
  return String(a).toLowerCase();
}
function hashPersonalMessage(message) {
  const m = utf8ToBytes(message);
  return keccak_256(concatBytes(utf8ToBytes("Ethereum Signed Message:\n" + m.length), m));
}
function pad32(hexNoPrefix) {
  return hexNoPrefix.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}
function addrTopic(a) {
  return "0x" + pad32(a);
}
function uintTopic(n) {
  return "0x" + pad32(BigInt(n).toString(16));
}
function encodeSafeTransferFrom(from, to, tokenId) {
  return "0x42842e0e" + pad32(from) + pad32(to) + pad32(BigInt(tokenId).toString(16));
}
function encodeOwnerOf(tokenId) {
  return "0x6352211e" + pad32(BigInt(tokenId).toString(16));
}
function encodeIsValidSignature(hashBytes, signature) {
  const sig = String(signature).replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length % 2 !== 0 || sig.length < 2 || sig.length > 8e3) return null;
  const len = sig.length / 2;
  const padded = sig.padEnd(Math.ceil(sig.length / 64) * 64, "0");
  return "0x1626ba7e" + bytesToHex(hashBytes) + pad32("40") + pad32(len.toString(16)) + padded;
}
function is1271Magic(res) {
  const h = String(res || "").toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(h)) return false;
  const body2 = h.slice(2);
  if (body2.length !== 8 && body2.length !== 64) return false;
  if (body2.slice(0, 8) !== "1626ba7e") return false;
  return body2.length === 8 || /^0{56}$/.test(body2.slice(8));
}
function randomHex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}
async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", utf8ToBytes(s));
  return bytesToHex(new Uint8Array(d));
}
var TRANSFER_TOPIC;
var init_crypto2 = __esm({
  "src/crypto.js"() {
    init_sha3();
    init_utils();
    TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    __name(isAddress, "isAddress");
    __name(lower, "lower");
    __name(hashPersonalMessage, "hashPersonalMessage");
    __name(pad32, "pad32");
    __name(addrTopic, "addrTopic");
    __name(uintTopic, "uintTopic");
    __name(encodeSafeTransferFrom, "encodeSafeTransferFrom");
    __name(encodeOwnerOf, "encodeOwnerOf");
    __name(encodeIsValidSignature, "encodeIsValidSignature");
    __name(is1271Magic, "is1271Magic");
    __name(randomHex, "randomHex");
    __name(sha256Hex, "sha256Hex");
  }
});

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD, SHA256_IV;
var init_md = __esm({
  "node_modules/@noble/hashes/esm/_md.js"() {
    init_utils();
    __name(setBigUint64, "setBigUint64");
    __name(Chi, "Chi");
    __name(Maj, "Maj");
    HashMD = class extends Hash {
      static {
        __name(this, "HashMD");
      }
      constructor(blockLen, outputLen, padOffset, isLE2) {
        super();
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE2;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
      }
      update(data) {
        aexists(this);
        data = toBytes(data);
        abytes(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = createView(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE: isLE2 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        clean(this.buffer.subarray(pos));
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen should be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE2);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
  }
});

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K, SHA256_W, SHA256, sha256;
var init_sha2 = __esm({
  "node_modules/@noble/hashes/esm/sha2.js"() {
    init_md();
    init_utils();
    SHA256_K = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    SHA256 = class extends HashMD {
      static {
        __name(this, "SHA256");
      }
      constructor(outputLen = 32) {
        super(64, outputLen, 8, false);
        this.A = SHA256_IV[0] | 0;
        this.B = SHA256_IV[1] | 0;
        this.C = SHA256_IV[2] | 0;
        this.D = SHA256_IV[3] | 0;
        this.E = SHA256_IV[4] | 0;
        this.F = SHA256_IV[5] | 0;
        this.G = SHA256_IV[6] | 0;
        this.H = SHA256_IV[7] | 0;
      }
      get() {
        const { A, B, C, D, E: E2, F, G, H } = this;
        return [A, B, C, D, E2, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E2, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E2 | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
          const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E: E2, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E2, 6) ^ rotr(E2, 11) ^ rotr(E2, 25);
          const T1 = H + sigma1 + Chi(E2, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F;
          F = E2;
          E2 = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E2 = E2 + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E2, F, G, H);
      }
      roundClean() {
        clean(SHA256_W);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
      }
    };
    sha256 = /* @__PURE__ */ createHasher(() => new SHA256());
  }
});

// node_modules/@noble/hashes/esm/hmac.js
var HMAC, hmac;
var init_hmac = __esm({
  "node_modules/@noble/hashes/esm/hmac.js"() {
    init_utils();
    HMAC = class extends Hash {
      static {
        __name(this, "HMAC");
      }
      constructor(hash, _key) {
        super();
        this.finished = false;
        this.destroyed = false;
        ahash(hash);
        const key = toBytes(_key);
        this.iHash = hash.create();
        if (typeof this.iHash.update !== "function")
          throw new Error("Expected instance of class which extends utils.Hash");
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54;
        this.iHash.update(pad);
        this.oHash = hash.create();
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54 ^ 92;
        this.oHash.update(pad);
        clean(pad);
      }
      update(buf) {
        aexists(this);
        this.iHash.update(buf);
        return this;
      }
      digestInto(out) {
        aexists(this);
        abytes(out, this.outputLen);
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
      }
      _cloneInto(to) {
        to || (to = Object.create(Object.getPrototypeOf(this), {}));
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
      destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
      }
    };
    hmac = /* @__PURE__ */ __name((hash, key, message) => new HMAC(hash, key).update(message).digest(), "hmac");
    hmac.create = (hash, key) => new HMAC(hash, key);
  }
});

// node_modules/@noble/curves/esm/utils.js
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function _abytes2(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function numberToHexUnpadded(num2) {
  const hex = num2.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n2 : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  abytes(bytes);
  return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n2; n >>= _1n2, len += 1)
    ;
  return len;
}
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = /* @__PURE__ */ __name((len) => new Uint8Array(len), "u8n");
  const u8of = /* @__PURE__ */ __name((byte) => Uint8Array.of(byte), "u8of");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
    i = 0;
  }, "reset");
  const h = /* @__PURE__ */ __name((...b) => hmacFn(k, v, ...b), "h");
  const reseed = /* @__PURE__ */ __name((seed = u8n(0)) => {
    k = h(u8of(0), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8of(1), seed);
    v = h();
  }, "reseed");
  const gen2 = /* @__PURE__ */ __name(() => {
    if (i++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  }, "gen");
  const genUntil = /* @__PURE__ */ __name((seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen2())))
      reseed();
    reset();
    return res;
  }, "genUntil");
  return genUntil;
}
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  __name(checkField, "checkField");
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}
var _0n2, _1n2, isPosBig, bitMask;
var init_utils2 = __esm({
  "node_modules/@noble/curves/esm/utils.js"() {
    init_utils();
    init_utils();
    _0n2 = /* @__PURE__ */ BigInt(0);
    _1n2 = /* @__PURE__ */ BigInt(1);
    __name(_abool2, "_abool2");
    __name(_abytes2, "_abytes2");
    __name(numberToHexUnpadded, "numberToHexUnpadded");
    __name(hexToNumber, "hexToNumber");
    __name(bytesToNumberBE, "bytesToNumberBE");
    __name(bytesToNumberLE, "bytesToNumberLE");
    __name(numberToBytesBE, "numberToBytesBE");
    __name(numberToBytesLE, "numberToBytesLE");
    __name(ensureBytes, "ensureBytes");
    isPosBig = /* @__PURE__ */ __name((n) => typeof n === "bigint" && _0n2 <= n, "isPosBig");
    __name(inRange, "inRange");
    __name(aInRange, "aInRange");
    __name(bitLen, "bitLen");
    bitMask = /* @__PURE__ */ __name((n) => (_1n2 << BigInt(n)) - _1n2, "bitMask");
    __name(createHmacDrbg, "createHmacDrbg");
    __name(_validateObject, "_validateObject");
    __name(memoized, "memoized");
  }
});

// node_modules/@noble/curves/esm/abstract/modular.js
function mod(a, b) {
  const result = a % b;
  return result >= _0n3 ? result : b + result;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n3)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n3)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n3, y = _1n3, u = _1n3, v = _0n3;
  while (a !== _0n3) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n3) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n2);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n2), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n2) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n3;
  let S = 0;
  while (Q % _2n2 === _0n3) {
    Q /= _2n2;
    S++;
  }
  let Z = _2n2;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n3) / _2n2;
  return /* @__PURE__ */ __name(function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n3 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  }, "tonelliSlow");
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
function FpPow(Fp, num2, power) {
  if (power < _0n3)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n3)
    return Fp.ONE;
  if (power === _1n3)
    return num2;
  let p = Fp.ONE;
  let d = num2;
  while (power > _0n3) {
    if (power & _1n3)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n3;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num2);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (Fp.is0(num2))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n3) / _2n2;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLenOrOpts, isLE2 = false, opts = {}) {
  if (ORDER <= _0n3)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = void 0;
  let _sqrt = void 0;
  let modFromBytes = false;
  let allowedLengths = void 0;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE2)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE2 = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE: isLE2,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n3,
    ONE: _1n3,
    allowedLengths,
    create: /* @__PURE__ */ __name((num2) => mod(num2, ORDER), "create"),
    isValid: /* @__PURE__ */ __name((num2) => {
      if (typeof num2 !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num2);
      return _0n3 <= num2 && num2 < ORDER;
    }, "isValid"),
    is0: /* @__PURE__ */ __name((num2) => num2 === _0n3, "is0"),
    // is valid and invertible
    isValidNot0: /* @__PURE__ */ __name((num2) => !f.is0(num2) && f.isValid(num2), "isValidNot0"),
    isOdd: /* @__PURE__ */ __name((num2) => (num2 & _1n3) === _1n3, "isOdd"),
    neg: /* @__PURE__ */ __name((num2) => mod(-num2, ORDER), "neg"),
    eql: /* @__PURE__ */ __name((lhs, rhs) => lhs === rhs, "eql"),
    sqr: /* @__PURE__ */ __name((num2) => mod(num2 * num2, ORDER), "sqr"),
    add: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs + rhs, ORDER), "add"),
    sub: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs - rhs, ORDER), "sub"),
    mul: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs * rhs, ORDER), "mul"),
    pow: /* @__PURE__ */ __name((num2, power) => FpPow(f, num2, power), "pow"),
    div: /* @__PURE__ */ __name((lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER), "div"),
    // Same as above, but doesn't normalize
    sqrN: /* @__PURE__ */ __name((num2) => num2 * num2, "sqrN"),
    addN: /* @__PURE__ */ __name((lhs, rhs) => lhs + rhs, "addN"),
    subN: /* @__PURE__ */ __name((lhs, rhs) => lhs - rhs, "subN"),
    mulN: /* @__PURE__ */ __name((lhs, rhs) => lhs * rhs, "mulN"),
    inv: /* @__PURE__ */ __name((num2) => invert(num2, ORDER), "inv"),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: /* @__PURE__ */ __name((num2) => isLE2 ? numberToBytesLE(num2, BYTES) : numberToBytesBE(num2, BYTES), "toBytes"),
    fromBytes: /* @__PURE__ */ __name((bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    }, "fromBytes"),
    // TODO: we don't need it here, move out to separate fn
    invertBatch: /* @__PURE__ */ __name((lst) => FpInvertBatch(f, lst), "invertBatch"),
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov: /* @__PURE__ */ __name((a, b, c) => c ? b : a, "cmov")
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n3) + _1n3;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
var _0n3, _1n3, _2n2, _3n, _4n, _5n, _7n2, _8n, _9n, _16n, FIELD_FIELDS;
var init_modular = __esm({
  "node_modules/@noble/curves/esm/abstract/modular.js"() {
    init_utils2();
    _0n3 = BigInt(0);
    _1n3 = BigInt(1);
    _2n2 = /* @__PURE__ */ BigInt(2);
    _3n = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    _5n = /* @__PURE__ */ BigInt(5);
    _7n2 = /* @__PURE__ */ BigInt(7);
    _8n = /* @__PURE__ */ BigInt(8);
    _9n = /* @__PURE__ */ BigInt(9);
    _16n = /* @__PURE__ */ BigInt(16);
    __name(mod, "mod");
    __name(pow2, "pow2");
    __name(invert, "invert");
    __name(assertIsSquare, "assertIsSquare");
    __name(sqrt3mod4, "sqrt3mod4");
    __name(sqrt5mod8, "sqrt5mod8");
    __name(sqrt9mod16, "sqrt9mod16");
    __name(tonelliShanks, "tonelliShanks");
    __name(FpSqrt, "FpSqrt");
    FIELD_FIELDS = [
      "create",
      "isValid",
      "is0",
      "neg",
      "inv",
      "sqrt",
      "sqr",
      "eql",
      "add",
      "sub",
      "mul",
      "pow",
      "div",
      "addN",
      "subN",
      "mulN",
      "sqrN"
    ];
    __name(validateField, "validateField");
    __name(FpPow, "FpPow");
    __name(FpInvertBatch, "FpInvertBatch");
    __name(FpLegendre, "FpLegendre");
    __name(nLength, "nLength");
    __name(Field, "Field");
    __name(getFieldBytesLength, "getFieldBytesLength");
    __name(getMinHashLength, "getMinHashLength");
    __name(mapHashToField, "mapHashToField");
  }
});

// node_modules/@noble/curves/esm/abstract/curve.js
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window2, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n4;
  }
  const offsetStart = window2 * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window2 % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n4)
    throw new Error("invalid wNAF");
}
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n4 || k2 > _0n4) {
    if (k1 & _1n4)
      p1 = p1.add(acc);
    if (k2 & _1n4)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n4;
    k2 >>= _1n4;
  }
  return { p1, p2 };
}
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n4))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
var _0n4, _1n4, pointPrecomputes, pointWindowSizes, wNAF;
var init_curve = __esm({
  "node_modules/@noble/curves/esm/abstract/curve.js"() {
    init_utils2();
    init_modular();
    _0n4 = BigInt(0);
    _1n4 = BigInt(1);
    __name(negateCt, "negateCt");
    __name(normalizeZ, "normalizeZ");
    __name(validateW, "validateW");
    __name(calcWOpts, "calcWOpts");
    __name(calcOffsets, "calcOffsets");
    __name(validateMSMPoints, "validateMSMPoints");
    __name(validateMSMScalars, "validateMSMScalars");
    pointPrecomputes = /* @__PURE__ */ new WeakMap();
    pointWindowSizes = /* @__PURE__ */ new WeakMap();
    __name(getW, "getW");
    __name(assert0, "assert0");
    wNAF = class {
      static {
        __name(this, "wNAF");
      }
      // Parametrized with a given Point class (not individual point)
      constructor(Point, bits) {
        this.BASE = Point.BASE;
        this.ZERO = Point.ZERO;
        this.Fn = Point.Fn;
        this.bits = bits;
      }
      // non-const time multiplication ladder
      _unsafeLadder(elm, n, p = this.ZERO) {
        let d = elm;
        while (n > _0n4) {
          if (n & _1n4)
            p = p.add(d);
          d = d.double();
          n >>= _1n4;
        }
        return p;
      }
      /**
       * Creates a wNAF precomputation window. Used for caching.
       * Default window size is set by `utils.precompute()` and is equal to 8.
       * Number of precomputed points depends on the curve size:
       * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
       * - 𝑊 is the window size
       * - 𝑛 is the bitlength of the curve order.
       * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
       * @param point Point instance
       * @param W window size
       * @returns precomputed point tables flattened to a single array
       */
      precomputeWindow(point, W) {
        const { windows, windowSize } = calcWOpts(W, this.bits);
        const points = [];
        let p = point;
        let base = p;
        for (let window2 = 0; window2 < windows; window2++) {
          base = p;
          points.push(base);
          for (let i = 1; i < windowSize; i++) {
            base = base.add(p);
            points.push(base);
          }
          p = base.double();
        }
        return points;
      }
      /**
       * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
       * More compact implementation:
       * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
       * @returns real and fake (for const-time) points
       */
      wNAF(W, precomputes, n) {
        if (!this.Fn.isValid(n))
          throw new Error("invalid scalar");
        let p = this.ZERO;
        let f = this.BASE;
        const wo = calcWOpts(W, this.bits);
        for (let window2 = 0; window2 < wo.windows; window2++) {
          const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
          n = nextN;
          if (isZero) {
            f = f.add(negateCt(isNegF, precomputes[offsetF]));
          } else {
            p = p.add(negateCt(isNeg, precomputes[offset]));
          }
        }
        assert0(n);
        return { p, f };
      }
      /**
       * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
       * @param acc accumulator point to add result of multiplication
       * @returns point
       */
      wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
        const wo = calcWOpts(W, this.bits);
        for (let window2 = 0; window2 < wo.windows; window2++) {
          if (n === _0n4)
            break;
          const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
          n = nextN;
          if (isZero) {
            continue;
          } else {
            const item = precomputes[offset];
            acc = acc.add(isNeg ? item.negate() : item);
          }
        }
        assert0(n);
        return acc;
      }
      getPrecomputes(W, point, transform) {
        let comp = pointPrecomputes.get(point);
        if (!comp) {
          comp = this.precomputeWindow(point, W);
          if (W !== 1) {
            if (typeof transform === "function")
              comp = transform(comp);
            pointPrecomputes.set(point, comp);
          }
        }
        return comp;
      }
      cached(point, scalar, transform) {
        const W = getW(point);
        return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
      }
      unsafe(point, scalar, transform, prev) {
        const W = getW(point);
        if (W === 1)
          return this._unsafeLadder(point, scalar, prev);
        return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
      }
      // We calculate precomputes for elliptic curve point multiplication
      // using windowed method. This specifies window size and
      // stores precomputed values. Usually only base point would be precomputed.
      createCache(P, W) {
        validateW(W, this.bits);
        pointWindowSizes.set(P, W);
        pointPrecomputes.delete(P);
      }
      hasCache(elm) {
        return getW(elm) !== 1;
      }
    };
    __name(mulEndoUnsafe, "mulEndoUnsafe");
    __name(pippenger, "pippenger");
    __name(createField, "createField");
    __name(_createCurveFields, "_createCurveFields");
  }
});

// node_modules/@noble/curves/esm/abstract/weierstrass.js
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n5;
  const k2neg = k2 < _0n5;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n5;
  if (k1 < _0n5 || k1 >= MAX_NUM || k2 < _0n5 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
function _normFnElement(Fn, key) {
  const { BYTES: expected } = Fn;
  let num2;
  if (typeof key === "bigint") {
    num2 = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num2 = Fn.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn.isValidNot0(num2))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num2;
}
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  __name(assertCompressionIsSupported, "assertCompressionIsSupported");
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  __name(pointToBytes, "pointToBytes");
  function pointFromBytes(bytes) {
    _abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  __name(pointFromBytes, "pointFromBytes");
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  __name(weierstrassEquation, "weierstrassEquation");
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  __name(isValidXY, "isValidXY");
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  __name(acoord, "acoord");
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("ProjectivePoint expected");
  }
  __name(aprjpoint, "aprjpoint");
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  __name(splitEndoScalarN, "splitEndoScalarN");
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  __name(finishEndo, "finishEndo");
  class Point {
    static {
      __name(this, "Point");
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = /* @__PURE__ */ __name((n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p)), "mul");
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n5 || p.is0())
        return Point.ZERO;
      if (sc === _1n5)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? void 0 : sum;
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n5)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n5)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    // TODO: remove
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(Point, points);
    }
    static msm(points, scalars) {
      return pippenger(Point, Fn, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return Point.BASE.multiply(_normFnElement(Fn, privateKey));
    }
  }
  Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
  Point.Fp = Fp;
  Point.Fn = Fn;
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn, secretKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidSecretKey, "isValidSecretKey");
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  __name(isValidPublicKey, "isValidPublicKey");
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  __name(randomSecretKey, "randomSecretKey");
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(_normFnElement(Fn, secretKey)).toBytes(isCompressed);
  }
  __name(getPublicKey, "getPublicKey");
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  __name(keygen, "keygen");
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn.allowedLengths || secretKey === publicKey)
      return void 0;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  __name(isProbPub, "isProbPub");
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn, secretKeyA);
    const b = Point.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  __name(getSharedSecret, "getSharedSecret");
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    // TODO: remove
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: /* @__PURE__ */ __name((key) => _normFnElement(Fn, key), "normPrivateKeyToScalar"),
    precompute(windowSize = 8, point = Point.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes2 = ecdsaOpts.randomBytes || randomBytes;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: void 0,
    //'compact' as ECDSASigFormat,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n5;
    return number > HALF;
  }
  __name(isBiggerThanHalfOrder, "isBiggerThanHalfOrder");
  function validateRS(title, num2) {
    if (!Fn.isValidNot0(num2))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num2;
  }
  __name(validateRS, "validateRS");
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return _abytes2(bytes, sizer, `${format} signature`);
  }
  __name(validateSigLength, "validateSigLength");
  class Signature {
    static {
      __name(this, "Signature");
    }
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = Fn.BYTES;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n3 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes(DER.hexFromSig(this));
      const r = Fn.toBytes(this.r);
      const s = Fn.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes(r, s);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
    // TODO: remove
    assertValidity() {
    }
    static fromCompact(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, Fn.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex(this.toBytes("compact"));
    }
  }
  const bits2int = ecdsaOpts.bits2int || /* @__PURE__ */ __name(function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num2 = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num2 >> BigInt(delta) : num2;
  }, "bits2int_def");
  const bits2int_modN = ecdsaOpts.bits2int_modN || /* @__PURE__ */ __name(function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  }, "bits2int_modN_def");
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num2) {
    aInRange("num < 2^" + fnBits, num2, _0n5, ORDER_MASK);
    return Fn.toBytes(num2);
  }
  __name(int2octets, "int2octets");
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, void 0, "message");
    return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
  }
  __name(validateMsgAndHash, "validateMsgAndHash");
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes2(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n5)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n5)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n5);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    __name(k2sig, "k2sig");
    return { seed, k2sig };
  }
  __name(prepSig, "prepSig");
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  __name(sign, "sign");
  function tryParsingSig(sg) {
    let sig = void 0;
    const isHex = typeof sg === "string" || isBytes(sg);
    const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  __name(tryParsingSig, "tryParsingSig");
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === void 0 ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  __name(verify, "verify");
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  __name(recoverPublicKey, "recoverPublicKey");
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
  const Fn = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp,
    Fn,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point,
    CURVE: Object.assign({}, c, nLength(Point.Fn.ORDER, Point.Fn.BITS))
  });
}
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}
var divNearest, DERErr, DER, _0n5, _1n5, _2n3, _3n2, _4n2;
var init_weierstrass = __esm({
  "node_modules/@noble/curves/esm/abstract/weierstrass.js"() {
    init_hmac();
    init_utils();
    init_utils2();
    init_curve();
    init_modular();
    divNearest = /* @__PURE__ */ __name((num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n3) / den, "divNearest");
    __name(_splitEndoScalar, "_splitEndoScalar");
    __name(validateSigFormat, "validateSigFormat");
    __name(validateSigOpts, "validateSigOpts");
    DERErr = class extends Error {
      static {
        __name(this, "DERErr");
      }
      constructor(m = "") {
        super(m);
      }
    };
    DER = {
      // asn.1 DER encoding utils
      Err: DERErr,
      // Basic building block is TLV (Tag-Length-Value)
      _tlv: {
        encode: /* @__PURE__ */ __name((tag, data) => {
          const { Err: E2 } = DER;
          if (tag < 0 || tag > 256)
            throw new E2("tlv.encode: wrong tag");
          if (data.length & 1)
            throw new E2("tlv.encode: unpadded data");
          const dataLen = data.length / 2;
          const len = numberToHexUnpadded(dataLen);
          if (len.length / 2 & 128)
            throw new E2("tlv.encode: long form length too big");
          const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
          const t = numberToHexUnpadded(tag);
          return t + lenLen + len + data;
        }, "encode"),
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
          const { Err: E2 } = DER;
          let pos = 0;
          if (tag < 0 || tag > 256)
            throw new E2("tlv.encode: wrong tag");
          if (data.length < 2 || data[pos++] !== tag)
            throw new E2("tlv.decode: wrong tlv");
          const first = data[pos++];
          const isLong = !!(first & 128);
          let length = 0;
          if (!isLong)
            length = first;
          else {
            const lenLen = first & 127;
            if (!lenLen)
              throw new E2("tlv.decode(long): indefinite length not supported");
            if (lenLen > 4)
              throw new E2("tlv.decode(long): byte length is too big");
            const lengthBytes = data.subarray(pos, pos + lenLen);
            if (lengthBytes.length !== lenLen)
              throw new E2("tlv.decode: length bytes not complete");
            if (lengthBytes[0] === 0)
              throw new E2("tlv.decode(long): zero leftmost byte");
            for (const b of lengthBytes)
              length = length << 8 | b;
            pos += lenLen;
            if (length < 128)
              throw new E2("tlv.decode(long): not minimal encoding");
          }
          const v = data.subarray(pos, pos + length);
          if (v.length !== length)
            throw new E2("tlv.decode: wrong value length");
          return { v, l: data.subarray(pos + length) };
        }
      },
      // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
      // since we always use positive integers here. It must always be empty:
      // - add zero byte if exists
      // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
      _int: {
        encode(num2) {
          const { Err: E2 } = DER;
          if (num2 < _0n5)
            throw new E2("integer: negative integers are not allowed");
          let hex = numberToHexUnpadded(num2);
          if (Number.parseInt(hex[0], 16) & 8)
            hex = "00" + hex;
          if (hex.length & 1)
            throw new E2("unexpected DER parsing assertion: unpadded hex");
          return hex;
        },
        decode(data) {
          const { Err: E2 } = DER;
          if (data[0] & 128)
            throw new E2("invalid signature integer: negative");
          if (data[0] === 0 && !(data[1] & 128))
            throw new E2("invalid signature integer: unnecessary leading zero");
          return bytesToNumberBE(data);
        }
      },
      toSig(hex) {
        const { Err: E2, _int: int, _tlv: tlv } = DER;
        const data = ensureBytes("signature", hex);
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
        if (seqLeftBytes.length)
          throw new E2("invalid signature: left bytes after parsing");
        const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
        if (sLeftBytes.length)
          throw new E2("invalid signature: left bytes after parsing");
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
      },
      hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(2, int.encode(sig.r));
        const ss = tlv.encode(2, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(48, seq);
      }
    };
    _0n5 = BigInt(0);
    _1n5 = BigInt(1);
    _2n3 = BigInt(2);
    _3n2 = BigInt(3);
    _4n2 = BigInt(4);
    __name(_normFnElement, "_normFnElement");
    __name(weierstrassN, "weierstrassN");
    __name(pprefix, "pprefix");
    __name(getWLengths, "getWLengths");
    __name(ecdh, "ecdh");
    __name(ecdsa, "ecdsa");
    __name(_weierstrass_legacy_opts_to_new, "_weierstrass_legacy_opts_to_new");
    __name(_ecdsa_legacy_opts_to_new, "_ecdsa_legacy_opts_to_new");
    __name(_ecdsa_new_output_to_legacy, "_ecdsa_new_output_to_legacy");
    __name(weierstrass, "weierstrass");
  }
});

// node_modules/@noble/curves/esm/_shortw_utils.js
function createCurve(curveDef, defHash) {
  const create = /* @__PURE__ */ __name((hash) => weierstrass({ ...curveDef, hash }), "create");
  return { ...create(defHash), create };
}
var init_shortw_utils = __esm({
  "node_modules/@noble/curves/esm/_shortw_utils.js"() {
    init_weierstrass();
    __name(createCurve, "createCurve");
  }
});

// node_modules/@noble/curves/esm/secp256k1.js
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n4, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n4, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var secp256k1_CURVE, secp256k1_ENDO, _2n4, Fpk1, secp256k1;
var init_secp256k1 = __esm({
  "node_modules/@noble/curves/esm/secp256k1.js"() {
    init_sha2();
    init_shortw_utils();
    init_modular();
    secp256k1_CURVE = {
      p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
      n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
      h: BigInt(1),
      a: BigInt(0),
      b: BigInt(7),
      Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
      Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
    };
    secp256k1_ENDO = {
      beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
      basises: [
        [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
        [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
      ]
    };
    _2n4 = /* @__PURE__ */ BigInt(2);
    __name(sqrtMod, "sqrtMod");
    Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
    secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);
  }
});

// src/ecdsa.js
var ecdsa_exports = {};
__export(ecdsa_exports, {
  recoverAddress: () => recoverAddress
});
function recoverAddress(message, signature) {
  try {
    const sig = String(signature).replace(/^0x/, "");
    if (!/^[0-9a-fA-F]{130}$/.test(sig)) return null;
    let v = parseInt(sig.slice(128, 130), 16);
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) return null;
    const s = secp256k1.Signature.fromCompact(sig.slice(0, 128)).addRecoveryBit(v);
    if (s.hasHighS()) return null;
    const pub = s.recoverPublicKey(hashPersonalMessage(message)).toRawBytes(false);
    return "0x" + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
  } catch (e) {
    return null;
  }
}
var init_ecdsa = __esm({
  "src/ecdsa.js"() {
    init_secp256k1();
    init_sha3();
    init_utils();
    init_crypto2();
    __name(recoverAddress, "recoverAddress");
  }
});

// src/index.js
var import_engine = __toESM(require_engine(), 1);

// src/config.js
var import_collection = __toESM(require_collection(), 1);
var CHAIN_ID = 4663;
var NFT_CONTRACT = "0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc";
var TIERS = ["Common", "Rare", "Epic", "Legendary", "Special"];
var TIER_FR = { Common: "Commun", Rare: "Rare", Epic: "\xC9pique", Legendary: "L\xE9gendaire", Special: "Sp\xE9cial" };
var TIER_FROM_RARITY = { "Commun": "Common", "Rare": "Rare", "\xC9pique": "Epic", "L\xE9gendaire": "Legendary" };
var REWARD_RULES = [
  { id: "points-3000", tier: "Common", label: "Atteindre 3 000 points class\xE9s", stat: "points", value: 3e3 },
  { id: "streak-10", tier: "Rare", label: "10 victoires class\xE9es d\u2019affil\xE9e", stat: "best_streak", value: 10 },
  { id: "wins-150", tier: "Epic", label: "150 victoires class\xE9es", stat: "wins", value: 150 },
  { id: "legend-40", tier: "Legendary", label: "40 victoires contre des adversaires L\xE9gendaires", stat: "legend_wins", value: 40 }
];
function rewardStock(env) {
  const stock = { Common: [], Rare: [], Epic: [], Legendary: [], Special: [] };
  for (const c of import_collection.default) {
    const t = TIER_FROM_RARITY[c.rarity];
    if (t) stock[t].push(Number(c.id));
  }
  stock.Special = stock.Legendary.slice();
  if (env && env.REWARD_STOCK) {
    try {
      const o = JSON.parse(env.REWARD_STOCK);
      for (const t of TIERS) if (Array.isArray(o[t])) stock[t] = o[t].map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 100);
    } catch (e) {
    }
  }
  return stock;
}
__name(rewardStock, "rewardStock");

// src/fight-window.js
var PRODUCTION_MIN_MS = 15e4;
function fightWindow(env, now2, headerMin) {
  const harness = !!(env && env.HARNESS_FAST_FIGHT === "1");
  let min = PRODUCTION_MIN_MS;
  if (harness) {
    const configured = Number(env.FIGHT_MIN_MS ?? 0);
    min = Number.isFinite(configured) && configured >= 0 ? configured : 0;
    if (headerMin != null && headerMin !== "") {
      const n = Number(headerMin);
      if (Number.isFinite(n) && n >= 0 && n <= PRODUCTION_MIN_MS) min = n;
    }
  }
  const startedAt = now2;
  return { minDurationMs: min, startedAt, readyAt: startedAt + min };
}
__name(fightWindow, "fightWindow");
function clockNow(env, header) {
  if (env && env.HARNESS_FAST_FIGHT === "1" && header != null && header !== "") {
    const n = Number(header);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return Date.now();
}
__name(clockNow, "clockNow");

// src/shop.js
var SHOP = {
  version: 4,
  payments: "off",
  provider: "crypto-prepared",
  testOnly: false,
  treasury: "0xCABB7fe1C84AaC98E8905aB0809129e4f5031635",
  chainId: 4663,
  products: [
    { id: "character-pack-basic", category: "characters", name: "Character Pack Basic", priceEth: "0.0005", purchasable: false },
    { id: "character-pack-plus", category: "characters", name: "Character Pack Plus", priceEth: "0.001", purchasable: false },
    { id: "character-pack-elite", category: "characters", name: "Character Pack Elite", priceEth: "0.002", purchasable: false },
    { id: "skin-neon-basic", category: "skins", name: "Skin Neon Basic", priceEth: "0.0003", purchasable: false },
    { id: "skin-neon-plus", category: "skins", name: "Skin Neon Plus", priceEth: "0.0006", purchasable: false },
    { id: "skin-neon-elite", category: "skins", name: "Skin Neon Elite", priceEth: "0.001", purchasable: false },
    { id: "gems-100", category: "gems", name: "100 gems", quantity: 100, priceEth: "0.0002", purchasable: false, testOnly: true },
    { id: "gems-500", category: "gems", name: "500 gems", quantity: 500, priceEth: "0.0007", purchasable: false },
    { id: "gems-1200", category: "gems", name: "1 200 gems", quantity: 1200, priceEth: "0.0015", purchasable: false },
    { id: "gems-3000", category: "gems", name: "3 000 gems", quantity: 3e3, priceEth: "0.003", purchasable: false },
    { id: "nft-common", category: "nfts", name: "NFT Common", rarity: "Common", priceEth: "0.0005", purchasable: false },
    { id: "nft-uncommon", category: "nfts", name: "NFT Uncommon", rarity: "Uncommon", priceEth: "0.0008", purchasable: false },
    { id: "nft-rare", category: "nfts", name: "NFT Rare", rarity: "Rare", priceEth: "0.0015", purchasable: false },
    { id: "nft-epic", category: "nfts", name: "NFT Epic", rarity: "Epic", priceEth: "0.0025", purchasable: false },
    { id: "nft-legendary", category: "nfts", name: "NFT Legendary", rarity: "Legendary", priceEth: "0.004", purchasable: false },
    { id: "nft-special-edition", category: "nfts", name: "NFT Special Edition", rarity: "Special Edition", priceEth: "0.006", purchasable: false },
    { id: "personal-import", category: "premium", name: "Import d\u2019un personnage personnel", priceEur: 4.99, priceEth: null, purchasable: false }
  ]
};
function productById(id) {
  return SHOP.products.find((p) => p.id === id) || null;
}
__name(productById, "productById");

// src/live.js
var CHALLENGE_ATTEMPTS = 3;
function nowOf(req, env) {
  return clockNow(env, req.headers.get("x-nb-test-now"));
}
__name(nowOf, "nowOf");
function parseState(row) {
  return JSON.parse(row.state);
}
__name(parseState, "parseState");
function createLiveApi(d) {
  const { E: E2, HttpError: HttpError2, CHAR_BY_ID: CHAR_BY_ID2, COLLECTION: COLLECTION2, randomHex: randomHex2, rand32: rand322, randomChar: randomChar2, fightLock: fightLock2, loadChars: loadChars2, lvOf: lvOf2, recordMatches: recordMatches2, commitProgress: commitProgress2, settleProgress: settleProgress2, getPlayer: getPlayer2, publicProfile: publicProfile2, rateLimit: rateLimit2, dayStart: dayStart2 } = d;
  async function bodyOf(req) {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > 8192) throw new HttpError2(413, "Requ\xEAte trop grande");
    const t = await req.text();
    if (!t) return {};
    try {
      return JSON.parse(t);
    } catch (e) {
      throw new HttpError2(400, "JSON invalide");
    }
  }
  __name(bodyOf, "bodyOf");
  function rejectImport(id) {
    const s = String(id || "");
    if (s.startsWith("c-") || s === "apercu") throw new HttpError2(400, "Image ajout\xE9e refus\xE9e en class\xE9 : la raret\xE9 et les stats choisies ne sont pas v\xE9rifi\xE9es et ne comptent pas.");
  }
  __name(rejectImport, "rejectImport");
  async function activeRow(env, address) {
    return env.DB.prepare("SELECT * FROM live_battles WHERE active_key = ?1").bind(address).first();
  }
  __name(activeRow, "activeRow");
  async function saveActive(env, id, address, state, prevSeq) {
    const u = await env.DB.prepare("UPDATE live_battles SET state = ?1, updated_at = ?2 WHERE id = ?3 AND active_key = ?4 AND status = 'active' AND CAST(json_extract(state, '$.seq') AS INTEGER) = ?5").bind(JSON.stringify(state), Date.now(), id, address, prevSeq).run();
    return !!(u.meta && u.meta.changes);
  }
  __name(saveActive, "saveActive");
  async function consumeChallenge(env, address, difficulty) {
    await env.DB.prepare("INSERT OR IGNORE INTO challenge_runs (address, run_id, difficulty, attempts_used, eliminated, started_at) VALUES (?1, ?2, ?3, 0, 0, ?4)").bind(address, randomHex2(8), difficulty, Date.now()).run();
    await env.DB.prepare("UPDATE challenge_runs SET attempts_used = attempts_used + 1, eliminated = CASE WHEN attempts_used + 1 >= ?2 THEN 1 ELSE 0 END WHERE address = ?1").bind(address, CHALLENGE_ATTEMPTS).run();
  }
  __name(consumeChallenge, "consumeChallenge");
  async function settle(env, ctx, sess, row, state) {
    if (state.status === "active") return null;
    if (row.summary) return JSON.parse(row.summary);
    const claim2 = await env.DB.prepare("UPDATE live_battles SET status = 'finishing', active_key = NULL, updated_at = ?1 WHERE id = ?2 AND status = 'active'").bind(Date.now(), row.id).run();
    if (!claim2.meta || !claim2.meta.changes) {
      const again = await env.DB.prepare("SELECT summary FROM live_battles WHERE id = ?1").bind(row.id).first();
      if (again && again.summary) return JSON.parse(again.summary);
      throw new HttpError2(409, "Combat d\xE9j\xE0 en cours de cl\xF4ture.");
    }
    let payload;
    if (state.forfeit || state.playerActions < 1) {
      const p = await getPlayer2(env, sess.address);
      payload = { forfeit: true, seed: state.seed, mode: state.mode, difficulty: state.difficulty, result: E2.manualResult(state), summary: { points: 0, playerWon: false }, profile: publicProfile2(p, env), newRewards: [] };
    } else {
      const result = E2.manualResult(state);
      const diff = state.difficulty ? E2.DIFFICULTIES[state.difficulty] : null;
      const ids = [state.A.id];
      if (state.mode === "duel") ids.push(state.B.id);
      const [p, missionRow, knownChars, bossUsed] = await Promise.all([
        getPlayer2(env, sess.address),
        env.DB.prepare("SELECT state FROM missions WHERE address = ?1 AND day = ?2").bind(sess.address, E2.dayKey()).first(),
        loadChars2(env, sess.address, ids),
        state.mode === "boss" ? env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart2(Date.now())).first() : Promise.resolve(null)
      ]);
      const opts = { mode: state.mode, mult: diff ? diff.points : 1, knownChars, missionRow, defer: true };
      if (state.mode === "boss") opts.points = E2.bossPoints(result);
      const book = await recordMatches2(env, ctx, sess.address, p, [{ result, seed: state.seed, persistOpp: state.mode === "duel" }], opts);
      const slim = Object.assign({}, result, { events: [] });
      book.matches[0].result = slim;
      const extras = [];
      let challengeAt = -1;
      if (state.mode === "solo" && !state.pvpFallback) {
        extras.push(env.DB.prepare("INSERT OR IGNORE INTO challenge_runs (address, run_id, difficulty, attempts_used, eliminated, started_at) VALUES (?1, ?2, ?3, 0, 0, ?4)").bind(sess.address, randomHex2(8), state.difficulty, Date.now()));
        challengeAt = extras.length;
        extras.push(env.DB.prepare("UPDATE challenge_runs SET attempts_used = attempts_used + 1, eliminated = CASE WHEN attempts_used + 1 >= ?2 THEN 1 ELSE 0 END WHERE address = ?1 RETURNING attempts_used, eliminated").bind(sess.address, CHALLENGE_ATTEMPTS));
      }
      const committed = await commitProgress2(env, [book], extras);
      const runRow = challengeAt >= 0 ? committed.results[committed.extraStart + challengeAt].results[0] : null;
      const out = await settleProgress2(env, ctx, book, committed.player);
      payload = Object.assign({
        forfeit: false,
        seed: state.seed,
        result: slim,
        mode: state.mode,
        difficulty: state.difficulty,
        attemptsLeft: state.mode === "boss" ? Math.max(0, 3 - (bossUsed && bossUsed.n || 0) - 1) : null,
        attemptsUsed: runRow ? runRow.attempts_used : null,
        attemptsMax: state.mode === "solo" && !state.pvpFallback ? CHALLENGE_ATTEMPTS : null,
        eliminated: runRow ? !!runRow.eliminated : false
      }, out);
      await env.DB.prepare(`UPDATE live_battles SET status = 'finished', summary = ?1, state = '{"s":1}', updated_at = ?2 WHERE id = ?3`).bind(JSON.stringify(payload), Date.now(), row.id).run();
    }
    if (state.forfeit || state.playerActions < 1) {
      await env.DB.prepare("UPDATE live_battles SET status = 'forfeit', summary = ?1, state = ?2, updated_at = ?3 WHERE id = ?4").bind(JSON.stringify(payload), '{"s":1}', Date.now(), row.id).run();
    }
    return payload;
  }
  __name(settle, "settle");
  async function startBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    rejectImport(b.fighterId);
    rejectImport(b.opponentId);
    const now2 = nowOf(req, env);
    const existing = await activeRow(env, sess.address);
    if (existing) throw new HttpError2(409, "Un combat manuel est d\xE9j\xE0 en cours.");
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    const mode = path === "/api/boss" || b.mode === "boss" ? "boss" : b.mode === "solo" ? "solo" : "duel";
    if (mode === "pvp" || b.mode === "tournoi") throw new HttpError2(409, "Ce mode interactif n\u2019est pas encore disponible.");
    const a = CHAR_BY_ID2.get(String(b.fighterId || ""));
    if (!a) throw new HttpError2(400, "Combattant inconnu (combats class\xE9s : uniquement les 100 Neon Buddies).");
    const diff = mode === "solo" ? E2.DIFFICULTIES[b.difficulty || "normal"] : null;
    if (mode === "solo" && !diff) throw new HttpError2(400, "Difficult\xE9 inconnue");
    if (mode === "solo" && !b.pvpFallback) {
      const run = await env.DB.prepare("SELECT * FROM challenge_runs WHERE address = ?1").bind(sess.address).first();
      if (run && (run.eliminated || run.attempts_used >= CHALLENGE_ATTEMPTS)) throw new HttpError2(429, "S\xE9rie de d\xE9fi termin\xE9e (3/3). Lance une nouvelle s\xE9rie pour rejouer. L\u2019historique est conserv\xE9.");
      if (run && run.difficulty !== diff.id) throw new HttpError2(409, "Difficult\xE9 verrouill\xE9e pour cette s\xE9rie : " + run.difficulty + ".");
    }
    if (mode === "boss") {
      const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart2(Date.now())).first();
      if (used.n >= E2.BOSS_ATTEMPTS_PER_DAY) throw new HttpError2(429, "Tentatives contre le boss \xE9puis\xE9es pour aujourd\u2019hui (" + E2.BOSS_ATTEMPTS_PER_DAY + "/" + E2.BOSS_ATTEMPTS_PER_DAY + ").");
    }
    let opp, boss = null, levelB, scale;
    if (mode === "boss") {
      boss = E2.dailyBoss(E2.dayKey());
      opp = E2.bossCharacter(boss, COLLECTION2);
      levelB = E2.bossLevel(1);
    } else if (mode === "duel") {
      if (b.opponentId == null || b.opponentId === "") throw new HttpError2(400, "Adversaire inconnu");
      opp = CHAR_BY_ID2.get(String(b.opponentId));
      if (!opp) throw new HttpError2(400, "Adversaire inconnu");
      if (opp.id === a.id) throw new HttpError2(400, "Choisis deux personnages diff\xE9rents.");
    } else {
      opp = randomChar2([a.id]);
    }
    await fightLock2(env, ctx, sess.address);
    if (b.pvpFallback) await env.DB.prepare("DELETE FROM pvp_queue WHERE address = ?1 AND match_id IS NULL").bind(sess.address).run();
    const chars = await loadChars2(env, sess.address, [a.id, opp.id]);
    const lvA = lvOf2(chars, a.id);
    levelB = mode === "boss" ? E2.bossLevel(lvA) : diff ? E2.botLevel(diff.id, lvA) : lvOf2(chars, opp.id);
    scale = diff ? diff.scale : 1;
    const win = fightWindow(env, now2, req.headers.get("x-nb-test-min"));
    const seed = rand322();
    const state = E2.createManualBattle(a, lvA, opp, levelB, seed, {
      now: win.startedAt,
      minMs: win.minDurationMs,
      maxMs: win.minDurationMs + 6e4,
      mode,
      difficulty: diff ? diff.id : null,
      scaleB: scale,
      boss,
      pvpFallback: !!b.pvpFallback
    });
    state.pvpFallback = !!b.pvpFallback;
    const id = randomHex2(12);
    try {
      await env.DB.prepare("INSERT INTO live_battles (id, address, active_key, status, state, summary, updated_at) VALUES (?1, ?2, ?3, 'active', ?4, NULL, ?5)").bind(id, sess.address, sess.address, JSON.stringify(state), Date.now()).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e && e.message || e))) throw new HttpError2(409, "Un combat manuel est d\xE9j\xE0 en cours.");
      throw e;
    }
    return { id, seed, resumed: false, mode, difficulty: state.difficulty, battle: E2.manualView(state, now2), fighterLevel: lvA };
  }
  __name(startBattle, "startBattle");
  function viewFromSettled(summary, now2) {
    const r = summary && summary.result || {};
    const A = r.fighters && r.fighters.A || {};
    const B = r.fighters && r.fighters.B || {};
    return {
      status: summary && summary.forfeit ? "forfeit" : "finished",
      seq: 0,
      mode: summary && summary.mode || null,
      difficulty: summary && summary.difficulty || null,
      startedAt: null,
      readyAt: null,
      deadlineAt: null,
      now: now2,
      minMs: null,
      winner: r.winner || null,
      forfeit: !!(summary && summary.forfeit),
      playerActions: r.playerActions || 0,
      engaged: !(summary && summary.forfeit),
      you: { id: A.id || null, name: A.name || "", hp: A.hp || 0, maxHp: A.maxHp || 0, shield: 0, atkReadyAt: 0, spellReadyAt: 0, spell: null, actions: r.playerActions || 0 },
      foe: { id: B.id || null, name: B.name || "", hp: B.hp || 0, maxHp: B.maxHp || 0, shield: 0, spell: typeof B.spell === "string" ? B.spell : "", boss: false },
      events: []
    };
  }
  __name(viewFromSettled, "viewFromSettled");
  async function loadOwned(env, sess, id) {
    const row = await env.DB.prepare("SELECT * FROM live_battles WHERE id = ?1 AND address = ?2").bind(id, sess.address).first();
    if (!row) throw new HttpError2(404, "Combat introuvable");
    return row;
  }
  __name(loadOwned, "loadOwned");
  async function actBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    await rateLimit2(env, "act:" + sess.address, 2e3, 60);
    const row = await loadOwned(env, sess, String(b.id || ""));
    if (row.summary) {
      const settled2 = JSON.parse(row.summary);
      return { battle: viewFromSettled(settled2, nowOf(req, env)), settled: settled2 };
    }
    if (row.status !== "active") throw new HttpError2(409, "Ce combat est d\xE9j\xE0 termin\xE9.");
    const now2 = nowOf(req, env);
    const seq = Number(b.seq);
    let state = parseState(row);
    if (Number.isFinite(seq) && seq <= state.seq) return { battle: E2.manualView(state, now2), settled: null };
    const acted = E2.manualAct(state, b.action, now2, Number.isFinite(seq) ? seq : state.seq + 1);
    if (!acted.ok && acted.reason === "cooldown") {
      await saveActive(env, row.id, sess.address, acted.state, state.seq);
      throw new HttpError2(409, "Temps de recharge pas encore \xE9coul\xE9.");
    }
    if (!acted.ok && acted.reason === "seq") return { battle: E2.manualView(state, now2), settled: null };
    if (!acted.ok) throw new HttpError2(400, "Action refus\xE9e.");
    state = acted.state;
    if (state.status === "active") {
      const saved = await saveActive(env, row.id, sess.address, state, parseState(row).seq);
      if (!saved) {
        const again = await loadOwned(env, sess, row.id);
        if (again.summary) {
          const settled2 = JSON.parse(again.summary);
          return { battle: viewFromSettled(settled2, now2), settled: settled2 };
        }
        return { battle: E2.manualView(parseState(again), now2), settled: null };
      }
    }
    row.state = JSON.stringify(state);
    const settled = await settle(env, ctx, sess, row, state);
    return { battle: E2.manualView(state, now2), settled };
  }
  __name(actBattle, "actBattle");
  async function finishBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    const row = await loadOwned(env, sess, String(b.id || ""));
    if (row.summary) return JSON.parse(row.summary);
    const now2 = nowOf(req, env);
    let state = parseState(row);
    const fin = E2.manualFinish(state, now2);
    state = fin.state;
    if (!fin.ok && fin.reason === "early") throw new HttpError2(425, "Le combat dure au minimum 2 min 30. Les points ne sont pas encore attribu\xE9s.");
    if (!fin.ok && fin.reason === "continue") {
      await saveActive(env, row.id, sess.address, state, parseState(row).seq);
      throw new HttpError2(425, "Le combat continue : un des deux tient encore.");
    }
    const settled = await settle(env, ctx, sess, row, state);
    if (!settled) throw new HttpError2(425, "Le combat continue.");
    return settled;
  }
  __name(finishBattle, "finishBattle");
  async function getBattle(req, env, ctx, sess) {
    const now2 = nowOf(req, env);
    const id = new URL(req.url).searchParams.get("id");
    const row = id ? await loadOwned(env, sess, id) : await activeRow(env, sess.address);
    if (!row) return { battle: null };
    if (row.summary) {
      const settled = JSON.parse(row.summary);
      return { id: row.id, battle: viewFromSettled(settled, now2), settled };
    }
    const prev = parseState(row);
    const ticked = E2.manualTick(prev, now2);
    let state = ticked;
    if (ticked.status !== "active") {
      row.state = JSON.stringify(ticked);
      const settled = await settle(env, ctx, sess, row, ticked);
      return { id: row.id, battle: E2.manualView(ticked, now2), settled };
    }
    const fin = now2 >= prev.deadlineAt ? E2.manualFinish(ticked, now2) : null;
    if (fin && fin.ok) {
      row.state = JSON.stringify(fin.state);
      const settled = await settle(env, ctx, sess, row, fin.state);
      return { id: row.id, battle: E2.manualView(fin.state, now2), settled };
    }
    if (fin) state = fin.state;
    await saveActive(env, row.id, sess.address, state, prev.seq);
    return { id: row.id, battle: E2.manualView(state, now2), settled: null };
  }
  __name(getBattle, "getBattle");
  function stableThree(anchor) {
    const ids = COLLECTION2.map((c) => c.id);
    const h = E2.hash(String(anchor || "starter"));
    const out = [];
    if (anchor && CHAR_BY_ID2.has(anchor)) out.push(anchor);
    let i = 0;
    while (out.length < 3 && i < 500) {
      const id = ids[(h + i * 17) % ids.length];
      if (!out.includes(id)) out.push(id);
      i++;
    }
    return out;
  }
  __name(stableThree, "stableThree");
  async function starter(env, sess) {
    let row = await env.DB.prepare("SELECT * FROM starter_offers WHERE address = ?1").bind(sess.address).first();
    if (!row) {
      const p = await env.DB.prepare("SELECT battles, last_fighter FROM players WHERE address = ?1").bind(sess.address).first();
      let offer, chosen = null;
      if (p && p.battles > 0 && CHAR_BY_ID2.has(p.last_fighter)) {
        chosen = p.last_fighter;
        offer = stableThree(chosen);
      } else offer = stableThree(COLLECTION2[rand322() % COLLECTION2.length].id).slice(0, 3);
      if (new Set(offer).size < 3) offer = stableThree(COLLECTION2[0].id);
      await env.DB.prepare("INSERT INTO starter_offers (address, offer, chosen, created_at) VALUES (?1, ?2, ?3, ?4)").bind(sess.address, JSON.stringify(offer), chosen, Date.now()).run();
      row = await env.DB.prepare("SELECT * FROM starter_offers WHERE address = ?1").bind(sess.address).first();
    }
    return { offer: JSON.parse(row.offer), chosen: row.chosen, note: "Choix en jeu, pas un NFT offert ni transf\xE9r\xE9. Les 100 restent dans la galerie." };
  }
  __name(starter, "starter");
  async function chooseStarter(req, env, sess) {
    const b = await bodyOf(req);
    const row = await env.DB.prepare("SELECT * FROM starter_offers WHERE address = ?1").bind(sess.address).first();
    if (!row) throw new HttpError2(409, "Aucune offre de d\xE9part.");
    const offer = JSON.parse(row.offer);
    const id = String(b.id || "");
    if (!offer.includes(id)) throw new HttpError2(400, "Ce personnage ne fait pas partie de l\u2019offre.");
    if (row.chosen && row.chosen !== id) throw new HttpError2(409, "Le choix de d\xE9part est d\xE9j\xE0 enregistr\xE9.");
    if (!row.chosen) await env.DB.prepare("UPDATE starter_offers SET chosen = ?1 WHERE address = ?2 AND chosen IS NULL").bind(id, sess.address).run();
    return { offer, chosen: id, note: "Choix en jeu, pas un NFT offert ni transf\xE9r\xE9. Les 100 restent dans la galerie." };
  }
  __name(chooseStarter, "chooseStarter");
  async function challenge(env, sess) {
    const run = await env.DB.prepare("SELECT * FROM challenge_runs WHERE address = ?1").bind(sess.address).first();
    if (!run) return { attemptsUsed: 0, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: false, difficulty: null, runId: null };
    return { attemptsUsed: run.attempts_used, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: !!run.eliminated, difficulty: run.difficulty, runId: run.run_id };
  }
  __name(challenge, "challenge");
  async function newRun(req, env, sess) {
    const b = await bodyOf(req);
    const run = await env.DB.prepare("SELECT * FROM challenge_runs WHERE address = ?1").bind(sess.address).first();
    if (!run || !run.eliminated) throw new HttpError2(409, "Une nouvelle s\xE9rie n\u2019est possible qu\u2019apr\xE8s l\u2019\xE9limination.");
    const open = await activeRow(env, sess.address);
    if (open) throw new HttpError2(409, "Un combat manuel est d\xE9j\xE0 en cours.");
    const diff = E2.DIFFICULTIES[b.difficulty] ? b.difficulty : run.difficulty;
    const me = await env.DB.prepare("SELECT points, battles FROM players WHERE address = ?1").bind(sess.address).first();
    await env.DB.prepare("UPDATE challenge_runs SET run_id = ?1, difficulty = ?2, attempts_used = 0, eliminated = 0, started_at = ?3 WHERE address = ?4").bind(randomHex2(8), diff, Date.now(), sess.address).run();
    return { attemptsUsed: 0, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: false, difficulty: diff, points: me ? me.points : 0, battles: me ? me.battles : 0 };
  }
  __name(newRun, "newRun");
  function shop() {
    return SHOP;
  }
  __name(shop, "shop");
  function importProduct() {
    return productById("personal-import");
  }
  __name(importProduct, "importProduct");
  return { startBattle, actBattle, finishBattle, getBattle, starter, chooseStarter, challenge, newRun, shop, importProduct };
}
__name(createLiveApi, "createLiveApi");

// src/index.js
init_crypto2();

// src/platform.js
var AVATARS = /* @__PURE__ */ new Set(["neon-default", "neon-cyan", "neon-magenta", "neon-gold", "neon-violet"]);
var DAY_REWARDS = [
  { type: "gems", id: "gems", qty: 50, label: "50 gems" },
  { type: "xp", id: "xp", qty: 250, label: "250 XP" },
  { type: "material", id: "evolution-core", qty: 3, label: "3 noyaux d\u2019\xE9volution" },
  { type: "gems", id: "gems", qty: 100, label: "100 gems" },
  { type: "skin", id: "skin-neon-pulse", qty: 1, label: "Skin Neon Pulse" },
  { type: "character", id: "0021", qty: 1, label: "Neon Buddy #0021" },
  { type: "skin", id: "skin-prismatic-crown", qty: 1, label: "Skin exclusif Prismatic Crown" }
];
var PASS_XP_PER_LEVEL = 1e3;
var PASS_LEVELS = 30;
var DAILY_MISSIONS = [
  { id: "daily-win", label: "Gagner 3 combats", target: 3, reward: { type: "gems", id: "gems", qty: 25 } },
  { id: "daily-fight", label: "Disputer 5 combats", target: 5, reward: { type: "xp", id: "xp", qty: 150 } },
  { id: "daily-variety", label: "Utiliser 2 personnages diff\xE9rents", target: 2, reward: { type: "material", id: "evolution-core", qty: 2 } }
];
var WEEKLY_MISSIONS = [
  { id: "weekly-win", label: "Gagner 15 combats", target: 15, reward: { type: "gems", id: "gems", qty: 150 } },
  { id: "weekly-boss", label: "Vaincre 3 boss", target: 3, reward: { type: "material", id: "evolution-core", qty: 10 } },
  { id: "weekly-characters", label: "Utiliser 5 personnages diff\xE9rents", target: 5, reward: { type: "skin", id: "skin-weekly-champion", qty: 1 } }
];
var TEST_PRODUCTS = /* @__PURE__ */ new Map([
  ["gems-100", { type: "gems", id: "gems", qty: 100, label: "100 gems de test" }],
  ["evolution-pack", { type: "material", id: "evolution-core", qty: 10, label: "Pack \xE9volution de test" }],
  ["skin-neon-pulse", { type: "skin", id: "skin-neon-pulse", qty: 1, label: "Skin Neon Pulse de test" }],
  ["battle-pass-30", { type: "battle-pass", id: "season-current", qty: 1, label: "Battle Pass de test" }]
]);
function now() {
  return Date.now();
}
__name(now, "now");
function dayKey(ts = now()) {
  return new Date(ts).toISOString().slice(0, 10);
}
__name(dayKey, "dayKey");
function weekKey(ts = now()) {
  const d = new Date(ts);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}
__name(weekKey, "weekKey");
function seasonKey(ts = now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
__name(seasonKey, "seasonKey");
function seasonEnds(ts = now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
__name(seasonEnds, "seasonEnds");
function dailyIndex(day) {
  return (Math.floor(Date.parse(day) / 864e5) % 7 + 7) % 7 + 1;
}
__name(dailyIndex, "dailyIndex");
function cleanText(v, max) {
  return String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
}
__name(cleanText, "cleanText");
async function ensureEconomy(env, address) {
  const row = await env.DB.prepare("SELECT * FROM player_economy WHERE address = ?1").bind(address).first();
  if (row) return row;
  const t = now();
  await env.DB.prepare("INSERT OR IGNORE INTO player_economy (address, updated_at) VALUES (?1, ?2)").bind(address, t).run();
  return await env.DB.prepare("SELECT * FROM player_economy WHERE address = ?1").bind(address).first();
}
__name(ensureEconomy, "ensureEconomy");
async function grantItem(env, address, reward, source) {
  const t = now();
  if (reward.type === "gems") {
    await ensureEconomy(env, address);
    await env.DB.prepare("UPDATE player_economy SET gems = gems + ?1, updated_at = ?2 WHERE address = ?3").bind(reward.qty, t, address).run();
  } else if (reward.type === "material") {
    await ensureEconomy(env, address);
    await env.DB.prepare("UPDATE player_economy SET materials = materials + ?1, updated_at = ?2 WHERE address = ?3").bind(reward.qty, t, address).run();
  }
  await env.DB.prepare(`INSERT INTO inventory (address,item_type,item_id,quantity,source,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)
    ON CONFLICT(address,item_type,item_id) DO UPDATE SET quantity=quantity+excluded.quantity, updated_at=excluded.updated_at`).bind(address, reward.type, reward.id, reward.qty, source, t).run();
}
__name(grantItem, "grantItem");
async function claimDaily(env, address) {
  const day = dayKey(), idx = dailyIndex(day), reward = DAY_REWARDS[idx - 1], t = now();
  const exists = await env.DB.prepare("SELECT * FROM daily_reward_claims WHERE address = ?1 AND day = ?2").bind(address, day).first();
  if (exists) return { claimed: false, duplicate: true, day, dayIndex: idx, reward: JSON.parse(exists.reward_json) };
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO daily_reward_claims (address,day,day_index,reward_json,claimed_at) VALUES (?1,?2,?3,?4,?5)").bind(address, day, idx, JSON.stringify(reward), t).run();
  if (!ins.meta.changes) return { claimed: false, duplicate: true, day, dayIndex: idx, reward };
  await grantItem(env, address, reward, `daily:${day}`);
  return { claimed: true, duplicate: false, day, dayIndex: idx, reward };
}
__name(claimDaily, "claimDaily");
function passRewards(track, level) {
  if (level < 1 || level > PASS_LEVELS) return null;
  if (track === "free") return level % 5 === 0 ? { type: "gems", id: "gems", qty: 50, label: "50 gems" } : { type: "material", id: "evolution-core", qty: 2, label: "2 noyaux d\u2019\xE9volution" };
  if (track === "premium") return level % 10 === 0 ? { type: "character", id: String(30 + level).padStart(4, "0"), qty: 1, label: "Personnage Battle Pass" } : { type: "skin", id: `skin-pass-${level}`, qty: 1, label: `Skin Battle Pass #${level}` };
  return null;
}
__name(passRewards, "passRewards");
async function claimPass(env, address, track, level) {
  const season = seasonKey(), p = await env.DB.prepare("SELECT * FROM battle_pass_progress WHERE address = ?1 AND season = ?2").bind(address, season).first();
  if (!p || p.xp < level * PASS_XP_PER_LEVEL - 1) throw new Error("Niveau de Battle Pass non d\xE9bloqu\xE9");
  if (track === "premium" && !p.premium) throw new Error("Pass Premium non activ\xE9");
  const reward = passRewards(track, Number(level));
  if (!reward) throw new Error("R\xE9compense invalide");
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO battle_pass_claims (address,season,track,level,claimed_at) VALUES (?1,?2,?3,?4,?5)").bind(address, season, track, level, now()).run();
  if (!ins.meta.changes) return { claimed: false, duplicate: true, season, track, level, reward };
  await grantItem(env, address, reward, `battle-pass:${season}:${track}:${level}`);
  return { claimed: true, duplicate: false, season, track, level, reward };
}
__name(claimPass, "claimPass");
async function testPurchase(env, address, productId) {
  const reward = TEST_PRODUCTS.get(String(productId));
  if (!reward) throw new Error("Produit de test inconnu");
  const existing = await env.DB.prepare("SELECT id,product_id,status FROM shop_orders WHERE address=?1 AND product_id=?2 AND payment_mode='test'").bind(address, productId).first();
  if (existing) return { order: existing, duplicate: true, payment: "test", charged: "0 ETH" };
  const t = now(), id = `test-order-${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO shop_orders (id,address,product_id,quantity,payment_mode,status,created_at,fulfilled_at) VALUES (?1,?2,?3,1,'test','fulfilled',?4,?4)").bind(id, address, productId, t).run();
  await grantItem(env, address, reward, `shop:test:${id}`);
  return { order: { id, productId, status: "fulfilled" }, duplicate: false, payment: "test", charged: "0 ETH", item: reward };
}
__name(testPurchase, "testPurchase");
async function updateProfile(env, address, body2) {
  const username = cleanText(body2.username, 20).replace(/[^\p{L}\p{N} _.-]/gu, "").trim() || null;
  const avatar = AVATARS.has(body2.avatar) ? body2.avatar : "neon-default";
  const favorite = body2.favoriteChar == null || /^\d{4}$/.test(String(body2.favoriteChar)) ? body2.favoriteChar ? String(body2.favoriteChar) : null : null;
  const privacy = JSON.stringify({ showHistory: body2.showHistory !== false, showFavorite: body2.showFavorite !== false, showWallet: body2.showWallet === true });
  const t = now();
  await env.DB.prepare("INSERT INTO player_profiles (address,username,avatar,favorite_char,privacy_json,updated_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(address) DO UPDATE SET username=excluded.username,avatar=excluded.avatar,favorite_char=excluded.favorite_char,privacy_json=excluded.privacy_json,updated_at=excluded.updated_at").bind(address, username, avatar, favorite, privacy, t).run();
  await env.DB.prepare("UPDATE players SET name=?1 WHERE address=?2").bind(username, address).run();
  return { username, avatar, favoriteChar: favorite, privacy: JSON.parse(privacy) };
}
__name(updateProfile, "updateProfile");
async function evolveCharacter(env, address, charId) {
  if (!/^\d{4}$/.test(String(charId))) throw new Error("Personnage officiel requis");
  const row = await env.DB.prepare("SELECT * FROM character_evolution WHERE address=?1 AND char_id=?2").bind(address, charId).first();
  const stage = row ? Number(row.stage) : 1;
  if (stage >= 3) throw new Error("Stade maximum atteint");
  const next = stage + 1, materialCost = next === 2 ? 5 : 10, gemCost = next === 2 ? 10 : 25;
  const eco = await ensureEconomy(env, address);
  if (eco.materials < materialCost || eco.gems < gemCost) throw new Error(`Ressources insuffisantes : ${materialCost} mat\xE9riaux et ${gemCost} gems requis`);
  const bonuses = next === 2 ? { attack: 5, defense: 5, health: 10 } : { attack: 10, defense: 10, health: 20 };
  const t = now();
  await env.DB.prepare("UPDATE player_economy SET materials=materials-?1,gems=gems-?2,updated_at=?3 WHERE address=?4 AND materials>=?1 AND gems>=?2").bind(materialCost, gemCost, t, address).run();
  await env.DB.prepare("INSERT INTO character_evolution (address,char_id,stage,attack_bonus,defense_bonus,health_bonus,materials_spent,gems_spent,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(address,char_id) DO UPDATE SET stage=excluded.stage,attack_bonus=excluded.attack_bonus,defense_bonus=excluded.defense_bonus,health_bonus=excluded.health_bonus,materials_spent=character_evolution.materials_spent+excluded.materials_spent,gems_spent=character_evolution.gems_spent+excluded.gems_spent,updated_at=excluded.updated_at").bind(address, charId, next, bonuses.attack, bonuses.defense, bonuses.health, materialCost, gemCost, t).run();
  return { charId, stage: next, bonuses, cost: { materials: materialCost, gems: gemCost } };
}
__name(evolveCharacter, "evolveCharacter");
async function registerTournament(env, address, fighterId, type = "daily") {
  if (!/^(daily|weekly)$/.test(type) || !/^\d{4}$/.test(String(fighterId))) throw new Error("Inscription invalide");
  const periodKey = type === "weekly" ? weekKey() : dayKey(), size = type === "weekly" ? 16 : 8, t = now();
  const id = `platform-${type}-${periodKey}`;
  await env.DB.prepare("INSERT OR IGNORE INTO platform_tournaments (id,period_type,period_key,size,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'open',?5,?5)").bind(id, type, periodKey, size, t).run();
  await env.DB.prepare("INSERT OR IGNORE INTO platform_tournament_entries (tournament_id,address,fighter_id,joined_at) VALUES (?1,?2,?3,?4)").bind(id, address, String(fighterId), t).run();
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM platform_tournament_entries WHERE tournament_id=?1").bind(id).first();
  return { id, type, periodKey, size, registered: true, entries: count.n };
}
__name(registerTournament, "registerTournament");
async function recordBattleProgress(env, address, matches, profile, mode) {
  const season = seasonKey(), xp = matches.reduce((sum, m) => sum + (m.result.winner === "A" ? 250 : 100), 0);
  const t = now();
  await env.DB.prepare("INSERT INTO battle_pass_progress (address,season,xp,premium,updated_at) VALUES (?1,?2,?3,0,?4) ON CONFLICT(address,season) DO UPDATE SET xp=xp+excluded.xp,updated_at=excluded.updated_at").bind(address, season, xp, t).run();
  const achievements = [];
  if ((profile.wins || 0) >= 1) achievements.push("first-win");
  if ((profile.wins || 0) >= 10) achievements.push("ten-wins");
  if (mode === "boss" && matches.some((m) => m.result.winner === "A")) achievements.push("boss-hunter");
  for (const id of achievements) await env.DB.prepare("INSERT OR IGNORE INTO achievements (address,achievement_id,unlocked_at) VALUES (?1,?2,?3)").bind(address, id, t).run();
  const week = weekKey(), current = await env.DB.prepare("SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2").bind(address, week).first();
  const state = current ? JSON.parse(current.state_json) : { progress: {}, claimed: {} };
  state.progress["weekly-win"] = Math.min(15, (state.progress["weekly-win"] || 0) + matches.filter((m) => m.result.winner === "A").length);
  state.progress["weekly-boss"] = Math.min(3, (state.progress["weekly-boss"] || 0) + (mode === "boss" && matches.some((m) => m.result.winner === "A") ? 1 : 0));
  await env.DB.prepare("INSERT INTO weekly_missions (address,week,state_json,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(address,week) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at").bind(address, week, JSON.stringify(state), t).run();
  return { season, xp, achievements };
}
__name(recordBattleProgress, "recordBattleProgress");
async function claimMission(env, address, missionId) {
  const mission = WEEKLY_MISSIONS.find((m) => m.id === String(missionId));
  if (!mission) throw new Error("Mission inconnue");
  const week = weekKey(), row = await env.DB.prepare("SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2").bind(address, week).first();
  const state = row ? JSON.parse(row.state_json) : { progress: {}, claimed: {} };
  if ((state.progress[mission.id] || 0) < mission.target) throw new Error("Mission non termin\xE9e");
  if (state.claimed[mission.id]) return { claimed: false, duplicate: true, week, missionId };
  state.claimed[mission.id] = true;
  await env.DB.prepare("UPDATE weekly_missions SET state_json=?1,updated_at=?2 WHERE address=?3 AND week=?4").bind(JSON.stringify(state), now(), address, week).run();
  await grantItem(env, address, mission.reward, `mission:${week}:${mission.id}`);
  return { claimed: true, duplicate: false, week, missionId, reward: mission.reward };
}
__name(claimMission, "claimMission");
async function featureSnapshot(env, address) {
  const day = dayKey(), week = weekKey(), season = seasonKey();
  const [eco, pass, inv, daily, ach, guild, weekly] = await Promise.all([
    ensureEconomy(env, address),
    env.DB.prepare("SELECT * FROM battle_pass_progress WHERE address = ?1 AND season = ?2").bind(address, season).first(),
    env.DB.prepare("SELECT item_type,item_id,quantity,source,updated_at FROM inventory WHERE address = ?1 ORDER BY updated_at DESC").bind(address).all(),
    env.DB.prepare("SELECT day,day_index,reward_json,claimed_at FROM daily_reward_claims WHERE address = ?1 ORDER BY claimed_at DESC LIMIT 14").bind(address).all(),
    env.DB.prepare("SELECT achievement_id,unlocked_at,claimed_at FROM achievements WHERE address = ?1 ORDER BY unlocked_at DESC").bind(address).all(),
    env.DB.prepare("SELECT g.id,g.name,g.slug,g.logo,gm.role FROM guild_members gm JOIN guilds g ON g.id=gm.guild_id WHERE gm.address=?1").bind(address).first(),
    env.DB.prepare("SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2").bind(address, week).first()
  ]);
  const weeklyState = weekly ? JSON.parse(weekly.state_json) : { progress: {}, claimed: {} };
  return { day, dayIndex: dailyIndex(day), dayRewards: DAY_REWARDS, week, dailyMissions: DAILY_MISSIONS, weeklyMissions: WEEKLY_MISSIONS.map((m) => ({ id: m.id, label: m.label, target: m.target, reward: m.reward, progress: weeklyState.progress[m.id] || 0, claimed: !!weeklyState.claimed[m.id] })), season, seasonEnds: seasonEnds(), pass: { levels: PASS_LEVELS, xpPerLevel: PASS_XP_PER_LEVEL, progress: pass || { xp: 0, premium: 0 } }, economy: { gems: eco.gems, materials: eco.materials }, inventory: inv.results, dailyClaims: daily.results.map((r) => ({ day: r.day, dayIndex: r.day_index, reward: JSON.parse(r.reward_json), claimedAt: r.claimed_at })), achievements: ach.results, guild: guild || null };
}
__name(featureSnapshot, "featureSnapshot");
async function createGuild(env, address, body2) {
  const existing = await env.DB.prepare("SELECT guild_id FROM guild_members WHERE address=?1").bind(address).first();
  if (existing) throw new Error("Tu es d\xE9j\xE0 dans une guilde");
  const name = cleanText(body2.name, 32);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  if (name.length < 3 || !slug) throw new Error("Nom de guilde invalide");
  const id = `g-${crypto.randomUUID()}`;
  const t = now();
  await env.DB.prepare("INSERT INTO guilds (id,name,slug,description,logo,leader,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)").bind(id, name, slug, cleanText(body2.description, 240), AVATARS.has(body2.logo) ? body2.logo : "neon-guild-1", address, t).run();
  await env.DB.prepare("INSERT INTO guild_members (guild_id,address,role,joined_at) VALUES (?1,?2,?3,?4)").bind(id, address, "leader", t).run();
  return { id, name, slug };
}
__name(createGuild, "createGuild");
async function inviteGuildMember(env, address, guildId, invitedAddress) {
  const target = String(invitedAddress || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(target)) throw new Error("Adresse de joueur invalide");
  const leader = await env.DB.prepare("SELECT role FROM guild_members WHERE guild_id=?1 AND address=?2 AND role IN ('leader','officer')").bind(guildId, address).first();
  if (!leader) throw new Error("Droit de gestion requis");
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?1").bind(guildId).first();
  if (count.n >= 50) throw new Error("Guilde compl\xE8te");
  await env.DB.prepare("INSERT INTO guild_invites (guild_id,address,invited_by,status,created_at) VALUES (?1,?2,?3,'pending',?4) ON CONFLICT(guild_id,address) DO UPDATE SET status='pending',invited_by=excluded.invited_by,created_at=excluded.created_at").bind(guildId, target, address, now()).run();
  return { guildId, address: target, status: "pending" };
}
__name(inviteGuildMember, "inviteGuildMember");
async function decideGuildInvite(env, address, guildId, decision) {
  const invite = await env.DB.prepare("SELECT * FROM guild_invites WHERE guild_id=?1 AND address=?2 AND status='pending'").bind(guildId, address).first();
  if (!invite) throw new Error("Invitation introuvable ou d\xE9j\xE0 trait\xE9e");
  if (decision !== "accept") {
    await env.DB.prepare("UPDATE guild_invites SET status='declined',decided_at=?1 WHERE guild_id=?2 AND address=?3 AND status='pending'").bind(now(), guildId, address).run();
    return { guildId, status: "declined" };
  }
  const existing = await env.DB.prepare("SELECT guild_id FROM guild_members WHERE address=?1").bind(address).first();
  if (existing) throw new Error("Tu es d\xE9j\xE0 dans une guilde");
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?1").bind(guildId).first();
  if (count.n >= 50) throw new Error("Guilde compl\xE8te");
  await env.DB.prepare("INSERT INTO guild_members (guild_id,address,role,joined_at) VALUES (?1,?2,'member',?3)").bind(guildId, address, now()).run();
  await env.DB.prepare("UPDATE guild_invites SET status='accepted',decided_at=?1 WHERE guild_id=?2 AND address=?3 AND status='pending'").bind(now(), guildId, address).run();
  return { guildId, status: "accepted" };
}
__name(decideGuildInvite, "decideGuildInvite");
async function guildChat(env, address, guildId, body2) {
  const member = await env.DB.prepare("SELECT 1 FROM guild_members WHERE guild_id=?1 AND address=?2").bind(guildId, address).first();
  if (!member) throw new Error("Membre de guilde requis");
  const text = cleanText(body2.body, 300);
  if (text.length < 1) throw new Error("Message vide");
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM guild_messages WHERE guild_id=?1 AND address=?2 AND created_at>?3").bind(guildId, address, now() - 6e4).first();
  if (recent.n >= 10) throw new Error("Limite anti-spam atteinte");
  const r = await env.DB.prepare("INSERT INTO guild_messages (guild_id,address,body,created_at) VALUES (?1,?2,?3,?4) RETURNING id,created_at").bind(guildId, address, text, now()).first();
  return { id: r.id, body: text, createdAt: r.created_at };
}
__name(guildChat, "guildChat");
async function adminDashboard(env) {
  const [players, battles, guilds, guildMembers, tournamentEntries, evolutions, passXp, sales, claims] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM players").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE created_at > ?1").bind(now() - 864e5).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM guilds").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM guild_members").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM platform_tournament_entries WHERE joined_at > ?1").bind(now() - 6048e5).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM character_evolution").first(),
    env.DB.prepare("SELECT COALESCE(SUM(xp),0) AS n FROM battle_pass_progress").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inventory WHERE source LIKE 'shop:%'").first(),
    env.DB.prepare("SELECT status,COUNT(*) AS n FROM rewards GROUP BY status").all()
  ]);
  return { players: players.n, battles24h: battles.n, guilds: guilds.n, guildMembers: guildMembers.n, tournamentEntries7d: tournamentEntries.n, evolvedCharacters: evolutions.n, battlePassXp: passXp.n, storeItemsGranted: sales.n, rewards: Object.fromEntries(claims.results.map((x) => [x.status, x.n])), payments: { enabled: false, configured: false } };
}
__name(adminDashboard, "adminDashboard");

// src/index.js
var NONCE_TTL = 5 * 60 * 1e3;
var SESSION_TTL = 7 * 24 * 3600 * 1e3;
var CHAR_BY_ID = new Map(import_collection.default.map((c) => [c.id, c]));
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
};
function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
__name(num, "num");
function cfg(env) {
  return {
    admin: lower(env.ADMIN_ADDRESS || ""),
    rpc: env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
    chainId: num(env.CHAIN_ID, CHAIN_ID),
    contract: env.NFT_CONTRACT || NFT_CONTRACT,
    origins: String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    fightInterval: num(env.FIGHT_MIN_INTERVAL_MS, 2e3),
    maxFightsDay: num(env.MAX_FIGHTS_PER_DAY, 300),
    dailyCap: num(env.DAILY_POINTS_CAP, 3e3),
    onchain: env.CHECK_ONCHAIN !== "0",
    erc1271: env.ERC1271 !== "0",
    realClaims: String(env.REAL_CLAIMS || "") === "1",
    paymentsEnabled: String(env.PAYMENTS_ENABLED || "0") === "1",
    tgBase: env.TELEGRAM_API_BASE || "https://api.telegram.org"
  };
}
__name(cfg, "cfg");
function realClaimsOn(env) {
  return cfg(env).realClaims;
}
__name(realClaimsOn, "realClaimsOn");
function short(a) {
  return a.slice(0, 6) + "\u2026" + a.slice(-4);
}
__name(short, "short");
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const h = { "Vary": "Origin" };
  if (origin && cfg(env).origins.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
__name(corsHeaders, "corsHeaders");
function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, extra || {})
  });
}
__name(json, "json");
async function body(req) {
  const len = Number(req.headers.get("Content-Length") || 0);
  if (len > 8192) throw new HttpError(413, "Requ\xEAte trop grande");
  try {
    const t = await req.text();
    if (t.length > 8192) throw 0;
    return t ? JSON.parse(t) : {};
  } catch (e) {
    throw new HttpError(400, "JSON invalide");
  }
}
__name(body, "body");
async function rateLimit(env, key, max, windowSec) {
  const win = Math.floor(Date.now() / 1e3 / windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, win, n) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET n = CASE WHEN rate_limits.win = excluded.win THEN rate_limits.n + 1 ELSE 1 END, win = excluded.win
     RETURNING n`
  ).bind(key, win).first();
  if (row.n > max) throw new HttpError(429, "Trop de requ\xEAtes, r\xE9essaie dans un instant.");
}
__name(rateLimit, "rateLimit");
async function rpc(env, method, params) {
  const r = await fetch(cfg(env).rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!r.ok) throw new HttpError(502, "RPC indisponible");
  const j = await r.json();
  if (j.error) throw new HttpError(502, "Erreur RPC : " + (j.error.message || "inconnue"));
  return j.result;
}
__name(rpc, "rpc");
async function ownerOf(env, tokenId) {
  const res = await rpc(env, "eth_call", [{ to: cfg(env).contract, data: encodeOwnerOf(tokenId) }, "latest"]);
  return "0x" + String(res).slice(-40).toLowerCase();
}
__name(ownerOf, "ownerOf");
function tgEnabled(env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID);
}
__name(tgEnabled, "tgEnabled");
async function tg(env, method, payload) {
  const r = await fetch(`${cfg(env).tgBase}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return r.ok ? r.json() : null;
}
__name(tg, "tg");
async function allow(env, key, max, windowSec) {
  try {
    await rateLimit(env, key, max, windowSec);
    return true;
  } catch (e) {
    return false;
  }
}
__name(allow, "allow");
async function notify(env, ctx, kind, text, opts) {
  opts = opts || {};
  if (opts.throttle && !await allow(env, "tg:" + opts.throttle[0], 1, opts.throttle[1])) return;
  if (opts.badge !== false) await env.DB.prepare("INSERT INTO notifications (kind, text, created_at) VALUES (?1, ?2, ?3)").bind(kind, text, Date.now()).run();
  if (tgEnabled(env)) {
    const payload = { chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text: "\u{1F3AE} NEON BUDDIES ARENA\n" + text, disable_web_page_preview: true };
    if (opts.adminLink && env.PUBLIC_SITE_URL) payload.reply_markup = { inline_keyboard: [[{ text: "\u{1F510} Ouvrir l\u2019espace admin", url: env.PUBLIC_SITE_URL.replace(/#.*$/, "") + "#admin" }]] };
    const p = tg(env, "sendMessage", payload).catch(() => null);
    if (ctx && ctx.waitUntil) ctx.waitUntil(p);
    else await p;
  }
}
__name(notify, "notify");
function alertSuspicious(env, ctx, key, text) {
  const p = notify(env, ctx, "alert", "\u26A0\uFE0F " + text, { throttle: ["alert:" + key, 600] }).catch(() => {
  });
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
  return p;
}
__name(alertSuspicious, "alertSuspicious");
function buildMessage(domain, uri, address, nonce, chainId, issued, expires) {
  return `${domain} veut que tu te connectes avec ton compte Ethereum :
${address}

Connexion \xE0 NEON BUDDIES \u2014 NFT BATTLE ARENA. Cette signature ne d\xE9clenche aucune transaction et ne co\xFBte aucun frais.

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issued}
Expiration Time: ${expires}`;
}
__name(buildMessage, "buildMessage");
var recoverAddress2 = null;
async function verifySignature(env, address, message, signature) {
  if (!recoverAddress2) recoverAddress2 = (await Promise.resolve().then(() => (init_ecdsa(), ecdsa_exports))).recoverAddress;
  const rec = recoverAddress2(message, signature);
  if (rec && lower(rec) === lower(address)) return true;
  if (!cfg(env).erc1271) return false;
  const data = encodeIsValidSignature(hashPersonalMessage(message), signature);
  if (!data) return false;
  try {
    const code = String(await rpc(env, "eth_getCode", [address, "latest"]) || "").toLowerCase();
    if (!code || code === "0x" || code === "0x0") return false;
    const res = await rpc(env, "eth_call", [{ to: address, data }, "latest"]);
    return is1271Magic(res);
  } catch (e) {
    return false;
  }
}
__name(verifySignature, "verifySignature");
async function auth(req, env, adminOnly) {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) throw new HttpError(401, "Connexion requise");
  const s = await env.DB.prepare("SELECT address, is_admin, expires_at FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(m[1])).first();
  if (!s || s.expires_at < Date.now()) throw new HttpError(401, "Session expir\xE9e, reconnecte-toi.");
  if (adminOnly && !(s.is_admin && s.address === cfg(env).admin)) throw new HttpError(403, "R\xE9serv\xE9 \xE0 l\u2019administrateur");
  return s;
}
__name(auth, "auth");
async function getPlayer(env, address) {
  let p = await env.DB.prepare("SELECT * FROM players WHERE address = ?1").bind(address).first();
  if (!p) {
    await env.DB.prepare("INSERT OR IGNORE INTO players (address, created_at) VALUES (?1, ?2)").bind(address, Date.now()).run();
    p = await env.DB.prepare("SELECT * FROM players WHERE address = ?1").bind(address).first();
  }
  return p;
}
__name(getPlayer, "getPlayer");
function isFounder(env, address) {
  return lower(address) === cfg(env).admin;
}
__name(isFounder, "isFounder");
function publicProfile(p, env) {
  return {
    founder: isFounder(env, p.address),
    testMode: !!p.test_mode,
    address: p.address,
    name: p.name || null,
    points: p.points,
    wins: p.wins,
    losses: p.losses,
    battles: p.battles,
    streak: p.streak,
    bestStreak: p.best_streak,
    legendWins: p.legend_wins,
    rating: p.rating,
    pvpWins: p.pvp_wins,
    pvpLosses: p.pvp_losses,
    dayPoints: p.day === import_engine.default.dayKey() ? p.day_points : 0
  };
}
__name(publicProfile, "publicProfile");
function rewardView(r) {
  return {
    id: r.id,
    rule: r.rule_id,
    tier: r.tier,
    tierFr: TIER_FR[r.tier],
    label: r.label,
    status: r.status,
    tokenId: r.token_id,
    txHash: r.tx_hash,
    note: r.note,
    test: !!r.is_test,
    earnedAt: r.earned_at,
    claimedAt: r.claimed_at,
    decidedAt: r.decided_at,
    sentAt: r.sent_at,
    address: r.address
  };
}
__name(rewardView, "rewardView");
async function grantEligible(env, ctx, p) {
  const fresh = [];
  const test = p.test_mode ? 1 : 0;
  if (!test && isFounder(env, p.address)) return fresh;
  const pending = [];
  const stmts = [];
  for (const rule of REWARD_RULES) {
    if ((p[rule.stat] || 0) < rule.value) continue;
    const id = (test ? "test:" : "") + rule.id + ":" + p.address;
    pending.push({ id, rule });
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO rewards (id, address, rule_id, tier, label, earned_at, is_test) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(id, p.address, rule.id, rule.tier, rule.label, Date.now(), test));
  }
  if (!stmts.length) return fresh;
  const written = await env.DB.batch(stmts);
  for (let i = 0; i < pending.length; i++) {
    if (!(written[i].meta && written[i].meta.changes)) continue;
    const rule = pending[i].rule;
    fresh.push({ id: pending[i].id, tier: rule.tier, tierFr: TIER_FR[rule.tier], label: rule.label, test: !!test });
    await notify(env, ctx, "earned", `${test ? "[TEST] " : ""}\u{1F3C6} ${short(p.address)} a gagn\xE9 une r\xE9compense NFT ${TIER_FR[rule.tier]} (\xAB ${rule.label} \xBB). Elle pourra \xEAtre r\xE9clam\xE9e puis valid\xE9e dans l\u2019espace admin.`);
  }
  return fresh;
}
__name(grantEligible, "grantEligible");
function rand32() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
__name(rand32, "rand32");
function randomChar(exceptIds) {
  const pool = import_collection.default.filter((x) => !exceptIds.includes(x.id));
  return pool[rand32() % pool.length];
}
__name(randomChar, "randomChar");
function dayStart(now2) {
  return Date.parse(import_engine.default.dayKey(now2) + "T00:00:00Z");
}
__name(dayStart, "dayStart");
async function fightLock(env, ctx, address) {
  const c = cfg(env);
  try {
    await rateLimit(env, "fightmin:" + address, 30, 60);
  } catch (e) {
    await alertSuspicious(env, ctx, "fight:" + address, `Activit\xE9 suspecte : ${short(address)} d\xE9passe la limite de combats par minute.`);
    throw e;
  }
  const now2 = Date.now(), day = import_engine.default.dayKey(now2);
  await env.DB.prepare("INSERT OR IGNORE INTO players (address, created_at) VALUES (?1, ?2)").bind(address, now2).run();
  const p = await env.DB.prepare("UPDATE players SET last_fight_at = ?1 WHERE address = ?2 AND last_fight_at <= ?3 RETURNING *").bind(now2, address, now2 - c.fightInterval).first();
  if (!p) {
    await rateLimit(env, "fastfight:" + address, 1e9, 60).catch(() => {
    });
    const n = await env.DB.prepare("SELECT n FROM rate_limits WHERE key = ?1").bind("fastfight:" + address).first();
    if (n && n.n >= 10) await alertSuspicious(env, ctx, "fast:" + address, `Anti-triche : ${short(address)} envoie des combats trop rapproch\xE9s (${n.n} refus en 1 min).`);
    throw new HttpError(429, "Patiente un instant avant le prochain combat.");
  }
  if ((p.day === day ? p.day_fights : 0) >= c.maxFightsDay) throw new HttpError(429, "Limite quotidienne de combats class\xE9s atteinte.");
  return p;
}
__name(fightLock, "fightLock");
async function loadChars(env, address, ids) {
  const chars = {};
  const uniq = [...new Set(ids)];
  if (!uniq.length) return chars;
  const marks = uniq.map((_, i) => "?" + (i + 2)).join(",");
  const rows = await env.DB.prepare("SELECT char_id, xp, wins, losses FROM char_progress WHERE address = ?1 AND char_id IN (" + marks + ")").bind(address, ...uniq).all();
  for (const r of rows.results) chars[r.char_id] = { xp: r.xp, wins: r.wins, losses: r.losses };
  return chars;
}
__name(loadChars, "loadChars");
var lvOf = /* @__PURE__ */ __name((chars, id) => import_engine.default.levelFromXp((chars[id] || {}).xp || 0).level, "lvOf");
function progressStatements(env, b) {
  return [
    env.DB.prepare(`UPDATE players SET points = points + ?1, wins = wins + ?2, losses = losses + ?3, battles = battles + ?4,
      streak = ?5, best_streak = MAX(best_streak, ?6), legend_wins = legend_wins + ?7, day = ?8,
      day_points = CASE WHEN day = ?8 THEN day_points + ?9 ELSE ?9 END,
      day_fights = CASE WHEN day = ?8 THEN day_fights + ?10 ELSE ?10 END,
      last_fighter = ?11, last_level = ?12
      WHERE address = ?13 AND battles = ?14
      RETURNING *`).bind(b.gained, b.np.wins - (b.p.wins || 0), b.np.losses - (b.p.losses || 0), b.dBattles, b.np.streak, b.np.bestStreak, b.legendWins, b.day, b.gained, b.matches.length, b.last.id, b.last.level, b.address, b.p.battles || 0)
  ];
}
__name(progressStatements, "progressStatements");
function progressGuard(env, checks) {
  const where = checks.map((_, i) => `(address = ?${i * 2 + 1} AND battles != ?${i * 2 + 2})`).join(" OR ");
  return env.DB.prepare(
    `INSERT INTO players (address, created_at) SELECT address, created_at FROM players WHERE ${where}`
  ).bind(...checks.flatMap((c) => [c.address, c.expectedBattles]));
}
__name(progressGuard, "progressGuard");
async function commitProgress(env, books, extra) {
  const stmts = [];
  for (const b of books) stmts.push(...b.stmts);
  stmts.push(progressGuard(env, books.map((b) => ({ address: b.address, expectedBattles: b.expectedBattles }))));
  for (const b of books) {
    stmts.push(env.DB.prepare("INSERT INTO missions (address, day, state) VALUES (?1, ?2, ?3) ON CONFLICT(address, day) DO UPDATE SET state = excluded.state").bind(b.address, b.day, JSON.stringify(b.mState)));
    for (const id of new Set(b.ids || [])) {
      const cp = b.chars && b.chars[id];
      if (!cp) continue;
      stmts.push(env.DB.prepare("INSERT INTO char_progress (address, char_id, xp, wins, losses) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(address, char_id) DO UPDATE SET xp = excluded.xp, wins = excluded.wins, losses = excluded.losses").bind(b.address, id, cp.xp, cp.wins, cp.losses));
    }
    b.matches.forEach((m, i) => stmts.push(env.DB.prepare("INSERT INTO fights (address, a, b, seed, winner, points, created_at, mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(b.address, m.result.fighters.A.id, m.result.fighters.B.id, m.seed >>> 0, m.result.winner, i === b.matches.length - 1 ? b.gained : 0, b.now, b.opts.mode || "duel")));
  }
  const extraStart = stmts.length;
  if (extra) stmts.push(...extra);
  try {
    const results = await env.DB.batch(stmts);
    return { results, extraStart, player: results[0] && results[0].results ? results[0].results[0] : null };
  } catch (e) {
    if (/UNIQUE constraint failed: players\.address/i.test(String(e && (e.message || e.cause && e.cause.message) || e))) {
      throw new HttpError(409, "Conflit de progression, r\xE9essaie.");
    }
    throw e;
  }
}
__name(commitProgress, "commitProgress");
async function recordMatches(env, ctx, address, p, matches, opts) {
  const c = cfg(env), now2 = Date.now(), day = import_engine.default.dayKey(now2);
  p = p || await getPlayer(env, address);
  const ids = [];
  matches.forEach((m) => {
    ids.push(m.result.fighters.A.id);
    if (m.persistOpp) ids.push(m.result.fighters.B.id);
  });
  const [chars, mrow] = await Promise.all([
    opts.knownChars ? Promise.resolve(opts.knownChars) : loadChars(env, address, ids),
    opts.missionRow !== void 0 ? Promise.resolve(opts.missionRow) : env.DB.prepare("SELECT state FROM missions WHERE address = ?1 AND day = ?2").bind(address, day).first()
  ]);
  let prog = { profile: { points: p.points, wins: p.wins, losses: p.losses, battles: p.battles, streak: p.streak, bestStreak: p.best_streak }, chars, history: [] };
  let mState = mrow ? JSON.parse(mrow.state) : null, bonus = 0, completed = [], battlePts = 0, legendWins = 0, summary = null;
  for (const m of matches) {
    const applied = import_engine.default.applyBattleResult(prog, m.result);
    prog = applied.progress;
    summary = applied.summary;
    battlePts += Math.round(applied.summary.points * (opts.mult || 1));
    const mo = import_engine.default.updateMissions(mState, m.result, prog.profile.streak, day);
    mState = mo.state;
    bonus += mo.bonusPoints;
    completed = completed.concat(mo.completed);
    if (m.result.winner === "A" && m.result.fighters.B.rarity === "L\xE9gendaire" && opts.mode !== "boss") legendWins++;
  }
  if (opts.points != null) battlePts = opts.points;
  const dayPoints = p.day === day ? p.day_points : 0;
  const capped = Math.max(0, Math.min(battlePts, c.dailyCap - dayPoints));
  const gained = capped + bonus;
  const np = prog.profile;
  const last = matches[matches.length - 1].result.fighters.A;
  const dBattles = np.battles - (p.battles || 0);
  const book = {
    address,
    gained,
    summary,
    completed,
    mState,
    day,
    last,
    matches,
    opts,
    np,
    ids,
    now: now2,
    chars: prog.chars,
    battlePts,
    capped,
    expectedBattles: (p.battles || 0) + dBattles,
    stmts: progressStatements(env, {
      address,
      p,
      np,
      gained,
      legendWins,
      day,
      now: now2,
      last,
      matches,
      dBattles
    })
  };
  if (opts.defer) return book;
  const committed = await commitProgress(env, [book]);
  return settleProgress(env, ctx, book, committed.player);
}
__name(recordMatches, "recordMatches");
async function settleProgress(env, ctx, book, playerRow) {
  const after = playerRow || await getPlayer(env, book.address);
  const platformProgress = await recordBattleProgress(env, book.address, book.matches, after, book.opts.mode || "duel");
  const won = book.matches[book.matches.length - 1].result.winner === "A";
  if (won && env.TELEGRAM_NOTIFY_VICTORIES === "1") {
    await notify(
      env,
      ctx,
      "victory",
      `\u2694\uFE0F Victoire${book.opts.mode && book.opts.mode !== "duel" ? " (" + book.opts.mode + ")" : ""} de ${after.name ? after.name + " (" + short(after.address) + ")" : short(after.address)} : ${book.last.name} bat ${book.matches[book.matches.length - 1].result.fighters.B.name} (+${book.gained} pts, s\xE9rie ${after.streak}).`,
      { badge: false, throttle: ["victory", num(env.VICTORY_NOTIFY_INTERVAL_SEC, 600)] }
    );
  }
  const newRewards = await grantEligible(env, ctx, after);
  return {
    summary: Object.assign({}, book.summary, { points: book.gained, battlePoints: book.battlePts, capped: book.capped < book.battlePts, battlePassXp: platformProgress.xp }),
    missionsCompleted: book.completed,
    missions: missionView(book.mState, book.day),
    profile: publicProfile(after, env),
    newRewards
  };
}
__name(settleProgress, "settleProgress");
async function bossInfo(env, sess) {
  const boss = import_engine.default.dailyBoss(import_engine.default.dayKey()), max = num(env.BOSS_ATTEMPTS_PER_DAY, import_engine.default.BOSS_ATTEMPTS_PER_DAY);
  let left = max;
  if (sess) {
    const u = await env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart(Date.now())).first();
    left = Math.max(0, max - u.n);
  }
  return { boss: { id: boss.id, name: boss.name, baseId: boss.baseId, phases: boss.phases.length + 1 }, attemptsLeft: left, attemptsMax: max };
}
__name(bossInfo, "bossInfo");
function missionView(state, day) {
  return import_engine.default.dailyMissions(day).map((m) => ({
    id: m.id,
    text: m.text,
    target: m.target,
    points: m.points,
    progress: state && state.day === day ? state.progress[m.id] || 0 : 0,
    done: !!(state && state.day === day && state.done[m.id])
  }));
}
__name(missionView, "missionView");
async function claim(env, ctx, sess, rewardId) {
  await rateLimit(env, "claim:" + sess.address, 10, 3600);
  const r = await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(rewardId).first();
  if (!r || r.address !== sess.address) throw new HttpError(404, "R\xE9compense introuvable");
  const T = r.is_test ? "[TEST] " : "";
  if (!r.is_test && isFounder(env, sess.address)) throw new HttpError(403, "R\xE9clamation r\xE9elle d\xE9sactiv\xE9e pour le fondateur : il d\xE9tient d\xE9j\xE0 le stock. Utilise le mode test.");
  if (!r.is_test && !realClaimsOn(env)) throw new HttpError(403, "R\xE9clamations r\xE9elles d\xE9sactiv\xE9es : aucun NFT ne sera r\xE9serv\xE9 ni envoy\xE9.");
  if (r.status !== "earned") {
    await alertSuspicious(env, ctx, "dbl:" + rewardId, `${T}Double r\xE9clamation refus\xE9e : ${short(sess.address)} a de nouveau r\xE9clam\xE9 \xAB ${r.label} \xBB (statut ${r.status}).`);
    throw new HttpError(409, "Cette r\xE9compense a d\xE9j\xE0 \xE9t\xE9 r\xE9clam\xE9e.");
  }
  const stock = rewardStock(env)[r.tier] || [];
  if (r.is_test) {
    const tokenId = stock[0] || 1;
    const u = await env.DB.prepare("UPDATE rewards SET status = 'pending', token_id = ?1, claimed_at = ?2 WHERE id = ?3 AND address = ?4 AND status = 'earned' AND is_test = 1").bind(tokenId, Date.now(), rewardId, sess.address).run();
    if (!u.meta.changes) {
      await alertSuspicious(env, ctx, "dbl:" + rewardId, `${T}Double r\xE9clamation simultan\xE9e refus\xE9e pour ${short(sess.address)} (\xAB ${r.label} \xBB).`);
      throw new HttpError(409, "Cette r\xE9compense a d\xE9j\xE0 \xE9t\xE9 r\xE9clam\xE9e.");
    }
    await notify(env, ctx, "claim", `${T}\u{1F4E8} Nouvelle demande de NFT : ${short(sess.address)} r\xE9clame le Neon Buddies #${String(tokenId).padStart(4, "0")} (${TIER_FR[r.tier]}, \xAB ${r.label} \xBB). Mode test : aucun NFT r\xE9el ne sera envoy\xE9. Utilise /rewards ou l\u2019espace admin pour valider.`, { adminLink: true });
    return rewardView(await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(rewardId).first());
  }
  if (!stock.length) {
    await notify(env, ctx, "stock", `\u{1F6AB} Stock \xE9puis\xE9 au niveau ${TIER_FR[r.tier]} : ${short(sess.address)} n\u2019a pas pu r\xE9clamer \xAB ${r.label} \xBB.`, { throttle: ["empty:" + r.tier, 3600] });
    throw new HttpError(409, "Stock \xE9puis\xE9 pour ce niveau de r\xE9compense. L\u2019administrateur a \xE9t\xE9 pr\xE9venu.");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const reserved = await reserveRealToken(env, rewardId, sess.address, stock);
      if (reserved === null) {
        const again = await env.DB.prepare("SELECT status FROM rewards WHERE id = ?1").bind(rewardId).first();
        if (!again || again.status !== "earned") {
          await alertSuspicious(env, ctx, "dbl:" + rewardId, `${T}Double r\xE9clamation simultan\xE9e refus\xE9e pour ${short(sess.address)} (\xAB ${r.label} \xBB).`);
          throw new HttpError(409, "Cette r\xE9compense a d\xE9j\xE0 \xE9t\xE9 r\xE9clam\xE9e.");
        }
        await notify(env, ctx, "stock", `\u{1F6AB} Stock \xE9puis\xE9 au niveau ${TIER_FR[r.tier]} : ${short(sess.address)} n\u2019a pas pu r\xE9clamer \xAB ${r.label} \xBB.`, { throttle: ["empty:" + r.tier, 3600] });
        throw new HttpError(409, "Stock \xE9puis\xE9 pour ce niveau de r\xE9compense. L\u2019administrateur a \xE9t\xE9 pr\xE9venu.");
      }
      const saved = await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(rewardId).first();
      await notify(env, ctx, "claim", `${T}\u{1F4E8} Nouvelle demande de NFT : ${short(sess.address)} r\xE9clame le Neon Buddies #${String(saved.token_id).padStart(4, "0")} (${TIER_FR[r.tier]}, \xAB ${r.label} \xBB). Utilise /rewards ou l\u2019espace admin pour valider.`, { adminLink: true });
      const usedTier = await env.DB.prepare("SELECT COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 AND tier = ?1").bind(r.tier).first();
      const remain = Math.max(0, stock.length - usedTier.n);
      if (remain <= num(env.STOCK_LOW_THRESHOLD, 2)) await notify(env, ctx, "stock", `\u{1F4C9} Stock bas : il reste ${remain} NFT disponible(s) au niveau ${TIER_FR[r.tier]}.`, { throttle: ["stock:" + r.tier + ":" + remain, 86400] });
      return rewardView(saved);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (!/UNIQUE/i.test(String(e && e.message || e))) throw e;
    }
  }
  throw new HttpError(503, "R\xE9essaie dans un instant.");
}
__name(claim, "claim");
async function reserveRealToken(env, rewardId, address, stock) {
  const ids = stock.filter((n) => Number.isInteger(n) && n >= 1 && n <= 100);
  if (!ids.length) return null;
  const list = ids.join(",");
  const sql = `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
    UPDATE rewards
    SET status = 'pending', claimed_at = ?1,
        token_id = (
          SELECT n FROM seq
          WHERE n IN (${list})
            AND n NOT IN (
              SELECT token_id FROM rewards
              WHERE status IN ('pending','approved','sent') AND is_test = 0 AND token_id IS NOT NULL
            )
          ORDER BY n LIMIT 1
        )
    WHERE id = ?2 AND address = ?3 AND status = 'earned' AND is_test = 0
      AND EXISTS (
        SELECT 1 FROM seq
        WHERE n IN (${list})
          AND n NOT IN (
            SELECT token_id FROM rewards
            WHERE status IN ('pending','approved','sent') AND is_test = 0 AND token_id IS NOT NULL
          )
      )`;
  const u = await env.DB.prepare(sql).bind(Date.now(), rewardId, address).run();
  return u.meta.changes ? true : null;
}
__name(reserveRealToken, "reserveRealToken");
async function adminApprove(env, id) {
  const c = cfg(env);
  const r = await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(id).first();
  if (!r) throw new HttpError(404, "R\xE9compense introuvable");
  if (!r.is_test && !realClaimsOn(env)) throw new HttpError(403, "R\xE9clamations r\xE9elles d\xE9sactiv\xE9es : aucun transfert ne sera pr\xE9par\xE9 ni envoy\xE9.");
  if (r.status !== "pending" && r.status !== "approved") throw new HttpError(409, "Statut actuel : " + r.status);
  if (!r.is_test && c.onchain) {
    const owner = await ownerOf(env, r.token_id);
    if (owner !== c.admin) throw new HttpError(409, `Le token #${r.token_id} n\u2019appartient plus \xE0 l\u2019administrateur (propri\xE9taire : ${owner}).`);
  }
  await env.DB.prepare("UPDATE rewards SET status = 'approved', decided_at = ?1 WHERE id = ?2 AND status IN ('pending','approved')").bind(Date.now(), id).run();
  return { test: !!r.is_test, reward: rewardView(Object.assign(r, { status: "approved" })), tx: { from: c.admin, to: c.contract, value: "0x0", chainId: "0x" + c.chainId.toString(16), data: encodeSafeTransferFrom(c.admin, r.address, r.token_id) } };
}
__name(adminApprove, "adminApprove");
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a ?? ""))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b ?? "")))
  ]);
  const left = new Uint8Array(ha), right = new Uint8Array(hb);
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(left, right);
  let d = 0;
  for (let i = 0; i < left.length; i++) d |= left[i] ^ right[i];
  return d === 0;
}
__name(safeEqual, "safeEqual");
function tgAdmin(env, fromId, chatId) {
  const adminChat = String(env.TELEGRAM_ADMIN_CHAT_ID || "");
  if (!adminChat) return false;
  return String(fromId ?? "") === adminChat && String(chatId ?? "") === adminChat;
}
__name(tgAdmin, "tgAdmin");
async function stockLeft(env) {
  const stock = rewardStock(env);
  const used = await env.DB.prepare("SELECT tier, COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY tier").all();
  const usedBy = Object.fromEntries(used.results.map((r) => [r.tier, r.n]));
  return Object.fromEntries(TIERS.map((t) => [t, Math.max(0, stock[t].length - (usedBy[t] || 0))]));
}
__name(stockLeft, "stockLeft");
function adminUrl(env) {
  return env.PUBLIC_SITE_URL ? env.PUBLIC_SITE_URL.replace(/#.*$/, "") + "#admin" : null;
}
__name(adminUrl, "adminUrl");
async function telegramWebhook(req, env, ctx) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || !await safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.TELEGRAM_WEBHOOK_SECRET)) throw new HttpError(401, "Non autoris\xE9");
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: true };
  const u = await body(req);
  const send = /* @__PURE__ */ __name((chat2, text, extra) => tg(env, "sendMessage", Object.assign({ chat_id: chat2, text, disable_web_page_preview: true }, extra || {})), "send");
  if (u.callback_query) {
    const q = u.callback_query, chat2 = q.message && q.message.chat && q.message.chat.id;
    if (!tgAdmin(env, q.from && q.from.id, chat2)) {
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id, text: "Non autoris\xE9" });
      return { ok: true };
    }
    const mm = String(q.data || "").match(/^(ap|rj):(.+)$/);
    if (!mm) {
      await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
      return { ok: true };
    }
    let text;
    try {
      if (mm[1] === "ap") {
        const out = await adminApprove(env, mm[2]);
        if (out.test) text = `[TEST] \u2705 Demande de test approuv\xE9e (NFT #${String(out.reward.tokenId).padStart(4, "0")}). Lance la simulation du transfert dans l\u2019espace admin \u2014 aucune transaction r\xE9elle${adminUrl(env) ? " : " + adminUrl(env) : "."}`;
        else text = `\u2705 Demande approuv\xE9e : NFT #${String(out.reward.tokenId).padStart(4, "0")} pour ${short(out.reward.address)}.
\xC9tape suivante : signe le transfert avec ton wallet dans l\u2019espace admin${adminUrl(env) ? " : " + adminUrl(env) : ""}.`;
      } else {
        const r = await env.DB.prepare("UPDATE rewards SET status = 'rejected', note = 'Refus\xE9 via Telegram', decided_at = ?1 WHERE id = ?2 AND status IN ('earned','pending','approved')").bind(Date.now(), mm[2]).run();
        text = r.meta.changes ? "\u274C Demande refus\xE9e : " + mm[2] : "Impossible de refuser (d\xE9j\xE0 trait\xE9e ?) : " + mm[2];
      }
    } catch (e) {
      text = "\u26A0\uFE0F " + (e.message || "Erreur");
    }
    await tg(env, "answerCallbackQuery", { callback_query_id: q.id, text: text.slice(0, 190) });
    if (q.message) await tg(env, "editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text, disable_web_page_preview: true });
    return { ok: true };
  }
  const msg = u.message;
  if (!msg || typeof msg.text !== "string") return { ok: true };
  const chat = String(msg.chat && msg.chat.id), isAdmin = tgAdmin(env, msg.from && msg.from.id, chat);
  const cmd = msg.text.trim().split(/\s+/)[0].replace(/@.*$/, "").toLowerCase();
  const site = env.PUBLIC_SITE_URL || "";
  if (cmd === "/start") {
    if (isAdmin) {
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('tg_admin_chat', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(chat).run();
      await send(chat, "\u{1F44B} Bonjour admin ! Ce chat est enregistr\xE9 pour les alertes NEON BUDDIES ARENA.\nCommandes : /status, /rewards" + (adminUrl(env) ? "\nEspace admin : " + adminUrl(env) : ""));
    } else {
      await send(chat, "\u{1F47E} NEON BUDDIES \u2014 NFT BATTLE ARENA\nJeu de combat gratuit avec les 100 Neon Buddies 2. Aucun achat n\xE9cessaire." + (site ? "\nJouer : " + site : ""));
    }
    return { ok: true };
  }
  if (cmd === "/status" || cmd === "/rewards") {
    if (!isAdmin) {
      await send(chat, "Commande r\xE9serv\xE9e \xE0 l\u2019administrateur.");
      return { ok: true };
    }
    if (cmd === "/status") {
      const counts = Object.fromEntries((await env.DB.prepare("SELECT status, COUNT(*) AS n FROM rewards GROUP BY status").all()).results.map((r) => [r.status, r.n]));
      const players = await env.DB.prepare("SELECT COUNT(*) AS n FROM players WHERE battles > 0").first();
      const left = await stockLeft(env);
      const last = await env.DB.prepare("SELECT f.address, f.a, f.b, f.points, p.name FROM fights f LEFT JOIN players p ON p.address = f.address WHERE f.winner = 'A' ORDER BY f.id DESC LIMIT 5").all();
      const lines = last.results.map((r) => `\u2022 ${r.name || short(r.address)} : #${r.a} bat #${r.b} (+${r.points})`).join("\n") || "\u2022 aucune";
      await send(chat, `\u{1F4CA} Statut
Demandes en attente : ${counts.pending || 0} \xB7 approuv\xE9es (transfert \xE0 signer) : ${counts.approved || 0} \xB7 envoy\xE9es : ${counts.sent || 0}
Joueurs actifs : ${players.n}
Stock restant : ${TIERS.map((t) => TIER_FR[t] + " " + left[t]).join(" \xB7 ")}
Derni\xE8res victoires :
${lines}`);
      return { ok: true };
    }
    const rows = (await env.DB.prepare("SELECT * FROM rewards WHERE status = 'pending' ORDER BY claimed_at LIMIT 10").all()).results;
    if (!rows.length) {
      await send(chat, "Aucune demande de NFT en attente. \u{1F389}");
      return { ok: true };
    }
    for (const r of rows) {
      await send(
        chat,
        `${r.is_test ? "[TEST] " : ""}\u{1F4E8} ${short(r.address)} \u2014 NFT #${String(r.token_id).padStart(4, "0")} (${TIER_FR[r.tier]})
\xAB ${r.label} \xBB
Adresse : ${r.address}`,
        { reply_markup: { inline_keyboard: [[{ text: "\u2705 Approuver", callback_data: "ap:" + r.id }, { text: "\u274C Refuser", callback_data: "rj:" + r.id }]] } }
      );
    }
    await send(chat, "Apr\xE8s approbation, le transfert doit \xEAtre sign\xE9 avec ton wallet dans l\u2019espace admin" + (adminUrl(env) ? " : " + adminUrl(env) : "."));
    return { ok: true };
  }
  await send(chat, isAdmin ? "Commandes : /status, /rewards" : "Commande inconnue. Tape /start.");
  return { ok: true };
}
__name(telegramWebhook, "telegramWebhook");
async function adminSimulate(env, ctx, id) {
  const c = cfg(env);
  const r = await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(id).first();
  if (!r) throw new HttpError(404, "R\xE9compense introuvable");
  if (!r.is_test) throw new HttpError(409, "Simulation r\xE9serv\xE9e aux r\xE9compenses de TEST.");
  if (r.status !== "approved") throw new HttpError(409, "Approuve d\u2019abord la demande.");
  const call = { from: c.admin, to: c.contract, data: encodeSafeTransferFrom(c.admin, r.address, r.token_id) };
  let ok = true, reason = "", gas = null;
  try {
    await rpc(env, "eth_call", [call, "latest"]);
  } catch (e) {
    ok = false;
    reason = e.message;
  }
  if (ok) {
    try {
      gas = parseInt(await rpc(env, "eth_estimateGas", [call]), 16);
    } catch (e) {
      gas = null;
    }
  }
  const note = ok ? `TEST \u2014 transfert simul\xE9 (eth_call OK${gas ? ", gaz estim\xE9 " + gas : ""}). Aucun NFT envoy\xE9.` : "TEST \u2014 la simulation \xE9choue : " + reason;
  if (ok) await env.DB.prepare("UPDATE rewards SET status = 'sent', note = ?1, sent_at = ?2 WHERE id = ?3 AND status = 'approved' AND is_test = 1").bind(note, Date.now(), id).run();
  await notify(env, ctx, "sent", `[TEST] ${ok ? "\u{1F9EA} Transfert simul\xE9" : "\u26A0\uFE0F Simulation en \xE9chec"} pour NFT #${String(r.token_id).padStart(4, "0")} \u2192 ${short(r.address)}. ${ok ? "Aucune transaction r\xE9elle." : reason}`);
  return { simulated: true, ok, gas, reason, reward: rewardView(await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(id).first()) };
}
__name(adminSimulate, "adminSimulate");
async function adminTx(env, ctx, id, txHash) {
  const c = cfg(env);
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ""))) throw new HttpError(400, "Hash de transaction invalide");
  txHash = lower(txHash);
  const r = await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(id).first();
  if (!r) throw new HttpError(404, "R\xE9compense introuvable");
  if (r.is_test) throw new HttpError(409, "R\xE9compense de TEST : utilise la simulation, aucune transaction r\xE9elle.");
  if (!realClaimsOn(env)) throw new HttpError(403, "R\xE9clamations r\xE9elles d\xE9sactiv\xE9es : aucune transaction ne peut \xEAtre enregistr\xE9e.");
  if (r.status === "sent") return { reward: rewardView(r), verified: true };
  if (r.status !== "approved") throw new HttpError(409, "Approuve d\u2019abord la demande.");
  const dup = await env.DB.prepare("SELECT id FROM rewards WHERE tx_hash = ?1").bind(txHash).first();
  if (dup) throw new HttpError(409, "Cette transaction est d\xE9j\xE0 associ\xE9e \xE0 une autre r\xE9compense.");
  const chain = await rpc(env, "eth_chainId", []);
  if (parseInt(chain, 16) !== c.chainId) throw new HttpError(502, "Mauvais r\xE9seau RPC");
  const rc = await rpc(env, "eth_getTransactionReceipt", [txHash]);
  if (!rc) return { pending: true, message: "Transaction pas encore confirm\xE9e, r\xE9essaie dans quelques secondes." };
  if (rc.status !== "0x1") throw new HttpError(409, "La transaction a \xE9chou\xE9 sur la blockchain.");
  const ok = (rc.logs || []).some((l) => lower(l.address) === lower(c.contract) && l.topics && l.topics.length === 4 && lower(l.topics[0]) === TRANSFER_TOPIC && lower(l.topics[1]) === addrTopic(c.admin) && lower(l.topics[2]) === addrTopic(r.address) && lower(l.topics[3]) === uintTopic(r.token_id));
  if (!ok) throw new HttpError(409, "Aucun transfert correspondant (admin \u2192 joueur, bon token) dans cette transaction.");
  if (c.onchain) {
    const owner = await ownerOf(env, r.token_id);
    if (owner !== lower(r.address)) throw new HttpError(409, "Le joueur n\u2019est pas (encore) propri\xE9taire du token.");
  }
  const marked = await env.DB.prepare("UPDATE rewards SET status = 'sent', tx_hash = ?1, sent_at = ?2 WHERE id = ?3 AND status = 'approved'").bind(txHash, Date.now(), id).run();
  if (!marked.meta.changes) throw new HttpError(409, "Cette r\xE9compense n\u2019est plus en attente d\u2019envoi.");
  await notify(env, ctx, "sent", `\u2705 NFT #${String(r.token_id).padStart(4, "0")} envoy\xE9 \xE0 ${short(r.address)} \u2014 tx ${txHash}`);
  return { reward: rewardView(await env.DB.prepare("SELECT * FROM rewards WHERE id = ?1").bind(id).first()), verified: true };
}
__name(adminTx, "adminTx");
var live = createLiveApi({
  E: import_engine.default,
  HttpError,
  CHAR_BY_ID,
  COLLECTION: import_collection.default,
  randomHex,
  rand32,
  randomChar,
  fightLock,
  loadChars,
  lvOf,
  recordMatches,
  commitProgress,
  settleProgress,
  getPlayer,
  publicProfile,
  rateLimit,
  dayStart
});
async function route(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ""), m = req.method;
  const c = cfg(env);
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  let mm;
  if (!c.admin || !isAddress(c.admin)) throw new HttpError(500, "ADMIN_ADDRESS non configur\xE9e");
  if (m === "POST" && path === "/telegram/webhook") return telegramWebhook(req, env, ctx);
  if (m === "GET" && path === "/api/health") {
    await rateLimit(env, "health:" + ip, 120, 60);
    return { ok: true, chainId: c.chainId, contract: c.contract, admin: c.admin, day: import_engine.default.dayKey(), realClaims: c.realClaims, payments: false, checkout: false, manual: true, schema: "0002", audited: false };
  }
  if (m === "GET" && path === "/api/config") {
    await rateLimit(env, "cfg:" + ip, 60, 60);
    const stock = rewardStock(env);
    const used = await env.DB.prepare("SELECT tier, COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY tier").all();
    const usedBy = Object.fromEntries(used.results.map((r) => [r.tier, r.n]));
    return {
      chainId: c.chainId,
      contract: c.contract,
      admin: c.admin,
      day: import_engine.default.dayKey(),
      missions: missionView(null, import_engine.default.dayKey()),
      rules: REWARD_RULES.map((r) => ({ id: r.id, tier: r.tier, tierFr: TIER_FR[r.tier], label: r.label, value: r.value, stat: r.stat })),
      stock: Object.fromEntries(TIERS.map((t) => [t, Math.max(0, stock[t].length - (usedBy[t] || 0))])),
      dailyCap: c.dailyCap,
      realClaims: c.realClaims,
      audited: false
    };
  }
  if (m === "POST" && path === "/api/auth/nonce") {
    await rateLimit(env, "nonce:" + ip, 20, 60);
    const b = await body(req);
    if (!isAddress(b.address)) throw new HttpError(400, "Adresse invalide");
    const origin = req.headers.get("Origin");
    const uri = origin && c.origins.includes(origin) ? origin : c.origins[0] || url.origin;
    const domain = new URL(uri).host;
    const nonce = randomHex(16), now2 = Date.now();
    const message = buildMessage(domain, uri, b.address, nonce, c.chainId, new Date(now2).toISOString(), new Date(now2 + NONCE_TTL).toISOString());
    await env.DB.prepare("DELETE FROM nonces WHERE expires_at < ?1").bind(now2).run();
    await env.DB.prepare("INSERT INTO nonces (nonce, address, message, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(nonce, lower(b.address), message, now2 + NONCE_TTL).run();
    return { nonce, message };
  }
  if (m === "POST" && path === "/api/auth/verify") {
    await rateLimit(env, "verify:" + ip, 20, 60);
    const b = await body(req);
    if (!isAddress(b.address) || typeof b.nonce !== "string" || !/^[0-9a-f]{32}$/.test(b.nonce) || typeof b.signature !== "string") throw new HttpError(400, "Requ\xEAte invalide");
    const n = await env.DB.prepare("DELETE FROM nonces WHERE nonce = ?1 RETURNING address, message, expires_at").bind(b.nonce).first();
    if (!n || n.address !== lower(b.address) || n.expires_at < Date.now()) throw new HttpError(401, "Nonce invalide ou expir\xE9");
    if (!await verifySignature(env, b.address, n.message, b.signature)) {
      await alertSuspicious(env, ctx, "sig:" + ip, `Signature de connexion invalide pour ${short(lower(b.address))}${lower(b.address) === c.admin ? " (adresse ADMIN !)" : ""}.`);
      throw new HttpError(401, "Signature invalide");
    }
    const address = lower(b.address), token = randomHex(32), isAdmin = address === c.admin ? 1 : 0;
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO sessions (token_hash, address, is_admin, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(await sha256Hex(token), address, isAdmin, Date.now() + SESSION_TTL).run();
    await getPlayer(env, address);
    return { token, address, isAdmin: !!isAdmin, expiresAt: Date.now() + SESSION_TTL };
  }
  if (m === "POST" && path === "/api/auth/logout") {
    const h = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    if (/^[0-9a-f]{64}$/.test(h)) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(h)).run();
    return { ok: true };
  }
  if (m === "GET" && path === "/api/leaderboard") {
    await rateLimit(env, "lb:" + ip, 60, 60);
    const elo = url.searchParams.get("type") === "elo";
    const rows = await env.DB.prepare("SELECT address, name, points, wins, losses, best_streak, rating, pvp_wins, pvp_losses FROM players WHERE " + (elo ? "(pvp_wins + pvp_losses) > 0 ORDER BY rating DESC, pvp_wins DESC" : "battles > 0 ORDER BY points DESC, wins DESC") + ", address LIMIT 50").all();
    return { type: elo ? "elo" : "points", players: rows.results.map((r, i) => ({ rank: i + 1, founder: isFounder(env, r.address), address: r.address, name: r.name, points: r.points, wins: r.wins, losses: r.losses, bestStreak: r.best_streak, rating: r.rating, pvpWins: r.pvp_wins, pvpLosses: r.pvp_losses })) };
  }
  if (m === "GET" && path === "/api/me") {
    const s = await auth(req, env);
    const p = await getPlayer(env, s.address), day = import_engine.default.dayKey();
    const mrow = await env.DB.prepare("SELECT state FROM missions WHERE address = ?1 AND day = ?2").bind(s.address, day).first();
    const rw = await env.DB.prepare("SELECT * FROM rewards WHERE address = ?1 ORDER BY earned_at DESC").bind(s.address).all();
    const ch = await env.DB.prepare("SELECT char_id, xp, wins, losses FROM char_progress WHERE address = ?1").bind(s.address).all();
    return {
      profile: publicProfile(p, env),
      isAdmin: !!s.is_admin,
      missions: missionView(mrow ? JSON.parse(mrow.state) : null, day),
      rewards: rw.results.map(rewardView),
      chars: Object.fromEntries(ch.results.map((r) => [r.char_id, { xp: r.xp, wins: r.wins, losses: r.losses }])),
      rules: REWARD_RULES.map((r) => ({ id: r.id, tier: r.tier, tierFr: TIER_FR[r.tier], label: r.label, value: r.value, stat: r.stat, current: p[r.stat] || 0 }))
    };
  }
  if (m === "POST" && path === "/api/me/name") {
    const s = await auth(req, env);
    const b = await body(req);
    const name = String(b.name || "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 20) || null;
    await env.DB.prepare("UPDATE players SET name = ?1 WHERE address = ?2").bind(name, s.address).run();
    return { name };
  }
  if (m === "POST" && path === "/api/custom/import") {
    const s = await auth(req, env);
    await rateLimit(env, "customimp:" + s.address, 10, 3600);
    await body(req);
    const product = live.importProduct();
    if (isFounder(env, s.address)) return { accepted: false, ranked: false, founder: true, pendingPayment: false, paymentsLive: false, localOnly: true, priceEur: null, productId: product.id };
    throw new HttpError(403, "Ajout en ligne d\u2019un NFT personnel : 4,99 EUR approuv\xE9s, paiement d\xE9sactiv\xE9 (PayPal non connect\xE9). Aucun encaissement. L\u2019image peut rester sur cet appareil, hors classement.");
  }
  if (m === "GET" && path === "/api/shop") {
    await rateLimit(env, "shop:" + ip, 60, 60);
    const shop = live.shop();
    const c2 = cfg(env), testMode = env.SHOP_TEST_MODE === "1";
    return Object.assign({}, shop, { payments: testMode ? "test-free" : c2.paymentsEnabled ? "crypto-prepared" : "off", checkout: false, realPayments: false, testMode, products: shop.products.map((p) => Object.assign({}, p, { purchasable: testMode && p.testOnly === true })) });
  }
  if (m === "POST" && path === "/api/shop/test-order") {
    if (env.SHOP_TEST_MODE !== "1") throw new HttpError(404, "Boutique de test d\xE9sactiv\xE9e");
    const s = await auth(req, env), b = await body(req);
    try {
      return await testPurchase(env, s.address, b.productId);
    } catch (e) {
      throw new HttpError(400, e.message || "Commande de test impossible");
    }
  }
  if (m === "GET" && path === "/api/features") {
    const s = await auth(req, env);
    return featureSnapshot(env, s.address);
  }
  if (m === "POST" && path === "/api/features/daily/claim") {
    const s = await auth(req, env);
    return claimDaily(env, s.address);
  }
  if (m === "POST" && path === "/api/features/battle-pass/claim") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await claimPass(env, s.address, String(b.track || ""), Number(b.level));
    } catch (e) {
      throw new HttpError(400, e.message || "R\xE9clamation Battle Pass impossible");
    }
  }
  if (m === "POST" && path === "/api/features/profile") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await updateProfile(env, s.address, b);
    } catch (e) {
      throw new HttpError(400, e.message || "Profil invalide");
    }
  }
  if (m === "POST" && path === "/api/features/evolution") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await evolveCharacter(env, s.address, b.charId);
    } catch (e) {
      throw new HttpError(400, e.message || "\xC9volution impossible");
    }
  }
  if (m === "POST" && path === "/api/features/tournaments/register") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await registerTournament(env, s.address, b.fighterId, b.type);
    } catch (e) {
      throw new HttpError(400, e.message || "Inscription impossible");
    }
  }
  if (m === "POST" && path === "/api/features/missions/claim") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await claimMission(env, s.address, b.missionId);
    } catch (e) {
      throw new HttpError(400, e.message || "Mission non r\xE9clamable");
    }
  }
  if (m === "POST" && path === "/api/features/guilds") {
    const s = await auth(req, env), b = await body(req);
    try {
      return await createGuild(env, s.address, b);
    } catch (e) {
      throw new HttpError(400, e.message || "Cr\xE9ation de guilde impossible");
    }
  }
  if (m === "POST" && (mm = path.match(/^\/api\/features\/guilds\/([^/]+)\/invite$/))) {
    const s = await auth(req, env), b = await body(req);
    try {
      return await inviteGuildMember(env, s.address, decodeURIComponent(mm[1]), b.address);
    } catch (e) {
      throw new HttpError(400, e.message || "Invitation impossible");
    }
  }
  if (m === "POST" && (mm = path.match(/^\/api\/features\/guilds\/([^/]+)\/invite\/decision$/))) {
    const s = await auth(req, env), b = await body(req);
    try {
      return await decideGuildInvite(env, s.address, decodeURIComponent(mm[1]), b.decision);
    } catch (e) {
      throw new HttpError(400, e.message || "D\xE9cision impossible");
    }
  }
  if (m === "POST" && (mm = path.match(/^\/api\/features\/guilds\/([^/]+)\/messages$/))) {
    const s = await auth(req, env), b = await body(req);
    try {
      return await guildChat(env, s.address, decodeURIComponent(mm[1]), b);
    } catch (e) {
      throw new HttpError(400, e.message || "Message refus\xE9");
    }
  }
  if (m === "GET" && path === "/api/starter") return live.starter(env, await auth(req, env));
  if (m === "POST" && path === "/api/starter") return live.chooseStarter(req, env, await auth(req, env));
  if (m === "GET" && path === "/api/challenge") return live.challenge(env, await auth(req, env));
  if (m === "POST" && path === "/api/challenge/new-run") return live.newRun(req, env, await auth(req, env));
  if (m === "POST" && path === "/api/battle/start") return live.startBattle(req, env, ctx, await auth(req, env));
  if (m === "POST" && path === "/api/battle/act") return live.actBattle(req, env, ctx, await auth(req, env));
  if (m === "POST" && path === "/api/battle/finish") return live.finishBattle(req, env, ctx, await auth(req, env));
  if (m === "GET" && path === "/api/battle") return live.getBattle(req, env, ctx, await auth(req, env));
  if (m === "POST" && path === "/api/fight") throw new HttpError(410, "Le combat class\xE9 est manuel : le serveur n\u2019envoie pas le r\xE9sultat \xE0 ta place.");
  if (m === "POST" && path === "/api/boss") return live.startBattle(req, env, ctx, await auth(req, env));
  if (m === "GET" && path === "/api/boss") {
    await rateLimit(env, "bossinfo:" + ip, 60, 60);
    let s0 = null;
    try {
      s0 = await auth(req, env);
    } catch (e) {
    }
    return bossInfo(env, s0);
  }
  if (m === "POST" && path === "/api/tournament") throw new HttpError(409, "Le tournoi interactif n\u2019est pas encore disponible. Aucun tableau n\u2019est jou\xE9 automatiquement \xE0 ta place.");
  if (m === "GET" && path === "/api/tournament/results") {
    await rateLimit(env, "tourres:" + ip, 60, 60);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "") ? url.searchParams.get("day") : import_engine.default.dayKey();
    const rows = await env.DB.prepare("SELECT t.address, p.name, t.placement, t.points, t.created_at FROM tournaments t LEFT JOIN players p ON p.address = t.address WHERE t.day = ?1 ORDER BY t.placement, t.created_at LIMIT 50").bind(day).all();
    return { day, results: rows.results.map((r) => ({ address: r.address, name: r.name, placement: r.placement, points: r.points, founder: isFounder(env, r.address) })) };
  }
  if (m === "POST" && path === "/api/pvp/join" || m === "GET" && path === "/api/pvp/status") {
    await auth(req, env);
    return { status: "pending", interactive: false, message: "Le PvP interactif \xE0 deux joueurs n\u2019est pas encore disponible. Aucun combat automatique n\u2019est disput\xE9 \xE0 ta place." };
  }
  if (m === "POST" && path === "/api/pvp/leave") {
    const s0 = await auth(req, env);
    await env.DB.prepare("DELETE FROM pvp_queue WHERE address = ?1 AND match_id IS NULL").bind(s0.address).run();
    return { ok: true };
  }
  if (m === "POST" && (mm = path.match(/^\/api\/rewards\/([^/]+)\/claim$/))) return claim(env, ctx, await auth(req, env), decodeURIComponent(mm[1]));
  if (path.startsWith("/api/admin/")) {
    const s = await auth(req, env, true);
    if (m === "GET" && path === "/api/admin/dashboard") return adminDashboard(env);
    if (m === "GET" && path === "/api/admin/summary") {
      const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM rewards GROUP BY status").all();
      const notes = await env.DB.prepare("SELECT id, kind, text, created_at, seen FROM notifications ORDER BY id DESC LIMIT 30").all();
      const unseen = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE seen = 0").first();
      return { counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])), unseen: unseen.n, notifications: notes.results, telegram: tgEnabled(env) };
    }
    if (m === "POST" && path === "/api/admin/notifications/seen") {
      await env.DB.prepare("UPDATE notifications SET seen = 1").run();
      return { ok: true };
    }
    if (m === "GET" && path === "/api/admin/rewards") {
      const st = url.searchParams.get("status");
      const q = st ? env.DB.prepare("SELECT * FROM rewards WHERE status = ?1 ORDER BY COALESCE(claimed_at, earned_at) DESC LIMIT 200").bind(st) : env.DB.prepare("SELECT * FROM rewards ORDER BY COALESCE(sent_at, decided_at, claimed_at, earned_at) DESC LIMIT 200");
      return { rewards: (await q.all()).results.map(rewardView) };
    }
    if (m === "POST" && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/approve$/))) return adminApprove(env, decodeURIComponent(mm[1]));
    if (m === "POST" && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/reject$/))) {
      const b = await body(req);
      const u = await env.DB.prepare("UPDATE rewards SET status = 'rejected', note = ?1, decided_at = ?2 WHERE id = ?3 AND status IN ('earned','pending','approved')").bind(String(b.note || "").slice(0, 200), Date.now(), decodeURIComponent(mm[1])).run();
      if (!u.meta.changes) throw new HttpError(409, "Impossible de refuser cette r\xE9compense (d\xE9j\xE0 envoy\xE9e ou introuvable).");
      return { ok: true };
    }
    if (m === "POST" && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/simulate$/))) return adminSimulate(env, ctx, decodeURIComponent(mm[1]));
    if (m === "POST" && path === "/api/admin/test-mode") {
      const b = await body(req);
      const addr = b.address ? lower(b.address) : s.address;
      if (!isAddress(addr)) throw new HttpError(400, "Adresse invalide");
      await getPlayer(env, addr);
      await env.DB.prepare("UPDATE players SET test_mode = ?1 WHERE address = ?2").bind(b.enabled ? 1 : 0, addr).run();
      return { address: addr, testMode: !!b.enabled };
    }
    if (m === "POST" && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/tx$/))) return adminTx(env, ctx, decodeURIComponent(mm[1]), (await body(req)).txHash);
    if (m === "POST" && path === "/api/admin/grant") {
      const b = await body(req);
      if (!isAddress(b.address)) throw new HttpError(400, "Adresse invalide");
      const label = String(b.label || "R\xE9compense sp\xE9ciale").slice(0, 80);
      const test = b.test ? 1 : 0;
      if (!test && !realClaimsOn(env)) throw new HttpError(403, "R\xE9clamations r\xE9elles d\xE9sactiv\xE9es : seule une r\xE9compense de TEST peut \xEAtre attribu\xE9e.");
      if (!test && isFounder(env, b.address)) throw new HttpError(403, "Le fondateur d\xE9tient d\xE9j\xE0 le stock : seule une r\xE9compense de TEST peut lui \xEAtre attribu\xE9e.");
      const tier = TIERS.includes(b.tier) ? b.tier : "Special";
      const id = (test ? "test:" : "") + "special-" + randomHex(4) + ":" + lower(b.address);
      await getPlayer(env, lower(b.address));
      await env.DB.prepare("INSERT INTO rewards (id, address, rule_id, tier, label, earned_at, is_test) VALUES (?1, ?2, 'special', ?3, ?4, ?5, ?6)").bind(id, lower(b.address), tier, label, Date.now(), test).run();
      await notify(env, ctx, "earned", `${test ? "[TEST] " : ""}\u2B50 R\xE9compense ${TIER_FR[tier]} attribu\xE9e \xE0 ${short(lower(b.address))} : ${label}`);
      return { id, test: !!test };
    }
  }
  throw new HttpError(404, "Route inconnue");
}
__name(route, "route");
var index_default = {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const data = await route(req, env, ctx);
      return json(data, data && data.pending ? 202 : 200, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      console.error(JSON.stringify({ message: "request failed", error: String(e && e.message || e) }));
      return json({ error: "Erreur serveur" }, 500, cors);
    }
  }
};
export {
  index_default as default
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/utils.js:
@noble/curves/esm/abstract/modular.js:
@noble/curves/esm/abstract/curve.js:
@noble/curves/esm/abstract/weierstrass.js:
@noble/curves/esm/_shortw_utils.js:
@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=index.js.map
