#!/usr/bin/env node
/* Smoke test d'authentification contre un Worker déjà joignable.
   Crée un EOA temporaire (ethers Wallet.createRandom) : aucun financement, aucune transaction.
   Mesure le temps de nonce + personal_sign + verify. Échec fermé si le serveur ne répond pas.
   Usage :
     WORKER_URL=https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev node scripts/auth-smoke.mjs
   Ne lit aucun secret. N'envoie rien sur la chaîne. */
import { Wallet } from 'ethers';

const url = (process.env.WORKER_URL || 'https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev').replace(/\/+$/, '');
const rpc = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const founder = '0xCABB7fe1C84AaC98E8905aB0809129e4f5031635';

async function rpcCall(method, params) {
  const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'rpc');
  return j.result;
}

console.log('Lecture seule Robinhood Chain (aucune transaction)');
try {
  const chain = await rpcCall('eth_chainId', []);
  const code = await rpcCall('eth_getCode', [founder, 'latest']);
  const delegation = /^0xef0100[0-9a-f]{40}$/i.test(code);
  console.log(JSON.stringify({
    liveRpc: true,
    chainId: parseInt(chain, 16),
    founder,
    codePrefix: code.slice(0, 10),
    eip7702: delegation,
    implementation: delegation ? '0x' + code.slice(8) : null
  }));
} catch (e) {
  console.log(JSON.stringify({ liveRpc: false, error: String(e.message || e) }));
}

console.log('Auth smoke (EOA temporaire, pas de transaction) →', url);
const wallet = Wallet.createRandom();
const t0 = performance.now();
let health;
try {
  const r = await fetch(url + '/api/health', { cache: 'no-store' });
  health = { status: r.status, body: await r.json().catch(() => null) };
} catch (e) {
  console.log(JSON.stringify({ backend: 'unreachable', url, error: String(e.message || e), note: 'Le Worker n’est pas vérifié en ligne. Ce n’est pas un succès.' }));
  process.exit(2);
}
if (!health.body || health.body.ok !== true) {
  console.log(JSON.stringify({ backend: 'not-ok', health, note: 'Réponse inattendue. Ce n’est pas un succès.' }));
  process.exit(2);
}
const tHealth = performance.now();
const nonceRes = await fetch(url + '/api/auth/nonce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet.address }) });
const nonce = await nonceRes.json().catch(() => null);
if (!nonceRes.ok) {
  console.log(JSON.stringify({ step: 'nonce', status: nonceRes.status, body: nonce, ms: Math.round(performance.now() - t0) }));
  process.exit(1);
}
const tNonce = performance.now();
const signature = await wallet.signMessage(nonce.message);
const tSign = performance.now();
const verRes = await fetch(url + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet.address, nonce: nonce.nonce, signature }) });
const ver = await verRes.json().catch(() => null);
const tVer = performance.now();
const replay = await fetch(url + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet.address, nonce: nonce.nonce, signature }) });
console.log(JSON.stringify({
  backend: verRes.ok ? 'auth-ok' : 'auth-failed',
  address: wallet.address,
  funded: false,
  transactionSent: false,
  healthMs: Math.round(tHealth - t0),
  nonceMs: Math.round(tNonce - tHealth),
  signMs: Math.round(tSign - tNonce),
  verifyMs: Math.round(tVer - tSign),
  totalMs: Math.round(tVer - t0),
  verifyStatus: verRes.status,
  isAdmin: ver && ver.isAdmin,
  realClaims: health.body.realClaims,
  audited: health.body.audited,
  replayStatus: replay.status
}, null, 2));
if (!verRes.ok || replay.status !== 401 || ver.isAdmin) process.exit(1);
