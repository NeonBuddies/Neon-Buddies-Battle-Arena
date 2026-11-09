# Tests — NEON BUDDIES — NFT BATTLE ARENA

Revue du 9 novembre 2026. Dernier passage : réduction du CPU (moins d’allers-retours D1, secp256k1 chargé seulement à la connexion), puis relance des tests. Rien ici n’est un audit, et un chrono Node n’est pas le CPU Cloudflare.

Un ancien rapport contenait une ligne parasite « failing tests ». Le journal `tests/e2e-web3-resultats.txt` n’est plus écrit : il présentait une émulation Chromium comme un téléphone Android. Le résultat du navigateur est dans cette page.

## Commandes et résultats

### Moteur — `npm test` — 20/20

Collection, stats, XP, combat déterministe, équilibrage, sauvegarde, missions, solo, boss, tournoi, ELO. Aucun réseau.

### Worker + D1 local — `cd worker && npm test` — 20/20

`wrangler dev --local`. RPC et Telegram **simulés**. `REAL_CLAIMS=1` seulement dans ce harness. `worker/wrangler.toml` reste à `"0"`.

Inclus : CORS, nonce (rejeu, expiration, mauvais signataire), admin par signature, combat serveur, anti-triche, missions, classement, réclamation, double réclamation, plafond de points, reçu **simulé**, webhook Telegram (secret, commandes, bouton d’un autre utilisateur **dans le chat admin** refusé), fondateur sans bonus, mode test sans transaction, solo / boss / tournoi / PvP par sondage.

ERC-1271 : seule la magie ABI `0x1626ba7e` propre est acceptée. Un préfixe EIP-7702 `0xef0100` ne connecte que si l’appel simulé renvoie cette magie. Aucun `eth_sendTransaction` dans le mock RPC.

Atomicité, ajoutée et rejouée :

- Deux réclamations simultanées du dernier jeton Commun : une seule réservation, l’autre reste `earned`, aucun `token_id` en double.
- Combats concurrents : `battles` égale le nombre de lignes `fights`, et la somme des points du journal égale les points du joueur. Le PvP écrit les deux joueurs, l’ELO et la ligne de match dans la même transaction.

### Navigateur — `CHROME=/usr/local/bin/google-chrome node worker/test/e2e-browser.mjs` — 40/40

Site déjà servi sur `http://127.0.0.1:8765`. Worker local. Wallets EIP-1193 **injectés**. L’envoi admin est intercepté et **n’est pas diffusé**. Lecture RPC Robinhood réelle uniquement pour le panneau on-chain (chaîne 4663, nom du contrat, `ownerOf` 1 / 7 / 50 / 100, `tokenURI`).

Les libellés « Android » de l’ancien rapport sont renommés : c’est une **émulation de viewport Chromium**, pas un téléphone et pas l’application MetaMask.

Les 40 assertions couvrent le lien MetaMask, le RPC réel, le débordement du viewport, la signature, le combat classé, la réclamation, le refus de double réclamation, le classement, les missions, le 403 admin, la transaction `safeTransferFrom` non diffusée, l’absence de `setApprovalForAll`, solo / boss / tournoi / PvP (appariement, ELO, repli bot), le FR/EN, et la simulation de test sans transaction.

### i18n — `CHROME=/usr/local/bin/google-chrome node scripts/check-i18n.mjs` — réussi

Statique (`index.html`, `regles.html`) puis parcours Chromium bureau et mobile en anglais. Pas un appareil Android.

### Bench local — pas le CPU Cloudflare

Node, `performance.now`, après les changements de ce passage :

- import moteur + collection : 1,5 ms
- premier import secp256k1 : 16,5 ms
- récupération ECDSA chaude : médiane 1,6 ms (p95 d’un petit échantillon jusqu’à ~23 ms)
- un combat : médiane 0,02 ms (21 événements, JSON ~4 Ko)
- tournoi 7 matchs : médiane 0,09 ms
- boss : médiane 0,03 ms
- inversion PvP : médiane 0,01 ms

`crypto.subtle` ECDSA : P-256 oui, **secp256k1 non** (bench précédent). Ces chiffres ne sont pas le compteur CPU de Cloudflare. Le passage production cité dans le README (combat 17–18 ms, connexion 16 ms, froid 64–85 ms) reste la référence tant que le parent n’a pas redéployé cette version.

## V2 — passage local du 9 novembre 2026 (branche séparée)

`npm test` à la racine : 20/20 (moteur inchangé sur le combat, les sorts et les tentatives).

`cd worker && npm test` : **26/26** en un seul passage (environ 67 s). Cela couvre les tests V1, 4 contrôles purs V2, la migration 0002 rejouée, et le scénario V2 (deux comptes, un troisième non autorisé, autre personnage, double acceptation, raid plafonné, un seul crédit, fondateur sans éligibilité NFT, tournoi vide, BOT, déconnexion) en 20,7 s de temps mur. Ce temps n’est pas le CPU Cloudflare. La phrase d’attente sur l’import d’image a été ajustée après ce passage ; elle ne change pas le serveur.

La tête V1 intégrée est `eda20250`. Les trois départs, le sort par personnage, les 2 min 30, et les trois tentatives par défi ne sont pas dans ce commit : ils restent sur la PR V1. Pas de cœurs, pas de verrou global, pas de paiement pour l’import d’image.

CPU Cloudflare rapporté pour le déploiement de `eda2025`, 70 requêtes, 0 échec : combats chauds 5–7 ms, auth chaude 5–10 ms, auth froide 35 ms, tournoi 25 ms, PvP 39 ms, 7/70 au-dessus de 10 ms. Offre 10 ms non stabilisée. Plan d’abonnement non revérifié. Aucun redéploiement depuis cette branche.

Non testé : Android réel, MetaMask réelle, transfert on-chain, base D1 de production, cron déployé.

## Non fait — ne pas le compter comme un succès

- Auth smoke vers `https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev` : HTTP **404** lors du passage précédent. Pas relancé comme succès. Aucune transaction.
- Worker distant, D1 distant, webhook Telegram réel : non déployés ici.
- Application MetaMask sur un **vrai** Android : non testée.
- `safeTransferFrom` réel : non envoyé.
- Pages : la configuration GitHub est lue, le site de production n’est pas publié tant que `main` n’a pas ce workflow.
