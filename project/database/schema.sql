-- =============================================================================
--  PYRAMID CONSTRUCTION — Production-Ready PostgreSQL Schema
--  Architecture: Headless CMS + Business Platform
--  Version: 1.0.0
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
--  ENUMS
-- =============================================================================

CREATE TYPE user_role         AS ENUM ('super_admin', 'admin', 'editor', 'viewer');
CREATE TYPE publish_status    AS ENUM ('draft', 'published', 'archived', 'scheduled');
CREATE TYPE media_type        AS ENUM ('image', 'video', 'document', 'audio');
CREATE TYPE project_status    AS ENUM ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled');
CREATE TYPE contact_status    AS ENUM ('new', 'read', 'replied', 'archived');
CREATE TYPE block_type        AS ENUM (
  'hero', 'services_preview', 'projects_preview', 'process',
  'why_us', 'testimonials', 'partners', 'cta', 'team',
  'stats', 'text_image', 'gallery', 'faq', 'custom'
);
CREATE TYPE message_role      AS ENUM ('user', 'assistant', 'system');
CREATE TYPE setting_type      AS ENUM ('text', 'number', 'boolean', 'json', 'media_ref');
CREATE TYPE audience_type     AS ENUM ('individual', 'company', 'government', 'all');

-- =============================================================================
--  1. USERS  (Admin & Editor authentication)
-- =============================================================================
--  Stores admin/editor accounts. Passwords are bcrypt-hashed.
--  Never store plain-text passwords.
-- =============================================================================

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT        NOT NULL,           -- bcrypt hash
  role          user_role   NOT NULL DEFAULT 'editor',
  avatar_url    TEXT,                           -- external avatar or relative path
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_role   ON users (role);

-- =============================================================================
--  2. MEDIA  (Central media library — no BLOBs stored here)
-- =============================================================================
--  Stores file metadata only. Actual files live on disk / S3 / CDN.
--  Every image, video, or document in the system references this table.
-- =============================================================================

CREATE TABLE media (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(255) NOT NULL,          -- original uploaded filename
  file_path    TEXT        NOT NULL,            -- relative or absolute server path / S3 key
  public_url   TEXT,                            -- CDN / public URL if applicable
  mime_type    VARCHAR(120) NOT NULL,           -- e.g. image/jpeg, video/mp4
  media_type   media_type  NOT NULL,
  size_bytes   BIGINT      NOT NULL DEFAULT 0,
  width        INTEGER,                         -- pixels (images/video)
  height       INTEGER,
  duration_sec NUMERIC(10,2),                   -- seconds (video/audio)
  alt_text     TEXT,                            -- accessibility
  caption      TEXT,
  uploaded_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata     JSONB       DEFAULT '{}',        -- EXIF, codec info, etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_type       ON media (media_type);
CREATE INDEX idx_media_uploaded   ON media (uploaded_by);
CREATE INDEX idx_media_mime       ON media (mime_type);
CREATE INDEX idx_media_active     ON media (is_active);

-- Optional: resized/transcoded variants (thumbnail, webp, 720p, etc.)
CREATE TABLE media_variants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id     UUID        NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  variant_key  VARCHAR(60) NOT NULL,            -- 'thumbnail', 'webp', '720p', 'blur'
  file_path    TEXT        NOT NULL,
  public_url   TEXT,
  mime_type    VARCHAR(120) NOT NULL,
  size_bytes   BIGINT      NOT NULL DEFAULT 0,
  width        INTEGER,
  height       INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_media_variant UNIQUE (media_id, variant_key)
);

CREATE INDEX idx_media_variants_media ON media_variants (media_id);

-- =============================================================================
--  3. PAGES  (Dynamic page registry)
-- =============================================================================
--  Registers every page of the website with its slug and metadata.
--  Pages do NOT hardcode their content — they use content_blocks.
-- =============================================================================

CREATE TABLE pages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) NOT NULL,          -- /home, /about, /contact
  description   TEXT,                           -- meta description for SEO
  og_image_id   UUID        REFERENCES media (id) ON DELETE SET NULL,
  status        publish_status NOT NULL DEFAULT 'published',
  is_system     BOOLEAN     NOT NULL DEFAULT FALSE, -- system pages can't be deleted
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_pages_slug UNIQUE (slug)
);

CREATE INDEX idx_pages_slug    ON pages (slug);
CREATE INDEX idx_pages_status  ON pages (status);

-- =============================================================================
--  4. CONTENT BLOCKS  (Sections within each page)
-- =============================================================================
--  A page is composed of multiple ordered blocks (hero, services, CTA, etc.).
--  Each block has a type, position, and optional audience targeting.
-- =============================================================================

CREATE TABLE content_blocks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       UUID        NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
  block_type    block_type  NOT NULL,
  label         VARCHAR(120),                   -- internal editor label
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_visible    BOOLEAN     NOT NULL DEFAULT TRUE,
  audience      audience_type NOT NULL DEFAULT 'all',
  css_class     VARCHAR(120),                   -- optional custom class for FE
  created_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blocks_page      ON content_blocks (page_id);
CREATE INDEX idx_blocks_type      ON content_blocks (block_type);
CREATE INDEX idx_blocks_sort      ON content_blocks (page_id, sort_order);
CREATE INDEX idx_blocks_visible   ON content_blocks (is_visible);

-- =============================================================================
--  5. BLOCK CONTENTS  (Key-value content inside each block)
-- =============================================================================
--  Stores every field inside a block as a key-value pair.
--  Examples: { key: 'title', value: 'Building the Future' }
--            { key: 'subtitle', value: 'Trusted & Reliable' }
--  Supports multi-language via locale column.
-- =============================================================================

CREATE TABLE block_contents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    UUID        NOT NULL REFERENCES content_blocks (id) ON DELETE CASCADE,
  key         VARCHAR(100) NOT NULL,            -- 'title', 'description', 'cta_label'
  value       TEXT,
  value_json  JSONB,                            -- for structured values (arrays, objects)
  locale      VARCHAR(10) NOT NULL DEFAULT 'en', -- 'en', 'sw', 'fr'
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_block_content_key UNIQUE (block_id, key, locale)
);

CREATE INDEX idx_block_contents_block  ON block_contents (block_id);
CREATE INDEX idx_block_contents_key    ON block_contents (key);
CREATE INDEX idx_block_contents_locale ON block_contents (locale);

-- =============================================================================
--  6. BLOCK MEDIA  (Media attachments linked to content blocks)
-- =============================================================================
--  Links any number of media files to a content block.
--  role describes the usage: 'background', 'thumbnail', 'gallery_item', etc.
-- =============================================================================

CREATE TABLE block_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    UUID        NOT NULL REFERENCES content_blocks (id) ON DELETE CASCADE,
  media_id    UUID        NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  role        VARCHAR(60) NOT NULL DEFAULT 'image', -- 'background', 'thumbnail', 'video', 'gallery'
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_block_media UNIQUE (block_id, media_id, role)
);

CREATE INDEX idx_block_media_block  ON block_media (block_id);
CREATE INDEX idx_block_media_media  ON block_media (media_id);

-- =============================================================================
--  7. SERVICES  (Construction service offerings)
-- =============================================================================
--  Each service has a slug, audience target, and optional icon/cover media.
-- =============================================================================

CREATE TABLE services (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) NOT NULL,
  short_desc    TEXT,
  full_desc     TEXT,                           -- rich text / markdown
  audience      audience_type NOT NULL DEFAULT 'all',
  icon_media_id UUID        REFERENCES media (id) ON DELETE SET NULL,
  cover_media_id UUID       REFERENCES media (id) ON DELETE SET NULL,
  status        publish_status NOT NULL DEFAULT 'published',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  features      JSONB       DEFAULT '[]',       -- ["Licensed Engineers", "On-Time Delivery"]
  created_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_by    UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_services_slug UNIQUE (slug)
);

CREATE INDEX idx_services_slug     ON services (slug);
CREATE INDEX idx_services_status   ON services (status);
CREATE INDEX idx_services_audience ON services (audience);

-- =============================================================================
--  8. PROJECTS  (Construction project portfolio)
-- =============================================================================
--  Each project tracks location, status, budget range, timeline.
--  Featured projects appear on the homepage.
-- =============================================================================

CREATE TABLE projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  short_desc      TEXT,
  full_desc       TEXT,                         -- rich text
  category        VARCHAR(100),                 -- 'residential', 'commercial', 'government'
  audience        audience_type NOT NULL DEFAULT 'all',
  location        VARCHAR(255),
  client_name     VARCHAR(255),
  client_type     audience_type,
  status          project_status NOT NULL DEFAULT 'completed',
  publish_status  publish_status NOT NULL DEFAULT 'published',
  is_featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  started_at      DATE,
  completed_at    DATE,
  duration_months INTEGER,
  budget_low      NUMERIC(15,2),               -- TZS
  budget_high     NUMERIC(15,2),
  area_sqm        NUMERIC(10,2),
  floors          SMALLINT,
  cover_media_id  UUID        REFERENCES media (id) ON DELETE SET NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  meta_description TEXT,
  tags            TEXT[],                       -- ['luxury', 'dar-es-salaam', '8-floors']
  created_by      UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_by      UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_projects_slug UNIQUE (slug)
);

CREATE INDEX idx_projects_slug      ON projects (slug);
CREATE INDEX idx_projects_category  ON projects (category);
CREATE INDEX idx_projects_status    ON projects (status);
CREATE INDEX idx_projects_featured  ON projects (is_featured);
CREATE INDEX idx_projects_publish   ON projects (publish_status);
CREATE INDEX idx_projects_tags      ON projects USING GIN (tags);

-- Media gallery for each project (before/after, gallery images, videos)
CREATE TABLE project_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  media_id    UUID        NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  role        VARCHAR(60) NOT NULL DEFAULT 'gallery', -- 'cover', 'gallery', 'before', 'after', 'video'
  caption     TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_project_media UNIQUE (project_id, media_id, role)
);

CREATE INDEX idx_project_media_project ON project_media (project_id);
CREATE INDEX idx_project_media_media   ON project_media (media_id);
CREATE INDEX idx_project_media_role    ON project_media (role);

-- =============================================================================
--  9. BLOGS  (CMS-level blog / articles)
-- =============================================================================
--  Full blogging system with rich text, slug routing, author, and SEO.
-- =============================================================================

CREATE TABLE blog_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(120) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_blog_cat_slug UNIQUE (slug)
);

CREATE TABLE blogs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(500) NOT NULL,
  slug             VARCHAR(500) NOT NULL,
  excerpt          TEXT,
  body             TEXT        NOT NULL,         -- rich text / markdown / HTML
  category_id      UUID        REFERENCES blog_categories (id) ON DELETE SET NULL,
  cover_media_id   UUID        REFERENCES media (id) ON DELETE SET NULL,
  author_id        UUID        REFERENCES users (id) ON DELETE SET NULL,
  status           publish_status NOT NULL DEFAULT 'draft',
  is_featured      BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at     TIMESTAMPTZ,
  read_time_min    SMALLINT,
  view_count       INTEGER     NOT NULL DEFAULT 0,
  tags             TEXT[],
  meta_description TEXT,
  og_image_id      UUID        REFERENCES media (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_blogs_slug UNIQUE (slug)
);

CREATE INDEX idx_blogs_slug        ON blogs (slug);
CREATE INDEX idx_blogs_status      ON blogs (status);
CREATE INDEX idx_blogs_featured    ON blogs (is_featured);
CREATE INDEX idx_blogs_author      ON blogs (author_id);
CREATE INDEX idx_blogs_category    ON blogs (category_id);
CREATE INDEX idx_blogs_published   ON blogs (published_at);
CREATE INDEX idx_blogs_tags        ON blogs USING GIN (tags);

-- Media attachments inside blog content
CREATE TABLE blog_media (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id    UUID        NOT NULL REFERENCES blogs (id) ON DELETE CASCADE,
  media_id   UUID        NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  role       VARCHAR(60) NOT NULL DEFAULT 'inline', -- 'cover', 'inline', 'gallery'
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_blog_media UNIQUE (blog_id, media_id, role)
);

CREATE INDEX idx_blog_media_blog  ON blog_media (blog_id);
CREATE INDEX idx_blog_media_media ON blog_media (media_id);

-- =============================================================================
--  10. TESTIMONIALS
-- =============================================================================
--  Client reviews and testimonials, optionally linked to a project.
-- =============================================================================

CREATE TABLE testimonials (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(255) NOT NULL,
  client_role VARCHAR(255),                     -- 'CEO, TanzTech Solutions'
  client_type audience_type,
  body        TEXT        NOT NULL,
  rating      SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  project_id  UUID        REFERENCES projects (id) ON DELETE SET NULL,
  avatar_id   UUID        REFERENCES media (id) ON DELETE SET NULL,
  is_featured BOOLEAN     NOT NULL DEFAULT FALSE,
  status      publish_status NOT NULL DEFAULT 'published',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_testimonials_featured ON testimonials (is_featured);
CREATE INDEX idx_testimonials_status   ON testimonials (status);
CREATE INDEX idx_testimonials_project  ON testimonials (project_id);

-- =============================================================================
--  11. TEAM MEMBERS
-- =============================================================================
--  Company team / about page. Linked to media for profile photos.
-- =============================================================================

CREATE TABLE team_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  role_title   VARCHAR(255) NOT NULL,
  bio          TEXT,
  photo_id     UUID        REFERENCES media (id) ON DELETE SET NULL,
  email        VARCHAR(255),
  linkedin_url TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  is_visible   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_visible ON team_members (is_visible);
CREATE INDEX idx_team_sort    ON team_members (sort_order);

-- =============================================================================
--  12. PARTNERS / CLIENTS
-- =============================================================================
--  Logo bar on homepage, client list on about page.
-- =============================================================================

CREATE TABLE partners (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  logo_id     UUID        REFERENCES media (id) ON DELETE SET NULL,
  website_url TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_visible  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_visible ON partners (is_visible);

-- =============================================================================
--  13. CONTACTS  (Inbound messages from website visitors)
-- =============================================================================
--  Stores every contact form submission. Supports status tracking.
-- =============================================================================

CREATE TABLE contacts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  phone        VARCHAR(30),
  subject      VARCHAR(500),
  message      TEXT        NOT NULL,
  audience     audience_type,                   -- individual / company / government
  service_ref  UUID        REFERENCES services (id) ON DELETE SET NULL,
  project_ref  VARCHAR(255),                    -- free-text project description
  status       contact_status NOT NULL DEFAULT 'new',
  ip_address   INET,
  user_agent   TEXT,
  replied_at   TIMESTAMPTZ,
  replied_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
  notes        TEXT,                            -- internal admin notes
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_status   ON contacts (status);
CREATE INDEX idx_contacts_email    ON contacts (email);
CREATE INDEX idx_contacts_created  ON contacts (created_at DESC);

-- =============================================================================
--  14. PRODUCTS  (Inventory / shop items with media gallery)
-- =============================================================================
--  Simple product catalog with pricing, stock, and gallery support.
--  Can be extended with variants, pricing tiers, etc.
-- =============================================================================

CREATE TABLE products (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100),                 -- 'materials', 'equipment', 'supplies'
  sku              VARCHAR(60),                  -- stock keeping unit
  price            NUMERIC(12,2) NOT NULL,       -- currency in TZS
  stock_quantity   INTEGER     NOT NULL DEFAULT 0,
  image_media_id   UUID        REFERENCES media (id) ON DELETE SET NULL,  -- primary image
  gallery_ids      UUID[]      DEFAULT '{}',                             -- array of media IDs
  meta_description TEXT,
  tags             TEXT[],
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by       UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_by       UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_products_slug UNIQUE (slug),
  CONSTRAINT uq_products_sku  UNIQUE (sku)
);

CREATE INDEX idx_products_slug      ON products (slug);
CREATE INDEX idx_products_category  ON products (category);
CREATE INDEX idx_products_active    ON products (is_active);
CREATE INDEX idx_products_stock     ON products (stock_quantity);
CREATE INDEX idx_products_tags      ON products USING GIN (tags);

-- =============================================================================
--  14b. GLOBAL SETTINGS  (Key-value site configuration)
-- =============================================================================
--  Replaces hardcoded config: WhatsApp number, social links, hero video, etc.
--  Media references stored as UUID in media_id column.
-- =============================================================================

CREATE TABLE settings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          VARCHAR(120) NOT NULL,
  value        TEXT,
  value_json   JSONB,
  media_id     UUID        REFERENCES media (id) ON DELETE SET NULL,
  setting_type setting_type NOT NULL DEFAULT 'text',
  group_name   VARCHAR(60) NOT NULL DEFAULT 'general', -- 'social', 'seo', 'appearance'
  label        VARCHAR(255),                   -- human-readable label for admin UI
  description  TEXT,
  is_public    BOOLEAN     NOT NULL DEFAULT FALSE, -- expose to frontend API?
  updated_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_settings_key UNIQUE (key)
);

CREATE INDEX idx_settings_group  ON settings (group_name);
CREATE INDEX idx_settings_public ON settings (is_public);

-- =============================================================================
--  15. TRANSLATIONS  (Multi-language support — EN / SW / FR)
-- =============================================================================
--  Generic translation table. entity_type + entity_id + field + locale = value.
-- =============================================================================

CREATE TABLE translations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(60) NOT NULL,             -- 'service', 'project', 'blog', 'setting'
  entity_id   UUID        NOT NULL,
  field       VARCHAR(100) NOT NULL,            -- 'title', 'description', 'body'
  locale      VARCHAR(10) NOT NULL,             -- 'en', 'sw', 'fr'
  value       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_translation UNIQUE (entity_type, entity_id, field, locale)
);

CREATE INDEX idx_translations_entity ON translations (entity_type, entity_id);
CREATE INDEX idx_translations_locale ON translations (locale);

-- =============================================================================
--  16. AI CONVERSATIONS & MESSAGES  (Chat assistant — future-ready)
-- =============================================================================
--  Stores conversation sessions and message history for the AI assistant.
-- =============================================================================

CREATE TABLE ai_conversations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key    VARCHAR(255) NOT NULL,          -- browser session or user ID
  user_id        UUID        REFERENCES users (id) ON DELETE SET NULL,
  ip_address     INET,
  user_agent     TEXT,
  locale         VARCHAR(10) NOT NULL DEFAULT 'en',
  context        JSONB       DEFAULT '{}',       -- page, referrer, user intent
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ai_session UNIQUE (session_key)
);

CREATE INDEX idx_ai_conv_session ON ai_conversations (session_key);
CREATE INDEX idx_ai_conv_user    ON ai_conversations (user_id);
CREATE INDEX idx_ai_conv_created ON ai_conversations (created_at DESC);

CREATE TABLE ai_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT        NOT NULL,
  detected_intent VARCHAR(60),                   -- 'services', 'quote', 'contact'
  locale          VARCHAR(10) NOT NULL DEFAULT 'en',
  tokens_used     INTEGER,
  response_ms     INTEGER,                       -- response latency
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conv    ON ai_messages (conversation_id);
CREATE INDEX idx_ai_messages_role    ON ai_messages (role);
CREATE INDEX idx_ai_messages_created ON ai_messages (created_at DESC);

-- =============================================================================
--  17. AUDIT LOG  (Track all admin actions)
-- =============================================================================
--  Production-grade audit trail: who changed what, when, and from where.
-- =============================================================================

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users (id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,             -- 'create', 'update', 'delete', 'login'
  entity_type VARCHAR(60),                      -- 'project', 'blog', 'media'
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_logs (user_id);
CREATE INDEX idx_audit_entity  ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_action  ON audit_logs (action);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

-- =============================================================================
--  TRIGGERS — auto-update updated_at on every write
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to every table that has updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','media','pages','content_blocks','block_contents',
    'services','projects','blogs','testimonials','team_members',
    'contacts','products','settings','translations'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- =============================================================================
--  SEED DATA
-- =============================================================================

-- ── Admin user (password: 'changeme123' — replace hash before production)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Super Admin',   'admin@pyramidconstruction.co.tz',
   '$2b$12$PLACEHOLDER_BCRYPT_HASH_REPLACE_ME',   'super_admin'),
  ('Content Editor','editor@pyramidconstruction.co.tz',
   '$2b$12$PLACEHOLDER_BCRYPT_HASH_REPLACE_ME_2', 'editor');

-- ── Global settings
INSERT INTO settings (key, value, setting_type, group_name, label, is_public) VALUES
  ('site_name',        'Pyramid Engineering & Construction LTD', 'text', 'general',    'Site Name',           TRUE),
  ('site_tagline',     'Building the Future, Trusted and Reliable', 'text', 'general', 'Site Tagline',        TRUE),
  ('whatsapp_number',  '+255757744555',     'text',   'contact',    'WhatsApp Number',     TRUE),
  ('email_primary',    'pyramid.constructor.ltd@gmail.com', 'text', 'contact', 'Primary Email', TRUE),
  ('phone_primary',    '0757744555',        'text',   'contact',    'Primary Phone',       TRUE),
  ('address',          'Dar es Salaam, Tanzania', 'text', 'contact','Office Address',      TRUE),
  ('facebook_url',     '#',                 'text',   'social',     'Facebook URL',        TRUE),
  ('linkedin_url',     '#',                 'text',   'social',     'LinkedIn URL',        TRUE),
  ('instagram_url',    '#',                 'text',   'social',     'Instagram URL',       TRUE),
  ('tiktok_url',       '#',                 'text',   'social',     'TikTok URL',          TRUE),
  ('hero_video_url',   'https://videos.pexels.com/video-files/3195394/3195394-uhd_2560_1440_25fps.mp4',
                                            'text',   'appearance', 'Hero Video URL',      TRUE),
  ('default_theme',    'light',             'text',   'appearance', 'Default Theme',       TRUE),
  ('google_analytics', '',                  'text',   'seo',        'GA4 Measurement ID',  FALSE),
  ('years_experience', '15',                'text',   'stats',      'Years Experience',    TRUE),
  ('projects_count',   '300',               'text',   'stats',      'Projects Completed',  TRUE),
  ('satisfaction_pct', '98',                'text',   'stats',      'Client Satisfaction %', TRUE);

-- ── Blog categories
INSERT INTO blog_categories (name, slug) VALUES
  ('Construction Tips',    'construction-tips'),
  ('Materials & Methods',  'materials-methods'),
  ('Cost & Budgeting',     'cost-budgeting'),
  ('Design & Architecture','design-architecture'),
  ('Government Projects',  'government-projects'),
  ('Company News',         'company-news');

-- ── Pages
INSERT INTO pages (title, slug, description, is_system, sort_order) VALUES
  ('Home',          'home',          'Pyramid Engineering & Construction LTD — Building the Future', TRUE, 1),
  ('Services',      'services',      'Our core construction and engineering services',               TRUE, 2),
  ('Projects',      'projects',      'Portfolio of completed projects across Tanzania',              TRUE, 3),
  ('About',         'about',         'Our history, mission, team, and certifications',               TRUE, 4),
  ('Blog',          'blog',          'Construction tips, guides, and company news',                  TRUE, 5),
  ('Contact',       'contact',       'Get in touch with Pyramid Engineering',                        TRUE, 6);

-- ── Services
INSERT INTO services (title, slug, short_desc, audience, sort_order, features, status) VALUES
  ('Building Construction',
   'building-construction',
   'Full-cycle construction from foundation to finishing — residential, commercial, and industrial.',
   'all', 1,
   '["Licensed Engineers","Premium Materials","On-Time Delivery","Post-Construction Support"]',
   'published'),
  ('Architecture Planning & Design',
   'architecture-planning-design',
   'Innovative architectural designs that blend function, aesthetics, and structural integrity.',
   'all', 2,
   '["3D Modelling","Site Analysis","Structural Engineering","Interior Design"]',
   'published'),
  ('Consultation',
   'consultation',
   'Expert project consultation, feasibility studies, and professional engineering advice.',
   'all', 3,
   '["Feasibility Studies","Budget Planning","Regulatory Compliance","Risk Assessment"]',
   'published'),
  ('Renovation & Maintenance',
   'renovation-maintenance',
   'Breathe new life into existing structures with expert renovation and ongoing maintenance.',
   'all', 4,
   '["Structural Renovation","Interior Remodelling","Routine Maintenance","Emergency Repairs"]',
   'published');

-- ── Partners
INSERT INTO partners (name, sort_order) VALUES
  ('TANROADS', 1), ('NHC', 2), ('NSSF', 3),
  ('CRDB Bank', 4), ('Tanzania Breweries', 5), ('TTCL', 6);

