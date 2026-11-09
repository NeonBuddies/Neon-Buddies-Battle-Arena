import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capDamage, cleanMessage, cleanLabel, saturdayWindow, schedulerEnabled, RAID_SPECS, isoWeek } from '../src/v2text.js';
import { paymentsOpen, purchaseLimit, paypalBase } from '../src/shop.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('plafonds de raid : un coup planifié ne vide pas le boss', () => {
  for (const [name, spec] of Object.entries(RAID_SPECS)) {
    assert.ok(spec.cap < spec.hp, name);
    assert.equal(capDamage(spec.hp * 5, spec.cap), spec.cap);
    assert.equal(capDamage(0, spec.cap), 1);
  }
});

test('texte : balises retirées, longueur, pseudo', () => {
  const x = cleanMessage('<script>alert(1)</script>');
  assert.equal(x.error, undefined);
  assert.equal(x.text.includes('<'), false);
  assert.equal(x.text.includes('>'), false);
  assert.equal(cleanMessage('   ').error, 'Message vide');
  assert.equal(cleanMessage('a'.repeat(281)).error, 'Message trop long');
  assert.equal(cleanLabel('  Guilde <b>  ', 3, 24), 'Guilde b');
  assert.equal(cleanLabel('ab', 3, 24), null);
});

test('calendrier samedi 18:00 UTC, pas un minuteur aléatoire', () => {
  const now = Date.UTC(2026, 10, 9, 12, 0, 0);
  const w = saturdayWindow(now);
  assert.equal(new Date(w.opensAt).toISOString(), '2026-11-14T18:00:00.000Z');
  assert.equal(w.startsAt - w.opensAt, 20 * 60 * 1000);
  assert.equal(w.size, 8);
  assert.equal(w.source, 'calendar-saturday-18:00Z');
  const after = saturdayWindow(w.startsAt + 1000);
  assert.equal(new Date(after.opensAt).toISOString(), '2026-11-21T18:00:00.000Z');
  assert.equal(isoWeek(now), '2026-W46');
});

test('planificateur éteint par défaut, courbe non importée par la communauté', () => {
  assert.equal(schedulerEnabled({}), false);
  assert.equal(schedulerEnabled({ V2_SCHEDULER: '0' }), false);
  assert.equal(schedulerEnabled({ V2_SCHEDULER: '1' }), true);
  const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  assert.match(toml, /V2_SCHEDULER = "0"/);
  assert.match(toml, /REAL_CLAIMS = "0"/);
  assert.match(toml, /PAYMENTS_ENABLED = "0"/);
  assert.match(toml, /api-m\.sandbox\.paypal\.com/);
  assert.doesNotMatch(toml, /api-m\.paypal\.com/);
  assert.equal(paymentsOpen({ PAYMENTS_ENABLED: '0', PAYPAL_SANDBOX_ACCESS_TOKEN: 'x' }), false);
  assert.equal(paymentsOpen({ PAYMENTS_ENABLED: '1' }), false);
  assert.equal(purchaseLimit({}).confirmed, false);
  assert.equal(purchaseLimit({ COSMETIC_DAILY_PURCHASE_LIMIT: '3' }).value, 3);
  assert.equal(purchaseLimit({ COSMETIC_DAILY_PURCHASE_LIMIT: '3' }).confirmed, false);
  assert.throws(() => paypalBase({ PAYPAL_API_BASE: 'https://api-m.paypal.com' }));
  assert.doesNotMatch(toml, /\[triggers\]/);
  const community = fs.readFileSync(path.join(root, 'src/community.js'), 'utf8');
  assert.doesNotMatch(community, /secp256k1|ecdsa\.js/);
  const index = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
  assert.match(index, /import\('\.\/ecdsa\.js'\)/);
  assert.match(index, /import\('\.\/community\.js'\)/);
  const mig = fs.readFileSync(path.join(root, 'migrations/0002_community_v2.sql'), 'utf8');
  assert.doesNotMatch(mig.replace(/--.*$/gm, ''), /\bDROP\b|\bALTER\b/i);
});
