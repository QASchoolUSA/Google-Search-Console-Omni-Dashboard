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
        window_days INTEGER NOT NULL DEFAULT 28,
        is_truncated INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_url, date, window_days)
      )
    `).run();

    // Find latest available date in database to anchor 28d window accurately
    const maxRow = await env.DB.prepare('SELECT MAX(date) as maxDate FROM daily_metrics').first<{ maxDate: string | null }>();
    const anchorDate = maxRow?.maxDate ? new Date(maxRow.maxDate) : new Date();

    const currentEnd = anchorDate.toISOString().split('T')[0];
    const currentStart = new Date(anchorDate.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { results } = await env.DB.prepare(`
      SELECT 
        p.id,
        p.site_url,
        p.display_name,
        p.category_id,
        p.permission_level,
        p.last_synced_at,
        p.is_favorite,
        c.name as category_name,
        c.color as category_color,
        COALESCE(SUM(d.clicks), 0) as total_clicks_28d,
        COALESCE(SUM(d.impressions), 0) as total_impressions_28d,
        CASE 
          WHEN COALESCE(SUM(d.impressions), 0) > 0 
          THEN ROUND(CAST(SUM(d.clicks) AS REAL) / CAST(SUM(d.impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as avg_ctr_28d,
        CASE 
          WHEN COALESCE(SUM(d.impressions), 0) > 0 
          THEN ROUND(CAST(SUM(d.position * d.impressions) AS REAL) / CAST(SUM(d.impressions) AS REAL), 1)
          ELSE 0.0 
        END as avg_position_28d
      FROM properties p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN daily_metrics d ON d.site_url = p.site_url AND d.date >= ? AND d.date <= ?
      GROUP BY p.id, p.site_url, p.display_name, p.category_id, p.permission_level, p.last_synced_at, p.is_favorite, c.name, c.color
      ORDER BY total_clicks_28d DESC, p.site_url ASC
    `).bind(currentStart, currentEnd).all<SiteProperty>();

    const properties = results || [];

    // Attach indexed-pages current count + multi-window trends
    const enriched = [];
    for (const prop of properties) {
      const snapStart = shiftDate(currentEnd, -59);
      const { results: snaps } = await env.DB.prepare(`
        SELECT date, page_count, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ? AND date >= ?
        ORDER BY date ASC
      `).bind(prop.site_url, INDEX_WINDOW_DAYS, snapStart).all<IndexSnapshotRow>();

      const stats = buildSiteIndexStats(snaps || [], INDEX_WINDOW_DAYS);
      const trendMap: Record<string, number | null> = {};
      for (const t of stats.trends) {
        trendMap[`indexed_change_${t.days}d`] = t.changePct;
      }

      enriched.push({
        ...prop,
        indexed_pages: stats.currentCount,
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
