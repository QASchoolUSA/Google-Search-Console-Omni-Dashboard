import { Env, DailyMetric, QueryMetric, PageMetric } from '../../types';
import { computeGenAiMetrics, classifyQueryAiIntent, calculateCitationLikelihood } from '../../utils/genai';
import {
  INDEX_WINDOW_DAYS,
  IndexSnapshotRow,
  buildSiteIndexStats
} from '../../utils/indexing';

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const rawSiteUrl = params.siteUrl as string;
    const siteUrl = decodeURIComponent(rawSiteUrl);
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28', 10);

    // Property details
    const property = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM properties p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.site_url = ?
    `).bind(siteUrl).first();

    if (!property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find latest available date for this site to anchor the date window accurately
    const maxRow = await env.DB.prepare(
      'SELECT MAX(date) as maxDate FROM daily_metrics WHERE site_url = ?'
    ).bind(siteUrl).first<{ maxDate: string | null }>();
    const anchorDate = maxRow?.maxDate ? new Date(maxRow.maxDate) : new Date();

    const currentEnd = anchorDate.toISOString().split('T')[0];
    const currentStart = new Date(anchorDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const prevEnd = currentStart;
    const prevStart = new Date(new Date(currentStart).getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Current period totals using impression-weighted position
    const currentTotal = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(clicks), 0) as totalClicks,
        COALESCE(SUM(impressions), 0) as totalImpressions,
        CASE 
          WHEN COALESCE(SUM(impressions), 0) > 0 
          THEN ROUND(CAST(SUM(clicks) AS REAL) / CAST(SUM(impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as avgCtr,
        CASE 
          WHEN COALESCE(SUM(impressions), 0) > 0 
          THEN ROUND(CAST(SUM(position * impressions) AS REAL) / CAST(SUM(impressions) AS REAL), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics
      WHERE site_url = ? AND date >= ? AND date <= ?
    `).bind(siteUrl, currentStart, currentEnd).first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0
    };

    // Previous period totals
    const prevTotal = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(clicks), 0) as totalClicks,
        COALESCE(SUM(impressions), 0) as totalImpressions,
        CASE 
          WHEN COALESCE(SUM(impressions), 0) > 0 
          THEN ROUND(CAST(SUM(clicks) AS REAL) / CAST(SUM(impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as avgCtr,
        CASE 
          WHEN COALESCE(SUM(impressions), 0) > 0 
          THEN ROUND(CAST(SUM(position * impressions) AS REAL) / CAST(SUM(impressions) AS REAL), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics
      WHERE site_url = ? AND date >= ? AND date < ?
    `).bind(siteUrl, prevStart, prevEnd).first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0
    };

    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    // Daily timeline
    const { results: timeline } = await env.DB.prepare(`
      SELECT date, clicks, impressions, ctr, position
      FROM daily_metrics
      WHERE site_url = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(siteUrl, currentStart, currentEnd).all<DailyMetric>();

    // Top queries (clean deduplicated snapshot)
    const { results: rawTopQueries } = await env.DB.prepare(`
      SELECT query, clicks, impressions, ctr, position
      FROM query_metrics
      WHERE site_url = ?
      ORDER BY clicks DESC, impressions DESC
      LIMIT 100
    `).bind(siteUrl).all<QueryMetric>();

    const topQueries: QueryMetric[] = (rawTopQueries || []).map(q => ({
      ...q,
      aiIntent: classifyQueryAiIntent(q.query),
      citationLikelihood: calculateCitationLikelihood(q.position)
    }));

    const aiMetrics = computeGenAiMetrics(
      topQueries,
      currentTotal.totalClicks,
      currentTotal.totalImpressions
    );

    // Top pages
    const { results: topPages } = await env.DB.prepare(`
      SELECT page, clicks, impressions, ctr, position
      FROM page_metrics
      WHERE site_url = ?
      ORDER BY clicks DESC, impressions DESC
      LIMIT 100
    `).bind(siteUrl).all<PageMetric>();

    // Indexed pages (unique URLs with impressions) + multi-window trends
    let indexStats = buildSiteIndexStats([], INDEX_WINDOW_DAYS);
    try {
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

      const { results: indexSnaps } = await env.DB.prepare(`
        SELECT date, page_count, window_days, is_truncated
        FROM index_snapshots
        WHERE site_url = ? AND window_days = ?
        ORDER BY date ASC
      `).bind(siteUrl, INDEX_WINDOW_DAYS).all<IndexSnapshotRow>();

      indexStats = buildSiteIndexStats(indexSnaps || [], INDEX_WINDOW_DAYS);
    } catch (indexErr) {
      console.warn('Indexed pages lookup failed', indexErr);
    }

    return new Response(JSON.stringify({
      property,
      totalClicks: currentTotal.totalClicks,
      totalImpressions: currentTotal.totalImpressions,
      avgCtr: currentTotal.avgCtr,
      avgPosition: currentTotal.avgPosition,
      clicksChange: calcChange(currentTotal.totalClicks, prevTotal.totalClicks),
      impressionsChange: calcChange(currentTotal.totalImpressions, prevTotal.totalImpressions),
      ctrChange: Math.round((currentTotal.avgCtr - prevTotal.avgCtr) * 10) / 10,
      positionChange: Math.round((prevTotal.avgPosition - currentTotal.avgPosition) * 10) / 10,
      startDate: currentStart,
      endDate: currentEnd,
      timeline: timeline || [],
      topQueries: topQueries || [],
      topPages: topPages || [],
      aiMetrics,
      indexStats
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
