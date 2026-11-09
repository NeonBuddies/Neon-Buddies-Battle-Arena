# Neon-Buddies-Battle-Arena

NEON BUDDIES — NFT BATTLE ARENA. Jeu de combat HTML5 / CSS / JavaScript avec les **100 personnages Neon Buddies 2** (Robinhood Chain, images d’origine).

Bilingue **FR / EN**. Thème noir / violet / rose. Ordinateur et téléphones. Cette branche ajoute la communauté V2 à côté du jeu V1. Elle n’est pas déployée et ne remplace pas la publication V1.

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

`ALLOWED_ORIGINS` contient `https://neonbuddies.github.io`. `PUBLIC_SITE_URL` est l’URL Pages ci-dessus. `js/config.js` pointe déjà vers `https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev`. Ne pas activer de plan payant.

### CPU (offre gratuite, 10 ms)

Mesure Cloudflare déjà faite sur le Worker déployé (37 requêtes, 0 erreur) : médiane 3,6 ms, p90 16,3 ms, max 85 ms. Connexion ~16 ms (premier appel 64–85), combat 17–18, boss 14, tournoi 16, rejoindre le PvP 25. Les temps mur (lecture 120–550 ms, connexion 0,8 s, combat 1,4 s, PvP 2,6 s) ne sont pas du CPU.

Contrôle local (Node, `performance.now`, **pas** le compteur Cloudflare) : un combat ~0,02 ms, un tournoi de 7 matchs ~0,09 ms, un boss ~0,03 ms, une récupération ECDSA déjà chaude ~1,6 ms, le **premier** chargement de secp256k1 ~17 ms. Le simulateur n’explique donc pas 14–18 ms de CPU en production : ces routes se ressemblent alors qu’elles ne font pas le même nombre de combats. Le coût suit les allers-retours D1 et l’initialisation de la courbe.

Cette version réduit les lectures (un `UPDATE … RETURNING` au lieu de relire le joueur, une requête pour les XP, plus de second chargement, récompenses insérées en lot) et ne charge secp256k1 qu’à la vérification de signature. La vérification elle-même (low-s, EIP-191, ERC-1271 si le compte a du code), le nonce à usage unique, le verrou de combat et la transaction unique stats+journal sont inchangés. WebCrypto n’a pas secp256k1 ; la récupération reste en JavaScript.

Relevé Cloudflare rapporté pour le build déployé de `eda20250` (70 requêtes, aucune en échec) : combats déjà chauds 5–7 ms, authentification chaude 5–10 ms, authentification froide 35 ms, tournoi 25 ms, appariement PvP 39 ms. **7 requêtes sur 70 dépassent 10 ms.** La limite gratuite de 10 ms n’est donc pas encore tenue de façon stable. Le plan d’abonnement du compte n’a pas été revérifié ici. Cette branche ne redéploie pas et ne change pas d’offre.

## Communauté V2 (cette branche, non publiée)

Le jeu V1 (galerie des 100 images d’origine, solo, PvP, boss, tournoi fantôme, récompenses manuelles, lecture Web3, fondateur sans bonus de stats, mode test) reste en place. La communauté est un module chargé seulement pour `/api/v2` et `/api/admin/v2` (`import()`), donc un combat V1 ne charge pas ce module ni secp256k1.

Le serveur décide des points communautaires, de l’XP, des combats de guilde, des raids et du tournoi live. Chaque **instance** de récompense est créditée **une fois par compte** (clé `point_grants.id` = règle + adresse). Un autre personnage, un second clic ou deux requêtes en parallèle ne paient pas une deuxième fois. Une quête du jour suivant, ou l’événement de la semaine suivante, est une autre instance et peut revenir. Ce n’est pas une promesse « une personne = un wallet » et il n’y a pas de KYC.

| Fonction | État sur cette branche |
| --- | --- |
| Guilde (créer, rejoindre, rôle, exclusion, combat) | Opérationnel en local, autorité serveur |
| Chat salon / guilde / privé, blocage, signalement, mute admin | Opérationnel par sondage (4 s). WebSocket : **en attente**, non déployé |
| Amis, présence, défi | Opérationnel. La présence vient de l’horloge serveur, pas d’un statut envoyé pour autrui |
| Raids coop (4 difficultés, PV partagés, plafond par coup) | Opérationnel si `V2_SCHEDULER=1`. Un coup planifié ne vide pas le raid |
| Quêtes jour / semaine, badges | Opérationnel. Les instances du jour et de la semaine reviennent |
| Événements et éligibilité NFT | Points automatiques. NFT = éligibilité manuelle. `REAL_CLAIMS` reste `"0"` |
| Profil public | Roster de jeu ≠ propriété. `ownerOf` lit au plus 3 jetons. Images importées : locales, non affichées comme possédées |
| Classements joueur / guilde / combattant, semaine et tout | Opérationnel |
| Tournoi live | Tableau de joueurs inscrits. Un remplissage est étiqueté **BOT**. Ce n’est pas le tournoi V1 (fantômes). File vide : annulé, sans récompense |
| Départ automatique | Code prêt. `V2_SCHEDULER` vaut `"0"` dans `wrangler.toml`. Le cron préparé est `worker/schedule.cron.toml` et **n’est pas** branché. Aucun déploiement ici |

### Dépendance V1 avant toute sortie V2

La PR V1 https://github.com/NeonBuddies/Neon-Buddies-Battle-Arena/pull/1 est ouverte. Au moment de cette branche, sa tête est `eda20250b91c952c8d63900e958ab349f81b8b03` (CPU : secp256k1 paresseux, moins d’allers-retours D1). Ce correctif est fusionné ici par merge ordinaire.

Les exigences de jeu confirmées ensuite ne sont **pas encore** dans cette tête. Un autre agent les écrit sur la PR V1. Cette branche ne les réécrit pas :

- trois personnages de départ distincts, un choix unique par compte, sans nouveau tirage au rechargement ;
- un sort propre par personnage, qui fonctionne ;
- combat d’au moins 2 min 30, temps écoulé autoritaire en ligne, pas de points ni de récompense avant la fin ;
- plusieurs difficultés et **trois tentatives par défi ou par manche**, avec une remise à zéro documentée. Ce n’est pas une barre de 1 à 8 cœurs, ni un verrou global du compte. Le boss du jour reste à 3 tentatives par jour. Le tournoi à élimination directe reste en place.

L’ajout d’une image perso (« Ajouter mon NFT ») est aujourd’hui local au navigateur, ouvert à tout visiteur, et exclu du PvP classé. Il n’est pas réservé au fondateur dans ce code, et il n’y a aucun prix. L’audit de ce périmètre est côté V1. Aucun montant, aucune monnaie et aucun moyen de paiement ne sont fixés : cette branche n’ajoute ni paiement, ni transaction, ni contrat, ni service payant. La mise en ligne d’un import pour un non-fondateur reste **en attente**. L’écran communauté le dit, sans bouton d’achat. Le jeu de base, les trois départs et les 100 images d’origine restent gratuits. Le fondateur n’a pas d’avantage de jeu.

Il faudra reprendre ces changements V1 par merge avant qu’une V2 puisse être publiée. La tête de la PR 1 est toujours `eda20250` : le combat manuel n’y est pas encore. Cette branche ne le code pas.

## Boutique cosmétique (scaffold, pas un encaissement)

Cosmétiques seulement : cadre, titre, effet de victoire, effet de sort, thème d’arène, bannière de guilde, import d’identité visuelle. Prix serveur en EUR : 0,99 / 0,99 / 1,99 / 1,99 / 2,99 / 2,99 / 4,99. Aucun bonus de stats et aucune meilleure chance de récompense. Les 100 images d’origine ne sont pas modifiées. Les styles sont du CSS.

Les points de classement (`players.points`, victoires, ELO) ne sont jamais débités. Un grand livre séparé (`cosmetic_ledger`) sert aux cosmétiques gagnés. Le dépenser ne change pas le classement.

Le défi du jour qui crédite ce grand livre est **en attente** : il comptera un combat manuel terminé et validé par le serveur (au moins 150 secondes, quand la V1 l’aura enregistré). Les combats automatiques ne comptent pas. Personne ne peut le débloquer en payant, ni le farmer sans jouer.

La limite d’achats par compte et par jour est une variable `COSMETIC_DAILY_PURCHASE_LIMIT`. Elle n’est **pas** posée. Le nombre 3 n’est pas une règle acceptée. L’API le dit : `purchaseLimitConfirmed: false`.

`PAYMENTS_ENABLED` vaut `"0"`. Sans `PAYPAL_SANDBOX_ACCESS_TOKEN`, le Worker n’appelle pas PayPal et l’écran n’a qu’un bouton désactivé « Indisponible ». Le harness de test allume le drapeau contre un faux PayPal et le dit. Ce n’est pas un paiement réel.

PayPal, d’après la doc officielle (Orders v2, sandbox `api-m.sandbox.paypal.com`, vérification `POST /v1/notifications/verify-webhook-signature`) :

- créer la commande côté serveur (`intent: CAPTURE`, montant du catalogue) ;
- capturer côté serveur et exiger le même montant EUR, la même commande, le même compte, et le marchand si `PAYPAL_MERCHANT_ID` est posé ;
- webhook vérifié avant de livrer ou de retirer l’objet (remboursement / annulation) ;
- une livraison et un événement ne s’appliquent qu’une fois.

L’hôte live `api-m.paypal.com` est refusé par le code.

### Ce que le parent pose, sans me l’envoyer

Secret (hors git, `npx wrangler secret put`) :

- `PAYPAL_SANDBOX_ACCESS_TOKEN` — jeton OAuth **sandbox**, pas live. Il expire (souvent quelques heures). Le parent le renouvelle.
- `PAYPAL_SANDBOX_WEBHOOK_ID` — identifiant du webhook sandbox, une fois l’URL réellement branchée.

Config non secrète, plus tard, pas maintenant :

- `PAYPAL_MERCHANT_ID` — identifiant du compte marchand **sandbox**.
- `COSMETIC_DAILY_PURCHASE_LIMIT` — seulement quand le nombre est décidé.
- `PAYMENTS_ENABLED` reste `"0"` jusqu’à une approbation séparée.

Compte PayPal à créer côté parent, sandbox seulement : un compte développeur, une application REST **sandbox**, un compte vendeur sandbox, puis un webhook sur `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED` et `PAYMENT.CAPTURE.REVERSED` vers `https://<worker>/api/paypal/webhook` le jour où le lancement sera décidé. Obtenir le jeton : `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` avec les identifiants sandbox du parent (`grant_type=client_credentials`). Ne pas créer d’application live et ne pas coller de secret ici. Aucune carte n’est demandée.

L’import à 4,99 EUR est cosmétique. Le fondateur l’obtient par la signature de wallet déjà exigée pour l’admin, sans paiement et sans stats en plus. Le formulaire local « Ajouter mon NFT » n’est pas refermé par cette branche : l’audit d’accès reste à la V1.

Il faudra reprendre ces changements V1 par merge avant qu’une V2 puisse être publiée. La V1 doit sortir avant la V2. Rien n’est fusionné ni déployé ici, et la base D1 de production n’est pas migrée. La migration `0003_cosmetics.sql` n’est pas appliquée à la base distante.

### Offre gratuite (docs Cloudflare, lues pour cette branche)

Sources : [limites Workers](https://developers.cloudflare.com/workers/platform/limits/), [tarifs D1](https://developers.cloudflare.com/d1/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/).

- Workers Free : 100 000 requêtes / jour, **10 ms de CPU** par requête HTTP et par cron, 50 sous-requêtes externes / invocation, 5 crons par compte.
- D1 Free : 5 millions de lignes lues / jour, 100 000 lignes écrites / jour, 5 Go. Dépassement : les requêtes échouent jusqu’à minuit UTC.
- Le chat ne utilise pas Durable Objects. Sur l’offre gratuite, un WebSocket sans hibernation est facturé en durée (plafond 13 000 Go-s / jour) et un objet éveillé dépasse vite ce plafond. Le sondage reste dans Workers + D1.
- Ce n’est pas un dimensionnement pour une forte concurrence. Le relevé `eda2025` ci-dessus (7/70 au-dessus de 10 ms) reste la référence tant que le parent n’a pas un passage stable. Cette branche ne mesure pas elle-même le CPU Cloudflare.

Migration `worker/migrations/0002_community_v2.sql` : `CREATE TABLE IF NOT EXISTS` seulement, rejouable, aucune table V1 modifiée. Le rollback commenté en tête du fichier ne supprime que les tables V2. `schema.sql` reste le schéma V1. Ne pas appliquer 0002 à la base `c6957ed9-093a-4f0e-8bcc-abe5f7c3e7c4` tant que la publication n’est pas décidée.

## Tester en local

```bash
python3 -m http.server 8765
npm test
cd worker && npm test
CHROME=/usr/bin/google-chrome node scripts/check-i18n.mjs
CHROME=/usr/bin/google-chrome node worker/test/e2e-browser.mjs
```

Le rapport à jour est `TESTS.md`.
