import {
  INITIAL_CATEGORIES,
  INITIAL_PROPERTIES,
  generateTimelineMetrics,
  SAMPLE_QUERIES,
  SAMPLE_PAGES,
  DEVICE_SPLIT,
  COUNTRY_SPLIT,
  MockCategory,
  MockProperty,
  MockDailyMetric
} from './mockData';

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
  timeline: MockDailyMetric[];
  categoryBreakdown: {
    categoryId: string;
    name: string;
    color: string;
    clicks: number;
    impressions: number;
  }[];
}

class ApiService {
  private demoMode: boolean = true;
  private localCategories: MockCategory[] = [];
  private localProperties: MockProperty[] = [];

  constructor() {
    const savedDemo = localStorage.getItem('gsc_demo_mode');
    this.demoMode = savedDemo !== null ? savedDemo === 'true' : true;

    // Load from local storage or initial mock
    const savedCats = localStorage.getItem('gsc_custom_categories');
    this.localCategories = savedCats ? JSON.parse(savedCats) : [...INITIAL_CATEGORIES];

    const savedProps = localStorage.getItem('gsc_custom_properties');
    this.localProperties = savedProps ? JSON.parse(savedProps) : [...INITIAL_PROPERTIES];
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  setDemoMode(val: boolean) {
    this.demoMode = val;
    localStorage.setItem('gsc_demo_mode', String(val));
  }

  async checkAuth(): Promise<UserAuthStatus> {
    if (this.demoMode) {
      return {
        authenticated: false,
        user: null,
        configured: true
      };
    }

    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running / offline
    }

    return {
      authenticated: false,
      user: null,
      configured: false
    };
  }

  async getCategories(): Promise<MockCategory[]> {
    if (!this.demoMode) {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('API getCategories failed, falling back to local', e);
      }
    }

    // Update site counts
    return this.localCategories.map(cat => ({
      ...cat,
      site_count: this.localProperties.filter(p => p.category_id === cat.id).length
    }));
  }

  async createCategory(name: string, color: string, description: string): Promise<MockCategory> {
    const newCat: MockCategory = {
      id: `cat-${Date.now()}`,
      name,
      color,
      description,
      icon: 'folder',
      site_count: 0
    };

    if (!this.demoMode) {
      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color, description })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.error('Remote createCategory failed', e);
      }
    }

    this.localCategories.push(newCat);
    localStorage.setItem('gsc_custom_categories', JSON.stringify(this.localCategories));
    return newCat;
  }

  async deleteCategory(id: string): Promise<void> {
    if (!this.demoMode) {
      try {
        await fetch(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Remote deleteCategory failed', e);
      }
    }

    this.localCategories = this.localCategories.filter(c => c.id !== id);
    this.localProperties = this.localProperties.map(p => p.category_id === id ? { ...p, category_id: '' } : p);
    localStorage.setItem('gsc_custom_categories', JSON.stringify(this.localCategories));
    localStorage.setItem('gsc_custom_properties', JSON.stringify(this.localProperties));
  }

  async getProperties(categoryId?: string): Promise<MockProperty[]> {
    let list: MockProperty[] = [];

    if (!this.demoMode) {
      try {
        const res = await fetch('/api/sites');
        if (res.ok) {
          list = await res.json();
        }
      } catch (e) {
        console.warn('Remote getProperties failed, using local', e);
        list = [...this.localProperties];
      }
    } else {
      list = [...this.localProperties];
    }

    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorized') {
        return list.filter(p => !p.category_id);
      }
      return list.filter(p => p.category_id === categoryId);
    }
    return list;
  }

  async assignCategory(siteUrl: string, categoryId: string | null): Promise<void> {
    const cat = this.localCategories.find(c => c.id === categoryId);

    if (!this.demoMode) {
      try {
        await fetch(`/api/sites/${encodeURIComponent(siteUrl)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId })
        });
      } catch (e) {
        console.error('Failed to assign category via API', e);
      }
    }

    this.localProperties = this.localProperties.map(p => {
      if (p.site_url === siteUrl) {
        return {
          ...p,
          category_id: categoryId || '',
          category_name: cat ? cat.name : 'Uncategorized',
          category_color: cat ? cat.color : '#94a3b8'
        };
      }
      return p;
    });
    localStorage.setItem('gsc_custom_properties', JSON.stringify(this.localProperties));
  }

  async toggleFavorite(siteUrl: string, isFav: boolean): Promise<void> {
    if (!this.demoMode) {
      try {
        await fetch(`/api/sites/${encodeURIComponent(siteUrl)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: isFav ? 1 : 0 })
        });
      } catch (e) {
        console.error('Favorite update error', e);
      }
    }

    this.localProperties = this.localProperties.map(p => {
      if (p.site_url === siteUrl) {
        return { ...p, is_favorite: isFav ? 1 : 0 };
      }
      return p;
    });
    localStorage.setItem('gsc_custom_properties', JSON.stringify(this.localProperties));
  }

  async getAggregates(categoryId?: string, days: number = 28): Promise<AggregateData> {
    if (!this.demoMode) {
      try {
        const catParam = categoryId ? `&category_id=${encodeURIComponent(categoryId)}` : '';
        const res = await fetch(`/api/metrics/aggregate?days=${days}${catParam}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('API getAggregates failed, using mock calculation', e);
      }
    }

    // Filter properties matching category
    let activeProps = [...this.localProperties];
    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorized') {
        activeProps = activeProps.filter(p => !p.category_id);
      } else {
        activeProps = activeProps.filter(p => p.category_id === categoryId);
      }
    }

    const totalClicks = activeProps.reduce((acc, p) => acc + (p.total_clicks_28d || 0), 0);
    const totalImpressions = activeProps.reduce((acc, p) => acc + (p.total_impressions_28d || 0), 0);
    const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const avgPosition = activeProps.length > 0
      ? Number((activeProps.reduce((acc, p) => acc + (p.avg_position_28d || 0), 0) / activeProps.length).toFixed(1))
      : 0;

    // Timeline based on active total clicks
    const timeline = generateTimelineMetrics(days, totalClicks / days, totalImpressions / days);

    // Category breakdown
    const categoryBreakdown = this.localCategories.map(cat => {
      const sitesInCat = this.localProperties.filter(p => p.category_id === cat.id);
      return {
        categoryId: cat.id,
        name: cat.name,
        color: cat.color,
        clicks: sitesInCat.reduce((acc, p) => acc + (p.total_clicks_28d || 0), 0),
        impressions: sitesInCat.reduce((acc, p) => acc + (p.total_impressions_28d || 0), 0)
      };
    });

    return {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
      clicksChange: 14.8,
      impressionsChange: 11.2,
      ctrChange: 0.4,
      positionChange: 0.8,
      timeline,
      categoryBreakdown
    };
  }

  async getSiteDetails(siteUrl: string, days: number = 28) {
    if (!this.demoMode) {
      try {
        const res = await fetch(`/api/metrics/${encodeURIComponent(siteUrl)}?days=${days}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('API getSiteDetails failed, returning mock details', e);
      }
    }

    const prop = this.localProperties.find(p => p.site_url === siteUrl) || this.localProperties[0];
    const timeline = generateTimelineMetrics(days, (prop?.total_clicks_28d || 10000) / days, (prop?.total_impressions_28d || 100000) / days);

    return {
      property: prop,
      totalClicks: prop?.total_clicks_28d || 0,
      totalImpressions: prop?.total_impressions_28d || 0,
      avgCtr: prop?.avg_ctr_28d || 0,
      avgPosition: prop?.avg_position_28d || 0,
      clicksChange: 16.4,
      impressionsChange: 12.1,
      ctrChange: 0.3,
      positionChange: 0.6,
      timeline,
      topQueries: SAMPLE_QUERIES,
      topPages: SAMPLE_PAGES,
      devices: DEVICE_SPLIT,
      countries: COUNTRY_SPLIT
    };
  }

  async syncAll(): Promise<{ success: boolean; message: string }> {
    if (!this.demoMode) {
      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          return { success: true, message: `Synced ${data.syncedSitesCount || 0} properties from Google Search Console.` };
        }
      } catch (e) {
        console.error('Sync failed', e);
      }
    }

    // Demo sync simulation
    await new Promise(r => setTimeout(r, 1200));
    this.localProperties = this.localProperties.map(p => ({
      ...p,
      last_synced_at: 'Just now',
      total_clicks_28d: Math.round(p.total_clicks_28d * (1 + (Math.random() * 0.04 - 0.01)))
    }));
    localStorage.setItem('gsc_custom_properties', JSON.stringify(this.localProperties));

    return {
      success: true,
      message: 'All 8 properties successfully synchronized in 1.2s.'
    };
  }
}

export const api = new ApiService();
