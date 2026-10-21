// Core Application TypeScript Interfaces

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  site_count?: number;
}

export type IndexTrendWindow = 3 | 7 | 14 | 30 | 60;

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

export interface SiteProperty {
  id: string;
  site_url: string;
  display_name: string;
  category_id?: string | null;
  category_name?: string;
  category_color?: string;
  permission_level: string;
  last_synced_at?: string | null;
  is_favorite: number;
  total_pages?: number;
  total_clicks_28d?: number;
  total_impressions_28d?: number;
  avg_ctr_28d?: number;
  avg_position_28d?: number;
  indexed_pages?: number;
  indexed_as_of?: string | null;
  indexed_truncated?: number;
  indexed_change_3d?: number | null;
  indexed_change_7d?: number | null;
  indexed_change_14d?: number | null;
  indexed_change_30d?: number | null;
  indexed_change_60d?: number | null;
  indexed_trends?: IndexTrendPoint[];
}

export interface DailyMetric {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type GenAiIntentType = 'informational' | 'how_to' | 'comparative' | 'conversational' | 'standard';

export interface QueryMetric {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  opportunity?: 'striking' | 'top3' | 'high_imp';
  aiIntent?: GenAiIntentType;
  citationLikelihood?: 'prime' | 'high' | 'opportunity' | 'low';
}

export interface GenAiQueryMetric extends QueryMetric {
  aiIntent: GenAiIntentType;
  citationLikelihood: 'prime' | 'high' | 'opportunity' | 'low';
}

export interface GenerativeAiMetrics {
  aiClicks: number;
  aiImpressions: number;
  aiCtr: number;
  aiAvgPosition: number;
  aiShareOfClicks: number;
  aiShareOfImpressions: number;
  readinessScore: number;
  intentBreakdown: {
    intent: GenAiIntentType;
    label: string;
    clicks: number;
    impressions: number;
    queryCount: number;
  }[];
  topAiQueries: GenAiQueryMetric[];
}

export interface PageMetric {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DeviceMetric {
  device: string;
  clicks: number;
  impressions: number;
  percentage?: number;
}

export interface CountryMetric {
  country: string;
  clicks: number;
  impressions: number;
  percentage?: number;
}

export interface UserAuthStatus {
  authenticated: boolean;
  user: {
    email: string;
    name: string;
    picture?: string;
  } | null;
  configured: boolean;
}

export interface AggregateData {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  clicksChange: number;
  impressionsChange: number;
  ctrChange: number;
  positionChange: number;
  startDate?: string;
  endDate?: string;
  timeline: DailyMetric[];
  categoryBreakdown: {
    categoryId: string;
    name: string;
    color: string;
    clicks: number;
    impressions: number;
  }[];
  devices?: DeviceMetric[];
  countries?: CountryMetric[];
  strikingQueries?: QueryMetric[];
  aiMetrics?: GenerativeAiMetrics;
}

export interface AuditResult {
  siteUrl: string;
  startDate: string;
  endDate: string;
  totalDaysAudited: number;
  parityScore: number;
  summary: {
    clicks: { live: number; db: number; diff: number };
    impressions: { live: number; db: number; diff: number };
    ctr: { live: number; db: number; diff: number };
    position: { live: number; db: number; diff: number };
    duplicateDatesCount?: number;
    missingDatesCount?: number;
  };
  auditDays: {
    date: string;
    live: { clicks: number; impressions: number; ctr: number; position: number };
    db: { clicks: number; impressions: number; ctr: number; position: number };
    clicksDiff: number;
    impressionsDiff: number;
    isPerfectMatch: boolean;
  }[];
}

export interface SiteDetailsResponse {
  property: SiteProperty;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  clicksChange: number;
  impressionsChange: number;
  ctrChange: number;
  positionChange: number;
  startDate: string;
  endDate: string;
  timeline: DailyMetric[];
  topQueries: QueryMetric[];
  topPages: PageMetric[];
  aiMetrics?: GenerativeAiMetrics;
  indexStats?: SiteIndexStats;
}

export interface IndexingPortfolioResponse {
  windowDays: number;
  trendWindows: IndexTrendWindow[];
  totalIndexedPages: number;
  totalAllPages: number;
  overallIndexRatio: number;
  siteCount: number;
  sites: {
    site_url: string;
    display_name: string;
    indexed_pages: number;
    total_pages: number;
    index_ratio: number;
    as_of_date: string | null;
    is_truncated: boolean;
    trends: Record<string, {
      change: number | null;
      changePct: number | null;
      previousCount: number | null;
      previousDate: string | null;
    }>;
    timeline: { date: string; page_count: number; total_pages?: number }[];
  }[];
}
