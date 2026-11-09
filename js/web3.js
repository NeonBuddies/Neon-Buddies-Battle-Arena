/* Web3 minimal sans dépendance : wallet EIP-1193 (MetaMask et compatibles), lecture RPC publique Robinhood Chain,
   signature de connexion (personal_sign) et client de l'API du Worker. Aucune clé privée n'est manipulée ici. */
(function (root) {
  'use strict';
  var CFG = root.NB_CONFIG || {};
  var SESSION_KEY = 'neonBuddiesArena.session.v1';
  var listeners = [];
  var state = { address: null, chainId: null, provider: null, providerName: '' };
  var discovered = [];
  var backend = { state: 'offline', realClaims: false, manual: false, probed: false };

  // EIP-6963 : découverte de plusieurs wallets installés
  root.addEventListener && root.addEventListener('eip6963:announceProvider', function (e) {
    if (e.detail && e.detail.provider) discovered.push(e.detail);
  });
  try { root.dispatchEvent(new Event('eip6963:requestProvider')); } catch (e) { /* ancien navigateur */ }

  function hexChain() { return '0x' + Number(CFG.CHAIN_ID).toString(16); }
  function emit() { listeners.forEach(function (f) { try { f(state); } catch (e) { /* ignore */ } }); }
  function pickProvider() {
    var mm = discovered.filter(function (d) { return /metamask/i.test(d.info && (d.info.rdns + d.info.name)); })[0] || discovered[0];
    if (mm) return { p: mm.provider, name: mm.info.name };
    if (root.ethereum) return { p: root.ethereum, name: root.ethereum.isMetaMask ? 'MetaMask' : 'Wallet' };
    return null;
  }
  function isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''); }
  function deepLink() {
    // Ouvre ce site dans le navigateur intégré de l'application MetaMask (Android / iOS)
    return 'https://metamask.app.link/dapp/' + location.host + location.pathname + location.search;
  }
  function utf8Hex(s) {
    var b = new TextEncoder().encode(s), h = '0x';
    for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
    return h;
  }
  function pad32(h) { return String(h).replace(/^0x/, '').toLowerCase().padStart(64, '0'); }
  function short(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

  function bind(p) {
    if (!p || p.__nbBound) return;
    p.__nbBound = true;
    if (p.on) {
      p.on('accountsChanged', function (acc) {
        var next = acc && acc[0] ? acc[0].toLowerCase() : null;
        if (next !== state.address) { state.address = next; var s = getSession(); if (s && s.address !== next) clearSession(); emit(); }
      });
      p.on('chainChanged', function (c) { state.chainId = parseInt(c, 16); emit(); });
    }
  }

  async function connect() {
    var pp = pickProvider();
    if (!pp) {
      var err = new Error(isMobile() ? 'mobile-no-wallet' : 'no-wallet');
      err.deepLink = deepLink();
      throw err;
    }
    state.provider = pp.p; state.providerName = pp.name; bind(pp.p);
    var acc = await pp.p.request({ method: 'eth_requestAccounts' });
    state.address = acc && acc[0] ? acc[0].toLowerCase() : null;
    state.chainId = parseInt(await pp.p.request({ method: 'eth_chainId' }), 16);
    emit();
    return state.address;
  }
  /** Reprend une connexion déjà autorisée sans ouvrir de fenêtre. */
  async function resume() {
    var pp = pickProvider(); if (!pp) return null;
    try {
      state.provider = pp.p; state.providerName = pp.name; bind(pp.p);
      var acc = await pp.p.request({ method: 'eth_accounts' });
      state.address = acc && acc[0] ? acc[0].toLowerCase() : null;
      state.chainId = parseInt(await pp.p.request({ method: 'eth_chainId' }), 16);
      emit();
    } catch (e) { /* ignore */ }
    return state.address;
  }
  function disconnect() {
    clearSession();
    try { state.provider && state.provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(function () {}); } catch (e) { /* ignore */ }
    state.address = null; emit();
  }
  async function switchChain() {
    if (!state.provider) await connect();
    try {
      await state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain() }] });
    } catch (e) {
      if (e && (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902) || /Unrecognized chain/i.test(e.message || ''))) {
        await state.provider.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: hexChain(), chainName: CFG.CHAIN_NAME, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [CFG.RPC_URL], blockExplorerUrls: [CFG.EXPLORER]
        }] });
      } else throw e;
    }
    state.chainId = parseInt(await state.provider.request({ method: 'eth_chainId' }), 16);
    emit();
  }

  /* ---- lecture seule via le RPC public (aucun wallet nécessaire) ---- */
  var rpcId = 0;
  async function rpc(method, params) {
    var r = await fetch(CFG.RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params || [] }) });
    var j = await r.json();
    if (j.error) throw new Error(j.error.message || 'Erreur RPC');
    return j.result;
  }
  async function rpcChainId() { return parseInt(await rpc('eth_chainId'), 16); }
  async function ownerOf(tokenId) {
    var res = await rpc('eth_call', [{ to: CFG.NFT_CONTRACT, data: '0x6352211e' + pad32(Number(tokenId).toString(16)) }, 'latest']);
    return '0x' + String(res).slice(-40).toLowerCase();
  }
  function decodeString(res) {
    var h = String(res).replace(/^0x/, '');
    var len = parseInt(h.slice(64, 128), 16), bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = parseInt(h.substr(128 + i * 2, 2), 16);
    return new TextDecoder().decode(bytes);
  }
  async function contractName() { return decodeString(await rpc('eth_call', [{ to: CFG.NFT_CONTRACT, data: '0x06fdde03' }, 'latest'])); }
  async function tokenURI(id) { return decodeString(await rpc('eth_call', [{ to: CFG.NFT_CONTRACT, data: '0xc87b56dd' + pad32(Number(id).toString(16)) }, 'latest'])); }
  async function waitReceipt(hash, timeoutMs) {
    var end = Date.now() + (timeoutMs || 180000);
    while (Date.now() < end) {
      var rc = await rpc('eth_getTransactionReceipt', [hash]).catch(function () { return null; });
      if (rc) return rc;
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    return null;
  }
  /** Envoie uniquement un safeTransferFrom préparé, valeur nulle, vers le contrat NB2. Jamais d'appel automatique. */
  function assertRewardTx(tx) {
    if (!tx || typeof tx !== 'object') throw new Error('Transaction de récompense invalide.');
    if (String(tx.to || '').toLowerCase() !== String(CFG.NFT_CONTRACT || '').toLowerCase()) throw new Error('Contrat inattendu : envoi bloqué.');
    var value = tx.value == null ? '0x0' : String(tx.value);
    if (value !== '0x0' && value !== '0x' && value !== '0') throw new Error('Valeur non nulle refusée.');
    if (!/^0x42842e0e[0-9a-fA-F]{192}$/.test(String(tx.data || ''))) throw new Error('Seul safeTransferFrom est autorisé.');
  }
  async function sendTx(tx) {
    if (!backend.realClaims) throw new Error('Réclamations réelles désactivées : aucun transfert ne sera envoyé.');
    if (!state.provider || !state.address) throw new Error('Wallet non connecté');
    assertRewardTx(tx);
    if (String(state.address).toLowerCase() !== String(CFG.ADMIN_ADDRESS || '').toLowerCase()) throw new Error('Seul le wallet administrateur peut signer cet envoi.');
    if (state.chainId !== Number(CFG.CHAIN_ID)) await switchChain();
    return state.provider.request({ method: 'eth_sendTransaction', params: [{ from: state.address, to: tx.to, data: tx.data, value: '0x0' }] });
  }

  /* ---- session et API du Worker ---- */
  function getSession() {
    try { var s = JSON.parse(localStorage.getItem(SESSION_KEY)); return s && s.expiresAt > Date.now() ? s : null; } catch (e) { return null; }
  }
  function setSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function clearSession() {
    var s = getSession();
    if (s && CFG.API_URL) fetch(CFG.API_URL + '/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + s.token } }).catch(function () {});
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }
  function apiEnabled() { return !!CFG.API_URL && backend.state === 'online'; }
  function backendStatus() { return { configured: !!CFG.API_URL, state: backend.state, realClaims: !!backend.realClaims, manual: backend.manual === true, probed: !!backend.probed, url: CFG.API_URL || '' }; }
  async function probeBackend() {
    if (!CFG.API_URL) { backend.state = 'offline'; backend.realClaims = false; backend.manual = false; backend.probed = true; emit(); return backend; }
    var ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined;
    try {
      var r = await fetch(CFG.API_URL.replace(/\/+$/, '') + '/api/health', { method: 'GET', cache: 'no-store', signal: ctrl });
      var j = await r.json();
      if (r.ok && j && j.ok === true) { backend.state = 'online'; backend.realClaims = j.realClaims === true; backend.manual = j.manual === true; backend.probed = true; }
      else { backend.state = 'offline'; backend.realClaims = false; backend.manual = false; backend.probed = true; }
    } catch (e) { backend.state = 'offline'; backend.realClaims = false; backend.manual = false; backend.probed = true; }
    emit();
    return backend;
  }
  async function api(path, opts) {
    opts = opts || {};
    if (!CFG.API_URL) throw new Error('Serveur non configuré');
    var h = {};
    if (opts.body !== undefined) h['Content-Type'] = 'application/json';
    var s = getSession();
    if (s && opts.auth !== false) h.Authorization = 'Bearer ' + s.token;
    if (root.__NB_TEST_CLOCK && root.__NB_TEST_CLOCK.now != null) h['x-nb-test-now'] = String(root.__NB_TEST_CLOCK.now);
    var r = await fetch(CFG.API_URL.replace(/\/+$/, '') + path, { method: opts.method || 'GET', headers: h, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401 && s) clearSession();
    if (!r.ok) { var e = new Error(j.error || ('Erreur ' + r.status)); e.status = r.status; throw e; }
    j.__status = r.status;
    return j;
  }
  /** Connexion au serveur : le serveur fournit le message (nonce à usage unique), le wallet le signe. */
  async function signIn() {
    if (!state.address) await connect();
    var n = await api('/api/auth/nonce', { method: 'POST', body: { address: state.address }, auth: false });
    var sig = await state.provider.request({ method: 'personal_sign', params: [utf8Hex(n.message), state.address] });
    var v = await api('/api/auth/verify', { method: 'POST', body: { address: state.address, nonce: n.nonce, signature: sig }, auth: false });
    setSession(v); emit();
    return v;
  }
  async function sendNative(to, valueWei) {
    if (!state.provider || !state.address) throw new Error('Wallet non connecté');
    if (state.chainId !== Number(CFG.CHAIN_ID)) await switchChain();
    if (String(to || '').toLowerCase() !== String(CFG.TREASURY || '').toLowerCase()) throw new Error('Trésorerie inattendue : envoi bloqué.');
    return state.provider.request({ method: 'eth_sendTransaction', params: [{ from: state.address, to: to, value: valueWei }] });
  }

  root.NBWeb3 = {
    config: CFG, state: state, onChange: function (f) { listeners.push(f); },
    hasProvider: function () { return !!pickProvider(); }, isMobile: isMobile, deepLink: deepLink, short: short,
    connect: connect, resume: resume, disconnect: disconnect, switchChain: switchChain,
    rpc: rpc, rpcChainId: rpcChainId, ownerOf: ownerOf, contractName: contractName, tokenURI: tokenURI, waitReceipt: waitReceipt, sendTx: sendTx, sendNative: sendNative,
    apiEnabled: apiEnabled, backendStatus: backendStatus, probeBackend: probeBackend, api: api, signIn: signIn, getSession: getSession, clearSession: clearSession,
    explorerTx: function (h) { return CFG.EXPLORER + '/tx/' + h; },
    explorerToken: function (id) { return CFG.EXPLORER + '/token/' + CFG.NFT_CONTRACT + '/instance/' + id; },
    explorerAddress: function (a) { return CFG.EXPLORER + '/address/' + a; }
  };
  probeBackend();
})(window);
