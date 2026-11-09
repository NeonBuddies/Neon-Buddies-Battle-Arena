-- Prevent one blockchain transaction from crediting multiple shop orders.
CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_tx_unique ON shop_orders(tx_hash) WHERE tx_hash IS NOT NULL;
