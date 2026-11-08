-- =============================================================================
-- Schema PostgreSQL (>= 15, pentru UNIQUE NULLS NOT DISTINCT) pentru platforma POD Paint-by-Numbers
--
-- Principiu: PostgreSQL este SURSA DE ADEVĂR pentru starea job-urilor.
-- Redis/BullMQ (sau SQS) este doar mecanismul de livrare: dacă Redis se pierde,
-- job-urile cu status 'queued'/'running' se re-enqueue-ază din această tabelă
-- (vezi interogarea de recuperare de la final).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Tipuri enumerate
-- ---------------------------------------------------------------------------
CREATE TYPE plan_tier        AS ENUM ('free', 'premium');
CREATE TYPE image_origin     AS ENUM ('unsplash', 'pexels', 'google_photos', 'icloud_upload', 'direct_upload');
CREATE TYPE moderation_state AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE job_kind         AS ENUM ('catalog', 'order', 'preview');
CREATE TYPE job_status       AS ENUM ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled');
CREATE TYPE order_status     AS ENUM ('draft', 'awaiting_processing', 'awaiting_approval',
                                      'paid', 'in_production', 'shipped', 'cancelled');
CREATE TYPE artifact_kind    AS ENUM ('source', 'canvas_svg', 'canvas_pdf', 'solution_svg',
                                      'recipe_json', 'manifest_json', 'painted_png',
                                      'numbered_png', 'palette_png', 'mockup_jpg');

-- ---------------------------------------------------------------------------
-- Utilizatori și conexiuni OAuth (Google Photos)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       citext NOT NULL UNIQUE,
    plan        plan_tier NOT NULL DEFAULT 'free',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Token-urile sunt criptate cu envelope encryption (AWS KMS / GCP KMS):
-- data key criptat (wrapped) + ciphertext AES-256-GCM. Niciodată în clar.
CREATE TABLE oauth_connections (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider              text NOT NULL CHECK (provider IN ('google')),
    provider_account_id   text NOT NULL,
    scopes                text[] NOT NULL,
    refresh_token_enc     bytea NOT NULL,
    access_token_enc      bytea,
    access_expires_at     timestamptz,
    kms_key_id            text NOT NULL,
    revoked_at            timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- Imagini sursă (stoc sau ale clienților) — deduplicate prin sha256
-- ---------------------------------------------------------------------------
CREATE TABLE source_images (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin            image_origin NOT NULL,
    owner_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL pentru stoc
    external_id       text,             -- ID Unsplash/Pexels/Google mediaItem
    author_name       text,
    author_url        text,
    license           text,             -- ex. 'Unsplash License', 'Pexels License'
    attribution_url   text,
    storage_key       text NOT NULL,    -- s3://.../sources/<sha256>.<ext>
    sha256            char(64) NOT NULL,
    width_px          int,              -- completat de worker dacă sursa nu îl declară
    height_px         int,
    has_people        boolean,          -- portrete: necesită verificare drepturi (model release)
    moderation        moderation_state NOT NULL DEFAULT 'pending',
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (origin, external_id),
    -- Dedup per proprietar (stocul are owner NULL => dedup global pe stoc).
    UNIQUE NULLS NOT DISTINCT (owner_user_id, sha256)
);

-- ---------------------------------------------------------------------------
-- Catalog (Modulul 1)
-- ---------------------------------------------------------------------------
CREATE TABLE catalog_designs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_image_id  uuid NOT NULL REFERENCES source_images(id),
    slug             text NOT NULL UNIQUE,
    title            text NOT NULL,
    category         text NOT NULL,     -- 'peisaje', 'animale', 'flori', ...
    tags             text[] NOT NULL DEFAULT '{}',
    num_colors       smallint NOT NULL,
    canvas_w_mm      smallint NOT NULL,
    canvas_h_mm      smallint NOT NULL,
    difficulty       text,
    num_regions      int,
    total_paint_ml   numeric(7,1),
    published_at     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_image_id, num_colors, canvas_w_mm, canvas_h_mm)
);
CREATE INDEX catalog_designs_category_idx ON catalog_designs (category) WHERE published_at IS NOT NULL;
CREATE INDEX catalog_designs_tags_gin     ON catalog_designs USING gin (tags);

-- ---------------------------------------------------------------------------
-- Comenzi (Modulul 2 + vânzări din catalog)
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES users(id),
    status             order_status NOT NULL DEFAULT 'draft',
    catalog_design_id  uuid REFERENCES catalog_designs(id),
    source_image_id    uuid REFERENCES source_images(id),
    num_colors         smallint NOT NULL,
    canvas_w_mm        smallint NOT NULL,
    canvas_h_mm        smallint NOT NULL,
    fit_mode           text NOT NULL DEFAULT 'crop' CHECK (fit_mode IN ('crop', 'pad')),
    approved_job_id    uuid,             -- varianta aprobată de client pentru producție
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CHECK (catalog_design_id IS NOT NULL OR source_image_id IS NOT NULL)
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Job-uri de procesare (coada)
-- ---------------------------------------------------------------------------
CREATE TABLE processing_jobs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind               job_kind NOT NULL,
    status             job_status NOT NULL DEFAULT 'queued',
    priority           smallint NOT NULL DEFAULT 5,   -- 1 = cel mai urgent (premium)
    source_image_id    uuid NOT NULL REFERENCES source_images(id),
    order_id           uuid REFERENCES orders(id) ON DELETE CASCADE,
    catalog_design_id  uuid REFERENCES catalog_designs(id) ON DELETE CASCADE,
    params             jsonb NOT NULL,                -- ProcessingConfig serializat
    output_prefix      text NOT NULL,                 -- prefixul S3 al rezultatelor (decis de API)
    -- Idempotență: același input + aceiași parametri + aceeași versiune de motor
    -- => același rezultat; nu reprocesăm (sha256(source) || sha256(params) || versiune).
    idempotency_key    text NOT NULL UNIQUE,
    engine_version     text,
    queue_job_id       text,                          -- ID-ul din BullMQ / MessageId SQS
    attempts           smallint NOT NULL DEFAULT 0,
    max_attempts       smallint NOT NULL DEFAULT 3,
    worker_id          text,
    heartbeat_at       timestamptz,                   -- detectarea worker-ilor blocați
    error              jsonb,
    stats              jsonb,                         -- num_regions, timings, difficulty
    created_at         timestamptz NOT NULL DEFAULT now(),
    started_at         timestamptz,
    finished_at        timestamptz
);
CREATE INDEX processing_jobs_pending_idx ON processing_jobs (priority, created_at)
    WHERE status IN ('queued', 'running');
CREATE INDEX processing_jobs_order_idx   ON processing_jobs (order_id);

ALTER TABLE orders ADD CONSTRAINT orders_approved_job_fk
    FOREIGN KEY (approved_job_id) REFERENCES processing_jobs(id);

CREATE TABLE job_artifacts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id        uuid NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    kind          artifact_kind NOT NULL,
    storage_key   text NOT NULL,
    content_type  text NOT NULL,
    bytes         bigint NOT NULL,
    sha256        char(64) NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, kind)
);

-- Rețeta, denormalizată pentru interogări (stocuri de vopsea, cost per kit).
CREATE TABLE paint_recipes (
    job_id          uuid PRIMARY KEY REFERENCES processing_jobs(id) ON DELETE CASCADE,
    total_paint_ml  numeric(7,1) NOT NULL,
    colors          jsonb NOT NULL   -- [{number, hex, rgb, cmyk, area_cm2, paint_ml, pot_ml}]
);

-- ---------------------------------------------------------------------------
-- Modulul 2: sesiuni Google Photos Picker și upload-uri criptate (iCloud/web)
-- ---------------------------------------------------------------------------
CREATE TABLE picker_sessions (
    id                text PRIMARY KEY,               -- ID-ul sesiunii Google
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'ingesting', 'ingested', 'expired', 'failed')),
    expire_time       timestamptz,
    source_image_ids  uuid[] NOT NULL DEFAULT '{}',
    error             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pending_uploads (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status            text NOT NULL DEFAULT 'issued'
                      CHECK (status IN ('issued', 'uploaded', 'ingested', 'failed', 'expired')),
    storage_key       text NOT NULL,                  -- incoming/<id>.bin (ciphertext)
    ciphertext_bytes  bigint NOT NULL,
    key_id            text NOT NULL,                  -- cheia RSA folosită la wrap
    wrapped_key       bytea,
    iv                bytea,
    plaintext_sha256  char(64),
    mime_type         text,
    original_filename text,
    source_image_id   uuid REFERENCES source_images(id),
    error             text,
    expires_at        timestamptz NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_uploads_user_idx ON pending_uploads (user_id, created_at DESC);

-- Istoricul tranzițiilor de stare (audit + debugging).
CREATE TABLE job_events (
    id          bigserial PRIMARY KEY,
    job_id      uuid NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    from_status job_status,
    to_status   job_status NOT NULL,
    detail      jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_job_idx ON job_events (job_id, created_at);

-- ---------------------------------------------------------------------------
-- Interogări operaționale de referință
-- ---------------------------------------------------------------------------
-- Preluare atomică de către worker (variantă fără Redis / fallback):
--   UPDATE processing_jobs SET status='running', attempts=attempts+1,
--          worker_id=$1, started_at=now(), heartbeat_at=now()
--   WHERE id = (SELECT id FROM processing_jobs
--               WHERE status='queued' ORDER BY priority, created_at
--               FOR UPDATE SKIP LOCKED LIMIT 1)
--   RETURNING *;
--
-- Recuperare job-uri orfane (worker mort, heartbeat expirat):
--   UPDATE processing_jobs SET status = CASE WHEN attempts >= max_attempts
--                                            THEN 'dead' ELSE 'queued' END
--   WHERE status='running' AND heartbeat_at < now() - interval '5 minutes';
