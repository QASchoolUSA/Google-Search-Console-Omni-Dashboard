// Core Application TypeScript Interfaces

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  site_count?: number;
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
  total_clicks_28d?: number;
  total_impressions_28d?: number;
  avg_ctr_28d?: number;
  avg_position_28d?: number;
}

export interface DailyMetric {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface QueryMetric {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  opportunity?: 'striking' | 'top3' | 'high_imp';
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
