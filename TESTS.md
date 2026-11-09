# Tests — NEON BUDDIES — NFT BATTLE ARENA

Revue du 9 novembre 2026. Seuls les contrôles **relancés pendant cette revue** sont marqués réussis. Rien ici n’est un audit.

Un ancien rapport contenait une ligne parasite « failing tests » et répétait le test des notifications de victoire. Le fichier `tests/e2e-web3-resultats.txt` a été retiré : il présentait une émulation Chromium comme si c’était un téléphone Android. Ces textes ne sont plus une preuve.

Le scénario navigateur complet (anciennement 39 assertions, wallets et RPC d’admin simulés) **n’a pas été rejoué** ici.

## Réussis ici

### Moteur — `npm test` — 20/20

Collection, stats, XP, combat déterministe, équilibrage, sauvegarde, missions, solo, boss, tournoi, ELO. Aucun réseau.

### Worker + D1 local — `cd worker && npm test` — 18/18

`wrangler dev --local`. RPC et Telegram **simulés**. `REAL_CLAIMS=1` seulement dans ce harness, pour exercer le parcours manuel. Le fichier `wrangler.toml` du dépôt reste à `"0"` (assertion du test de santé).

Inclus : CORS, nonce (rejeu, expiration, mauvais signataire), admin par signature, combat calculé par le serveur, anti-triche, missions, classement, réclamation et double réclamation, stock, plafond de points, vérification de reçu **simulée**, webhook Telegram (secret, commandes, bouton d’un autre utilisateur dans le chat admin refusé), fondateur, mode test sans transaction, solo / boss / tournoi / PvP par sondage.

Nouveau : ERC-1271. La valeur magique `0x1626ba7e` n’est acceptée que si le mot ABI est propre. Un compte avec le préfixe EIP-7702 `0xef0100` n’est accepté que si l’appel simulé renvoie cette magie. Une signature d’un autre wallet pour l’adresse admin est refusée. Aucun `eth_sendTransaction` dans le mock RPC.

### i18n — `node scripts/check-i18n.mjs` — réussi

Contrôle statique de `index.html` et `regles.html`, puis parcours **Chromium** bureau et mobile en anglais. Ce n’est pas un appareil Android.

### Navigateur local, jeu hors ligne — réussi

Chrome réel sur `http://127.0.0.1:8765`, configuration du dépôt (URL de Worker visée, non déployée).

- Bandeau : « Serveur de récompenses hors ligne : jeu en mode local uniquement. Aucune réclamation NFT réelle, aucun combat classé envoyé. »
- Onglet récompenses : serveur injoignable, aucune réclamation NFT.
- Combat rapide local : victoire en duel, points passés à 194, mission du jour. Aucune requête `eth_sendTransaction` / `eth_sendRawTransaction`.

### Lecture seule Robinhood Chain — réussie (pas une transaction)

`eth_chainId` = 4663.  
`eth_getCode(0xCABB…1635)` = `0xef0100` + `77021100bd87b7008e5e1989d0eb38555d0d0000` (délégation EIP-7702 vers SemiModularAccount7702 v1.1.0).  
`ownerOf` des jetons 1, 7, 50 et 100 = `0xcabb7fe1c84aac98e8905ab0809129e4f5031635`.

### Bench signature — machine locale, pas le compteur CPU Cloudflare

30 récupérations ECDSA après échauffement, même bibliothèque que le Worker : médiane 1,43 ms, p95 2,36 ms, max 2,95 ms.  
`crypto.subtle` ECDSA : P-256 oui, **secp256k1 non**, K-256 non. La vérification Ethereum reste en JavaScript. La limite gratuite de 10 ms de CPU n’a pas été mesurée dans un isolate Workers de production.

## Échecs ou non faits — ne pas les compter comme des succès

- **Auth smoke** vers `https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev` : HTTP **404**, corps non JSON, code de sortie 2. Le backend n’est pas en ligne. EOA temporaire, **aucune transaction**.
- Worker, D1 distant, webhook Telegram réel : non déployés, non vérifiés.
- Application MetaMask sur un **vrai** Android : non testée.
- `safeTransferFrom` réel : non envoyé. Le bouton d’envoi admin n’a pas été actionné.
- Scénario e2e 39 assertions (wallets injectés) : non rejoué dans cette revue.
- GitHub Pages : le workflow est dans le dépôt ; le site public n’est pas encore servi par cette revue.
