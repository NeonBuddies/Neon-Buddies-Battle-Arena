-- Ajouts v1. Aucun DROP. À appliquer sur la base déjà créée après 0001.
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
