-- Schema PostgreSQL pentru platforma Paint-by-Numbers
-- Aplicare: psql "$DATABASE_URL" -f pbn/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Catalogul de modele gata făcute (Modul 1)
CREATE TABLE IF NOT EXISTS catalog_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             text UNIQUE NOT NULL,
  category        text NOT NULL,
  title           text NOT NULL,
  source_provider text NOT NULL,              -- pexels / ai / own
  source_ref      jsonb NOT NULL,             -- id, url, fotograf, licență (dovada drepturilor!)
  variants        jsonb NOT NULL,             -- { "24": {files, regions, paint_ml}, "36": {...} }
  engine_version  text NOT NULL,
  published       boolean NOT NULL DEFAULT false,  -- QA uman înainte de publicare
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_items_cat ON catalog_items (category) WHERE published;

-- Comenzi (catalog sau foto proprie)
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email   text NOT NULL,
  tier             text NOT NULL CHECK (tier IN ('standard','premium')),
  catalog_item_id  uuid REFERENCES catalog_items(id),
  source           text NOT NULL CHECK (source IN ('catalog','upload','device','google_photos')),
  n_colors         int  NOT NULL CHECK (n_colors IN (12,24,36,48)),
  width_cm         numeric(5,1) NOT NULL,
  height_cm        numeric(5,1) NOT NULL,
  status           text NOT NULL DEFAULT 'awaiting_photo'
                   CHECK (status IN ('awaiting_payment','awaiting_photo','processing','proof_sent',
                                     'approved','in_production','shipped','delivered','cancelled')),
  payment_ref      text,                      -- Stripe PaymentIntent / Netopia
  shipping         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);

-- Coada de procesare (starea autoritară; Redis e doar transportul)
CREATE TABLE IF NOT EXISTS processing_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid REFERENCES orders(id) ON DELETE CASCADE,
  source_key     text NOT NULL,
  n_colors       int NOT NULL,
  width_cm       numeric(5,1) NOT NULL,
  height_cm      numeric(5,1) NOT NULL,
  priority       int NOT NULL DEFAULT 0,      -- premium > standard
  status         text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  attempts       int NOT NULL DEFAULT 0,
  output_prefix  text,                        -- orders/2026/11/{order}/job-{id}/
  result         jsonb,                       -- rețeta + fișiere
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_status ON processing_jobs (status, priority DESC, created_at);

-- Joburi blocate (worker mort): reluate de monitorul din ops/ — vezi ops/healthcheck.py
CREATE OR REPLACE VIEW stuck_jobs AS
  SELECT * FROM processing_jobs WHERE status = 'processing' AND started_at < now() - interval '15 minutes';

-- Audit pentru GDPR: când a fost ștearsă poza originală a clientului
CREATE TABLE IF NOT EXISTS data_retention_log (
  order_id    uuid NOT NULL,
  object_key  text NOT NULL,
  deleted_at  timestamptz NOT NULL DEFAULT now()
);
