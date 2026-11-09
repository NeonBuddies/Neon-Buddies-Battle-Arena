/* NEON BUDDIES — NFT BATTLE ARENA : serveur de récompenses (Cloudflare Worker + D1).
   Source de vérité pour les combats classés, les points, les missions et les réclamations de NFT.
   Aucune clé privée n'est stockée : les transferts sont signés par l'administrateur dans son propre wallet. */
import E from '../../js/engine.js';
import { CHAIN_ID, NFT_CONTRACT, TIERS, TIER_FR, REWARD_RULES, rewardStock, COLLECTION } from './config.js';
import {
  isAddress, lower, hashPersonalMessage, encodeSafeTransferFrom, encodeOwnerOf, encodeIsValidSignature,
  is1271Magic, addrTopic, uintTopic, TRANSFER_TOPIC, randomHex, sha256Hex
} from './crypto.js';

const NONCE_TTL = 5 * 60 * 1000;
const SESSION_TTL = 7 * 24 * 3600 * 1000;
const CHAR_BY_ID = new Map(COLLECTION.map(c => [c.id, c]));

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

/* ---------- utilitaires ---------- */
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function cfg(env) {
  return {
    admin: lower(env.ADMIN_ADDRESS || ''),
    rpc: env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
    chainId: num(env.CHAIN_ID, CHAIN_ID),
    contract: env.NFT_CONTRACT || NFT_CONTRACT,
    origins: String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    fightInterval: num(env.FIGHT_MIN_INTERVAL_MS, 2000),
    maxFightsDay: num(env.MAX_FIGHTS_PER_DAY, 300),
    dailyCap: num(env.DAILY_POINTS_CAP, 3000),
    onchain: env.CHECK_ONCHAIN !== '0',
    erc1271: env.ERC1271 !== '0',
    realClaims: String(env.REAL_CLAIMS || '') === '1',
    tgBase: env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  };
}
function realClaimsOn(env) { return cfg(env).realClaims; }
function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const h = { 'Vary': 'Origin' };
  if (origin && cfg(env).origins.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {})
  });
}
async function body(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > 8192) throw new HttpError(413, 'Requête trop grande');
  try { const t = await req.text(); if (t.length > 8192) throw 0; return t ? JSON.parse(t) : {}; }
  catch (e) { throw new HttpError(400, 'JSON invalide'); }
}

/** Limiteur de débit à fenêtre fixe stocké dans D1. */
async function rateLimit(env, key, max, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, win, n) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET n = CASE WHEN rate_limits.win = excluded.win THEN rate_limits.n + 1 ELSE 1 END, win = excluded.win
     RETURNING n`).bind(key, win).first();
  if (row.n > max) throw new HttpError(429, 'Trop de requêtes, réessaie dans un instant.');
}

async function rpc(env, method, params) {
  const r = await fetch(cfg(env).rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!r.ok) throw new HttpError(502, 'RPC indisponible');
  const j = await r.json();
  if (j.error) throw new HttpError(502, 'Erreur RPC : ' + (j.error.message || 'inconnue'));
  return j.result;
}
async function ownerOf(env, tokenId) {
  const res = await rpc(env, 'eth_call', [{ to: cfg(env).contract, data: encodeOwnerOf(tokenId) }, 'latest']);
  return '0x' + String(res).slice(-40).toLowerCase();
}

/* ---------- notifications (badge admin + Telegram) ---------- */
function tgEnabled(env) { return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID); }
async function tg(env, method, payload) {
  const r = await fetch(`${cfg(env).tgBase}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return r.ok ? r.json() : null;
}
/** Limiteur « silencieux » : renvoie false au lieu de lever une erreur (utilisé pour espacer les messages). */
async function allow(env, key, max, windowSec) {
  try { await rateLimit(env, key, max, windowSec); return true; } catch (e) { return false; }
}
/**
 * Enregistre une notification (badge de l'espace admin) et l'envoie sur Telegram si configuré.
 * opts.throttle = [clé, secondes] pour espacer les messages répétitifs ; opts.badge = false pour ne pas l'afficher dans le badge.
 */
async function notify(env, ctx, kind, text, opts) {
  opts = opts || {};
  if (opts.throttle && !(await allow(env, 'tg:' + opts.throttle[0], 1, opts.throttle[1]))) return;
  if (opts.badge !== false) await env.DB.prepare('INSERT INTO notifications (kind, text, created_at) VALUES (?1, ?2, ?3)').bind(kind, text, Date.now()).run();
  if (tgEnabled(env)) {
    const payload = { chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text: '🎮 NEON BUDDIES ARENA\n' + text, disable_web_page_preview: true };
    if (opts.adminLink && env.PUBLIC_SITE_URL) payload.reply_markup = { inline_keyboard: [[{ text: '🔐 Ouvrir l’espace admin', url: env.PUBLIC_SITE_URL.replace(/#.*$/, '') + '#admin' }]] };
    const p = tg(env, 'sendMessage', payload).catch(() => null);
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  }
}
/** Alerte anti-triche / activité suspecte (espacée : 1 message par clé toutes les 10 minutes). */
function alertSuspicious(env, ctx, key, text) {
  const p = notify(env, ctx, 'alert', '⚠️ ' + text, { throttle: ['alert:' + key, 600] }).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
  return p;
}

/* ---------- authentification par signature (style SIWE) ---------- */
function buildMessage(domain, uri, address, nonce, chainId, issued, expires) {
  return `${domain} veut que tu te connectes avec ton compte Ethereum :\n${address}\n\n` +
    `Connexion à NEON BUDDIES — NFT BATTLE ARENA. Cette signature ne déclenche aucune transaction et ne coûte aucun frais.\n\n` +
    `URI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
}

let recoverAddress = null;
async function verifySignature(env, address, message, signature) {
  // EOA, y compris un compte EIP-7702 dont la clé signe un personal_sign : la récupération doit redonner CETTE adresse.
  // L'égalité d'adresse sans signature valide ne suffit jamais. La courbe n'est chargée qu'ici.
  if (!recoverAddress) recoverAddress = (await import('./ecdsa.js')).recoverAddress;
  const rec = recoverAddress(message, signature);
  if (rec && lower(rec) === lower(address)) return true;
  // Compte avec du code (contrat ou délégation EIP-7702 0xef0100…) : ERC-1271, échec fermé.
  // SemiModularAccount7702 n'accepte pas le personal_sign brut : il enveloppe le hash (replay-safe) et un type de signature.
  // On transmet la signature telle que le wallet l'a produite et on ne croit que la valeur magique ABI.
  if (!cfg(env).erc1271) return false;
  const data = encodeIsValidSignature(hashPersonalMessage(message), signature);
  if (!data) return false;
  try {
    const code = String(await rpc(env, 'eth_getCode', [address, 'latest']) || '').toLowerCase();
    if (!code || code === '0x' || code === '0x0') return false;
    const res = await rpc(env, 'eth_call', [{ to: address, data }, 'latest']);
    return is1271Magic(res);
  } catch (e) {
    return false;
  }
}

async function auth(req, env, adminOnly) {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) throw new HttpError(401, 'Connexion requise');
  const s = await env.DB.prepare('SELECT address, is_admin, expires_at FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(m[1])).first();
  if (!s || s.expires_at < Date.now()) throw new HttpError(401, 'Session expirée, reconnecte-toi.');
  if (adminOnly && !(s.is_admin && s.address === cfg(env).admin)) throw new HttpError(403, 'Réservé à l\u2019administrateur');
  return s;
}

/* ---------- joueurs ---------- */
async function getPlayer(env, address) {
  let p = await env.DB.prepare('SELECT * FROM players WHERE address = ?1').bind(address).first();
  if (!p) {
    await env.DB.prepare('INSERT OR IGNORE INTO players (address, created_at) VALUES (?1, ?2)').bind(address, Date.now()).run();
    p = await env.DB.prepare('SELECT * FROM players WHERE address = ?1').bind(address).first();
  }
  return p;
}
function isFounder(env, address) { return lower(address) === cfg(env).admin; }
function publicProfile(p, env) {
  return { founder: isFounder(env, p.address), testMode: !!p.test_mode, address: p.address, name: p.name || null, points: p.points, wins: p.wins, losses: p.losses, battles: p.battles,
    streak: p.streak, bestStreak: p.best_streak, legendWins: p.legend_wins, rating: p.rating, pvpWins: p.pvp_wins, pvpLosses: p.pvp_losses, dayPoints: p.day === E.dayKey() ? p.day_points : 0 };
}
function rewardView(r) {
  return { id: r.id, rule: r.rule_id, tier: r.tier, tierFr: TIER_FR[r.tier], label: r.label, status: r.status, tokenId: r.token_id,
    txHash: r.tx_hash, note: r.note, test: !!r.is_test, earnedAt: r.earned_at, claimedAt: r.claimed_at, decidedAt: r.decided_at, sentAt: r.sent_at, address: r.address };
}

/** Accorde les récompenses dont la condition est remplie (INSERT OR IGNORE : une seule fois par règle). */
async function grantEligible(env, ctx, p) {
  const fresh = [];
  const test = p.test_mode ? 1 : 0;
  // Le fondateur détient déjà le stock : pas de récompense réelle pour lui (le mode test reste possible).
  if (!test && isFounder(env, p.address)) return fresh;
  const pending = [];
  const stmts = [];
  for (const rule of REWARD_RULES) {
    if ((p[rule.stat] || 0) < rule.value) continue;
    const id = (test ? 'test:' : '') + rule.id + ':' + p.address;
    pending.push({ id, rule });
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO rewards (id, address, rule_id, tier, label, earned_at, is_test) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(id, p.address, rule.id, rule.tier, rule.label, Date.now(), test));
  }
  if (!stmts.length) return fresh;
  const written = await env.DB.batch(stmts);
  for (let i = 0; i < pending.length; i++) {
    if (!(written[i].meta && written[i].meta.changes)) continue;
    const rule = pending[i].rule;
    fresh.push({ id: pending[i].id, tier: rule.tier, tierFr: TIER_FR[rule.tier], label: rule.label, test: !!test });
    await notify(env, ctx, 'earned', `${test ? '[TEST] ' : ''}🏆 ${short(p.address)} a gagné une récompense NFT ${TIER_FR[rule.tier]} (« ${rule.label} »). Elle pourra être réclamée puis validée dans l’espace admin.`);
  }
  return fresh;
}

/* ---------- combats classés (le serveur choisit la graine et calcule le résultat) ---------- */
function rand32() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
function randomChar(exceptIds) { const pool = COLLECTION.filter(x => !exceptIds.includes(x.id)); return pool[rand32() % pool.length]; }
function dayStart(now) { return Date.parse(E.dayKey(now) + 'T00:00:00Z'); }

/** Verrou anti-triche : intervalle minimum, limite par minute et par jour. Renvoie la ligne joueur. */
async function fightLock(env, ctx, address) {
  const c = cfg(env);
  try { await rateLimit(env, 'fightmin:' + address, 30, 60); }
  catch (e) { await alertSuspicious(env, ctx, 'fight:' + address, `Activité suspecte : ${short(address)} dépasse la limite de combats par minute.`); throw e; }
  const now = Date.now(), day = E.dayKey(now);
  await env.DB.prepare('INSERT OR IGNORE INTO players (address, created_at) VALUES (?1, ?2)').bind(address, now).run();
  const p = await env.DB.prepare('UPDATE players SET last_fight_at = ?1 WHERE address = ?2 AND last_fight_at <= ?3 RETURNING *')
    .bind(now, address, now - c.fightInterval).first();
  if (!p) {
    await rateLimit(env, 'fastfight:' + address, 1e9, 60).catch(() => {});
    const n = await env.DB.prepare('SELECT n FROM rate_limits WHERE key = ?1').bind('fastfight:' + address).first();
    if (n && n.n >= 10) await alertSuspicious(env, ctx, 'fast:' + address, `Anti-triche : ${short(address)} envoie des combats trop rapprochés (${n.n} refus en 1 min).`);
    throw new HttpError(429, 'Patiente un instant avant le prochain combat.');
  }
  if ((p.day === day ? p.day_fights : 0) >= c.maxFightsDay) throw new HttpError(429, 'Limite quotidienne de combats classés atteinte.');
  return p;
}
async function loadChars(env, address, ids) {
  const chars = {};
  const uniq = [...new Set(ids)];
  if (!uniq.length) return chars;
  const marks = uniq.map((_, i) => '?' + (i + 2)).join(',');
  const rows = await env.DB.prepare('SELECT char_id, xp, wins, losses FROM char_progress WHERE address = ?1 AND char_id IN (' + marks + ')')
    .bind(address, ...uniq).all();
  for (const r of rows.results) chars[r.char_id] = { xp: r.xp, wins: r.wins, losses: r.losses };
  return chars;
}
const lvOf = (chars, id) => E.levelFromXp((chars[id] || {}).xp || 0).level;

/**
 * Stats, missions, XP et journal dans une seule transaction D1.
 * Si le nombre de combats a changé depuis la lecture, l'INSERT sur la clé primaire échoue
 * et toute la transaction (stats comprises) est annulée. Pas de journal sans stats, ni l'inverse.
 */
function progressStatements(env, b) {
  return [
    env.DB.prepare(`UPDATE players SET points = points + ?1, wins = wins + ?2, losses = losses + ?3, battles = battles + ?4,
      streak = ?5, best_streak = MAX(best_streak, ?6), legend_wins = legend_wins + ?7, day = ?8,
      day_points = CASE WHEN day = ?8 THEN day_points + ?9 ELSE ?9 END,
      day_fights = CASE WHEN day = ?8 THEN day_fights + ?10 ELSE ?10 END,
      last_fighter = ?11, last_level = ?12
      WHERE address = ?13 AND battles = ?14`)
      .bind(b.gained, b.np.wins - (b.p.wins || 0), b.np.losses - (b.p.losses || 0), b.dBattles, b.np.streak, b.np.bestStreak, b.legendWins, b.day, b.gained, b.matches.length, b.last.id, b.last.level, b.address, b.p.battles || 0)
  ];
}

function progressGuard(env, checks) {
  const where = checks.map((_, i) => `(address = ?${i * 2 + 1} AND battles != ?${i * 2 + 2})`).join(' OR ');
  return env.DB.prepare(
    `INSERT INTO players (address, created_at) SELECT address, created_at FROM players WHERE ${where}`
  ).bind(...checks.flatMap(c => [c.address, c.expectedBattles]));
}

async function commitProgress(env, books, extra) {
  const stmts = [];
  for (const b of books) stmts.push(...b.stmts);
  stmts.push(progressGuard(env, books.map(b => ({ address: b.address, expectedBattles: b.expectedBattles }))));
  for (const b of books) {
    stmts.push(env.DB.prepare('INSERT INTO missions (address, day, state) VALUES (?1, ?2, ?3) ON CONFLICT(address, day) DO UPDATE SET state = excluded.state').bind(b.address, b.day, JSON.stringify(b.mState)));
    for (const id of new Set(b.ids || [])) {
      const cp = b.chars && b.chars[id];
      if (!cp) continue;
      stmts.push(env.DB.prepare('INSERT INTO char_progress (address, char_id, xp, wins, losses) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(address, char_id) DO UPDATE SET xp = excluded.xp, wins = excluded.wins, losses = excluded.losses')
        .bind(b.address, id, cp.xp, cp.wins, cp.losses));
    }
    b.matches.forEach((m, i) => stmts.push(env.DB.prepare('INSERT INTO fights (address, a, b, seed, winner, points, created_at, mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(b.address, m.result.fighters.A.id, m.result.fighters.B.id, m.seed >>> 0, m.result.winner, i === b.matches.length - 1 ? b.gained : 0, b.now, b.opts.mode || 'duel')));
  }
  if (extra) stmts.push(...extra);
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (/UNIQUE constraint failed: players\.address/i.test(String(e && (e.message || e.cause && e.cause.message) || e))) {
      throw new HttpError(409, 'Conflit de progression, réessaie.');
    }
    throw e;
  }
}

/**
 * Enregistre un ou plusieurs combats d'un joueur (A = le joueur) : victoires/défaites, XP, missions, points.
 * opts.mode : duel | solo | boss | tournoi | pvp ; opts.mult : multiplicateur de points ; opts.points : total imposé (boss / tournoi).
 */
async function recordMatches(env, ctx, address, p, matches, opts) {
  const c = cfg(env), now = Date.now(), day = E.dayKey(now);
  p = p || await getPlayer(env, address);
  const ids = []; matches.forEach(m => { ids.push(m.result.fighters.A.id); if (m.persistOpp) ids.push(m.result.fighters.B.id); });
  const [chars, mrow] = await Promise.all([
    opts.knownChars ? opts.knownChars : loadChars(env, address, ids),
    env.DB.prepare('SELECT state FROM missions WHERE address = ?1 AND day = ?2').bind(address, day).first()
  ]);
  let prog = { profile: { points: p.points, wins: p.wins, losses: p.losses, battles: p.battles, streak: p.streak, bestStreak: p.best_streak }, chars, history: [] };
  let mState = mrow ? JSON.parse(mrow.state) : null, bonus = 0, completed = [], battlePts = 0, legendWins = 0, summary = null;
  for (const m of matches) {
    const applied = E.applyBattleResult(prog, m.result);
    prog = applied.progress; summary = applied.summary;
    battlePts += Math.round(applied.summary.points * (opts.mult || 1));
    const mo = E.updateMissions(mState, m.result, prog.profile.streak, day);
    mState = mo.state; bonus += mo.bonusPoints; completed = completed.concat(mo.completed);
    if (m.result.winner === 'A' && m.result.fighters.B.rarity === 'Légendaire' && opts.mode !== 'boss') legendWins++;
  }
  if (opts.points != null) battlePts = opts.points;
  const dayPoints = p.day === day ? p.day_points : 0;
  const capped = Math.max(0, Math.min(battlePts, c.dailyCap - dayPoints));
  const gained = capped + bonus;
  const np = prog.profile;
  const last = matches[matches.length - 1].result.fighters.A;
  const dBattles = np.battles - (p.battles || 0);
  const book = {
    address, gained, summary, completed, mState, day, last, matches, opts, np, ids, now,
    chars: prog.chars, battlePts, capped,
    expectedBattles: (p.battles || 0) + dBattles,
    stmts: progressStatements(env, {
      address, p, np, gained, legendWins, day, now, last, matches, dBattles
    })
  };
  if (opts.defer) return book;
  await commitProgress(env, [book]);
  return settleProgress(env, ctx, book);
}

async function settleProgress(env, ctx, book) {
  const after = await getPlayer(env, book.address);
  const won = book.matches[book.matches.length - 1].result.winner === 'A';
  if (won && env.TELEGRAM_NOTIFY_VICTORIES === '1') {
    await notify(env, ctx, 'victory', `⚔️ Victoire${book.opts.mode && book.opts.mode !== 'duel' ? ' (' + book.opts.mode + ')' : ''} de ${after.name ? after.name + ' (' + short(after.address) + ')' : short(after.address)} : ${book.last.name} bat ${book.matches[book.matches.length - 1].result.fighters.B.name} (+${book.gained} pts, série ${after.streak}).`,
      { badge: false, throttle: ['victory', num(env.VICTORY_NOTIFY_INTERVAL_SEC, 600)] });
  }
  const newRewards = await grantEligible(env, ctx, after);
  return {
    summary: Object.assign({}, book.summary, { points: book.gained, battlePoints: book.battlePts, capped: book.capped < book.battlePts }),
    missionsCompleted: book.completed, missions: missionView(book.mState, book.day), profile: publicProfile(after, env), newRewards
  };
}

/** Duel classique ou SOLO contre un bot (difficulté). Le client n'envoie que ses choix. */
async function fight(req, env, ctx, sess) {
  const b = await body(req);
  const a = CHAR_BY_ID.get(String(b.fighterId || ''));
  if (!a) throw new HttpError(400, 'Combattant inconnu (combats classés : uniquement les 100 Neon Buddies).');
  const mode = b.mode === 'solo' ? 'solo' : 'duel';
  const diff = mode === 'solo' ? E.DIFFICULTIES[b.difficulty] : null;
  if (mode === 'solo' && !diff) throw new HttpError(400, 'Difficulté inconnue');
  let opp;
  if (mode === 'duel' && b.opponentId != null && b.opponentId !== '') {
    opp = CHAR_BY_ID.get(String(b.opponentId));
    if (!opp) throw new HttpError(400, 'Adversaire inconnu');
  } else opp = randomChar([a.id]); // en solo, le bot est toujours choisi par le serveur
  if (opp.id === a.id) throw new HttpError(400, 'Choisis deux personnages différents.');
  const p = await fightLock(env, ctx, sess.address);
  if (b.pvpFallback) await env.DB.prepare('DELETE FROM pvp_queue WHERE address = ?1 AND match_id IS NULL').bind(sess.address).run();
  const chars = await loadChars(env, sess.address, [a.id, opp.id]);
  const lvA = lvOf(chars, a.id);
  const lvB = diff ? E.botLevel(diff.id, lvA) : lvOf(chars, opp.id);
  const seed = rand32();
  const result = E.simulateBattle(a, lvA, opp, lvB, seed, diff ? { scaleB: diff.scale } : undefined);
  if (diff) result.fighters.B.bot = true;
  const out = await recordMatches(env, ctx, sess.address, p, [{ result, seed, persistOpp: !diff }], { mode, mult: diff ? diff.points : 1, knownChars: chars });
  return Object.assign({ seed, result, mode, difficulty: diff ? diff.id : null }, out);
}

/** BOSS du jour : tentatives limitées par jour, combat calculé par le serveur. */
async function bossFight(req, env, ctx, sess) {
  const b = await body(req);
  const a = CHAR_BY_ID.get(String(b.fighterId || ''));
  if (!a) throw new HttpError(400, 'Combattant inconnu');
  const max = num(env.BOSS_ATTEMPTS_PER_DAY, E.BOSS_ATTEMPTS_PER_DAY);
  const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart(Date.now())).first();
  if (used.n >= max) throw new HttpError(429, `Tentatives contre le boss épuisées pour aujourd’hui (${max}/${max}).`);
  const p = await fightLock(env, ctx, sess.address);
  const boss = E.dailyBoss(E.dayKey());
  const chars = await loadChars(env, sess.address, [a.id]);
  const lvA = lvOf(chars, a.id), seed = rand32();
  const result = E.simulateBattle(a, lvA, E.bossCharacter(boss, COLLECTION), E.bossLevel(lvA), seed, { boss });
  const out = await recordMatches(env, ctx, sess.address, p, [{ result, seed, persistOpp: false }], { mode: 'boss', points: E.bossPoints(result), knownChars: chars });
  return Object.assign({ seed, result, mode: 'boss', boss: { id: boss.id, name: boss.name, baseId: boss.baseId }, attemptsLeft: max - used.n - 1 }, out);
}
async function bossInfo(env, sess) {
  const boss = E.dailyBoss(E.dayKey()), max = num(env.BOSS_ATTEMPTS_PER_DAY, E.BOSS_ATTEMPTS_PER_DAY);
  let left = max;
  if (sess) { const u = await env.DB.prepare("SELECT COUNT(*) AS n FROM fights WHERE address = ?1 AND mode = 'boss' AND created_at >= ?2").bind(sess.address, dayStart(Date.now())).first(); left = Math.max(0, max - u.n); }
  return { boss: { id: boss.id, name: boss.name, baseId: boss.baseId, phases: boss.phases.length + 1 }, attemptsLeft: left, attemptsMax: max };
}

/** TOURNOI quotidien : 8 places (le joueur, des « fantômes » d'autres joueurs, des bots), calculé par le serveur. */
async function tournament(req, env, ctx, sess) {
  const b = await body(req);
  const a = CHAR_BY_ID.get(String(b.fighterId || ''));
  if (!a) throw new HttpError(400, 'Combattant inconnu');
  const day = E.dayKey(), max = num(env.TOURNAMENTS_PER_DAY, 1);
  const done = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE address = ?1 AND day = ?2').bind(sess.address, day).first();
  if (done.n >= max) throw new HttpError(429, 'Tu as déjà joué le tournoi du jour. Reviens demain !');
  const p = await fightLock(env, ctx, sess.address);
  const chars = await loadChars(env, sess.address, [a.id]);
  const lvA = lvOf(chars, a.id);
  const entrants = [{ ch: a, level: lvA, label: p.name || short(sess.address), player: true }];
  const ghosts = await env.DB.prepare('SELECT address, name, last_fighter, last_level FROM players WHERE address != ?1 AND last_fighter IS NOT NULL ORDER BY last_fight_at DESC LIMIT 3').bind(sess.address).all();
  for (const g of ghosts.results) {
    const ch = CHAR_BY_ID.get(g.last_fighter); if (!ch) continue;
    entrants.push({ ch, level: g.last_level, label: (g.name || short(g.address)) + ' (fantôme)' });
  }
  while (entrants.length < 8) {
    const ch = randomChar(entrants.map(e => e.ch.id));
    entrants.push({ ch, level: Math.max(1, lvA + (rand32() % 3) - 1), label: 'BOT ' + ch.name, bot: true });
  }
  // Placement aléatoire dans le tableau (choisi par le serveur)
  for (let i = entrants.length - 1; i > 0; i--) { const j = rand32() % (i + 1); [entrants[i], entrants[j]] = [entrants[j], entrants[i]]; }
  const seed = rand32();
  const t = E.runTournament(entrants, seed);
  const me = t.entrants.find(e => e.player).slot;
  const placement = t.placement[me], points = E.TOURNAMENT_POINTS[placement] || 0;
  const matches = [];
  t.rounds.forEach(r => r.matches.forEach(m => {
    if (m.a !== me && m.b !== me) return;
    matches.push({ result: m.a === me ? m.result : E.flipResult(m.result), seed });
  }));
  const out = await recordMatches(env, ctx, sess.address, p, matches, { mode: 'tournoi', points, knownChars: chars });
  const bracket = { rounds: t.rounds.map(r => ({ name: r.name, matches: r.matches.map(m => ({ a: m.a, b: m.b, winner: m.winner, turns: m.turns })) })), entrants: t.entrants, champion: t.champion, me };
  await env.DB.prepare('INSERT INTO tournaments (address, day, placement, points, bracket, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(sess.address, day, placement, points, JSON.stringify(bracket), Date.now()).run();
  return Object.assign({ seed, mode: 'tournoi', placement, tournamentPoints: points, bracket, matches: matches.map(m => m.result), result: matches[matches.length - 1].result }, out);
}

/* ---------- PvP en ligne : file d'attente D1 + sondage ---------- */
async function tryPair(env, ctx, sess, fighterId) {
  const now = Date.now(), timeout = num(env.PVP_TIMEOUT_SEC, 18) * 1000;
  const self = await env.DB.prepare('SELECT match_id FROM pvp_queue WHERE address = ?1').bind(sess.address).first();
  if (!self || self.match_id) return null;
  const cand = await env.DB.prepare('SELECT address, fighter_id FROM pvp_queue WHERE match_id IS NULL AND address != ?1 AND joined_at > ?2 ORDER BY joined_at LIMIT 1')
    .bind(sess.address, now - timeout - 5000).first();
  if (!cand) return null;
  const id = randomHex(12);
  // Les deux joueurs sont réservés dans le même UPDATE : un seul appariement gagne.
  const claimed = await env.DB.prepare('UPDATE pvp_queue SET match_id = ?1 WHERE match_id IS NULL AND address IN (?2, ?3)')
    .bind(id, cand.address, sess.address).run();
  if (!claimed.meta || claimed.meta.changes !== 2) {
    await env.DB.prepare('UPDATE pvp_queue SET match_id = NULL WHERE match_id = ?1 AND address IN (?2, ?3)').bind(id, cand.address, sess.address).run();
    return null;
  }
  try {
  const f1 = CHAR_BY_ID.get(cand.fighter_id), f2 = CHAR_BY_ID.get(fighterId);
  const c1 = await loadChars(env, cand.address, [f1.id]), c2 = await loadChars(env, sess.address, [f2.id]);
  const seed = rand32();
  const result = E.simulateBattle(f1, lvOf(c1, f1.id), f2, lvOf(c2, f2.id), seed);
  const p1 = await getPlayer(env, cand.address), p2 = await getPlayer(env, sess.address);
  result.fighters.A.owner = p1.name || short(p1.address); result.fighters.B.owner = p2.name || short(p2.address);
  const e = E.elo(p1.rating, p2.rating, result.winner === 'A' ? 1 : 0);
  const [book1, book2] = await Promise.all([
    recordMatches(env, ctx, cand.address, p1, [{ result, seed, persistOpp: false }], { mode: 'pvp', defer: true, knownChars: c1 }),
    recordMatches(env, ctx, sess.address, p2, [{ result: E.flipResult(result), seed, persistOpp: false }], { mode: 'pvp', defer: true, knownChars: c2 })
  ]);
  await commitProgress(env, [book1, book2], [
    env.DB.prepare('UPDATE players SET rating = ?1, pvp_wins = pvp_wins + ?2, pvp_losses = pvp_losses + ?3 WHERE address = ?4').bind(e.a, result.winner === 'A' ? 1 : 0, result.winner === 'A' ? 0 : 1, cand.address),
    env.DB.prepare('UPDATE players SET rating = ?1, pvp_wins = pvp_wins + ?2, pvp_losses = pvp_losses + ?3 WHERE address = ?4').bind(e.b, result.winner === 'B' ? 1 : 0, result.winner === 'B' ? 0 : 1, sess.address),
    env.DB.prepare('INSERT INTO pvp_matches (id, p1, p2, f1, f2, seed, winner, result, elo_delta, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
      .bind(id, cand.address, sess.address, f1.id, f2.id, seed, result.winner === 'A' ? cand.address : sess.address, JSON.stringify(result), e.delta, now),
    env.DB.prepare('DELETE FROM pvp_queue WHERE address = ?1').bind(sess.address)
  ]);
  await settleProgress(env, ctx, book1);
  const mine = await settleProgress(env, ctx, book2);
  return Object.assign({ status: 'matched', matchId: id, seed, result: E.flipResult(result), opponent: result.fighters.A.owner, ratingDelta: -e.delta, rating: e.b, mode: 'pvp' }, mine);
  } catch (e) {
    await env.DB.prepare('UPDATE pvp_queue SET match_id = NULL WHERE match_id = ?1').bind(id).run();
    throw e;
  }
}
async function pvpJoin(req, env, ctx, sess) {
  const b = await body(req);
  const f = CHAR_BY_ID.get(String(b.fighterId || ''));
  if (!f) throw new HttpError(400, 'Combattant inconnu');
  await rateLimit(env, 'pvpjoin:' + sess.address, 20, 60);
  await fightLock(env, ctx, sess.address);
  await env.DB.prepare('DELETE FROM pvp_queue WHERE joined_at < ?1 AND match_id IS NULL').bind(Date.now() - 120000).run();
  const existing = await env.DB.prepare('SELECT match_id FROM pvp_queue WHERE address = ?1').bind(sess.address).first();
  if (existing && existing.match_id) return pvpStatus(env, ctx, sess);
  if (existing) {
    await env.DB.prepare('UPDATE pvp_queue SET fighter_id = ?1, joined_at = ?2 WHERE address = ?3 AND match_id IS NULL').bind(f.id, Date.now(), sess.address).run();
  } else {
    await env.DB.prepare('INSERT INTO pvp_queue (address, fighter_id, joined_at, match_id) VALUES (?1, ?2, ?3, NULL)').bind(sess.address, f.id, Date.now()).run();
  }
  const m = await tryPair(env, ctx, sess, f.id);
  if (m) return m;
  return { status: 'waiting', timeoutSec: num(env.PVP_TIMEOUT_SEC, 18) };
}
async function pvpStatus(env, ctx, sess) {
  await rateLimit(env, 'pvppoll:' + sess.address, 120, 60);
  const q = await env.DB.prepare('SELECT * FROM pvp_queue WHERE address = ?1').bind(sess.address).first();
  if (!q) return { status: 'idle' };
  if (q.match_id) {
    const m = await env.DB.prepare('SELECT * FROM pvp_matches WHERE id = ?1').bind(q.match_id).first();
    if (!m) return { status: 'waiting' }; // match en cours d'enregistrement
    await env.DB.prepare('DELETE FROM pvp_queue WHERE address = ?1').bind(sess.address).run();
    const me = await getPlayer(env, sess.address);
    const result = JSON.parse(m.result);
    return { status: 'matched', matchId: m.id, seed: m.seed, result, opponent: result.fighters.B.owner, ratingDelta: m.elo_delta, rating: me.rating, profile: publicProfile(me, env), mode: 'pvp' };
  }
  const m = await tryPair(env, ctx, sess, q.fighter_id);
  if (m) return m;
  const waited = Math.floor((Date.now() - q.joined_at) / 1000), timeout = num(env.PVP_TIMEOUT_SEC, 18);
  if (waited >= timeout) return { status: 'timeout', waited, botOffer: true };
  return { status: 'waiting', waited, timeoutSec: timeout };
}

function missionView(state, day) {
  return E.dailyMissions(day).map(m => ({ id: m.id, text: m.text, target: m.target, points: m.points,
    progress: state && state.day === day ? (state.progress[m.id] || 0) : 0, done: !!(state && state.day === day && state.done[m.id]) }));
}

/* ---------- réclamation d'un NFT ---------- */
async function claim(env, ctx, sess, rewardId) {
  await rateLimit(env, 'claim:' + sess.address, 10, 3600);
  const r = await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(rewardId).first();
  if (!r || r.address !== sess.address) throw new HttpError(404, 'Récompense introuvable');
  const T = r.is_test ? '[TEST] ' : '';
  if (!r.is_test && isFounder(env, sess.address)) throw new HttpError(403, 'Réclamation réelle désactivée pour le fondateur : il détient déjà le stock. Utilise le mode test.');
  if (!r.is_test && !realClaimsOn(env)) throw new HttpError(403, 'Réclamations réelles désactivées : aucun NFT ne sera réservé ni envoyé.');
  if (r.status !== 'earned') {
    await alertSuspicious(env, ctx, 'dbl:' + rewardId, `${T}Double réclamation refusée : ${short(sess.address)} a de nouveau réclamé « ${r.label} » (statut ${r.status}).`);
    throw new HttpError(409, 'Cette récompense a déjà été réclamée.');
  }
  const stock = rewardStock(env)[r.tier] || [];
  // Mode test : un numéro est affiché, jamais réservé (l'index unique ignore is_test = 1).
  if (r.is_test) {
    const tokenId = stock[0] || 1;
    const u = await env.DB.prepare("UPDATE rewards SET status = 'pending', token_id = ?1, claimed_at = ?2 WHERE id = ?3 AND address = ?4 AND status = 'earned' AND is_test = 1")
      .bind(tokenId, Date.now(), rewardId, sess.address).run();
    if (!u.meta.changes) {
      await alertSuspicious(env, ctx, 'dbl:' + rewardId, `${T}Double réclamation simultanée refusée pour ${short(sess.address)} (« ${r.label} »).`);
      throw new HttpError(409, 'Cette récompense a déjà été réclamée.');
    }
    await notify(env, ctx, 'claim', `${T}📨 Nouvelle demande de NFT : ${short(sess.address)} réclame le Neon Buddies #${String(tokenId).padStart(4, '0')} (${TIER_FR[r.tier]}, « ${r.label} »). Mode test : aucun NFT réel ne sera envoyé. Utilise /rewards ou l’espace admin pour valider.`, { adminLink: true });
    return rewardView(await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(rewardId).first());
  }
  if (!stock.length) {
    await notify(env, ctx, 'stock', `🚫 Stock épuisé au niveau ${TIER_FR[r.tier]} : ${short(sess.address)} n’a pas pu réclamer « ${r.label} ».`, { throttle: ['empty:' + r.tier, 3600] });
    throw new HttpError(409, 'Stock épuisé pour ce niveau de récompense. L\u2019administrateur a été prévenu.');
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const reserved = await reserveRealToken(env, rewardId, sess.address, stock);
      if (reserved === null) {
        const again = await env.DB.prepare('SELECT status FROM rewards WHERE id = ?1').bind(rewardId).first();
        if (!again || again.status !== 'earned') {
          await alertSuspicious(env, ctx, 'dbl:' + rewardId, `${T}Double réclamation simultanée refusée pour ${short(sess.address)} (« ${r.label} »).`);
          throw new HttpError(409, 'Cette récompense a déjà été réclamée.');
        }
        await notify(env, ctx, 'stock', `🚫 Stock épuisé au niveau ${TIER_FR[r.tier]} : ${short(sess.address)} n’a pas pu réclamer « ${r.label} ».`, { throttle: ['empty:' + r.tier, 3600] });
        throw new HttpError(409, 'Stock épuisé pour ce niveau de récompense. L\u2019administrateur a été prévenu.');
      }
      const saved = await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(rewardId).first();
      await notify(env, ctx, 'claim', `${T}📨 Nouvelle demande de NFT : ${short(sess.address)} réclame le Neon Buddies #${String(saved.token_id).padStart(4, '0')} (${TIER_FR[r.tier]}, « ${r.label} »). Utilise /rewards ou l’espace admin pour valider.`, { adminLink: true });
      const usedTier = await env.DB.prepare("SELECT COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 AND tier = ?1").bind(r.tier).first();
      const remain = Math.max(0, stock.length - usedTier.n);
      if (remain <= num(env.STOCK_LOW_THRESHOLD, 2)) await notify(env, ctx, 'stock', `📉 Stock bas : il reste ${remain} NFT disponible(s) au niveau ${TIER_FR[r.tier]}.`, { throttle: ['stock:' + r.tier + ':' + remain, 86400] });
      return rewardView(saved);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (!/UNIQUE/i.test(String(e && e.message || e))) throw e;
    }
  }
  throw new HttpError(503, 'Réessaie dans un instant.');
}

/** Une seule instruction : plus petit jeton libre du palier, puis pending. Pas de UNION géant (limite D1). */
async function reserveRealToken(env, rewardId, address, stock) {
  const ids = stock.filter(n => Number.isInteger(n) && n >= 1 && n <= 100);
  if (!ids.length) return null;
  const list = ids.join(',');
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

/* ---------- administration ---------- */
async function adminApprove(env, id) {
  const c = cfg(env);
  const r = await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(id).first();
  if (!r) throw new HttpError(404, 'Récompense introuvable');
  if (!r.is_test && !realClaimsOn(env)) throw new HttpError(403, 'Réclamations réelles désactivées : aucun transfert ne sera préparé ni envoyé.');
  if (r.status !== 'pending' && r.status !== 'approved') throw new HttpError(409, 'Statut actuel : ' + r.status);
  // Le jeton affiché en mode test n'est pas réservé : on ne bloque pas l'essai s'il n'est plus chez l'admin.
  if (!r.is_test && c.onchain) {
    const owner = await ownerOf(env, r.token_id);
    if (owner !== c.admin) throw new HttpError(409, `Le token #${r.token_id} n’appartient plus à l’administrateur (propriétaire : ${owner}).`);
  }
  await env.DB.prepare("UPDATE rewards SET status = 'approved', decided_at = ?1 WHERE id = ?2 AND status IN ('pending','approved')").bind(Date.now(), id).run();
  return { test: !!r.is_test, reward: rewardView(Object.assign(r, { status: 'approved' })), tx: { from: c.admin, to: c.contract, value: '0x0', chainId: '0x' + c.chainId.toString(16), data: encodeSafeTransferFrom(c.admin, r.address, r.token_id) } };
}
/* ---------- bot Telegram (webhook) ---------- */
/** Comparaison de secret : les deux valeurs sont hachées (taille fixe) puis comparées sans court-circuit sur la longueur. */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a ?? ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b ?? '')))
  ]);
  const left = new Uint8Array(ha), right = new Uint8Array(hb);
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(left, right);
  let d = 0;
  for (let i = 0; i < left.length; i++) d |= left[i] ^ right[i];
  return d === 0;
}
/** Chat privé de l'admin : l'expéditeur ET le chat doivent être l'id admin. Un membre d'un groupe ne suffit pas. */
function tgAdmin(env, fromId, chatId) {
  const adminChat = String(env.TELEGRAM_ADMIN_CHAT_ID || '');
  if (!adminChat) return false;
  return String(fromId ?? '') === adminChat && String(chatId ?? '') === adminChat;
}
async function stockLeft(env) {
  const stock = rewardStock(env);
  const used = await env.DB.prepare("SELECT tier, COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY tier").all();
  const usedBy = Object.fromEntries(used.results.map(r => [r.tier, r.n]));
  return Object.fromEntries(TIERS.map(t => [t, Math.max(0, stock[t].length - (usedBy[t] || 0))]));
}
function adminUrl(env) { return env.PUBLIC_SITE_URL ? env.PUBLIC_SITE_URL.replace(/#.*$/, '') + '#admin' : null; }

async function telegramWebhook(req, env, ctx) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || !(await safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.TELEGRAM_WEBHOOK_SECRET))) throw new HttpError(401, 'Non autorisé');
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: true };
  const u = await body(req);
  const send = (chat, text, extra) => tg(env, 'sendMessage', Object.assign({ chat_id: chat, text, disable_web_page_preview: true }, extra || {}));

  if (u.callback_query) {
    const q = u.callback_query, chat = q.message && q.message.chat && q.message.chat.id;
    if (!tgAdmin(env, q.from && q.from.id, chat)) { await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Non autorisé' }); return { ok: true }; }
    const mm = String(q.data || '').match(/^(ap|rj):(.+)$/);
    if (!mm) { await tg(env, 'answerCallbackQuery', { callback_query_id: q.id }); return { ok: true }; }
    let text;
    try {
      if (mm[1] === 'ap') {
        const out = await adminApprove(env, mm[2]);
        if (out.test) text = `[TEST] ✅ Demande de test approuvée (NFT #${String(out.reward.tokenId).padStart(4, '0')}). Lance la simulation du transfert dans l’espace admin — aucune transaction réelle${adminUrl(env) ? ' : ' + adminUrl(env) : '.'}`;
        else text = `✅ Demande approuvée : NFT #${String(out.reward.tokenId).padStart(4, '0')} pour ${short(out.reward.address)}.\nÉtape suivante : signe le transfert avec ton wallet dans l’espace admin${adminUrl(env) ? ' : ' + adminUrl(env) : ''}.`;
      } else {
        const r = await env.DB.prepare("UPDATE rewards SET status = 'rejected', note = 'Refusé via Telegram', decided_at = ?1 WHERE id = ?2 AND status IN ('earned','pending','approved')").bind(Date.now(), mm[2]).run();
        text = r.meta.changes ? '❌ Demande refusée : ' + mm[2] : 'Impossible de refuser (déjà traitée ?) : ' + mm[2];
      }
    } catch (e) { text = '⚠️ ' + (e.message || 'Erreur'); }
    await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, 190) });
    if (q.message) await tg(env, 'editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text, disable_web_page_preview: true });
    return { ok: true };
  }

  const msg = u.message;
  if (!msg || typeof msg.text !== 'string') return { ok: true };
  const chat = String(msg.chat && msg.chat.id), isAdmin = tgAdmin(env, msg.from && msg.from.id, chat);
  const cmd = msg.text.trim().split(/\s+/)[0].replace(/@.*$/, '').toLowerCase();
  const site = env.PUBLIC_SITE_URL || '';

  if (cmd === '/start') {
    if (isAdmin) {
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('tg_admin_chat', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(chat).run();
      await send(chat, '👋 Bonjour admin ! Ce chat est enregistré pour les alertes NEON BUDDIES ARENA.\nCommandes : /status, /rewards' + (adminUrl(env) ? '\nEspace admin : ' + adminUrl(env) : ''));
    } else {
      await send(chat, '👾 NEON BUDDIES — NFT BATTLE ARENA\nJeu de combat gratuit avec les 100 Neon Buddies 2. Aucun achat nécessaire.' + (site ? '\nJouer : ' + site : ''));
    }
    return { ok: true };
  }
  if (cmd === '/status' || cmd === '/rewards') {
    if (!isAdmin) { await send(chat, 'Commande réservée à l’administrateur.'); return { ok: true }; }
    if (cmd === '/status') {
      const counts = Object.fromEntries((await env.DB.prepare('SELECT status, COUNT(*) AS n FROM rewards GROUP BY status').all()).results.map(r => [r.status, r.n]));
      const players = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE battles > 0').first();
      const left = await stockLeft(env);
      const last = await env.DB.prepare("SELECT f.address, f.a, f.b, f.points, p.name FROM fights f LEFT JOIN players p ON p.address = f.address WHERE f.winner = 'A' ORDER BY f.id DESC LIMIT 5").all();
      const lines = last.results.map(r => `• ${r.name || short(r.address)} : #${r.a} bat #${r.b} (+${r.points})`).join('\n') || '• aucune';
      await send(chat, `📊 Statut\nDemandes en attente : ${counts.pending || 0} · approuvées (transfert à signer) : ${counts.approved || 0} · envoyées : ${counts.sent || 0}\n` +
        `Joueurs actifs : ${players.n}\nStock restant : ${TIERS.map(t => TIER_FR[t] + ' ' + left[t]).join(' · ')}\nDernières victoires :\n${lines}`);
      return { ok: true };
    }
    const rows = (await env.DB.prepare("SELECT * FROM rewards WHERE status = 'pending' ORDER BY claimed_at LIMIT 10").all()).results;
    if (!rows.length) { await send(chat, 'Aucune demande de NFT en attente. 🎉'); return { ok: true }; }
    for (const r of rows) {
      await send(chat, `${r.is_test ? '[TEST] ' : ''}📨 ${short(r.address)} — NFT #${String(r.token_id).padStart(4, '0')} (${TIER_FR[r.tier]})\n« ${r.label} »\nAdresse : ${r.address}`,
        { reply_markup: { inline_keyboard: [[{ text: '✅ Approuver', callback_data: 'ap:' + r.id }, { text: '❌ Refuser', callback_data: 'rj:' + r.id }]] } });
    }
    await send(chat, 'Après approbation, le transfert doit être signé avec ton wallet dans l’espace admin' + (adminUrl(env) ? ' : ' + adminUrl(env) : '.'));
    return { ok: true };
  }
  await send(chat, isAdmin ? 'Commandes : /status, /rewards' : 'Commande inconnue. Tape /start.');
  return { ok: true };
}

/** Mode test : simule le transfert en lecture seule sur le mainnet (eth_call + eth_estimateGas), sans aucune transaction. */
async function adminSimulate(env, ctx, id) {
  const c = cfg(env);
  const r = await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(id).first();
  if (!r) throw new HttpError(404, 'Récompense introuvable');
  if (!r.is_test) throw new HttpError(409, 'Simulation réservée aux récompenses de TEST.');
  if (r.status !== 'approved') throw new HttpError(409, 'Approuve d\u2019abord la demande.');
  const call = { from: c.admin, to: c.contract, data: encodeSafeTransferFrom(c.admin, r.address, r.token_id) };
  let ok = true, reason = '', gas = null;
  try { await rpc(env, 'eth_call', [call, 'latest']); } catch (e) { ok = false; reason = e.message; }
  if (ok) { try { gas = parseInt(await rpc(env, 'eth_estimateGas', [call]), 16); } catch (e) { gas = null; } }
  const note = ok ? `TEST — transfert simulé (eth_call OK${gas ? ', gaz estimé ' + gas : ''}). Aucun NFT envoyé.` : 'TEST — la simulation échoue : ' + reason;
  if (ok) await env.DB.prepare("UPDATE rewards SET status = 'sent', note = ?1, sent_at = ?2 WHERE id = ?3 AND status = 'approved' AND is_test = 1").bind(note, Date.now(), id).run();
  await notify(env, ctx, 'sent', `[TEST] ${ok ? '🧪 Transfert simulé' : '⚠️ Simulation en échec'} pour NFT #${String(r.token_id).padStart(4, '0')} → ${short(r.address)}. ${ok ? 'Aucune transaction réelle.' : reason}`);
  return { simulated: true, ok, gas, reason, reward: rewardView(await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(id).first()) };
}

async function adminTx(env, ctx, id, txHash) {
  const c = cfg(env);
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ''))) throw new HttpError(400, 'Hash de transaction invalide');
  txHash = lower(txHash);
  const r = await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(id).first();
  if (!r) throw new HttpError(404, 'Récompense introuvable');
  if (r.is_test) throw new HttpError(409, 'Récompense de TEST : utilise la simulation, aucune transaction réelle.');
  if (!realClaimsOn(env)) throw new HttpError(403, 'Réclamations réelles désactivées : aucune transaction ne peut être enregistrée.');
  if (r.status === 'sent') return { reward: rewardView(r), verified: true };
  if (r.status !== 'approved') throw new HttpError(409, 'Approuve d\u2019abord la demande.');
  const dup = await env.DB.prepare('SELECT id FROM rewards WHERE tx_hash = ?1').bind(txHash).first();
  if (dup) throw new HttpError(409, 'Cette transaction est déjà associée à une autre récompense.');
  const chain = await rpc(env, 'eth_chainId', []);
  if (parseInt(chain, 16) !== c.chainId) throw new HttpError(502, 'Mauvais réseau RPC');
  const rc = await rpc(env, 'eth_getTransactionReceipt', [txHash]);
  if (!rc) return { pending: true, message: 'Transaction pas encore confirmée, réessaie dans quelques secondes.' };
  if (rc.status !== '0x1') throw new HttpError(409, 'La transaction a échoué sur la blockchain.');
  const ok = (rc.logs || []).some(l => lower(l.address) === lower(c.contract) && l.topics && l.topics.length === 4 &&
    lower(l.topics[0]) === TRANSFER_TOPIC && lower(l.topics[1]) === addrTopic(c.admin) && lower(l.topics[2]) === addrTopic(r.address) && lower(l.topics[3]) === uintTopic(r.token_id));
  if (!ok) throw new HttpError(409, 'Aucun transfert correspondant (admin → joueur, bon token) dans cette transaction.');
  if (c.onchain) {
    const owner = await ownerOf(env, r.token_id);
    if (owner !== lower(r.address)) throw new HttpError(409, 'Le joueur n\u2019est pas (encore) propriétaire du token.');
  }
  const marked = await env.DB.prepare("UPDATE rewards SET status = 'sent', tx_hash = ?1, sent_at = ?2 WHERE id = ?3 AND status = 'approved'").bind(txHash, Date.now(), id).run();
  if (!marked.meta.changes) throw new HttpError(409, 'Cette récompense n\u2019est plus en attente d\u2019envoi.');
  await notify(env, ctx, 'sent', `✅ NFT #${String(r.token_id).padStart(4, '0')} envoyé à ${short(r.address)} — tx ${txHash}`);
  return { reward: rewardView(await env.DB.prepare('SELECT * FROM rewards WHERE id = ?1').bind(id).first()), verified: true };
}

/* ---------- routeur ---------- */
async function route(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ''), m = req.method;
  const c = cfg(env);
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  if (!c.admin || !isAddress(c.admin)) throw new HttpError(500, 'ADMIN_ADDRESS non configurée');

  if (m === 'POST' && path === '/telegram/webhook') return telegramWebhook(req, env, ctx);

  if (m === 'GET' && path === '/api/health') {
    await rateLimit(env, 'health:' + ip, 120, 60);
    return { ok: true, chainId: c.chainId, contract: c.contract, admin: c.admin, day: E.dayKey(), realClaims: c.realClaims, audited: false, v2Scheduler: String(env.V2_SCHEDULER || '') === '1' };
  }

  if (m === 'GET' && path === '/api/config') {
    await rateLimit(env, 'cfg:' + ip, 60, 60);
    const stock = rewardStock(env);
    const used = await env.DB.prepare("SELECT tier, COUNT(*) AS n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY tier").all();
    const usedBy = Object.fromEntries(used.results.map(r => [r.tier, r.n]));
    return { chainId: c.chainId, contract: c.contract, admin: c.admin, day: E.dayKey(), missions: missionView(null, E.dayKey()),
      rules: REWARD_RULES.map(r => ({ id: r.id, tier: r.tier, tierFr: TIER_FR[r.tier], label: r.label, value: r.value, stat: r.stat })),
      stock: Object.fromEntries(TIERS.map(t => [t, Math.max(0, stock[t].length - (usedBy[t] || 0))])), dailyCap: c.dailyCap, realClaims: c.realClaims, audited: false };
  }

  if (m === 'POST' && path === '/api/auth/nonce') {
    await rateLimit(env, 'nonce:' + ip, 20, 60);
    const b = await body(req);
    if (!isAddress(b.address)) throw new HttpError(400, 'Adresse invalide');
    const origin = req.headers.get('Origin');
    const uri = origin && c.origins.includes(origin) ? origin : (c.origins[0] || url.origin);
    const domain = new URL(uri).host;
    const nonce = randomHex(16), now = Date.now();
    const message = buildMessage(domain, uri, b.address, nonce, c.chainId, new Date(now).toISOString(), new Date(now + NONCE_TTL).toISOString());
    await env.DB.prepare('DELETE FROM nonces WHERE expires_at < ?1').bind(now).run();
    await env.DB.prepare('INSERT INTO nonces (nonce, address, message, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(nonce, lower(b.address), message, now + NONCE_TTL).run();
    return { nonce, message };
  }

  if (m === 'POST' && path === '/api/auth/verify') {
    await rateLimit(env, 'verify:' + ip, 20, 60);
    const b = await body(req);
    if (!isAddress(b.address) || typeof b.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(b.nonce) || typeof b.signature !== 'string') throw new HttpError(400, 'Requête invalide');
    // Le nonce est consommé immédiatement (usage unique => pas de rejeu possible).
    const n = await env.DB.prepare('DELETE FROM nonces WHERE nonce = ?1 RETURNING address, message, expires_at').bind(b.nonce).first();
    if (!n || n.address !== lower(b.address) || n.expires_at < Date.now()) throw new HttpError(401, 'Nonce invalide ou expiré');
    if (!(await verifySignature(env, b.address, n.message, b.signature))) {
      await alertSuspicious(env, ctx, 'sig:' + ip, `Signature de connexion invalide pour ${short(lower(b.address))}${lower(b.address) === c.admin ? ' (adresse ADMIN !)' : ''}.`);
      throw new HttpError(401, 'Signature invalide');
    }
    const address = lower(b.address), token = randomHex(32), isAdmin = address === c.admin ? 1 : 0;
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(Date.now()).run();
    await env.DB.prepare('INSERT INTO sessions (token_hash, address, is_admin, expires_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(await sha256Hex(token), address, isAdmin, Date.now() + SESSION_TTL).run();
    await getPlayer(env, address);
    return { token, address, isAdmin: !!isAdmin, expiresAt: Date.now() + SESSION_TTL };
  }

  if (m === 'POST' && path === '/api/auth/logout') {
    const h = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (/^[0-9a-f]{64}$/.test(h)) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(h)).run();
    return { ok: true };
  }

  if (m === 'GET' && path === '/api/leaderboard') {
    await rateLimit(env, 'lb:' + ip, 60, 60);
    const elo = url.searchParams.get('type') === 'elo';
    const rows = await env.DB.prepare('SELECT address, name, points, wins, losses, best_streak, rating, pvp_wins, pvp_losses FROM players WHERE ' + (elo ? '(pvp_wins + pvp_losses) > 0 ORDER BY rating DESC, pvp_wins DESC' : 'battles > 0 ORDER BY points DESC, wins DESC') + ', address LIMIT 50').all();
    return { type: elo ? 'elo' : 'points', players: rows.results.map((r, i) => ({ rank: i + 1, founder: isFounder(env, r.address), address: r.address, name: r.name, points: r.points, wins: r.wins, losses: r.losses, bestStreak: r.best_streak, rating: r.rating, pvpWins: r.pvp_wins, pvpLosses: r.pvp_losses })) };
  }

  if (m === 'GET' && path === '/api/me') {
    const s = await auth(req, env);
    const p = await getPlayer(env, s.address), day = E.dayKey();
    const mrow = await env.DB.prepare('SELECT state FROM missions WHERE address = ?1 AND day = ?2').bind(s.address, day).first();
    const rw = await env.DB.prepare('SELECT * FROM rewards WHERE address = ?1 ORDER BY earned_at DESC').bind(s.address).all();
    const ch = await env.DB.prepare('SELECT char_id, xp, wins, losses FROM char_progress WHERE address = ?1').bind(s.address).all();
    return { profile: publicProfile(p, env), isAdmin: !!s.is_admin, missions: missionView(mrow ? JSON.parse(mrow.state) : null, day),
      rewards: rw.results.map(rewardView), chars: Object.fromEntries(ch.results.map(r => [r.char_id, { xp: r.xp, wins: r.wins, losses: r.losses }])),
      rules: REWARD_RULES.map(r => ({ id: r.id, tier: r.tier, tierFr: TIER_FR[r.tier], label: r.label, value: r.value, stat: r.stat, current: p[r.stat] || 0 })) };
  }

  if (m === 'POST' && path === '/api/me/name') {
    const s = await auth(req, env);
    const b = await body(req);
    const name = String(b.name || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 20) || null;
    await env.DB.prepare('UPDATE players SET name = ?1 WHERE address = ?2').bind(name, s.address).run();
    return { name };
  }

  if (m === 'POST' && path === '/api/fight') return fight(req, env, ctx, await auth(req, env));
  if (m === 'POST' && path === '/api/boss') return bossFight(req, env, ctx, await auth(req, env));
  if (m === 'GET' && path === '/api/boss') { await rateLimit(env, 'bossinfo:' + ip, 60, 60); let s0 = null; try { s0 = await auth(req, env); } catch (e) { /* anonyme */ } return bossInfo(env, s0); }
  if (m === 'POST' && path === '/api/tournament') return tournament(req, env, ctx, await auth(req, env));
  if (m === 'GET' && path === '/api/tournament/results') {
    await rateLimit(env, 'tourres:' + ip, 60, 60);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('day') || '') ? url.searchParams.get('day') : E.dayKey();
    const rows = await env.DB.prepare('SELECT t.address, p.name, t.placement, t.points, t.created_at FROM tournaments t LEFT JOIN players p ON p.address = t.address WHERE t.day = ?1 ORDER BY t.placement, t.created_at LIMIT 50').bind(day).all();
    return { day, results: rows.results.map(r => ({ address: r.address, name: r.name, placement: r.placement, points: r.points, founder: isFounder(env, r.address) })) };
  }
  if (m === 'POST' && path === '/api/pvp/join') return pvpJoin(req, env, ctx, await auth(req, env));
  if (m === 'GET' && path === '/api/pvp/status') return pvpStatus(env, ctx, await auth(req, env));
  if (m === 'POST' && path === '/api/pvp/leave') { const s0 = await auth(req, env); await env.DB.prepare('DELETE FROM pvp_queue WHERE address = ?1 AND match_id IS NULL').bind(s0.address).run(); return { ok: true }; }

  let mm;
  if (m === 'POST' && (mm = path.match(/^\/api\/rewards\/([^/]+)\/claim$/))) return claim(env, ctx, await auth(req, env), decodeURIComponent(mm[1]));

  if (path.startsWith('/api/admin/')) {
    const s = await auth(req, env, true);
    if (m === 'GET' && path === '/api/admin/summary') {
      const counts = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM rewards GROUP BY status').all();
      const notes = await env.DB.prepare('SELECT id, kind, text, created_at, seen FROM notifications ORDER BY id DESC LIMIT 30').all();
      const unseen = await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE seen = 0').first();
      return { counts: Object.fromEntries(counts.results.map(r => [r.status, r.n])), unseen: unseen.n, notifications: notes.results, telegram: tgEnabled(env) };
    }
    if (m === 'POST' && path === '/api/admin/notifications/seen') { await env.DB.prepare('UPDATE notifications SET seen = 1').run(); return { ok: true }; }
    if (m === 'GET' && path === '/api/admin/rewards') {
      const st = url.searchParams.get('status');
      const q = st ? env.DB.prepare('SELECT * FROM rewards WHERE status = ?1 ORDER BY COALESCE(claimed_at, earned_at) DESC LIMIT 200').bind(st)
                   : env.DB.prepare('SELECT * FROM rewards ORDER BY COALESCE(sent_at, decided_at, claimed_at, earned_at) DESC LIMIT 200');
      return { rewards: (await q.all()).results.map(rewardView) };
    }
    if (m === 'POST' && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/approve$/))) return adminApprove(env, decodeURIComponent(mm[1]));
    if (m === 'POST' && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/reject$/))) {
      const b = await body(req);
      const u = await env.DB.prepare("UPDATE rewards SET status = 'rejected', note = ?1, decided_at = ?2 WHERE id = ?3 AND status IN ('earned','pending','approved')")
        .bind(String(b.note || '').slice(0, 200), Date.now(), decodeURIComponent(mm[1])).run();
      if (!u.meta.changes) throw new HttpError(409, 'Impossible de refuser cette récompense (déjà envoyée ou introuvable).');
      return { ok: true };
    }
    if (m === 'POST' && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/simulate$/))) return adminSimulate(env, ctx, decodeURIComponent(mm[1]));
    if (m === 'POST' && path === '/api/admin/test-mode') {
      const b = await body(req);
      const addr = b.address ? lower(b.address) : s.address;
      if (!isAddress(addr)) throw new HttpError(400, 'Adresse invalide');
      await getPlayer(env, addr);
      await env.DB.prepare('UPDATE players SET test_mode = ?1 WHERE address = ?2').bind(b.enabled ? 1 : 0, addr).run();
      return { address: addr, testMode: !!b.enabled };
    }
    if (m === 'POST' && (mm = path.match(/^\/api\/admin\/rewards\/([^/]+)\/tx$/))) return adminTx(env, ctx, decodeURIComponent(mm[1]), (await body(req)).txHash);
    if (m === 'POST' && path === '/api/admin/grant') {
      const b = await body(req);
      if (!isAddress(b.address)) throw new HttpError(400, 'Adresse invalide');
      const label = String(b.label || 'Récompense spéciale').slice(0, 80);
      const test = b.test ? 1 : 0;
      if (!test && !realClaimsOn(env)) throw new HttpError(403, 'Réclamations réelles désactivées : seule une récompense de TEST peut être attribuée.');
      if (!test && isFounder(env, b.address)) throw new HttpError(403, 'Le fondateur détient déjà le stock : seule une récompense de TEST peut lui être attribuée.');
      const tier = TIERS.includes(b.tier) ? b.tier : 'Special';
      const id = (test ? 'test:' : '') + 'special-' + randomHex(4) + ':' + lower(b.address);
      await getPlayer(env, lower(b.address));
      await env.DB.prepare("INSERT INTO rewards (id, address, rule_id, tier, label, earned_at, is_test) VALUES (?1, ?2, 'special', ?3, ?4, ?5, ?6)").bind(id, lower(b.address), tier, label, Date.now(), test).run();
      await notify(env, ctx, 'earned', `${test ? '[TEST] ' : ''}⭐ Récompense ${TIER_FR[tier]} attribuée à ${short(lower(b.address))} : ${label}`);
      return { id, test: !!test };
    }
  }
  if (path.startsWith('/api/v2') || path.startsWith('/api/admin/v2')) {
    const { communityRoute } = await import('./community.js');
    return communityRoute(req, env, ctx, url, { auth, rateLimit, body, getPlayer, isFounder, ownerOf, num, short });
  }
  throw new HttpError(404, 'Route inconnue');
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const data = await route(req, env, ctx);
      return json(data, data && data.pending ? 202 : 200, cors);
    } catch (e) {
      if (e instanceof HttpError || (e && e.httpError)) return json({ error: e.message }, e.status, cors);
      console.error(JSON.stringify({ message: 'request failed', error: String(e && e.message || e) }));
      return json({ error: 'Erreur serveur' }, 500, cors);
    }
  },
  async scheduled(_event, env, ctx) {
    const job = import('./community.js').then(m => m.runScheduler(env, null, { force: true }));
    ctx.waitUntil(job);
  }
};
