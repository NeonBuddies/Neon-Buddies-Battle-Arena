-- Schéma D1 — NEON BUDDIES — NFT BATTLE ARENA (serveur de récompenses v1)
CREATE TABLE IF NOT EXISTS players (
  address TEXT PRIMARY KEY,
  name TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  battles INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  legend_wins INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL DEFAULT '',
  day_points INTEGER NOT NULL DEFAULT 0,
  day_fights INTEGER NOT NULL DEFAULT 0,
  last_fight_at INTEGER NOT NULL DEFAULT 0,
  test_mode INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1000, -- classement ELO (PvP)
  pvp_wins INTEGER NOT NULL DEFAULT 0,
  pvp_losses INTEGER NOT NULL DEFAULT 0,
  last_fighter TEXT,
  last_level INTEGER NOT NULL DEFAULT 1, -- mode test des récompenses (activé par l'admin / le fondateur)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_points ON players(points DESC);

CREATE TABLE IF NOT EXISTS char_progress (
  address TEXT NOT NULL, char_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, char_id)
);

CREATE TABLE IF NOT EXISTS missions (
  address TEXT NOT NULL, day TEXT NOT NULL, state TEXT NOT NULL,
  PRIMARY KEY (address, day)
);

CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, address TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fights (
  id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL,
  seed INTEGER NOT NULL, winner TEXT NOT NULL, points INTEGER NOT NULL, created_at INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'duel' -- duel | solo | boss | tournoi | pvp
);
CREATE INDEX IF NOT EXISTS fights_mode ON fights(address, mode, created_at);
CREATE INDEX IF NOT EXISTS fights_addr ON fights(address, created_at);

-- Une ligne par récompense : id = "<règle>:<adresse>" => impossible d'obtenir/réclamer deux fois la même.
-- Statuts : earned → pending (réclamée, token réservé) → approved → sent | rejected
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'earned',
  token_id INTEGER,
  tx_hash TEXT UNIQUE,
  note TEXT,
  earned_at INTEGER NOT NULL,
  claimed_at INTEGER,
  decided_at INTEGER,
  sent_at INTEGER,
  is_test INTEGER NOT NULL DEFAULT 0 -- 1 = récompense de TEST : aucun NFT réel, ne consomme jamais le stock
);
CREATE INDEX IF NOT EXISTS rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS rewards_addr ON rewards(address);
-- Un token ne peut être réservé que pour une seule récompense RÉELLE active (les tests sont exclus).
CREATE UNIQUE INDEX IF NOT EXISTS rewards_token_active ON rewards(token_id) WHERE status IN ('pending', 'approved', 'sent') AND is_test = 0;

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY, win INTEGER NOT NULL, n INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- PvP : file d'attente (matchmaking par sondage, compatible offre gratuite) et matchs joués
CREATE TABLE IF NOT EXISTS pvp_queue (
  address TEXT PRIMARY KEY, fighter_id TEXT NOT NULL, joined_at INTEGER NOT NULL, match_id TEXT
);
CREATE TABLE IF NOT EXISTS pvp_matches (
  id TEXT PRIMARY KEY, p1 TEXT NOT NULL, p2 TEXT NOT NULL, f1 TEXT NOT NULL, f2 TEXT NOT NULL, seed INTEGER NOT NULL,
  winner TEXT NOT NULL, result TEXT NOT NULL, elo_delta INTEGER NOT NULL, created_at INTEGER NOT NULL
);
-- Tournois quotidiens (8 places, joueurs « fantômes » + bots)
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL, day TEXT NOT NULL, placement INTEGER NOT NULL,
  points INTEGER NOT NULL, bracket TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tournaments_day ON tournaments(day, placement);

-- Combat manuel en cours (une session active par compte)
CREATE TABLE IF NOT EXISTS live_battles (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  active_key TEXT UNIQUE,
  status TEXT NOT NULL,
  state TEXT NOT NULL,
  summary TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_runs (
  address TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  eliminated INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS starter_offers (
  address TEXT PRIMARY KEY,
  offer TEXT NOT NULL,
  chosen TEXT,
  created_at INTEGER NOT NULL
);
