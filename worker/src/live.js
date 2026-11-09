/** Sessions de combat manuel. Le client choisit l'action ; les dégâts, l'horloge et les points restent ici. */
import { fightWindow, clockNow } from './fight-window.js';
import { SHOP, productById } from './shop.js';

const CHALLENGE_ATTEMPTS = 3;

function nowOf(req, env) {
  return clockNow(env, req.headers.get('x-nb-test-now'));
}

function parseState(row) {
  return JSON.parse(row.state);
}

export function createLiveApi(d) {
  const { E, HttpError, CHAR_BY_ID, COLLECTION, randomHex, rand32, randomChar, fightLock, loadChars, lvOf, recordMatches, commitProgress, settleProgress, getPlayer, publicProfile, rateLimit, dayStart } = d;

  async function bodyOf(req) {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > 8192) throw new HttpError(413, 'Requête trop grande');
    const t = await req.text();
    if (!t) return {};
    try { return JSON.parse(t); }
    catch (e) { throw new HttpError(400, 'JSON invalide'); }
  }

  function rejectImport(id) {
    const s = String(id || '');
    if (s.startsWith('c-') || s === 'apercu') throw new HttpError(400, 'Image ajoutée refusée en classé : la rareté et les stats choisies ne sont pas vérifiées et ne comptent pas.');
  }

  async function activeRow(env, address) {
    return env.DB.prepare('SELECT * FROM live_battles WHERE active_key = ?1').bind(address).first();
  }

  async function saveActive(env, id, address, state, prevSeq) {
    const u = await env.DB.prepare("UPDATE live_battles SET state = ?1, updated_at = ?2 WHERE id = ?3 AND active_key = ?4 AND status = 'active' AND CAST(json_extract(state, '$.seq') AS INTEGER) = ?5")
      .bind(JSON.stringify(state), Date.now(), id, address, prevSeq).run();
    return !!(u.meta && u.meta.changes);
  }

  async function consumeChallenge(env, address, difficulty) {
    await env.DB.prepare('INSERT OR IGNORE INTO challenge_runs (address, run_id, difficulty, attempts_used, eliminated, started_at) VALUES (?1, ?2, ?3, 0, 0, ?4)')
      .bind(address, randomHex(8), difficulty, Date.now()).run();
    await env.DB.prepare('UPDATE challenge_runs SET attempts_used = attempts_used + 1, eliminated = CASE WHEN attempts_used + 1 >= ?2 THEN 1 ELSE 0 END WHERE address = ?1')
      .bind(address, CHALLENGE_ATTEMPTS).run();
  }

  async function settle(env, ctx, sess, row, state) {
    if (state.status === 'active') return null;
    if (row.summary) return JSON.parse(row.summary);
    const claim = await env.DB.prepare("UPDATE live_battles SET status = 'finishing', active_key = NULL, updated_at = ?1 WHERE id = ?2 AND status = 'active'")
      .bind(Date.now(), row.id).run();
    if (!claim.meta || !claim.meta.changes) {
      const again = await env.DB.prepare('SELECT summary FROM live_battles WHERE id = ?1').bind(row.id).first();
      if (again && again.summary) return JSON.parse(again.summary);
      throw new HttpError(409, 'Combat déjà en cours de clôture.');
    }
    let payload;
    if (state.forfeit || state.playerActions < 1) {
      const p = await getPlayer(env, sess.address);
      payload = { forfeit: true, seed: state.seed, mode: state.mode, difficulty: state.difficulty, result: E.manualResult(state), summary: { points: 0, playerWon: false }, profile: publicProfile(p, env), newRewards: [] };
    } else {
      const result = E.manualResult(state);
      const diff = state.difficulty ? E.DIFFICULTIES[state.difficulty] : null;
      const ids = [state.A.id];
      if (state.mode === 'duel') ids.push(state.B.id);
      const [p, missionRow, knownChars, bossUsed] = await Promise.all([
        getPlayer(env, sess.address),
        env.DB.prepare('SELECT state FROM missions WHERE address = ?1 AND day = ?2').bind(sess.address, E.dayKey()).first(),
        loadChars(env, sess.address, ids),
        state.mode === 'boss'
          ? env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart(Date.now())).first()
          : Promise.resolve(null)
      ]);
      const opts = { mode: state.mode, mult: diff ? diff.points : 1, knownChars, missionRow, defer: true };
      if (state.mode === 'boss') opts.points = E.bossPoints(result);
      const book = await recordMatches(env, ctx, sess.address, p, [{ result, seed: state.seed, persistOpp: state.mode === 'duel' }], opts);
      const slim = Object.assign({}, result, { events: [] });
      book.matches[0].result = slim;
      const extras = [];
      let challengeAt = -1;
      if (state.mode === 'solo' && !state.pvpFallback) {
        extras.push(env.DB.prepare('INSERT OR IGNORE INTO challenge_runs (address, run_id, difficulty, attempts_used, eliminated, started_at) VALUES (?1, ?2, ?3, 0, 0, ?4)')
          .bind(sess.address, randomHex(8), state.difficulty, Date.now()));
        challengeAt = extras.length;
        extras.push(env.DB.prepare('UPDATE challenge_runs SET attempts_used = attempts_used + 1, eliminated = CASE WHEN attempts_used + 1 >= ?2 THEN 1 ELSE 0 END WHERE address = ?1 RETURNING attempts_used, eliminated')
          .bind(sess.address, CHALLENGE_ATTEMPTS));
      }
      const committed = await commitProgress(env, [book], extras);
      const runRow = challengeAt >= 0 ? committed.results[committed.extraStart + challengeAt].results[0] : null;
      const out = await settleProgress(env, ctx, book, committed.player);
      payload = Object.assign({
        forfeit: false, seed: state.seed, result: slim, mode: state.mode, difficulty: state.difficulty,
        attemptsLeft: state.mode === 'boss' ? Math.max(0, 3 - ((bossUsed && bossUsed.n) || 0) - 1) : null,
        attemptsUsed: runRow ? runRow.attempts_used : null,
        attemptsMax: state.mode === 'solo' && !state.pvpFallback ? CHALLENGE_ATTEMPTS : null,
        eliminated: runRow ? !!runRow.eliminated : false
      }, out);
      await env.DB.prepare("UPDATE live_battles SET status = 'finished', summary = ?1, state = '{\"s\":1}', updated_at = ?2 WHERE id = ?3")
        .bind(JSON.stringify(payload), Date.now(), row.id).run();
    }
    if (state.forfeit || state.playerActions < 1) {
      await env.DB.prepare("UPDATE live_battles SET status = 'forfeit', summary = ?1, state = ?2, updated_at = ?3 WHERE id = ?4")
        .bind(JSON.stringify(payload), '{"s":1}', Date.now(), row.id).run();
    }
    return payload;
  }

  async function startBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    rejectImport(b.fighterId);
    rejectImport(b.opponentId);
    const now = nowOf(req, env);
    const existing = await activeRow(env, sess.address);
    if (existing) throw new HttpError(409, 'Un combat manuel est déjà en cours.');
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    const mode = path === '/api/boss' || b.mode === 'boss' ? 'boss' : b.mode === 'solo' ? 'solo' : 'duel';
    if (mode === 'pvp' || b.mode === 'tournoi') throw new HttpError(409, 'Ce mode interactif n’est pas encore disponible.');
    const a = CHAR_BY_ID.get(String(b.fighterId || ''));
    if (!a) throw new HttpError(400, 'Combattant inconnu (combats classés : uniquement les 100 Neon Buddies).');
    const diff = mode === 'solo' ? E.DIFFICULTIES[b.difficulty || 'normal'] : null;
    if (mode === 'solo' && !diff) throw new HttpError(400, 'Difficulté inconnue');
    if (mode === 'solo' && !b.pvpFallback) {
      const run = await env.DB.prepare('SELECT * FROM challenge_runs WHERE address = ?1').bind(sess.address).first();
      if (run && (run.eliminated || run.attempts_used >= CHALLENGE_ATTEMPTS)) throw new HttpError(429, 'Série de défi terminée (3/3). Lance une nouvelle série pour rejouer. L’historique est conservé.');
      if (run && run.difficulty !== diff.id) throw new HttpError(409, 'Difficulté verrouillée pour cette série : ' + run.difficulty + '.');
    }
    if (mode === 'boss') {
      const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart(Date.now())).first();
      if (used.n >= E.BOSS_ATTEMPTS_PER_DAY) throw new HttpError(429, 'Tentatives contre le boss épuisées pour aujourd’hui (' + E.BOSS_ATTEMPTS_PER_DAY + '/' + E.BOSS_ATTEMPTS_PER_DAY + ').');
    }
    let opp, boss = null, levelB, scale;
    if (mode === 'boss') {
      boss = E.dailyBoss(E.dayKey());
      opp = E.bossCharacter(boss, COLLECTION);
      levelB = E.bossLevel(1);
    } else if (mode === 'duel') {
      if (b.opponentId == null || b.opponentId === '') throw new HttpError(400, 'Adversaire inconnu');
      opp = CHAR_BY_ID.get(String(b.opponentId));
      if (!opp) throw new HttpError(400, 'Adversaire inconnu');
      if (opp.id === a.id) throw new HttpError(400, 'Choisis deux personnages différents.');
    } else {
      opp = randomChar([a.id]);
    }
    await fightLock(env, ctx, sess.address);
    if (b.pvpFallback) await env.DB.prepare('DELETE FROM pvp_queue WHERE address = ?1 AND match_id IS NULL').bind(sess.address).run();
    const chars = await loadChars(env, sess.address, [a.id, opp.id]);
    const lvA = lvOf(chars, a.id);
    levelB = mode === 'boss' ? E.bossLevel(lvA) : diff ? E.botLevel(diff.id, lvA) : lvOf(chars, opp.id);
    scale = diff ? diff.scale : 1;
    const win = fightWindow(env, now, req.headers.get('x-nb-test-min'));
    const seed = rand32();
    const state = E.createManualBattle(a, lvA, opp, levelB, seed, {
      now: win.startedAt, minMs: win.minDurationMs, maxMs: win.minDurationMs + 60000,
      mode, difficulty: diff ? diff.id : null, scaleB: scale, boss, pvpFallback: !!b.pvpFallback
    });
    state.pvpFallback = !!b.pvpFallback;
    const id = randomHex(12);
    try {
      await env.DB.prepare('INSERT INTO live_battles (id, address, active_key, status, state, summary, updated_at) VALUES (?1, ?2, ?3, \'active\', ?4, NULL, ?5)')
        .bind(id, sess.address, sess.address, JSON.stringify(state), Date.now()).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e && e.message || e))) throw new HttpError(409, 'Un combat manuel est déjà en cours.');
      throw e;
    }
    return { id, seed, resumed: false, mode, difficulty: state.difficulty, battle: E.manualView(state, now), fighterLevel: lvA };
  }

  async function loadOwned(env, sess, id) {
    const row = await env.DB.prepare('SELECT * FROM live_battles WHERE id = ?1 AND address = ?2').bind(id, sess.address).first();
    if (!row) throw new HttpError(404, 'Combat introuvable');
    return row;
  }

  async function actBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    await rateLimit(env, 'act:' + sess.address, 2000, 60);
    const row = await loadOwned(env, sess, String(b.id || ''));
    if (row.summary) return { battle: E.manualView(parseState(row), nowOf(req, env)), settled: JSON.parse(row.summary) };
    if (row.status !== 'active') throw new HttpError(409, 'Ce combat est déjà terminé.');
    const now = nowOf(req, env);
    const seq = Number(b.seq);
    let state = parseState(row);
    if (Number.isFinite(seq) && seq <= state.seq) return { battle: E.manualView(state, now), settled: null };
    const acted = E.manualAct(state, b.action, now, Number.isFinite(seq) ? seq : state.seq + 1);
    if (!acted.ok && acted.reason === 'cooldown') {
      await saveActive(env, row.id, sess.address, acted.state, state.seq);
      throw new HttpError(409, 'Temps de recharge pas encore écoulé.');
    }
    if (!acted.ok && acted.reason === 'seq') return { battle: E.manualView(state, now), settled: null };
    if (!acted.ok) throw new HttpError(400, 'Action refusée.');
    state = acted.state;
    if (state.status === 'active') {
      const saved = await saveActive(env, row.id, sess.address, state, parseState(row).seq);
      if (!saved) {
        const again = await loadOwned(env, sess, row.id);
        if (again.summary) return { battle: E.manualView(parseState(again), now), settled: JSON.parse(again.summary) };
        return { battle: E.manualView(parseState(again), now), settled: null };
      }
    }
    row.state = JSON.stringify(state);
    const settled = await settle(env, ctx, sess, row, state);
    return { battle: E.manualView(state, now), settled };
  }

  async function finishBattle(req, env, ctx, sess) {
    const b = await bodyOf(req);
    const row = await loadOwned(env, sess, String(b.id || ''));
    if (row.summary) return JSON.parse(row.summary);
    const now = nowOf(req, env);
    let state = parseState(row);
    const fin = E.manualFinish(state, now);
    state = fin.state;
    if (!fin.ok && fin.reason === 'early') throw new HttpError(425, 'Le combat dure au minimum 2 min 30. Les points ne sont pas encore attribués.');
    if (!fin.ok && fin.reason === 'continue') {
      await saveActive(env, row.id, sess.address, state, parseState(row).seq);
      throw new HttpError(425, 'Le combat continue : un des deux tient encore.');
    }
    const settled = await settle(env, ctx, sess, row, state);
    if (!settled) throw new HttpError(425, 'Le combat continue.');
    return settled;
  }

  async function getBattle(req, env, ctx, sess) {
    const now = nowOf(req, env);
    const id = new URL(req.url).searchParams.get('id');
    const row = id ? await loadOwned(env, sess, id) : await activeRow(env, sess.address);
    if (!row) return { battle: null };
    if (row.summary) return { id: row.id, battle: E.manualView(parseState(row), now), settled: JSON.parse(row.summary) };
    const prev = parseState(row);
    const ticked = E.manualTick(prev, now);
    let state = ticked;
    if (ticked.status !== 'active') {
      row.state = JSON.stringify(ticked);
      const settled = await settle(env, ctx, sess, row, ticked);
      return { id: row.id, battle: E.manualView(ticked, now), settled };
    }
    const fin = now >= prev.deadlineAt ? E.manualFinish(ticked, now) : null;
    if (fin && fin.ok) {
      row.state = JSON.stringify(fin.state);
      const settled = await settle(env, ctx, sess, row, fin.state);
      return { id: row.id, battle: E.manualView(fin.state, now), settled };
    }
    if (fin) state = fin.state;
    await saveActive(env, row.id, sess.address, state, prev.seq);
    return { id: row.id, battle: E.manualView(state, now), settled: null };
  }

  function stableThree(anchor) {
    const ids = COLLECTION.map(c => c.id);
    const h = E.hash(String(anchor || 'starter'));
    const out = [];
    if (anchor && CHAR_BY_ID.has(anchor)) out.push(anchor);
    let i = 0;
    while (out.length < 3 && i < 500) {
      const id = ids[(h + i * 17) % ids.length];
      if (!out.includes(id)) out.push(id);
      i++;
    }
    return out;
  }

  async function starter(env, sess) {
    let row = await env.DB.prepare('SELECT * FROM starter_offers WHERE address = ?1').bind(sess.address).first();
    if (!row) {
      const p = await env.DB.prepare('SELECT battles, last_fighter FROM players WHERE address = ?1').bind(sess.address).first();
      let offer, chosen = null;
      if (p && p.battles > 0 && CHAR_BY_ID.has(p.last_fighter)) {
        chosen = p.last_fighter;
        offer = stableThree(chosen);
      } else offer = stableThree(COLLECTION[rand32() % COLLECTION.length].id).slice(0, 3);
      if (new Set(offer).size < 3) offer = stableThree(COLLECTION[0].id);
      await env.DB.prepare('INSERT INTO starter_offers (address, offer, chosen, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(sess.address, JSON.stringify(offer), chosen, Date.now()).run();
      row = await env.DB.prepare('SELECT * FROM starter_offers WHERE address = ?1').bind(sess.address).first();
    }
    return { offer: JSON.parse(row.offer), chosen: row.chosen, note: 'Choix en jeu, pas un NFT offert ni transféré. Les 100 restent dans la galerie.' };
  }

  async function chooseStarter(req, env, sess) {
    const b = await bodyOf(req);
    const row = await env.DB.prepare('SELECT * FROM starter_offers WHERE address = ?1').bind(sess.address).first();
    if (!row) throw new HttpError(409, 'Aucune offre de départ.');
    const offer = JSON.parse(row.offer);
    const id = String(b.id || '');
    if (!offer.includes(id)) throw new HttpError(400, 'Ce personnage ne fait pas partie de l’offre.');
    if (row.chosen && row.chosen !== id) throw new HttpError(409, 'Le choix de départ est déjà enregistré.');
    if (!row.chosen) await env.DB.prepare('UPDATE starter_offers SET chosen = ?1 WHERE address = ?2 AND chosen IS NULL').bind(id, sess.address).run();
    return { offer, chosen: id, note: 'Choix en jeu, pas un NFT offert ni transféré. Les 100 restent dans la galerie.' };
  }

  async function challenge(env, sess) {
    const run = await env.DB.prepare('SELECT * FROM challenge_runs WHERE address = ?1').bind(sess.address).first();
    if (!run) return { attemptsUsed: 0, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: false, difficulty: null, runId: null };
    return { attemptsUsed: run.attempts_used, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: !!run.eliminated, difficulty: run.difficulty, runId: run.run_id };
  }

  async function newRun(req, env, sess) {
    const b = await bodyOf(req);
    const run = await env.DB.prepare('SELECT * FROM challenge_runs WHERE address = ?1').bind(sess.address).first();
    if (!run || !run.eliminated) throw new HttpError(409, 'Une nouvelle série n’est possible qu’après l’élimination.');
    const open = await activeRow(env, sess.address);
    if (open) throw new HttpError(409, 'Un combat manuel est déjà en cours.');
    const diff = E.DIFFICULTIES[b.difficulty] ? b.difficulty : run.difficulty;
    const me = await env.DB.prepare('SELECT points, battles FROM players WHERE address = ?1').bind(sess.address).first();
    await env.DB.prepare('UPDATE challenge_runs SET run_id = ?1, difficulty = ?2, attempts_used = 0, eliminated = 0, started_at = ?3 WHERE address = ?4')
      .bind(randomHex(8), diff, Date.now(), sess.address).run();
    return { attemptsUsed: 0, attemptsMax: CHALLENGE_ATTEMPTS, eliminated: false, difficulty: diff, points: me ? me.points : 0, battles: me ? me.battles : 0 };
  }

  function shop() {
    return SHOP;
  }

  function importProduct() {
    return productById('personal-import');
  }

  return { startBattle, actBattle, finishBattle, getBattle, starter, chooseStarter, challenge, newRun, shop, importProduct };
}
