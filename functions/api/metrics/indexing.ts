import { Env } from '../../types';
import {
  INDEX_TREND_WINDOWS,
  INDEX_WINDOW_DAYS,
  IndexSnapshotRow,
  buildSiteIndexStats
} from '../../utils/indexing';

/**
 * GET /api/metrics/indexing
 *   ?site_url=...  → single site indexed-pages stats + trends + timeline
 *   (no site_url)  → all sites summary with 3/7/14/30/60d trends
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Ensure table exists for deployments that only ran older schema.sql
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

    const url = new URL(request.url);
    const siteUrl = url.searchParams.get('site_url');

    if (siteUrl) {
      const { results } = await env.DB.prepare(`
        SELECT date, page_count, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(siteUrl, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      const stats = buildSiteIndexStats(results || [], INDEX_WINDOW_DAYS);
      return new Response(JSON.stringify({
        siteUrl,
        ...stats,
        trendWindows: INDEX_TREND_WINDOWS
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // All-sites summary: latest snapshot + lookback counts for trend windows
    const { results: props } = await env.DB.prepare(`
      SELECT site_url, display_name FROM properties ORDER BY display_name ASC
    `).all<{ site_url: string; display_name: string }>();

    const sites = [];
    for (const p of props || []) {
      const { results: snaps } = await env.DB.prepare(`
        SELECT date, page_count, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(p.site_url, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      const stats = buildSiteIndexStats(snaps || [], INDEX_WINDOW_DAYS);
      sites.push({
        site_url: p.site_url,
        display_name: p.display_name,
        indexed_pages: stats.currentCount,
        as_of_date: stats.asOfDate,
        is_truncated: stats.isTruncated,
        trends: Object.fromEntries(
          stats.trends.map((t) => [
            `d${t.days}`,
            {
              change: t.change,
              changePct: t.changePct,
              previousCount: t.previousCount,
              previousDate: t.previousDate
            }
          ])
        ),
        timeline: stats.timeline
      });
    }

    // Portfolio totals (sum of current counts)
    const totalIndexed = sites.reduce((acc, s) => acc + (s.indexed_pages || 0), 0);

    return new Response(JSON.stringify({
      windowDays: INDEX_WINDOW_DAYS,
      trendWindows: INDEX_TREND_WINDOWS,
      totalIndexedPages: totalIndexed,
      siteCount: sites.length,
      sites
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
