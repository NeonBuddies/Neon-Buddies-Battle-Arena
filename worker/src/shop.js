/* Boutique cosmétique. Les prix viennent d'ici, jamais du client.
   PayPal est sandbox uniquement. PAYMENTS_ENABLED doit valoir "1" et un jeton sandbox
   doit être posé hors git. Sinon les routes disent que le paiement est en attente
   et n'appellent pas PayPal. Aucun point de classement n'est débité. */
import { randomHex } from './crypto.js';
import { isoWeek } from './v2text.js';

const CATALOG = [
  { sku: 'frame-neon', kind: 'frame', cents: 99, name: 'Cadre néon', css: 'cosmetic-frame-neon' },
  { sku: 'title-runner', kind: 'title', cents: 99, name: 'Titre coureur', css: 'cosmetic-title-runner' },
  { sku: 'fx-victory', kind: 'victory', cents: 199, name: 'Effet de victoire', css: 'cosmetic-fx-victory' },
  { sku: 'fx-spell', kind: 'spell', cents: 199, name: 'Effet de sort', css: 'cosmetic-fx-spell' },
  { sku: 'theme-arena', kind: 'theme', cents: 299, name: 'Thème d’arène', css: 'cosmetic-theme-arena' },
  { sku: 'banner-guild', kind: 'banner', cents: 299, name: 'Bannière de guilde', css: 'cosmetic-banner-guild' },
  { sku: 'import-cosmetic', kind: 'import', cents: 499, name: 'Import cosmétique', css: 'cosmetic-import', founderFree: true },
  { sku: 'frame-points', kind: 'frame', cents: null, points: 10, name: 'Cadre aux points', css: 'cosmetic-frame-points' }
];
const BY_SKU = new Map(CATALOG.map(item => [item.sku, item]));
const CURRENCY = 'EUR';

export class ShopError extends Error {
  constructor(status, msg) { super(msg); this.status = status; this.httpError = true; }
}

export function paymentsOpen(env) {
  return String(env && env.PAYMENTS_ENABLED || '') === '1' && !!env.PAYPAL_SANDBOX_ACCESS_TOKEN;
}

export function purchaseLimit(env) {
  const raw = env && env.COSMETIC_DAILY_PURCHASE_LIMIT;
  if (raw == null || String(raw).trim() === '') return { value: null, confirmed: false };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { value: null, confirmed: false };
  return { value: n, confirmed: String(env.COSMETIC_DAILY_PURCHASE_LIMIT_CONFIRMED || '') === '1' };
}

export function paypalBase(env) {
  const raw = env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
  let host = '';
  try { host = new URL(raw).hostname; } catch (e) { throw new ShopError(500, 'Hôte PayPal invalide'); }
  const local = host === '127.0.0.1' || host === 'localhost';
  const sandbox = host === 'api-m.sandbox.paypal.com' || host === 'api.sandbox.paypal.com';
  if (!sandbox && !local) throw new ShopError(403, 'PayPal hors sandbox refusé');
  return String(raw).replace(/\/+$/, '');
}

function assertOrigin(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) throw new ShopError(403, 'Origine refusée');
}

function euros(cents) { return (cents / 100).toFixed(2); }
function parseCents(value) {
  const s = String(value == null ? '' : value);
  if (!/^\d+\.\d{2}$/.test(s)) return null;
  return Number(s.slice(0, -3)) * 100 + Number(s.slice(-2));
}
function dayStart() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function balance(env, address) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM cosmetic_ledger WHERE address = ?1').bind(address).first();
  return row ? row.n : 0;
}

async function ownedMap(env, address) {
  const rows = await env.DB.prepare('SELECT sku, source, revoked_at FROM cosmetic_grants WHERE address = ?1').bind(address).all();
  const map = {};
  for (const row of rows.results) map[row.sku] = { source: row.source, revoked: !!row.revoked_at };
  return map;
}

function viewItem(item, own) {
  return {
    sku: item.sku, kind: item.kind, name: item.name, css: item.css,
    eur: item.cents == null ? null : euros(item.cents),
    points: item.points || null,
    founderFree: !!item.founderFree,
    powerBonus: false, rewardOddsBonus: false,
    owned: !!(own && !own.revoked)
  };
}

async function paypal(env, path, method, payload, requestId) {
  const headers = {
    'Authorization': 'Bearer ' + env.PAYPAL_SANDBOX_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const response = await fetch(paypalBase(env) + path, {
    method, headers, body: payload == null ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!response.ok) throw new ShopError(502, 'PayPal sandbox a refusé l’opération');
  return data;
}

export async function shopRoute(req, env, ctx, url, deps) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  if (method === 'POST' && path === '/api/paypal/webhook') return webhook(req, env);
  if (!path.startsWith('/api/v2/shop')) return undefined;
  if (method === 'POST') assertOrigin(req, env);
  const ip = req.headers.get('CF-Connecting-IP') || 'local';

  if (method === 'GET' && path === '/api/v2/shop') {
    await deps.rateLimit(env, 'shopread:' + ip, 60, 60);
    let sess = null;
    try { sess = await deps.auth(req, env); } catch (e) { sess = null; }
    return catalog(env, sess);
  }
  if (method === 'POST' && path === '/api/v2/shop/orders') return createOrder(env, deps, await deps.auth(req, env), await deps.body(req));
  if (method === 'POST' && path === '/api/v2/shop/orders/capture') return captureOrder(env, deps, await deps.auth(req, env), await deps.body(req));
  if (method === 'POST' && path === '/api/v2/shop/spend') return spendPoints(env, deps, await deps.auth(req, env), await deps.body(req));
  if (method === 'POST' && path === '/api/v2/shop/founder-import') return founderImport(env, deps, await deps.auth(req, env, true));
  throw new ShopError(404, 'Route inconnue');
}

async function catalog(env, sess) {
  const limit = purchaseLimit(env);
  const own = sess ? await ownedMap(env, sess.address) : {};
  const orders = sess ? await env.DB.prepare('SELECT id, sku, cents, currency, status, created_at FROM shop_orders WHERE address = ?1 ORDER BY created_at DESC LIMIT 20').bind(sess.address).all() : { results: [] };
  return {
    paymentsEnabled: paymentsOpen(env),
    sandboxOnly: true,
    currency: CURRENCY,
    purchaseLimit: limit.value,
    purchaseLimitConfirmed: limit.confirmed,
    competitivePointsUntouched: true,
    challenge: {
      id: 'manual-combat-daily',
      status: 'pending',
      pendingCodes: ['v1-manual-combat'],
      completed: false,
      rewardPoints: null,
      countsAutomaticFights: false
    },
    catalog: CATALOG.map(item => viewItem(item, own[item.sku])),
    orders: orders.results.map(row => ({ id: row.id, sku: row.sku, amount: euros(row.cents), currency: row.currency, status: row.status, createdAt: row.created_at })),
    cosmeticPoints: sess ? await balance(env, sess.address) : 0,
    week: isoWeek(Date.now())
  };
}

async function assertLimit(env, address) {
  const limit = purchaseLimit(env);
  if (limit.value == null) return;
  const n = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM shop_orders WHERE address = ?1 AND created_at >= ?2 AND status != 'failed'"
  ).bind(address, dayStart()).first();
  if (n.n >= limit.value) throw new ShopError(429, 'Limite d’achats configurée atteinte pour aujourd’hui.');
}

async function createOrder(env, deps, sess, body) {
  if (!paymentsOpen(env)) throw new ShopError(503, 'Paiement en attente : PayPal sandbox non connecté.');
  await deps.rateLimit(env, 'shoporder:' + sess.address, 8, 3600);
  const item = BY_SKU.get(String(body.sku || ''));
  if (!item || item.cents == null) throw new ShopError(400, 'Article inconnu');
  if (body.amount != null || body.currency != null || body.cents != null) throw new ShopError(400, 'Le prix est fixé par le serveur');
  const own = await ownedMap(env, sess.address);
  if (own[item.sku] && !own[item.sku].revoked) throw new ShopError(409, 'Déjà possédé');
  await assertLimit(env, sess.address);
  const id = randomHex(16);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO shop_orders (id, address, sku, cents, currency, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'created', ?6, ?6)`
  ).bind(id, sess.address, item.sku, item.cents, CURRENCY, now).run();
  const limit = purchaseLimit(env);
  if (limit.value != null) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM shop_orders WHERE address = ?1 AND created_at >= ?2 AND status != 'failed'").bind(sess.address, dayStart()).first();
    if (n.n > limit.value) {
      await env.DB.prepare("UPDATE shop_orders SET status = 'failed', updated_at = ?1 WHERE id = ?2 AND status = 'created'").bind(Date.now(), id).run();
      throw new ShopError(429, 'Limite d’achats configurée atteinte pour aujourd’hui.');
    }
  }
  let remote;
  try {
    remote = await paypal(env, '/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: id,
        custom_id: sess.address,
        description: item.sku,
        payee: env.PAYPAL_MERCHANT_ID ? { merchant_id: env.PAYPAL_MERCHANT_ID } : undefined,
        amount: { currency_code: CURRENCY, value: euros(item.cents) }
      }]
    }, id);
  } catch (e) {
    await env.DB.prepare("UPDATE shop_orders SET status = 'failed', updated_at = ?1 WHERE id = ?2 AND status = 'created'").bind(Date.now(), id).run();
    throw e;
  }
  if (!remote || !remote.id) {
    await env.DB.prepare("UPDATE shop_orders SET status = 'failed', updated_at = ?1 WHERE id = ?2").bind(Date.now(), id).run();
    throw new ShopError(502, 'PayPal sandbox a refusé l’opération');
  }
  await env.DB.prepare("UPDATE shop_orders SET paypal_order_id = ?1, updated_at = ?2 WHERE id = ?3 AND status = 'created'")
    .bind(remote.id, Date.now(), id).run();
  return { id, paypalOrderId: remote.id, status: 'created', amount: euros(item.cents), currency: CURRENCY, sandbox: true };
}

function captureMatches(order, remote, merchant) {
  const unit = remote && remote.purchase_units && remote.purchase_units[0];
  const capture = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  if (!capture || remote.status !== 'COMPLETED' || capture.status !== 'COMPLETED') return null;
  if (unit.reference_id !== order.id) return null;
  if (capture.custom_id && capture.custom_id !== order.address) return null;
  if (parseCents(capture.amount && capture.amount.value) !== order.cents) return null;
  if (!capture.amount || capture.amount.currency_code !== order.currency) return null;
  if (merchant && (!unit.payee || unit.payee.merchant_id !== merchant)) return null;
  if (!capture.id) return null;
  return capture;
}

async function grantCosmetic(env, order) {
  await env.DB.prepare(
    `INSERT INTO cosmetic_grants (address, sku, source, order_id, created_at)
     VALUES (?1, ?2, 'paypal', ?3, ?4)
     ON CONFLICT(address, sku) DO UPDATE SET source = 'paypal', order_id = excluded.order_id, revoked_at = NULL, created_at = excluded.created_at`
  ).bind(order.address, order.sku, order.id, Date.now()).run();
}

async function deliver(env, order, captureId) {
  const row = await env.DB.prepare('SELECT status, capture_id FROM shop_orders WHERE id = ?1').bind(order.id).first();
  if (row && row.status === 'delivered' && row.capture_id === captureId) return { already: true };
  if (row && row.status === 'delivering' && row.capture_id === captureId) {
    await grantCosmetic(env, order);
    await env.DB.prepare("UPDATE shop_orders SET status = 'delivered', updated_at = ?1 WHERE id = ?2 AND status = 'delivering'").bind(Date.now(), order.id).run();
    return { already: false };
  }
  const marked = await env.DB.prepare(
    "UPDATE shop_orders SET status = 'delivering', capture_id = ?1, updated_at = ?2 WHERE id = ?3 AND status = 'created' AND capture_id IS NULL"
  ).bind(captureId, Date.now(), order.id).run();
  if (!marked.meta.changes) {
    const again = await env.DB.prepare('SELECT status, capture_id FROM shop_orders WHERE id = ?1').bind(order.id).first();
    if (again && again.capture_id === captureId && (again.status === 'delivered' || again.status === 'delivering')) {
      if (again.status === 'delivering') {
        await grantCosmetic(env, order);
        await env.DB.prepare("UPDATE shop_orders SET status = 'delivered', updated_at = ?1 WHERE id = ?2 AND status = 'delivering'").bind(Date.now(), order.id).run();
      }
      return { already: true };
    }
    throw new ShopError(409, 'Commande déjà traitée');
  }
  await grantCosmetic(env, order);
  await env.DB.prepare("UPDATE shop_orders SET status = 'delivered', updated_at = ?1 WHERE id = ?2 AND status = 'delivering'").bind(Date.now(), order.id).run();
  return { already: false };
}

async function captureOrder(env, deps, sess, body) {
  if (!paymentsOpen(env)) throw new ShopError(503, 'Paiement en attente : PayPal sandbox non connecté.');
  await deps.rateLimit(env, 'shopcap:' + sess.address, 12, 3600);
  const id = String(body.id || '');
  const order = await env.DB.prepare('SELECT * FROM shop_orders WHERE id = ?1').bind(id).first();
  if (!order || order.address !== sess.address) throw new ShopError(404, 'Commande introuvable');
  if (!order.paypal_order_id) throw new ShopError(409, 'Commande incomplète');
  if (order.status === 'delivered') return { id, status: 'delivered', already: true };
  if (order.status === 'refunded') throw new ShopError(409, 'Commande remboursée');
  const remote = await paypal(env, '/v2/checkout/orders/' + encodeURIComponent(order.paypal_order_id) + '/capture', 'POST', {}, order.id);
  const capture = captureMatches(order, remote, env.PAYPAL_MERCHANT_ID || '');
  if (!capture) throw new ShopError(409, 'Montant, monnaie ou compte ne correspond pas');
  const out = await deliver(env, order, capture.id);
  return { id, status: 'delivered', already: out.already, sandbox: true };
}

async function spendPoints(env, deps, sess, body) {
  await deps.rateLimit(env, 'shopspend:' + sess.address, 10, 3600);
  const item = BY_SKU.get(String(body.sku || ''));
  if (!item || !item.points) throw new ShopError(400, 'Article inconnu');
  const own = await ownedMap(env, sess.address);
  if (own[item.sku] && !own[item.sku].revoked) return { sku: item.sku, already: true };
  const id = 'spend:' + item.sku + ':' + sess.address;
  const existing = await env.DB.prepare('SELECT id FROM cosmetic_ledger WHERE id = ?1').bind(id).first();
  if (!existing) {
    const ins = await env.DB.prepare(
      `INSERT INTO cosmetic_ledger (id, address, delta, reason, created_at)
       SELECT ?1, ?2, ?3, 'spend', ?4
       WHERE (SELECT COALESCE(SUM(delta), 0) FROM cosmetic_ledger WHERE address = ?2) >= ?5
         AND NOT EXISTS (SELECT 1 FROM cosmetic_grants WHERE address = ?2 AND sku = ?6 AND revoked_at IS NULL)`
    ).bind(id, sess.address, -item.points, Date.now(), item.points, item.sku).run();
    if (!ins.meta.changes) throw new ShopError(409, 'Points cosmétiques insuffisants');
  }
  await env.DB.prepare(
    `INSERT INTO cosmetic_grants (address, sku, source, order_id, created_at) VALUES (?1, ?2, 'points', NULL, ?3)
     ON CONFLICT(address, sku) DO UPDATE SET revoked_at = NULL`
  ).bind(sess.address, item.sku, Date.now()).run();
  const player = await env.DB.prepare('SELECT points FROM players WHERE address = ?1').bind(sess.address).first();
  return { sku: item.sku, cosmeticPoints: await balance(env, sess.address), competitivePoints: player ? player.points : 0 };
}

async function founderImport(env, deps, sess) {
  if (!deps.isFounder(env, sess.address) || !sess.is_admin) throw new ShopError(403, 'Réservé au fondateur signé');
  await env.DB.prepare(
    `INSERT INTO cosmetic_grants (address, sku, source, order_id, created_at) VALUES (?1, 'import-cosmetic', 'founder', NULL, ?2)
     ON CONFLICT(address, sku) DO UPDATE SET source = 'founder', revoked_at = NULL`
  ).bind(sess.address, Date.now()).run();
  const player = await env.DB.prepare('SELECT points, wins FROM players WHERE address = ?1').bind(sess.address).first();
  return { sku: 'import-cosmetic', source: 'founder', payment: false, competitivePoints: player ? player.points : 0, wins: player ? player.wins : 0 };
}

async function revoke(env, captureId) {
  const order = await env.DB.prepare('SELECT * FROM shop_orders WHERE capture_id = ?1').bind(captureId).first();
  if (!order) return false;
  await env.DB.prepare("UPDATE shop_orders SET status = 'refunded', updated_at = ?1 WHERE id = ?2 AND status = 'delivered'")
    .bind(Date.now(), order.id).run();
  await env.DB.prepare('UPDATE cosmetic_grants SET revoked_at = ?1 WHERE address = ?2 AND sku = ?3 AND revoked_at IS NULL')
    .bind(Date.now(), order.address, order.sku).run();
  return true;
}

async function webhook(req, env) {
  if (!paymentsOpen(env) || !env.PAYPAL_SANDBOX_WEBHOOK_ID) throw new ShopError(503, 'Paiement en attente : PayPal sandbox non connecté.');
  const raw = await req.text();
  if (raw.length > 100000) throw new ShopError(413, 'Requête trop grande');
  let event;
  try { event = JSON.parse(raw); } catch (e) { throw new ShopError(400, 'JSON invalide'); }
  const verify = await paypal(env, '/v1/notifications/verify-webhook-signature', 'POST', {
    auth_algo: req.headers.get('paypal-auth-algo') || '',
    cert_url: req.headers.get('paypal-cert-url') || '',
    transmission_id: req.headers.get('paypal-transmission-id') || '',
    transmission_sig: req.headers.get('paypal-transmission-sig') || '',
    transmission_time: req.headers.get('paypal-transmission-time') || '',
    webhook_id: env.PAYPAL_SANDBOX_WEBHOOK_ID,
    webhook_event: event
  });
  if (!verify || verify.verification_status !== 'SUCCESS') throw new ShopError(401, 'Signature PayPal refusée');
  const eventId = String(event.id || '');
  if (!eventId) throw new ShopError(400, 'Événement incomplet');
  const seen = await env.DB.prepare('SELECT id FROM shop_events WHERE id = ?1').bind(eventId).first();
  if (seen) return { ok: true, duplicate: true };
  const type = String(event.event_type || '');
  const resource = event.resource || {};
  if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
    await revoke(env, resource.id || '');
  } else if (type === 'PAYMENT.CAPTURE.COMPLETED') {
    const related = resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id;
    const row = await env.DB.prepare('SELECT * FROM shop_orders WHERE paypal_order_id = ?1').bind(String(related || '')).first();
    const amount = resource.amount || {};
    if (row && row.status === 'created' && parseCents(amount.value) === row.cents && amount.currency_code === row.currency && resource.id) {
      await deliver(env, row, resource.id);
    }
  }
  await env.DB.prepare('INSERT OR IGNORE INTO shop_events (id, created_at) VALUES (?1, ?2)').bind(eventId, Date.now()).run();
  return { ok: true };
}
