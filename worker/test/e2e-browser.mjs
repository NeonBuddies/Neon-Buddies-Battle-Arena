/* Test de bout en bout navigateur (Chromium headless) : site statique + Worker local (wrangler dev) + wallets de test.
   - RPC Robinhood Chain RÉEL en lecture seule pour le panneau on-chain (chainId, name, ownerOf).
   - RPC simulé pour le flux admin (aucune transaction n'est jamais diffusée).
   - API Telegram simulée.
   Usage : CHROME=/chemin/chrome node test/e2e-browser.mjs   (site servi sur http://127.0.0.1:8765) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import { Wallet, Interface, zeroPadValue, toBeHex, getBytes, toUtf8String } from 'ethers';
import { chromium } from 'playwright-core';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const SHOTS = path.join(root, '..', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const SITE = process.env.SITE || 'http://127.0.0.1:8765';
const PORT = 8890;
const API = `http://127.0.0.1:${PORT}`;
const REAL_ADMIN = '0xcabb7fe1c84aac98e8905ab0809129e4f5031635';
const CONTRACT = '0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc';
const admin = Wallet.createRandom(), player = Wallet.createRandom(), intruder = Wallet.createRandom(), p2 = Wallet.createRandom(), p3 = Wallet.createRandom();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = [];
const check = (ok, label) => { report.push((ok ? '✔ ' : '✖ ') + label); console.log((ok ? '✔ ' : '✖ ') + label); if (!ok) process.exitCode = 1; };

/* ---- RPC + Telegram simulés ---- */
const mock = { owners: {}, receipts: {}, tg: [], sent: [] };
const server = http.createServer((req, res) => {
  let data = ''; req.on('data', c => data += c);
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') return res.end();
    const j = data ? JSON.parse(data) : {};
    if (req.url.startsWith('/bot')) { mock.tg.push({ method: req.url.split('/')[2], body: j }); return res.end(JSON.stringify({ ok: true, result: {} })); }
    let result = null;
    if (j.method === 'eth_chainId') result = '0x1237';
    if (j.method === 'eth_getCode') result = '0x';
    if (j.method === 'eth_call') {
      if (j.params[0].data.startsWith('0x6352211e')) result = zeroPadValue(mock.owners[parseInt(j.params[0].data.slice(10), 16)] || admin.address, 32);
      else result = '0x' + '0'.repeat(62) + '20' + '0'.repeat(63) + 'e' + Buffer.from('Neon buddies 2').toString('hex').padEnd(64, '0');
    }
    if (j.method === 'eth_getTransactionReceipt') result = mock.receipts[j.params[0]] || null;
    if (j.method === 'eth_blockNumber') result = '0x1';
    res.end(JSON.stringify({ jsonrpc: '2.0', id: j.id, result }));
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const MOCK = `http://127.0.0.1:${server.address().port}`;

/* ---- Worker local ---- */
execSync('npx wrangler deploy --dry-run --outdir dist', { cwd: root, stdio: 'ignore' });
fs.mkdirSync(path.join(root, '.wrangler'), { recursive: true });
const persist = fs.mkdtempSync(path.join(root, '.wrangler', 'e2e-'));
execSync(`npx wrangler d1 execute neon-buddies-arena --local --persist-to ${persist} --file schema.sql`, { cwd: root, stdio: 'ignore' });
const sql = q => execSync(`npx wrangler d1 execute neon-buddies-arena --local --persist-to ${persist} --json --command ${JSON.stringify(q)}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const vars = {
  ADMIN_ADDRESS: admin.address, CHAIN_ID: '4663', RPC_URL: MOCK + '/rpc', NFT_CONTRACT: CONTRACT, ALLOWED_ORIGINS: SITE,
  FIGHT_MIN_INTERVAL_MS: '150', HARNESS_FAST_FIGHT: '1', FIGHT_MIN_MS: '150000', CHECK_ONCHAIN: '1', TELEGRAM_API_BASE: MOCK, TELEGRAM_BOT_TOKEN: '1:FAUX', TELEGRAM_ADMIN_CHAT_ID: '42',
  TELEGRAM_WEBHOOK_SECRET: 'x', TELEGRAM_NOTIFY_VICTORIES: '0', PUBLIC_SITE_URL: SITE + '/', PVP_TIMEOUT_SEC: '4', REAL_CLAIMS: '1'
};
const args = ['wrangler', 'dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', persist, '--show-interactive-dev-session=false'];
for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
const dev = spawn('npx', args, { cwd: root, detached: true, stdio: 'ignore', env: Object.assign({}, process.env, { TELEGRAM_BOT_TOKEN: '' }) });
for (let i = 0; i < 120; i++) { try { if ((await fetch(API + '/api/health')).ok) break; } catch (e) {} await sleep(500); }

const configJs = (rpc) => `window.NB_CONFIG = { API_URL: '${API}', CHAIN_ID: 4663, CHAIN_NAME: 'Robinhood Chain', RPC_URL: '${rpc}', EXPLORER: 'https://robinhoodchain.blockscout.com', NFT_CONTRACT: '${CONTRACT}', ADMIN_ADDRESS: '${admin.address}' };`;

/* ---- wallet de test injecté (EIP-1193), adossé à une clé locale éphémère ---- */
async function withWallet(ctx, wallet, startChain) {
  let chain = startChain, added = startChain === '0x1237', authorized = false;
  await ctx.exposeFunction('__nbWallet', async (method, params) => {
    if (method === 'eth_requestAccounts') { authorized = true; return [wallet.address]; }
    if (method === 'eth_accounts') return authorized ? [wallet.address] : [];
    if (method === 'eth_chainId') return chain;
    if (method === 'wallet_switchEthereumChain') { if (!added) return { __err: { code: 4902, message: 'Unrecognized chain ID' } }; chain = params[0].chainId; return null; }
    if (method === 'wallet_addEthereumChain') { mock.addChain = params[0]; added = true; chain = params[0].chainId; return null; }
    if (method === 'personal_sign') return wallet.signMessage(getBytes(params[0]));
    if (method === 'wallet_revokePermissions') return null;
    if (method === 'eth_sendTransaction') {
      // NE DIFFUSE RIEN : on enregistre la transaction et on simule sa confirmation.
      const tx = params[0]; mock.sent.push(tx);
      const hash = '0x' + Buffer.from(String(Date.now())).toString('hex').padEnd(64, '7');
      const iface = new Interface(['function safeTransferFrom(address,address,uint256)']);
      const [from, to, id] = iface.decodeFunctionData('safeTransferFrom', tx.data);
      mock.owners[Number(id)] = to;
      mock.receipts[hash] = { status: '0x1', logs: [{ address: CONTRACT, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', zeroPadValue(from, 32), zeroPadValue(to, 32), zeroPadValue(toBeHex(id), 32)], data: '0x' }] };
      return hash;
    }
    return { __err: { code: 4200, message: 'non géré ' + method } };
  });
  await ctx.addInitScript(() => {
    window.__NB_TEST_CLOCK = window.__NB_TEST_CLOCK || { fightMs: 0, stepMs: 5000 };
    const ls = {};
    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => { const r = await window.__nbWallet(method, params || []); if (r && r.__err) { const e = new Error(r.__err.message); e.code = r.__err.code; throw e; } if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') (ls.chainChanged || []).forEach(f => f('0x1237')); return r; },
      on: (ev, f) => { (ls[ev] = ls[ev] || []).push(f); }, removeListener: () => {}
    };
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const mobile = { locale: 'fr-FR', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };
const errors = [];
function watch(page, label) {
  page.on('pageerror', e => errors.push(label + ' pageerror ' + e.message));
  // Les réponses 403/409 volontairement provoquées par les tests de sécurité ne sont pas des erreurs JavaScript.
  page.on('console', m => { if (m.type() === 'error' && !/status of (403|409)/.test(m.text())) errors.push(label + ' console ' + m.text()); });
}

try {
  /* 1. Android sans wallet : lien profond MetaMask + lecture RÉELLE de Robinhood Chain */
  {
    const ctx = await browser.newContext(mobile);
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: configJs('https://rpc.mainnet.chain.robinhood.com') }));
    const page = await ctx.newPage(); watch(page, 'android-sans-wallet');
    await page.goto(SITE + '/#recompenses');
    await page.waitForSelector('#mm-deeplink');
    const href = await page.$eval('#mm-deeplink', a => a.href);
    check(href === 'https://metamask.app.link/dapp/127.0.0.1:8765/', 'Émulation Chromium mobile (pas un téléphone) : lien MetaMask → ' + href);
    await page.waitForFunction(() => /Nom on-chain/.test(document.querySelector('#onchain').textContent), null, { timeout: 30000 });
    const txt = await page.$eval('#onchain', e => e.innerText.replace(/\s+/g, ' '));
    check(/4663 ✓/.test(txt), 'RPC réel : eth_chainId = 4663');
    check(/Neon buddies 2/i.test(txt), 'RPC réel : name() du contrat NB2 = « Neon buddies 2 »');
    // ownerOf réel depuis le code navigateur
    await page.fill('#onchain-id', '7'); await page.click('#onchain-form button');
    await page.waitForFunction(() => /Token #7 :/.test(document.querySelector('#onchain-owner')?.textContent || ''), null, { timeout: 30000 });
    const owner = await page.evaluate(() => window.NBWeb3.ownerOf(7));
    check(owner === REAL_ADMIN, 'RPC réel : ownerOf(7) = 0xCABB…1635 (admin réel) → ' + owner);
    const ow = await page.evaluate(async () => { const out = []; for (const id of [1, 50, 100]) out.push(await window.NBWeb3.ownerOf(id)); return out; });
    check(ow.every(o => o === REAL_ADMIN), 'RPC réel : tokens #1, #50, #100 détenus par l’admin');
    const uri = await page.evaluate(() => window.NBWeb3.tokenURI(1));
    check(uri === 'ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/1.json', 'RPC réel : tokenURI(1) = ' + uri);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 412);
    check(overflow <= 0, 'Émulation mobile : aucun débordement horizontal (viewport seulement)');
    await page.screenshot({ path: path.join(SHOTS, 'mobile-recompenses-sans-wallet.png') });
    await ctx.close();
  }

  /* 2. Joueur sur Android : connexion, ajout du réseau 4663, signature, combats classés, récompense, réclamation */
  let rewardId;
  {
    const ctx = await browser.newContext(mobile);
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: configJs(MOCK + '/rpc') }));
    await withWallet(ctx, player, '0x1');
    const page = await ctx.newPage(); watch(page, 'joueur');
    await page.goto(SITE + '/#recompenses');
    await page.click('[data-w="connect"]');
    await page.waitForSelector('[data-w="switch"]');
    check(await page.$eval('#wallet-status', e => /autre réseau \(1\)/.test(e.textContent)), 'Wallet connecté sur un autre réseau détecté');
    await page.click('[data-w="switch"]');
    await page.waitForFunction(() => /Robinhood Chain \(4663\)/.test(document.querySelector('#wallet-status').textContent));
    check(mock.addChain && mock.addChain.chainId === '0x1237' && mock.addChain.rpcUrls[0] === MOCK + '/rpc' && mock.addChain.nativeCurrency.symbol === 'ETH', 'wallet_addEthereumChain demandé (code 4902) avec chainId 0x1237 / ETH');
    await page.click('[data-w="signin"]');
    await page.waitForFunction(() => /✓ connecté/.test(document.querySelector('#wallet-status').textContent));
    check(true, 'Connexion par signature (personal_sign) acceptée par le serveur');
    await page.click('[data-nav="arene"]');
    await page.waitForSelector('#ranked-wrap:not([hidden])');
    await page.click('[data-random="A"]');
    await page.click('#btn-fight');
    await page.waitForSelector('#btn-attack', { timeout: 15000 });
    for (let n = 0; n < 70; n++) {
      const done = await page.evaluate(() => { const result = document.querySelector('#result'); if (result && !result.hidden) return true; const b = document.querySelector('#btn-attack'); if (b) b.click(); return false; });
      if (done) break;
      await page.waitForTimeout(120);
    }
    await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
    const resTxt = await page.$eval('#result-box', e => e.innerText);
    check(/Points classés \(serveur\)/.test(resTxt), 'Combat classé : résultat calculé et renvoyé par le serveur');
    await page.screenshot({ path: path.join(SHOTS, 'mobile-resultat-classe.png') });
    await page.click('[data-res="setup"]');
    // Fixture : on rapproche le joueur du seuil de 3 000 points
    sql(`UPDATE players SET points = 2995 WHERE address = '${player.address.toLowerCase()}'`);
    let unlocked = false;
    for (let i = 0; i < 12 && !unlocked; i++) {
      await sleep(200);
      await page.click('#btn-fight');
      await page.waitForSelector('#btn-attack', { timeout: 15000 });
      for (let n = 0; n < 70; n++) {
        const done = await page.evaluate(() => { const result = document.querySelector('#result'); if (result && !result.hidden) return true; const b = document.querySelector('#btn-attack'); if (b) b.click(); return false; });
        if (done) break;
        await page.waitForTimeout(120);
      }
      await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
      unlocked = /Récompense NFT Commun débloquée/.test(await page.$eval('#result-box', e => e.innerText));
      if (unlocked) await page.screenshot({ path: path.join(SHOTS, 'mobile-recompense-debloquee.png') });
      await page.click('[data-res="setup"]');
    }
    check(unlocked, 'Récompense NFT « Commun » débloquée après 3 000 points');
    await page.click('[data-nav="recompenses"]');
    await page.waitForSelector('[data-claim]');
    rewardId = await page.$eval('[data-claim]', b => b.getAttribute('data-claim'));
    await page.click('[data-claim]');
    await page.waitForFunction(() => /En attente de validation/.test(document.querySelector('#my-rewards').textContent));
    check(true, 'Réclamation envoyée : statut « En attente de validation », NFT réservé');
    await sleep(300);
    check(mock.tg.some(m => /Nouvelle demande de NFT/.test(m.body.text || '')), 'Notification Telegram (simulée) envoyée à l’admin');
    const again = await page.evaluate(async (id) => { try { await window.NBWeb3.api('/api/rewards/' + encodeURIComponent(id) + '/claim', { method: 'POST', body: {} }); return 'ok'; } catch (e) { return e.status; } }, rewardId);
    check(again === 409, 'Double réclamation depuis le navigateur refusée (409)');
    const lb = await page.$$eval('#players-lb li', l => l.map(x => x.innerText));
    check(lb.length >= 1 && lb[0].includes('3'), 'Classement des joueurs affiché : ' + lb[0].replace(/\s+/g, ' '));
    check(await page.$$eval('#missions li', l => l.length) === 3, '3 missions du jour affichées (serveur)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, 'mobile-recompenses-joueur.png'), fullPage: true });
    check(await page.evaluate(() => document.documentElement.scrollWidth - 412) <= 0, 'Émulation mobile : page Récompenses sans débordement (viewport seulement)');
    // Le joueur tente l'espace admin
    await page.goto(SITE + '/#admin');
    await page.waitForSelector('#admin-gate');
    check(/n’est pas l’administrateur/.test(await page.$eval('#admin-gate', e => e.textContent)), 'Espace admin refusé dans l’interface pour un joueur');
    const forced = await page.evaluate(async () => { try { await window.NBWeb3.api('/api/admin/rewards'); return 'ok'; } catch (e) { return e.status; } });
    check(forced === 403, 'API admin appelée directement par un joueur : 403 (contrôle serveur)');
    await ctx.close();
  }

  /* 3. Intrus qui se fait passer pour l'admin : la signature ne correspond pas */
  {
    const r1 = await fetch(API + '/api/auth/nonce', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ address: admin.address }) }).then(r => r.json());
    const r2 = await fetch(API + '/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ address: admin.address, nonce: r1.nonce, signature: await intruder.signMessage(r1.message) }) });
    check(r2.status === 401, 'Signature d’un autre wallet pour l’adresse admin : refusée (401)');
  }

  /* 4. Admin (bureau) : connexion signée, validation, ownerOf, préparation et signature du transfert, vérification */
  {
    const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1366, height: 900 } });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: configJs(MOCK + '/rpc') }));
    await withWallet(ctx, admin, '0x1237');
    const page = await ctx.newPage(); watch(page, 'admin');
    await page.goto(SITE + '/#admin');
    await page.click('[data-w="connect"]');
    await page.waitForSelector('[data-w="signin"]');
    await page.click('[data-w="signin"]');
    await page.waitForSelector('#admin-area:not([hidden]) [data-aact="approve"]');
    check(await page.$eval('#nav-badge', b => !b.hidden && Number(b.textContent) >= 1), 'Badge admin : demande en attente signalée');
    await page.click('[data-aact="approve"]');
    await page.waitForSelector('[data-send]:not([disabled])');
    const box = await page.$eval('.tx-box', e => e.innerText);
    check(/ownerOf\(#1\) : ✓ admin/.test(box), 'ownerOf vérifié avant envoi (token #1 détenu par l’admin)');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-admin-transfert.png') });
    await page.click('[data-send]');
    await page.waitForFunction(() => /Transfert vérifié sur la blockchain/.test(document.querySelector('.tx-msg')?.textContent || ''), null, { timeout: 60000 });
    const tx = mock.sent[0];
    const iface = new Interface(['function safeTransferFrom(address,address,uint256)']);
    check(tx && tx.to === CONTRACT && tx.from === admin.address.toLowerCase() && tx.data === iface.encodeFunctionData('safeTransferFrom', [admin.address, player.address, 1]).toLowerCase() && tx.value === '0x0',
      'Transaction demandée au wallet admin = safeTransferFrom(admin, joueur, 1) sur le contrat NB2, valeur 0 (non diffusée)');
    check(!mock.sent.some(t => /a22cb465/.test(t.data)), 'Aucun setApprovalForAll demandé');
    const st = JSON.parse(sql(`SELECT status, tx_hash FROM rewards WHERE id = '${rewardId}'`))[0].results[0];
    check(st.status === 'sent' && /^0x/.test(st.tx_hash), 'Récompense marquée « envoyée » avec le hash vérifié (reçu + Transfer + ownerOf)');
    await sleep(1300);
    await page.click('[data-afilter="sent"]');
    await page.waitForSelector('.claim .st-sent');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-admin-envoyes.png') });
    await ctx.close();
  }

  /* 5. Modes en ligne (classés) + interface en ANGLAIS : solo, boss, tournoi, PvP à deux navigateurs, repli BOT, admin EN */
  {
    const FR_HINT = /[éèêëàâùûçôîïœÉÈÊÀÇÔ]|\b(le|la|les|des|du|une|et|pour|avec|ton|tes|ta|aucun|aucune|est|sont|dans|sur|au|aux|ou|pas|joueur|combat|niveau|victoire|défaite|récompense|réclamer|adversaire|puissance|tours?|vitesse|attaque|défense)\b/i;
    const i18nIssues = [];
    const scan = async (page, where) => {
      const found = await page.evaluate((src) => {
        const re = new RegExp(src, 'i'), out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; while ((n = w.nextNode())) { const el = n.parentElement; if (!el || el.closest('[translate="no"], script, style, code, .addr, [hidden]')) continue; const t = n.nodeValue.trim(); if (t && re.test(t)) out.push(t); }
        return out.concat(Object.keys(window.NB_I18N_MISSING || {}).map(m => '(manquant) ' + m));
      }, FR_HINT.source);
      found.filter(t => t !== '(manquant) Smoke test EN').forEach(t => i18nIssues.push(where + ' : ' + t)); // libellé saisi librement par l’admin
    };
    const mk = async (wallet, locale) => {
      const ctx = await browser.newContext(Object.assign({}, mobile, { locale }));
      await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: configJs(MOCK + '/rpc') }));
      await ctx.addInitScript(() => { window.NB_I18N_DEBUG = true; window.__NB_TEST_CLOCK = { fightMs: 0, stepMs: 5000 }; });
      await withWallet(ctx, wallet, '0x1237');
      const page = await ctx.newPage(); watch(page, 'modes-' + locale);
      await page.goto(SITE + '/#recompenses');
      await page.click('[data-w="connect"]'); await page.waitForSelector('[data-w="signin"]'); await page.click('[data-w="signin"]');
      await page.waitForSelector('[data-w="disconnect"]'); await page.waitForTimeout(300);
      return { ctx, page };
    };
    const A = await mk(p2, 'en-US'), B = await mk(p3, 'fr-FR');
    check(await A.page.evaluate(() => document.documentElement.lang) === 'en' && await B.page.evaluate(() => document.documentElement.lang) === 'fr', 'i18n : navigator.language en-US → EN, fr-FR → FR (<html lang> mis à jour)');
    await scan(A.page, 'récompenses EN');
    const fight = async (page, mode, extra) => {
      await page.click('[data-nav="arene"]'); await page.click(`[data-mode="${mode}"]`); if (extra) await extra();
      await page.waitForTimeout(250); await page.click('#btn-fight');
      if (mode === 'pvp' || mode === 'tournoi') { await page.waitForTimeout(400); return page.$eval('#toast', e => e.innerText); }
      await page.waitForSelector('#btn-attack', { timeout: 15000 });
      for (let n = 0; n < 70; n++) {
        const done = await page.evaluate(() => { const result = document.querySelector('#result'); if (result && !result.hidden) return true; const b = document.querySelector('#btn-attack'); if (b) b.click(); return false; });
        if (done) break;
        await page.waitForTimeout(120);
      }
      await page.waitForSelector('#result:not([hidden])', { timeout: 60000 }); await page.waitForTimeout(250);
      return page.$eval('#result-box', e => e.innerText);
    };
    let t = await fight(A.page, 'solo', () => A.page.click('[data-diff="cauchemar"]'));
    check(/Ranked points \(server\)/.test(t) && /Solo vs bots · Nightmare/i.test(t), 'SOLO classé (EN) : combat contre un bot « Nightmare » calculé par le serveur' + (/Nightmare/i.test(t) ? '' : ' → ' + t.replace(/\s+/g, ' ')));
    await scan(A.page, 'résultat solo EN'); await A.page.click('[data-res="setup"]');
    t = await fight(A.page, 'boss');
    check(/Damage dealt to the boss/.test(t) && /Attempts left: 2/.test(t), 'BOSS classé (EN) : dégâts au boss et tentatives restantes (2/3) renvoyées par le serveur');
    await scan(A.page, 'résultat boss EN'); await A.page.click('[data-res="setup"]');
    await sleep(200);
    t = await fight(A.page, 'tournoi');
    check(/not available yet/i.test(t), 'TOURNOI : mode interactif indiqué comme pas encore disponible (EN) → ' + t.replace(/\s+/g, ' '));
    await A.page.screenshot({ path: path.join(SHOTS, 'mobile-tournoi-en.png') });
    await scan(A.page, 'tournoi en attente EN');
    t = await fight(B.page, 'tournoi');
    check(/pas encore disponible/.test(t), 'TOURNOI : mode interactif indiqué comme pas encore disponible (FR)');
    await A.page.click('[data-mode="pvp"]'); await A.page.click('#btn-fight');
    await A.page.waitForTimeout(300);
    const pvpEn = await A.page.$eval('#toast', e => e.innerText);
    check(/not available yet/i.test(pvpEn), 'PvP : pas présenté comme un combat interactif (EN) → ' + pvpEn.replace(/\s+/g, ' '));
    await scan(A.page, 'pvp en attente EN');
    await B.page.click('[data-mode="pvp"]'); await B.page.click('#btn-fight');
    const pvpFr = await B.page.$eval('#toast', e => e.innerText);
    check(/pas encore disponible/.test(pvpFr), 'PvP : pas présenté comme un combat interactif (FR)');
    await A.page.screenshot({ path: path.join(SHOTS, 'mobile-pvp-en.png') });
    // Bascule de langue en direct, conservée
    await A.page.click('[data-lang="fr"]'); await A.page.waitForTimeout(200);
    const frNav = await A.page.$eval('[data-nav="recompenses"]', e => e.textContent);
    await A.page.click('[data-lang="en"]'); await A.page.waitForTimeout(200);
    check(/Récompenses/.test(frNav) && await A.page.evaluate(() => localStorage.getItem('nb-lang')) === 'en', 'Bascule FR/EN dans l’en-tête, choix enregistré (localStorage)');
    await A.page.click('[data-nav="recompenses"]'); await A.page.waitForTimeout(600); await scan(A.page, 'récompenses connecté EN');
    await A.page.screenshot({ path: path.join(SHOTS, 'mobile-recompenses-en.png'), fullPage: true });
    // Admin en anglais : récompense de TEST attribuée, approuvée, transfert simulé
    const actx = await browser.newContext({ locale: 'en-GB', viewport: { width: 1366, height: 900 } });
    await actx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: configJs(MOCK + '/rpc') }));
    await actx.addInitScript(() => { window.NB_I18N_DEBUG = true; });
    await withWallet(actx, admin, '0x1237');
    const ap = await actx.newPage(); watch(ap, 'admin-en');
    await ap.goto(SITE + '/#admin'); await scan(ap, 'admin portail EN');
    await ap.click('[data-w="connect"]'); await ap.waitForSelector('[data-w="signin"]'); await ap.click('[data-w="signin"]');
    await ap.waitForSelector('#admin-area:not([hidden])');
    await ap.fill('#grant-address', p2.address); await ap.fill('#grant-label', 'Smoke test EN'); await ap.check('#grant-test'); await ap.click('#grant-form button');
    await ap.waitForTimeout(500);
    for (const f of ['pending', 'approved', 'sent', 'rejected', '']) { await ap.click(`[data-afilter="${f}"]`); await ap.waitForTimeout(250); await scan(ap, 'admin filtre ' + f); }
    await A.page.reload(); await A.page.click('[data-nav="recompenses"]'); await A.page.waitForSelector('[data-claim]', { timeout: 10000 }).catch(async () => console.log('MYREWARDS', await A.page.$eval('#my-rewards', e => e.innerText), await ap.$eval('#toast', e => e.textContent))); await A.page.click('[data-claim]'); await A.page.waitForTimeout(500); await scan(A.page, 'réclamation test EN');
    await ap.click('[data-afilter="pending"]'); await ap.waitForSelector('[data-aact="approve"]'); await ap.click('[data-aact="approve"]');
    await ap.waitForSelector('[data-sim]'); await scan(ap, 'admin simulation EN'); await ap.click('[data-sim]');
    await ap.waitForFunction(() => /Simulation succeeded|Simulation failed/.test(document.querySelector('.tx-msg')?.textContent || ''));
    check(/Simulation succeeded/.test(await ap.$eval('.tx-msg', e => e.textContent)), 'Admin (EN) : récompense de TEST approuvée, transfert simulé sans transaction');
    await scan(ap, 'admin simulé EN');
    await ap.screenshot({ path: path.join(SHOTS, 'desktop-admin-en.png') });
    await actx.close(); await A.ctx.close(); await B.ctx.close();
    check(i18nIssues.length === 0, 'i18n : aucune chaîne française en mode EN (en ligne : récompenses, modes, PvP, admin)' + (i18nIssues.length ? ' : ' + [...new Set(i18nIssues)].slice(0, 30).join(' | ') : ''));
  }
  check(errors.length === 0, 'Aucune erreur JavaScript dans le navigateur' + (errors.length ? ' : ' + errors.join(' | ') : ''));
} finally {
  await browser.close();
  try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {}
  server.closeAllConnections(); server.close();
  fs.rmSync(persist, { recursive: true, force: true });
}
