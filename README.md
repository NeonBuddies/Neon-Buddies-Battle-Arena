# Neon-Buddies-Battle-Arena

NEON BUDDIES — NFT BATTLE ARENA. Jeu de combat HTML5 / CSS / JavaScript avec les **100 personnages Neon Buddies 2** (Robinhood Chain, images d’origine).

Bilingue **FR / EN**. Thème noir / violet. Ordinateur et téléphones. Les fonctions communautaires v2 (guildes, chat, amis) ne sont pas dans cette version.

## État au 9 novembre 2026 — pas un lancement durci

Ce dépôt **n’est pas audité** et **n’est pas déclaré prêt pour la production**.

- Le Worker prévu n’est **pas déployé** depuis cette revue. L’URL visée est `https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev`. Un appel réel a répondu **HTTP 404**. Tant que `/api/health` ne renvoie pas `ok: true`, le jeu reste **explicitement hors ligne** : points dans le navigateur, **aucune réclamation NFT**, aucun combat classé envoyé.
- `REAL_CLAIMS` vaut `"0"` dans `worker/wrangler.toml`. Même une fois le serveur joignable, **aucune réclamation réelle n’est préparée** tant que cette variable n’est pas passée à `"1"` hors de ce dépôt. Le mode test ne déplace aucun NFT. Le fondateur n’a aucun bonus de jeu ; ses réclamations réelles restent refusées parce qu’il détient déjà le stock.
- **Aucune transaction blockchain n’est envoyée par le Worker ni par les scripts de ce dépôt.** Un transfert réel, s’il est un jour réactivé, ne part que si l’administrateur le signe lui-même dans son wallet (`safeTransferFrom`, valeur 0, contrat NB2 uniquement).
- Le contrat NFT `0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc` (chaîne 4663) **n’est pas modifié**. Aucune approbation OpenSea n’est demandée.
- Aucune clé privée, aucun jeton Telegram et aucun fichier `.dev.vars` ne sont dans le dépôt.

## Fonctionnalités v1

- Galerie des 100 NFT, fiche, recherche, filtres, ajout d’images personnelles (hors classement).
- Combat automatique (initiative, esquives, critiques, attaque spéciale, vitesses, passer).
- **Duel** local ou classé.
- **Solo contre des bots** (Facile / Normal / Difficile / Cauchemar).
- **PvP** : file d’attente sur le serveur, le jeu **interroge** le serveur (pas de WebSocket). Classement ELO. Si personne ne répond, un bot est proposé.
- **Tournoi** : tableau de 8, une fois par jour. Les autres places sont des **fantômes** (dernier combattant d’autres joueurs) et des **bots**, pas des adversaires en direct.
- **Boss du jour** à phases, tentatives limitées.
- XP, points, missions, classements. Hors ligne, solo / boss / tournoi local restent possibles.
- Récompenses NFT **manuelles** (désactivées par défaut, voir plus haut), espace admin, notifications Telegram, profil fondateur, mode test par `eth_call` (lecture / estimation, pas d’envoi).

## Android et MetaMask (non vérifié sur un vrai téléphone)

Ces étapes décrivent l’usage prévu. **Aucun test sur un appareil Android réel ni dans l’application MetaMask réelle n’a été fait** (seulement l’émulation d’un viewport Chromium).

1. Ouvre le jeu en **HTTPS public** : `https://neonbuddies.github.io/Neon-Buddies-Battle-Arena/`  
   N’utilise pas `localhost` ni `127.0.0.1` : le navigateur intégré de MetaMask ne joint pas ton ordinateur.
2. Si le site s’ouvre dans Chrome, utilise le bouton « Ouvrir dans MetaMask », ou colle l’adresse HTTPS dans le navigateur de l’application MetaMask.
3. Connecte le wallet, puis **signe le message** de connexion. Cette signature **n’est pas une transaction**, ne coûte pas de frais et n’autorise pas tes NFT.
4. Si le réseau n’est pas **Robinhood Chain (identifiant 4663)**, accepte l’ajout du réseau proposé par le jeu (RPC public en lecture).
5. Le compte fondateur `0xCABB7fe1C84AaC98E8905aB0809129e4f5031635` est un **compte EIP-7702** délégué à SemiModularAccount7702 (`0x77021100bd87b7008e5e1989d0eb38555d0d0000`, vérifié en lecture seule). MetaMask signe avec la clé du compte : le serveur accepte cette signature ECDSA **ou** une signature que le compte valide en ERC-1271. **L’adresse seule ne donne aucun droit.** Si la signature n’est pas reconnue, la connexion est refusée.

Le bandeau du jeu indique si le serveur est hors ligne. Dans ce cas, tu peux jouer en local ; **aucun NFT n’est réclamé**.

## Structure

```
index.html, regles.html     pages
css/style.css               thème
js/                         jeu, i18n, wallet, client API
assets/nft/                 100 images
worker/                     Cloudflare Worker + D1 (non déployé ici)
scripts/                    i18n, collection, captures
tests/                      moteur
.github/workflows/pages.yml site statique uniquement
```

## Site (GitHub Pages)

Le workflow `.github/workflows/pages.yml` publie **seulement** `index.html`, `regles.html`, `.nojekyll`, `css/`, `js/` et `assets/`. Il exclut `worker/`, les tests et la configuration. Déclenchement : push sur `main`, ou `workflow_dispatch`. Droits : lecture du dépôt, écriture Pages, jeton OIDC. Aucun plan payant. `.github/workflows/ci.yml` lance `npm test` et les tests Worker sur les pull requests ; il ne publie rien.

Lecture seule de la configuration Pages (aucun nouvel appel de création) : `build_type` = `workflow`, HTTPS imposé, URL prévue `https://neonbuddies.github.io/Neon-Buddies-Battle-Arena/`. Le site n’est pas encore servi depuis `main` tant que cette branche n’est pas fusionnée.

Archive GitHub de `main` **après** la fusion :  
`https://github.com/NeonBuddies/Neon-Buddies-Battle-Arena/archive/refs/heads/main.zip`

## Worker (déploiement séparé, pas fait ici)

Compte Cloudflare `c57c5f5ed45cf8fe3f49145444723951`, base D1 `neon-buddies-arena` `c6957ed9-093a-4f0e-8bcc-abe5f7c3e7c4`. Le schéma de `worker/schema.sql` est déjà appliqué à cette base. `worker/migrations/0001_no_change.sql` ne change rien : la réservation de jeton et l’écriture des combats tiennent dans des requêtes sur les tables existantes.

Secrets à poser **hors git** (`npx wrangler secret put`), sans les écrire dans un fichier suivi :

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`

`ALLOWED_ORIGINS` contient `https://neonbuddies.github.io`. `PUBLIC_SITE_URL` est l’URL Pages ci-dessus. Ne pas activer de plan payant. La vérification de signature secp256k1 reste en JavaScript (`@noble/curves`) : WebCrypto de ce runtime n’a pas secp256k1. Un bench local donne environ 1,4 ms (médiane) et 2,4 ms (p95) après échauffement. La limite CPU gratuite des Workers est 10 ms ; un dépassement **coupe la requête** (connexion refusée), il ne saute pas la vérification. À mesurer avec `worker/scripts/auth-smoke.mjs` une fois le Worker réellement en ligne (EOA jetable, aucune transaction).

## Tester en local

```bash
python3 -m http.server 8765
npm test
cd worker && npm test
CHROME=/usr/bin/google-chrome node scripts/check-i18n.mjs
CHROME=/usr/bin/google-chrome node worker/test/e2e-browser.mjs
```

Le rapport à jour est `TESTS.md`.
