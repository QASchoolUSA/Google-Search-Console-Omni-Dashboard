/** Indexed-pages helpers: GSC unique pages with impressions as visibility proxy. */

export const INDEX_WINDOW_DAYS = 28;
export const INDEX_HISTORY_DAYS = 60;
export const INDEX_TREND_WINDOWS = [3, 7, 14, 30, 60] as const;
export type IndexTrendWindow = (typeof INDEX_TREND_WINDOWS)[number];

export interface IndexSnapshotRow {
  date: string;
  page_count: number;
  total_pages?: number;
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
  totalPages: number;
  indexRatio: number;
  asOfDate: string | null;
  windowDays: number;
  isTruncated: boolean;
  trends: IndexTrendPoint[];
  timeline: { date: string; page_count: number; total_pages?: number }[];
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
  windowDays: number = INDEX_WINDOW_DAYS,
  fallbackTotalPages: number = 0,
  fallbackIndexedPages: number = 0
): SiteIndexStats {
  if (!snapshots.length) {
    const currentCount = Math.max(0, fallbackIndexedPages);
    const totalPages = Math.max(0, fallbackTotalPages, currentCount);
    const indexRatio = totalPages > 0 ? Math.round((currentCount / totalPages) * 1000) / 10 : (currentCount > 0 ? 100 : 0);
    return {
      currentCount,
      totalPages,
      indexRatio,
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

  const currentCount = Math.max(latest.page_count, fallbackIndexedPages);
  const snapshotTotal = Number(latest.total_pages || 0);
  const totalPages = Math.max(snapshotTotal, fallbackTotalPages, currentCount);
  const indexRatio = totalPages > 0 ? Math.round((currentCount / totalPages) * 1000) / 10 : (currentCount > 0 ? 100 : 0);

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
    currentCount,
    totalPages,
    indexRatio,
    asOfDate: latest.date,
    windowDays,
    isTruncated: Boolean(latest.is_truncated),
    trends,
    timeline: sorted.map((s) => ({
      date: s.date,
      page_count: s.page_count,
      total_pages: s.total_pages
    }))
  };
}

/**
 * Fetch total submitted pages from GSC Sitemaps API
 */
export async function fetchSiteTotalPagesFromGsc(
  accessToken: string,
  siteUrl: string
): Promise<{ totalSubmitted: number; sitemapsCount: number }> {
  const encodedSite = encodeURIComponent(siteUrl);
  try {
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return { totalSubmitted: 0, sitemapsCount: 0 };
    }

    const data = (await res.json()) as {
      sitemap?: Array<{
        path: string;
        isSitemapsIndex?: boolean;
        contents?: Array<{
          type?: string;
          submitted?: string | number;
          indexed?: string | number;
        }>;
      }>;
    };

    const sitemaps = data.sitemap || [];
    let totalSubmitted = 0;

    for (const sm of sitemaps) {
      let foundInSm = 0;
      if (sm.contents && sm.contents.length > 0) {
        for (const c of sm.contents) {
          const sub = Number(c.submitted || 0);
          if (!isNaN(sub) && sub > 0) {
            foundInSm += sub;
          }
        }
      }

      // If contents array was omitted in list view, fetch specific sitemap details via sitemaps.get
      if (foundInSm === 0 && !sm.isSitemapsIndex && sm.path) {
        try {
          const detailRes = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps/${encodeURIComponent(sm.path)}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (detailRes.ok) {
            const detailData = (await detailRes.json()) as {
              contents?: Array<{ submitted?: string | number }>;
            };
            for (const c of detailData.contents || []) {
              const sub = Number(c.submitted || 0);
              if (!isNaN(sub) && sub > 0) {
                foundInSm += sub;
              }
            }
          }
        } catch {}
      }

      if (sm.isSitemapsIndex) {
        try {
          const childRes = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps?sitemapIndex=${encodeURIComponent(sm.path)}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (childRes.ok) {
            const childData = (await childRes.json()) as {
              sitemap?: Array<{
                contents?: Array<{ submitted?: string | number }>;
              }>;
            };
            for (const childSm of childData.sitemap || []) {
              for (const c of childSm.contents || []) {
                const sub = Number(c.submitted || 0);
                if (!isNaN(sub) && sub > 0) {
                  foundInSm += sub;
                }
              }
            }
          }
        } catch {
          // Ignore child sitemap errors
        }
      }

      totalSubmitted += foundInSm;
    }

    return { totalSubmitted, sitemapsCount: sitemaps.length };
  } catch {
    return { totalSubmitted: 0, sitemapsCount: 0 };
  }
}

/**
 * Query GSC Search Analytics over the full 16-month window (480 days) for all unique pages ever served.
 * Used as high-fidelity fallback when no sitemaps are submitted in GSC.
 */
export async function fetchHistoricalUniquePageCount(
  accessToken: string,
  siteUrl: string,
  endDate?: string
): Promise<number> {
  const encodedSite = encodeURIComponent(siteUrl);
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = shiftDate(end, -480);

  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ['page'],
          type: 'web',
          aggregationType: 'byPage',
          dataState: 'all',
          rowLimit: 25000
        })
      }
    );

    if (!res.ok) return 0;
    const data = (await res.json()) as { rows?: Array<{ keys: string[] }> };
    return data.rows ? data.rows.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Fallback: lightweight direct fetch of website's public sitemap.xml to count URLs.
 * Checks root domain, WordPress core (/wp-sitemap.xml), index sitemaps (/sitemap_index.xml),
 * www/non-www alternate, and robots.txt Sitemap: directives.
 */
export async function fetchDirectSitemapUrlCount(siteUrl: string): Promise<number> {
  const parseSitemapXml = async (xmlText: string): Promise<number> => {
    // 1. Check for <url> tags inside standard <urlset>
    const urlMatches = xmlText.match(/<url\b[^>]*>/gi);
    if (urlMatches && urlMatches.length > 0) {
      return urlMatches.length;
    }

    // 2. Check for <sitemap> in index sitemaps
    const sitemapMatches = xmlText.match(/<sitemap\b[^>]*>/gi);
    if (sitemapMatches && sitemapMatches.length > 0) {
      const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
      let match;
      let total = 0;
      let childCount = 0;
      while ((match = locRegex.exec(xmlText)) !== null && childCount < 5) {
        childCount++;
        try {
          const childRes = await fetch(match[1], {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GSC-Dashboard/1.0)' }
          });
          if (childRes.ok) {
            const childTxt = await childRes.text();
            const childUrls = childTxt.match(/<url\b[^>]*>/gi);
            if (childUrls) total += childUrls.length;
          }
        } catch {}
      }
      if (total > 0) return total;
    }

    return 0;
  };

  try {
    let cleanUrl = siteUrl;
    if (cleanUrl.startsWith('sc-domain:')) {
      cleanUrl = `https://${cleanUrl.replace('sc-domain:', '')}`;
    }
    cleanUrl = cleanUrl.replace(/\/+$/, '');

    const candidatePaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/wp-sitemap.xml',
      '/sitemap/'
    ];

    const hostnames = [cleanUrl];
    // Try www alternate
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.hostname.startsWith('www.')) {
        hostnames.push(`${parsed.protocol}//${parsed.hostname.slice(4)}`);
      } else {
        hostnames.push(`${parsed.protocol}//www.${parsed.hostname}`);
      }
    } catch {}

    const candidates: string[] = [];
    for (const host of hostnames) {
      for (const p of candidatePaths) {
        candidates.push(`${host}${p}`);
      }
    }

    for (const url of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GSC-Dashboard/1.0)' }
        });
        clearTimeout(timeout);
        if (res.ok) {
          const text = await res.text();
          const count = await parseSitemapXml(text);
          if (count > 0) return count;
        }
      } catch {}
    }

    // Try robots.txt for Sitemap declaration
    try {
      const robotsUrl = `${cleanUrl}/robots.txt`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const robotsRes = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GSC-Dashboard/1.0)' }
      });
      clearTimeout(timeout);
      if (robotsRes.ok) {
        const robotsTxt = await robotsRes.text();
        const sitemapDirective = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s\r\n]+)/i);
        if (sitemapDirective && sitemapDirective[1]) {
          const sRes = await fetch(sitemapDirective[1].trim(), {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GSC-Dashboard/1.0)' }
          });
          if (sRes.ok) {
            const xml = await sRes.text();
            const count = await parseSitemapXml(xml);
            if (count > 0) return count;
          }
        }
      }
    } catch {}

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Multi-tier total page discovery: GSC Sitemaps → Direct XML Probe → 16-Month Historical → Local DB.
 * Guarantees every site gets a comprehensive, non-zero total page count whenever pages exist.
 */
export async function discoverSiteTotalPages(
  accessToken: string,
  siteUrl: string,
  latestDate: string,
  dbCount: number = 0
): Promise<{ totalPages: number; source: string }> {
  // 1. Try GSC Sitemaps API
  let totalSubmitted = 0;
  try {
    const gscSm = await fetchSiteTotalPagesFromGsc(accessToken, siteUrl);
    totalSubmitted = gscSm.totalSubmitted;
  } catch {}

  if (totalSubmitted > 0) {
    return { totalPages: Math.max(totalSubmitted, dbCount), source: 'gsc_sitemaps' };
  }

  // 2. Try direct XML sitemap probe
  let directCount = 0;
  try {
    directCount = await fetchDirectSitemapUrlCount(siteUrl);
  } catch {}

  if (directCount > 0) {
    return { totalPages: Math.max(directCount, dbCount), source: 'direct_sitemap' };
  }

  // 3. Try GSC 16-month Search Analytics unique pages
  let historicalPages = 0;
  try {
    historicalPages = await fetchHistoricalUniquePageCount(accessToken, siteUrl, latestDate);
  } catch {}

  if (historicalPages > 0) {
    return { totalPages: Math.max(historicalPages, dbCount), source: 'gsc_historical' };
  }

  // 4. Fallback to local DB count
  return { totalPages: dbCount, source: 'local_database' };
}
