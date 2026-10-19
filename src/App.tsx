import { Component, createSignal, onMount, createEffect, Show } from 'solid-js';
import { 
  LogIn, 
  Sparkles, 
  RefreshCw, 
  Lock, 
  ShieldCheck, 
  Globe 
} from 'lucide-solid';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { MetricCards } from './components/MetricCards';
import { PerformanceChart } from './components/PerformanceChart';
import { CategoryDonutChart } from './components/CategoryDonutChart';
import { DeviceChart } from './components/DeviceChart';
import { StrikingDistanceChart } from './components/StrikingDistanceChart';
import { CountryBarChart } from './components/CountryBarChart';
import { GenAiMetricsWidget } from './components/GenAiMetricsWidget';
import { SitesExplorer } from './components/SitesExplorer';
import { SiteDetailModal } from './components/SiteDetailModal';
import { CategoryModal } from './components/CategoryModal';
import { 
  api, 
  UserAuthStatus, 
  AggregateData, 
  Category, 
  SiteProperty 
} from './services/api';

export const App: Component = () => {
  const [days, setDays] = createSignal<number>(28);
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [viewMode, setViewMode] = createSignal<'grid' | 'table'>('grid');
  
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);
  const [toastMessage, setToastMessage] = createSignal<string>('');

  const [categories, setCategories] = createSignal<Category[]>([]);
  const [properties, setProperties] = createSignal<SiteProperty[]>([]);
  const [aggregateData, setAggregateData] = createSignal<AggregateData | null>(null);

  const [selectedSiteUrl, setSelectedSiteUrl] = createSignal<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = createSignal<boolean>(false);

  const [authStatus, setAuthStatus] = createSignal<UserAuthStatus>({
    authenticated: false,
    user: null,
    configured: false
  });

  const loadData = async () => {
    const auth = await api.checkAuth();
    setAuthStatus(auth);

    if (auth.authenticated) {
      const cats = await api.getCategories();
      setCategories(cats);

      const props = await api.getProperties(selectedCategory());
      setProperties(props);

      const agg = await api.getAggregates(selectedCategory(), days());
      setAggregateData(agg);
    } else {
      setCategories([]);
      setProperties([]);
      setAggregateData(null);
    }
  };

  onMount(() => {
    loadData();

    // Check if redirect returned with ?auth=success
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      showToast('Successfully authenticated with Google Search Console!');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    }
  });

  // Re-fetch aggregates & properties when category or days change (if authenticated)
  createEffect(async () => {
    if (!authStatus().authenticated) return;
    const cat = selectedCategory();
    const d = days();
    const agg = await api.getAggregates(cat, d);
    setAggregateData(agg);

    const props = await api.getProperties(cat);
    setProperties(props);
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handleSync = async () => {
    if (!authStatus().authenticated) {
      showToast('Please connect your Google Search Console account first.');
      return;
    }
    setIsSyncing(true);
    const res = await api.syncAll();
    setIsSyncing(false);
    showToast(res.message);
    loadData();
  };

  const handleAssignCategory = async (siteUrl: string, categoryId: string | null) => {
    await api.assignCategory(siteUrl, categoryId);
    loadData();
  };

  const handleToggleFavorite = async (siteUrl: string, isFav: boolean) => {
    await api.toggleFavorite(siteUrl, isFav);
    loadData();
  };

  const handleCreateCategory = async (name: string, color: string, description: string) => {
    await api.createCategory(name, color, description);
    loadData();
    showToast(`Created category "${name}"`);
  };

  const handleDeleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    if (selectedCategory() === id) {
      setSelectedCategory('all');
    }
    loadData();
    showToast('Category deleted');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthStatus({ authenticated: false, user: null, configured: true });
    setCategories([]);
    setProperties([]);
    setAggregateData(null);
    showToast('Logged out of Google');
  };

  // Filter properties by search term
  const filteredProperties = () => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return properties();
    return properties().filter(p => 
      p.display_name.toLowerCase().includes(query) ||
      p.site_url.toLowerCase().includes(query) ||
      p.category_name?.toLowerCase().includes(query)
    );
  };

  const getActiveCategoryName = () => {
    if (selectedCategory() === 'all') return undefined;
    const cat = categories().find(c => c.id === selectedCategory());
    return cat ? cat.name : undefined;
  };

  return (
    <div class="app-container">
      {/* Toast Notification Banner */}
      <Show when={toastMessage()}>
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#ffffff',
          padding: '12px 20px',
          "border-radius": 'var(--radius-md)',
          border: '1px solid var(--border-accent)',
          "box-shadow": 'var(--shadow-lg)',
          "z-index": 1000,
          display: 'flex',
          "align-items": 'center',
          gap: '10px',
          "font-size": '0.86rem',
          "font-weight": 600,
          animation: 'fadeIn 200ms ease-out'
        }}>
          <span style={{ color: 'var(--color-success)', "font-size": '1.1rem' }}>✓</span>
          <span>{toastMessage()}</span>
        </div>
      </Show>

      {/* Global Navigation Header */}
      <Header
        days={days()}
        onSelectDays={setDays}
        isSyncing={isSyncing()}
        onSync={handleSync}
        authStatus={authStatus()}
        onLogout={handleLogout}
      />

      {/* Disconnected Notice Banner: When user is not connected */}
      <Show when={!authStatus().authenticated}>
        <div class="auth-required-banner">
          <div class="auth-banner-left">
            <div class="auth-banner-icon-box">
              <Lock size={26} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ "font-size": '1.15rem', color: '#fff', "font-family": 'var(--font-heading)', "margin-bottom": '4px' }}>
                Google Search Console Disconnected
              </h2>
              <p style={{ "font-size": '0.84rem', color: 'var(--text-secondary)', "line-height": 1.5, "max-width": '620px' }}>
                Live data mode is active. Please connect your Google account to synchronize your verified domains, search keywords, impressions, and performance metrics with 100% mathematical parity.
              </p>
            </div>
          </div>
          <a href="/api/auth/login" class="btn btn-google" style={{ padding: '10px 22px', "font-size": '0.92rem', "text-decoration": 'none' }}>
            <LogIn size={18} />
            <span>Connect Google Search Console</span>
          </a>
        </div>
      </Show>

      {/* Ready-to-Sync Notice: When authenticated but 0 properties synced yet */}
      <Show when={authStatus().authenticated && properties().length === 0}>
        <div class="ready-to-sync-banner">
          <div style={{ display: 'flex', "align-items": 'center', gap: '14px' }}>
            <div class="brand-logo-icon" style={{ width: '40px', height: '40px' }}>
              <ShieldCheck size={22} color="var(--color-success)" />
            </div>
            <div>
              <h3 style={{ "font-size": '1.05rem', color: '#fff', "font-family": 'var(--font-heading)', "margin-bottom": '2px' }}>
                Connected as {authStatus().user?.email}
              </h3>
              <p style={{ "font-size": '0.82rem', color: 'var(--text-secondary)' }}>
                No properties synced yet. Click <strong>Sync All</strong> to discover and synchronize your verified Google Search Console properties.
              </p>
            </div>
          </div>
          <button class="btn btn-primary" onClick={handleSync} disabled={isSyncing()} style={{ padding: '8px 18px' }}>
            <RefreshCw size={15} class={isSyncing() ? 'animate-spin' : ''} />
            <span>{isSyncing() ? 'Synchronizing...' : 'Sync Properties Now'}</span>
          </button>
        </div>
      </Show>

      {/* Main Dashboard Section: Greyed out & unclickable when unauthenticated */}
      <div class="dashboard-body" classList={{ 'is-unauthenticated-disabled': !authStatus().authenticated }}>
        {/* Category & Group Navigation Ribbon */}
        <CategoryFilter
          categories={categories()}
          selectedCategory={selectedCategory()}
          onSelectCategory={setSelectedCategory}
          onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
          searchQuery={searchQuery()}
          onSearchChange={setSearchQuery}
          viewMode={viewMode()}
          onViewModeChange={setViewMode}
          totalSitesCount={properties().length}
        />

        {/* Executive Key Metric Cards */}
        <MetricCards
          data={aggregateData()}
          days={days()}
        />

        {/* Primary Chart Row: Dual-Axis Performance Timeline + Category Share Donut */}
        <div class="charts-grid-row">
          <PerformanceChart
            timeline={aggregateData()?.timeline || []}
            categoryName={getActiveCategoryName()}
          />

          <CategoryDonutChart
            data={aggregateData()?.categoryBreakdown || []}
            onSelectCategory={(id) => setSelectedCategory(id)}
          />
        </div>

        {/* Secondary Chart Row: Device Breakdown + Striking Distance Matrix + Geo Markets */}
        <div class="charts-grid-secondary">
          <DeviceChart data={aggregateData()?.devices || []} />
          <StrikingDistanceChart queries={aggregateData()?.strikingQueries || []} />
          <CountryBarChart data={aggregateData()?.countries || []} />
        </div>

        {/* Generative AI & AI Overviews Analytics Widget */}
        <GenAiMetricsWidget data={aggregateData()?.aiMetrics} />

        {/* Monitored Properties Portfolio Explorer (Grid / Table) */}
        <SitesExplorer
          properties={filteredProperties()}
          categories={categories()}
          viewMode={viewMode()}
          onSelectSite={(url) => setSelectedSiteUrl(url)}
          onAssignCategory={handleAssignCategory}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>

      {/* Single Site Drill-Down Modal */}
      <Show when={selectedSiteUrl()}>
        <SiteDetailModal
          siteUrl={selectedSiteUrl()!}
          onClose={() => setSelectedSiteUrl(null)}
        />
      </Show>

      {/* Category & Group Management Modal */}
      <Show when={isCategoryModalOpen()}>
        <CategoryModal
          categories={categories()}
          onClose={() => setIsCategoryModalOpen(false)}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      </Show>
    </div>
  );
};

export default App;
