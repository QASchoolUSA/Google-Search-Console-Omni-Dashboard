-- Google Search Console Dashboard SQLite Database Schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  site_url TEXT UNIQUE NOT NULL,
  display_name TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  permission_level TEXT DEFAULT 'siteOwner',
  last_synced_at TIMESTAMP,
  is_favorite INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL REFERENCES properties(site_url) ON DELETE CASCADE,
  date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0.0,
  position REAL NOT NULL DEFAULT 0.0,
  UNIQUE(site_url, date)
);

CREATE TABLE IF NOT EXISTS query_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL REFERENCES properties(site_url) ON DELETE CASCADE,
  query TEXT NOT NULL,
  date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0.0,
  position REAL NOT NULL DEFAULT 0.0,
  UNIQUE(site_url, query, date)
);

CREATE TABLE IF NOT EXISTS page_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL REFERENCES properties(site_url) ON DELETE CASCADE,
  page TEXT NOT NULL,
  date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0.0,
  position REAL NOT NULL DEFAULT 0.0,
  UNIQUE(site_url, page, date)
);

CREATE TABLE IF NOT EXISTS device_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL REFERENCES properties(site_url) ON DELETE CASCADE,
  device TEXT NOT NULL,
  date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0.0,
  position REAL NOT NULL DEFAULT 0.0,
  UNIQUE(site_url, device, date)
);

CREATE TABLE IF NOT EXISTS country_metrics (
  id TEXT PRIMARY KEY,
  site_url TEXT NOT NULL REFERENCES properties(site_url) ON DELETE CASCADE,
  country TEXT NOT NULL,
  date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0.0,
  position REAL NOT NULL DEFAULT 0.0,
  UNIQUE(site_url, country, date)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT,
  user_picture TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast aggregations across sites & categories
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_site ON daily_metrics(site_url);
CREATE INDEX IF NOT EXISTS idx_query_metrics_site ON query_metrics(site_url);
CREATE INDEX IF NOT EXISTS idx_page_metrics_site ON page_metrics(site_url);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category_id);
