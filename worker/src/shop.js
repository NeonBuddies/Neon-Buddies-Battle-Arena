/** Catalogue boutique configurable. Prix affichés en ETH, checkout réel désactivé par défaut. */
export const SHOP = {
  version: 4,
  payments: 'off',
  provider: 'crypto-prepared',
  testOnly: false,
  treasury: '0xCABB7fe1C84AaC98E8905aB0809129e4f5031635',
  chainId: 4663,
  products: [
    { id: 'character-pack-basic', category: 'characters', name: 'Character Pack Basic', priceEth: '0.0005', purchasable: false },
    { id: 'character-pack-plus', category: 'characters', name: 'Character Pack Plus', priceEth: '0.001', purchasable: false },
    { id: 'character-pack-elite', category: 'characters', name: 'Character Pack Elite', priceEth: '0.002', purchasable: false },
    { id: 'skin-neon-basic', category: 'skins', name: 'Skin Neon Basic', priceEth: '0.0003', purchasable: false },
    { id: 'skin-neon-plus', category: 'skins', name: 'Skin Neon Plus', priceEth: '0.0006', purchasable: false },
    { id: 'skin-neon-elite', category: 'skins', name: 'Skin Neon Elite', priceEth: '0.001', purchasable: false },
    { id: 'gems-100', category: 'gems', name: '100 gems', quantity: 100, priceEth: '0.0002', purchasable: false, testOnly: true },
    { id: 'gems-500', category: 'gems', name: '500 gems', quantity: 500, priceEth: '0.0007', purchasable: false },
    { id: 'gems-1200', category: 'gems', name: '1 200 gems', quantity: 1200, priceEth: '0.0015', purchasable: false },
    { id: 'gems-3000', category: 'gems', name: '3 000 gems', quantity: 3000, priceEth: '0.003', purchasable: false },
    { id: 'nft-common', category: 'nfts', name: 'NFT Common', rarity: 'Common', priceEth: '0.0005', purchasable: false },
    { id: 'nft-uncommon', category: 'nfts', name: 'NFT Uncommon', rarity: 'Uncommon', priceEth: '0.0008', purchasable: false },
    { id: 'nft-rare', category: 'nfts', name: 'NFT Rare', rarity: 'Rare', priceEth: '0.0015', purchasable: false },
    { id: 'nft-epic', category: 'nfts', name: 'NFT Epic', rarity: 'Epic', priceEth: '0.0025', purchasable: false },
    { id: 'nft-legendary', category: 'nfts', name: 'NFT Legendary', rarity: 'Legendary', priceEth: '0.004', purchasable: false },
    { id: 'nft-special-edition', category: 'nfts', name: 'NFT Special Edition', rarity: 'Special Edition', priceEth: '0.006', purchasable: false },
    { id: 'personal-import', category: 'premium', name: 'Import d’un personnage personnel', priceEur: 4.99, priceEth: null, purchasable: false }
  ]
};

export function productById(id) {
  return SHOP.products.find(p => p.id === id) || null;
}
