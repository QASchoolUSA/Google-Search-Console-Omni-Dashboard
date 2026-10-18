import { Env } from '../../types';
import { getSession } from '../../utils/google';

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please log in with Google first.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({})) as { site_url?: string; days?: number };
    // Default to fetching last 90 days to provide historical comparison data
    const days = Math.max(body.days || 60, 60);

    // 1. Automatically discover & import verified properties from GSC
    try {
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (sitesRes.ok) {
        const sitesData = await sitesRes.json() as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
        const sites = sitesData.siteEntry || [];

        for (const s of sites) {
          const id = crypto.randomUUID();
          const displayName = s.siteUrl
            .replace(/^https?:\/\//, '')
            .replace(/^sc-domain:/, '')
            .replace(/\/$/, '');

          await env.DB.prepare(`
            INSERT INTO properties (id, site_url, display_name, permission_level)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(site_url) DO UPDATE SET permission_level = excluded.permission_level
          `).bind(id, s.siteUrl, displayName, s.permissionLevel).run();
        }
      } else {
        const errTxt = await sitesRes.text();
        console.warn('Failed to fetch sites from GSC:', sitesRes.status, errTxt);
      }
    } catch (importErr) {
      console.error('Error auto-discovering sites from GSC', importErr);
    }

    // 2. Fetch properties to sync from DB
    let sitesToSync: { site_url: string }[] = [];
    if (body.site_url) {
      sitesToSync = [{ site_url: body.site_url }];
    } else {
      const { results } = await env.DB.prepare('SELECT site_url FROM properties').all();
      sitesToSync = (results || []) as { site_url: string }[];
    }

    if (sitesToSync.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        syncedSitesCount: 0,
        message: 'No verified properties found in your Google Search Console account. Please add and verify a site in Google Search Console first.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use Pacific Time dates to match Google Search Console's internal timezone
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalSyncedSites = 0;
    const errors: { site: string; error: string }[] = [];

    for (const site of sitesToSync) {
      try {
        const encodedSite = encodeURIComponent(site.site_url);

        // 1. Fetch daily metrics with dataState: 'all' to include fresh data
        const dailyRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate,
              endDate,
              dimensions: ['date'],
              type: 'web',
              aggregationType: 'byProperty',
              dataState: 'all',
              rowLimit: 1000
            })
          }
        );

        if (!dailyRes.ok) {
          const errText = await dailyRes.text();
          errors.push({ site: site.site_url, error: errText });
          continue;
        }

        const dailyData = await dailyRes.json() as { rows?: GSCRow[] };
        const dailyRows = dailyData.rows || [];

        // Save daily metrics to D1
        for (const row of dailyRows) {
          const date = row.keys[0];
          const id = `${site.site_url}_${date}`;
          const ctr = Number((row.ctr * 100).toFixed(2));
          const pos = Number(row.position.toFixed(1));

          await env.DB.prepare(`
            INSERT INTO daily_metrics (id, site_url, date, clicks, impressions, ctr, position)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(site_url, date) DO UPDATE SET
              clicks = excluded.clicks,
              impressions = excluded.impressions,
              ctr = excluded.ctr,
              position = excluded.position
          `).bind(id, site.site_url, date, row.clicks, row.impressions, ctr, pos).run();
        }

        // 2. Fetch top search queries (fresh 28-day window)
        const recent28dStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const queryRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate: recent28dStart,
              endDate,
              dimensions: ['query'],
              type: 'web',
              dataState: 'all',
              rowLimit: 100
            })
          }
        );

        if (queryRes.ok) {
          const queryData = await queryRes.json() as { rows?: GSCRow[] };
          const queryRows = queryData.rows || [];

          // Clean up old queries for this site to prevent duplicate accumulation
          await env.DB.prepare('DELETE FROM query_metrics WHERE site_url = ?').bind(site.site_url).run();

          for (const row of queryRows) {
            const q = row.keys[0];
            const id = `${site.site_url}_${q}`;
            const ctr = Number((row.ctr * 100).toFixed(2));
            const pos = Number(row.position.toFixed(1));

            await env.DB.prepare(`
              INSERT INTO query_metrics (id, site_url, query, date, clicks, impressions, ctr, position)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(site_url, query, date) DO UPDATE SET
                clicks = excluded.clicks,
                impressions = excluded.impressions,
                ctr = excluded.ctr,
                position = excluded.position
            `).bind(id, site.site_url, q, endDate, row.clicks, row.impressions, ctr, pos).run();
          }
        }

        // 3. Fetch top landing pages
        const pageRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate: recent28dStart,
              endDate,
              dimensions: ['page'],
              type: 'web',
              dataState: 'all',
              rowLimit: 50
            })
          }
        );

        if (pageRes.ok) {
          const pageData = await pageRes.json() as { rows?: GSCRow[] };
          const pageRows = pageData.rows || [];

          // Clean up old page metrics for this site
          await env.DB.prepare('DELETE FROM page_metrics WHERE site_url = ?').bind(site.site_url).run();

          for (const row of pageRows) {
            const page = row.keys[0];
            const id = `${site.site_url}_${page}`;
            const ctr = Number((row.ctr * 100).toFixed(2));
            const pos = Number(row.position.toFixed(1));

            await env.DB.prepare(`
              INSERT INTO page_metrics (id, site_url, page, date, clicks, impressions, ctr, position)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(site_url, page, date) DO UPDATE SET
                clicks = excluded.clicks,
                impressions = excluded.impressions,
                ctr = excluded.ctr,
                position = excluded.position
            `).bind(id, site.site_url, page, endDate, row.clicks, row.impressions, ctr, pos).run();
          }
        }

        // 4. Update site last_synced_at
        await env.DB.prepare('UPDATE properties SET last_synced_at = CURRENT_TIMESTAMP WHERE site_url = ?')
          .bind(site.site_url).run();

        totalSyncedSites++;
      } catch (err: any) {
        errors.push({ site: site.site_url, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      syncedSitesCount: totalSyncedSites,
      message: `Successfully synchronized ${totalSyncedSites} properties from Google Search Console!`,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
