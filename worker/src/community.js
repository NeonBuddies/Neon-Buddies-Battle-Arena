/* Communauté V2. Le Worker est la source de vérité.
   Chat par sondage (pas de WebSocket : offre gratuite, voir schedule.cron.toml).
   Les points, l'XP, les raids, les guildes et le tournoi live ne sont pas décidés par le client. */
import E from '../../js/engine.js';
import { COLLECTION } from './config.js';
import { isAddress, lower, randomHex, sha256Hex } from './crypto.js';
import {
  LOGOS, RAID_SPECS, schedulerEnabled, capDamage, cleanLabel, cleanMessage,
  isoWeek, saturdayWindow, weekStart
} from './v2text.js';

const CHAR = new Map(COLLECTION.map(c => [c.id, c]));
const PRESENCE_MS = 45000;
const AWAY_MS = 40000;

export class V2Error extends Error {
  constructor(status, msg) { super(msg); this.status = status; this.httpError = true; }
}

function assertOrigin(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) throw new V2Error(403, 'Origine refusée');
}

function compact(res) {
  const slim = f => ({ id: f.id, name: f.name, level: f.level, hp: f.hp, maxHp: f.maxHp, rarity: f.rarity });
  return { winner: res.winner, turns: res.turns, damageToB: res.damageToB, fighters: { A: slim(res.fighters.A), B: slim(res.fighters.B) } };
}

async function levelOf(env, address, id) {
  const r = await env.DB.prepare('SELECT xp FROM char_progress WHERE address = ?1 AND char_id = ?2').bind(address, id).first();
  return E.levelFromXp(r ? r.xp : 0).level;
}

async function addXp(env, address, charId, xp, win) {
  if (!charId || String(address).startsWith('bot:')) return;
  const week = isoWeek(Date.now());
  const w = win === true ? 1 : 0, l = win === false ? 1 : 0;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO char_progress (address, char_id, xp, wins, losses) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(address, char_id) DO UPDATE SET xp = xp + excluded.xp, wins = wins + excluded.wins, losses = losses + excluded.losses`)
      .bind(address, charId, xp, w, l),
    env.DB.prepare(`INSERT INTO fighter_week (week, char_id, xp) VALUES (?1, ?2, ?3)
      ON CONFLICT(week, char_id) DO UPDATE SET xp = xp + excluded.xp`).bind(week, charId, xp)
  ]);
}

/** Une instance de récompense (id) est créditée une seule fois par compte.
    L’id inclut l’adresse, jamais le personnage. Un autre combattant, un rechargement
    ou deux requêtes simultanées ne paient pas une deuxième fois.
    Une quête du lendemain ou un événement de la semaine suivante a un autre id : elle peut revenir. */
async function grantOnce(env, id, address, points, reason, nft) {
  if (String(address).startsWith('bot:')) return false;
  const now = Date.now(), week = isoWeek(now);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO point_grants (id, address, points, reason, nft_eligible, granted, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)`).bind(id, address, points, reason, nft ? 1 : 0, now).run();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO player_stats (address, community_points, week, week_points) VALUES (?1, 0, ?2, 0)'
  ).bind(address, week).run();
  const row = await env.DB.prepare('SELECT points, granted FROM point_grants WHERE id = ?1').bind(id).first();
  if (!row || row.granted) return false;
  await env.DB.batch([
    env.DB.prepare(`UPDATE player_stats SET
        community_points = community_points + ?1,
        week_points = CASE WHEN week = ?2 THEN week_points + ?1 ELSE ?1 END,
        week = ?2
      WHERE address = ?3 AND EXISTS (SELECT 1 FROM point_grants WHERE id = ?4 AND granted = 0)`)
      .bind(row.points, week, address, id),
    env.DB.prepare('UPDATE point_grants SET granted = 1 WHERE id = ?1 AND granted = 0').bind(id)
  ]);
  return true;
}

async function badge(env, address, id) {
  await env.DB.prepare('INSERT OR IGNORE INTO badges (address, badge_id, earned_at) VALUES (?1, ?2, ?3)')
    .bind(address, id, Date.now()).run();
}

async function touchProfile(env, address) {
  await env.DB.prepare(
    'INSERT INTO profiles (address, presence_at, away, avatar_verified) VALUES (?1, ?2, 0, 0) ON CONFLICT(address) DO NOTHING'
  ).bind(address, 0).run();
}

function presenceOf(row, now) {
  if (!row || !row.presence_at) return 'offline';
  const age = now - row.presence_at;
  if (age > PRESENCE_MS) return 'offline';
  if (row.away || age > AWAY_MS) return 'away';
  return 'online';
}

async function readSchedule(env, now) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'v2_schedule'").first();
  if (row && row.value) {
    try {
      const o = JSON.parse(row.value);
      const size = [2, 4, 8].includes(Number(o.size)) ? Number(o.size) : 8;
      if (Number.isFinite(o.opensAt) && Number.isFinite(o.startsAt) && o.startsAt >= o.opensAt) {
        return { opensAt: o.opensAt, startsAt: o.startsAt, size, source: 'admin-override' };
      }
    } catch (e) { /* calendrier par défaut */ }
  }
  return saturdayWindow(now);
}

async function communityPoints(env, address) {
  const s = await env.DB.prepare('SELECT community_points, week, week_points FROM player_stats WHERE address = ?1').bind(address).first();
  const week = isoWeek(Date.now());
  return { communityPoints: s ? s.community_points : 0, weekPoints: s && s.week === week ? s.week_points : 0 };
}

/* ---------- scheduler ---------- */
export async function runScheduler(env, deps, opts) {
  opts = opts || {};
  if (!schedulerEnabled(env)) return { enabled: false, pendingCodes: ['scheduler-off'] };
  const now = Date.now();
  if (!opts.force) {
    const lock = await env.DB.prepare("SELECT value FROM settings WHERE key = 'v2_tick_at'").first();
    if (lock && now - Number(lock.value) < 5000) return { enabled: true, skipped: true, week: isoWeek(now) };
  }
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('v2_tick_at', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(String(now)).run();
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('v2_week', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(isoWeek(now)).run();
  await ensureRaids(env, now);
  await ensureTournament(env, now);
  await advanceTournament(env, now);
  return { enabled: true, pendingCodes: [], week: isoWeek(now) };
}

async function ensureRaids(env, now) {
  const week = isoWeek(now);
  const closes = weekStart(now) + 7 * 86400000;
  for (const [diff, spec] of Object.entries(RAID_SPECS)) {
    const boss = E.BOSSES[spec.boss];
    const id = 'raid:' + week + ':' + diff;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO raids (id, week, difficulty, boss_name, base_id, hp_max, hp_left, cap, points, nft, status, source, closes_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8, ?9, 'open', 'schedule', ?10)`
    ).bind(id, week, diff, boss.name, boss.baseId, spec.hp, spec.cap, spec.points, spec.nft ? 1 : 0, closes).run();
    if (now >= closes) {
      await env.DB.prepare("UPDATE raids SET status = 'expired' WHERE id = ?1 AND status = 'open'").bind(id).run();
    }
  }
}

async function ensureTournament(env, now) {
  const week = isoWeek(now);
  const id = 'live:' + week;
  const cfg = await readSchedule(env, now);
  const row = await env.DB.prepare('SELECT * FROM live_tournaments WHERE id = ?1').bind(id).first();
  if (!row) {
    await env.DB.prepare(
      `INSERT INTO live_tournaments (id, week, status, opens_at, starts_at, size, seed, created_at)
       VALUES (?1, ?2, 'scheduled', ?3, ?4, ?5, ?6, ?7)`
    ).bind(id, week, cfg.opensAt, cfg.startsAt, cfg.size, crypto.getRandomValues(new Uint32Array(1))[0], now).run();
    return;
  }
  if (row.status === 'scheduled' || row.status === 'open') {
    await env.DB.prepare("UPDATE live_tournaments SET opens_at = ?1, starts_at = ?2, size = ?3 WHERE id = ?4 AND status IN ('scheduled','open')")
      .bind(cfg.opensAt, cfg.startsAt, cfg.size, id).run();
  }
}

async function advanceTournament(env, now) {
  const id = 'live:' + isoWeek(now);
  let row = await env.DB.prepare('SELECT * FROM live_tournaments WHERE id = ?1').bind(id).first();
  if (!row) return;
  if (row.status === 'scheduled' && now >= row.opens_at) {
    await env.DB.prepare("UPDATE live_tournaments SET status = 'open' WHERE id = ?1 AND status = 'scheduled'").bind(id).run();
    row = await env.DB.prepare('SELECT * FROM live_tournaments WHERE id = ?1').bind(id).first();
  }
  if (row.status === 'open' && now >= row.starts_at) {
    const moved = await env.DB.prepare("UPDATE live_tournaments SET status = 'running' WHERE id = ?1 AND status = 'open'").bind(id).run();
    if (moved.meta.changes) await buildBracket(env, row);
    row = await env.DB.prepare('SELECT * FROM live_tournaments WHERE id = ?1').bind(id).first();
  }
  if (row.status === 'running') await playOne(env, row, now);
}

async function buildBracket(env, row) {
  const humans = (await env.DB.prepare('SELECT * FROM live_entries WHERE tournament_id = ?1 AND bot = 0 ORDER BY address').bind(row.id).all()).results;
  if (humans.length < 2) {
    const reason = humans.length === 0 ? 'empty' : 'insufficient';
    await env.DB.prepare("UPDATE live_tournaments SET status = 'cancelled', reason = ?1 WHERE id = ?2").bind(reason, row.id).run();
    return;
  }
  const size = row.size;
  const entrants = humans.slice(0, size);
  let n = 0;
  while (entrants.length < size) {
    n += 1;
    const ch = COLLECTION[(row.seed + n) % COLLECTION.length];
    const address = 'bot:' + row.id + ':' + n;
    const label = 'BOT';
    entrants.push({ address, fighter_id: ch.id, bot: 1, label });
    await env.DB.prepare(
      'INSERT OR IGNORE INTO live_entries (tournament_id, address, fighter_id, bot, label) VALUES (?1, ?2, ?3, 1, ?4)'
    ).bind(row.id, address, ch.id, label).run();
  }
  const rnd = E.rng(row.seed >>> 0);
  for (let i = entrants.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = entrants[i]; entrants[i] = entrants[j]; entrants[j] = tmp;
  }
  let matches = entrants.length / 2;
  for (let round = 0; matches >= 1; round++, matches /= 2) {
    for (let slot = 0; slot < matches; slot++) {
      const id = 'm:' + row.id + ':' + round + ':' + slot;
      let p1 = null, p2 = null, bot = 0;
      if (round === 0) {
        p1 = entrants[slot * 2].address;
        p2 = entrants[slot * 2 + 1].address;
        bot = (String(p1).startsWith('bot:') || String(p2).startsWith('bot:')) ? 1 : 0;
      }
      await env.DB.prepare(
        `INSERT OR IGNORE INTO live_matches (id, tournament_id, round, slot, p1, p2, status, bot)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7)`
      ).bind(id, row.id, round, slot, p1, p2, bot).run();
    }
  }
}

async function entry(env, tournamentId, address) {
  return env.DB.prepare('SELECT * FROM live_entries WHERE tournament_id = ?1 AND address = ?2').bind(tournamentId, address).first();
}

async function stale(env, address, now) {
  if (String(address).startsWith('bot:')) return false;
  const p = await env.DB.prepare('SELECT presence_at FROM profiles WHERE address = ?1').bind(address).first();
  return !p || now - p.presence_at > PRESENCE_MS;
}

async function playOne(env, row, now) {
  const m = await env.DB.prepare(
    `SELECT * FROM live_matches WHERE tournament_id = ?1 AND status = 'pending' AND p1 IS NOT NULL AND p2 IS NOT NULL
     ORDER BY round, slot LIMIT 1`).bind(row.id).first();
  if (!m) {
    const pending = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM live_matches WHERE tournament_id = ?1 AND status != 'done'").bind(row.id).first();
    const any = await env.DB.prepare('SELECT COUNT(*) AS n FROM live_matches WHERE tournament_id = ?1').bind(row.id).first();
    if (!any.n) return;
    if (!pending.n) await finishTournament(env, row);
    return;
  }
  const claim = await env.DB.prepare("UPDATE live_matches SET status = 'playing' WHERE id = ?1 AND status = 'pending'").bind(m.id).run();
  if (!claim.meta.changes) return;
  const e1 = await entry(env, row.id, m.p1);
  const e2 = await entry(env, row.id, m.p2);
  const bot = (e1 && e1.bot) || (e2 && e2.bot) || String(m.p1).startsWith('bot:') || String(m.p2).startsWith('bot:');
  const s1 = await stale(env, m.p1, now);
  const s2 = await stale(env, m.p2, now);
  let winner = m.p1, reason = bot ? 'bot' : 'play', summary = null, seed = 0;
  if (s1 || s2) {
    reason = 'disconnect';
    if (s1 && !s2) winner = m.p2;
    else if (s2 && !s1) winner = m.p1;
    else winner = m.p1 < m.p2 ? m.p2 : m.p1;
  } else {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const c1 = CHAR.get(e1.fighter_id), c2 = CHAR.get(e2.fighter_id);
    const lv1 = e1.bot ? 1 : await levelOf(env, m.p1, e1.fighter_id);
    const lv2 = e2.bot ? 1 : await levelOf(env, m.p2, e2.fighter_id);
    const res = E.simulateBattle(c1, lv1, c2, lv2, seed);
    summary = JSON.stringify(compact(res));
    winner = res.winner === 'A' ? m.p1 : m.p2;
    if (!e1.bot) await addXp(env, m.p1, e1.fighter_id, winner === m.p1 ? 40 : 15, winner === m.p1);
    if (!e2.bot) await addXp(env, m.p2, e2.fighter_id, winner === m.p2 ? 40 : 15, winner === m.p2);
    reason = bot ? 'bot' : 'play';
  }
  await env.DB.prepare(
    "UPDATE live_matches SET status = 'done', winner = ?1, seed = ?2, summary = ?3, bot = ?4, reason = ?5 WHERE id = ?6 AND status = 'playing'"
  ).bind(winner, seed, summary, bot ? 1 : 0, reason, m.id).run();
  const lastRound = Math.round(Math.log2(row.size)) - 1;
  if (m.round >= lastRound) {
    await finishTournament(env, row);
    return;
  }
  const parentSlot = Math.floor(m.slot / 2);
  const parentId = 'm:' + row.id + ':' + (m.round + 1) + ':' + parentSlot;
  if (m.slot % 2 === 0) {
    await env.DB.prepare('UPDATE live_matches SET p1 = ?1 WHERE id = ?2').bind(winner, parentId).run();
  } else {
    await env.DB.prepare('UPDATE live_matches SET p2 = ?1 WHERE id = ?2').bind(winner, parentId).run();
  }
  const parent = await env.DB.prepare('SELECT p1, p2 FROM live_matches WHERE id = ?1').bind(parentId).first();
  if (parent && parent.p1 && parent.p2) {
    const b = (String(parent.p1).startsWith('bot:') || String(parent.p2).startsWith('bot:')) ? 1 : 0;
    await env.DB.prepare('UPDATE live_matches SET bot = ?1 WHERE id = ?2').bind(b, parentId).run();
  }
}

async function finishTournament(env, row) {
  const marked = await env.DB.prepare("UPDATE live_tournaments SET status = 'complete' WHERE id = ?1 AND status = 'running'").bind(row.id).run();
  if (!marked.meta.changes) return;
  const finalRound = Math.round(Math.log2(row.size)) - 1;
  const fin = await env.DB.prepare('SELECT winner FROM live_matches WHERE tournament_id = ?1 AND round = ?2 AND slot = 0').bind(row.id, finalRound).first();
  if (!fin || !fin.winner || String(fin.winner).startsWith('bot:')) return;
  await grantOnce(env, 'live:' + row.id + ':' + fin.winner, fin.winner, 80, 'live-tournament', 1);
  await badge(env, fin.winner, 'tourney-winner');
}

/* ---------- routes ---------- */
export async function communityRoute(req, env, ctx, url, deps) {
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  if (!path.startsWith('/api/v2') && !path.startsWith('/api/admin/v2')) return undefined;
  if (m === 'POST') assertOrigin(req, env);
  const ip = req.headers.get('CF-Connecting-IP') || 'local';

  if (m === 'GET' && path === '/api/v2/home') {
    await deps.rateLimit(env, 'v2home:' + ip, 60, 60);
    let me = null;
    try { me = await deps.auth(req, env); } catch (e) { me = null; }
    const enabled = schedulerEnabled(env);
    return homePayload(env, me, { enabled, pendingCodes: enabled ? [] : ['scheduler-off'] });
  }
  if (m === 'POST' && path === '/api/v2/scheduler/tick') {
    const s = await deps.auth(req, env);
    await deps.rateLimit(env, 'v2tick:' + s.address, 40, 60);
    if (!schedulerEnabled(env)) return { enabled: false, pendingCodes: ['scheduler-off'] };
    return runScheduler(env, deps, { force: true });
  }

  if (m === 'GET' && path.startsWith('/api/v2/profile/')) {
    await deps.rateLimit(env, 'v2prof:' + ip, 60, 60);
    const addr = decodeURIComponent(path.slice('/api/v2/profile/'.length));
    if (!isAddress(addr)) throw new V2Error(400, 'Adresse invalide');
    const tokens = String(url.searchParams.get('tokens') || '').split(',').map(x => Number(x)).filter(n => Number.isInteger(n) && n >= 1 && n <= 100).slice(0, 3);
    return publicProfile(env, deps, lower(addr), tokens);
  }
  if (m === 'POST' && path === '/api/v2/profile') return saveProfile(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/presence') return setPresence(env, deps, await deps.auth(req, env), await deps.body(req));

  if (m === 'GET' && path === '/api/v2/guilds') {
    await deps.rateLimit(env, 'v2gl:' + ip, 60, 60);
    const rows = await env.DB.prepare('SELECT id, name, logo, points, wins, losses, week, week_points FROM guilds ORDER BY points DESC, name LIMIT 30').all();
    const week = isoWeek(Date.now());
    return { guilds: rows.results.map(g => ({ id: g.id, name: g.name, logo: g.logo, points: g.points, wins: g.wins, losses: g.losses, weekPoints: g.week === week ? g.week_points : 0 })) };
  }
  if (m === 'POST' && path === '/api/v2/guilds') return createGuild(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/guilds/join') return joinGuild(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/guilds/leave') return leaveGuild(env, await deps.auth(req, env));
  if (m === 'POST' && path === '/api/v2/guilds/role') return setRole(env, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/guilds/kick') return kickMember(env, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/guilds/battle') return guildBattle(env, deps, await deps.auth(req, env), await deps.body(req));
  let mm;
  if (m === 'GET' && (mm = path.match(/^\/api\/v2\/guilds\/([0-9a-f]{16})$/))) return guildView(env, mm[1]);

  if (m === 'POST' && path === '/api/v2/dm') return openDm(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/block') return blockUser(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/report') return reportMsg(env, deps, await deps.auth(req, env), await deps.body(req));
  if (mm = path.match(/^\/api\/v2\/chat\/(global|guild:[0-9a-f]{16}|dm:[0-9a-f]{32})$/)) {
    const channel = mm[1];
    if (m === 'GET') return listChat(env, deps, await deps.auth(req, env), channel, url);
    if (m === 'POST') return postChat(env, deps, await deps.auth(req, env), channel, await deps.body(req));
  }

  if (m === 'GET' && path === '/api/v2/friends') return listFriends(env, await deps.auth(req, env));
  if (m === 'POST' && path === '/api/v2/friends/request') return friendRequest(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/friends/respond') return friendRespond(env, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/friends/remove') return friendRemove(env, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/friends/challenge') return friendChallenge(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'POST' && path === '/api/v2/friends/challenge/accept') return friendAccept(env, deps, await deps.auth(req, env), await deps.body(req));

  if (m === 'GET' && path === '/api/v2/raids') return listRaids(env, deps, ip);
  if (m === 'POST' && (mm = path.match(/^\/api\/v2\/raids\/([^/]+)\/hit$/))) return raidHit(env, deps, await deps.auth(req, env), decodeURIComponent(mm[1]), await deps.body(req));

  if (m === 'GET' && path === '/api/v2/events') return listEvents(env, deps, await optionalAuth(deps, req, env));
  if (m === 'POST' && path === '/api/v2/events/claim') return claimEvent(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'GET' && path === '/api/v2/quests') return listQuests(env, await deps.auth(req, env));
  if (m === 'POST' && path === '/api/v2/quests/claim') return claimQuest(env, deps, await deps.auth(req, env), await deps.body(req));
  if (m === 'GET' && path === '/api/v2/badges') {
    const s = await deps.auth(req, env);
    const who = isAddress(url.searchParams.get('address') || '') ? lower(url.searchParams.get('address')) : s.address;
    const rows = await env.DB.prepare('SELECT badge_id, earned_at FROM badges WHERE address = ?1').bind(who).all();
    return { address: who, badges: rows.results };
  }
  if (m === 'GET' && path === '/api/v2/eligibility') return eligibility(env, await deps.auth(req, env));
  if (m === 'GET' && path === '/api/v2/ranks') return ranks(env, deps, ip, url);

  if (m === 'GET' && path === '/api/v2/tournament') return tournamentView(env, deps, await optionalAuth(deps, req, env));
  if (m === 'POST' && path === '/api/v2/tournament/join') return tournamentJoin(env, deps, await deps.auth(req, env), await deps.body(req));

  if (path.startsWith('/api/admin/v2')) {
    const s = await deps.auth(req, env, true);
    if (m === 'POST' && path === '/api/admin/v2/schedule') return adminSchedule(env, await deps.body(req));
    if (m === 'POST' && path === '/api/admin/v2/raid') return adminRaid(env, await deps.body(req));
    if (m === 'GET' && path === '/api/admin/v2/reports') return adminReports(env);
    if (m === 'POST' && path === '/api/admin/v2/mute') return adminMute(env, s, await deps.body(req));
    if (m === 'POST' && path === '/api/admin/v2/delete') return adminDelete(env, await deps.body(req));
    if (m === 'POST' && path === '/api/admin/v2/report') return adminCloseReport(env, await deps.body(req));
    if (m === 'GET' && path === '/api/admin/v2/eligibility') return adminEligibility(env);
  }
  throw new V2Error(404, 'Route inconnue');
}

async function optionalAuth(deps, req, env) {
  try { return await deps.auth(req, env); } catch (e) { return null; }
}

async function homePayload(env, sess, sched) {
  const codes = sched.pendingCodes || (sched.enabled ? [] : ['scheduler-off']);
  const base = {
    version: 2,
    transport: 'poll',
    websocket: false,
    scheduler: !!sched.enabled,
    pendingCodes: codes.concat(['poll-chat', 'nft-manual', 'v1-ghost-distinct', 'free-tier', 'chain-roster']),
    pollSeconds: 4,
    week: isoWeek(Date.now()),
    me: null
  };
  if (!sess) return base;
  const g = await env.DB.prepare('SELECT guild_id, role FROM guild_members WHERE address = ?1').bind(sess.address).first();
  const pts = await communityPoints(env, sess.address);
  base.me = { address: sess.address, guildId: g ? g.guild_id : null, role: g ? g.role : null, ...pts };
  return base;
}

async function publicProfile(env, deps, address, tokens) {
  const p = await env.DB.prepare('SELECT * FROM players WHERE address = ?1').bind(address).first();
  const prof = await env.DB.prepare('SELECT * FROM profiles WHERE address = ?1').bind(address).first();
  const g = await env.DB.prepare(
    `SELECT m.role, g.id, g.name, g.logo FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.address = ?1`
  ).bind(address).first();
  const chars = await env.DB.prepare('SELECT char_id, xp, wins, losses FROM char_progress WHERE address = ?1 ORDER BY xp DESC LIMIT 30').bind(address).all();
  const badges = await env.DB.prepare('SELECT badge_id FROM badges WHERE address = ?1').bind(address).all();
  const pts = await communityPoints(env, address);
  let best = { level: 1, xp: 0 };
  const roster = chars.results.map(c => {
    const lv = E.levelFromXp(c.xp);
    if (lv.level > best.level || (lv.level === best.level && c.xp > best.xp)) best = { level: lv.level, xp: c.xp };
    return { id: c.char_id, xp: c.xp, level: lv.level, wins: c.wins, losses: c.losses, source: 'game' };
  });
  const chain = [];
  for (const id of tokens) {
    try {
      const owner = await deps.ownerOf(env, id);
      chain.push({ tokenId: id, owned: owner === address, ownerKnown: true });
    } catch (e) {
      chain.push({ tokenId: id, owned: false, ownerKnown: false });
    }
  }
  const now = Date.now();
  return {
    address,
    founder: deps.isFounder(env, address),
    founderBonus: false,
    name: p ? p.name : null,
    wins: p ? p.wins : 0,
    losses: p ? p.losses : 0,
    battles: p ? p.battles : 0,
    arenaPoints: p ? p.points : 0,
    ...pts,
    level: best.level,
    guild: g ? { id: g.id, name: g.name, logo: g.logo, role: g.role } : null,
    avatar: prof && prof.avatar_id ? { id: prof.avatar_id, chainVerified: !!prof.avatar_verified, source: prof.avatar_verified ? 'chain' : 'cosmetic' } : null,
    roster,
    importedRoster: null,
    importedNote: 'local-only',
    chain,
    badges: badges.results.map(b => b.badge_id),
    presence: presenceOf(prof, now)
  };
}

async function saveProfile(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2profile:' + sess.address, 20, 60);
  await touchProfile(env, sess.address);
  let name = null;
  if (b.name != null) {
    name = cleanLabel(b.name, 2, 20);
    if (!name) throw new V2Error(400, 'Pseudo invalide');
    await env.DB.prepare('UPDATE players SET name = ?1 WHERE address = ?2').bind(name, sess.address).run();
  }
  let verified = 0, avatar = null;
  if (b.avatarId != null && b.avatarId !== '') {
    const n = Number(b.avatarId);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new V2Error(400, 'Avatar inconnu');
    avatar = String(n).padStart(4, '0');
    if (b.verify) {
      const owner = await deps.ownerOf(env, n);
      verified = owner === sess.address ? 1 : 0;
    }
    await env.DB.prepare('UPDATE profiles SET avatar_id = ?1, avatar_verified = ?2 WHERE address = ?3').bind(avatar, verified, sess.address).run();
  }
  return { name, avatar, chainVerified: !!verified, founderBonus: false };
}

async function setPresence(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2pres:' + sess.address, 40, 60);
  const away = b && b.away ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO profiles (address, presence_at, away, avatar_verified) VALUES (?1, ?2, ?3, 0)
     ON CONFLICT(address) DO UPDATE SET presence_at = excluded.presence_at, away = excluded.away`
  ).bind(sess.address, Date.now(), away).run();
  return { presence: away ? 'away' : 'online', address: sess.address };
}

async function createGuild(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2gcreate:' + sess.address, 3, 3600);
  const name = cleanLabel(b.name, 3, 24);
  if (!name) throw new V2Error(400, 'Nom de guilde invalide');
  if (!LOGOS.includes(b.logo)) throw new V2Error(400, 'Logo inconnu');
  const id = randomHex(8), now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO guilds (id, name, logo, owner, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, name, b.logo, sess.address, now),
      env.DB.prepare("INSERT INTO guild_members (guild_id, address, role, joined_at) VALUES (?1, ?2, 'owner', ?3)").bind(id, sess.address, now)
    ]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message || e))) throw new V2Error(409, 'Tu es déjà dans une guilde.');
    throw e;
  }
  await badge(env, sess.address, 'first-guild');
  return { id, name, logo: b.logo, role: 'owner' };
}

async function joinGuild(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2gjoin:' + sess.address, 20, 3600);
  const id = String(b.id || '');
  if (!/^[0-9a-f]{16}$/.test(id)) throw new V2Error(400, 'Guilde introuvable');
  const g = await env.DB.prepare('SELECT id FROM guilds WHERE id = ?1').bind(id).first();
  if (!g) throw new V2Error(404, 'Guilde introuvable');
  try {
    await env.DB.prepare("INSERT INTO guild_members (guild_id, address, role, joined_at) VALUES (?1, ?2, 'member', ?3)").bind(id, sess.address, Date.now()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message || e))) throw new V2Error(409, 'Tu es déjà dans une guilde.');
    throw e;
  }
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?1').bind(id).first();
  if (n.n > 20) {
    await env.DB.prepare('DELETE FROM guild_members WHERE guild_id = ?1 AND address = ?2').bind(id, sess.address).run();
    throw new V2Error(409, 'Guilde pleine.');
  }
  await badge(env, sess.address, 'first-guild');
  return { id, role: 'member' };
}

async function membership(env, address) {
  return env.DB.prepare('SELECT guild_id, role FROM guild_members WHERE address = ?1').bind(address).first();
}

async function leaveGuild(env, sess) {
  const m = await membership(env, sess.address);
  if (!m) throw new V2Error(404, 'Guilde introuvable');
  if (m.role === 'owner') {
    const others = await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?1 AND address != ?2').bind(m.guild_id, sess.address).first();
    if (others.n > 0) throw new V2Error(409, 'Le chef doit transmettre la guilde avant de partir.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM guild_members WHERE guild_id = ?1').bind(m.guild_id),
      env.DB.prepare('DELETE FROM guilds WHERE id = ?1').bind(m.guild_id)
    ]);
    return { ok: true, deleted: true };
  }
  await env.DB.prepare('DELETE FROM guild_members WHERE guild_id = ?1 AND address = ?2').bind(m.guild_id, sess.address).run();
  return { ok: true };
}

async function setRole(env, sess, b) {
  const m = await membership(env, sess.address);
  if (!m || m.role !== 'owner') throw new V2Error(403, 'Action réservée au chef de guilde.');
  const addr = lower(b.address || '');
  const role = b.role === 'officer' || b.role === 'member' || b.role === 'owner' ? b.role : '';
  if (!isAddress(addr) || !role || addr === sess.address) throw new V2Error(400, 'Rôle refusé');
  const target = await env.DB.prepare('SELECT role FROM guild_members WHERE guild_id = ?1 AND address = ?2').bind(m.guild_id, addr).first();
  if (!target) throw new V2Error(404, 'Joueur hors de la guilde');
  if (role === 'owner') {
    await env.DB.batch([
      env.DB.prepare("UPDATE guild_members SET role = 'owner' WHERE guild_id = ?1 AND address = ?2").bind(m.guild_id, addr),
      env.DB.prepare("UPDATE guild_members SET role = 'officer' WHERE guild_id = ?1 AND address = ?2").bind(m.guild_id, sess.address),
      env.DB.prepare('UPDATE guilds SET owner = ?1 WHERE id = ?2').bind(addr, m.guild_id)
    ]);
  } else {
    await env.DB.prepare('UPDATE guild_members SET role = ?1 WHERE guild_id = ?2 AND address = ?3').bind(role, m.guild_id, addr).run();
  }
  return { ok: true, role };
}

async function kickMember(env, sess, b) {
  const m = await membership(env, sess.address);
  if (!m || (m.role !== 'owner' && m.role !== 'officer')) throw new V2Error(403, 'Action réservée au chef de guilde.');
  const addr = lower(b.address || '');
  if (!isAddress(addr) || addr === sess.address) throw new V2Error(400, 'Rôle refusé');
  const target = await env.DB.prepare('SELECT role FROM guild_members WHERE guild_id = ?1 AND address = ?2').bind(m.guild_id, addr).first();
  if (!target) throw new V2Error(404, 'Joueur hors de la guilde');
  if (target.role === 'owner') throw new V2Error(403, 'Action réservée au chef de guilde.');
  if (m.role === 'officer' && target.role !== 'member') throw new V2Error(403, 'Les officiers ne peuvent exclure qu’un membre.');
  await env.DB.prepare('DELETE FROM guild_members WHERE guild_id = ?1 AND address = ?2 AND role != \'owner\'').bind(m.guild_id, addr).run();
  return { ok: true };
}

async function guildView(env, id) {
  const g = await env.DB.prepare('SELECT * FROM guilds WHERE id = ?1').bind(id).first();
  if (!g) throw new V2Error(404, 'Guilde introuvable');
  const members = await env.DB.prepare(
    `SELECT m.address, m.role, p.name FROM guild_members m LEFT JOIN players p ON p.address = m.address WHERE m.guild_id = ?1 ORDER BY m.joined_at`
  ).bind(id).all();
  const week = isoWeek(Date.now());
  return {
    id: g.id, name: g.name, logo: g.logo, points: g.points, wins: g.wins, losses: g.losses,
    weekPoints: g.week === week ? g.week_points : 0,
    members: members.results.map(x => ({ address: x.address, name: x.name, role: x.role }))
  };
}

async function guildBattle(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2gbattle:' + sess.address, 10, 3600);
  const me = await membership(env, sess.address);
  if (!me || (me.role !== 'owner' && me.role !== 'officer')) throw new V2Error(403, 'Action réservée au chef de guilde.');
  const other = String(b.guildId || '');
  const fa = CHAR.get(String(b.fighterId || ''));
  if (!fa || !/^[0-9a-f]{16}$/.test(other) || other === me.guild_id) throw new V2Error(400, 'Guilde introuvable');
  const g2 = await env.DB.prepare('SELECT * FROM guilds WHERE id = ?1').bind(other).first();
  if (!g2) throw new V2Error(404, 'Guilde introuvable');
  const opp = await env.DB.prepare(
    `SELECT cp.address, cp.char_id, cp.xp FROM char_progress cp
     JOIN guild_members m ON m.address = cp.address WHERE m.guild_id = ?1 ORDER BY cp.xp DESC LIMIT 1`
  ).bind(other).first();
  if (!opp) throw new V2Error(409, 'La guilde adverse n’a pas encore de combattant.');
  const fb = CHAR.get(opp.char_id);
  const day = E.dayKey();
  const pair = [me.guild_id, other].sort().join(':');
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const lvA = await levelOf(env, sess.address, fa.id);
  const lvB = E.levelFromXp(opp.xp).level;
  const res = E.simulateBattle(fa, lvA, fb, lvB, seed);
  const winnerGuild = res.winner === 'A' ? me.guild_id : other;
  const id = randomHex(8);
  const summary = JSON.stringify(compact(res));
  try {
    await env.DB.prepare(
      `INSERT INTO guild_battles (id, day, pair, guild_a, guild_b, fighter_a, fighter_b, seed, winner, summary, applied, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11)`
    ).bind(id, day, pair, me.guild_id, other, fa.id, fb.id, seed >>> 0, winnerGuild, summary, Date.now()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message || e))) throw new V2Error(409, 'Ces guildes se sont déjà battues aujourd’hui.');
    throw e;
  }
  const week = isoWeek(Date.now());
  const winPts = 25, losePts = 5;
  await env.DB.batch([
    env.DB.prepare(`UPDATE guilds SET points = points + ?1, wins = wins + 1,
      week_points = CASE WHEN week = ?2 THEN week_points + ?1 ELSE ?1 END, week = ?2
      WHERE id = ?3 AND EXISTS (SELECT 1 FROM guild_battles WHERE id = ?4 AND applied = 0)`).bind(winPts, week, winnerGuild, id),
    env.DB.prepare(`UPDATE guilds SET losses = losses + 1 WHERE id = ?1 AND EXISTS (SELECT 1 FROM guild_battles WHERE id = ?2 AND applied = 0)`)
      .bind(winnerGuild === me.guild_id ? other : me.guild_id, id),
    env.DB.prepare('UPDATE guild_battles SET applied = 1 WHERE id = ?1 AND applied = 0').bind(id)
  ]);
  await grantOnce(env, 'gbattle:' + id + ':' + sess.address, sess.address, res.winner === 'A' ? 20 : 8, 'guild-battle', 0);
  await addXp(env, sess.address, fa.id, res.winner === 'A' ? 35 : 12, res.winner === 'A');
  return { id, winner: winnerGuild, seed, summary: compact(res), mode: 'guild', resolution: 'arena-sim-once' };
}

async function canChat(env, address, channel) {
  if (channel === 'global') return true;
  if (channel.startsWith('guild:')) {
    const m = await env.DB.prepare('SELECT 1 AS n FROM guild_members WHERE guild_id = ?1 AND address = ?2').bind(channel.slice(6), address).first();
    return !!m;
  }
  if (channel.startsWith('dm:')) {
    const m = await env.DB.prepare('SELECT 1 AS n FROM channel_members WHERE channel_id = ?1 AND address = ?2').bind(channel, address).first();
    return !!m;
  }
  return false;
}

async function listChat(env, deps, sess, channel, url) {
  await deps.rateLimit(env, 'v2read:' + sess.address, 40, 60);
  if (!(await canChat(env, sess.address, channel))) throw new V2Error(403, 'Conversation interdite');
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  const rows = await env.DB.prepare(
    `SELECT id, address, body, created_at, deleted FROM messages
     WHERE channel_id = ?1 AND id > ?2
       AND address NOT IN (SELECT blocked FROM blocks WHERE address = ?3)
     ORDER BY id ASC LIMIT 50`
  ).bind(channel, after, sess.address).all();
  return {
    channel, transport: 'poll',
    messages: rows.results.map(r => ({ id: r.id, address: r.address, createdAt: r.created_at, deleted: !!r.deleted, body: r.deleted ? '' : r.body }))
  };
}

async function postChat(env, deps, sess, channel, b) {
  await deps.rateLimit(env, 'v2chat:' + sess.address, 8, 30);
  if (!(await canChat(env, sess.address, channel))) throw new V2Error(403, 'Conversation interdite');
  const mute = await env.DB.prepare('SELECT until_ts FROM mutes WHERE address = ?1').bind(sess.address).first();
  if (mute && mute.until_ts > Date.now()) throw new V2Error(403, 'Mute actif');
  const cleaned = cleanMessage(b.text);
  if (cleaned.error) throw new V2Error(400, cleaned.error);
  const last = await env.DB.prepare('SELECT body, created_at FROM messages WHERE channel_id = ?1 AND address = ?2 ORDER BY id DESC LIMIT 1').bind(channel, sess.address).first();
  if (last && last.body === cleaned.text && Date.now() - last.created_at < 20000) throw new V2Error(429, 'Message répété');
  const ins = await env.DB.prepare('INSERT INTO messages (channel_id, address, body, created_at) VALUES (?1, ?2, ?3, ?4) RETURNING id')
    .bind(channel, sess.address, cleaned.text, Date.now()).first();
  return { id: ins.id, channel, body: cleaned.text };
}

async function pair(a, b) {
  return [a, b].sort();
}

async function openDm(env, deps, sess, b) {
  const other = lower(b.address || '');
  if (!isAddress(other) || other === sess.address) throw new V2Error(400, 'Adresse invalide');
  const [a, c] = await pair(sess.address, other);
  const fr = await env.DB.prepare('SELECT status FROM friends WHERE a = ?1 AND b = ?2').bind(a, c).first();
  if (!fr || fr.status !== 'accepted') throw new V2Error(403, 'Vous n’êtes pas amis.');
  const block = await env.DB.prepare('SELECT 1 AS n FROM blocks WHERE (address = ?1 AND blocked = ?2) OR (address = ?2 AND blocked = ?1)').bind(sess.address, other).first();
  if (block) throw new V2Error(403, 'Conversation interdite');
  const channel = 'dm:' + (await sha256Hex(a + ':' + c)).slice(0, 32);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO channel_members (channel_id, address) VALUES (?1, ?2)').bind(channel, a),
    env.DB.prepare('INSERT OR IGNORE INTO channel_members (channel_id, address) VALUES (?1, ?2)').bind(channel, c)
  ]);
  return { channel };
}

async function blockUser(env, deps, sess, b) {
  const other = lower(b.address || '');
  if (!isAddress(other) || other === sess.address) throw new V2Error(400, 'Adresse invalide');
  if (b.unblock) await env.DB.prepare('DELETE FROM blocks WHERE address = ?1 AND blocked = ?2').bind(sess.address, other).run();
  else await env.DB.prepare('INSERT OR IGNORE INTO blocks (address, blocked, created_at) VALUES (?1, ?2, ?3)').bind(sess.address, other, Date.now()).run();
  return { ok: true };
}

async function reportMsg(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2report:' + sess.address, 10, 3600);
  const id = Number(b.messageId);
  if (!Number.isInteger(id)) throw new V2Error(400, 'Message introuvable');
  const msg = await env.DB.prepare('SELECT * FROM messages WHERE id = ?1').bind(id).first();
  if (!msg) throw new V2Error(404, 'Message introuvable');
  if (!(await canChat(env, sess.address, msg.channel_id))) throw new V2Error(403, 'Conversation interdite');
  const reason = cleanLabel(b.reason || 'signalement', 3, 80) || 'signalement';
  await env.DB.prepare('INSERT INTO reports (reporter, target, channel_id, message_id, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(sess.address, msg.address, msg.channel_id, id, reason, Date.now()).run();
  return { ok: true };
}

async function listFriends(env, sess) {
  const rows = await env.DB.prepare('SELECT * FROM friends WHERE a = ?1 OR b = ?1').bind(sess.address).all();
  const now = Date.now();
  const out = [];
  for (const r of rows.results) {
    const other = r.a === sess.address ? r.b : r.a;
    const p = await env.DB.prepare('SELECT name FROM players WHERE address = ?1').bind(other).first();
    const pr = await env.DB.prepare('SELECT presence_at, away FROM profiles WHERE address = ?1').bind(other).first();
    out.push({ address: other, name: p ? p.name : null, status: r.status, requester: r.requester, incoming: r.status === 'pending' && r.requester !== sess.address, presence: presenceOf(pr, now) });
  }
  return { friends: out };
}

async function friendRequest(env, deps, sess, b) {
  await deps.rateLimit(env, 'v2fr:' + sess.address, 20, 3600);
  const other = lower(b.address || '');
  if (!isAddress(other) || other === sess.address) throw new V2Error(400, 'Adresse invalide');
  const block = await env.DB.prepare('SELECT 1 AS n FROM blocks WHERE (address = ?1 AND blocked = ?2) OR (address = ?2 AND blocked = ?1)').bind(sess.address, other).first();
  if (block) throw new V2Error(403, 'Conversation interdite');
  await deps.getPlayer(env, other);
  const [a, c] = await pair(sess.address, other);
  try {
    await env.DB.prepare("INSERT INTO friends (a, b, status, requester, created_at) VALUES (?1, ?2, 'pending', ?3, ?4)")
      .bind(a, c, sess.address, Date.now()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message || e))) throw new V2Error(409, 'Demande déjà enregistrée.');
    throw e;
  }
  return { ok: true, status: 'pending' };
}

async function friendRespond(env, sess, b) {
  const other = lower(b.address || '');
  const [a, c] = await pair(sess.address, other);
  if (!b.accept) {
    await env.DB.prepare("DELETE FROM friends WHERE a = ?1 AND b = ?2 AND status = 'pending' AND requester != ?3").bind(a, c, sess.address).run();
    return { ok: true, status: 'declined' };
  }
  const u = await env.DB.prepare("UPDATE friends SET status = 'accepted' WHERE a = ?1 AND b = ?2 AND status = 'pending' AND requester != ?3")
    .bind(a, c, sess.address).run();
  if (!u.meta.changes) throw new V2Error(409, 'Demande introuvable.');
  await badge(env, sess.address, 'first-friend');
  await badge(env, other, 'first-friend');
  return { ok: true, status: 'accepted' };
}

async function friendRemove(env, sess, b) {
  const other = lower(b.address || '');
  const [a, c] = await pair(sess.address, other);
  await env.DB.prepare('DELETE FROM friends WHERE a = ?1 AND b = ?2').bind(a, c).run();
  return { ok: true };
}

async function friendChallenge(env, deps, sess, b) {
  const other = lower(b.address || '');
  const fa = CHAR.get(String(b.fighterId || ''));
  if (!fa || !isAddress(other)) throw new V2Error(400, 'Adresse invalide');
  const [a, c] = await pair(sess.address, other);
  const fr = await env.DB.prepare("SELECT status FROM friends WHERE a = ?1 AND b = ?2 AND status = 'accepted'").bind(a, c).first();
  if (!fr) throw new V2Error(403, 'Vous n’êtes pas amis.');
  const id = randomHex(8);
  await env.DB.prepare(
    "INSERT INTO friend_challenges (id, requester, target, fighter_a, status, created_at) VALUES (?1, ?2, ?3, ?4, 'pending', ?5)"
  ).bind(id, sess.address, other, fa.id, Date.now()).run();
  return { id, status: 'pending' };
}

async function friendAccept(env, deps, sess, b) {
  const id = String(b.id || '');
  const fb = CHAR.get(String(b.fighterId || ''));
  if (!fb || !/^[0-9a-f]{16}$/.test(id)) throw new V2Error(400, 'Défi introuvable');
  const lock = await env.DB.prepare(
    "UPDATE friend_challenges SET status = 'locked', fighter_b = ?1 WHERE id = ?2 AND target = ?3 AND status = 'pending'"
  ).bind(fb.id, id, sess.address).run();
  if (!lock.meta.changes) {
    const row = await env.DB.prepare('SELECT * FROM friend_challenges WHERE id = ?1').bind(id).first();
    if (row && row.status === 'done' && (row.target === sess.address || row.requester === sess.address)) {
      return { id, status: 'done', already: true, winner: row.winner };
    }
    throw new V2Error(409, 'Défi introuvable');
  }
  const ch = await env.DB.prepare('SELECT * FROM friend_challenges WHERE id = ?1').bind(id).first();
  const fa = CHAR.get(ch.fighter_a);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const lvA = await levelOf(env, ch.requester, fa.id);
  const lvB = await levelOf(env, ch.target, fb.id);
  const res = E.simulateBattle(fa, lvA, fb, lvB, seed);
  const winner = res.winner === 'A' ? ch.requester : ch.target;
  const summary = JSON.stringify(compact(res));
  const done = await env.DB.prepare(
    "UPDATE friend_challenges SET status = 'done', winner = ?1, seed = ?2, summary = ?3 WHERE id = ?4 AND status = 'locked'"
  ).bind(winner, seed >>> 0, summary, id).run();
  if (!done.meta.changes) throw new V2Error(409, 'Défi introuvable');
  await addXp(env, ch.requester, fa.id, winner === ch.requester ? 40 : 15, winner === ch.requester);
  await addXp(env, ch.target, fb.id, winner === ch.target ? 40 : 15, winner === ch.target);
  await grantOnce(env, 'friend:' + id + ':' + ch.requester, ch.requester, winner === ch.requester ? 25 : 8, 'friend-challenge', 0);
  await grantOnce(env, 'friend:' + id + ':' + ch.target, ch.target, winner === ch.target ? 25 : 8, 'friend-challenge', 0);
  return { id, status: 'done', winner, seed, summary: compact(res), resolution: 'arena-sim-once' };
}

async function listRaids(env, deps, ip) {
  await deps.rateLimit(env, 'v2raids:' + ip, 60, 60);
  if (!schedulerEnabled(env)) return { scheduler: false, pendingCodes: ['scheduler-off'], raids: [] };
  await runScheduler(env, deps, {});
  const week = isoWeek(Date.now());
  const rows = await env.DB.prepare('SELECT * FROM raids WHERE week = ?1 ORDER BY hp_max').bind(week).all();
  return {
    scheduler: true, pendingCodes: [],
    raids: rows.results.map(r => ({
      id: r.id, difficulty: r.difficulty, name: r.boss_name, baseId: r.base_id,
      hpMax: r.hp_max, hpLeft: r.hp_left, cap: r.cap, points: r.points, nft: !!r.nft,
      status: r.status, source: r.source, oneHitClears: r.cap >= r.hp_max
    }))
  };
}

async function raidHit(env, deps, sess, raidId, b) {
  await deps.rateLimit(env, 'v2hit:' + sess.address, 12, 60);
  const fighter = CHAR.get(String(b.fighterId || ''));
  if (!fighter) throw new V2Error(400, 'Combattant inconnu');
  const raid = await env.DB.prepare('SELECT * FROM raids WHERE id = ?1').bind(raidId).first();
  if (!raid) throw new V2Error(404, 'Raid introuvable');
  if (raid.source === 'schedule' && !schedulerEnabled(env)) throw new V2Error(403, 'Planificateur V2 inactif : événements, raids planifiés et tournoi automatique en attente.');
  if (raid.status !== 'open') throw new V2Error(409, 'Ce raid n’est plus ouvert.');
  const lv = await levelOf(env, sess.address, fighter.id);
  const boss = E.BOSSES.find(x => x.baseId === raid.base_id) || E.BOSSES[0];
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const sim = E.simulateBattle(fighter, lv, E.bossCharacter(boss, COLLECTION), Math.max(lv, 1), seed, { boss });
  const damage = capDamage(sim.damageToB, raid.cap);
  const guard = randomHex(8);
  const ins = await env.DB.prepare(
    `INSERT INTO raid_hits (raid_id, address, damage, seed, applied, created_at)
     SELECT ?1, ?2, ?3, ?4, 0, ?5 FROM raids WHERE id = ?1 AND status = 'open'
       AND NOT EXISTS (SELECT 1 FROM raid_hits WHERE raid_id = ?1 AND address = ?2)`
  ).bind(raid.id, sess.address, damage, seed >>> 0, Date.now()).run();
  if (!ins.meta.changes) throw new V2Error(409, 'Tu as déjà frappé ce boss.');
  let applied = null;
  for (let i = 0; i < 4; i++) {
    const cur = await env.DB.prepare('SELECT hp_left, status FROM raids WHERE id = ?1').bind(raid.id).first();
    if (!cur || cur.status !== 'open') break;
    const next = Math.max(0, cur.hp_left - damage);
    const status = next === 0 ? 'cleared' : 'open';
    const batch = await env.DB.batch([
      env.DB.prepare("UPDATE raids SET hp_left = ?1, status = ?2 WHERE id = ?3 AND status = 'open' AND hp_left = ?4")
        .bind(next, status, raid.id, cur.hp_left),
      env.DB.prepare("UPDATE raid_hits SET applied = 1 WHERE raid_id = ?1 AND address = ?2 AND applied = 0 AND EXISTS (SELECT 1 FROM raids WHERE id = ?1 AND hp_left = ?3 AND status = ?4)")
        .bind(raid.id, sess.address, next, status)
    ]);
    if (batch[0].meta.changes && batch[1].meta.changes) { applied = { hpLeft: next, status }; break; }
  }
  if (!applied) {
    await env.DB.prepare('DELETE FROM raid_hits WHERE raid_id = ?1 AND address = ?2 AND applied = 0').bind(raid.id, sess.address).run();
    throw new V2Error(409, 'Ce raid n’est plus ouvert.');
  }
  await addXp(env, sess.address, fighter.id, 30, false);
  await badge(env, sess.address, 'first-raid');
  let paid = false;
  if (applied.status === 'cleared') {
    paid = await payoutRaid(env, deps, raid);
    await badge(env, sess.address, 'raid-hero');
  }
  return {
    damage, cap: raid.cap, raw: sim.damageToB, hpLeft: applied.hpLeft, status: applied.status,
    founderBonus: false, seed, paid, resolution: 'arena-damage-capped'
  };
}

async function payoutRaid(env, deps, raid) {
  const hits = await env.DB.prepare('SELECT address FROM raid_hits WHERE raid_id = ?1 AND applied = 1').bind(raid.id).all();
  let n = 0;
  for (const h of hits.results) {
    const nft = raid.nft && !deps.isFounder(env, h.address);
    const ok = await grantOnce(env, 'raid:' + raid.id + ':' + h.address, h.address, raid.points, 'raid', nft);
    if (ok) n += 1;
  }
  return n;
}

function eventDefs(week) {
  return [
    { id: 'event:' + week + ':raid', metric: 'raid', points: 35, nft: false, title: 'Participe au raid de la semaine' },
    { id: 'event:' + week + ':guild', metric: 'guild', points: 50, nft: false, title: 'Gagne un combat de guilde cette semaine' },
    { id: 'event:' + week + ':legend', metric: 'legend', points: 80, nft: true, title: 'Inflige un coup à un raid légendaire vaincu' }
  ];
}

async function eventProgress(env, address, metric, week) {
  const start = weekStart(Date.now());
  if (metric === 'raid') {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM raid_hits WHERE address = ?1 AND applied = 1 AND created_at >= ?2').bind(address, start).first();
    return r.n >= 1;
  }
  if (metric === 'guild') {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM guild_battles b JOIN guild_members m ON m.address = ?1
       AND (m.guild_id = b.guild_a OR m.guild_id = b.guild_b) WHERE b.winner = m.guild_id AND b.created_at >= ?2`
    ).bind(address, start).first();
    return r.n >= 1;
  }
  if (metric === 'legend') {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM raid_hits h JOIN raids r ON r.id = h.raid_id
       WHERE h.address = ?1 AND h.applied = 1 AND r.difficulty = 'legend' AND r.status = 'cleared' AND r.week = ?2`
    ).bind(address, week).first();
    return r.n >= 1;
  }
  return false;
}

async function listEvents(env, deps, sess) {
  const week = isoWeek(Date.now());
  if (!schedulerEnabled(env)) return { scheduler: false, pendingCodes: ['scheduler-off'], events: [] };
  const events = [];
  for (const ev of eventDefs(week)) {
    const grant = sess ? await env.DB.prepare('SELECT granted, nft_eligible, points FROM point_grants WHERE id = ?1').bind(ev.id + ':' + sess.address).first() : null;
    const done = sess ? await eventProgress(env, sess.address, ev.metric, week) : false;
    events.push({ id: ev.id, title: ev.title, points: ev.points, nftEligible: ev.nft, done, claimed: !!(grant && grant.granted) });
  }
  return { scheduler: true, pendingCodes: [], week, events };
}

async function claimEvent(env, deps, sess, b) {
  if (!schedulerEnabled(env)) throw new V2Error(403, 'Planificateur V2 inactif : événements, raids planifiés et tournoi automatique en attente.');
  await runScheduler(env, deps, {});
  const week = isoWeek(Date.now());
  const ev = eventDefs(week).find(e => e.id === b.id);
  if (!ev) throw new V2Error(404, 'Événement introuvable');
  const existing = await env.DB.prepare('SELECT granted FROM point_grants WHERE id = ?1').bind(ev.id + ':' + sess.address).first();
  if (existing && existing.granted) throw new V2Error(409, 'Récompense déjà attribuée.');
  if (!(await eventProgress(env, sess.address, ev.metric, week))) throw new V2Error(400, 'Objectif pas encore atteint.');
  const nft = ev.nft && !deps.isFounder(env, sess.address);
  await grantOnce(env, ev.id + ':' + sess.address, sess.address, ev.points, 'weekly-event', nft);
  const again = await env.DB.prepare('SELECT granted, points, nft_eligible FROM point_grants WHERE id = ?1').bind(ev.id + ':' + sess.address).first();
  return { id: ev.id, points: again.points, nftEligible: !!again.nft_eligible, claimed: !!again.granted };
}

async function questState(env, address) {
  const day = E.dayKey();
  const start = Date.parse(day + 'T00:00:00Z');
  const week = isoWeek(Date.now());
  const wstart = weekStart(Date.now());
  const pres = await env.DB.prepare('SELECT presence_at FROM profiles WHERE address = ?1').bind(address).first();
  const msgs = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE address = ?1 AND created_at >= ?2').bind(address, start).first();
  const friends = await env.DB.prepare("SELECT COUNT(*) AS n FROM friend_challenges WHERE status = 'done' AND created_at >= ?1 AND (requester = ?2 OR target = ?2)").bind(start, address).first();
  const guild = await membership(env, address);
  const raids = await env.DB.prepare('SELECT COUNT(*) AS n FROM raid_hits WHERE address = ?1 AND applied = 1 AND created_at >= ?2').bind(address, wstart).first();
  const joined = await env.DB.prepare('SELECT COUNT(*) AS n FROM live_entries WHERE address = ?1 AND bot = 0 AND tournament_id = ?2').bind(address, 'live:' + week).first();
  return {
    daily: [
      { id: 'd:' + day + ':presence', title: 'Passe en ligne aujourd’hui', points: 10, done: !!(pres && pres.presence_at >= start) },
      { id: 'd:' + day + ':chat', title: 'Envoie un message aujourd’hui', points: 15, done: msgs.n >= 1 },
      { id: 'd:' + day + ':friend', title: 'Termine un défi entre amis', points: 20, done: friends.n >= 1 }
    ],
    weekly: [
      { id: 'w:' + week + ':guild', title: 'Fais partie d’une guilde', points: 30, done: !!guild },
      { id: 'w:' + week + ':raid', title: 'Frappe un raid cette semaine', points: 40, done: raids.n >= 1 },
      { id: 'w:' + week + ':tourney', title: 'Inscris-toi au tournoi live', points: 25, done: joined.n >= 1 }
    ]
  };
}

async function listQuests(env, sess) {
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE address = ?1').bind(sess.address).first();
  if (total.n >= 10) await badge(env, sess.address, 'chat-citizen');
  const q = await questState(env, sess.address);
  const mark = async list => {
    const out = [];
    for (const item of list) {
      const g = await env.DB.prepare('SELECT granted FROM point_grants WHERE id = ?1').bind('quest:' + item.id + ':' + sess.address).first();
      out.push(Object.assign({}, item, { claimed: !!(g && g.granted) }));
    }
    return out;
  };
  return { daily: await mark(q.daily), weekly: await mark(q.weekly) };
}

async function claimQuest(env, deps, sess, b) {
  const q = await questState(env, sess.address);
  const item = q.daily.concat(q.weekly).find(x => x.id === b.id);
  if (!item) throw new V2Error(404, 'Quête introuvable');
  const gid = 'quest:' + item.id + ':' + sess.address;
  const existing = await env.DB.prepare('SELECT granted FROM point_grants WHERE id = ?1').bind(gid).first();
  if (existing && existing.granted) throw new V2Error(409, 'Récompense déjà attribuée.');
  if (!item.done) throw new V2Error(400, 'Objectif pas encore atteint.');
  await grantOnce(env, gid, sess.address, item.points, 'quest', 0);
  const pts = await communityPoints(env, sess.address);
  return { id: item.id, points: item.points, ...pts };
}

async function eligibility(env, sess) {
  const rows = await env.DB.prepare('SELECT id, reason, points, nft_eligible, granted FROM point_grants WHERE address = ?1 AND nft_eligible = 1').bind(sess.address).all();
  return {
    realClaims: false,
    note: 'manual',
    rows: rows.results.map(r => ({ id: r.id, reason: r.reason, points: r.points, nftEligible: true, granted: !!r.granted }))
  };
}

async function ranks(env, deps, ip, url) {
  await deps.rateLimit(env, 'v2rank:' + ip, 60, 60);
  const kind = ['player', 'guild', 'fighter'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'player';
  const span = url.searchParams.get('span') === 'week' ? 'week' : 'all';
  const week = isoWeek(Date.now());
  if (kind === 'guild') {
    const rows = await env.DB.prepare('SELECT id, name, logo, points, week, week_points, wins, losses FROM guilds').all();
    const list = rows.results.map(g => ({ id: g.id, name: g.name, logo: g.logo, points: span === 'week' ? (g.week === week ? g.week_points : 0) : g.points, wins: g.wins, losses: g.losses }))
      .sort((a, b) => b.points - a.points || (a.name < b.name ? -1 : 1)).slice(0, 30)
      .map((g, i) => Object.assign({ rank: i + 1 }, g));
    return { kind, span, rows: list };
  }
  if (kind === 'fighter') {
    if (span === 'week') {
      const rows = await env.DB.prepare('SELECT char_id, xp FROM fighter_week WHERE week = ?1 ORDER BY xp DESC LIMIT 30').bind(week).all();
      return { kind, span, source: 'v2-actions', rows: rows.results.map((r, i) => ({ rank: i + 1, id: r.char_id, xp: r.xp })) };
    }
    const rows = await env.DB.prepare('SELECT char_id, SUM(xp) AS xp, SUM(wins) AS wins FROM char_progress GROUP BY char_id ORDER BY xp DESC LIMIT 30').all();
    return { kind, span, source: 'arena-and-v2', rows: rows.results.map((r, i) => ({ rank: i + 1, id: r.char_id, xp: r.xp, wins: r.wins })) };
  }
  const rows = await env.DB.prepare('SELECT s.address, s.community_points, s.week, s.week_points, p.name, p.wins, p.losses, p.points AS arena FROM player_stats s LEFT JOIN players p ON p.address = s.address').all();
  const list = rows.results.map(r => ({
    address: r.address, name: r.name, wins: r.wins || 0, losses: r.losses || 0, arenaPoints: r.arena || 0,
    points: span === 'week' ? (r.week === week ? r.week_points : 0) : r.community_points
  })).sort((a, b) => b.points - a.points || (a.address < b.address ? -1 : 1)).slice(0, 30)
    .map((r, i) => Object.assign({ rank: i + 1 }, r));
  return { kind, span, rows: list };
}

async function tournamentView(env, deps, sess) {
  if (!schedulerEnabled(env)) return { scheduler: false, pendingCodes: ['scheduler-off'], mode: 'live', v1: 'ghosts-bots' };
  await runScheduler(env, deps, {});
  const id = 'live:' + isoWeek(Date.now());
  const row = await env.DB.prepare('SELECT * FROM live_tournaments WHERE id = ?1').bind(id).first();
  if (!row) return { scheduler: true, mode: 'live', v1: 'ghosts-bots', tournament: null };
  const entries = await env.DB.prepare('SELECT address, fighter_id, bot, label FROM live_entries WHERE tournament_id = ?1').bind(id).all();
  const matches = await env.DB.prepare('SELECT round, slot, p1, p2, winner, status, bot, reason FROM live_matches WHERE tournament_id = ?1 ORDER BY round, slot').bind(id).all();
  const mine = sess ? entries.results.find(e => e.address === sess.address) : null;
  return {
    scheduler: true, pendingCodes: [], mode: 'live', v1: 'ghosts-bots',
    tournament: {
      id: row.id, status: row.status, reason: row.reason, opensAt: row.opens_at, startsAt: row.starts_at, size: row.size,
      joined: !!mine,
      entries: entries.results.map(e => ({ address: e.bot ? null : e.address, label: e.label, bot: !!e.bot, fighterId: e.fighter_id })),
      matches: matches.results
    }
  };
}

async function tournamentJoin(env, deps, sess, b) {
  if (!schedulerEnabled(env)) throw new V2Error(403, 'Planificateur V2 inactif : événements, raids planifiés et tournoi automatique en attente.');
  await runScheduler(env, deps, { force: true });
  const fighter = CHAR.get(String(b.fighterId || ''));
  if (!fighter) throw new V2Error(400, 'Combattant inconnu');
  const id = 'live:' + isoWeek(Date.now());
  const row = await env.DB.prepare('SELECT status, size FROM live_tournaments WHERE id = ?1').bind(id).first();
  if (!row || row.status !== 'open') throw new V2Error(409, 'Tournoi pas ouvert aux inscriptions.');
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM live_entries WHERE tournament_id = ?1 AND bot = 0').bind(id).first();
  if (n.n >= row.size) throw new V2Error(409, 'Tournoi complet.');
  await setPresence(env, deps, sess, { away: false });
  try {
    await env.DB.prepare('INSERT INTO live_entries (tournament_id, address, fighter_id, bot, label) VALUES (?1, ?2, ?3, 0, ?4)')
      .bind(id, sess.address, fighter.id, '').run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message || e))) return { id, already: true };
    throw e;
  }
  const name = await env.DB.prepare('SELECT name FROM players WHERE address = ?1').bind(sess.address).first();
  const label = (name && name.name) || deps.short(sess.address);
  await env.DB.prepare('UPDATE live_entries SET label = ?1 WHERE tournament_id = ?2 AND address = ?3 AND bot = 0').bind(label, id, sess.address).run();
  return { id, joined: true };
}

async function adminSchedule(env, b) {
  const opensAt = Number(b.opensAt), startsAt = Number(b.startsAt), size = Number(b.size);
  if (!Number.isFinite(opensAt) || !Number.isFinite(startsAt) || startsAt < opensAt) throw new V2Error(400, 'Horaire invalide');
  if (![2, 4, 8].includes(size)) throw new V2Error(400, 'Taille de tableau invalide');
  const value = JSON.stringify({ opensAt, startsAt, size });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('v2_schedule', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(value).run();
  if (!schedulerEnabled(env)) return { saved: true, enabled: false, pendingCodes: ['scheduler-off'] };
  await ensureTournament(env, Date.now());
  return { saved: true, enabled: true, schedule: JSON.parse(value) };
}

async function adminRaid(env, b) {
  const spec = RAID_SPECS[b.difficulty];
  if (!spec) throw new V2Error(400, 'Difficulté inconnue');
  const hp = Number(b.hp);
  if (!Number.isInteger(hp) || hp < 1 || hp > spec.hp) throw new V2Error(400, 'Points de vie invalides');
  const boss = E.BOSSES[spec.boss];
  const id = 'admin:' + isoWeek(Date.now()) + ':' + randomHex(4);
  await env.DB.prepare(
    `INSERT INTO raids (id, week, difficulty, boss_name, base_id, hp_max, hp_left, cap, points, nft, status, source, closes_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8, ?9, 'open', 'admin', ?10)`
  ).bind(id, isoWeek(Date.now()), b.difficulty, boss.name, boss.baseId, hp, spec.cap, spec.points, spec.nft ? 1 : 0, Date.now() + 2 * 86400000).run();
  return { id, hp, cap: spec.cap, source: 'admin' };
}

async function adminReports(env) {
  const rows = await env.DB.prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY id DESC LIMIT 50").all();
  return { reports: rows.results };
}

async function adminMute(env, sess, b) {
  const addr = lower(b.address || '');
  const minutes = Math.max(1, Math.min(1440, Number(b.minutes) || 10));
  if (!isAddress(addr)) throw new V2Error(400, 'Adresse invalide');
  const reason = cleanLabel(b.reason || 'moderation', 3, 80) || 'moderation';
  await env.DB.prepare('INSERT INTO mutes (address, until_ts, reason, by_admin) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(address) DO UPDATE SET until_ts = excluded.until_ts, reason = excluded.reason, by_admin = excluded.by_admin')
    .bind(addr, Date.now() + minutes * 60000, reason, sess.address).run();
  return { ok: true, until: Date.now() + minutes * 60000 };
}

async function adminDelete(env, b) {
  const id = Number(b.messageId);
  const u = await env.DB.prepare('UPDATE messages SET deleted = 1, body = \'\' WHERE id = ?1 AND deleted = 0').bind(id).run();
  if (!u.meta.changes) throw new V2Error(404, 'Message introuvable');
  return { ok: true };
}

async function adminCloseReport(env, b) {
  const status = b.action === 'actioned' ? 'actioned' : 'dismissed';
  const u = await env.DB.prepare("UPDATE reports SET status = ?1 WHERE id = ?2 AND status = 'open'").bind(status, Number(b.id)).run();
  if (!u.meta.changes) throw new V2Error(404, 'Signalement introuvable');
  return { ok: true, status };
}

async function adminEligibility(env) {
  const rows = await env.DB.prepare('SELECT id, address, reason, points FROM point_grants WHERE nft_eligible = 1 ORDER BY created_at DESC LIMIT 100').all();
  return { realClaims: false, rows: rows.results };
}
