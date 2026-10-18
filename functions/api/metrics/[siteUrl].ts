import { Env, DailyMetric, QueryMetric, PageMetric } from '../../types';

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const rawSiteUrl = params.siteUrl as string;
    const siteUrl = decodeURIComponent(rawSiteUrl);
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28', 10);

    const now = Date.now();
    const currentStart = new Date(now - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const previousStart = new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

    // Current period totals
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
          WHEN COUNT(id) > 0 
          THEN ROUND(AVG(position), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics
      WHERE site_url = ? AND date >= ?
    `).bind(siteUrl, currentStart).first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
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
          WHEN COUNT(id) > 0 
          THEN ROUND(AVG(position), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics
      WHERE site_url = ? AND date >= ? AND date < ?
    `).bind(siteUrl, previousStart, currentStart).first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
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
      WHERE site_url = ? AND date >= ?
      ORDER BY date ASC
    `).bind(siteUrl, currentStart).all<DailyMetric>();

    // Top queries
    const { results: topQueries } = await env.DB.prepare(`
      SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions,
             ROUND(AVG(ctr), 2) as ctr, ROUND(AVG(position), 1) as position
      FROM query_metrics
      WHERE site_url = ? AND date >= ?
      GROUP BY query
      ORDER BY clicks DESC, impressions DESC
      LIMIT 100
    `).bind(siteUrl, currentStart).all<QueryMetric>();

    // Top pages
    const { results: topPages } = await env.DB.prepare(`
      SELECT page, SUM(clicks) as clicks, SUM(impressions) as impressions,
             ROUND(AVG(ctr), 2) as ctr, ROUND(AVG(position), 1) as position
      FROM page_metrics
      WHERE site_url = ? AND date >= ?
      GROUP BY page
      ORDER BY clicks DESC, impressions DESC
      LIMIT 50
    `).bind(siteUrl, currentStart).all<PageMetric>();

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
      timeline: timeline || [],
      topQueries: topQueries || [],
      topPages: topPages || []
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
