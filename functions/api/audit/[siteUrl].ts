import { Env } from '../../types';
import { getSession } from '../../utils/google';

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const rawSiteUrl = params.siteUrl as string;
    const siteUrl = decodeURIComponent(rawSiteUrl);
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28', 10);

    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const encodedSite = encodeURIComponent(siteUrl);

    // 1. Fetch live metrics directly from Google Search Console API
    const liveRes = await fetch(
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

    if (!liveRes.ok) {
      const errText = await liveRes.text();
      return new Response(JSON.stringify({ error: `GSC Live API Error: ${errText}` }), {
        status: liveRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const liveData = await liveRes.json() as { rows?: GSCRow[] };
    const liveRows = liveData.rows || [];

    // 2. Fetch stored metrics from Cloudflare D1 database for the exact same date range
    const { results: dbRows } = await env.DB.prepare(`
      SELECT date, clicks, impressions, ctr, position
      FROM daily_metrics
      WHERE site_url = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(siteUrl, startDate, endDate).all<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>();

    const dbMap = new Map((dbRows || []).map(r => [r.date, r]));

    // 3. Compute day-by-day comparison
    let liveTotalClicks = 0;
    let liveTotalImpressions = 0;
    let liveWeightedPosSum = 0;

    let dbTotalClicks = 0;
    let dbTotalImpressions = 0;
    let dbWeightedPosSum = 0;

    const auditDays = liveRows.map(live => {
      const date = live.keys[0];
      const db = dbMap.get(date);

      const lClicks = live.clicks;
      const lImp = live.impressions;
      const lCtr = Number((live.ctr * 100).toFixed(2));
      const lPos = Number(live.position.toFixed(1));

      const dClicks = db?.clicks || 0;
      const dImp = db?.impressions || 0;
      const dCtr = db?.ctr || 0;
      const dPos = db?.position || 0;

      liveTotalClicks += lClicks;
      liveTotalImpressions += lImp;
      liveWeightedPosSum += lPos * lImp;

      dbTotalClicks += dClicks;
      dbTotalImpressions += dImp;
      dbWeightedPosSum += dPos * dImp;

      return {
        date,
        live: { clicks: lClicks, impressions: lImp, ctr: lCtr, position: lPos },
        db: { clicks: dClicks, impressions: dImp, ctr: dCtr, position: dPos },
        clicksDiff: dClicks - lClicks,
        impressionsDiff: dImp - lImp,
        isPerfectMatch: dClicks === lClicks && dImp === lImp
      };
    });

    const liveAvgCtr = liveTotalImpressions > 0 ? Number(((liveTotalClicks / liveTotalImpressions) * 100).toFixed(2)) : 0;
    const dbAvgCtr = dbTotalImpressions > 0 ? Number(((dbTotalClicks / dbTotalImpressions) * 100).toFixed(2)) : 0;

    const liveAvgPos = liveTotalImpressions > 0 ? Number((liveWeightedPosSum / liveTotalImpressions).toFixed(1)) : 0;
    const dbAvgPos = dbTotalImpressions > 0 ? Number((dbWeightedPosSum / dbTotalImpressions).toFixed(1)) : 0;

    const matchedDays = auditDays.filter(d => d.isPerfectMatch).length;
    const parityScore = auditDays.length > 0 ? Math.round((matchedDays / auditDays.length) * 100) : 100;

    return new Response(JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      totalDaysAudited: auditDays.length,
      parityScore,
      summary: {
        clicks: { live: liveTotalClicks, db: dbTotalClicks, diff: dbTotalClicks - liveTotalClicks },
        impressions: { live: liveTotalImpressions, db: dbTotalImpressions, diff: dbTotalImpressions - liveTotalImpressions },
        ctr: { live: liveAvgCtr, db: dbAvgCtr, diff: Number((dbAvgCtr - liveAvgCtr).toFixed(2)) },
        position: { live: liveAvgPos, db: dbAvgPos, diff: Number((dbAvgPos - liveAvgPos).toFixed(1)) }
      },
      auditDays
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
