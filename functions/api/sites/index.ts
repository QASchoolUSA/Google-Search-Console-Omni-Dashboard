import { Env, SiteProperty } from '../../types';
import { getSession } from '../../utils/google';
import {
  INDEX_TREND_WINDOWS,
  INDEX_WINDOW_DAYS,
  IndexSnapshotRow,
  buildSiteIndexStats,
  shiftDate
} from '../../utils/indexing';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    // Ensure index_snapshots exists for older deployments
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS index_snapshots (
        id TEXT PRIMARY KEY,
        site_url TEXT NOT NULL,
        date TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 0,
        total_pages INTEGER NOT NULL DEFAULT 0,
        window_days INTEGER NOT NULL DEFAULT 28,
        is_truncated INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_url, date, window_days)
      )
    `).run();

    try {
      await env.DB.prepare('ALTER TABLE properties ADD COLUMN total_pages INTEGER DEFAULT 0').run();
    } catch {}
    try {
      await env.DB.prepare('ALTER TABLE index_snapshots ADD COLUMN total_pages INTEGER DEFAULT 0').run();
    } catch {}

    // Fetch all properties with per-site 28-day window performance metrics
    // Anchored to each site's own latest available date so no site's data is dropped
    const { results } = await env.DB.prepare(`
      SELECT 
        p.id,
        p.site_url,
        p.display_name,
        p.category_id,
        p.permission_level,
        p.last_synced_at,
        p.is_favorite,
        COALESCE(p.total_pages, 0) as total_pages,
        c.name as category_name,
        c.color as category_color,
        COALESCE(m.total_clicks_28d, 0) as total_clicks_28d,
        COALESCE(m.total_impressions_28d, 0) as total_impressions_28d,
        COALESCE(m.avg_ctr_28d, 0.0) as avg_ctr_28d,
        COALESCE(m.avg_position_28d, 0.0) as avg_position_28d
      FROM properties p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT 
          d.site_url,
          SUM(d.clicks) as total_clicks_28d,
          SUM(d.impressions) as total_impressions_28d,
          CASE 
            WHEN SUM(d.impressions) > 0 
            THEN ROUND(CAST(SUM(d.clicks) AS REAL) / CAST(SUM(d.impressions) AS REAL) * 100, 2)
            ELSE 0.0 
          END as avg_ctr_28d,
          CASE 
            WHEN SUM(d.impressions) > 0 
            THEN ROUND(CAST(SUM(d.position * d.impressions) AS REAL) / CAST(SUM(d.impressions) AS REAL), 1)
            ELSE 0.0 
          END as avg_position_28d
        FROM daily_metrics d
        INNER JOIN (
          SELECT site_url, MAX(date) as max_date, date(MAX(date), '-27 days') as min_date
          FROM daily_metrics
          GROUP BY site_url
        ) b ON d.site_url = b.site_url AND d.date >= b.min_date AND d.date <= b.max_date
        GROUP BY d.site_url
      ) m ON m.site_url = p.site_url
      ORDER BY total_clicks_28d DESC, p.site_url ASC
    `).all<SiteProperty>();

    const properties = results || [];

    // Pre-aggregate distinct pages per site from page_metrics for instantaneous fallback
    const pmMap = new Map<string, number>();
    try {
      const { results: pmRows } = await env.DB.prepare(`
        SELECT site_url, COUNT(DISTINCT page) as pm_count
        FROM page_metrics
        GROUP BY site_url
      `).all<{ site_url: string; pm_count: number }>();
      for (const r of pmRows || []) {
        pmMap.set(r.site_url, Number(r.pm_count || 0));
      }
    } catch {}

    // Attach indexed-pages current count + multi-window trends for each site
    const enriched = [];
    for (const prop of properties) {
      const pmCount = pmMap.get(prop.site_url) || 0;
      const { results: snaps } = await env.DB.prepare(`
        SELECT date, page_count, total_pages, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(prop.site_url, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      const stats = buildSiteIndexStats(snaps || [], INDEX_WINDOW_DAYS, prop.total_pages || 0, pmCount);
      const indexedPages = stats.currentCount;
      const totalPages = Math.max(prop.total_pages || 0, stats.totalPages, indexedPages, pmCount);

      // Persist discovered total_pages to DB if not set
      if (totalPages > (prop.total_pages || 0)) {
        try {
          await env.DB.prepare('UPDATE properties SET total_pages = ? WHERE site_url = ?')
            .bind(totalPages, prop.site_url).run();
        } catch {}
      }

      // Seed an initial snapshot if table had no rows for this site but pages exist
      if ((!snaps || snaps.length === 0) && indexedPages > 0) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const snapId = `${prop.site_url}_idx_${today}_${INDEX_WINDOW_DAYS}`;
          await env.DB.prepare(`
            INSERT INTO index_snapshots (id, site_url, date, page_count, total_pages, window_days, is_truncated)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(site_url, date, window_days) DO UPDATE SET
              page_count = excluded.page_count,
              total_pages = excluded.total_pages
          `).bind(snapId, prop.site_url, today, indexedPages, totalPages, INDEX_WINDOW_DAYS).run();
        } catch {}
      }

      const trendMap: Record<string, number | null> = {};
      for (const t of stats.trends) {
        trendMap[`indexed_change_${t.days}d`] = t.changePct;
      }

      enriched.push({
        ...prop,
        total_pages: totalPages,
        indexed_pages: indexedPages,
        indexed_as_of: stats.asOfDate,
        indexed_truncated: stats.isTruncated ? 1 : 0,
        ...trendMap,
        indexed_trends: stats.trends
      });
    }

    return new Response(JSON.stringify(enriched), {
      headers: {
        'Content-Type': 'application/json',
        'X-Index-Trend-Windows': INDEX_TREND_WINDOWS.join(',')
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Import / fetch verified sites list from GSC API
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `GSC API error: ${txt}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await res.json() as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
    const sites = data.siteEntry || [];

    let importedCount = 0;
    for (const site of sites) {
      const id = crypto.randomUUID();
      const displayName = site.siteUrl
        .replace(/^https?:\/\//, '')
        .replace(/^sc-domain:/, '')
        .replace(/\/$/, '');

      await env.DB.prepare(`
        INSERT INTO properties (id, site_url, display_name, permission_level)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(site_url) DO UPDATE SET permission_level = excluded.permission_level
      `).bind(id, site.siteUrl, displayName, site.permissionLevel).run();
      importedCount++;
    }

    return new Response(JSON.stringify({ success: true, count: importedCount }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
