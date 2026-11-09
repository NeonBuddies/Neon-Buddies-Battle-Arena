/* Vérification i18n : aucune chaîne française non traduite en mode EN.
 * 1) statique : chaque texte/attribut de index.html et regles.html a une traduction ;
 * 2) dynamique : Chromium headless parcourt le jeu en anglais (toutes les vues, modale, sélecteur,
 *    les 5 modes de combat, formulaires, confirmations, règlement) et relève toute chaîne non traduite.
 * Usage : CHROME=/usr/bin/google-chrome node scripts/check-i18n.mjs [--list]   (site servi sur SITE, défaut http://127.0.0.1:8765) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'worker', 'package.json'));
const SITE = process.env.SITE || 'http://127.0.0.1:8765';
const LIST = process.argv.includes('--list');
const problems = [];

// Charge le dictionnaire comme le navigateur (sans DOM)
const ctx = { console, localStorage: { getItem: () => 'en', setItem() {} }, navigator: { language: 'en' } };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8'), ctx);
const I = ctx.NBI18n;
const FR_HINT = /[éèêëàâùûçôîïœÉÈÊÀÇÔ]|\b(le|la|les|des|du|une|et|pour|avec|ton|tes|ta|aucun|aucune|est|sont|dans|sur|au|aux|ou|pas|joueur|combat|niveau|victoire|défaite|récompense|réclamer|adversaire|puissance|tours?|vitesse|attaque|défense)\b/i;
const IGNORE = /^(NEON|BUDDIES|NFT BATTLE ARENA|VS|x[124]|FR|EN|ELO|PvP|BOSS|TEST|OK|Wallet|MetaMask|Telegram|Robinhood Chain|Neon Buddies 2 — Robinhood Chain|X @BusinessGry|#|pts|V|D|[\d\s.,:%+\-\/#×→←⚡✓✗·()]+)$/;

// 1) statique
for (const f of ['index.html', 'regles.html']) {
  let html = fs.readFileSync(path.join(root, f), 'utf8');
  // éléments traduits en bloc (HTML interne complet)
  html = html.replace(/<(\w+)([^>]*?)\sdata-i18n-html([^>]*)>([\s\S]*?)<\/\1>/g, (_, tag, a, b, inner) => {
    const k = inner.replace(/\s+/g, ' ').trim();
    if (I.lookup(k) == null) problems.push(`[statique ${f}] (bloc) ${k}`);
    return '';
  });
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<code[\s\S]*?<\/code>|<!--[\s\S]*?-->/g, '');
  const texts = [];
  html.replace(/>([^<>]+)</g, (_, t) => { texts.push(t); return _; });
  html.replace(/\s(?:placeholder|aria-label|title|alt|content)="([^"]+)"/g, (_, t) => { texts.push(t); return _; });
  for (let t of texts) {
    t = t.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || !/[A-Za-zÀ-ÿ]/.test(t) || IGNORE.test(t) || /^(width=|#07020f|https?:)/.test(t)) continue;
    if (I.lookup(t) == null) problems.push(`[statique ${f}] ${t}`);
  }
}
// Dictionnaire : aucune valeur vide, modèles cohérents
for (const [k, v] of Object.entries(I.dict)) {
  if (typeof v !== 'string' || !v.trim()) problems.push(`[dictionnaire] traduction vide : ${k}`);
  const vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
  if (vars(k) !== vars(v)) problems.push(`[dictionnaire] variables différentes : ${k} → ${v}`);
}

// 2) dynamique
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function crawl(viewport, label) {
  const context = await browser.newContext({ viewport, locale: 'en-US' });
  await context.addInitScript(() => { window.NB_I18N_DEBUG = true; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  const scan = async (where) => {
    const found = await page.evaluate((src) => {
      const re = new RegExp(src, 'i'), out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) {
        const el = n.parentElement; if (!el || el.closest('[translate="no"], script, style, code, .addr, [hidden]')) continue;
        const t = n.nodeValue.trim(); if (t && re.test(t)) out.push(t);
      }
      document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el => {
        if (el.closest('[translate="no"]')) return;
        ['placeholder', 'aria-label', 'title', 'alt'].forEach(a => { const v = el.getAttribute(a); if (v && re.test(v)) out.push('@' + a + ': ' + v); });
      });
      return out.concat(Object.keys(window.NB_I18N_MISSING || {}).map(m => '(manquant) ' + m));
    }, FR_HINT.source);
    found.forEach(t => problems.push(`[${label} ${where}] ${t}`));
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'en') problems.push(`[${label} ${where}] <html lang="${lang}">`);
  };
  await page.goto(SITE + '/index.html#accueil');
  await page.waitForTimeout(400);
  const auto = await page.evaluate(() => window.NBI18n.lang);
  if (auto !== 'en') problems.push(`[${label}] détection auto : ${auto} au lieu de en`);
  for (const v of ['accueil', 'galerie', 'classement', 'recompenses', 'admin', 'ajouter', 'profil', 'communaute', 'arene']) {
    await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(350); await scan(v);
  }
  // Galerie : fiche, recherche vide
  await page.evaluate(() => { location.hash = 'galerie'; }); await page.waitForTimeout(200);
  await page.click('#gal-grid .card'); await page.waitForTimeout(200); await scan('fiche');
  await page.click('.modal-close');
  await page.fill('#gal-search', 'zzzz'); await page.waitForTimeout(150); await scan('recherche');
  await page.fill('#gal-search', '');
  for (const opt of ['power', 'level', 'rank', 'id']) await page.selectOption('#gal-sort', opt);
  // Arène : sélecteur puis chaque mode
  await page.evaluate(() => { location.hash = 'arene'; }); await page.waitForTimeout(200);
  await page.click('[data-pick="A"]'); await page.waitForTimeout(150); await scan('sélecteur'); await page.click('.modal-close');
  for (const m of ['duel', 'solo', 'boss', 'tournoi', 'pvp']) {
    await page.click(`[data-mode="${m}"]`); await page.waitForTimeout(150);
    if (m === 'solo') for (const d of ['facile', 'difficile', 'cauchemar', 'normal']) await page.click(`[data-diff="${d}"]`);
    await scan('mode ' + m);
    await page.click('#btn-fight'); await page.waitForTimeout(600);
    if (m === 'pvp') { await scan('pvp hors ligne'); await page.click('[data-pvp="bot"]'); await page.waitForTimeout(600); }
    await page.waitForTimeout(1200); await scan('combat ' + m);
    if (await page.isVisible('#btn-skip')) await page.click('#btn-skip');
    await page.waitForSelector('#result:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(300); await scan('résultat ' + m);
    await page.click('[data-res="setup"]'); await page.waitForTimeout(200);
  }
  // Limites quotidiennes hors ligne (boss épuisé, tournoi déjà joué)
  await page.click('[data-mode="boss"]');
  for (let i = 0; i < 3; i++) { await page.click('#btn-fight'); await page.waitForTimeout(300); if (await page.isVisible('#btn-skip')) { await page.click('#btn-skip'); await page.waitForSelector('#result:not([hidden])'); await page.click('[data-res="setup"]'); } }
  await scan('boss épuisé');
  await page.click('[data-mode="tournoi"]'); await page.click('#btn-fight'); await page.waitForTimeout(300); await scan('tournoi déjà joué');
  await page.click('[data-mode="duel"]');
  // Ajouter : erreurs, image, ajout, suppression
  await page.evaluate(() => { location.hash = 'ajouter'; }); await page.waitForTimeout(200);
  await page.click('#add-submit'); await scan('ajout sans image');
  await page.setInputFiles('#add-file', path.join(root, 'assets/nft/0001.jpg')); await page.waitForTimeout(500);
  await page.fill('#add-name', ''); await page.click('#add-submit'); await scan('ajout sans nom');
  await page.fill('#add-name', 'Check i18n'); await page.click('#add-submit'); await page.waitForTimeout(300); await scan('ajouté');
  await page.click('#custom-grid [data-del]'); await page.waitForTimeout(150); await scan('confirmation suppression');
  await page.click('#cf-yes'); await page.waitForTimeout(200);
  await page.setInputFiles('#add-file', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await page.waitForTimeout(200); await scan('mauvais fichier');
  // Profil : réinitialisation (annulée), import invalide
  await page.evaluate(() => { location.hash = 'profil'; }); await page.waitForTimeout(200);
  await page.click('#btn-reset'); await scan('confirmation reset'); await page.click('.modal-box [data-close].btn');
  await page.setInputFiles('#import-file', { name: 's.json', mimeType: 'application/json', buffer: Buffer.from('{oops') }); await page.waitForTimeout(200); await scan('import invalide');
  // Bascule FR puis EN : retour exact au français, puis à l'anglais
  await page.click('[data-lang="fr"]'); await page.waitForTimeout(200);
  const fr = await page.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('[data-nav="galerie"]').textContent.trim(), stored: localStorage.getItem('nb-lang') }));
  if (fr.lang !== 'fr' || !/Galerie/.test(fr.nav) || fr.stored !== 'fr') problems.push(`[${label}] bascule FR : ${JSON.stringify(fr)}`);
  await page.reload(); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.documentElement.lang) !== 'fr') problems.push(`[${label}] langue FR non conservée après rechargement`);
  await page.click('[data-lang="en"]'); await page.waitForTimeout(200);
  const en = await page.evaluate(() => document.querySelector('[data-nav="galerie"]').textContent.trim());
  if (!/Gallery/.test(en)) problems.push(`[${label}] bascule EN : ${en}`);
  // Règlement
  await page.goto(SITE + '/regles.html'); await page.waitForTimeout(300); await scan('règlement');
  errors.forEach(e => problems.push(`[${label}] erreur JS : ${e}`));
  await context.close();
}
await crawl({ width: 1280, height: 860 }, 'desktop');
await crawl({ width: 390, height: 844 }, 'mobile');
await browser.close();

const uniq = [...new Set(problems)];
if (LIST) { const miss = [...new Set(uniq.map(p => p.replace(/^\[[^\]]+\] (\(manquant\) )?/, '')))]; console.log(JSON.stringify(miss, null, 1)); }
else uniq.forEach(p => console.log('✖ ' + p));
console.log(uniq.length ? `\n${uniq.length} problème(s) i18n.` : '✔ i18n : aucune chaîne non traduite (statique + parcours EN desktop/mobile).');
process.exit(uniq.length ? 1 : 0);
