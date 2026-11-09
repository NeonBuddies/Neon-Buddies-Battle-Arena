# Tests — NEON BUDDIES — NFT BATTLE ARENA

Revue du 9 novembre 2026, deuxième passage sur le même code. Seuls les contrôles **relancés** ci-dessous sont des résultats. Rien ici n’est un audit.

Un ancien rapport contenait une ligne parasite « failing tests ». Le fichier `tests/e2e-web3-resultats.txt` a été retiré : il présentait une émulation Chromium comme un téléphone Android.

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

### Bench signature — machine locale, pas le compteur CPU Cloudflare

30 récupérations ECDSA après échauffement : médiane 1,43 ms, p95 2,36 ms, max 2,95 ms.  
`crypto.subtle` ECDSA : P-256 oui, **secp256k1 non**. La limite gratuite de 10 ms de CPU n’a pas été mesurée dans un isolate de production.

## Non fait — ne pas le compter comme un succès

- Auth smoke vers `https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev` : HTTP **404** lors du passage précédent. Pas relancé comme succès. Aucune transaction.
- Worker distant, D1 distant, webhook Telegram réel : non déployés ici.
- Application MetaMask sur un **vrai** Android : non testée.
- `safeTransferFrom` réel : non envoyé.
- Pages : la configuration GitHub est lue, le site de production n’est pas publié tant que `main` n’a pas ce workflow.
