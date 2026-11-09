/** Catalogue v2. Aucun encaissement : PayPal n'est pas connecté, rien n'est achetable. */
export const SHOP = {
  version: 2,
  payments: 'off',
  provider: 'paypal',
  paypal: 'sandbox-not-connected',
  cosmeticsOnly: true,
  powerBonus: false,
  dailyChallengeCap: null,
  dailyChallengeCapProposal: 3,
  products: [
    { id: 'frame-title', kind: 'cosmetic', name: 'Cadre ou titre', priceEur: 0.99, purchasable: false },
    { id: 'spell-victory-effect', kind: 'cosmetic', name: 'Effet de sort ou de victoire', priceEur: 1.99, purchasable: false },
    { id: 'arena-theme-guild-banner', kind: 'cosmetic', name: 'Thème d’arène ou bannière de guilde', priceEur: 2.99, purchasable: false },
    { id: 'personal-import', kind: 'cosmetic-import', name: 'Import d’un personnage personnel', priceEur: 4.99, purchasable: false }
  ]
};

export function productById(id) {
  return SHOP.products.find(p => p.id === id) || null;
}
