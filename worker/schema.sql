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
-- NEON BUDDIES platform features: additive migration only.
-- No existing table or row is deleted or overwritten.
CREATE TABLE IF NOT EXISTS player_economy (
  address TEXT PRIMARY KEY,
  gems INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
  materials INTEGER NOT NULL DEFAULT 0 CHECK (materials >= 0),
  avatar TEXT NOT NULL DEFAULT 'neon-default',
  favorite_char TEXT,
  privacy_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  address TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS inventory_addr ON inventory(address, updated_at);

CREATE TABLE IF NOT EXISTS daily_reward_claims (
  address TEXT NOT NULL,
  day TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  reward_json TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (address, day)
);
CREATE INDEX IF NOT EXISTS daily_claims_addr ON daily_reward_claims(address, claimed_at);

CREATE TABLE IF NOT EXISTS battle_pass_progress (
  address TEXT NOT NULL,
  season TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  premium INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, season)
);
CREATE TABLE IF NOT EXISTS battle_pass_claims (
  address TEXT NOT NULL,
  season TEXT NOT NULL,
  track TEXT NOT NULL,
  level INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (address, season, track, level)
);

CREATE TABLE IF NOT EXISTS character_evolution (
  address TEXT NOT NULL,
  char_id TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  attack_bonus INTEGER NOT NULL DEFAULT 0,
  defense_bonus INTEGER NOT NULL DEFAULT 0,
  health_bonus INTEGER NOT NULL DEFAULT 0,
  materials_spent INTEGER NOT NULL DEFAULT 0,
  gems_spent INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, char_id)
);
CREATE TABLE IF NOT EXISTS achievements (
  address TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  claimed_at INTEGER,
  PRIMARY KEY (address, achievement_id)
);
CREATE TABLE IF NOT EXISTS weekly_missions (
  address TEXT NOT NULL,
  week TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (address, week)
);

CREATE TABLE IF NOT EXISTS player_profiles (
  address TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  avatar TEXT NOT NULL DEFAULT 'neon-default',
  favorite_char TEXT,
  privacy_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT 'neon-guild-1',
  leader TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_members (
  guild_id TEXT NOT NULL,
  address TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, address),
  UNIQUE (address)
);
CREATE TABLE IF NOT EXISTS guild_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  address TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS guild_messages_feed ON guild_messages(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_tournaments (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly')),
  period_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  bracket_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (period_type, period_key)
);
CREATE TABLE IF NOT EXISTS platform_tournament_entries (
  tournament_id TEXT NOT NULL,
  address TEXT NOT NULL,
  fighter_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  placement INTEGER,
  result_json TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, address),
  UNIQUE (tournament_id, fighter_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  request_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_recent ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  payment_mode TEXT NOT NULL DEFAULT 'test',
  status TEXT NOT NULL DEFAULT 'fulfilled',
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  fulfilled_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_test_once ON shop_orders(address, product_id, payment_mode) WHERE payment_mode = 'test';

CREATE TABLE IF NOT EXISTS guild_invites (
  guild_id TEXT NOT NULL,
  address TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  PRIMARY KEY (guild_id, address)
);
