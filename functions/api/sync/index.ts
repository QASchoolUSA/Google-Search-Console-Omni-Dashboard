import { Env } from '../../types';
import { getSession } from '../../utils/google';
import {
  INDEX_WINDOW_DAYS,
  countUniquePagesWithImpressions,
  fetchDirectSitemapUrlCount,
  fetchSiteTotalPagesFromGsc,
  selectSnapshotDatesToFetch,
  shiftDate,
  windowStart
} from '../../utils/indexing';

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

    // Ensure indexed-pages snapshot table exists (safe for older D1 schemas)
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
    await env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_index_snapshots_site_date ON index_snapshots(site_url, date)'
    ).run();

    try {
      await env.DB.prepare('ALTER TABLE properties ADD COLUMN total_pages INTEGER DEFAULT 0').run();
    } catch {}
    try {
      await env.DB.prepare('ALTER TABLE index_snapshots ADD COLUMN total_pages INTEGER DEFAULT 0').run();
    } catch {}

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

        // 2. Fetch top search queries (anchored to the exact latest available GSC date)
        const latestGscDate = dailyRows.length > 0
          ? dailyRows[dailyRows.length - 1].keys[0]
          : endDate;
        const queryEndDate = latestGscDate;
        const queryStartDate = new Date(new Date(latestGscDate).getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const queryRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate: queryStartDate,
              endDate: queryEndDate,
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
              startDate: queryStartDate,
              endDate: queryEndDate,
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
            `).bind(id, site.site_url, page, queryEndDate, row.clicks, row.impressions, ctr, pos).run();
          }
        }

        // 4. Fetch device breakdown
        const deviceRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate: queryStartDate,
              endDate: queryEndDate,
              dimensions: ['device'],
              type: 'web',
              dataState: 'all'
            })
          }
        );

        if (deviceRes.ok) {
          const deviceData = await deviceRes.json() as { rows?: GSCRow[] };
          const deviceRows = deviceData.rows || [];
          await env.DB.prepare('DELETE FROM device_metrics WHERE site_url = ?').bind(site.site_url).run();
          for (const row of deviceRows) {
            const dev = row.keys[0];
            const id = `${site.site_url}_${dev}`;
            const ctr = Number((row.ctr * 100).toFixed(2));
            const pos = Number(row.position.toFixed(1));
            await env.DB.prepare(`
              INSERT INTO device_metrics (id, site_url, device, date, clicks, impressions, ctr, position)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(site_url, device, date) DO UPDATE SET
                clicks = excluded.clicks,
                impressions = excluded.impressions,
                ctr = excluded.ctr,
                position = excluded.position
            `).bind(id, site.site_url, dev, queryEndDate, row.clicks, row.impressions, ctr, pos).run();
          }
        }

        // 5. Fetch country breakdown
        const countryRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startDate: queryStartDate,
              endDate: queryEndDate,
              dimensions: ['country'],
              type: 'web',
              dataState: 'all',
              rowLimit: 10
            })
          }
        );

        if (countryRes.ok) {
          const countryData = await countryRes.json() as { rows?: GSCRow[] };
          const countryRows = countryData.rows || [];
          await env.DB.prepare('DELETE FROM country_metrics WHERE site_url = ?').bind(site.site_url).run();
          for (const row of countryRows) {
            const cCode = row.keys[0];
            const id = `${site.site_url}_${cCode}`;
            const ctr = Number((row.ctr * 100).toFixed(2));
            const pos = Number(row.position.toFixed(1));
            await env.DB.prepare(`
              INSERT INTO country_metrics (id, site_url, country, date, clicks, impressions, ctr, position)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(site_url, country, date) DO UPDATE SET
                clicks = excluded.clicks,
                impressions = excluded.impressions,
                ctr = excluded.ctr,
                position = excluded.position
            `).bind(id, site.site_url, cCode, queryEndDate, row.clicks, row.impressions, ctr, pos).run();
          }
        }

        // 6. Indexed pages snapshots (unique pages with impressions — GSC visibility proxy)
        // and total site pages (from GSC sitemaps, direct sitemap.xml, or discovered pages)
        try {
          // Discover total site pages count
          let siteTotalPages = 0;
          try {
            const gscSitemaps = await fetchSiteTotalPagesFromGsc(session.access_token, site.site_url);
            siteTotalPages = gscSitemaps.totalSubmitted;
          } catch (e: any) {
            console.warn(`GSC Sitemaps check failed for ${site.site_url}:`, e?.message);
          }

          if (siteTotalPages <= 0) {
            try {
              siteTotalPages = await fetchDirectSitemapUrlCount(site.site_url);
            } catch (e: any) {
              console.warn(`Direct sitemap.xml check failed for ${site.site_url}:`, e?.message);
            }
          }

          if (siteTotalPages <= 0) {
            const pmCount = await env.DB.prepare('SELECT COUNT(DISTINCT page) as cnt FROM page_metrics WHERE site_url = ?')
              .bind(site.site_url).first<{ cnt: number }>();
            siteTotalPages = pmCount?.cnt || 0;
          }

          const { results: existingSnapRows } = await env.DB.prepare(
            `SELECT date FROM index_snapshots
             WHERE site_url = ? AND window_days = ? AND date >= ? AND date <= ?`
          ).bind(
            site.site_url,
            INDEX_WINDOW_DAYS,
            shiftDate(latestGscDate, -59),
            latestGscDate
          ).all<{ date: string }>();

          const existingDates = new Set((existingSnapRows || []).map((r) => r.date));
          const datesToFetch = selectSnapshotDatesToFetch(latestGscDate, existingDates);

          let latestPageCount = 0;

          for (const snapDate of datesToFetch) {
            const snapStart = windowStart(snapDate, INDEX_WINDOW_DAYS);
            try {
              const { count, isTruncated } = await countUniquePagesWithImpressions(
                session.access_token,
                site.site_url,
                snapStart,
                snapDate
              );
              latestPageCount = Math.max(latestPageCount, count);
              const snapshotTotal = Math.max(siteTotalPages, count);
              const snapId = `${site.site_url}_idx_${snapDate}_${INDEX_WINDOW_DAYS}`;
              await env.DB.prepare(`
                INSERT INTO index_snapshots (id, site_url, date, page_count, total_pages, window_days, is_truncated)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(site_url, date, window_days) DO UPDATE SET
                  page_count = excluded.page_count,
                  total_pages = excluded.total_pages,
                  is_truncated = excluded.is_truncated
              `).bind(
                snapId,
                site.site_url,
                snapDate,
                count,
                snapshotTotal,
                INDEX_WINDOW_DAYS,
                isTruncated ? 1 : 0
              ).run();
            } catch (snapErr: any) {
              console.warn(`Index snapshot failed for ${site.site_url} @ ${snapDate}:`, snapErr?.message);
            }
          }

          const finalTotal = Math.max(siteTotalPages, latestPageCount);
          if (finalTotal > 0) {
            await env.DB.prepare('UPDATE properties SET total_pages = ? WHERE site_url = ?')
              .bind(finalTotal, site.site_url).run();
          }
        } catch (indexErr: any) {
          console.warn(`Indexed-pages sync skipped for ${site.site_url}:`, indexErr?.message);
        }

        // 7. Update site last_synced_at
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
