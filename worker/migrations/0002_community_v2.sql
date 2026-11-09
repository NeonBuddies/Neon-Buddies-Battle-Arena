-- Migration 0002 — communauté V2 (guildes, chat, amis, raids, tournoi live, quêtes).
-- UPGRADE : jouer ce fichier UNE fois sur une base qui a déjà schema.sql (tables V1).
-- Toutes les instructions sont CREATE TABLE/INDEX IF NOT EXISTS.
-- Aucune table V1 n'est modifiée, vidée ou supprimée. Les lignes V1 restent en place.
-- Rejouer ce fichier ne doit rien casser (idempotent).
-- Ne pas l'appliquer à la base de production tant que la publication V2 n'est pas décidée.
--
-- ROLLBACK (manuel, hors de ce fichier) : supprimer UNIQUEMENT les tables V2 ci-dessous,
-- dans l'ordre inverse, et seulement si l'on abandonne V2. Ne pas toucher à players,
-- char_progress, missions, nonces, sessions, fights, rewards, notifications,
-- rate_limits, settings, pvp_queue, pvp_matches, tournaments.
--
-- DROP TABLE IF EXISTS fighter_week;
-- DROP TABLE IF EXISTS point_grants;
-- DROP TABLE IF EXISTS player_stats;
-- DROP TABLE IF EXISTS live_matches;
-- DROP TABLE IF EXISTS live_entries;
-- DROP TABLE IF EXISTS live_tournaments;
-- DROP TABLE IF EXISTS raid_payouts;
-- DROP TABLE IF EXISTS raid_hits;
-- DROP TABLE IF EXISTS raids;
-- DROP TABLE IF EXISTS friend_challenges;
-- DROP TABLE IF EXISTS friends;
-- DROP TABLE IF EXISTS badges;
-- DROP TABLE IF EXISTS blocks;
-- DROP TABLE IF EXISTS reports;
-- DROP TABLE IF EXISTS mutes;
-- DROP TABLE IF EXISTS messages;
-- DROP TABLE IF EXISTS channel_members;
-- DROP TABLE IF EXISTS guild_battles;
-- DROP TABLE IF EXISTS guild_members;
-- DROP TABLE IF EXISTS guilds;
-- DROP TABLE IF EXISTS profiles;

CREATE TABLE IF NOT EXISTS profiles (
  address TEXT PRIMARY KEY,
  avatar_id TEXT,
  avatar_verified INTEGER NOT NULL DEFAULT 0,
  presence_at INTEGER NOT NULL DEFAULT 0,
  away INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT NOT NULL,
  owner TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  week TEXT NOT NULL DEFAULT '',
  week_points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS guilds_name_nocase ON guilds(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id TEXT NOT NULL,
  address TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, address)
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_one_per_player ON guild_members(address);

CREATE TABLE IF NOT EXISTS guild_battles (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  pair TEXT NOT NULL,
  guild_a TEXT NOT NULL,
  guild_b TEXT NOT NULL,
  fighter_a TEXT NOT NULL,
  fighter_b TEXT NOT NULL,
  seed INTEGER NOT NULL,
  winner TEXT NOT NULL,
  summary TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_battle_once ON guild_battles(day, pair);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  address TEXT NOT NULL,
  PRIMARY KEY (channel_id, address)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  address TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_channel ON messages(channel_id, id);

CREATE TABLE IF NOT EXISTS blocks (
  address TEXT NOT NULL,
  blocked TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (address, blocked)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter TEXT NOT NULL,
  target TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mutes (
  address TEXT PRIMARY KEY,
  until_ts INTEGER NOT NULL,
  reason TEXT,
  by_admin TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
  address TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (address, badge_id)
);

CREATE TABLE IF NOT EXISTS friends (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  status TEXT NOT NULL,
  requester TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);

CREATE TABLE IF NOT EXISTS friend_challenges (
  id TEXT PRIMARY KEY,
  requester TEXT NOT NULL,
  target TEXT NOT NULL,
  fighter_a TEXT NOT NULL,
  fighter_b TEXT,
  status TEXT NOT NULL,
  winner TEXT,
  seed INTEGER,
  summary TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS raids (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  base_id TEXT NOT NULL,
  hp_max INTEGER NOT NULL,
  hp_left INTEGER NOT NULL,
  cap INTEGER NOT NULL,
  points INTEGER NOT NULL,
  nft INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  closes_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS raids_week ON raids(week, difficulty);

CREATE TABLE IF NOT EXISTS raid_hits (
  raid_id TEXT NOT NULL,
  address TEXT NOT NULL,
  damage INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (raid_id, address)
);

CREATE TABLE IF NOT EXISTS live_tournaments (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  opens_at INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  size INTEGER NOT NULL,
  seed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_entries (
  tournament_id TEXT NOT NULL,
  address TEXT NOT NULL,
  fighter_id TEXT NOT NULL,
  bot INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  PRIMARY KEY (tournament_id, address)
);

CREATE TABLE IF NOT EXISTS live_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  p1 TEXT,
  p2 TEXT,
  winner TEXT,
  seed INTEGER,
  summary TEXT,
  status TEXT NOT NULL,
  bot INTEGER NOT NULL DEFAULT 0,
  reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS live_match_slot ON live_matches(tournament_id, round, slot);

CREATE TABLE IF NOT EXISTS player_stats (
  address TEXT PRIMARY KEY,
  community_points INTEGER NOT NULL DEFAULT 0,
  week TEXT NOT NULL DEFAULT '',
  week_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS point_grants (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  nft_eligible INTEGER NOT NULL DEFAULT 0,
  granted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS point_grants_addr ON point_grants(address, granted);

CREATE TABLE IF NOT EXISTS fighter_week (
  week TEXT NOT NULL,
  char_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, char_id)
);
