import { 
  Category, 
  SiteProperty, 
  UserAuthStatus, 
  AggregateData, 
  AuditResult,
  SiteDetailsResponse,
  IndexingPortfolioResponse,
  SiteIndexStats
} from '../types';

export * from '../types';

class ApiService {
  async checkAuth(): Promise<UserAuthStatus> {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Auth check failed', e);
    }

    return {
      authenticated: false,
      user: null,
      configured: false
    };
  }

  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API getCategories failed', e);
    }
    return [];
  }

  async createCategory(name: string, color: string, description: string): Promise<Category | null> {
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
    return null;
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      await fetch(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Remote deleteCategory failed', e);
    }
  }

  async getProperties(categoryId?: string): Promise<SiteProperty[]> {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) {
        const list: SiteProperty[] = await res.json();
        if (categoryId && categoryId !== 'all') {
          if (categoryId === 'uncategorized') {
            return list.filter(p => !p.category_id);
          }
          return list.filter(p => p.category_id === categoryId);
        }
        return list;
      }
    } catch (e) {
      console.warn('Remote getProperties failed', e);
    }
    return [];
  }

  async assignCategory(siteUrl: string, categoryId: string | null): Promise<void> {
    try {
      await fetch(`/api/sites/${encodeURIComponent(siteUrl)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId || null })
      });
    } catch (e) {
      console.error('Category assignment error', e);
    }
  }

  async toggleFavorite(siteUrl: string, isFav: boolean): Promise<void> {
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

  async updateSite(siteUrl: string, patch: { display_name?: string; category_id?: string | null; is_favorite?: number; total_pages?: number }): Promise<boolean> {
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(siteUrl)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      return res.ok;
    } catch (e) {
      console.error('Site update error', e);
      return false;
    }
  }

  async getAggregates(categoryId?: string, days: number = 28): Promise<AggregateData> {
    const emptyResult: AggregateData = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      clicksChange: 0,
      impressionsChange: 0,
      ctrChange: 0,
      positionChange: 0,
      timeline: [],
      categoryBreakdown: [],
      devices: [],
      countries: [],
      strikingQueries: []
    };

    try {
      const catParam = categoryId ? `&category_id=${encodeURIComponent(categoryId)}` : '';
      const res = await fetch(`/api/metrics/aggregate?days=${days}${catParam}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API getAggregates failed', e);
    }

    return emptyResult;
  }

  async getSiteDetails(siteUrl: string, days: number = 28): Promise<SiteDetailsResponse | null> {
    try {
      const res = await fetch(`/api/metrics/${encodeURIComponent(siteUrl)}?days=${days}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API getSiteDetails failed', e);
    }
    return null;
  }

  async syncAll(): Promise<{ success: boolean; message: string; syncedSitesCount?: number }> {
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          success: data.success !== false,
          syncedSitesCount: data.syncedSitesCount,
          message: data.message || `Successfully synced ${data.syncedSitesCount || 0} properties from Google Search Console.`
        };
      }
      return {
        success: false,
        message: data.error || data.message || 'Sync failed. Please ensure Google Search Console is connected.'
      };
    } catch (e: any) {
      console.error('Sync failed', e);
      return {
        success: false,
        message: e.message || 'Network error connecting to sync service'
      };
    }
  }

  async runAudit(siteUrl: string, days: number = 28): Promise<AuditResult | null> {
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(siteUrl)}?days=${days}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Audit API failed', e);
    }
    return null;
  }

  async getIndexingPortfolio(): Promise<IndexingPortfolioResponse | null> {
    try {
      const res = await fetch('/api/metrics/indexing');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API getIndexingPortfolio failed', e);
    }
    return null;
  }

  async getSiteIndexStats(siteUrl: string): Promise<SiteIndexStats | null> {
    try {
      const res = await fetch(`/api/metrics/indexing?site_url=${encodeURIComponent(siteUrl)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API getSiteIndexStats failed', e);
    }
    return null;
  }
}

export const api = new ApiService();
