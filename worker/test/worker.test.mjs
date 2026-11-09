/* Tests du Worker (Miniflare/workerd + D1 local, RPC et API Telegram simulés). Lancer : npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import { Wallet, Interface, zeroPadValue, toBeHex } from 'ethers';
import { is1271Magic } from '../src/crypto.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../../js/engine.js');
const C = require('../../js/collection.js');
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');

const CONTRACT = '0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc';
const TG_TOKEN = '000000:TEST-TOKEN-FICTIF';
const TG_SECRET = 'secret-webhook-de-test';
const ADMIN_CHAT = '424242';
const admin = Wallet.createRandom();
const player = Wallet.createRandom();
const player2 = Wallet.createRandom();
const ORIGIN = 'http://127.0.0.1:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- serveur simulé : RPC Robinhood Chain + API Telegram ---- */
const mock = { owners: {}, receipts: {}, tg: [], rpc: [], code: {}, sig1271: {} };
const server = http.createServer((req, res) => {
  let data = '';
  req.on('data', c => data += c);
  req.on('end', () => {
    const j = data ? JSON.parse(data) : {};
    if (req.url.startsWith('/bot')) {
      const [, tok, method] = req.url.match(/^\/bot([^/]+)\/(\w+)/);
      mock.tg.push({ tok, method, body: j });
      res.end(JSON.stringify({ ok: true, result: { message_id: mock.tg.length } }));
      return;
    }
    mock.rpc.push(j.method);
    let result = null;
    if (j.method === 'eth_chainId') result = '0x1237';
    if (j.method === 'eth_getCode') {
      const addr = String((j.params && j.params[0]) || '').toLowerCase();
      result = (mock.code && mock.code[addr]) || '0x';
    }
    if (j.method === 'eth_call') {
      const data = (j.params[0] && j.params[0].data) || '';
      const to = String((j.params[0] && j.params[0].to) || '').toLowerCase();
      if (data.startsWith('0x1626ba7e')) result = (mock.sig1271 && mock.sig1271[to]) || ('0xffffffff' + '0'.repeat(56));
      else {
        const id = parseInt(data.slice(10), 16);
        result = zeroPadValue(mock.owners[id] || admin.address, 32);
      }
    }
    if (j.method === 'eth_estimateGas') result = '0x1d4c0';
    if (j.method === 'eth_call' && mock.revert && j.params[0].data.startsWith('0x42842e0e')) { res.end(JSON.stringify({ jsonrpc: '2.0', id: j.id, error: { code: 3, message: 'execution reverted' } })); return; }
    if (j.method === 'eth_getTransactionReceipt') result = mock.receipts[j.params[0]] || null;
    res.end(JSON.stringify({ jsonrpc: '2.0', id: j.id, result }));
  });
});

let base, apiBase, devProc, persist;
const PORT = 8790 + Math.floor(Math.random() * 100);
/* Accès direct à la base D1 locale (fixtures de test uniquement) via wrangler d1 execute. */
function sqlLit(v) { return typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'"; }
const db = {
  prepare(sql) {
    let binds = [];
    const run = () => {
      let i = 0; const q = sql.replace(/\?/g, () => sqlLit(binds[i++]));
      const out = execSync(`npx wrangler d1 execute neon-buddies-arena --local --persist-to ${persist} --json --command ${JSON.stringify(q)}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      return JSON.parse(out)[0].results;
    };
    const o = { bind(...b) { binds = b; return o; }, async run() { return run(); }, async first() { return run()[0] || null; }, async all() { return { results: run() }; } };
    return o;
  }
};
test.before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(path.join(root, '.wrangler'), { recursive: true });
  persist = fs.mkdtempSync(path.join(root, '.wrangler', 'test-'));
  execSync(`npx wrangler d1 execute neon-buddies-arena --local --persist-to ${persist} --file schema.sql`, { cwd: root, stdio: 'ignore' });
  const vars = {
    ADMIN_ADDRESS: admin.address, CHAIN_ID: '4663', RPC_URL: base + '/rpc', NFT_CONTRACT: CONTRACT,
    ALLOWED_ORIGINS: ORIGIN, FIGHT_MIN_INTERVAL_MS: '150', MAX_FIGHTS_PER_DAY: '300', DAILY_POINTS_CAP: '3000', CHECK_ONCHAIN: '1',
    REWARD_STOCK: JSON.stringify({ Common: [1, 3], Rare: [5], Epic: [7], Legendary: [2], Special: [12] }),
    TELEGRAM_API_BASE: base, TELEGRAM_BOT_TOKEN: TG_TOKEN, TELEGRAM_ADMIN_CHAT_ID: ADMIN_CHAT, TELEGRAM_WEBHOOK_SECRET: TG_SECRET,
    TELEGRAM_NOTIFY_VICTORIES: '1', VICTORY_NOTIFY_INTERVAL_SEC: '600', STOCK_LOW_THRESHOLD: '1', PVP_TIMEOUT_SEC: '3', BOSS_ATTEMPTS_PER_DAY: '3',
    REAL_CLAIMS: '1', HARNESS_FAST_FIGHT: '1', FIGHT_MIN_MS: '150000',
    PUBLIC_SITE_URL: 'https://exemple.github.io/neon-buddies-battle-arena/'
  };
  const args = ['wrangler', 'dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', persist, '--show-interactive-dev-session=false'];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  devProc = spawn('npx', args, { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { TELEGRAM_BOT_TOKEN: '', WRANGLER_SEND_METRICS: 'false' }) });
  let log = ''; devProc.stdout.on('data', d => log += d); devProc.stderr.on('data', d => log += d);
  apiBase = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(apiBase + '/api/health'); if (r.status) return; } catch (e) { /* démarrage */ }
    await sleep(500);
  }
  throw new Error('wrangler dev ne démarre pas :\n' + log);
});
test.after(async () => { try { process.kill(-devProc.pid, 'SIGTERM'); } catch (e) {} server.closeAllConnections(); server.close(); fs.rmSync(persist, { recursive: true, force: true }); });

async function api(p, { method = 'GET', body, token, headers = {} } = {}) {
  const h = Object.assign({ Origin: ORIGIN }, headers);
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(apiBase + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null, headers: r.headers };
}
async function play(token, body) {
  const start = await api('/api/battle/start', { method: 'POST', token, body });
  if (start.status !== 200) return start;
  let battle = start.data.battle;
  let now = battle.startedAt;
  let guard = 0;
  while (battle && battle.status === 'active' && guard++ < 90) {
    let t = Math.max(now, Math.min(battle.you.atkReadyAt, battle.you.spellReadyAt));
    const action = battle.seq % 4 === 3 && t >= battle.you.spellReadyAt ? 'spell' : 'attack';
    t = Math.max(t, action === 'spell' ? battle.you.spellReadyAt : battle.you.atkReadyAt);
    const act = await api('/api/battle/act', { method: 'POST', token, body: { id: start.data.id, action, seq: battle.seq + 1 }, headers: { 'x-nb-test-now': String(t) } });
    if (act.status !== 200) return act;
    if (act.data.settled) return { status: 200, data: Object.assign({ seed: start.data.seed, id: start.data.id }, act.data.settled) };
    battle = act.data.battle;
    now = t + 1000;
  }
  const fin = await api('/api/battle/finish', { method: 'POST', token, body: { id: start.data.id }, headers: { 'x-nb-test-now': String(battle ? battle.deadlineAt : now) } });
  if (fin.data && start.data) { fin.data.seed = fin.data.seed || start.data.seed; fin.data.id = fin.data.id || start.data.id; }
  return fin;
}
async function login(w) {
  const n = await api('/api/auth/nonce', { method: 'POST', body: { address: w.address } });
  assert.equal(n.status, 200);
  const signature = await w.signMessage(n.data.message);
  const v = await api('/api/auth/verify', { method: 'POST', body: { address: w.address, nonce: n.data.nonce, signature } });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return v.data;
}
const tgSince = i => mock.tg.slice(i);

let pTok, aTok;

test('santé, configuration et CORS', async () => {
  const h = await api('/api/health');
  assert.equal(h.status, 200); assert.equal(h.data.chainId, 4663); assert.equal(h.data.admin, admin.address.toLowerCase());
  assert.equal(h.data.realClaims, true); assert.equal(h.data.audited, false);
  assert.equal(h.data.manual, true); assert.equal(h.data.payments, false); assert.equal(h.data.checkout, false); assert.equal(h.data.schema, '0002');
  const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  assert.match(toml, /REAL_CLAIMS = "0"/);
  assert.match(toml, /PAYMENTS_ENABLED = "0"/);
  assert.equal(/^\s*(HARNESS_FAST_FIGHT|FIGHT_MIN_MS)\s*=/m.test(toml), false);
  assert.equal(h.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await api('/api/health', { headers: { Origin: 'https://pirate.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const c = await api('/api/config');
  assert.equal(c.data.missions.length, 3);
  assert.deepEqual(c.data.stock, { Common: 2, Rare: 1, Epic: 1, Legendary: 1, Special: 1 });
});

test('auth : nonce signé, message SIWE, rejeu refusé, mauvais signataire refusé', async () => {
  const n = await api('/api/auth/nonce', { method: 'POST', body: { address: player.address } });
  assert.match(n.data.message, /Chain ID: 4663/);
  assert.match(n.data.message, new RegExp('Nonce: ' + n.data.nonce));
  assert.match(n.data.message, /127\.0\.0\.1:8765 veut que tu te connectes/);
  const sig = await player.signMessage(n.data.message);
  const ok = await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: n.data.nonce, signature: sig } });
  assert.equal(ok.status, 200); assert.equal(ok.data.isAdmin, false); pTok = ok.data.token;
  const replay = await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: n.data.nonce, signature: sig } });
  assert.equal(replay.status, 401, 'rejeu du même nonce');
  // Signature d'un autre wallet pour l'adresse du joueur
  const n2 = await api('/api/auth/nonce', { method: 'POST', body: { address: player.address } });
  const i = mock.tg.length;
  const forged = await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: n2.data.nonce, signature: await player2.signMessage(n2.data.message) } });
  assert.equal(forged.status, 401);
  await sleep(100);
  assert.ok(tgSince(i).some(m => /Signature de connexion invalide/.test(m.body.text)), 'alerte admin envoyée');
  // Nonce émis pour une autre adresse
  const n3 = await api('/api/auth/nonce', { method: 'POST', body: { address: player2.address } });
  const cross = await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: n3.data.nonce, signature: await player.signMessage(n3.data.message) } });
  assert.equal(cross.status, 401);
  // Session invalide
  assert.equal((await api('/api/me', { token: 'f'.repeat(64) })).status, 401);
  assert.equal((await api('/api/me')).status, 401);
  // Nonce expiré : consommé et refusé, même avec une signature valide.
  const nExp = await api('/api/auth/nonce', { method: 'POST', body: { address: player.address } });
  await db.prepare('UPDATE nonces SET expires_at = ? WHERE nonce = ?').bind(Date.now() - 1000, nExp.data.nonce).run();
  const exp = await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: nExp.data.nonce, signature: await player.signMessage(nExp.data.message) } });
  assert.equal(exp.status, 401);
  assert.equal((await api('/api/auth/verify', { method: 'POST', body: { address: player.address, nonce: 'zz', signature: '0x11' } })).status, 400);
});

test('ERC-1271 / EIP-7702 : valeur magique stricte, EOA et compte à code, échec fermé', async () => {
  assert.equal(is1271Magic('0x1626ba7e' + '0'.repeat(56)), true);
  assert.equal(is1271Magic('0x1626BA7E'), true);
  assert.equal(is1271Magic('0x1626ba7e' + 'ff' + '0'.repeat(54)), false);
  assert.equal(is1271Magic('0xffffffff' + '0'.repeat(56)), false);
  assert.equal(is1271Magic('0x'), false);
  const smart = Wallet.createRandom();
  const addr = smart.address.toLowerCase();
  mock.code[addr] = '0xef0100' + '11'.repeat(20);
  mock.sig1271[addr] = '0x1626ba7e' + '00'.repeat(28);
  const n = await api('/api/auth/nonce', { method: 'POST', body: { address: smart.address } });
  const wrapped = '0x00' + 'ab'.repeat(65);
  const ok = await api('/api/auth/verify', { method: 'POST', body: { address: smart.address, nonce: n.data.nonce, signature: wrapped } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.isAdmin, false, 'un compte 1271 qui n’est pas l’admin ne devient pas admin');
  const n2 = await api('/api/auth/nonce', { method: 'POST', body: { address: smart.address } });
  mock.sig1271[addr] = '0x1626ba7eff' + '0'.repeat(54);
  const badMagic = await api('/api/auth/verify', { method: 'POST', body: { address: smart.address, nonce: n2.data.nonce, signature: wrapped } });
  assert.equal(badMagic.status, 401, 'bourrage non nul refusé');
  const n3 = await api('/api/auth/nonce', { method: 'POST', body: { address: smart.address } });
  delete mock.sig1271[addr];
  const closed = await api('/api/auth/verify', { method: 'POST', body: { address: smart.address, nonce: n3.data.nonce, signature: wrapped } });
  assert.equal(closed.status, 401, 'sans magie valide : échec fermé');
  // L'admin EOA reste accepté par récupération ECDSA, pas par égalité d'adresse.
  const forged = await api('/api/auth/nonce', { method: 'POST', body: { address: admin.address } });
  const no = await api('/api/auth/verify', { method: 'POST', body: { address: admin.address, nonce: forged.data.nonce, signature: await player.signMessage(forged.data.message) } });
  assert.equal(no.status, 401);
  // Signature 1271 acceptée pour l'adresse admin si le compte répond la magie (délégation EIP-7702).
  mock.code[admin.address.toLowerCase()] = '0xef010077021100bd87b7008e5e1989d0eb38555d0d0000';
  mock.sig1271[admin.address.toLowerCase()] = '0x1626ba7e' + '0'.repeat(56);
  const nA = await api('/api/auth/nonce', { method: 'POST', body: { address: admin.address } });
  const asAdmin = await api('/api/auth/verify', { method: 'POST', body: { address: admin.address, nonce: nA.data.nonce, signature: wrapped } });
  assert.equal(asAdmin.status, 200, JSON.stringify(asAdmin.data));
  assert.equal(asAdmin.data.isAdmin, true);
  delete mock.code[admin.address.toLowerCase()];
  delete mock.sig1271[admin.address.toLowerCase()];
  delete mock.code[addr];
});

test('admin : accès réservé à l\u2019adresse admin signée', async () => {
  assert.equal((await api('/api/admin/summary')).status, 401);
  assert.equal((await api('/api/admin/summary', { token: pTok })).status, 403);
  assert.equal((await api('/api/admin/rewards', { token: pTok })).status, 403);
  const a = await login(admin);
  assert.equal(a.isAdmin, true); aTok = a.token;
  const s = await api('/api/admin/summary', { token: aTok });
  assert.equal(s.status, 200); assert.equal(s.data.telegram, true);
});

test('combat manuel : le serveur ignore le vainqueur envoyé et n’accorde rien sans actions', async () => {
  const early = await api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: '0002', opponentId: '0001', points: 999999, winner: 'A', seed: 1 } });
  assert.equal(early.status, 200, JSON.stringify(early.data));
  assert.notEqual(early.data.seed, 1);
  assert.equal(early.data.battle.status, 'active');
  const tooSoon = await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: early.data.id, winner: 'A', points: 999999 }, headers: { 'x-nb-test-now': String(early.data.battle.startedAt + 1000) } });
  assert.equal(tooSoon.status, 425);
  const afk = await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: early.data.id }, headers: { 'x-nb-test-now': String(early.data.battle.deadlineAt) } });
  assert.equal(afk.status, 200, JSON.stringify(afk.data));
  assert.equal(afk.data.forfeit, true);
  assert.equal(afk.data.summary.points, 0);
  const me = await api('/api/me', { token: pTok });
  assert.equal(me.data.profile.battles, 0);
  await sleep(200);
  const r = await play(pTok, { fighterId: '0002', opponentId: '0001', points: 999999, winner: 'A', seed: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.forfeit, false);
  assert.equal(r.data.result.manual, true);
  assert.ok(r.data.result.playerActions >= 5);
  assert.equal(r.data.profile.points, r.data.summary.points);
  assert.ok(r.data.profile.points < 999999);
  assert.equal(r.data.profile.battles, 1);
  const stored = await db.prepare('SELECT state FROM live_battles WHERE id = ?').bind(r.data.id).first();
  assert.equal(stored.state, '{"s":1}', 'le combat réglé est persisté compact, pas un état complet');
  const read1 = await api('/api/battle?id=' + r.data.id, { token: pTok });
  const read2 = await api('/api/battle?id=' + r.data.id, { token: pTok });
  assert.equal(read1.status, 200, JSON.stringify(read1.data));
  assert.equal(read2.status, 200);
  assert.equal(read1.data.battle.status, 'finished');
  assert.equal(read1.data.battle.you.id, '0002');
  assert.equal(read1.data.settled.summary.points, r.data.summary.points);
  assert.equal(read2.data.settled.summary.points, read1.data.settled.summary.points);
  assert.equal((await api('/api/battle?id=' + r.data.id, { token: aTok })).status, 404);
  const again1 = await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: r.data.id } });
  const again2 = await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: r.data.id } });
  assert.equal(again1.status, 200);
  assert.equal(again2.data.summary.points, again1.data.summary.points);
  assert.equal((await api('/api/me', { token: pTok })).data.profile.battles, 1);
  const rewardsAfter = await db.prepare('SELECT COUNT(*) AS n FROM rewards WHERE address = ?').bind(player.address.toLowerCase()).first();
  assert.equal(rewardsAfter.n, (r.data.newRewards || []).length);
  const row = await db.prepare('SELECT seed, winner FROM fights WHERE address = ?').bind(player.address.toLowerCase()).first();
  assert.equal(row.seed, r.data.seed); assert.equal(row.winner, r.data.result.winner);
  const again = await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: r.data.id } });
  assert.equal(again.status, 200);
  assert.equal(again.data.profile.points, r.data.profile.points);
});

test('anti-triche : personnages inconnus, intervalle minimum, adversaire aléatoire', async () => {
  await sleep(200);
  assert.equal((await api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: 'c-perso' } })).status, 400);
  assert.equal((await api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: '0002', opponentId: '0002' } })).status, 400);
  assert.equal((await api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: '0999' } })).status, 400);
  const a = await api('/api/battle/start', { method: 'POST', token: pTok, body: { mode: 'solo', difficulty: 'normal', fighterId: '0010' } });
  assert.equal(a.status, 200, JSON.stringify(a.data)); assert.notEqual(a.data.battle.foe.id, '0010');
  const b = await api('/api/battle/start', { method: 'POST', token: pTok, body: { mode: 'solo', difficulty: 'normal', fighterId: '0010' } });
  assert.equal(b.status, 409, 'combat déjà ouvert');
  await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: a.data.id }, headers: { 'x-nb-test-now': String(a.data.battle.deadlineAt) } });
  await sleep(200);
  const par = await Promise.all([1, 2, 3].map(() => api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: '0011', opponentId: '0012' } })));
  assert.equal(par.filter(x => x.status === 200).length, 1);
  const p = await api('/api/me', { token: pTok });
  assert.equal(p.data.profile.battles, 1);
  const open = await api('/api/battle', { token: pTok });
  if (open.data && open.data.battle && open.data.battle.status === 'active') {
    await api('/api/battle/finish', { method: 'POST', token: pTok, body: { id: open.data.id }, headers: { 'x-nb-test-now': String(open.data.battle.deadlineAt) } });
  }
});

test('notifications de victoire Telegram espacées (une seule par intervalle)', async () => {
  const before = mock.tg.filter(m => /Victoire( \(\w+\))? de/.test(m.body.text || '')).length;
  // 0004 (Légendaire) contre 0002 (Commun) : victoire quasi certaine → plusieurs victoires, une seule notification dans l'intervalle.
  let wins = 0;
  for (let i = 0; i < 4; i++) { await sleep(200); const f = await play(pTok, { fighterId: '0004', opponentId: '0002' }); if (f.data && f.data.result && f.data.result.winner === 'A' && !f.data.forfeit) wins++; }
  assert.ok(wins >= 2, 'au moins deux victoires : ' + wins);
  await sleep(100);
  const after = mock.tg.filter(m => /Victoire( \(\w+\))? de/.test(m.body.text || '')).length;
  assert.ok(after - before <= 1 && after >= 1, `${before} → ${after}`);
  assert.ok(mock.tg.every(m => m.tok === TG_TOKEN && m.body.chat_id === undefined || String(m.body.chat_id) === ADMIN_CHAT || m.method !== 'sendMessage'));
});

test('missions du jour et classement des joueurs', async () => {
  const me = await api('/api/me', { token: pTok });
  assert.equal(me.data.missions.length, 3);
  assert.ok(me.data.missions.some(m => m.progress > 0));
  const p2 = await login(player2);
  await play(p2.token, { fighterId: '0001', opponentId: '0090' });
  await api('/api/me/name', { method: 'POST', token: p2.token, body: { name: '<b>Joueur 2</b>' } });
  const lb = await api('/api/leaderboard');
  assert.equal(lb.data.players.length, 2);
  assert.ok(lb.data.players[0].points >= lb.data.players[1].points);
  const named = lb.data.players.find(x => x.address === player2.address.toLowerCase());
  assert.equal(named.name, 'bJoueur 2b', 'nom nettoyé');
});

let rewardId, rewardId2;
test('récompense obtenue (règle 3 000 points) puis réclamation et alerte admin', async () => {
  const addr = player.address.toLowerCase();
  await db.prepare('UPDATE players SET points = 2999 WHERE address = ?').bind(addr).run();
  await sleep(200);
  const i = mock.tg.length;
  let r;
  for (let k = 0; k < 6; k++) { r = await play(pTok, { fighterId: '0002', opponentId: '0040' }); if (r.data && r.data.newRewards && r.data.newRewards.length) break; await sleep(200); }
  assert.equal(r.data.newRewards[0].tier, 'Common');
  rewardId = r.data.newRewards[0].id;
  assert.equal(rewardId, 'points-3000:' + addr);
  // Obtenue une seule fois
  await sleep(170);
  const again = await play(pTok, { fighterId: '0002', opponentId: '0040' });
  assert.equal(again.data.newRewards.length, 0);
  const c = await api(`/api/rewards/${encodeURIComponent(rewardId)}/claim`, { method: 'POST', token: pTok });
  assert.equal(c.status, 200); assert.equal(c.data.status, 'pending'); assert.equal(c.data.tokenId, 1);
  await sleep(100);
  const msgs = tgSince(i).map(m => m.body.text || '');
  assert.ok(msgs.some(t => /a gagné une récompense NFT Commun/.test(t)));
  assert.ok(msgs.some(t => /Nouvelle demande de NFT/.test(t)));
  assert.ok(msgs.some(t => /Stock bas : il reste 1/.test(t)));
  const withButton = tgSince(i).find(m => /Nouvelle demande/.test(m.body.text || ''));
  assert.equal(withButton.body.reply_markup.inline_keyboard[0][0].url, 'https://exemple.github.io/neon-buddies-battle-arena/#admin');
});

test('double réclamation refusée (séquentielle et simultanée) + alerte', async () => {
  const i = mock.tg.length;
  const dbl = await api(`/api/rewards/${encodeURIComponent(rewardId)}/claim`, { method: 'POST', token: pTok });
  assert.equal(dbl.status, 409);
  await sleep(100);
  assert.ok(tgSince(i).some(m => /Double réclamation/.test(m.body.text)));
  // Réclamation de la récompense d'un autre joueur
  const g = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: player2.address, label: 'Top 1 de la semaine' } });
  rewardId2 = g.data.id;
  assert.equal((await api(`/api/rewards/${encodeURIComponent(rewardId2)}/claim`, { method: 'POST', token: pTok })).status, 404);
  const p2 = await login(player2);
  const par = await Promise.all([1, 2, 3, 4].map(() => api(`/api/rewards/${encodeURIComponent(rewardId2)}/claim`, { method: 'POST', token: p2.token })));
  assert.equal(par.filter(x => x.status === 200).length, 1, 'une seule réclamation acceptée');
  const row = await db.prepare('SELECT status, token_id FROM rewards WHERE id = ?').bind(rewardId2).first();
  assert.equal(row.status, 'pending'); assert.equal(row.token_id, 12);
  // Aucun token réservé deux fois
  const t = await db.prepare("SELECT token_id, COUNT(*) n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY token_id HAVING n > 1").all();
  assert.equal(t.results.length, 0);
});

test('stock : deux réclamations simultanées du dernier jeton n’en réservent qu’un', async () => {
  const w1 = Wallet.createRandom(), w2 = Wallet.createRandom();
  const t1 = (await login(w1)).token, t2 = (await login(w2)).token;
  const g1 = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: w1.address, tier: 'Common', label: 'course A' } });
  const g2 = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: w2.address, tier: 'Common', label: 'course B' } });
  const par = await Promise.all([
    api(`/api/rewards/${encodeURIComponent(g1.data.id)}/claim`, { method: 'POST', token: t1 }),
    api(`/api/rewards/${encodeURIComponent(g2.data.id)}/claim`, { method: 'POST', token: t2 })
  ]);
  const ok = par.filter(x => x.status === 200), denied = par.filter(x => x.status === 409);
  assert.equal(ok.length, 1, JSON.stringify(par.map(x => x.status + ' ' + JSON.stringify(x.data))));
  assert.equal(denied.length, 1);
  assert.equal(ok[0].data.tokenId, 3);
  const rows = await db.prepare('SELECT id, status, token_id FROM rewards WHERE id IN (?, ?)').bind(g1.data.id, g2.data.id).all();
  assert.equal(rows.results.filter(r => r.status === 'pending' && r.token_id === 3).length, 1);
  assert.equal(rows.results.filter(r => r.status === 'earned' && r.token_id == null).length, 1);
  const dup = await db.prepare("SELECT token_id, COUNT(*) n FROM rewards WHERE status IN ('pending','approved','sent') AND is_test = 0 GROUP BY token_id HAVING n > 1").all();
  assert.equal(dup.results.length, 0);
  const pending = rows.results.find(r => r.status === 'pending');
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(pending.id)}/reject`, { method: 'POST', token: aTok, body: { note: 'course' } })).status, 200);
});

test('validation admin : ownerOf vérifié, transaction safeTransferFrom préparée, hash vérifié on-chain (simulé)', async () => {
  const addr = player.address.toLowerCase();
  // Le token n'appartient plus à l'admin => refus
  mock.owners[1] = player2.address;
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/approve`, { method: 'POST', token: aTok })).status, 409);
  delete mock.owners[1];
  const ap = await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/approve`, { method: 'POST', token: aTok });
  assert.equal(ap.status, 200, JSON.stringify(ap.data));
  const iface = new Interface(['function safeTransferFrom(address from, address to, uint256 tokenId)']);
  assert.equal(ap.data.tx.data, iface.encodeFunctionData('safeTransferFrom', [admin.address, player.address, 1]).toLowerCase());
  assert.equal(ap.data.tx.to, CONTRACT); assert.equal(ap.data.tx.chainId, '0x1237'); assert.equal(ap.data.tx.from, admin.address.toLowerCase());
  // Un joueur ne peut pas approuver
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/approve`, { method: 'POST', token: pTok })).status, 403);
  const tx = '0x' + 'ab'.repeat(32);
  // Pas encore confirmée
  const pend = await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/tx`, { method: 'POST', token: aTok, body: { txHash: tx } });
  assert.equal(pend.status, 202);
  // Reçu avec un mauvais token => refus
  const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const log = (id) => ({ address: CONTRACT, topics: [topic, zeroPadValue(admin.address, 32), zeroPadValue(player.address, 32), zeroPadValue(toBeHex(id), 32)], data: '0x' });
  mock.receipts[tx] = { status: '0x1', logs: [log(99)] };
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/tx`, { method: 'POST', token: aTok, body: { txHash: tx } })).status, 409);
  // Reçu correct mais le joueur n'est pas encore propriétaire
  mock.receipts[tx] = { status: '0x1', logs: [log(1)] };
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/tx`, { method: 'POST', token: aTok, body: { txHash: tx } })).status, 409);
  mock.owners[1] = player.address;
  const i = mock.tg.length;
  const ok = await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/tx`, { method: 'POST', token: aTok, body: { txHash: tx } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data)); assert.equal(ok.data.reward.status, 'sent'); assert.equal(ok.data.reward.txHash, tx);
  await sleep(100);
  assert.ok(tgSince(i).some(m => /NFT #0001 envoyé/.test(m.body.text)));
  // Le même hash ne peut pas servir pour une autre récompense ; une récompense envoyée ne peut plus être refusée
  await api(`/api/admin/rewards/${encodeURIComponent(rewardId2)}/approve`, { method: 'POST', token: aTok });
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId2)}/tx`, { method: 'POST', token: aTok, body: { txHash: tx } })).status, 409);
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/reject`, { method: 'POST', token: aTok, body: {} })).status, 409);
  const me = await api('/api/me', { token: pTok });
  assert.equal(me.data.rewards.find(r => r.id === rewardId).status, 'sent');
  assert.ok(!mock.rpc.includes('eth_sendTransaction') && !mock.rpc.includes('eth_sendRawTransaction'), 'le serveur n\u2019envoie jamais de transaction');
});

test('bot Telegram : secret du webhook, /start, /status, /rewards et boutons', async () => {
  const hook = (update, secret = TG_SECRET) => api('/telegram/webhook', { method: 'POST', body: update, headers: secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {} });
  assert.equal((await hook({ message: { text: '/status', chat: { id: Number(ADMIN_CHAT) } } }, null)).status, 401);
  assert.equal((await hook({ message: { text: '/status', chat: { id: Number(ADMIN_CHAT) } } }, 'mauvais')).status, 401);
  let i = mock.tg.length;
  await hook({ message: { text: '/start', chat: { id: 777 }, from: { id: 777 } } });
  assert.match(tgSince(i)[0].body.text, /Jeu de combat gratuit/); assert.equal(tgSince(i)[0].body.chat_id, '777');
  i = mock.tg.length;
  await hook({ message: { text: '/status', chat: { id: 777 } } });
  assert.match(tgSince(i)[0].body.text, /réservée à l’administrateur/);
  i = mock.tg.length;
  await hook({ message: { text: '/start', chat: { id: Number(ADMIN_CHAT) }, from: { id: Number(ADMIN_CHAT) } } });
  assert.match(tgSince(i)[0].body.text, /Bonjour admin/);
  const reg = await db.prepare("SELECT value FROM settings WHERE key = 'tg_admin_chat'").first();
  assert.equal(reg.value, ADMIN_CHAT);
  i = mock.tg.length;
  await hook({ message: { text: '/status@NeonBuddiesOfferBot', chat: { id: Number(ADMIN_CHAT) }, from: { id: Number(ADMIN_CHAT) } } });
  const st = tgSince(i)[0].body.text;
  assert.match(st, /Demandes en attente : 0/); assert.match(st, /approuvées \(transfert à signer\) : 1/); assert.match(st, /Joueurs actifs : 2/); assert.match(st, /Dernières victoires/);
  // Nouvelle demande pour tester les boutons
  const g = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: player.address, label: 'Test boutons' } });
  await db.prepare("UPDATE rewards SET tier = 'Rare' WHERE id = ?").bind(g.data.id).run();
  assert.equal((await api(`/api/rewards/${encodeURIComponent(g.data.id)}/claim`, { method: 'POST', token: pTok })).status, 200);
  i = mock.tg.length;
  await hook({ message: { text: '/rewards', chat: { id: Number(ADMIN_CHAT) }, from: { id: Number(ADMIN_CHAT) } } });
  const list = tgSince(i).find(m => m.body.reply_markup);
  const [ap, rj] = list.body.reply_markup.inline_keyboard[0];
  assert.equal(ap.callback_data, 'ap:' + g.data.id); assert.equal(rj.callback_data, 'rj:' + g.data.id);
  assert.ok(ap.callback_data.length <= 64);
  // Bouton cliqué par un inconnu
  i = mock.tg.length;
  await hook({ callback_query: { id: 'q1', from: { id: 999 }, data: ap.callback_data, message: { message_id: 5, chat: { id: 999 } } } });
  assert.equal(tgSince(i)[0].body.text, 'Non autorisé');
  assert.equal((await db.prepare('SELECT status FROM rewards WHERE id = ?').bind(g.data.id).first()).status, 'pending');
  // Même message dans le chat admin : un autre utilisateur ne peut pas approuver.
  i = mock.tg.length;
  await hook({ callback_query: { id: 'q1b', from: { id: 999 }, data: ap.callback_data, message: { message_id: 5, chat: { id: Number(ADMIN_CHAT) } } } });
  assert.equal(tgSince(i)[0].body.text, 'Non autorisé');
  assert.equal((await db.prepare('SELECT status FROM rewards WHERE id = ?').bind(g.data.id).first()).status, 'pending');
  // Bouton Approuver par l'admin
  i = mock.tg.length;
  await hook({ callback_query: { id: 'q2', from: { id: Number(ADMIN_CHAT) }, data: ap.callback_data, message: { message_id: 6, chat: { id: Number(ADMIN_CHAT) } } } });
  assert.equal((await db.prepare('SELECT status FROM rewards WHERE id = ?').bind(g.data.id).first()).status, 'approved');
  assert.ok(tgSince(i).some(m => m.method === 'editMessageText' && /signe le transfert avec ton wallet/.test(m.body.text) && /#admin/.test(m.body.text)));
  // Refuser
  await hook({ callback_query: { id: 'q3', from: { id: Number(ADMIN_CHAT) }, data: rj.callback_data, message: { message_id: 6, chat: { id: Number(ADMIN_CHAT) } } } });
  assert.equal((await db.prepare('SELECT status FROM rewards WHERE id = ?').bind(g.data.id).first()).status, 'rejected');
});

test('stock épuisé signalé, plafond de points quotidien appliqué', async () => {
  const g = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: player.address, label: 'Encore un spécial' } });
  const i = mock.tg.length;
  const r = await api(`/api/rewards/${encodeURIComponent(g.data.id)}/claim`, { method: 'POST', token: pTok });
  assert.equal(r.status, 409); assert.match(r.data.error, /Stock épuisé/);
  await sleep(100);
  assert.ok(tgSince(i).some(m => /Stock épuisé/.test(m.body.text)));
  await db.prepare('UPDATE players SET day_points = 3000 WHERE address = ?').bind(player.address.toLowerCase()).run();
  await sleep(200);
  const f = await play(pTok, { fighterId: '0002', opponentId: '0040' });
  const bonus = f.data.missionsCompleted.reduce((s, m) => s + m.points, 0);
  assert.equal(f.data.summary.points, bonus, 'aucun point de combat au-delà du plafond');
});

test('aucun secret dans les fichiers du dépôt', () => {
  const top = path.join(root, '..');
  const scan = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      if (['node_modules', '.wrangler', 'dist', 'screenshots', 'nft', '.git'].includes(f) || f === '.dev.vars') continue;
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p); else scan.push(path.relative(top, p));
    }
  })(top);
  assert.ok(scan.length > 15);
  const envTok = process.env.TELEGRAM_BOT_TOKEN;
  const chatFile = '/workspace/.telegram-admin-chat-id';
  const realChat = fs.existsSync(chatFile) ? fs.readFileSync(chatFile, 'utf8').trim() : '';
  for (const f of scan) {
    const p = path.join(root, '..', f);
    if (!fs.existsSync(p) || fs.statSync(p).size > 2e6 || /\.(jpg|png|zip)$/.test(f)) continue;
    const s = fs.readFileSync(p, 'utf8');
    assert.ok(!/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/.test(s), 'token Telegram trouvé dans ' + f);
    assert.ok(!/(0x)?[0-9a-fA-F]{64}\b(?![0-9a-fA-F])/.test(s.replace(/0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef/g, '')) || /test/.test(f), 'clé privée possible dans ' + f);
    if (envTok) assert.ok(!s.includes(envTok), 'token réel trouvé dans ' + f);
    if (realChat) assert.ok(!s.includes(realChat), 'chat id admin réel dans ' + f);
  }
});

test('script setup-telegram.mjs : setWebhook (avec secret) + setMyCommands, API Telegram simulée', async () => {
  const { promisify } = await import('node:util');
  const { exec } = await import('node:child_process');
  const run = promisify(exec);
  const i = mock.tg.length;
  const out = (await run('node scripts/setup-telegram.mjs', { cwd: root, env: Object.assign({}, process.env, {
    TELEGRAM_BOT_TOKEN: TG_TOKEN, TELEGRAM_WEBHOOK_SECRET: 'secret_de_test-123', WORKER_URL: 'https://api.exemple.workers.dev/', TELEGRAM_API_BASE: base }) })).stdout;
  const calls = tgSince(i);
  const hook = calls.find(c => c.method === 'setWebhook');
  assert.equal(hook.body.url, 'https://api.exemple.workers.dev/telegram/webhook');
  assert.equal(hook.body.secret_token, 'secret_de_test-123');
  assert.deepEqual(hook.body.allowed_updates, ['message', 'callback_query']);
  const cmds = calls.find(c => c.method === 'setMyCommands').body.commands.map(c => c.command);
  assert.deepEqual(cmds, ['start', 'status', 'rewards']);
  assert.ok(!out.includes(TG_TOKEN), 'le token n\u2019est jamais affiché');
  await assert.rejects(run('node scripts/setup-telegram.mjs', { cwd: root, env: { PATH: process.env.PATH } }));
});

test('FONDATEUR : badge, mêmes règles, classement normal, réclamation réelle désactivée', async () => {
  // aTok = session de l'adresse admin = fondateur
  const before = await api('/api/me', { token: aTok });
  assert.equal(before.data.profile.founder, true);
  assert.equal(before.data.profile.testMode, false);
  await sleep(200);
  const f = await play(aTok, { fighterId: '0004', opponentId: '0005' });
  assert.equal(f.status, 200, JSON.stringify(f.data));
  assert.equal(f.data.result.manual, true);
  const local = E.applyBattleResult({ profile: { points: 0, wins: before.data.profile.wins, losses: before.data.profile.losses, battles: 0, streak: before.data.profile.streak, bestStreak: before.data.profile.bestStreak }, chars: {} }, f.data.result);
  assert.equal(f.data.summary.battlePoints, local.summary.points, 'mêmes points que n\u2019importe quel joueur');
  const lb = await api('/api/leaderboard');
  const me = lb.data.players.find(p => p.address === admin.address.toLowerCase());
  assert.ok(me && me.founder === true, 'le fondateur apparaît dans le classement global');
  assert.ok(lb.data.players.filter(p => p.founder).length === 1);
  // Seuil atteint : aucune récompense réelle n'est créée pour le fondateur
  await db.prepare('UPDATE players SET points = 5000, day_points = 0 WHERE address = ?').bind(admin.address.toLowerCase()).run();
  await sleep(200);
  const f2 = await play(aTok, { fighterId: '0004', opponentId: '0005' });
  assert.equal(f2.data.newRewards.length, 0);
  // Réclamation réelle refusée même si une récompense existait
  await db.prepare("INSERT INTO rewards (id, address, rule_id, tier, label, earned_at) VALUES ('forge:f', ?, 'x', 'Common', 'forgé', 1)").bind(admin.address.toLowerCase()).run();
  const c = await api('/api/rewards/forge%3Af/claim', { method: 'POST', token: aTok });
  assert.equal(c.status, 403); assert.match(c.data.error, /fondateur/);
  assert.equal((await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: admin.address, label: 'réel' } })).status, 403);
});

test('MODE TEST : de bout en bout, [TEST] sur Telegram, simulation sans transaction, stock réel intact', async () => {
  const stockBefore = (await api('/api/config')).data.stock;
  const realUsed = await db.prepare("SELECT COUNT(*) AS n FROM rewards WHERE is_test = 0 AND status IN ('pending','approved','sent')").first();
  // Un joueur ne peut pas activer le mode test
  assert.equal((await api('/api/admin/test-mode', { method: 'POST', token: pTok, body: { enabled: true } })).status, 403);
  // Le fondateur/admin l'active pour lui-même
  const t = await api('/api/admin/test-mode', { method: 'POST', token: aTok, body: { enabled: true } });
  assert.equal(t.data.testMode, true);
  assert.equal((await api('/api/me', { token: aTok })).data.profile.testMode, true);
  // En mode test, atteindre un seuil crée une récompense TEST
  await sleep(200);
  const i = mock.tg.length;
  const f = await play(aTok, { fighterId: '0004', opponentId: '0005' });
  const tr = f.data.newRewards.find(r => r.test);
  assert.ok(tr && tr.id.startsWith('test:points-3000:'), JSON.stringify(f.data.newRewards));
  // Réclamation TEST : autorisée pour le fondateur, ne réserve aucun token réel
  const c = await api(`/api/rewards/${encodeURIComponent(tr.id)}/claim`, { method: 'POST', token: aTok });
  assert.equal(c.status, 200); assert.equal(c.data.test, true); assert.equal(c.data.status, 'pending');
  // Double réclamation TEST aussi bloquée
  assert.equal((await api(`/api/rewards/${encodeURIComponent(tr.id)}/claim`, { method: 'POST', token: aTok })).status, 409);
  // Approbation puis transfert réel interdit, simulation seulement
  const ap = await api(`/api/admin/rewards/${encodeURIComponent(tr.id)}/approve`, { method: 'POST', token: aTok });
  assert.equal(ap.status, 200); assert.equal(ap.data.test, true);
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(tr.id)}/tx`, { method: 'POST', token: aTok, body: { txHash: '0x' + 'cd'.repeat(32) } })).status, 409);
  const rpcBefore = mock.rpc.length;
  const sim = await api(`/api/admin/rewards/${encodeURIComponent(tr.id)}/simulate`, { method: 'POST', token: aTok });
  assert.equal(sim.status, 200); assert.equal(sim.data.ok, true); assert.equal(sim.data.gas, 120000);
  assert.equal(sim.data.reward.status, 'sent'); assert.equal(sim.data.reward.txHash, null); assert.match(sim.data.reward.note, /TEST — transfert simulé/);
  const used = mock.rpc.slice(rpcBefore);
  assert.ok(used.includes('eth_call') && used.includes('eth_estimateGas'));
  assert.ok(!used.some(m => /send/i.test(m)), 'aucune transaction envoyée');
  // Une récompense réelle ne peut pas être « simulée »
  assert.equal((await api(`/api/admin/rewards/${encodeURIComponent(rewardId)}/simulate`, { method: 'POST', token: aTok })).status, 409);
  // Simulation qui échoue (ex. destinataire incapable de recevoir) : statut inchangé
  const g = await api('/api/admin/grant', { method: 'POST', token: aTok, body: { address: player.address, label: 'Test joueur', tier: 'Rare', test: true } });
  assert.equal(g.data.test, true);
  assert.equal((await api(`/api/rewards/${encodeURIComponent(g.data.id)}/claim`, { method: 'POST', token: pTok })).status, 200);
  await api(`/api/admin/rewards/${encodeURIComponent(g.data.id)}/approve`, { method: 'POST', token: aTok });
  mock.revert = true;
  const bad = await api(`/api/admin/rewards/${encodeURIComponent(g.data.id)}/simulate`, { method: 'POST', token: aTok });
  mock.revert = false;
  assert.equal(bad.data.ok, false); assert.equal(bad.data.reward.status, 'approved');
  // Telegram : toutes les alertes liées aux tests sont préfixées [TEST]
  await sleep(150);
  const texts = tgSince(i).map(m => m.body.text || '').filter(t => /test|TEST|simul/i.test(t));
  assert.ok(texts.length >= 3);
  assert.ok(tgSince(i).filter(m => /Nouvelle demande|Transfert simulé|a gagné une récompense/.test(m.body.text || '')).every(m => /\[TEST\]/.test(m.body.text)), 'préfixe [TEST]');
  // Stock réel inchangé et index unique non touché
  assert.deepEqual((await api('/api/config')).data.stock, stockBefore);
  const realUsed2 = await db.prepare("SELECT COUNT(*) AS n FROM rewards WHERE is_test = 0 AND status IN ('pending','approved','sent')").first();
  assert.equal(realUsed2.n, realUsed.n);
  // Historique : les tests sont marqués
  const hist = await api('/api/admin/rewards', { token: aTok });
  assert.ok(hist.data.rewards.filter(r => r.id.startsWith('test:')).every(r => r.test === true));
  // Désactivation
  await api('/api/admin/test-mode', { method: 'POST', token: aTok, body: { enabled: false } });
  assert.equal((await api('/api/me', { token: aTok })).data.profile.testMode, false);
});

test('MODES : solo manuel, boss, défi 3 tentatives, tournoi et PvP en attente', async () => {
  const w1 = Wallet.createRandom(), w2 = Wallet.createRandom();
  const t1 = (await login(w1)).token, t2 = (await login(w2)).token;
  const ids = C.map(c => c.id);
  const s = await play(t1, { mode: 'solo', difficulty: 'cauchemar', fighterId: ids[0], opponentId: ids[1] });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  assert.equal(s.data.difficulty, 'cauchemar');
  assert.equal(s.data.result.fighters.B.level, E.botLevel('cauchemar', 1));
  assert.equal(s.data.result.manual, true);
  assert.equal(s.data.attemptsUsed, 1);
  const soloRow = await db.prepare('SELECT state FROM live_battles WHERE id = ?').bind(s.data.id).first();
  assert.equal(soloRow.state, '{"s":1}');
  const soloRead = await api('/api/battle?id=' + s.data.id, { token: t1 });
  assert.equal(soloRead.status, 200, JSON.stringify(soloRead.data));
  assert.equal(soloRead.data.settled.attemptsUsed, 1);
  assert.equal((await db.prepare('SELECT attempts_used FROM challenge_runs WHERE address = ?').bind(w1.address.toLowerCase()).first()).attempts_used, 1);
  assert.equal((await api('/api/battle?id=' + s.data.id, { token: t2 })).status, 404);
  assert.equal((await api('/api/challenge/new-run', { method: 'POST', token: t1 })).status, 409);
  assert.equal((await api('/api/battle/start', { method: 'POST', token: t1, body: { mode: 'solo', difficulty: 'dieu', fighterId: ids[0] } })).status, 400);
  await sleep(200);
  assert.equal((await api('/api/battle/start', { method: 'POST', token: t1, body: { mode: 'solo', difficulty: 'normal', fighterId: ids[0] } })).status, 409);
  const info = await api('/api/boss', { token: t1 });
  assert.equal(info.data.attemptsLeft, 3); assert.ok(info.data.boss.phases >= 3);
  for (let i = 0; i < 3; i++) {
    await sleep(200);
    const b = await play(t1, { mode: 'boss', fighterId: ids[2] });
    assert.equal(b.status, 200, JSON.stringify(b.data));
    assert.equal(b.data.attemptsLeft, 2 - i);
    assert.equal(b.data.summary.battlePoints, E.bossPoints(b.data.result));
    assert.equal(b.data.result.manual, true);
  }
  await sleep(200);
  assert.equal((await api('/api/boss', { method: 'POST', token: t1, body: { fighterId: ids[2] } })).status, 429, '4e tentative refusée');
  await sleep(200);
  for (let i = 0; i < 2; i++) {
    const extra = await play(t1, { mode: 'solo', difficulty: 'cauchemar', fighterId: ids[1] });
    assert.equal(extra.status, 200, JSON.stringify(extra.data));
  }
  await sleep(200);
  const blocked = await api('/api/battle/start', { method: 'POST', token: t1, body: { mode: 'solo', difficulty: 'cauchemar', fighterId: ids[1] } });
  assert.equal(blocked.status, 429);
  const duel = await play(t1, { fighterId: ids[3], opponentId: ids[4] });
  assert.equal(duel.status, 200, JSON.stringify(duel.data));
  const meBefore = await api('/api/me', { token: t1 });
  const reset = await api('/api/challenge/new-run', { method: 'POST', token: t1 });
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.equal(reset.data.attemptsUsed, 0);
  assert.equal(reset.data.points, meBefore.data.profile.points);
  const tr = await api('/api/tournament', { method: 'POST', token: t1, body: { fighterId: ids[3] } });
  assert.equal(tr.status, 409);
  assert.match(tr.data.error, /pas encore disponible/);
  const j1 = await api('/api/pvp/join', { method: 'POST', token: t1, body: { fighterId: ids[4] } });
  const j2 = await api('/api/pvp/join', { method: 'POST', token: t2, body: { fighterId: ids[5] } });
  assert.equal(j1.data.status, 'pending');
  assert.equal(j2.data.interactive, false);
  assert.equal((await api('/api/pvp/status', { token: t1 })).data.status, 'pending');
  const shop = await api('/api/shop');
  assert.equal(shop.data.payments, 'off');
  assert.equal(shop.data.checkout, false);
  assert.equal(shop.data.products.find(p => p.id === 'personal-import').priceEur, 4.99);
  assert.equal(shop.data.products.every(p => p.purchasable === false), true);
  const offer = await api('/api/starter', { token: t2 });
  assert.equal(offer.status, 200);
  assert.equal(new Set(offer.data.offer).size, 3);
  const again = await api('/api/starter', { token: t2 });
  assert.deepEqual(again.data.offer, offer.data.offer);
  const bad = await api('/api/starter', { method: 'POST', token: t2, body: { id: '0001' } });
  if (!offer.data.offer.includes('0001')) assert.equal(bad.status, 400);
  const pick = offer.data.offer[0];
  const chose = await api('/api/starter', { method: 'POST', token: t2, body: { id: pick } });
  assert.equal(chose.status, 200);
  assert.equal(chose.data.chosen, pick);
  const other = offer.data.offer.find(id => id !== pick);
  assert.equal((await api('/api/starter', { method: 'POST', token: t2, body: { id: other } })).status, 409);
  const same = await api('/api/starter', { method: 'POST', token: t2, body: { id: pick } });
  assert.equal(same.status, 200);
});

test('intégrité : combats concurrents n’écartent pas le journal des statistiques', async () => {
  const w = Wallet.createRandom();
  const t = (await login(w)).token;
  const addr = w.address.toLowerCase();
  const first = await play(t, { fighterId: '0004', opponentId: '0002' });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  await sleep(200);
  const par = await Promise.all([1, 2, 3, 4].map(() => play(t, { fighterId: '0004', opponentId: '0002' })));
  assert.equal(par.filter(x => x.status === 200).length, 1);
  assert.ok(par.filter(x => x.status === 409 || x.status === 429).length >= 1);
  const me = await api('/api/me', { token: t });
  const fights = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(points),0) AS p FROM fights WHERE address = ?').bind(addr).first();
  assert.equal(fights.n, me.data.profile.battles);
  assert.equal(fights.p, me.data.profile.points);
  const chars = await db.prepare('SELECT xp FROM char_progress WHERE address = ? AND char_id = ?').bind(addr, '0004').first();
  assert.ok(chars && chars.xp > 0);
});

test('import personnel en ligne : pas de prix, pas de classé, fondateur inchangé', async () => {
  const anon = await api('/api/custom/import', { method: 'POST', body: { rarity: 'Légendaire', stats: { hp: 999 } } });
  assert.equal(anon.status, 401);
  const player = await api('/api/custom/import', { method: 'POST', token: pTok, body: { rarity: 'Légendaire', image: 'data:image/gif;base64,xx' } });
  assert.equal(player.status, 403);
  assert.match(player.data.error, /4,99 EUR/);
  assert.match(player.data.error, /paiement désactivé/);
  assert.equal(/paypal\.com|approve/i.test(player.data.error), false);
  const founder = await api('/api/custom/import', { method: 'POST', token: aTok, body: { rarity: 'Mythique' } });
  assert.equal(founder.status, 200);
  assert.equal(founder.data.accepted, false);
  assert.equal(founder.data.ranked, false);
  assert.equal(founder.data.localOnly, true);
  assert.equal(founder.data.pendingPayment, false);
  const ranked = await api('/api/battle/start', { method: 'POST', token: pTok, body: { fighterId: 'c-payant', rarity: 'Légendaire' } });
  assert.equal(ranked.status, 400);
  assert.match(ranked.data.error, /refusée en classé/);
  const boss = await api('/api/boss', { method: 'POST', token: aTok, body: { fighterId: 'c-fondateur' } });
  assert.equal(boss.status, 400);
  const players = await db.prepare('SELECT COUNT(*) AS n FROM players').first();
  assert.ok(players.n >= 1);
});
