/* Configuration publique du jeu (aucun secret ici).
   API_URL pointe vers le Worker existant. /api/health.manual === true signifie
   que CE build (combat manuel) est en ligne. Sinon le jeu classé reste local. */
window.NB_CONFIG = {
  API_URL: 'https://neon-buddies-arena-api.neon-buddies-crypto-factory.workers.dev',
  CHAIN_ID: 4663,
  CHAIN_NAME: 'Robinhood Chain',
  RPC_URL: 'https://rpc.mainnet.chain.robinhood.com',
  EXPLORER: 'https://robinhoodchain.blockscout.com',
  NFT_CONTRACT: '0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc',
  ADMIN_ADDRESS: '0xCABB7fe1C84AaC98E8905aB0809129e4f5031635',
  TREASURY: '0xCABB7fe1C84AaC98E8905aB0809129e4f5031635',
  SITE_URL: 'https://neonbuddies.github.io/Neon-Buddies-Battle-Arena/'
};
