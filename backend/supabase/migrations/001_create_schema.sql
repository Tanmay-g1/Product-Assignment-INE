-- ====================================================================
-- INE Product Price Tracker - Database Schema (Supabase / PostgreSQL)
-- ====================================================================

-- 1. Create custom enum type for scraper outcomes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scrape_outcome') THEN
        CREATE TYPE scrape_outcome AS ENUM ('success', 'retried', 'failed');
    END IF;
END$$;

-- 2. Table: tracked_products
-- Stores products tracked by users from the mock storefront
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT UNIQUE NOT NULL, -- site's internal id (e.g., 687, 751, 5)
    name TEXT NOT NULL,
    url_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookup and joins
CREATE INDEX IF NOT EXISTS idx_tracked_products_product_id ON tracked_products(product_id);

-- 3. Table: price_history
-- Stores historical prices scraped over time. Only successful scrapes write here.
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES tracked_products(product_id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    stock INT,
    currency VARCHAR(10) DEFAULT 'INR',
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for chronological queries per product
CREATE INDEX IF NOT EXISTS idx_price_history_product_id_scraped_at ON price_history(product_id, scraped_at DESC);

-- 4. Table: scrape_logs
-- Honest audit log for every single scrape attempt, including retries and failures
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT REFERENCES tracked_products(product_id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome scrape_outcome NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    detail TEXT,
    duration_ms INT NOT NULL DEFAULT 0
);

-- Index for log auditing and inspection
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id_attempted_at ON scrape_logs(product_id, attempted_at DESC);
