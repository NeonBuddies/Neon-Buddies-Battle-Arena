# Boutique crypto — préparation sans activation

La boutique est préparée pour des paiements en ETH natif sur Robinhood Chain (chain ID 4663), mais elle reste désactivée par défaut.

## État actuel

- `PAYMENTS_ENABLED` reste désactivé.
- Le checkout ne demande aucune transaction MetaMask.
- Aucun ETH n’est reçu.
- Aucune livraison payante n’est effectuée.
- `SHOP_TEST_MODE` reste désactivé.
- Le wallet administrateur configuré est celui de `ADMIN_ADDRESS`.

## Activation future contrôlée

Avant toute activation, renseigner côté Worker uniquement :

- `PAYMENTS_ENABLED=1` après approbation explicite ;
- une adresse de trésorerie vérifiée, égale au wallet administrateur approuvé ;
- les prix fixes en ETH pour chaque `product_id` ;
- les règles de livraison de chaque produit ;
- la confirmation que les produits sont des objets in-game et non des transferts NFT automatiques.

Le serveur devra alors vérifier avant livraison :

1. chain ID 4663 ;
2. hash de transaction unique ;
3. expéditeur égal au wallet connecté ;
4. destinataire égal à la trésorerie configurée ;
5. montant exact du produit ;
6. transaction minée et reçue ;
7. absence de commande déjà créditée ;
8. attribution atomique de l’objet dans D1.

Aucune clé privée n’est stockée dans le Worker ou le frontend. L’acheteur signe sa propre transaction dans MetaMask. L’activation réelle nécessite une approbation distincte après configuration des prix.
