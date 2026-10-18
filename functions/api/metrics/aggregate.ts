import { Env, DailyMetric } from '../../types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('category_id');
    const days = parseInt(url.searchParams.get('days') || '28', 10);

    const now = Date.now();
    const currentStart = new Date(now - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const previousStart = new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build WHERE clause for category filtering
    const categoryFilter = categoryId && categoryId !== 'all'
      ? 'AND p.category_id = ?'
      : '';
    const params = categoryId && categoryId !== 'all' ? [categoryId] : [];

    // Current period totals
    const currentQuery = `
      SELECT 
        COALESCE(SUM(d.clicks), 0) as totalClicks,
        COALESCE(SUM(d.impressions), 0) as totalImpressions,
        CASE 
          WHEN COALESCE(SUM(d.impressions), 0) > 0 
          THEN ROUND(CAST(SUM(d.clicks) AS REAL) / CAST(SUM(d.impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as avgCtr,
        CASE 
          WHEN COUNT(d.id) > 0 
          THEN ROUND(AVG(d.position), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics d
      JOIN properties p ON p.site_url = d.site_url
      WHERE d.date >= ? ${categoryFilter}
    `;

    const currentTotal = await env.DB.prepare(currentQuery)
      .bind(currentStart, ...params)
      .first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
        totalClicks: 0,
        totalImpressions: 0,
        avgCtr: 0,
        avgPosition: 0
      };

    // Previous period totals for % change calculation
    const prevQuery = `
      SELECT 
        COALESCE(SUM(d.clicks), 0) as totalClicks,
        COALESCE(SUM(d.impressions), 0) as totalImpressions,
        CASE 
          WHEN COALESCE(SUM(d.impressions), 0) > 0 
          THEN ROUND(CAST(SUM(d.clicks) AS REAL) / CAST(SUM(d.impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as avgCtr,
        CASE 
          WHEN COUNT(d.id) > 0 
          THEN ROUND(AVG(d.position), 1)
          ELSE 0.0 
        END as avgPosition
      FROM daily_metrics d
      JOIN properties p ON p.site_url = d.site_url
      WHERE d.date >= ? AND d.date < ? ${categoryFilter}
    `;

    const prevTotal = await env.DB.prepare(prevQuery)
      .bind(previousStart, currentStart, ...params)
      .first<{ totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number }>() || {
        totalClicks: 0,
        totalImpressions: 0,
        avgCtr: 0,
        avgPosition: 0
      };

    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    // Timeline of daily points
    const timelineQuery = `
      SELECT 
        d.date,
        SUM(d.clicks) as clicks,
        SUM(d.impressions) as impressions,
        CASE 
          WHEN SUM(d.impressions) > 0 
          THEN ROUND(CAST(SUM(d.clicks) AS REAL) / CAST(SUM(d.impressions) AS REAL) * 100, 2)
          ELSE 0.0 
        END as ctr,
        ROUND(AVG(d.position), 1) as position
      FROM daily_metrics d
      JOIN properties p ON p.site_url = d.site_url
      WHERE d.date >= ? ${categoryFilter}
      GROUP BY d.date
      ORDER BY d.date ASC
    `;

    const { results: timeline } = await env.DB.prepare(timelineQuery)
      .bind(currentStart, ...params)
      .all<DailyMetric>();

    // Category breakdown
    const categoryBreakdownQuery = `
      SELECT 
        COALESCE(c.id, 'uncategorized') as categoryId,
        COALESCE(c.name, 'Uncategorized') as name,
        COALESCE(c.color, '#94a3b8') as color,
        SUM(d.clicks) as clicks,
        SUM(d.impressions) as impressions
      FROM properties p
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN daily_metrics d ON d.site_url = p.site_url
      WHERE d.date >= ?
      GROUP BY c.id, c.name, c.color
      ORDER BY clicks DESC
    `;

    const { results: categoryBreakdown } = await env.DB.prepare(categoryBreakdownQuery)
      .bind(currentStart)
      .all();

    return new Response(JSON.stringify({
      totalClicks: currentTotal.totalClicks,
      totalImpressions: currentTotal.totalImpressions,
      avgCtr: currentTotal.avgCtr,
      avgPosition: currentTotal.avgPosition,
      clicksChange: calcChange(currentTotal.totalClicks, prevTotal.totalClicks),
      impressionsChange: calcChange(currentTotal.totalImpressions, prevTotal.totalImpressions),
      ctrChange: Math.round((currentTotal.avgCtr - prevTotal.avgCtr) * 10) / 10,
      positionChange: Math.round((prevTotal.avgPosition - currentTotal.avgPosition) * 10) / 10, // lower position is better
      timeline: timeline || [],
      categoryBreakdown: categoryBreakdown || []
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
