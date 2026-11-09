/* Configuration des récompenses NFT (v1 manuelle). Modifiable sans toucher au code du serveur. */
import COLLECTION from '../../js/collection.js';

export const CHAIN_ID = 4663; // Robinhood Chain mainnet
export const NFT_CONTRACT = '0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc';
export const TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Special'];
export const TIER_FR = { Common: 'Commun', Rare: 'Rare', Epic: 'Épique', Legendary: 'Légendaire', Special: 'Spécial' };
export const TIER_FROM_RARITY = { 'Commun': 'Common', 'Rare': 'Rare', 'Épique': 'Epic', 'Légendaire': 'Legendary' };

/* Règles d'obtention (basées uniquement sur l'habileté en jeu, aucun achat). Une récompense par règle et par joueur.
   Le niveau « Special » est attribué manuellement par l'administrateur (ex. 1er du classement de la saison). */
export const REWARD_RULES = [
  { id: 'points-3000', tier: 'Common', label: 'Atteindre 3 000 points classés', stat: 'points', value: 3000 },
  { id: 'streak-10', tier: 'Rare', label: '10 victoires classées d\u2019affilée', stat: 'best_streak', value: 10 },
  { id: 'wins-150', tier: 'Epic', label: '150 victoires classées', stat: 'wins', value: 150 },
  { id: 'legend-40', tier: 'Legendary', label: '40 victoires contre des adversaires Légendaires', stat: 'legend_wins', value: 40 }
];

/** Stock de token ids par niveau : par défaut, la rareté de chaque NFT dans la collection.
    Peut être remplacé par la variable REWARD_STOCK (JSON, ex. {"Common":[1,5,9],"Special":[2]}). */
export function rewardStock(env) {
  const stock = { Common: [], Rare: [], Epic: [], Legendary: [], Special: [] };
  for (const c of COLLECTION) {
    const t = TIER_FROM_RARITY[c.rarity];
    if (t) stock[t].push(Number(c.id));
  }
  stock.Special = stock.Legendary.slice();
  if (env && env.REWARD_STOCK) {
    try {
      const o = JSON.parse(env.REWARD_STOCK);
      for (const t of TIERS) if (Array.isArray(o[t])) stock[t] = o[t].map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 100);
    } catch (e) { /* configuration invalide : stock par défaut */ }
  }
  return stock;
}

export { COLLECTION };
