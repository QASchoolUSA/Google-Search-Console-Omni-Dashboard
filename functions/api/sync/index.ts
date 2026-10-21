import { Env } from '../../types';
import { getSession } from '../../utils/google';
import {
  INDEX_WINDOW_DAYS,
  countUniquePagesWithImpressions,
  discoverSiteTotalPages,
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

    // 2. If discover_only requested, return verified properties list immediately
    if ((body as any).discover_only) {
      const { results } = await env.DB.prepare('SELECT site_url, display_name FROM properties ORDER BY display_name ASC').all();
      return new Response(JSON.stringify({
        success: true,
        properties: results || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch properties to sync from DB
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

        // 2. Fetch top search queries (anchored to the exact latest available GSC date or 2-day lag)
        const latestGscDate = dailyRows.length > 0
          ? dailyRows[dailyRows.length - 1].keys[0]
          : shiftDate(endDate, -2);
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
          let queryRows = queryData.rows || [];

          // If 28d had 0 queries, check full 90d window so low-traffic sites still retain keyword data
          if (queryRows.length === 0) {
            try {
              const fbQueryRes = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    startDate,
                    endDate: queryEndDate,
                    dimensions: ['query'],
                    type: 'web',
                    dataState: 'all',
                    rowLimit: 100
                  })
                }
              );
              if (fbQueryRes.ok) {
                const fbData = await fbQueryRes.json() as { rows?: GSCRow[] };
                queryRows = fbData.rows || [];
              }
            } catch {}
          }

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
            `).bind(id, site.site_url, q, queryEndDate, row.clicks, row.impressions, ctr, pos).run();
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
          let pageRows = pageData.rows || [];

          // If 28d returned 0 pages, check full 90d window so low-traffic sites still show their URLs
          if (pageRows.length === 0) {
            try {
              const fbPageRes = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    startDate,
                    endDate: queryEndDate,
                    dimensions: ['page'],
                    type: 'web',
                    dataState: 'all',
                    rowLimit: 50
                  })
                }
              );
              if (fbPageRes.ok) {
                const fbData = await fbPageRes.json() as { rows?: GSCRow[] };
                pageRows = fbData.rows || [];
              }
            } catch {}
          }

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
        // and total site pages (from GSC sitemaps, direct XML sitemaps, 16-month history, or discovered pages)
        try {
          const pmCountRes = await env.DB.prepare(
            'SELECT COUNT(DISTINCT page) as cnt FROM page_metrics WHERE site_url = ?'
          ).bind(site.site_url).first<{ cnt: number }>();
          const currentPmCount = pmCountRes?.cnt || 0;

          // Discover total site pages count across all sources
          let siteTotalPages = currentPmCount;
          try {
            const discovery = await discoverSiteTotalPages(
              session.access_token,
              site.site_url,
              latestGscDate,
              currentPmCount
            );
            siteTotalPages = discovery.totalPages;
          } catch (e: any) {
            console.warn(`Total pages discovery failed for ${site.site_url}:`, e?.message);
          }

          const { results: existingSnapRows } = await env.DB.prepare(
            `SELECT date FROM index_snapshots
             WHERE site_url = ? AND window_days = ?`
          ).bind(
            site.site_url,
            INDEX_WINDOW_DAYS
          ).all<{ date: string }>();

          const existingDates = new Set((existingSnapRows || []).map((r) => r.date));
          const isBulkSync = sitesToSync.length > 1;
          const maxFetches = isBulkSync ? 2 : 5;
          const datesToFetch = selectSnapshotDatesToFetch(latestGscDate, existingDates, 60, maxFetches);

          let latestPageCount = 0;

          for (const snapDate of datesToFetch) {
            const snapStart = windowStart(snapDate, INDEX_WINDOW_DAYS);
            try {
              const { count, isTruncated } = await countUniquePagesWithImpressions(
                session.access_token,
                site.site_url,
                snapStart,
                snapDate,
                isBulkSync ? 1 : 2
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

          const finalTotal = Math.max(siteTotalPages, latestPageCount, currentPmCount);
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
