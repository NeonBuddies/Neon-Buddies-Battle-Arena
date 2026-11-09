#!/usr/bin/env node
/* Configure le bot Telegram : webhook vers le Worker + liste des commandes.
   Les secrets sont lus dans les variables d'environnement au moment de l'exécution (jamais écrits dans un fichier).
   Usage :
     TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... WORKER_URL=https://neon-buddies-arena-api.TON-SOUS-DOMAINE.workers.dev \
     node scripts/setup-telegram.mjs */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const workerUrl = (process.env.WORKER_URL || '').replace(/\/+$/, '');
const base = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
if (!token || !secret || !workerUrl) {
  console.error('Variables requises : TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, WORKER_URL');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('TELEGRAM_WEBHOOK_SECRET : 1 à 256 caractères A-Z, a-z, 0-9, _ ou - uniquement.');
  process.exit(1);
}
async function call(method, payload) {
  const r = await fetch(`${base}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`${method} : ${j.description || r.status}`);
  return j.result;
}
await call('setWebhook', { url: workerUrl + '/telegram/webhook', secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
console.log('✔ Webhook configuré :', workerUrl + '/telegram/webhook');
await call('setMyCommands', { commands: [
  { command: 'start', description: 'Présentation / enregistrer le chat admin' },
  { command: 'status', description: 'Admin : demandes, stock, joueurs, victoires' },
  { command: 'rewards', description: 'Admin : demandes de NFT à valider' }
] });
console.log('✔ Commandes enregistrées : /start, /status, /rewards');
const info = await call('getWebhookInfo', {});
console.log('Webhook actuel :', info.url, '— en attente :', info.pending_update_count);
