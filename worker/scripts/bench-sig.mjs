#!/usr/bin/env node
/* Temps CPU local de la récupération ECDSA (même code que le Worker) et sondage WebCrypto.
   Ce n'est pas le compteur CPU Cloudflare. La limite gratuite des Workers est de 10 ms de CPU par requête.
   Aucune transaction. */
import { recoverAddress } from '../src/crypto.js';
import { Wallet } from 'ethers';

const w = Wallet.createRandom();
const message = 'NEON BUDDIES bench';
const sig = await w.signMessage(message);
recoverAddress(message, sig); // échauffement
const samples = [];
for (let i = 0; i < 30; i++) {
  const t = performance.now();
  const addr = recoverAddress(message, sig);
  samples.push(performance.now() - t);
  if (!addr || addr.toLowerCase() !== w.address.toLowerCase()) throw new Error('récupération incorrecte');
}
samples.sort((a, b) => a - b);
const med = samples[Math.floor(samples.length / 2)];
const p95 = samples[Math.floor(samples.length * 0.95)];
const curves = {};
for (const namedCurve of ['P-256', 'secp256k1', 'K-256']) {
  try {
    await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve }, false, ['sign', 'verify']);
    curves[namedCurve] = true;
  } catch (e) {
    curves[namedCurve] = false;
  }
}
console.log(JSON.stringify({
  samples: samples.length,
  medianMs: Number(med.toFixed(3)),
  p95Ms: Number(p95.toFixed(3)),
  maxMs: Number(samples[samples.length - 1].toFixed(3)),
  webcryptoEcdsa: curves,
  note: 'secp256k1 absent de WebCrypto : la vérification reste en JavaScript (@noble/curves). Si le CPU Worker dépasse 10 ms, la requête est coupée (échec fermé), pas contournée.'
}, null, 2));
