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

    const url = new URL(request.url);
    const siteUrl = url.searchParams.get('site_url');

    if (siteUrl) {
      const propRow = await env.DB.prepare('SELECT total_pages FROM properties WHERE site_url = ?')
        .bind(siteUrl).first<{ total_pages: number | null }>();

      const { results } = await env.DB.prepare(`
        SELECT date, page_count, total_pages, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(siteUrl, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      const pmRes = await env.DB.prepare(
        'SELECT COUNT(DISTINCT page) as cnt FROM page_metrics WHERE site_url = ?'
      ).bind(siteUrl).first<{ cnt: number }>();
      const pmCount = pmRes?.cnt || 0;

      const stats = buildSiteIndexStats(results || [], INDEX_WINDOW_DAYS, propRow?.total_pages || 0, pmCount);
      return new Response(JSON.stringify({
        siteUrl,
        ...stats,
        trendWindows: INDEX_TREND_WINDOWS
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Pre-aggregate distinct pages per site from page_metrics
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

    // All-sites summary: latest snapshot + lookback counts for trend windows
    const { results: props } = await env.DB.prepare(`
      SELECT site_url, display_name, COALESCE(total_pages, 0) as total_pages FROM properties ORDER BY display_name ASC
    `).all<{ site_url: string; display_name: string; total_pages: number }>();

    const sites = [];
    for (const p of props || []) {
      const pmCount = pmMap.get(p.site_url) || 0;
      const { results: snaps } = await env.DB.prepare(`
        SELECT date, page_count, total_pages, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(p.site_url, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      const stats = buildSiteIndexStats(snaps || [], INDEX_WINDOW_DAYS, p.total_pages, pmCount);
      const siteTotal = Math.max(p.total_pages || 0, stats.totalPages, stats.currentCount, pmCount);
      const ratio = siteTotal > 0 ? Math.round((stats.currentCount / siteTotal) * 1000) / 10 : 0;

      sites.push({
        site_url: p.site_url,
        display_name: p.display_name,
        indexed_pages: stats.currentCount,
        total_pages: siteTotal,
        index_ratio: ratio,
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

    // Portfolio totals (sum of current counts and total discovered/sitemap pages)
    const totalIndexed = sites.reduce((acc, s) => acc + (s.indexed_pages || 0), 0);
    const totalAllPages = sites.reduce((acc, s) => acc + (s.total_pages || s.indexed_pages || 0), 0);
    const overallRatio = totalAllPages > 0 ? Math.round((totalIndexed / totalAllPages) * 1000) / 10 : 0;

    return new Response(JSON.stringify({
      windowDays: INDEX_WINDOW_DAYS,
      trendWindows: INDEX_TREND_WINDOWS,
      totalIndexedPages: totalIndexed,
      totalAllPages,
      overallIndexRatio: overallRatio,
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
