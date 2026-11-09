/* Tests du moteur : node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const S = require('../js/storage.js');
const C = require('../js/collection.js');

test('collection : 100 personnages avec nom, rareté et traits', () => {
  assert.equal(C.length, 100);
  const ids = new Set(C.map(c => c.id));
  assert.equal(ids.size, 100);
  for (const c of C) {
    assert.match(c.name, /^Neon Buddies #\d{4}$/);
    assert.ok(E.RARITIES.includes(c.rarity), c.rarity);
    assert.ok(c.traits.famille);
  }
  const count = r => C.filter(c => c.rarity === r).length;
  assert.deepEqual([count('Commun'), count('Rare'), count('Épique'), count('Légendaire')], [60, 25, 10, 5]);
});

test('stats déterministes, positives et liées à la rareté', () => {
  for (const c of C) {
    const a = E.baseStats(c), b = E.baseStats(JSON.parse(JSON.stringify(c)));
    assert.deepEqual(a, b);
    for (const k of ['hp', 'atk', 'def', 'spd', 'crit']) assert.ok(a[k] > 0, k);
  }
  const avg = r => { const l = C.filter(c => c.rarity === r); return l.reduce((s, c) => s + E.power(E.baseStats(c)), 0) / l.length; };
  assert.ok(avg('Légendaire') > avg('Épique'));
  assert.ok(avg('Épique') > avg('Rare'));
  assert.ok(avg('Rare') > avg('Commun'));
});

test('personnage ajouté : rareté inconnue → Commun, stats générées', () => {
  const s = E.baseStats({ id: 'c-x', name: 'Mon NFT', rarity: '???', traits: { famille: 'Personnalisé' } });
  assert.ok(s.hp >= 100 && s.atk > 0);
  assert.equal(E.makeFighter({ id: 'c-x', name: 'x', rarity: '???' }, 1, 'A').rarity, 'Commun');
});

test('XP et niveaux', () => {
  assert.deepEqual(E.levelFromXp(0), { level: 1, xpInLevel: 0, xpNeeded: 100 });
  assert.equal(E.levelFromXp(99).level, 1);
  assert.equal(E.levelFromXp(100).level, 2);
  assert.equal(E.levelFromXp(299).level, 2);
  assert.equal(E.levelFromXp(300).level, 3);
  assert.equal(E.levelFromXp(300).xpInLevel, 0);
  assert.equal(E.levelFromXp(1e9).level, E.MAX_LEVEL);
  assert.equal(E.levelFromXp(-5).level, 1);
  const base = E.baseStats(C[0]);
  const l1 = E.statsAtLevel(base, 1), l10 = E.statsAtLevel(base, 10);
  assert.deepEqual(l1, base);
  for (const k of ['hp', 'atk', 'def', 'spd']) assert.ok(l10[k] > l1[k], k);
  assert.ok(l10.crit > l1.crit);
});

test('combat : déterministe avec une graine, se termine, PV cohérents', () => {
  const a = C[0], b = C[1];
  const r1 = E.simulateBattle(a, 1, b, 1, 42), r2 = E.simulateBattle(a, 1, b, 1, 42);
  assert.deepEqual(r1, r2);
  for (let seed = 0; seed < 500; seed++) {
    const x = C[seed % 100], y = C[(seed * 13 + 7) % 100];
    if (x.id === y.id) continue;
    const r = E.simulateBattle(x, 1 + seed % 5, y, 1 + seed % 3, seed);
    assert.ok(['A', 'B'].includes(r.winner));
    assert.ok(r.turns <= E.MAX_TURNS);
    assert.equal(r.events[0].type, 'start');
    assert.equal(r.events.at(-1).type, 'end');
    const loser = r.winner === 'A' ? r.fighters.B : r.fighters.A;
    const winner = r.winner === 'A' ? r.fighters.A : r.fighters.B;
    if (!r.events.at(-1).timeout) { assert.equal(loser.hp, 0); assert.ok(winner.hp > 0); }
    assert.equal(r.winnerId, winner.id);
    for (const ev of r.events) {
      if (ev.type === 'attack' || ev.type === 'special') {
        assert.ok(Number.isInteger(ev.damage) && ev.damage >= 1);
        assert.ok(ev.hpAfter >= 0 && ev.hpAfter <= ev.maxHp);
        assert.ok(['A', 'B'].includes(ev.attacker) && ev.attacker !== ev.defender);
      }
    }
  }
});

test('combat : attaque spéciale toutes les 3 actions et coups critiques présents', () => {
  let specials = 0, crits = 0, dodges = 0;
  for (let s = 0; s < 300; s++) {
    const r = E.simulateBattle(C[s % 100], 1, C[(s + 50) % 100], 1, s);
    const perSide = { A: 0, B: 0 };
    for (const ev of r.events) {
      if (!ev.attacker) continue;
      perSide[ev.attacker]++;
      if (ev.type === 'special') { specials++; assert.equal(perSide[ev.attacker] % 3, 0); }
      if (ev.crit) crits++;
      if (ev.type === 'dodge') dodges++;
    }
  }
  assert.ok(specials > 0 && crits > 0 && dodges > 0);
});

test('équilibrage : niveau supérieur augmente les chances de victoire', () => {
  const com = C.filter(c => c.rarity === 'Commun').slice(0, 10);
  let w1 = 0, w8 = 0, n = 0;
  for (const a of com) for (const b of com) {
    if (a === b) continue;
    for (let s = 0; s < 4; s++) {
      n++;
      if (E.simulateBattle(a, 1, b, 1, n).winner === 'A') w1++;
      if (E.simulateBattle(a, 8, b, 1, n).winner === 'A') w8++;
    }
  }
  assert.ok(w8 / n > w1 / n + 0.25, `${w1 / n} → ${w8 / n}`);
});

test('résultat : XP, victoires/défaites, points et série', () => {
  let save = S.defaultSave();
  const r = E.simulateBattle(C[1], 1, C[0], 1, 7);
  const { progress, summary } = E.applyBattleResult(save, r);
  assert.equal(save.profile.battles, 0, 'fonction pure');
  assert.equal(progress.profile.battles, 1);
  assert.equal(progress.chars[r.winnerId].wins, 1);
  assert.equal(progress.chars[r.loserId].losses, 1);
  assert.equal(progress.chars[r.winnerId].xp, summary.xpWinner);
  assert.equal(progress.chars[r.loserId].xp, summary.xpLoser);
  assert.ok(summary.xpWinner > summary.xpLoser);
  if (summary.playerWon) {
    assert.equal(progress.profile.wins, 1); assert.equal(progress.profile.streak, 1);
    assert.ok(summary.points >= 40);
  } else {
    assert.equal(progress.profile.losses, 1); assert.equal(progress.profile.streak, 0);
    assert.equal(summary.points, 10);
  }
  assert.equal(progress.profile.points, summary.points);
  assert.equal(progress.history.length, 1);
});

test('montée de niveau après plusieurs victoires', () => {
  let save = S.defaultSave();
  const strong = C.find(c => c.rarity === 'Légendaire');
  const weak = C.filter(c => c.rarity === 'Commun');
  let wins = 0, i = 0;
  while (wins < 3 && i < 200) {
    const r = E.simulateBattle(strong, E.levelFromXp((save.chars[strong.id] || { xp: 0 }).xp).level, weak[i % weak.length], 1, i++);
    const out = E.applyBattleResult(save, r);
    save = out.progress;
    if (out.summary.playerWon) wins++;
  }
  assert.equal(wins, 3);
  assert.ok(E.levelFromXp(save.chars[strong.id].xp).level >= 2);
  assert.ok(save.profile.bestStreak >= 1);
});

test('classement : tri par victoires puis niveau, rangs consécutifs', () => {
  const save = S.defaultSave();
  save.chars[C[5].id] = { xp: 500, wins: 9, losses: 1 };
  save.chars[C[9].id] = { xp: 900, wins: 9, losses: 4 };
  save.chars[C[2].id] = { xp: 0, wins: 3, losses: 0 };
  const lb = E.leaderboard(C, save);
  assert.equal(lb.length, 100);
  assert.equal(lb[0].id, C[9].id); // même nb de victoires, niveau plus haut
  assert.equal(lb[1].id, C[5].id);
  assert.equal(lb[2].id, C[2].id);
  assert.equal(lb[1].winRate, 90);
  lb.forEach((r, i) => assert.equal(r.rank, i + 1));
});

test('sauvegarde : save / load / reset avec un stockage simulé', () => {
  const mem = {};
  const backend = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const st = S.createStore(backend);
  const empty = st.load();
  assert.deepEqual(empty, S.defaultSave());
  const r = E.simulateBattle(C[0], 1, C[1], 1, 3);
  const data = Object.assign(S.defaultSave(), E.applyBattleResult(S.defaultSave(), r).progress);
  data.custom.push({ id: 'c-test', name: 'Mon NFT', rarity: 'Rare', image: 'data:image/jpeg;base64,AAAA', createdAt: 1, traits: { famille: 'Panda Néon' } });
  data.settings.sound = false; data.settings.lastA = '0002';
  assert.equal(st.save(data).ok, true);
  const back = S.createStore(backend).load();
  assert.equal(back.profile.battles, 1);
  assert.deepEqual(back.chars, data.chars);
  assert.equal(back.custom.length, 1);
  assert.equal(back.custom[0].name, 'Mon NFT');
  assert.equal(back.settings.sound, false);
  assert.equal(back.settings.lastA, '0002');
  st.reset();
  assert.deepEqual(st.load(), S.defaultSave());
});

test('sauvegarde : données corrompues ou malveillantes nettoyées', () => {
  const mem = { [S.KEY]: '{pas du json' };
  const backend = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  assert.deepEqual(S.createStore(backend).load(), S.defaultSave());
  const dirty = S.sanitize({
    profile: { points: -50, wins: 'abc', losses: 3.7 },
    chars: { '0001': { xp: -10, wins: 2 } },
    custom: [{ id: 'c1', name: 'x', image: 'javascript:alert(1)' }, { id: 'c2', name: 'ok', image: 'data:image/png;base64,AA' }],
    settings: { speed: 99 }
  });
  assert.equal(dirty.profile.points, 0);
  assert.equal(dirty.profile.wins, 0);
  assert.equal(dirty.profile.losses, 3);
  assert.equal(dirty.chars['0001'].xp, 0);
  assert.equal(dirty.custom.length, 1);
  assert.equal(dirty.settings.speed, 1);
});

test('sauvegarde : quota dépassé signalé sans planter', () => {
  const backend = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }, removeItem: () => {} };
  assert.deepEqual(S.createStore(backend).save(S.defaultSave()), { ok: false, error: 'quota' });
});

test('export / import JSON', () => {
  const st = S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const d = S.defaultSave(); d.profile.points = 1234;
  assert.equal(st.importJson(st.exportJson(d)).profile.points, 1234);
  assert.throws(() => st.importJson('nope'));
});

test('missions quotidiennes : 3 missions déterministes par jour, progression et bonus', () => {
  const m1 = E.dailyMissions('2026-11-09'), m2 = E.dailyMissions('2026-11-09');
  assert.equal(m1.length, 3);
  assert.deepEqual(m1, m2);
  assert.equal(new Set(m1.map(m => m.id)).size, 3);
  let state = null, bonus = 0, done = 0;
  for (let i = 0; i < 40; i++) {
    const r = E.simulateBattle(C[1], 5, C[(i % 50) + 50], 1, i);
    const out = E.updateMissions(state, r, r.winner === 'A' ? i + 1 : 0, '2026-11-09');
    state = out.state; bonus += out.bonusPoints; done += out.completed.length;
  }
  assert.ok(done >= 1 && bonus > 0);
  // Une mission terminée ne rapporte qu'une fois
  const again = E.updateMissions(state, E.simulateBattle(C[1], 5, C[60], 1, 999), 50, '2026-11-09');
  for (const m of again.completed) assert.ok(!state.done[m.id]);
  // Nouveau jour = remise à zéro
  const nd = E.updateMissions(state, E.simulateBattle(C[1], 1, C[2], 1, 1), 0, '2026-11-10');
  assert.equal(nd.state.day, '2026-11-10');
});

test('points : battre un adversaire bien plus faible rapporte moins', () => {
  const leg = C.find(c => c.rarity === 'Légendaire'), com = C.find(c => c.rarity === 'Commun');
  let easy = null, hard = null;
  for (let s = 0; s < 400 && (!easy || !hard); s++) {
    const r1 = E.simulateBattle(leg, 10, com, 1, s);
    if (!easy && r1.winner === 'A') easy = E.applyBattleResult(S.defaultSave(), r1).summary.points;
    const r2 = E.simulateBattle(com, 4, leg, 4, s);
    if (!hard && r2.winner === 'A') hard = E.applyBattleResult(S.defaultSave(), r2).summary.points;
  }
  assert.ok(easy && hard && hard > easy, `${easy} < ${hard}`);
});

test('solo contre bots : difficulté → niveau, stats et points', () => {
  assert.equal(E.botLevel('facile', 1), 1);
  assert.equal(E.botLevel('cauchemar', 3), 6);
  const me = C.find(c => c.rarity === 'Rare'), bot = C.find(c => c.rarity === 'Rare' && c.id !== me.id);
  const rate = (d) => { let w = 0; for (let s = 0; s < 300; s++) if (E.simulateBattle(me, 3, bot, E.botLevel(d, 3), s, { scaleB: E.DIFFICULTIES[d].scale }).winner === 'A') w++; return w / 300; };
  const f = rate('facile'), n = rate('normal'), h = rate('difficile'), c = rate('cauchemar');
  assert.ok(f > n && n > h && h > c, [f, n, h, c].join(' > '));
  const r = E.simulateBattle(me, 3, bot, 8, 1, { scaleB: 1.3 });
  assert.ok(r.fighters.B.maxHp > E.makeFighter(bot, 8, 'B').maxHp);
});

test('boss : PV élevés, phases successives, points selon dégâts', () => {
  const boss = E.BOSSES[0], ch = E.bossCharacter(boss, C);
  assert.equal(ch.name, 'ROI CHROME OMEGA');
  const leg = C.find(c => c.rarity === 'Légendaire');
  let phases = 0, wins = 0;
  for (let s = 0; s < 200; s++) {
    const r = E.simulateBattle(leg, 10, ch, E.bossLevel(10), s, { boss });
    assert.ok(r.fighters.B.maxHp > 400);
    const ph = r.events.filter(e => e.type === 'phase');
    if (ph.length) { phases++; assert.deepEqual(ph.map(p => p.phase), ph.map((_, i) => i + 2)); }
    if (r.winner === 'A') { wins++; assert.equal(E.bossPoints(r), 900); assert.equal(ph.length, 2); }
    else assert.ok(E.bossPoints(r) <= 400);
  }
  assert.ok(phases > 0 && wins > 0);
  assert.ok(E.BOSSES.includes(E.dailyBoss('2026-11-09')));
  assert.equal(E.dailyBoss('2026-11-09'), E.dailyBoss('2026-11-09'));
});

test('tournoi : tableau à 8, 7 matchs, un champion, placements et points', () => {
  const entrants = C.slice(0, 8).map((c, i) => ({ ch: c, level: 1 + i % 3, player: i === 0, bot: i > 0 }));
  const t = E.runTournament(entrants, 1234);
  assert.deepEqual(t.rounds.map(r => r.matches.length), [4, 2, 1]);
  const pl = Object.values(t.placement).sort((a, b) => a - b);
  assert.deepEqual(pl, [1, 2, 3, 3, 5, 5, 5, 5]);
  assert.equal(t.placement[t.champion], 1);
  assert.deepEqual(E.runTournament(entrants, 1234), t, 'déterministe');
  // les matchs du joueur contiennent le combat complet à rejouer
  t.rounds.forEach(r => r.matches.forEach(m => assert.equal(!!m.result, m.a === 0 || m.b === 0)));
  assert.throws(() => E.runTournament(entrants.slice(0, 7), 1));
  assert.equal(E.TOURNAMENT_POINTS[1], 600);
});

test('PvP : inversion du point de vue et ELO', () => {
  const r = E.simulateBattle(C[3], 2, C[8], 4, 77);
  const f = E.flipResult(r);
  assert.equal(f.fighters.A.id, C[8].id); assert.equal(f.fighters.B.id, C[3].id);
  assert.equal(f.winner === 'A' ? f.fighters.A.id : f.fighters.B.id, r.winnerId);
  assert.deepEqual(E.flipResult(f), r);
  const e = E.elo(1000, 1000, 1);
  assert.deepEqual(e, { a: 1016, b: 984, delta: 16 });
  assert.ok(E.elo(1200, 1000, 1).delta < 16 && E.elo(1000, 1200, 1).delta > 16);
});
