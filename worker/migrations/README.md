# Migrations D1

La base `neon-buddies-arena` a déjà le schéma initial. Ne pas rejouer de `DROP`.

1. `0001_no_change.sql` — déjà appliqué, aucune instruction.
2. `0002_v1_gameplay.sql` — tables additives `pending_fights`, `challenge_runs`, `starter_offers`. À appliquer avant un worker qui les utilise.

Les tests locaux rejouent `schema.sql` (`CREATE TABLE IF NOT EXISTS`), qui contient les mêmes tables.
