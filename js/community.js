/* Communauté V2 : appels réels au Worker. Rien n’est inventé si le serveur ne répond pas. */
(function () {
  'use strict';
  var W = window.NBWeb3;
  var I = window.NBI18n;
  var root, tab = 'apercu', timer = null, channel = 'global', after = 0;

  var NOTICE = {
    'scheduler-off': 'Planificateur V2 inactif : les événements, les raids planifiés et le tournoi automatique restent en attente. Rien n’est simulé à la place.',
    'poll-chat': 'Le chat fonctionne par sondage toutes les 4 secondes. Le WebSocket n’est pas déployé : transport en attente.',
    'nft-manual': 'Les NFT V2 sont une éligibilité manuelle. Aucun envoi et aucune transaction (réclamations réelles désactivées).',
    'v1-ghost-distinct': 'Le tournoi de l’arène est le mode V1 (fantômes et bots). Ici, le tournoi V2 inscrit des joueurs ; un BOT est étiqueté BOT.',
    'free-tier': 'Offre gratuite Workers + D1, prévue pour un faible trafic. La forte concurrence n’est pas garantie.',
    'chain-roster': 'Le roster de jeu n’est pas une preuve de propriété. Seul ownerOf confirme un NFT. L’import d’une image perso reste dans le navigateur : la mise en ligne est en attente, et aucun bouton de paiement n’est proposé.'
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function session() { return W.apiEnabled() && W.getSession(); }

  function panel() {
    root = $('#v2-root');
    if (!root) return;
    root.innerHTML = '<div class="v2-notes" id="v2-notes"></div><div class="chips" id="v2-tabs" role="tablist"></div><div id="v2-panel"></div>';
    var tabs = [['apercu', 'Aperçu'], ['guilde', 'Guilde'], ['chat', 'Chat'], ['amis', 'Amis'], ['raids', 'Raids'], ['quetes', 'Quêtes'], ['tournoi', 'Tournoi live'], ['rangs', 'Classements'], ['boutique', 'Boutique']];
    $('#v2-tabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" class="chip' + (t[0] === tab ? ' active' : '') + '" data-v2tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
  }

  function notes(codes, extra) {
    var el = $('#v2-notes');
    if (!el) return;
    var html = (codes || []).map(function (c) { return '<p class="small">' + esc(NOTICE[c] || c) + '</p>'; }).join('');
    if (extra) html += '<p class="small warn-txt">' + esc(extra) + '</p>';
    el.innerHTML = html;
  }

  function box(html) { var p = $('#v2-panel'); if (p) p.innerHTML = html; }

  async function show() {
    panel();
    if (!W.apiEnabled()) {
      notes([], 'Serveur hors ligne : la communauté V2 n’est pas simulée dans ce navigateur.');
      box('<p class="muted">Connecte plus tard, quand le serveur répond. Les combats V1 restent dans l’arène.</p>');
      return;
    }
    if (!session()) {
      notes(['poll-chat', 'nft-manual', 'v1-ghost-distinct', 'chain-roster']);
      box('<p>Connecte ton wallet et signe le message (aucune transaction) pour ouvrir la communauté.</p>');
      return;
    }
    try {
      var home = await W.api('/api/v2/home');
      notes(home.pendingCodes || []);
      await renderTab();
      arm();
    } catch (e) {
      notes([], e.status === 404 ? 'Cette fonction n’est pas encore disponible sur le serveur publié. Elle n’est pas simulée ici.' : (e.message || 'Erreur'));
      box('');
    }
  }

  function hide() { if (timer) { clearInterval(timer); timer = null; } }
  function arm() {
    hide();
    if (tab !== 'chat' && tab !== 'tournoi' && tab !== 'raids') return;
    timer = setInterval(function () {
      if (location.hash !== '#communaute' || !session()) return hide();
      W.api('/api/v2/presence', { method: 'POST', body: { away: false } }).catch(function () {});
      renderTab().catch(function () {});
    }, 4000);
  }

  async function renderTab() {
    if (tab === 'apercu') return renderOverview();
    if (tab === 'guilde') return renderGuild();
    if (tab === 'chat') return renderChat();
    if (tab === 'amis') return renderFriends();
    if (tab === 'raids') return renderRaids();
    if (tab === 'quetes') return renderQuests();
    if (tab === 'tournoi') return renderTournament();
    if (tab === 'rangs') return renderRanks();
    if (tab === 'boutique') return renderShop();
  }

  async function renderOverview() {
    var me = W.getSession();
    box('<div class="profile-grid"><div class="panel"><h3>Mon espace</h3><p class="addr" translate="no">' + esc(me.address) + '</p>' +
      '<form id="v2-name" class="add-form"><label class="field">Pseudo<input class="input" id="v2-nick" maxlength="20" placeholder="Pseudo public"></label>' +
      '<label class="field">Avatar (n° 1 à 100)<input class="input" id="v2-avatar" type="number" min="1" max="100" placeholder="Numéro"></label>' +
      '<label class="toggle"><input type="checkbox" id="v2-verify"> <span>Vérifier ownerOf (lecture seule)</span></label>' +
      '<button class="btn btn-small" type="submit">Enregistrer le profil</button></form><p id="v2-name-msg" class="small"></p></div>' +
      '<div class="panel"><h3>Profil public</h3><form id="v2-lookup" class="btn-row"><input class="input" id="v2-lookup-addr" placeholder="Adresse 0x…"><button class="btn btn-small" type="submit">Voir</button></form><div id="v2-public"></div></div></div>');
  }

  function renderPublic(p) {
    var el = $('#v2-public');
    if (!el || !p) return;
    var chain = (p.chain || []).map(function (c) {
      return '<li translate="no">#' + c.tokenId + ' ' + (c.ownerKnown ? (c.owned ? 'on-chain' : 'pas propriétaire') : 'lecture impossible') + '</li>';
    }).join('');
    el.innerHTML = '<p><b translate="no">' + esc(p.name || '—') + '</b> · ' + esc(p.presence) + '</p>' +
      '<p class="small">Victoires ' + (p.wins || 0) + ' / défaites ' + (p.losses || 0) + ' · niveau ' + p.level + '</p>' +
      '<p class="small">Points arène V1 : ' + (p.arenaPoints || 0) + ' · points communauté : ' + (p.communityPoints || 0) + '</p>' +
      '<p class="small">Guilde : ' + (p.guild ? esc(p.guild.name) + ' (' + esc(p.guild.role) + ')' : 'aucune') + '</p>' +
      '<p class="small">Avatar : ' + (p.avatar ? esc(p.avatar.id) + ' · ' + (p.avatar.chainVerified ? 'confirmé on-chain' : 'cosmétique, non confirmé') : 'aucun') + '</p>' +
      '<p class="small">Roster de jeu (pas une preuve de propriété) : ' + (p.roster || []).map(function (r) { return esc(r.id); }).join(', ') + '</p>' +
      '<p class="small">Images importées : locales au navigateur, absentes de ce profil.</p>' +
      (chain ? '<ul>' + chain + '</ul>' : '') +
      '<p class="small">Bonus fondateur : non</p>';
  }

  async function renderGuild() {
    var list = await W.api('/api/v2/guilds');
    var mine = await W.api('/api/v2/home');
    var html = '<div class="profile-grid"><div class="panel"><h3>Créer</h3><form id="v2-gcreate" class="add-form">' +
      '<input class="input" id="v2-gname" maxlength="24" placeholder="Nom de la guilde">' +
      '<select class="input" id="v2-glogo"><option value="crown">crown</option><option value="fox">fox</option><option value="panda">panda</option><option value="demon">demon</option><option value="angel">angel</option><option value="bolt">bolt</option><option value="star">star</option><option value="mask">mask</option></select>' +
      '<button class="btn btn-small" type="submit">Créer la guilde</button></form>' +
      '<form id="v2-gjoin" class="btn-row"><input class="input" id="v2-gid" placeholder="Id de guilde"><button class="btn btn-small" type="submit">Rejoindre</button></form>' +
      '<button class="btn btn-small btn-ghost" type="button" id="v2-gleave">Quitter</button></div>' +
      '<div class="panel"><h3>Ma guilde</h3><div id="v2-gmine"></div></div></div>' +
      '<div class="panel"><h3>Classement des guildes</h3><ol class="players" id="v2-glist"></ol></div>';
    box(html);
    $('#v2-glist').innerHTML = (list.guilds || []).map(function (g) {
      return '<li><span translate="no">' + esc(g.name) + '</span><span class="pa">' + esc(g.logo) + '</span><b>' + g.points + '</b></li>';
    }).join('') || '<li class="muted">Aucune guilde.</li>';
    if (mine.me && mine.me.guildId) {
      var g = await W.api('/api/v2/guilds/' + mine.me.guildId);
      $('#v2-gmine').innerHTML = '<p translate="no"><b>' + esc(g.name) + '</b> · ' + esc(mine.me.role) + '</p><ul>' +
        g.members.map(function (m) { return '<li translate="no">' + esc(m.role) + ' ' + esc(m.address) + '</li>'; }).join('') + '</ul>' +
        '<form id="v2-gbattle" class="add-form"><input class="input" id="v2-opp" placeholder="Id guilde adverse"><input class="input" id="v2-gf" placeholder="Ton n° 0001" value="0001"><button class="btn btn-small" type="submit">Combat de guilde</button></form>' +
        '<form id="v2-grole" class="add-form"><input class="input" id="v2-raddr" placeholder="Adresse"><select id="v2-rrole" class="input"><option value="officer">officer</option><option value="member">member</option><option value="owner">owner</option></select><button class="btn btn-small" type="submit">Changer le rôle</button></form>' +
        '<form id="v2-gkick" class="btn-row"><input class="input" id="v2-kaddr" placeholder="Exclure"><button class="btn btn-small" type="submit">Exclure</button></form>';
    } else $('#v2-gmine').textContent = 'Tu n’es dans aucune guilde.';
  }

  async function renderChat() {
    var html = '<div class="panel"><div class="btn-row"><button type="button" class="btn btn-small" data-v2chan="global">Salon</button>' +
      '<form id="v2-dm" class="btn-row"><input class="input" id="v2-dm-addr" placeholder="Message privé (ami)"><button class="btn btn-small" type="submit">Ouvrir</button></form></div>' +
      '<ol class="history" id="v2-log"></ol><form id="v2-send" class="btn-row"><input class="input" id="v2-text" maxlength="280" placeholder="Message"><button class="btn btn-small" type="submit">Envoyer</button></form>' +
      '<p class="small muted">Salon public, guilde (membres) ou message privé (amis seulement). Signaler et bloquer sont juste sous chaque message.</p></div>';
    box(html);
    await pullChat(false);
  }

  async function pullChat(keep) {
    var log = $('#v2-log');
    if (!log) return;
    var data = await W.api('/api/v2/chat/' + channel + (after ? '?after=' + after : ''));
    (data.messages || []).forEach(function (m) {
      after = Math.max(after, m.id);
      var li = document.createElement('li');
      li.innerHTML = '<span class="pa" translate="no">' + esc(m.address.slice(0, 6)) + '</span> ' +
        '<span translate="no">' + esc(m.deleted ? '' : m.body) + '</span>' +
        (m.deleted ? '<span>Message retiré par la modération</span>' : '') +
        '<button type="button" class="btn btn-small btn-ghost" data-v2report="' + m.id + '">Signaler</button>' +
        '<button type="button" class="btn btn-small btn-ghost" data-v2block="' + esc(m.address) + '">Bloquer</button>';
      log.appendChild(li);
    });
    if (!keep && !(data.messages || []).length && !log.children.length) {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'Aucun message pour l’instant.';
      log.appendChild(empty);
    }
  }

  async function renderFriends() {
    var data = await W.api('/api/v2/friends');
    box('<div class="panel"><form id="v2-freq" class="btn-row"><input class="input" id="v2-faddr" placeholder="Adresse à inviter"><button class="btn btn-small" type="submit">Demander en ami</button></form>' +
      '<ul id="v2-flist" class="missions"></ul></div>');
    $('#v2-flist').innerHTML = (data.friends || []).map(function (f) {
      return '<li><span translate="no">' + esc(f.address) + '</span> <span>' + esc(f.presence) + '</span> <span>' + esc(f.status) + '</span>' +
        (f.incoming ? '<button type="button" class="btn btn-small" data-v2acc="' + esc(f.address) + '">Accepter</button>' : '') +
        (f.status === 'accepted' ? '<button type="button" class="btn btn-small" data-v2chal="' + esc(f.address) + '">Défier</button>' : '') +
        '</li>';
    }).join('') || '<li>Aucun ami.</li>';
  }

  async function renderRaids() {
    var data = await W.api('/api/v2/raids');
    if (data.pendingCodes && data.pendingCodes.length && !data.raids.length) {
      box('<p class="warn-txt">Raids en attente : le planificateur n’est pas actif.</p>');
      return;
    }
    box('<div class="profile-grid">' + (data.raids || []).map(function (r) {
      return '<div class="panel"><h3 translate="no">' + esc(r.name) + '</h3><p class="small">' + esc(r.difficulty) + ' · PV ' + r.hpLeft + ' / ' + r.hpMax + ' · plafond ' + r.cap + '</p>' +
        '<p class="small">' + (r.oneHitClears ? 'Un coup peut vider ce raid (réglage admin).' : 'Un seul participant ne peut pas vider ce raid.') + '</p>' +
        '<p class="small">Source : ' + esc(r.source) + ' · ' + esc(r.status) + '</p>' +
        '<form class="btn-row v2-hit"><input type="hidden" value="' + esc(r.id) + '"><input class="input" value="0001" maxlength="4"><button class="btn btn-small" type="submit">Frapper</button></form></div>';
    }).join('') + '</div>');
  }

  async function renderQuests() {
    var q = await W.api('/api/v2/quests');
    var ev = await W.api('/api/v2/events');
    function list(items, kind) {
      return (items || []).map(function (m) {
        return '<li class="' + (m.claimed ? 'done' : '') + '"><div class="m-top"><span>' + esc(m.title) + '</span><b>+' + m.points + '</b></div>' +
          '<button type="button" class="btn btn-small" data-v2claim="' + esc(m.id) + '" data-v2kind="' + kind + '"' + (m.claimed || !m.done ? ' disabled' : '') + '>' +
          (m.claimed ? 'Déjà attribué' : 'Réclamer les points') + '</button></li>';
      }).join('');
    }
    var evHtml = ev.pendingCodes && ev.pendingCodes.length && !(ev.events || []).length
      ? '<p class="warn-txt">Événements hebdomadaires en attente : planificateur inactif.</p>'
      : '<ul class="missions">' + list(ev.events, 'event') + '</ul>';
    box('<div class="profile-grid"><div class="panel"><h3>Quêtes du jour</h3><ul class="missions">' + list(q.daily, 'quest') + '</ul></div>' +
      '<div class="panel"><h3>Quêtes de la semaine</h3><ul class="missions">' + list(q.weekly, 'quest') + '</ul></div>' +
      '<div class="panel"><h3>Événements</h3>' + evHtml + '<p class="small">L’éligibilité NFT ne déclenche pas d’envoi.</p></div></div>');
  }

  async function renderTournament() {
    var data = await W.api('/api/v2/tournament');
    if (!data.scheduler) {
      box('<p class="warn-txt">Tournoi live en attente : le planificateur n’est pas actif. Le tournoi fantôme reste dans l’arène.</p>');
      return;
    }
    var t = data.tournament;
    if (!t) { box('<p>Aucun tournoi cette semaine.</p>'); return; }
    var entries = (t.entries || []).map(function (e) {
      return '<li><span translate="no">' + esc(e.bot ? 'BOT' : (e.label || e.address)) + '</span>' + (e.bot ? ' <b>BOT</b>' : '') + '</li>';
    }).join('');
    var matches = (t.matches || []).map(function (m) {
      return '<li>R' + m.round + ' ' + esc(m.status) + ' ' + esc(m.reason || '') + (m.bot ? ' BOT' : '') + '</li>';
    }).join('');
    box('<div class="panel"><p>Statut : ' + esc(t.status) + (t.reason ? ' · ' + esc(t.reason) : '') + '</p>' +
      '<p class="small">Mode live, distinct des fantômes V1. Inscription puis départ à l’heure du serveur.</p>' +
      '<form id="v2-tjoin" class="btn-row"><input class="input" id="v2-tf" value="0001"><button class="btn btn-small" type="submit">S’inscrire</button></form>' +
      '<h3>Inscrits</h3><ul>' + (entries || '<li>File vide.</li>') + '</ul><h3>Matchs</h3><ul>' + matches + '</ul></div>');
  }

  async function renderShop() {
    var data;
    try { data = await W.api('/api/v2/shop'); }
    catch (e) {
      box('<p class="warn-txt">Boutique indisponible sur ce serveur. Aucun paiement n’est simulé ici.</p>');
      return;
    }
    var note = data.paymentsEnabled ? '' : '<p class="warn-txt">Cosmétiques seulement. Aucun bonus de puissance et aucune meilleure chance de récompense. Le paiement PayPal sandbox n’est pas connecté : aucun achat n’est lancé.</p>';
    var challenge = data.challenge || {};
    var rows = (data.catalog || []).map(function (item) {
      var price = item.eur ? (item.eur + ' EUR') : (item.points + ' pts cosmétiques');
      return '<li class="cosmetic-row"><span class="swatch ' + esc(item.css) + '" aria-hidden="true"></span><span><b>' + esc(item.name) + '</b><br><span class="small">' + esc(price) + (item.owned ? ' · possédé' : '') + '</span></span>' +
        '<button type="button" class="btn btn-small" disabled>Indisponible</button></li>';
    }).join('');
    var hist = (data.orders || []).map(function (o) {
      return '<li translate="no">' + esc(o.sku) + ' · ' + esc(o.amount) + ' ' + esc(o.currency) + ' · ' + esc(o.status) + '</li>';
    }).join('') || '<li>Aucun achat enregistré.</li>';
    box(note + '<p class="small">Défi du jour en attente : il comptera un combat manuel validé par le serveur, pas un combat automatique.</p>' +
      '<p class="small">Limite d’achats par jour : ' + (data.purchaseLimitConfirmed ? esc(String(data.purchaseLimit)) : 'non confirmée') + '.</p>' +
      '<p class="small">Aperçu du style, pas un objet possédé.</p>' +
      '<ul class="missions">' + rows + '</ul><h3>Historique</h3><ul>' + hist + '</ul>' +
      '<p class="small">Défi : ' + esc(challenge.status || 'pending') + '.</p>');
  }

  async function renderRanks() {
    var kind = 'player', span = 'all';
    box('<div class="chips"><button type="button" class="chip active" data-v2rank="player">Joueurs</button><button type="button" class="chip" data-v2rank="guild">Guildes</button><button type="button" class="chip" data-v2rank="fighter">Combattants</button>' +
      '<button type="button" class="chip" data-v2span="week">Semaine</button><button type="button" class="chip active" data-v2span="all">Tout</button></div><ol class="players" id="v2-ranks"></ol>');
    async function load() {
      var data = await W.api('/api/v2/ranks?kind=' + kind + '&span=' + span);
      $('#v2-ranks').innerHTML = (data.rows || []).map(function (r) {
        var label = r.name || r.address || r.id;
        return '<li><span>' + r.rank + '</span><span class="pa" translate="no">' + esc(label) + '</span><b>' + (r.points != null ? r.points : r.xp) + '</b></li>';
      }).join('') || '<li>Aucun rang pour l’instant.</li>';
    }
    root._v2rank = function (k, s) { if (k) kind = k; if (s) span = s; load(); };
    await load();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-v2tab]');
    if (t) { tab = t.getAttribute('data-v2tab'); show(); return; }
    var rep = e.target.closest && e.target.closest('[data-v2report]');
    if (rep) { W.api('/api/v2/report', { method: 'POST', body: { messageId: Number(rep.getAttribute('data-v2report')), reason: 'signalement' } }).catch(function (err) { alert(err.message); }); return; }
    var blk = e.target.closest && e.target.closest('[data-v2block]');
    if (blk) { W.api('/api/v2/block', { method: 'POST', body: { address: blk.getAttribute('data-v2block') } }).catch(function (err) { alert(err.message); }); return; }
    var acc = e.target.closest && e.target.closest('[data-v2acc]');
    if (acc) { W.api('/api/v2/friends/respond', { method: 'POST', body: { address: acc.getAttribute('data-v2acc'), accept: true } }).then(renderFriends).catch(function (err) { alert(err.message); }); return; }
    var ch = e.target.closest && e.target.closest('[data-v2chal]');
    if (ch) { W.api('/api/v2/friends/challenge', { method: 'POST', body: { address: ch.getAttribute('data-v2chal'), fighterId: '0001' } }).catch(function (err) { alert(err.message); }); return; }
    var claim = e.target.closest && e.target.closest('[data-v2claim]');
    if (claim) {
      var path = claim.getAttribute('data-v2kind') === 'event' ? '/api/v2/events/claim' : '/api/v2/quests/claim';
      W.api(path, { method: 'POST', body: { id: claim.getAttribute('data-v2claim') } }).then(renderQuests).catch(function (err) { alert(err.message); });
      return;
    }
    var rk = e.target.closest && e.target.closest('[data-v2rank]');
    if (rk && root && root._v2rank) { root._v2rank(rk.getAttribute('data-v2rank'), null); return; }
    var sp = e.target.closest && e.target.closest('[data-v2span]');
    if (sp && root && root._v2rank) { root._v2rank(null, sp.getAttribute('data-v2span')); return; }
    var chan = e.target.closest && e.target.closest('[data-v2chan]');
    if (chan) { channel = chan.getAttribute('data-v2chan'); after = 0; var log = $('#v2-log'); if (log) log.innerHTML = ''; pullChat(false); }
  });

  document.addEventListener('submit', function (e) {
    var id = e.target.id;
    if (!id || id.indexOf('v2-') !== 0) return;
    e.preventDefault();
    var run = null;
    if (id === 'v2-name') run = W.api('/api/v2/profile', { method: 'POST', body: { name: $('#v2-nick').value, avatarId: $('#v2-avatar').value, verify: $('#v2-verify').checked } }).then(function (r) {
      $('#v2-name-msg').textContent = r.chainVerified ? 'Avatar confirmé on-chain.' : 'Profil enregistré. Avatar cosmétique si la chaîne ne confirme pas.';
    });
    if (id === 'v2-lookup') run = W.api('/api/v2/profile/' + encodeURIComponent($('#v2-lookup-addr').value.trim()) + '?tokens=' + ($('#v2-avatar') && $('#v2-avatar').value ? $('#v2-avatar').value : '1')).then(renderPublic);
    if (id === 'v2-gcreate') run = W.api('/api/v2/guilds', { method: 'POST', body: { name: $('#v2-gname').value, logo: $('#v2-glogo').value } }).then(renderGuild);
    if (id === 'v2-gjoin') run = W.api('/api/v2/guilds/join', { method: 'POST', body: { id: $('#v2-gid').value.trim() } }).then(renderGuild);
    if (id === 'v2-gbattle') run = W.api('/api/v2/guilds/battle', { method: 'POST', body: { guildId: $('#v2-opp').value.trim(), fighterId: $('#v2-gf').value.trim() } });
    if (id === 'v2-grole') run = W.api('/api/v2/guilds/role', { method: 'POST', body: { address: $('#v2-raddr').value.trim(), role: $('#v2-rrole').value } }).then(renderGuild);
    if (id === 'v2-gkick') run = W.api('/api/v2/guilds/kick', { method: 'POST', body: { address: $('#v2-kaddr').value.trim() } }).then(renderGuild);
    if (id === 'v2-send') run = W.api('/api/v2/chat/' + channel, { method: 'POST', body: { text: $('#v2-text').value } }).then(function () { $('#v2-text').value = ''; return pullChat(true); });
    if (id === 'v2-dm') run = W.api('/api/v2/dm', { method: 'POST', body: { address: $('#v2-dm-addr').value.trim() } }).then(function (r) { channel = r.channel; after = 0; var log = $('#v2-log'); if (log) log.innerHTML = ''; return pullChat(false); });
    if (id === 'v2-freq') run = W.api('/api/v2/friends/request', { method: 'POST', body: { address: $('#v2-faddr').value.trim() } }).then(renderFriends);
    if (id === 'v2-tjoin') run = W.api('/api/v2/tournament/join', { method: 'POST', body: { fighterId: $('#v2-tf').value.trim() } }).then(renderTournament);
    if (e.target.classList.contains('v2-hit')) {
      var hid = e.target.querySelector('input[type="hidden"]').value;
      var fid = e.target.querySelector('input:not([type="hidden"])').value;
      run = W.api('/api/v2/raids/' + encodeURIComponent(hid) + '/hit', { method: 'POST', body: { fighterId: fid } }).then(renderRaids);
    }
    if (run) run.catch(function (err) { alert(err.message || 'Erreur'); });
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'v2-gleave') W.api('/api/v2/guilds/leave', { method: 'POST', body: {} }).then(renderGuild).catch(function (err) { alert(err.message); });
  });

  if (I && I.onChange) I.onChange(function () { if (location.hash === '#communaute') show(); });
  window.NBCommunity = { show: show, hide: hide };
})();
