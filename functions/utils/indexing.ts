/** Indexed-pages helpers: GSC unique pages with impressions as visibility proxy. */

export const INDEX_WINDOW_DAYS = 28;
export const INDEX_HISTORY_DAYS = 60;
export const INDEX_TREND_WINDOWS = [3, 7, 14, 30, 60] as const;
export type IndexTrendWindow = (typeof INDEX_TREND_WINDOWS)[number];

export interface IndexSnapshotRow {
  date: string;
  page_count: number;
  window_days?: number;
  is_truncated?: number;
}

export interface IndexTrendPoint {
  days: IndexTrendWindow;
  previousCount: number | null;
  change: number | null;
  changePct: number | null;
  previousDate: string | null;
}

export interface SiteIndexStats {
  currentCount: number;
  asOfDate: string | null;
  windowDays: number;
  isTruncated: boolean;
  trends: IndexTrendPoint[];
  timeline: { date: string; page_count: number }[];
}

interface GSCPageRow {
  keys: string[];
  clicks: number;
  impressions: number;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function shiftDate(dateStr: string, dayDelta: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return toDateStr(d);
}

export function windowStart(endDate: string, windowDays: number = INDEX_WINDOW_DAYS): string {
  return shiftDate(endDate, -(windowDays - 1));
}

export function calcChange(current: number, previous: number | null | undefined): {
  change: number | null;
  changePct: number | null;
} {
  if (previous === null || previous === undefined) {
    return { change: null, changePct: null };
  }
  const change = current - previous;
  if (previous === 0) {
    return { change, changePct: current > 0 ? 100 : 0 };
  }
  return {
    change,
    changePct: Math.round(((current - previous) / previous) * 1000) / 10
  };
}

/**
 * Count unique pages with impressions via Search Analytics (paginated).
 * GSC may truncate to top rows — returns isTruncated when a full page of results was returned.
 */
export async function countUniquePagesWithImpressions(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  maxPages: number = 2
): Promise<{ count: number; isTruncated: boolean }> {
  const encodedSite = encodeURIComponent(siteUrl);
  const rowLimit = 25000;
  let startRow = 0;
  let total = 0;
  let isTruncated = false;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['page'],
          type: 'web',
          aggregationType: 'byPage',
          dataState: 'all',
          rowLimit,
          startRow
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GSC page-count query failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { rows?: GSCPageRow[] };
    const rows = data.rows || [];
    total += rows.length;

    if (rows.length < rowLimit) {
      return { count: total, isTruncated };
    }

    // Full page returned — either continue or mark truncated
    if (page === maxPages - 1) {
      isTruncated = true;
      return { count: total, isTruncated };
    }
    startRow += rowLimit;
  }

  return { count: total, isTruncated };
}

/** Dates we must keep fresh for trend windows + a short recent chart trail. */
export function selectSnapshotDatesToFetch(
  latestDate: string,
  existingDates: Set<string>,
  historyDays: number = INDEX_HISTORY_DAYS,
  maxFetches: number = 12
): string[] {
  const wanted = new Set<string>();

  // Always refresh the latest few days (GSC revises fresh data)
  for (let i = 0; i < 3; i++) {
    wanted.add(shiftDate(latestDate, -i));
  }

  // Trend anchors
  for (const days of INDEX_TREND_WINDOWS) {
    wanted.add(shiftDate(latestDate, -days));
  }

  // Fill recent trail for chart (newest first)
  for (let i = 0; i < Math.min(14, historyDays); i++) {
    wanted.add(shiftDate(latestDate, -i));
  }

  // Any other missing dates in the history window (lower priority)
  const missingExtras: string[] = [];
  for (let i = 0; i < historyDays; i++) {
    const d = shiftDate(latestDate, -i);
    if (!wanted.has(d) && !existingDates.has(d)) {
      missingExtras.push(d);
    }
  }

  const prioritized = [...wanted].sort((a, b) => b.localeCompare(a));
  const result: string[] = [];

  for (const d of prioritized) {
    // Always re-fetch last 3 days; otherwise only if missing
    const age = Math.round(
      (new Date(latestDate + 'T12:00:00Z').getTime() - new Date(d + 'T12:00:00Z').getTime()) /
        (24 * 60 * 60 * 1000)
    );
    if (age <= 2 || !existingDates.has(d)) {
      result.push(d);
    }
    if (result.length >= maxFetches) return result;
  }

  for (const d of missingExtras) {
    if (result.length >= maxFetches) break;
    result.push(d);
  }

  return result;
}

export function buildSiteIndexStats(
  snapshots: IndexSnapshotRow[],
  windowDays: number = INDEX_WINDOW_DAYS
): SiteIndexStats {
  if (!snapshots.length) {
    return {
      currentCount: 0,
      asOfDate: null,
      windowDays,
      isTruncated: false,
      trends: INDEX_TREND_WINDOWS.map((days) => ({
        days,
        previousCount: null,
        change: null,
        changePct: null,
        previousDate: null
      })),
      timeline: []
    };
  }

  const byDate = new Map<string, IndexSnapshotRow>();
  for (const s of snapshots) {
    byDate.set(s.date, s);
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  const trends: IndexTrendPoint[] = INDEX_TREND_WINDOWS.map((days) => {
    const prevDate = shiftDate(latest.date, -days);
    // Prefer exact date; fall back to nearest earlier snapshot within 2 days
    let prev = byDate.get(prevDate) || null;
    if (!prev) {
      for (let i = 1; i <= 2 && !prev; i++) {
        prev = byDate.get(shiftDate(prevDate, -i)) || byDate.get(shiftDate(prevDate, i)) || null;
      }
    }
    const { change, changePct } = calcChange(latest.page_count, prev?.page_count ?? null);
    return {
      days,
      previousCount: prev?.page_count ?? null,
      change,
      changePct,
      previousDate: prev?.date ?? null
    };
  });

  return {
    currentCount: latest.page_count,
    asOfDate: latest.date,
    windowDays,
    isTruncated: Boolean(latest.is_truncated),
    trends,
    timeline: sorted.map((s) => ({ date: s.date, page_count: s.page_count }))
  };
}
