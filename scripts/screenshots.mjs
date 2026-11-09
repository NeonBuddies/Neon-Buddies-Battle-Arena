/* Captures d'écran propres (navigateur neuf, aucune donnée de test). Usage : CHROME=/usr/bin/google-chrome node scripts/screenshots.mjs */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'worker', 'package.json'));
const { chromium } = require('playwright-core');
const SITE = process.env.SITE || 'http://127.0.0.1:8765';
const OUT = path.join(root, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const devices = {
  desktop: { viewport: { width: 1366, height: 860 } },
  mobile: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};
for (const [dev, opt] of Object.entries(devices)) for (const lang of ['fr', 'en']) {
  const ctx = await b.newContext(Object.assign({ locale: lang === 'fr' ? 'fr-FR' : 'en-US' }, opt));
  const p = await ctx.newPage();
  const shot = n => p.screenshot({ path: path.join(OUT, `${dev}-${n}${lang === 'en' ? '-en' : ''}.png`) });
  await p.goto(SITE + '/index.html#accueil'); await p.waitForTimeout(700); await shot('accueil');
  for (const v of ['galerie', 'classement', 'ajouter', 'profil']) { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(600); await shot(v); }
  await p.evaluate(() => { location.hash = 'arene'; }); await p.waitForTimeout(300);
  await p.click('[data-mode="boss"]'); await p.waitForTimeout(400); await shot('arene-boss');
  await p.click('[data-mode="solo"]'); await p.click('#btn-fight'); await p.waitForTimeout(2600); await shot('combat');
  await p.click('#btn-skip'); await p.waitForSelector('#result:not([hidden])'); await p.waitForTimeout(500); await shot('resultat');
  await p.click('[data-res="setup"]'); await p.click('[data-mode="tournoi"]'); await p.click('#btn-fight');
  await p.click('#btn-skip'); await p.waitForSelector('#result:not([hidden])'); await p.waitForTimeout(500); await shot('tournoi');
  const custom = await p.evaluate(() => window.NBArena.getSave().custom.length);
  if (custom) throw new Error('données de test présentes');
  await ctx.close();
}
await b.close();
console.log('captures OK');
