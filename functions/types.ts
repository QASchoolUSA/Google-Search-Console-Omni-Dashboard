// Types for Cloudflare Pages Functions and D1 bindings

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  REDIRECT_URI?: string;
  ENVIRONMENT?: string;
}

export interface UserSession {
  id: string;
  user_email: string;
  user_name?: string;
  user_picture?: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

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
  category_id: string | null;
  category_name?: string;
  category_color?: string;
  permission_level: string;
  last_synced_at: string | null;
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

export interface AggregateSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  clicksChange: number; // percentage change vs previous period
  impressionsChange: number;
  ctrChange: number;
  positionChange: number;
  timeline: DailyMetric[];
  deviceBreakdown?: { device: string; clicks: number; impressions: number }[];
  countryBreakdown?: { country: string; clicks: number; impressions: number }[];
  categoryBreakdown?: { categoryId: string; name: string; color: string; clicks: number; impressions: number }[];
  aiMetrics?: GenerativeAiMetrics;
}
