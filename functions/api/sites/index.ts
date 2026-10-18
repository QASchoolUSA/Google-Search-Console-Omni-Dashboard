import { Env, SiteProperty } from '../../types';
import { getSession } from '../../utils/google';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    // 28 days window timestamp for computing rollups
    const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
          WHEN COUNT(d.id) > 0 
          THEN ROUND(AVG(d.position), 1)
          ELSE 0.0 
        END as avg_position_28d
      FROM properties p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN daily_metrics d ON d.site_url = p.site_url AND d.date >= ?
      GROUP BY p.id, p.site_url, p.display_name, p.category_id, p.permission_level, p.last_synced_at, p.is_favorite, c.name, c.color
      ORDER BY total_clicks_28d DESC, p.site_url ASC
    `).bind(twentyEightDaysAgo).all();

    return new Response(JSON.stringify(results || []), {
      headers: { 'Content-Type': 'application/json' }
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
