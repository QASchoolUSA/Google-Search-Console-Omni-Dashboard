// Realistic mock dataset for instant exploration, benchmarking, and demo mode

export interface MockCategory {
  id: string;
  name: string;
  color: string;
  description: string;
  icon: string;
  site_count?: number;
}

export interface MockProperty {
  id: string;
  site_url: string;
  display_name: string;
  category_id: string;
  category_name: string;
  category_color: string;
  permission_level: string;
  last_synced_at: string;
  is_favorite: number;
  total_clicks_28d: number;
  total_impressions_28d: number;
  avg_ctr_28d: number;
  avg_position_28d: number;
}

export interface MockDailyMetric {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface MockQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  opportunity?: 'striking' | 'top3' | 'high_imp';
}

export interface MockPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export const INITIAL_CATEGORIES: MockCategory[] = [
  {
    id: 'cat-ecommerce',
    name: 'E-Commerce & Retail',
    color: '#06b6d4', // Cyan
    description: 'Online direct-to-consumer stores and retail shops',
    icon: 'shopping-cart'
  },
  {
    id: 'cat-saas',
    name: 'SaaS & Developer Tools',
    color: '#6366f1', // Indigo
    description: 'Cloud software, API services, and B2B tech products',
    icon: 'cpu'
  },
  {
    id: 'cat-media',
    name: 'Media & Authority Blogs',
    color: '#10b981', // Emerald
    description: 'Content sites, affiliate guides, and lifestyle blogs',
    icon: 'book-open'
  },
  {
    id: 'cat-clients',
    name: 'Client Portfolios',
    color: '#f59e0b', // Amber
    description: 'Retainer client websites and agency accounts',
    icon: 'briefcase'
  }
];

export const INITIAL_PROPERTIES: MockProperty[] = [
  {
    id: 'site-1',
    site_url: 'https://shopflow.io',
    display_name: 'shopflow.io',
    category_id: 'cat-ecommerce',
    category_name: 'E-Commerce & Retail',
    category_color: '#06b6d4',
    permission_level: 'siteOwner',
    last_synced_at: '12 mins ago',
    is_favorite: 1,
    total_clicks_28d: 48920,
    total_impressions_28d: 894100,
    avg_ctr_28d: 5.47,
    avg_position_28d: 8.4
  },
  {
    id: 'site-2',
    site_url: 'https://aurora-apparel.com',
    display_name: 'aurora-apparel.com',
    category_id: 'cat-ecommerce',
    category_name: 'E-Commerce & Retail',
    category_color: '#06b6d4',
    permission_level: 'siteOwner',
    last_synced_at: '25 mins ago',
    is_favorite: 0,
    total_clicks_28d: 31450,
    total_impressions_28d: 642000,
    avg_ctr_28d: 4.90,
    avg_position_28d: 11.2
  },
  {
    id: 'site-3',
    site_url: 'https://devtools.cloud',
    display_name: 'devtools.cloud',
    category_id: 'cat-saas',
    category_name: 'SaaS & Developer Tools',
    category_color: '#6366f1',
    permission_level: 'siteOwner',
    last_synced_at: '5 mins ago',
    is_favorite: 1,
    total_clicks_28d: 76800,
    total_impressions_28d: 1250000,
    avg_ctr_28d: 6.14,
    avg_position_28d: 6.8
  },
  {
    id: 'site-4',
    site_url: 'https://api-pulse.io',
    display_name: 'api-pulse.io',
    category_id: 'cat-saas',
    category_name: 'SaaS & Developer Tools',
    category_color: '#6366f1',
    permission_level: 'siteOwner',
    last_synced_at: '42 mins ago',
    is_favorite: 0,
    total_clicks_28d: 22100,
    total_impressions_28d: 410300,
    avg_ctr_28d: 5.39,
    avg_position_28d: 9.7
  },
  {
    id: 'site-5',
    site_url: 'https://nomadbackpacking.blog',
    display_name: 'nomadbackpacking.blog',
    category_id: 'cat-media',
    category_name: 'Media & Authority Blogs',
    category_color: '#10b981',
    permission_level: 'siteOwner',
    last_synced_at: '1 hour ago',
    is_favorite: 1,
    total_clicks_28d: 64500,
    total_impressions_28d: 1480000,
    avg_ctr_28d: 4.36,
    avg_position_28d: 12.6
  },
  {
    id: 'site-6',
    site_url: 'https://coffee-connoisseur.net',
    display_name: 'coffee-connoisseur.net',
    category_id: 'cat-media',
    category_name: 'Media & Authority Blogs',
    category_color: '#10b981',
    permission_level: 'siteOwner',
    last_synced_at: '2 hours ago',
    is_favorite: 0,
    total_clicks_28d: 18400,
    total_impressions_28d: 395000,
    avg_ctr_28d: 4.66,
    avg_position_28d: 13.9
  },
  {
    id: 'site-7',
    site_url: 'https://zenith-law.com',
    display_name: 'zenith-law.com',
    category_id: 'cat-clients',
    category_name: 'Client Portfolios',
    category_color: '#f59e0b',
    permission_level: 'siteFullUser',
    last_synced_at: '30 mins ago',
    is_favorite: 0,
    total_clicks_28d: 9640,
    total_impressions_28d: 168000,
    avg_ctr_28d: 5.74,
    avg_position_28d: 7.2
  },
  {
    id: 'site-8',
    site_url: 'https://apex-dental.clinic',
    display_name: 'apex-dental.clinic',
    category_id: 'cat-clients',
    category_name: 'Client Portfolios',
    category_color: '#f59e0b',
    permission_level: 'siteFullUser',
    last_synced_at: '4 hours ago',
    is_favorite: 0,
    total_clicks_28d: 6850,
    total_impressions_28d: 124000,
    avg_ctr_28d: 5.52,
    avg_position_28d: 8.9
  }
];

// Generates 90 days of realistic daily metrics with organic trends & seasonality
export function generateTimelineMetrics(
  days: number,
  baseClicks = 10000,
  baseImpressions = 180000,
  growthRate = 1.002
): MockDailyMetric[] {
  const result: MockDailyMetric[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Day of week seasonality: Monday-Thursday higher, weekend lower
    const dayOfWeek = d.getDay();
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.78 : 1.08;

    // Growth progression + random organic noise
    const progress = (days - i) / days;
    const trendMultiplier = Math.pow(growthRate, days - i);
    const noise = 0.92 + Math.random() * 0.16;

    const clicks = Math.round(baseClicks * trendMultiplier * weekendMultiplier * noise);
    const impressions = Math.round(baseImpressions * trendMultiplier * weekendMultiplier * (noise * 0.98));
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const position = Number((9.8 - progress * 1.6 + (Math.random() * 0.6 - 0.3)).toFixed(1));

    result.push({
      date: dateStr,
      clicks,
      impressions,
      ctr,
      position: Math.max(1, position)
    });
  }

  return result;
}

export const SAMPLE_QUERIES: MockQuery[] = [
  { query: 'best developer workflow tools 2026', clicks: 3840, impressions: 42100, ctr: 9.12, position: 2.1, opportunity: 'top3' },
  { query: 'cloudflare pages d1 sqlite tutorial', clicks: 2950, impressions: 38400, ctr: 7.68, position: 3.4, opportunity: 'top3' },
  { query: 'how to monitor multiple gsc websites', clicks: 2410, impressions: 49800, ctr: 4.84, position: 4.2 },
  { query: 'google search console bulk api limits', clicks: 1840, impressions: 68900, ctr: 2.67, position: 11.8, opportunity: 'striking' },
  { query: 'seo portfolio category tracking', clicks: 1720, impressions: 59300, ctr: 2.90, position: 12.4, opportunity: 'striking' },
  { query: 'ecommerce conversion rate benchmarks', clicks: 1650, impressions: 84200, ctr: 1.96, position: 14.1, opportunity: 'striking' },
  { query: 'solidjs canvas charts performance vs react', clicks: 1490, impressions: 21300, ctr: 7.00, position: 2.8, opportunity: 'top3' },
  { query: 'best lightweight backpacks for international travel', clicks: 1380, impressions: 94000, ctr: 1.47, position: 16.2, opportunity: 'high_imp' },
  { query: 'specialty pour over coffee grind size', clicks: 1210, impressions: 28400, ctr: 4.26, position: 5.6 },
  { query: 'enterprise api latency monitoring architecture', clicks: 1150, impressions: 19800, ctr: 5.81, position: 4.9 },
  { query: 'cloudflare edge serverless sqlite pricing', clicks: 980, impressions: 44100, ctr: 2.22, position: 13.5, opportunity: 'striking' },
  { query: 'commercial law firm retainer agreement template', clicks: 820, impressions: 12900, ctr: 6.36, position: 3.1, opportunity: 'top3' }
];

export const SAMPLE_PAGES: MockPage[] = [
  { page: 'https://devtools.cloud/guides/gsc-bulk-api-export', clicks: 8420, impressions: 112000, ctr: 7.52, position: 3.2 },
  { page: 'https://shopflow.io/products/checkout-accelerator', clicks: 7690, impressions: 98400, ctr: 7.81, position: 2.9 },
  { page: 'https://nomadbackpacking.blog/gear/ultralight-guide', clicks: 6850, impressions: 145000, ctr: 4.72, position: 6.4 },
  { page: 'https://devtools.cloud/docs/d1-database-integration', clicks: 5410, impressions: 72400, ctr: 7.47, position: 3.8 },
  { page: 'https://aurora-apparel.com/collections/sustainable-linen', clicks: 4920, impressions: 89000, ctr: 5.53, position: 5.1 },
  { page: 'https://api-pulse.io/benchmarks/global-latency-2026', clicks: 4210, impressions: 65100, ctr: 6.47, position: 4.3 },
  { page: 'https://zenith-law.com/services/corporate-mergers', clicks: 2840, impressions: 38200, ctr: 7.43, position: 2.7 }
];

export const DEVICE_SPLIT = [
  { device: 'Mobile', clicks: 161800, impressions: 2950000, percentage: 58.2 },
  { device: 'Desktop', clicks: 104500, impressions: 1880000, percentage: 37.6 },
  { device: 'Tablet', clicks: 11800, impressions: 215000, percentage: 4.2 }
];

export const COUNTRY_SPLIT = [
  { country: 'United States', flag: '🇺🇸', clicks: 128400, impressions: 2140000, pct: 46.2 },
  { country: 'United Kingdom', flag: '🇬🇧', clicks: 39500, impressions: 680000, pct: 14.2 },
  { country: 'Germany', flag: '🇩🇪', clicks: 28100, impressions: 510000, pct: 10.1 },
  { country: 'Canada', flag: '🇨🇦', clicks: 24600, impressions: 430000, pct: 8.8 },
  { country: 'Australia', flag: '🇦🇺', clicks: 19800, impressions: 350000, pct: 7.1 },
  { country: 'France', flag: '🇫🇷', clicks: 14200, impressions: 280000, pct: 5.1 },
  { country: 'Others', flag: '🌐', clicks: 23500, impressions: 455000, pct: 8.5 }
];
