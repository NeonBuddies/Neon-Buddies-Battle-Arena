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
