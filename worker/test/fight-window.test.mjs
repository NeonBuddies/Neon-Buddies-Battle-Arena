import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_MIN_MS, fightWindow, clockNow } from '../src/fight-window.js';

test('fenêtre de combat : 2 min 30 en production, horloge de test ignorée', () => {
  assert.equal(PRODUCTION_MIN_MS, 150000);
  const prod = fightWindow({}, 1_000, '0');
  assert.equal(prod.minDurationMs, 150000);
  assert.equal(prod.readyAt, 151000);
  assert.ok(clockNow({}, '5') > 1_000_000);
});

test('fenêtre de combat : le harness peut raccourcir, jamais au-dessus de 150 s', () => {
  const fast = fightWindow({ HARNESS_FAST_FIGHT: '1', FIGHT_MIN_MS: '0' }, 50);
  assert.equal(fast.minDurationMs, 0);
  assert.equal(fast.readyAt, 50);
  const held = fightWindow({ HARNESS_FAST_FIGHT: '1', FIGHT_MIN_MS: '0' }, 50, '5000');
  assert.equal(held.minDurationMs, 5000);
  assert.equal(held.readyAt, 5050);
  const capped = fightWindow({ HARNESS_FAST_FIGHT: '1', FIGHT_MIN_MS: '0' }, 50, '999999');
  assert.equal(capped.minDurationMs, 0);
  assert.equal(clockNow({ HARNESS_FAST_FIGHT: '1' }, '80'), 80);
});
