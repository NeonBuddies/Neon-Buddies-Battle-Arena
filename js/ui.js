/* NEON BUDDIES — NFT BATTLE ARENA : interface, navigation, galerie, arène, classement. */
(function () {
  'use strict';
  var E = window.NBEngine, S = window.NBStorage, A = window.NBAudio, W = window.NBWeb3;
  var store = S.createStore();
  var save = store.load();
  var RARITIES = E.RARITIES;
  var FAMILIES = Object.keys(E.SPECIALS);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var I = window.NBI18n, L = function () { return I.locale(); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var ui = {
    sel: { A: null, B: null },
    galFilter: 'Toutes', galSearch: '', galSort: 'id',
    lbFilter: 'Toutes',
    battle: null,
    upload: null
  };

  /* ---------- Données ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function roster() {
    var base = (window.NB_COLLECTION || []).map(function (c) {
      return { id: c.id, tokenId: c.tokenId, name: c.name, rarity: c.rarity, rank: c.rank, traits: c.traits, image: 'assets/nft/' + c.id + '.jpg', custom: false };
    });
    var custom = save.custom.map(function (c) {
      return { id: c.id, name: c.name, rarity: c.rarity, rank: null, traits: c.traits, image: c.image, custom: true };
    });
    return base.concat(custom);
  }
  var cache = null;
  function chars() { return cache || (cache = roster()); }
  function invalidate() { cache = null; }
  function byId(id) { var l = chars(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function prog(id) {
    var p = save.chars[id] || { xp: 0, wins: 0, losses: 0 };
    var lv = E.levelFromXp(p.xp);
    return { xp: p.xp, wins: p.wins, losses: p.losses, level: lv.level, xpInLevel: lv.xpInLevel, xpNeeded: lv.xpNeeded };
  }
  function statsOf(ch) { return E.statsAtLevel(E.baseStats(ch), prog(ch.id).level); }
  function persist() {
    var r = store.save(save);
    if (!r.ok) toast(r.error === 'quota' ? 'Stockage plein : supprime un NFT ajouté pour libérer de la place.' : 'Sauvegarde impossible dans ce navigateur.');
    $('#hud-points').textContent = save.profile.points.toLocaleString(L());
    return r.ok;
  }
  function rankTitle(pts) {
    var t = [[0, 'Recrue'], [500, 'Runner'], [1500, 'Netrunner'], [4000, 'Cyber-Élite'], [8000, 'Légende Néon']];
    var cur = t[0], next = null;
    for (var i = 0; i < t.length; i++) { if (pts >= t[i][0]) { cur = t[i]; next = t[i + 1] || null; } }
    return { name: cur[1], next: next };
  }
  function randomChar(exceptId) {
    var l = chars().filter(function (c) { return c.id !== exceptId; });
    return l[Math.floor(Math.random() * l.length)];
  }

  /* ---------- Rendu des cartes ---------- */
  function cardHTML(ch, opts) {
    opts = opts || {};
    var p = prog(ch.id), pw = E.power(statsOf(ch));
    return '<button type="button" class="card" data-id="' + esc(ch.id) + '" data-rarity="' + esc(ch.rarity) + '"' + (opts.action ? ' data-action="' + opts.action + '"' : '') + '>' +
      '<span class="card-lv">Niv. ' + p.level + '</span><span class="card-pw">⚡' + pw + '</span>' +
      '<img class="card-img" src="' + esc(ch.image) + '" alt="' + esc(ch.name) + '" translate="no" loading="lazy" decoding="async">' +
      '<span class="card-body"><span class="card-name" translate="no">' + esc(ch.name) + '</span>' +
      '<span class="card-meta"><span class="rarity r-' + esc(ch.rarity) + '">' + esc(ch.rarity) + '</span><span>' + p.wins + 'V / ' + p.losses + 'D</span></span></span>' +
      (opts.del ? '<span class="del" role="button" tabindex="0" data-del="' + esc(ch.id) + '" aria-label="Supprimer">🗑</span>' : '') +
      '</button>';
  }
  function statsHTML(st) {
    var max = { hp: 260, atk: 50, def: 30, spd: 30, crit: 50 };
    var lab = { hp: 'PV', atk: 'Attaque', def: 'Défense', spd: 'Vitesse', crit: 'Critique' };
    return '<div class="stats">' + ['hp', 'atk', 'def', 'spd', 'crit'].map(function (k) {
      var pct = Math.min(100, st[k] / max[k] * 100);
      return '<div class="stat-row"><span>' + lab[k] + '</span><span class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></span><b>' + st[k] + (k === 'crit' ? '%' : '') + '</b></div>';
    }).join('') + '</div>';
  }

  /* ---------- Navigation ---------- */
  var VIEWS = ['accueil', 'galerie', 'arene', 'classement', 'recompenses', 'admin', 'ajouter', 'profil', 'communaute'];
  function route() {
    var v = (location.hash || '#accueil').slice(1);
    if (VIEWS.indexOf(v) < 0) v = 'accueil';
    if (ui.battle && v !== 'arene') stopBattle(true);
    if (pvp && v !== 'arene') stopPvp(false);
    if (v !== 'communaute' && window.NBCommunity) window.NBCommunity.hide();
    $$('.view').forEach(function (el) { el.hidden = el.getAttribute('data-view') !== v; });
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === v); a.setAttribute('aria-current', a.getAttribute('data-nav') === v ? 'page' : 'false'); });
    ({ accueil: renderHome, galerie: renderGallery, arene: renderArenaSetup, classement: renderLeaderboard, recompenses: renderRewards, admin: renderAdmin, ajouter: renderAdd, profil: renderProfile, communaute: function () { if (window.NBCommunity) window.NBCommunity.show(); } })[v]();
    window.scrollTo(0, 0);
  }
  function go(v) { if (location.hash === '#' + v) route(); else location.hash = v; }

  /* ---------- Accueil ---------- */
  function renderHome() {
    var p = save.profile, rt = rankTitle(p.points);
    $('#home-stats').innerHTML =
      box(p.points.toLocaleString(L()), 'Points') + box(rt.name, 'Rang') + box(p.wins + ' / ' + p.losses, 'Victoires / Défaites') + box(p.bestStreak, 'Meilleure série');
    var legs = chars().filter(function (c) { return c.rarity === 'Légendaire'; });
    var pick = [];
    while (pick.length < 3 && legs.length) pick.push(legs.splice(Math.floor(Math.random() * legs.length), 1)[0]);
    $('#home-cards').innerHTML = pick.map(function (c) { return cardHTML(c); }).join('');
    function box(v, l) { return '<div class="stat-box"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }
  }

  /* ---------- Galerie ---------- */
  function chipsHTML(active, withCustom) {
    var list = ['Toutes'].concat(RARITIES); if (withCustom) list.push('Ajoutés');
    return list.map(function (r) { return '<button type="button" class="chip' + (r === active ? ' active' : '') + '" data-filter="' + esc(r) + '">' + esc(r) + '</button>'; }).join('');
  }
  function filterChars(filter, search) {
    var q = (search || '').trim().toLowerCase();
    return chars().filter(function (c) {
      if (filter === 'Ajoutés' && !c.custom) return false;
      if (filter !== 'Toutes' && filter !== 'Ajoutés' && c.rarity !== filter) return false;
      if (!q) return true;
      var hay = (c.name + ' ' + c.id + ' ' + c.rarity + ' ' + Object.keys(c.traits || {}).map(function (k) { return c.traits[k]; }).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function renderGallery() {
    $('#gal-filters').innerHTML = chipsHTML(ui.galFilter, true);
    var list = filterChars(ui.galFilter, ui.galSearch);
    var sort = ui.galSort;
    list.sort(function (a, b) {
      if (sort === 'power') return E.power(statsOf(b)) - E.power(statsOf(a));
      if (sort === 'level') return prog(b.id).xp - prog(a.id).xp;
      if (sort === 'rank') return (a.rank || 999) - (b.rank || 999);
      return a.id < b.id ? -1 : 1;
    });
    $('#gal-count').textContent = list.length + ' / ' + chars().length;
    $('#gal-grid').innerHTML = list.map(function (c) { return cardHTML(c); }).join('');
    $('#gal-empty').hidden = list.length > 0;
  }

  /* ---------- Fiche détaillée ---------- */
  function openDetail(id) {
    var ch = byId(id); if (!ch) return;
    var p = prog(id), st = statsOf(ch);
    var traits = Object.keys(ch.traits || {}).map(function (k) { return '<span><em>' + esc(k) + ' :</em> ' + (k === 'famille' ? esc(ch.traits[k]) : '<span translate="no">' + esc(ch.traits[k]) + '</span>') + '</span>'; }).join('');
    var xpPct = p.xpNeeded ? (p.xpInLevel / p.xpNeeded * 100) : 100;
    openModal(
      '<div class="detail"><img class="detail-img" src="' + esc(ch.image) + '" alt="' + esc(ch.name) + '" translate="no">' +
      '<div><h3 id="modal-title" translate="no">' + esc(ch.name) + '</h3>' +
      '<span class="rarity r-' + esc(ch.rarity) + '">' + esc(ch.rarity) + '</span>' + (ch.rank ? ' <span class="muted small">Rareté de jeu · rang ' + ch.rank + '/100</span>' : ' <span class="muted small">NFT ajouté (hors classement)</span>') +
      (ch.tokenId ? '<p class="small"><a href="' + esc(W.explorerToken(ch.tokenId)) + '" target="_blank" rel="noopener">Voir le token #' + ch.tokenId + ' sur Robinhood Chain ↗</a></p>' : '') +
      '<div class="traits">' + traits + '</div>' +
      '<p class="small"><b>Niveau ' + p.level + '</b> — ' + (p.xpNeeded ? p.xpInLevel + ' / ' + p.xpNeeded + ' XP' : 'niveau max') + '</p>' +
      '<div class="bar xpbar" style="margin-bottom:14px"><i style="width:' + xpPct.toFixed(1) + '%"></i></div>' +
      statsHTML(st) +
      '<p class="small muted">Puissance ⚡' + E.power(st) + ' · Spéciale : ' + esc(E.SPECIALS[(ch.traits || {}).famille] || 'Frappe Néon') + ' · ' + p.wins + ' victoires / ' + p.losses + ' défaites</p>' +
      '<div class="btn-row"><button class="btn btn-primary btn-small" data-set="A" data-id="' + esc(id) + '">⚔ Mon combattant</button>' +
      '<button class="btn btn-small" data-set="B" data-id="' + esc(id) + '">🎯 Adversaire</button></div></div></div>'
    );
  }
  function openModal(html) {
    $('#modal-content').innerHTML = html;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
    var c = $('.modal-close'); if (c) c.focus({ preventScroll: true });
  }
  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; $('#modal-content').innerHTML = ''; }

  /* ---------- Sélecteur de personnage ---------- */
  function openPicker(side) {
    var filter = 'Toutes', q = '';
    openModal('<h3 id="modal-title" style="margin:0 40px 8px 0">' + (side === 'A' ? 'Choisis ton combattant' : 'Choisis l’adversaire') + '</h3>' +
      '<div class="picker-tools"><input type="search" class="input" id="pk-search" placeholder="Rechercher…" aria-label="Rechercher"></div>' +
      '<div class="chips" id="pk-filters" style="margin-bottom:12px"></div><div class="card-grid picker-grid" id="pk-grid"></div>');
    function draw() {
      $('#pk-filters').innerHTML = chipsHTML(filter, save.custom.length > 0);
      var other = ui.sel[side === 'A' ? 'B' : 'A'];
      $('#pk-grid').innerHTML = filterChars(filter, q).filter(function (c) { return c.id !== other; })
        .map(function (c) { return cardHTML(c, { action: 'pick-' + side }); }).join('') || '<p class="empty">Aucun résultat.</p>';
    }
    draw();
    $('#pk-search').addEventListener('input', function (e) { q = e.target.value; draw(); });
    $('#pk-filters').addEventListener('click', function (e) { var b = e.target.closest('[data-filter]'); if (b) { filter = b.getAttribute('data-filter'); draw(); } });
  }
  function setSel(side, id) {
    var other = side === 'A' ? 'B' : 'A';
    ui.sel[side] = id;
    if (ui.sel[other] === id) ui.sel[other] = randomChar(id).id;
    if (side === 'A') { save.settings.lastA = id; persist(); }
  }

  /* ---------- Arène : préparation ---------- */
  function ensureSel() {
    if (!ui.sel.A || !byId(ui.sel.A)) ui.sel.A = (save.settings.lastA && byId(save.settings.lastA)) ? save.settings.lastA : randomChar().id;
    if (!ui.sel.B || !byId(ui.sel.B) || ui.sel.B === ui.sel.A) ui.sel.B = randomChar(ui.sel.A).id;
  }
  function mode() { return save.settings.mode || 'duel'; }
  function bossToday() { return E.dailyBoss(E.dayKey()); }
  function bossView(boss) {
    var base = byId(boss.baseId) || chars()[0];
    return { id: boss.id, name: boss.name, rarity: 'Légendaire', traits: base.traits, image: base.image, boss: true };
  }
  function localBossLeft() { return save.local.bossDay === E.dayKey() ? Math.max(0, E.BOSS_ATTEMPTS_PER_DAY - save.local.bossUsed) : E.BOSS_ATTEMPTS_PER_DAY; }
  function renderModePanel() {
    var m = mode(), el = $('#mode-panel'), online = sessionOk();
    $$('[data-mode]').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-mode') === m); });
    var showB = m === 'duel';
    $('#slot-B-actions').hidden = !showB;
    $('#slot-B-label').textContent = { duel: 'Adversaire', solo: 'Bot adversaire', pvp: 'Adversaire en ligne', tournoi: 'Tableau à 8', boss: 'Boss du jour' }[m];
    if (m === 'duel') { el.innerHTML = '<p class="small muted">Duel libre : choisis ton combattant et ton adversaire parmi la collection.</p>'; }
    if (m === 'solo') {
      el.innerHTML = '<p class="small muted">Affronte un bot dont le niveau et les stats dépendent de la difficulté. Plus c’est dur, plus tu gagnes de points.</p><div class="chips" role="group" aria-label="Difficulté">' +
        Object.keys(E.DIFFICULTIES).map(function (k) { var d = E.DIFFICULTIES[k];
          return '<button type="button" class="chip' + (save.settings.difficulty === k ? ' active' : '') + '" data-diff="' + k + '">' + esc(d.label) + ' <small>×' + d.points + '</small></button>'; }).join('') + '</div>';
    }
    if (m === 'pvp') {
      el.innerHTML = online ? '<p class="small muted">Matchmaking en ligne par sondage : le serveur t’associe à un autre joueur connecté et calcule le combat. Classement ELO séparé. Personne en face ? Un BOT te sera proposé.</p>'
        : '<p class="small warn-txt">Le PvP en ligne nécessite le serveur et un wallet connecté (signature). Hors ligne, tu peux affronter un BOT.</p>';
    }
    if (m === 'tournoi') {
      el.innerHTML = '<p class="small muted">Tournoi à élimination directe : 8 places (toi, des fantômes d’autres joueurs et des bots, pas des adversaires en direct). Points selon ton classement : 1er ' + E.TOURNAMENT_POINTS[1] + ' · finaliste ' + E.TOURNAMENT_POINTS[2] + ' · demi ' + E.TOURNAMENT_POINTS[3] + ' · quart ' + E.TOURNAMENT_POINTS[5] + '. Un tournoi classé par jour.</p>' +
        (online ? '<div id="tour-results" class="small"></div>' : '');
      if (online) W.api('/api/tournament/results', { auth: false }).then(function (d) {
        var t = $('#tour-results'); if (!t) return;
        t.innerHTML = d.results.length ? '<b>Résultats du jour</b><ol class="players">' + d.results.slice(0, 5).map(function (r) { return '<li><span>' + r.placement + '</span><span class="pa" translate="no">' + esc(r.name || W.short(r.address)) + '</span><b>+' + r.points + '</b></li>'; }).join('') + '</ol>' : '<span class="muted">Aucun tournoi joué aujourd’hui.</span>';
      }).catch(function () {});
    }
    if (m === 'boss') {
      var boss = bossToday();
      el.innerHTML = '<p class="small"><b>' + esc(boss.name) + '</b> — ' + (boss.phases.length + 1) + ' phases, PV énormes. Victoire : ' + E.bossPoints({ winner: 'A' }) + ' points ; sinon points selon les dégâts infligés.</p>' +
        '<p class="small muted" id="boss-left">Tentatives restantes aujourd’hui : ' + (online ? '…' : localBossLeft() + ' / ' + E.BOSS_ATTEMPTS_PER_DAY) + '</p>';
      if (online) W.api('/api/boss').then(function (d) { var b = $('#boss-left'); if (b) b.textContent = 'Tentatives restantes aujourd’hui : ' + d.attemptsLeft + ' / ' + d.attemptsMax; }).catch(function () {});
    }
  }
  function renderArenaSetup() {
    if (ui.battle) return;
    ensureSel();
    $('#arena-setup').hidden = false; $('#arena-fight').hidden = true;
    var m = mode();
    $('#slot-A-card').innerHTML = cardHTML(byId(ui.sel.A), { action: 'detail' });
    if (m === 'duel') $('#slot-B-card').innerHTML = cardHTML(byId(ui.sel.B), { action: 'detail' });
    else if (m === 'boss') { var bv = bossView(bossToday()); $('#slot-B-card').innerHTML = '<div class="card boss-card" data-rarity="Légendaire"><span class="card-lv">BOSS</span><img class="card-img" src="' + esc(bv.image) + '" alt=""><span class="card-body"><span class="card-name">' + esc(bv.name) + '</span></span></div>'; }
    else $('#slot-B-card').innerHTML = '<div class="card mystery-card"><span class="mystery">' + ({ solo: '🤖', pvp: '🌐', tournoi: '🏟' }[m]) + '</span><span class="card-body"><span class="card-name">' + ({ solo: 'Bot aléatoire', pvp: 'Joueur en ligne', tournoi: '7 adversaires' }[m]) + '</span></span></div>';
    $('#ranked-wrap').hidden = !sessionOk() || m === 'pvp';
    $('#btn-fight').textContent = { duel: '⚔ Lancer le combat', solo: '🤖 Affronter le bot', pvp: '🌐 Chercher un adversaire', tournoi: '🏟 Lancer le tournoi', boss: '👹 Affronter le boss' }[m];
    renderModePanel();
  }

  /* ---------- Arène : combat ---------- */
  function wait(ms) {
    var b = ui.battle;
    return new Promise(function (res) {
      if (!b || b.skip) return res();
      var t = setTimeout(res, ms / b.speed);
      b.timers.push(t); b.resolvers.push(res);
    });
  }
  function sessionOk() { return W.apiEnabled() && !!W.getSession(); }
  function rankedActive() { return sessionOk() && $('#opt-ranked').checked; }
  function randomSeed() { return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0; }
  function displayOf(f) { var ch = byId(f.id); return ch || { id: f.id, name: f.name, image: (byId(f.baseId || '') || chars()[0]).image, rarity: f.rarity }; }
  async function startBattle(forced) {
    ensureSel();
    var m = forced && forced.mode || mode();
    var a = byId(ui.sel.A), b = byId(ui.sel.B);
    if (!a) return;
    if (m === 'duel' && (!b || a.id === b.id)) { toast('Choisis deux personnages différents.'); return; }
    if (ui.starting) return;
    if (m === 'pvp') return startPvp(a);
    ui.starting = true;
    try {
      var online = rankedActive() && !a.custom && (m !== 'duel' || !b.custom);
      if (rankedActive() && !online) toast('Les NFT ajoutés combattent hors classement (combat local).');
      var diff = E.DIFFICULTIES[(forced && forced.difficulty) || save.settings.difficulty] || E.DIFFICULTIES.normal;
      var result, server = null, extra = { mode: m }, want = null;
      if (online) {
        try {
          if (m === 'duel') server = await W.api('/api/fight', { method: 'POST', body: { fighterId: a.id, opponentId: b.id } });
          if (m === 'solo') server = await W.api('/api/fight', { method: 'POST', body: { mode: 'solo', difficulty: diff.id, fighterId: a.id, pvpFallback: !!(forced && forced.pvpFallback) } });
          if (m === 'boss') server = await W.api('/api/boss', { method: 'POST', body: { fighterId: a.id } });
          if (m === 'tournoi') server = await W.api('/api/tournament', { method: 'POST', body: { fighterId: a.id } });
          result = server.result;
        } catch (e) { toast(errMsg(e)); return; }
        if (m === 'tournoi') extra.tournament = { placement: server.placement, points: server.tournamentPoints, bracket: server.bracket, matches: server.matches };
        if (m === 'boss') extra.attemptsLeft = server.attemptsLeft;
      } else {
        var seed = randomSeed();
        if (m === 'duel') result = E.simulateBattle(a, prog(a.id).level, b, prog(b.id).level, seed);
        if (m === 'solo') { var bot = randomChar(a.id); result = E.simulateBattle(a, prog(a.id).level, bot, E.botLevel(diff.id, prog(a.id).level), seed, { scaleB: diff.scale }); }
        if (m === 'boss') {
          if (localBossLeft() <= 0) { toast('Tentatives contre le boss épuisées pour aujourd’hui. Reviens demain !'); return; }
          var boss = bossToday();
          result = E.simulateBattle(a, prog(a.id).level, E.bossCharacter(boss, window.NB_COLLECTION), E.bossLevel(prog(a.id).level), seed, { boss: boss });
          if (save.local.bossDay !== E.dayKey()) { save.local.bossDay = E.dayKey(); save.local.bossUsed = 0; }
          save.local.bossUsed++; extra.attemptsLeft = localBossLeft(); want = E.bossPoints(result);
        }
        if (m === 'tournoi') {
          if (save.local.tourDay === E.dayKey() && !(forced && forced.again)) { toast('Tournoi local du jour déjà joué. Reviens demain !'); return; }
          var lv = prog(a.id).level, ent = [{ ch: a, level: lv, label: a.name, player: true }];
          while (ent.length < 8) { var c = randomChar(a.id); if (ent.some(function (x) { return x.ch.id === c.id; })) continue; ent.push({ ch: c, level: Math.max(1, lv + Math.floor(Math.random() * 3) - 1), label: 'BOT ' + c.name, bot: true }); }
          for (var i = ent.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = ent[i]; ent[i] = ent[j]; ent[j] = tmp; }
          var t = E.runTournament(ent, seed), me = t.entrants.filter(function (x) { return x.player; })[0].slot, ms = [];
          t.rounds.forEach(function (r) { r.matches.forEach(function (mm) { if (mm.a === me || mm.b === me) ms.push(mm.a === me ? mm.result : E.flipResult(mm.result)); }); });
          result = ms[ms.length - 1];
          save.local.tourDay = E.dayKey();
          want = E.TOURNAMENT_POINTS[t.placement[me]] || 0;
          extra.tournament = { placement: t.placement[me], points: want, bracket: { rounds: t.rounds, entrants: t.entrants, champion: t.champion, me: me }, matches: ms };
        }
      }
      if (location.hash !== '#arene') { history.replaceState(null, '', '#arene'); route(); }
      var bDisp = m === 'duel' ? b : (m === 'boss' ? bossView(bossToday()) : displayOf(result.fighters.B));
      // Progression locale (enregistrée immédiatement : quitter le combat ne l'annule pas).
      var matches = m === 'tournoi' ? extra.tournament.matches : [result], applied, mc = [];
      matches.forEach(function (r) {
        applied = E.applyBattleResult(save, r);
        save.profile = applied.progress.profile; save.chars = applied.progress.chars; save.history = applied.progress.history;
        if (save.history[0]) { save.history[0].mode = m; if (!byId(save.history[0].b)) save.history[0].bName = r.fighters.B.name; }
        var mo = E.updateMissions(save.missions, r, save.profile.streak, E.dayKey());
        save.missions = mo.state; save.profile.points += mo.bonusPoints; mc = mc.concat(mo.completed);
      });
      if (m === 'boss') delete save.chars[result.fighters.B.id];
      if (m === 'solo' && !online) { want = Math.round(applied.summary.points * diff.points); }
      if (want != null) { save.profile.points += want - applied.summary.points; applied.summary.points = want; if (save.history[0]) save.history[0].pts = want; }
      persist();
      ui.battle = { result: result, summary: applied.summary, a: a, b: bDisp, speed: save.settings.speed || 1, skip: false, timers: [], resolvers: [], done: false,
        ranked: online, server: server, localMissions: mc, extra: extra };
      showFight(ui.battle);
    } finally { ui.starting = false; }
  }
  function showFight(bt) {
    $('#arena-setup').hidden = true; $('#arena-fight').hidden = false; $('#pvp-wait').hidden = true;
    $('#battle-log').innerHTML = '';
    $('#fx-layer').innerHTML = '';
    $$('[data-speed]').forEach(function (c) { c.classList.toggle('active', Number(c.getAttribute('data-speed')) === bt.speed); });
    drawFighter('A', bt.a, bt.result.fighters.A); drawFighter('B', bt.b, bt.result.fighters.B);
    $('#fighter-B').classList.toggle('boss', !!bt.b.boss);
    play(bt);
  }

  /* ---------- PvP en ligne : file d'attente + sondage ---------- */
  var pvp = null;
  function pvpBox(html) { var el = $('#pvp-wait'); el.hidden = false; el.innerHTML = html; }
  function stopPvp(silent) {
    if (!pvp) return;
    clearTimeout(pvp.timer); var was = pvp; pvp = null;
    if (!silent) W.api('/api/pvp/leave', { method: 'POST', body: {} }).catch(function () {});
    if (was) $('#pvp-wait').hidden = true;
  }
  async function startPvp(a) {
    if (!sessionOk()) {
      pvpBox('<p>Le PvP en ligne nécessite le serveur et un wallet connecté.</p><div class="btn-row"><button class="btn btn-primary btn-small" data-pvp="bot">🤖 Affronter un BOT</button><a class="btn btn-small btn-ghost" href="#recompenses">🦊 Connecter mon wallet</a></div>');
      return;
    }
    if (a.custom) { toast('Les NFT ajoutés ne peuvent pas jouer en PvP classé.'); return; }
    if (pvp) return;
    pvp = { a: a, started: Date.now(), timer: null };
    pvpBox('<p class="pulse">🔎 Recherche d’un adversaire en ligne…</p><div class="btn-row"><button class="btn btn-small btn-ghost" data-pvp="cancel">Annuler</button></div>');
    try { handlePvp(await W.api('/api/pvp/join', { method: 'POST', body: { fighterId: a.id } })); }
    catch (e) { stopPvp(true); pvpBox('<p class="err-txt">' + esc(errMsg(e)) + '</p>'); }
  }
  function handlePvp(d) {
    if (!pvp) return;
    if (d.status === 'matched') {
      var a = pvp.a; stopPvp(true);
      var applied = E.applyBattleResult(save, d.result);
      save.profile = applied.progress.profile; save.chars = applied.progress.chars; save.history = applied.progress.history;
      if (save.history[0]) save.history[0].mode = 'pvp';
      var mo = E.updateMissions(save.missions, d.result, save.profile.streak, E.dayKey());
      save.missions = mo.state; save.profile.points += mo.bonusPoints; persist();
      if (location.hash !== '#arene') { history.replaceState(null, '', '#arene'); route(); }
      ui.battle = { result: d.result, summary: applied.summary, a: a, b: displayOf(d.result.fighters.B), speed: save.settings.speed || 1, skip: false, timers: [], resolvers: [], done: false,
        ranked: !!d.summary, server: d.summary ? d : null, localMissions: mo.completed, extra: { mode: 'pvp', opponent: d.opponent, ratingDelta: d.ratingDelta, rating: d.rating } };
      showFight(ui.battle);
      return;
    }
    if (d.status === 'timeout' || d.status === 'idle') {
      stopPvp(false);
      pvpBox('<p>Aucun adversaire en ligne pour le moment.</p><div class="btn-row"><button class="btn btn-primary btn-small" data-pvp="bot">🤖 Affronter un BOT</button><button class="btn btn-small" data-pvp="retry">↻ Réessayer</button></div>');
      return;
    }
    var waited = Math.floor((Date.now() - pvp.started) / 1000);
    pvpBox('<p class="pulse">🔎 Recherche d’un adversaire en ligne… ' + waited + ' s</p><div class="btn-row"><button class="btn btn-small btn-ghost" data-pvp="cancel">Annuler</button></div>');
    pvp.timer = setTimeout(function () {
      if (!pvp) return;
      W.api('/api/pvp/status').then(handlePvp).catch(function (e) { stopPvp(true); pvpBox('<p class="err-txt">' + esc(errMsg(e)) + '</p>'); });
    }, 1500);
  }
  function drawFighter(side, ch, f) {
    $('#fighter-' + side).className = 'fighter ' + (side === 'A' ? 'left' : 'right');
    $('#fighter-' + side).innerHTML = '<img class="f-img" src="' + esc(ch.image) + '" alt="' + esc(ch.name) + '" translate="no">';
    $('#hud-' + side).innerHTML = '<div class="hud-name"><span translate="no">' + esc(ch.name) + '</span> <small>Niv. ' + f.level + '</small></div>' +
      '<div class="hpbar"><span class="lag" style="width:100%"></span><span class="fill" style="width:100%"></span></div>' +
      '<div class="hp-num"><span class="hpv">' + f.maxHp + '</span> / ' + f.maxHp + ' PV</div>';
  }
  function setHp(side, hp, max) {
    var pct = Math.max(0, hp / max * 100);
    var hud = $('#hud-' + side);
    var fill = $('.fill', hud);
    fill.style.width = pct + '%';
    fill.classList.toggle('mid', pct <= 50 && pct > 25);
    fill.classList.toggle('low', pct <= 25);
    $('.lag', hud).style.width = pct + '%';
    $('.hpv', hud).textContent = hp;
  }
  function logLine(text, cls) {
    var li = document.createElement('li'); li.textContent = text; li.className = cls || '';
    $('#battle-log').prepend(li);
  }
  function fx(html, x, y, cls, life) {
    if (ui.battle && ui.battle.skip) return;
    var el = document.createElement('div'); el.className = cls; el.innerHTML = html;
    if (x != null) el.style.left = x; if (y != null) el.style.top = y;
    $('#fx-layer').appendChild(el);
    setTimeout(function () { el.remove(); }, life || 1000);
    return el;
  }
  function announce(text) {
    var a = $('#announce'); a.textContent = text; a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
  }
  function sideX(side) { return side === 'A' ? '24%' : '76%'; }

  function play(b) {
    var evs = b.result.events, i = 0;
    var fA = $('#fighter-A'), fB = $('#fighter-B');
    var fEl = { A: fA, B: fB };
    if (!b.skip) announce('Combat !');
    (function next() {
      if (ui.battle !== b) return;
      if (i >= evs.length) return finish(b);
      var ev = evs[i++];
      handle(ev).then(next);
    })();

    function handle(ev) {
      if (ev.type === 'start') { logLine(ev.text, 'sys'); return wait(900); }
      if (ev.type === 'end') { logLine(ev.text + (ev.timeout ? ' (limite de tours)' : ''), 'sys'); return Promise.resolve(); }
      $('#turn-label').textContent = 'Tour ' + ev.turn;
      if (ev.type === 'phase') {
        if (!b.skip) announce('PHASE ' + ev.phase);
        A.special(); fx('', null, null, 'flash', 320);
        setHp(ev.side, ev.hpAfter, ev.maxHp);
        logLine(ev.text, 'sys phase');
        return wait(1100);
      }
      var att = fEl[ev.attacker], def = fEl[ev.defender];
      var cls = ev.attacker;
      if (ev.type === 'dodge') {
        att.classList.add('lunge'); def.classList.add('dodge');
        A.dodge();
        fx('ESQUIVE', sideX(ev.defender), '30%', 'dmg miss', 900);
        logLine(ev.text, cls);
        return wait(450).then(function () { att.classList.remove('lunge'); def.classList.remove('dodge'); return wait(450); });
      }
      var special = ev.type === 'special';
      var pre = Promise.resolve();
      if (special) {
        att.classList.add('charge');
        if (!b.skip) announce(ev.move);
        A.special();
        pre = wait(500).then(function () {
          var beam = fx('', ev.attacker === 'A' ? '28%' : '28%', null, 'beam', 500);
          if (beam) { beam.style.width = '44%'; beam.style.transformOrigin = ev.attacker === 'A' ? 'left center' : 'right center'; }
        });
      }
      return pre.then(function () {
        att.classList.add('lunge');
        return wait(220);
      }).then(function () {
        def.classList.remove('hit'); void def.offsetWidth; def.classList.add('hit');
        fx('', sideX(ev.defender), '45%', 'slash', 380);
        if (ev.crit || special) { fx('', null, null, 'flash', 320); if (!b.skip && !reduceMotion) { var st = $('#stage'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); } }
        fx((ev.crit ? 'CRITIQUE ! ' : '') + '-' + ev.damage, sideX(ev.defender), '26%', 'dmg' + (ev.crit ? ' crit' : ''), 1000);
        if (ev.crit) A.crit(); else A.hit();
        setHp(ev.defender, ev.hpAfter, ev.maxHp);
        logLine(ev.text, cls + (ev.crit ? ' crit' : ''));
        return wait(300);
      }).then(function () {
        att.classList.remove('lunge', 'charge');
        return wait(special ? 650 : 480);
      }).then(function () { def.classList.remove('hit'); });
    }
  }
  function finish(b) {
    if (b.done) return; b.done = true;
    var r = b.result, s = b.summary;
    var F = r.fighters;
    setHp('A', F.A.hp, F.A.maxHp); setHp('B', F.B.hp, F.B.maxHp);
    var wSide = r.winner, lSide = wSide === 'A' ? 'B' : 'A';
    $('#fighter-' + lSide).classList.add('ko');
    $('#fighter-' + wSide).classList.add('winner');
    $('#turn-label').textContent = 'Fin — ' + r.turns + ' tours';
    setTimeout(function () {
      if (ui.battle !== b) return;
      showResult(b);
    }, b.skip ? 150 : 1100 / b.speed);
  }
  function showResult(b) {
    var s = b.summary, r = b.result, win = s.playerWon;
    var pXp = win ? s.xpWinner : s.xpLoser;
    var pBefore = win ? s.winnerLevelBefore : s.loserLevelBefore, pAfter = win ? s.winnerLevelAfter : s.loserLevelAfter;
    var oXp = win ? s.xpLoser : s.xpWinner;
    var oBefore = win ? s.loserLevelBefore : s.winnerLevelBefore, oAfter = win ? s.loserLevelAfter : s.winnerLevelAfter;
    if (win) A.win(); else A.lose();
    if (pAfter > pBefore) setTimeout(A.levelUp, 700);
    $('#result-box').innerHTML =
      '<h2 class="result-title ' + (win ? 'win' : 'lose') + '">' + (win ? 'VICTOIRE' : 'DÉFAITE') + '</h2>' + modeLines(b) +
      (b.ranked && b.server.newRewards.length ? b.server.newRewards.map(function (r) { return '<p class="result-reward">🏆 Récompense NFT ' + esc(r.tierFr) + ' débloquée : ' + esc(r.label) + '</p>'; }).join('') : '') +
      '<img class="result-img" src="' + esc((win ? b.a : b.b).image) + '" alt="">' +
      '<p class="muted">' + esc((win ? b.a : b.b).name) + ' gagne en ' + r.turns + ' tours.</p>' +
      '<div class="result-lines">' +
      (b.ranked ? '<div><span>Points classés (serveur)</span><b>+' + b.server.summary.points + '</b></div>' : '') +
      '<div><span>' + (b.ranked ? 'Points locaux' : 'Points gagnés') + '</span><b>+' + s.points + '</b></div>' +
      missionLines(b) +
      '<div><span>XP ' + esc(b.a.name) + '</span><b>+' + pXp + '</b></div>' +
      (pAfter > pBefore ? '<div class="levelup"><span>NIVEAU SUPÉRIEUR !</span><b>Niv. ' + pBefore + ' → ' + pAfter + '</b></div>' : '<div><span>Niveau</span><b>' + pAfter + '</b></div>') +
      '<div><span>XP ' + esc(b.b.name) + '</span><b>+' + oXp + (oAfter > oBefore ? ' (Niv. ' + oAfter + ')' : '') + '</b></div>' +
      '<div><span>Série en cours</span><b>' + save.profile.streak + '</b></div>' +
      '</div>' +
      '<div class="result-actions">' +
      ((b.extra && (b.extra.mode === 'tournoi' || b.extra.mode === 'pvp')) ? '' : '<button class="btn btn-primary" data-res="rematch">↻ Revanche</button>' +
      '<button class="btn" data-res="next">🎲 Nouvel adversaire</button>') + (b.extra && b.extra.mode === 'pvp' ? '<button class="btn btn-primary" data-res="next">🌐 Nouveau match</button>' : '') +
      '<button class="btn btn-ghost" data-res="setup">Changer</button>' +
      '<button class="btn btn-ghost" data-res="board">♛ Classement</button></div>';
    $('#result').hidden = false;
    var first = $('[data-res="rematch"]'); if (first) first.focus({ preventScroll: true });
  }
  function modeLines(b) {
    var x = b.extra || {}, out = '';
    var names = { duel: 'Duel', solo: 'Solo vs bots', pvp: 'PvP en ligne', tournoi: 'Tournoi', boss: 'Boss' };
    out += '<p class="mode-tag">' + esc(names[x.mode] || 'Duel') + (x.mode === 'solo' ? ' · ' + esc((E.DIFFICULTIES[save.settings.difficulty] || {}).label || '') : '') + '</p>';
    if (x.mode === 'pvp') out += '<p class="muted small">Adversaire : <span translate="no">' + esc(x.opponent || '?') + '</span>' + (x.ratingDelta != null ? ' · ELO ' + (x.ratingDelta >= 0 ? '+' : '') + x.ratingDelta + ' → ' + x.rating : '') + '</p>';
    if (x.mode === 'boss') out += '<p class="muted small">Dégâts infligés au boss : ' + b.result.damageToB + ' / ' + b.result.fighters.B.maxHp + ' PV · Tentatives restantes : ' + x.attemptsLeft + '</p>';
    if (x.mode === 'tournoi' && x.tournament) {
      var t = x.tournament, ent = t.bracket.entrants;
      var pl = { 1: 'Champion !', 2: 'Finaliste', 3: 'Demi-finaliste', 5: 'Quart de finaliste' }[t.placement];
      out += '<p class="result-reward">🏟 ' + esc(pl) + ' (+' + t.points + ' pts)</p><div class="bracket">' + t.bracket.rounds.map(function (r) {
        return '<div class="b-round"><b>' + esc(r.name) + '</b>' + r.matches.map(function (mm) {
          var nm = function (s) { return '<span class="' + (s === mm.winner ? 'ok-txt' : 'muted') + (s === t.bracket.me ? ' me' : '') + '" translate="no">' + esc(ent[s].name) + '</span>'; };
          return '<div class="b-match">' + nm(mm.a) + ' <small>vs</small> ' + nm(mm.b) + '</div>';
        }).join('') + '</div>';
      }).join('') + '</div>';
    }
    return out;
  }
  function missionLines(b) {
    var list = b.ranked ? b.server.missionsCompleted : b.localMissions;
    return (list || []).map(function (m) { return '<div class="levelup"><span>✔ Mission : ' + esc(m.text) + '</span><b>+' + m.points + '</b></div>'; }).join('');
  }
  function stopBattle(silent) {
    var b = ui.battle; if (!b) return;
    b.skip = true;
    b.timers.forEach(clearTimeout); b.resolvers.forEach(function (r) { r(); });
    ui.battle = null;
    $('#result').hidden = true;
    if (!silent) renderArenaSetup();
  }
  function skipBattle() {
    var b = ui.battle; if (!b || b.done) return;
    b.skip = true;
    b.timers.forEach(clearTimeout); b.resolvers.forEach(function (r) { r(); });
    b.result.events.forEach(function (ev) { if (ev.type === 'attack' || ev.type === 'special' || ev.type === 'dodge') { /* journal complet */ } });
    $$('.fighter').forEach(function (f) { f.classList.remove('lunge', 'hit', 'dodge', 'charge'); });
  }

  /* ---------- Classement ---------- */
  function renderLeaderboard() {
    $('#lb-filters').innerHTML = chipsHTML(ui.lbFilter, false);
    var rows = E.leaderboard(chars(), save);
    if (ui.lbFilter !== 'Toutes') rows = rows.filter(function (r) { return r.rarity === ui.lbFilter; });
    var medals = ['🥇', '🥈', '🥉'];
    $('#lb-podium').innerHTML = rows.slice(0, 3).map(function (r, i) {
      var ch = byId(r.id);
      return '<div class="pod p' + (i + 1) + '" data-id="' + esc(r.id) + '" role="button" tabindex="0"><div class="medal">' + medals[i] + '</div>' +
        '<img src="' + esc(ch.image) + '" alt="" loading="lazy"><b>' + esc(r.name) + '</b><span>' + r.wins + ' V · Niv. ' + r.level + '</span></div>';
    }).join('');
    $('#lb-body').innerHTML = rows.map(function (r) {
      var ch = byId(r.id);
      return '<tr data-id="' + esc(r.id) + '"><td class="num">' + r.rank + '</td>' +
        '<td><div class="who"><img src="' + esc(ch.image) + '" alt="" loading="lazy"><div><b>' + esc(r.name) + '</b><span class="rarity r-' + esc(r.rarity) + '">' + esc(r.rarity) + '</span></div></div></td>' +
        '<td class="num">' + r.level + '</td><td class="num">' + r.wins + '</td><td class="num">' + r.losses + '</td>' +
        '<td class="num hide-sm">' + r.winRate + '%</td><td class="num hide-sm">⚡' + r.power + '</td></tr>';
    }).join('');
  }

  /* ---------- Ajouter un NFT ---------- */
  function renderAdd() {
    var rs = $('#add-rarity');
    if (!rs.options.length) {
      rs.innerHTML = RARITIES.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');
      $('#add-family').innerHTML = '<option value="Personnalisé">Aucune (équilibré)</option>' + FAMILIES.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('');
    }
    updateAddPreview();
    var list = chars().filter(function (c) { return c.custom; });
    $('#custom-grid').innerHTML = list.map(function (c) { return cardHTML(c, { del: true }); }).join('');
    $('#custom-empty').hidden = list.length > 0;
  }
  function draftChar() {
    return { id: 'apercu', name: $('#add-name').value.trim() || 'Mon NFT', rarity: $('#add-rarity').value || 'Commun', traits: { famille: $('#add-family').value || 'Personnalisé' } };
  }
  function updateAddPreview() {
    var d = draftChar();
    $('#add-stats').innerHTML = '<p class="small muted" style="margin:0 0 8px">Statistiques de départ (niveau 1) :</p>' + statsHTML(E.baseStats(d));
  }
  function resizeImage(file, size) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('type'));
      if (file.size > 25 * 1024 * 1024) return reject(new Error('taille'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight);
        var cv = document.createElement('canvas'); cv.width = size; cv.height = size;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#10061f'; cx.fillRect(0, 0, size, size);
        cx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('lecture')); };
      img.src = url;
    });
  }
  function handleFile(file) {
    var msg = $('#add-msg'); msg.className = 'form-msg'; msg.textContent = 'Traitement de l’image…';
    resizeImage(file, 320).then(function (data) {
      ui.upload = data;
      var pv = $('#add-preview'); pv.src = data; pv.hidden = false; $('#drop-text').hidden = true;
      if (!$('#add-name').value) $('#add-name').value = (file.name || 'Mon NFT').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40);
      msg.textContent = 'Image prête.'; msg.className = 'form-msg ok';
      updateAddPreview();
    }).catch(function (e) {
      ui.upload = null;
      msg.className = 'form-msg err';
      msg.textContent = e.message === 'taille' ? 'Image trop lourde (25 Mo maximum).' : 'Ce fichier n’est pas une image lisible.';
    });
  }
  function submitAdd(e) {
    e.preventDefault();
    var msg = $('#add-msg');
    var name = $('#add-name').value.trim();
    if (!ui.upload) { msg.className = 'form-msg err'; msg.textContent = 'Ajoute d’abord une image.'; return; }
    if (!name) { msg.className = 'form-msg err'; msg.textContent = 'Donne un nom à ton personnage.'; return; }
    var id = 'c-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    var entry = { id: id, name: name.slice(0, 40), rarity: $('#add-rarity').value, image: ui.upload, createdAt: Date.now(), traits: { famille: $('#add-family').value } };
    save.custom.push(entry);
    if (!persist()) { save.custom.pop(); persist(); msg.className = 'form-msg err'; msg.textContent = 'Stockage plein : impossible d’ajouter ce NFT.'; return; }
    invalidate();
    ui.upload = null;
    $('#add-form').reset(); $('#add-preview').hidden = true; $('#add-preview').removeAttribute('src'); $('#drop-text').hidden = false;
    msg.className = 'form-msg ok'; msg.textContent = '« ' + entry.name + ' » a rejoint ta collection !';
    toast('NFT ajouté : ' + entry.name);
    renderAdd();
  }
  function deleteCustom(id) {
    var ch = byId(id); if (!ch || !ch.custom) return;
    confirmBox('Supprimer « ' + ch.name + ' » et sa progression ?', function () {
      save.custom = save.custom.filter(function (c) { return c.id !== id; });
      delete save.chars[id];
      if (save.settings.lastA === id) save.settings.lastA = '';
      if (ui.sel.A === id) ui.sel.A = null; if (ui.sel.B === id) ui.sel.B = null;
      persist(); invalidate(); renderAdd(); toast('NFT supprimé.');
    });
  }

  /* ---------- Profil ---------- */
  function renderProfile() {
    var p = save.profile, rt = rankTitle(p.points);
    var rate = p.battles ? Math.round(p.wins / p.battles * 100) : 0;
    var trained = Object.keys(save.chars).length;
    $('#pf-stats').innerHTML = '<h3>Joueur</h3><p class="rank-title">' + esc(rt.name) + '</p>' +
      '<p class="muted small">' + (rt.next ? (rt.next[0] - p.points) + ' points avant le rang « ' + rt.next[1] + ' »' : 'Rang maximum atteint !') + '</p>' +
      '<div class="kv"><span>Points</span><b>' + p.points.toLocaleString(L()) + '</b><span>Combats</span><b>' + p.battles + '</b>' +
      '<span>Victoires</span><b>' + p.wins + '</b><span>Défaites</span><b>' + p.losses + '</b><span>Taux de victoire</span><b>' + rate + '%</b>' +
      '<span>Série actuelle</span><b>' + p.streak + '</b><span>Meilleure série</span><b>' + p.bestStreak + '</b>' +
      '<span>Personnages entraînés</span><b>' + trained + '</b><span>NFT ajoutés</span><b>' + save.custom.length + '</b></div>';
    $('#pf-history').innerHTML = save.history.length ? save.history.map(function (h) {
      var a = byId(h.a), b = byId(h.b);
      return '<li class="' + (h.win ? 'w' : 'l') + '"><span>' + esc(a ? a.name : '?') + ' vs ' + esc(b ? b.name : (h.bName || '?')) + '</span><b>' + (h.win ? 'V' : 'D') + ' +' + h.pts + '</b></li>';
    }).join('') : '<li class="muted">Aucun combat pour l’instant.</li>';
    $('#opt-sound').checked = save.settings.sound;
  }
  function confirmBox(text, onYes) {
    openModal('<h3 id="modal-title" style="margin:0 40px 14px 0">Confirmation</h3><p>' + esc(text) + '</p>' +
      '<div class="btn-row"><button class="btn btn-danger" id="cf-yes">Oui, confirmer</button><button class="btn btn-ghost" data-close>Annuler</button></div>');
    $('#cf-yes').addEventListener('click', function () { closeModal(); onYes(); });
  }

  /* ---------- Notification ---------- */
  var toastT;
  function toast(t) {
    var el = $('#toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- Inclinaison 3D des cartes ---------- */
  function bindTilt() {
    if (reduceMotion || !(window.matchMedia && window.matchMedia('(hover: hover)').matches)) return;
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (!c || c.closest('.slot-card') || c.closest('.hero-cards')) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - .5) * 18).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((.5 - y) * 18).toFixed(2) + 'deg');
      c.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    document.addEventListener('pointerout', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
    });
  }


  /* ---------- Récompenses : wallet, missions, NFT, classement des joueurs, lecture on-chain ---------- */
  var CFG = W.config;
  function isAdminAddr(a) { return !!a && a.toLowerCase() === String(CFG.ADMIN_ADDRESS).toLowerCase(); }
  function statusFr(st) { return { earned: 'À réclamer', pending: 'En attente de validation', approved: 'Validée — envoi en cours', sent: 'Envoyé', rejected: 'Refusée' }[st] || st; }
  function errMsg(e) {
    if (!e) return 'Erreur';
    if (e.code === 4001) return 'Demande refusée dans le wallet.';
    if (e.message === 'no-wallet') return 'Aucun wallet détecté : installe MetaMask (ou un wallet compatible).';
    if (e.message === 'mobile-no-wallet') return 'Ouvre le jeu dans l’application MetaMask.';
    return e.message || String(e);
  }
  function renderWallet() {
    var st = W.state, sess = W.getSession(), html = '', act = '';
    if (!W.hasProvider()) {
      html = '<span class="warn-txt">Aucun wallet détecté dans ce navigateur.</span>';
      act = W.isMobile()
        ? '<a class="btn btn-primary btn-small" id="mm-deeplink" href="' + esc(W.deepLink()) + '">🦊 Ouvrir dans MetaMask</a>'
        : '<a class="btn btn-small" href="https://metamask.io/download/" target="_blank" rel="noopener">Installer MetaMask</a><a class="btn btn-small btn-ghost" id="mm-deeplink" href="' + esc(W.deepLink()) + '">Lien MetaMask mobile</a>';
    } else if (!st.address) {
      html = '<span class="muted">Wallet non connecté.</span>';
      act = '<button class="btn btn-primary btn-small" data-w="connect">🦊 Connecter mon wallet</button>';
    } else {
      var onChain = st.chainId === Number(CFG.CHAIN_ID);
      html = '<span>Adresse : <span class="addr">' + esc(st.address) + '</span></span>' +
        '<span>Réseau : ' + (onChain ? '<span class="ok-txt">✓ ' + esc(CFG.CHAIN_NAME) + ' (' + CFG.CHAIN_ID + ')</span>' : '<span class="warn-txt">⚠ autre réseau (' + st.chainId + ')</span>') + '</span>' +
        '<span>Serveur : ' + (!W.apiEnabled() ? '<span class="warn-txt">hors ligne — jeu local, aucune réclamation NFT</span>' : sess && sess.address === st.address ? '<span class="ok-txt">✓ connecté' + (sess.isAdmin ? ' (admin)' : '') + (W.backendStatus().realClaims ? '' : ' · réclamations réelles désactivées') + '</span>' : '<span class="muted">non connecté</span>') + '</span>';
      if (!onChain) act += '<button class="btn btn-small" data-w="switch">Passer sur Robinhood Chain</button>';
      if (W.apiEnabled() && !(sess && sess.address === st.address)) act += '<button class="btn btn-primary btn-small" data-w="signin">✍ Se connecter (signature)</button>';
      if (isAdminAddr(st.address)) { html += '<span><span class="founder-badge">👑 FONDATEUR</span></span>'; act += '<a class="btn btn-small" href="#admin">🔐 Espace admin</a>'; }
      act += '<button class="btn btn-small btn-ghost" data-w="disconnect">Déconnecter</button>';
    }
    $('#wallet-status').innerHTML = html;
    $('#wallet-actions').innerHTML = act;
  }
  function missionsHTML(list) {
    return list.map(function (m) {
      var pct = Math.min(100, m.progress / m.target * 100);
      return '<li class="' + (m.done ? 'done' : '') + '"><div class="m-top"><span>' + (m.done ? '✔ ' : '') + esc(m.text) + '</span><b>+' + m.points + '</b></div>' +
        '<div class="bar xpbar"><i style="width:' + pct.toFixed(0) + '%"></i></div><span class="muted small">' + m.progress + ' / ' + m.target + '</span></li>';
    }).join('');
  }
  function localMissions() {
    var day = E.dayKey(), st = save.missions && save.missions.day === day ? save.missions : { progress: {}, done: {} };
    return E.dailyMissions(day).map(function (m) { return { id: m.id, text: m.text, target: m.target, points: m.points, progress: st.progress[m.id] || 0, done: !!st.done[m.id] }; });
  }
  function rewardCard(r) {
    var ch = r.tokenId ? byId(String(r.tokenId).padStart(4, '0')) : null;
    return '<div class="claim">' + (ch ? '<img src="' + esc(ch.image) + '" alt="">' : '<span class="claim-ph">🎁</span>') +
      '<div><div class="c-head"><b>' + esc(r.label) + '</b><span class="rarity">' + esc(r.tierFr || r.tier) + '</span><span class="status st-' + esc(r.status) + '">' + esc(statusFr(r.status)) + '</span>' + (r.test ? '<span class="status st-test">TEST</span>' : '') + '</div>' +
      (r.tokenId ? '<div>' + (r.test ? 'NFT de test (non réservé) :' : 'NFT réservé :') + ' <a href="' + esc(W.explorerToken(r.tokenId)) + '" target="_blank" rel="noopener">Neon Buddies #' + String(r.tokenId).padStart(4, '0') + ' ↗</a></div>' : '') +
      (r.txHash ? '<div>Transaction : <a translate="no" href="' + esc(W.explorerTx(r.txHash)) + '" target="_blank" rel="noopener">' + esc(W.short(r.txHash)) + ' ↗</a></div>' : '') +
      (r.note ? '<div class="muted">Note : ' + esc(r.note) + '</div>' : '') +
      (r.status === 'earned' ? (founderNoClaim(r) ? '<p class="muted small">Réclamation réelle désactivée : le fondateur détient déjà le stock.</p>' : (!r.test && !W.backendStatus().realClaims ? '<p class="muted small">Réclamation réelle désactivée : le serveur n’envoie aucun NFT.</p>' : '<div class="btn-row"><button class="btn btn-primary btn-small" data-claim="' + esc(r.id) + '">' + (r.test ? '🧪 Réclamer (test)' : '🎁 Réclamer le NFT') + '</button></div>')) : '') +
      '</div></div>';
  }
  var meCache = null;
  function founderNoClaim(r) { return !r.test && meCache && meCache.profile.founder; }
  var onchainCache = null;
  async function renderOnchain(force) {
    var el = $('#onchain');
    if (onchainCache && !force) { el.innerHTML = onchainCache; return; }
    el.innerHTML = '<p class="muted small">Lecture de Robinhood Chain…</p>';
    try {
      var cid = await W.rpcChainId(), name = await W.contractName(), owner = await W.ownerOf(1);
      onchainCache = '<div class="kv"><span>Réseau</span><b class="' + (cid === Number(CFG.CHAIN_ID) ? 'ok-txt' : 'err-txt') + '">' + cid + (cid === Number(CFG.CHAIN_ID) ? ' ✓' : ' ✗') + '</b>' +
        '<span>Contrat</span><b translate="no"><a href="' + esc(W.explorerAddress(CFG.NFT_CONTRACT)) + '" target="_blank" rel="noopener">' + esc(W.short(CFG.NFT_CONTRACT)) + '</a></b>' +
        '<span>Nom on-chain</span><b translate="no">' + esc(name) + '</b>' +
        '<span>Propriétaire #1</span><b>' + esc(W.short(owner)) + (isAdminAddr(owner) ? ' (admin)' : '') + '</b></div><p class="small" id="onchain-owner"></p>';
      el.innerHTML = onchainCache;
    } catch (e) { el.innerHTML = '<p class="err-txt small">RPC injoignable : ' + esc(errMsg(e)) + '</p>'; }
  }
  async function renderRewards() {
    renderWallet();
    renderOnchain();
    var sess = W.getSession();
    var mineEl = $('#my-rewards'), lbEl = $('#players-lb');
    if (!W.apiEnabled()) {
      $('#missions').innerHTML = missionsHTML(localMissions());
      $('#missions-note').textContent = 'Mode hors ligne : missions et points enregistrés dans ce navigateur.';
      mineEl.innerHTML = '<p class="muted small">' + (W.backendStatus().configured ? 'Serveur de récompenses injoignable. Jeu local uniquement : aucune réclamation NFT, aucun combat classé.' : 'Serveur de récompenses non configuré. Jeu local uniquement : aucune réclamation NFT.') + '</p>';
      lbEl.innerHTML = '<li class="muted">Classement en ligne indisponible hors ligne.</li>';
      return;
    }
    W.api('/api/leaderboard', { auth: false }).then(function (d) {
      var me = sess && sess.address;
      lbEl.innerHTML = d.players.length ? d.players.map(function (p) {
        return '<li class="' + (p.address === me ? 'me' : '') + '"><span>' + p.rank + '</span><span class="pa" translate="no">' + esc(p.name || W.short(p.address)) + '</span><b>' + p.points.toLocaleString(L()) + '</b></li>';
      }).join('') : '<li class="muted">Aucun joueur classé pour l’instant.</li>';
    }).catch(function (e) { lbEl.innerHTML = '<li class="err-txt">' + esc(errMsg(e)) + '</li>'; });
    if (!sess) {
      $('#missions').innerHTML = missionsHTML(localMissions());
      $('#missions-note').textContent = 'Connecte ton wallet et signe la connexion pour que tes missions comptent au classement.';
      W.api('/api/config', { auth: false }).then(function (c) {
        mineEl.innerHTML = '<p class="muted small">Récompenses à débloquer en combats classés :</p>' + c.rules.map(function (r) {
          return '<p class="rule">🏆 <b>' + esc(r.tierFr) + '</b> — ' + esc(r.label) + ' <span class="muted">(stock : ' + (c.stock[r.tier] || 0) + ')</span></p>';
        }).join('');
      }).catch(function (e) { mineEl.innerHTML = '<p class="err-txt small">' + esc(errMsg(e)) + '</p>'; });
      return;
    }
    try {
      var me = await W.api('/api/me');
      meCache = me;
      $('#missions').innerHTML = missionsHTML(me.missions);
      $('#missions-note').textContent = 'Missions classées (serveur), renouvelées chaque jour à minuit UTC (01:00 à Bruxelles en hiver, 02:00 en été).';
      var founderHtml = me.profile.founder ? '<div class="founder-card"><span class="founder-badge big">👑 FONDATEUR</span>' +
          '<p class="small">Tu possèdes les 100 Neon Buddies on-chain. Tes combats suivent exactement les mêmes règles que tous les joueurs (aucun bonus) et tu apparais dans le classement global.</p>' +
          '<p class="small warn-txt">Réclamations réelles désactivées : tu détiens déjà le stock. Utilise le mode test pour essayer tout le parcours.</p></div>' : '';
      var testHtml = me.isAdmin ? '<label class="toggle"><input type="checkbox" id="opt-testmode"' + (me.profile.testMode ? ' checked' : '') + '> <span>🧪 Mode test des récompenses (aucun NFT réel, aucun crypto dépensé)</span></label>' : (me.profile.testMode ? '<p class="small"><span class="status st-test">MODE TEST</span> activé par l’administrateur pour ton compte.</p>' : '');
      mineEl.innerHTML = founderHtml + testHtml + '<div class="kv"><span>Points classés</span><b>' + me.profile.points.toLocaleString(L()) + '</b><span>Victoires</span><b>' + me.profile.wins + '</b><span>Meilleure série</span><b>' + me.profile.bestStreak + '</b></div>' +
        '<div style="margin:14px 0">' + me.rules.map(function (r) {
          var pct = Math.min(100, r.current / r.value * 100);
          return '<div class="rule"><div class="m-top"><span>' + esc(r.tierFr) + ' — ' + esc(r.label) + '</span><b>' + Math.min(r.current, r.value) + '/' + r.value + '</b></div><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
        }).join('') + '</div>' +
        (me.rewards.length ? '<div class="claims">' + me.rewards.map(rewardCard).join('') + '</div>' : '<p class="muted small">Aucune récompense obtenue pour l’instant.</p>');
    } catch (e) { mineEl.innerHTML = '<p class="err-txt small">' + esc(errMsg(e)) + '</p>'; }
  }

  /* ---------- Espace admin (accès vérifié par le serveur) ---------- */
  var adminFilter = 'pending';
  async function refreshBadge() {
    var s = W.getSession(), badge = $('#nav-badge');
    if (!s || !s.isAdmin || !W.apiEnabled()) { badge.hidden = true; return; }
    try {
      var sum = await W.api('/api/admin/summary');
      var n = (sum.counts.pending || 0) + (sum.counts.approved || 0);
      badge.textContent = n; badge.hidden = n === 0;
      return sum;
    } catch (e) { badge.hidden = true; }
  }
  async function renderAdmin() {
    var gate = $('#admin-gate'), area = $('#admin-area'), s = W.getSession(), st = W.state;
    area.hidden = true; gate.hidden = false;
    if (!W.apiEnabled()) { gate.innerHTML = '<p>Serveur de récompenses hors ligne. Espace admin indisponible : aucun transfert ne peut être préparé.</p>'; return; }
    if (!s || !s.isAdmin) {
      gate.innerHTML = '<h3>Accès réservé</h3><p class="muted">Seul le wallet administrateur <code class="contract">' + esc(CFG.ADMIN_ADDRESS) + '</code> peut ouvrir cet espace. Le serveur vérifie la signature.</p>' +
        '<div class="btn-row">' + (!st.address ? '<button class="btn btn-primary btn-small" data-w="connect">🦊 Connecter mon wallet</button>' :
          isAdminAddr(st.address) ? '<button class="btn btn-primary btn-small" data-w="signin">✍ Signer la connexion admin</button>' : '<span class="err-txt">Ce wallet n’est pas l’administrateur.</span>') + '</div>';
      return;
    }
    gate.hidden = true; area.hidden = false;
    var sum = await refreshBadge();
    if (sum) {
      $('#admin-summary').innerHTML = '<div class="kv"><span>En attente</span><b>' + (sum.counts.pending || 0) + '</b><span>Validées (à envoyer)</span><b>' + (sum.counts.approved || 0) + '</b><span>Envoyées</span><b>' + (sum.counts.sent || 0) + '</b><span>Refusées</span><b>' + (sum.counts.rejected || 0) + '</b><span>Non réclamées</span><b>' + (sum.counts.earned || 0) + '</b><span>Telegram</span><b>' + (sum.telegram ? '✓ actif' : 'non configuré') + '</b></div>';
      $('#admin-notes').innerHTML = sum.notifications.map(function (n) {
        return '<li class="' + (n.seen ? '' : 'w') + '"><span translate="no" lang="fr">' + esc(n.text) + '</span><span class="muted small" translate="no">' + new Date(n.created_at).toLocaleString(L()) + '</span></li>';
      }).join('') || '<li class="muted">Aucune notification.</li>';
      if (sum.unseen) W.api('/api/admin/notifications/seen', { method: 'POST', body: {} }).catch(function () {});
    }
    $('#admin-filters').innerHTML = [['pending', 'En attente'], ['approved', 'Validées'], ['sent', 'Envoyées'], ['rejected', 'Refusées'], ['', 'Toutes (tests inclus)']].map(function (f) {
      return '<button class="chip' + (f[0] === adminFilter ? ' active' : '') + '" data-afilter="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
    var list = $('#admin-list');
    try {
      var d = await W.api('/api/admin/rewards' + (adminFilter ? '?status=' + adminFilter : ''));
      list.innerHTML = d.rewards.map(function (r) {
        var ch = r.tokenId ? byId(String(r.tokenId).padStart(4, '0')) : null;
        return '<div class="claim" data-rid="' + esc(r.id) + '">' + (ch ? '<img src="' + esc(ch.image) + '" alt="">' : '<span>🎁</span>') + '<div>' +
          '<div class="c-head"><b>' + esc(r.label) + '</b><span class="rarity">' + esc(r.tierFr) + '</span><span class="status st-' + esc(r.status) + '">' + esc(statusFr(r.status)) + '</span></div>' +
          '<div>Joueur : <a href="' + esc(W.explorerAddress(r.address)) + '" target="_blank" rel="noopener"><code>' + esc(r.address) + '</code></a></div>' +
          (r.tokenId ? '<div>Token : <a href="' + esc(W.explorerToken(r.tokenId)) + '" target="_blank" rel="noopener">#' + String(r.tokenId).padStart(4, '0') + ' ↗</a></div>' : '') +
          (r.txHash ? '<div>Tx : <a translate="no" href="' + esc(W.explorerTx(r.txHash)) + '" target="_blank" rel="noopener">' + esc(W.short(r.txHash)) + ' ↗</a></div>' : '') +
          '<div class="btn-row">' +
          (r.status === 'pending' && (r.test || W.backendStatus().realClaims) ? '<button class="btn btn-primary btn-small" data-aact="approve">✅ Approuver et préparer le transfert</button>' : '') +
          (r.status === 'approved' && (r.test || W.backendStatus().realClaims) ? '<button class="btn btn-primary btn-small" data-aact="approve">' + (r.test ? '🧪 Simuler le transfert' : '✍ Signer le transfert avec mon wallet') + '</button>' : '') +
          (!r.test && !W.backendStatus().realClaims ? '<p class="muted small">Réclamations réelles désactivées sur le serveur. Aucun transfert ne sera préparé.</p>' : '') +
          (['earned', 'pending', 'approved'].indexOf(r.status) >= 0 ? '<button class="btn btn-danger btn-small" data-aact="reject">Refuser</button>' : '') +
          '</div><div class="tx-slot"></div></div></div>';
      }).join('') || '<p class="muted">Aucune demande.</p>';
    } catch (e) { list.innerHTML = '<p class="err-txt">' + esc(errMsg(e)) + '</p>'; }
  }
  async function adminApprove(rid, slot) {
    slot.innerHTML = '<div class="tx-box">Vérification…</div>';
    try {
      var out = await W.api('/api/admin/rewards/' + encodeURIComponent(rid) + '/approve', { method: 'POST', body: {} });
      var tx = out.tx;
      if (out.test) {
        slot.innerHTML = '<div class="tx-box"><b><span class="status st-test">TEST</span> Transfert simulé — aucune transaction ne sera signée ni envoyée</b>' +
          '<span>Simulation en lecture seule sur Robinhood Chain (eth_call + estimation du gaz) de safeTransferFrom(admin → <code>' + esc(out.reward.address) + '</code>, #' + out.reward.tokenId + ').</span>' +
          '<div class="btn-row"><button class="btn btn-primary btn-small" data-sim="' + esc(rid) + '">🧪 Lancer la simulation</button></div><span class="tx-msg" role="status"></span></div>';
        return;
      }
      var owner = await W.ownerOf(out.reward.tokenId).catch(function () { return null; });
      var ownerOk = owner && owner === tx.from.toLowerCase();
      slot.innerHTML = '<div class="tx-box"><b>Transaction à signer (safeTransferFrom)</b>' +
        '<span>De : <code>' + esc(tx.from) + '</code></span><span>Vers le contrat : <code>' + esc(tx.to) + '</code></span>' +
        '<span>Joueur : <code>' + esc(out.reward.address) + '</code> — token #' + out.reward.tokenId + '</span>' +
        '<span>ownerOf(#' + out.reward.tokenId + ') : ' + (ownerOk ? '<span class="ok-txt">✓ admin</span>' : '<span class="err-txt">✗ ' + esc(owner || 'lecture impossible') + '</span>') + '</span>' +
        '<span>Données : <code>' + esc(tx.data) + '</code></span>' +
        '<div class="btn-row"><button class="btn btn-primary btn-small" data-send="' + esc(rid) + '"' + (ownerOk ? '' : ' disabled') + '>Signer et envoyer avec mon wallet</button></div>' +
        '<div class="btn-row"><input class="input" placeholder="…ou colle un hash de transaction 0x…" data-hash-input style="flex:1;min-width:0"><button class="btn btn-small" data-hash="' + esc(rid) + '">Vérifier</button></div>' +
        '<span class="tx-msg" role="status"></span></div>';
      slot.__tx = tx;
    } catch (e) { slot.innerHTML = '<div class="tx-box err-txt">' + esc(errMsg(e)) + '</div>'; }
  }
  async function adminSend(rid, slot) {
    var msg = $('.tx-msg', slot), tx = slot.__tx;
    try {
      if (!W.state.address) await W.connect();
      if (!isAdminAddr(W.state.address)) throw new Error('Connecte le wallet administrateur pour signer.');
      msg.textContent = 'Confirme la transaction dans ton wallet…';
      var hash = await W.sendTx(tx);
      msg.innerHTML = 'Envoyée : <a href="' + esc(W.explorerTx(hash)) + '" target="_blank" rel="noopener">' + esc(W.short(hash)) + '</a> — attente de confirmation…';
      await W.waitReceipt(hash, 180000);
      await adminVerify(rid, hash, slot);
    } catch (e) { msg.innerHTML = '<span class="err-txt">' + esc(errMsg(e)) + '</span>'; }
  }
  async function adminVerify(rid, hash, slot) {
    var msg = $('.tx-msg', slot);
    for (var i = 0; i < 20; i++) {
      var r = await W.api('/api/admin/rewards/' + encodeURIComponent(rid) + '/tx', { method: 'POST', body: { txHash: hash } });
      if (r.verified) { msg.innerHTML = '<span class="ok-txt">✓ Transfert vérifié sur la blockchain.</span>'; toast('NFT envoyé et vérifié ✓'); setTimeout(renderAdmin, 1200); return; }
      msg.textContent = r.message || 'En attente de confirmation…';
      await new Promise(function (res) { setTimeout(res, 4000); });
    }
  }
  function bindRewards() {
    W.onChange(function () { updateBackendBanner(); var v = (location.hash || '').slice(1); if (v === 'recompenses') renderRewards(); else if (v === 'admin') renderAdmin(); else if (v === 'arene' && !ui.battle) renderArenaSetup(); refreshBadge(); });
    document.addEventListener('click', async function (e) {
      var w = e.target.closest('[data-w]');
      if (w) {
        var what = w.getAttribute('data-w');
        try {
          if (what === 'connect') await W.connect();
          if (what === 'switch') await W.switchChain();
          if (what === 'signin') { var v = await W.signIn(); toast(v.isAdmin ? 'Connecté en administrateur ✓' : 'Connecté au serveur ✓'); }
          if (what === 'disconnect') { W.disconnect(); toast('Wallet déconnecté.'); }
        } catch (err) {
          toast(errMsg(err));
          if (err && err.deepLink && W.isMobile()) location.href = err.deepLink;
        }
        route(); return;
      }
      var cl = e.target.closest('[data-claim]');
      if (cl) {
        cl.disabled = true;
        try { var r = await W.api('/api/rewards/' + encodeURIComponent(cl.getAttribute('data-claim')) + '/claim', { method: 'POST', body: {} }); toast('Demande envoyée : NFT #' + String(r.tokenId).padStart(4, '0') + ' réservé, en attente de validation.'); }
        catch (err) { toast(errMsg(err)); }
        renderRewards(); return;
      }
      var af = e.target.closest('[data-afilter]');
      if (af) { adminFilter = af.getAttribute('data-afilter'); renderAdmin(); return; }
      var aa = e.target.closest('[data-aact]');
      if (aa) {
        var card = aa.closest('[data-rid]'), rid = card.getAttribute('data-rid'), slot = $('.tx-slot', card);
        if (aa.getAttribute('data-aact') === 'approve') adminApprove(rid, slot);
        else confirmBox('Refuser cette demande ? Le NFT réservé redevient disponible.', async function () {
          try { await W.api('/api/admin/rewards/' + encodeURIComponent(rid) + '/reject', { method: 'POST', body: { note: 'Refusé par l’administrateur' } }); toast('Demande refusée.'); } catch (err) { toast(errMsg(err)); }
          renderAdmin();
        });
        return;
      }
      var sm = e.target.closest('[data-sim]');
      if (sm) {
        var ss = sm.closest('.tx-slot'), mg = $('.tx-msg', ss); sm.disabled = true;
        try {
          var out = await W.api('/api/admin/rewards/' + encodeURIComponent(sm.getAttribute('data-sim')) + '/simulate', { method: 'POST', body: {} });
          mg.innerHTML = out.ok ? '<span class="ok-txt">✓ Simulation réussie' + (out.gas ? ' (gaz estimé ' + out.gas + ')' : '') + '. Récompense de test marquée « envoyée » — aucun NFT n’a bougé.</span>' : '<span class="err-txt">Simulation en échec : ' + esc(out.reason) + '</span>';
          setTimeout(renderAdmin, 1500);
        } catch (err) { mg.innerHTML = '<span class="err-txt">' + esc(errMsg(err)) + '</span>'; }
        return;
      }
      var sd = e.target.closest('[data-send]');
      if (sd) { adminSend(sd.getAttribute('data-send'), sd.closest('.tx-slot')); return; }
      var hh = e.target.closest('[data-hash]');
      if (hh) {
        var sl = hh.closest('.tx-slot'), val = $('[data-hash-input]', sl).value.trim();
        try { await adminVerify(hh.getAttribute('data-hash'), val, sl); } catch (err) { $('.tx-msg', sl).innerHTML = '<span class="err-txt">' + esc(errMsg(err)) + '</span>'; }
      }
    });
    document.addEventListener('change', async function (e) {
      if (e.target.id !== 'opt-testmode') return;
      try { var r = await W.api('/api/admin/test-mode', { method: 'POST', body: { enabled: e.target.checked } }); toast(r.testMode ? 'Mode test activé : récompenses de TEST uniquement.' : 'Mode test désactivé.'); }
      catch (err) { toast(errMsg(err)); }
      renderRewards();
    });
    $('#testmode-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { var r = await W.api('/api/admin/test-mode', { method: 'POST', body: { address: $('#tm-address').value.trim(), enabled: $('#tm-enabled').checked } }); toast('Mode test ' + (r.testMode ? 'activé' : 'désactivé') + ' pour ' + W.short(r.address)); }
      catch (err) { toast(errMsg(err)); }
    });
    $('#onchain-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = Math.max(1, Math.min(100, parseInt($('#onchain-id').value, 10) || 1));
      var el = $('#onchain-owner'); if (!el) { await renderOnchain(true); el = $('#onchain-owner'); }
      if (el) el.textContent = 'Lecture…';
      try { var o = await W.ownerOf(id); if (el) el.innerHTML = 'Token #' + id + ' : <a href="' + esc(W.explorerAddress(o)) + '" target="_blank" rel="noopener">' + esc(W.short(o)) + '</a>' + (isAdminAddr(o) ? ' (admin)' : ''); }
      catch (err) { if (el) el.textContent = errMsg(err); }
    });
    $('#grant-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await W.api('/api/admin/grant', { method: 'POST', body: { address: $('#grant-address').value.trim(), label: $('#grant-label').value.trim(), tier: $('#grant-tier').value, test: $('#grant-test').checked } }); toast('Récompense attribuée.'); e.target.reset(); renderAdmin(); }
      catch (err) { toast(errMsg(err)); }
    });
  }

  /* ---------- Événements ---------- */
  function bind() {
    window.addEventListener('hashchange', route);
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-close]')) { closeModal(); return; }
      var del = t.closest('[data-del]');
      if (del) { e.stopPropagation(); deleteCustom(del.getAttribute('data-del')); return; }
      var set = t.closest('[data-set]');
      if (set) { setSel(set.getAttribute('data-set'), set.getAttribute('data-id')); closeModal(); A.click(); go('arene'); return; }
      var card = t.closest('.card');
      if (card) {
        var action = card.getAttribute('data-action') || 'detail', id = card.getAttribute('data-id');
        if (action === 'pick-A' || action === 'pick-B') { setSel(action.slice(-1), id); closeModal(); renderArenaSetup(); A.click(); return; }
        openDetail(id); return;
      }
      var lbRow = t.closest('#lb-body tr, .pod');
      if (lbRow) { openDetail(lbRow.getAttribute('data-id')); return; }
      var pick = t.closest('[data-pick]');
      if (pick) { openPicker(pick.getAttribute('data-pick')); return; }
      var rnd = t.closest('[data-random]');
      if (rnd) { var sd = rnd.getAttribute('data-random'); setSel(sd, randomChar(ui.sel[sd === 'A' ? 'B' : 'A']).id); renderArenaSetup(); A.click(); return; }
      var md = t.closest('[data-mode]');
      if (md) { stopPvp(false); save.settings.mode = md.getAttribute('data-mode'); persist(); $('#pvp-wait').hidden = true; renderArenaSetup(); A.click(); return; }
      var df = t.closest('[data-diff]');
      if (df) { save.settings.difficulty = df.getAttribute('data-diff'); persist(); renderModePanel(); A.click(); return; }
      var pv = t.closest('[data-pvp]');
      if (pv) {
        var pw = pv.getAttribute('data-pvp');
        if (pw === 'cancel') { stopPvp(false); toast('Recherche annulée.'); }
        if (pw === 'retry') { $('#pvp-wait').hidden = true; startPvp(byId(ui.sel.A)); }
        if (pw === 'bot') { $('#pvp-wait').hidden = true; startBattle({ mode: 'solo', difficulty: 'normal', pvpFallback: true }); }
        return;
      }
      var sp = t.closest('[data-speed]');
      if (sp) {
        var v = Number(sp.getAttribute('data-speed')); save.settings.speed = v; persist();
        if (ui.battle) ui.battle.speed = v;
        $$('[data-speed]').forEach(function (c) { c.classList.toggle('active', c === sp); }); return;
      }
      var res = t.closest('[data-res]');
      if (res) {
        var what = res.getAttribute('data-res');
        $('#result').hidden = true;
        ui.battle = null;
        if (what === 'rematch') startBattle();
        else if (what === 'next') { if (mode() === 'duel') ui.sel.B = randomChar(ui.sel.A).id; startBattle(); }
        else if (what === 'board') go('classement');
        else renderArenaSetup();
        return;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.pod, [data-del]')) { e.preventDefault(); e.target.click(); }
    });
    $('#btn-fight').addEventListener('click', function () { A.click(); startBattle(); });
    $('#btn-quick').addEventListener('click', function () {
      A.click(); ensureSel(); ui.sel.B = randomChar(ui.sel.A).id; save.settings.mode = 'duel';
      history.replaceState(null, '', '#arene'); route(); startBattle();
    });
    $('#btn-skip').addEventListener('click', skipBattle);
    $('#gal-search').addEventListener('input', function (e) { ui.galSearch = e.target.value; renderGallery(); });
    $('#gal-sort').addEventListener('change', function (e) { ui.galSort = e.target.value; renderGallery(); });
    $('#gal-filters').addEventListener('click', function (e) { var b = e.target.closest('[data-filter]'); if (b) { ui.galFilter = b.getAttribute('data-filter'); renderGallery(); } });
    $('#lb-filters').addEventListener('click', function (e) { var b = e.target.closest('[data-filter]'); if (b) { ui.lbFilter = b.getAttribute('data-filter'); renderLeaderboard(); } });
    // Ajout de NFT
    $('#add-file').addEventListener('change', function (e) { if (e.target.files[0]) handleFile(e.target.files[0]); });
    var drop = $('#drop');
    ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
    ['input', 'change'].forEach(function (n) {
      $('#add-name').addEventListener(n, updateAddPreview); $('#add-rarity').addEventListener(n, updateAddPreview); $('#add-family').addEventListener(n, updateAddPreview);
    });
    $('#add-form').addEventListener('submit', submitAdd);
    // Profil
    $('#opt-sound').addEventListener('change', function (e) { save.settings.sound = e.target.checked; A.setEnabled(save.settings.sound); persist(); });
    $('#btn-reset').addEventListener('click', function () {
      confirmBox('Effacer toute la progression (points, XP, classement et NFT ajoutés) ?', function () {
        save = store.reset(); invalidate(); ui.sel = { A: null, B: null }; persist(); A.setEnabled(save.settings.sound); toast('Progression réinitialisée.'); route();
      });
    });
    $('#btn-export').addEventListener('click', function () {
      var blob = new Blob([store.exportJson(save)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'neon-buddies-arena-sauvegarde.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('Sauvegarde exportée.');
    });
    $('#import-file').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { save = store.importJson(rd.result); invalidate(); persist(); A.setEnabled(save.settings.sound); toast('Sauvegarde importée.'); route(); }
        catch (err) { toast('Fichier de sauvegarde invalide.'); }
        e.target.value = '';
      };
      rd.readAsText(f);
    });
  }

  /* ---------- Démarrage ---------- */
  function updateBackendBanner() {
    var el = $('#backend-banner'); if (!el) return;
    var b = W.backendStatus(), msg;
    if (!b.configured || b.state !== 'online') msg = 'Serveur de récompenses hors ligne : jeu en mode local uniquement. Aucune réclamation NFT réelle, aucun combat classé envoyé.';
    else if (!b.realClaims) msg = 'Serveur joignable. Réclamations NFT réelles désactivées : aucun NFT n’est réservé ni envoyé. Service non audité.';
    else msg = 'Serveur joignable. Réclamations réelles manuelles et non auditées : aucun transfert sans la signature du wallet administrateur.';
    el.hidden = false;
    el.textContent = msg;
  }
  A.setEnabled(save.settings.sound);
  bind(); bindTilt(); bindRewards(); persist(); route(); updateBackendBanner();
  I.onChange(function () { if (!ui.battle && !pvp) route(); else persist(); });
  W.resume().then(function () { refreshBadge(); });
  setInterval(refreshBadge, 60000);
  window.NBArena = { getSave: function () { return save; }, startBattle: startBattle, skip: skipBattle };
})();
