-- Migration 0003 — boutique cosmétique (grand livre séparé des points de classement).
-- UPGRADE : jouer après 0002. CREATE TABLE IF NOT EXISTS seulement.
-- Ne modifie aucune table V1. Ne pas l'appliquer à la base de production tant que
-- le paiement n'est pas approuvé à part. PAYMENTS_ENABLED reste "0".
--
-- ROLLBACK (manuel, commenté) : uniquement ces tables.
-- DROP TABLE IF EXISTS shop_events;
-- DROP TABLE IF EXISTS shop_orders;
-- DROP TABLE IF EXISTS cosmetic_ledger;
-- DROP TABLE IF EXISTS cosmetic_grants;

CREATE TABLE IF NOT EXISTS cosmetic_grants (
  address TEXT NOT NULL,
  sku TEXT NOT NULL,
  source TEXT NOT NULL,
  order_id TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (address, sku)
);

CREATE TABLE IF NOT EXISTS cosmetic_ledger (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cosmetic_ledger_addr ON cosmetic_ledger(address);

CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  sku TEXT NOT NULL,
  cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  paypal_order_id TEXT UNIQUE,
  capture_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_orders_addr ON shop_orders(address, created_at);

CREATE TABLE IF NOT EXISTS shop_events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
