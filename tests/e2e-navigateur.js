/* Test navigateur (optionnel) : npm i -D playwright-core, lancer un serveur local sur le port 8765,
   puis CHROME=/chemin/vers/chrome node tests/e2e-navigateur.js */
const { chromium } = require('playwright-core');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const URL = process.env.URL || 'http://127.0.0.1:8765/';
const UPLOAD = path.join(__dirname, 'upload-test.png');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  for (const vp of [{ name: 'desktop', width: 1366, height: 860, mobile: false }, { name: 'mobile', width: 412, height: 915, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
    const log = (...a) => { console.log(`[${vp.name}]`, ...a); };

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-accueil.png` });

    // Galerie + filtre
    await page.click('[data-nav="galerie"]'); await page.waitForSelector('[data-view="galerie"]:not([hidden])'); await page.waitForTimeout(150);
    await page.waitForSelector('#gal-grid .card');
    const total = await page.$$eval('#gal-grid .card', e => e.length);
    await page.click('#gal-filters [data-filter="Légendaire"]');
    const leg = await page.$$eval('#gal-grid .card', e => e.length);
    await page.fill('#gal-search', 'panda');
    const panda = await page.$$eval('#gal-grid .card', e => e.length);
    await page.fill('#gal-search', '');
    await page.click('#gal-filters [data-filter="Toutes"]');
    await page.waitForFunction(() => [...document.images].filter(i => i.closest('#gal-grid')).slice(0, 8).every(i => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: `${SHOTS}/${vp.name}-galerie.png` });
    log('galerie', total, 'légendaires', leg, 'panda(légendaire)', panda);
    // Détail
    await page.click('#gal-grid .card[data-id="0002"]');
    await page.waitForSelector('#modal:not([hidden]) .detail');
    await page.click('#modal [data-set="A"]');
    await page.waitForSelector('[data-view="arene"]:not([hidden])');
    const selA = await page.$eval('#slot-A-card .card', e => e.dataset.id);
    // Combat complet en x4
    await page.click('#btn-fight');
    await page.waitForSelector('#arena-fight:not([hidden])');
    await page.click('[data-speed="4"]');
    await page.waitForTimeout(vp.mobile ? 1200 : 1500);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-combat.png` });
    await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-resultat.png` });
    const title = await page.$eval('.result-title', e => e.textContent);
    const logLines = await page.$$eval('#battle-log li', e => e.length);
    const save1 = await page.evaluate(() => JSON.parse(localStorage.getItem('neonBuddiesArena.save.v1')));
    log('combat', 'A=', selA, title, 'lignes journal', logLines, 'points', save1.profile.points, 'combats', save1.profile.battles);
    // Revanche + passer
    await page.click('[data-res="next"]');
    await page.waitForSelector('#arena-fight:not([hidden])');
    await page.click('#btn-skip');
    await page.waitForSelector('#result:not([hidden])', { timeout: 10000 });
    await page.click('[data-res="setup"]');

    // Ajout d'une image
    await page.click('[data-nav="ajouter"]'); await page.waitForSelector('[data-view="ajouter"]:not([hidden])'); await page.waitForTimeout(150);
    await page.setInputFiles('#add-file', UPLOAD);
    await page.waitForSelector('#add-preview:not([hidden])');
    await page.fill('#add-name', 'Buddy Test ' + vp.name);
    await page.selectOption('#add-rarity', 'Épique');
    await page.selectOption('#add-family', 'Panda Néon');
    await page.click('#add-submit');
    await page.waitForSelector('#custom-grid .card');
    const msg = await page.$eval('#add-msg', e => e.textContent);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-ajouter.png` });
    log('ajout', msg);
    // Combat avec le NFT ajouté
    await page.click('#custom-grid .card');
    await page.click('#modal [data-set="A"]');
    await page.click('#btn-fight');
    await page.click('#btn-skip');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('[data-res="board"]');
    await page.waitForSelector('#lb-body tr');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-classement.png` });
    const top = await page.$$eval('#lb-body tr', rows => rows.slice(0, 3).map(r => r.innerText.replace(/\s+/g, ' ')));
    log('classement top3', top);

    // Rechargement → persistance
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('neonBuddiesArena.save.v1')));
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('[data-nav="profil"]'); await page.waitForSelector('[data-view="profil"]:not([hidden])'); await page.waitForTimeout(150);
    const pts = await page.$eval('#hud-points', e => e.textContent);
    const hist = await page.$$eval('#pf-history li', e => e.length);
    await page.click('[data-nav="ajouter"]'); await page.waitForSelector('[data-view="ajouter"]:not([hidden])'); await page.waitForTimeout(150);
    const customAfter = await page.$$eval('#custom-grid .card', e => e.length);
    await page.click('[data-nav="arene"]'); await page.waitForSelector('[data-view="arene"]:not([hidden])'); await page.waitForTimeout(150);
    const lastA = await page.$eval('#slot-A-card .card', e => e.dataset.id);
    log('persistance', 'points', pts, 'attendu', before.profile.points, 'combats', before.profile.battles, 'historique', hist, 'NFT ajoutés', customAfter, 'combattant gardé', lastA === before.settings.lastA);
    await page.click('[data-nav="profil"]'); await page.waitForSelector('[data-view="profil"]:not([hidden])'); await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-profil.png` });
    // Réinitialisation
    await page.click('#btn-reset');
    await page.click('#cf-yes');
    const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('neonBuddiesArena.save.v1')));
    log('reset', afterReset.profile.points, afterReset.custom.length);
    // Débordement horizontal
    const overflow = await page.evaluate((w) => Math.max(document.documentElement.scrollWidth, window.innerWidth) - w, vp.width);
    log('débordement horizontal px', overflow);
    log('erreurs console', errors.length ? errors : 'aucune');
    results.push({ vp: vp.name, errors: errors.length, overflow, ok: pts === before.profile.points.toLocaleString('fr-FR') && customAfter === 1 && afterReset.profile.points === 0 });
    await ctx.close();
  }
  // Mouvements réduits
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '#arene'); await p.click('#btn-fight'); await p.waitForSelector('#result:not([hidden])', { timeout: 60000 });
  console.log('[reduced-motion] combat terminé, erreurs', errs.length);
  await browser.close();
  console.log(JSON.stringify(results));
})().catch(e => { console.error(e); process.exit(1); });
