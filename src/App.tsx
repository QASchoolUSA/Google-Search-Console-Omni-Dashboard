import { Component, createSignal, onMount, createEffect, Show } from 'solid-js';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { MetricCards } from './components/MetricCards';
import { PerformanceChart } from './components/PerformanceChart';
import { CategoryDonutChart } from './components/CategoryDonutChart';
import { DeviceChart } from './components/DeviceChart';
import { StrikingDistanceChart } from './components/StrikingDistanceChart';
import { CountryBarChart } from './components/CountryBarChart';
import { SitesExplorer } from './components/SitesExplorer';
import { SiteDetailModal } from './components/SiteDetailModal';
import { CategoryModal } from './components/CategoryModal';
import { 
  api, 
  UserAuthStatus, 
  AggregateData 
} from './services/api';
import { 
  MockCategory, 
  MockProperty, 
  DEVICE_SPLIT, 
  COUNTRY_SPLIT,
  SAMPLE_QUERIES 
} from './services/mockData';

export const App: Component = () => {
  const [days, setDays] = createSignal<number>(28);
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [viewMode, setViewMode] = createSignal<'grid' | 'table'>('grid');
  
  const [isDemo, setIsDemo] = createSignal<boolean>(api.isDemoMode());
  const [isSyncing, setIsSyncing] = createSignal<boolean>(false);
  const [toastMessage, setToastMessage] = createSignal<string>('');

  const [categories, setCategories] = createSignal<MockCategory[]>([]);
  const [properties, setProperties] = createSignal<MockProperty[]>([]);
  const [aggregateData, setAggregateData] = createSignal<AggregateData | null>(null);

  const [selectedSiteUrl, setSelectedSiteUrl] = createSignal<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = createSignal<boolean>(false);

  const [authStatus, setAuthStatus] = createSignal<UserAuthStatus>({
    authenticated: false,
    user: null,
    configured: false
  });

  const loadData = async () => {
    const cats = await api.getCategories();
    setCategories(cats);

    const props = await api.getProperties(selectedCategory());
    setProperties(props);

    const agg = await api.getAggregates(selectedCategory(), days());
    setAggregateData(agg);

    const auth = await api.checkAuth();
    setAuthStatus(auth);
  };

  onMount(() => {
    loadData();

    // Check if redirect returned with ?auth=success
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setIsDemo(false);
      api.setDemoMode(false);
      showToast('Successfully connected to Google Search Console!');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    }
  });

  // Re-fetch aggregates & properties when category or days change
  createEffect(async () => {
    const cat = selectedCategory();
    const d = days();
    const agg = await api.getAggregates(cat, d);
    setAggregateData(agg);

    const props = await api.getProperties(cat);
    setProperties(props);
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleToggleDemo = (val: boolean) => {
    setIsDemo(val);
    api.setDemoMode(val);
    loadData();
    showToast(val ? 'Switched to Demo Benchmark Mode' : 'Switched to Live Google Mode');
  };

  const handleSync = async () => {
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
        isDemo={isDemo()}
        onToggleDemo={handleToggleDemo}
        isSyncing={isSyncing()}
        onSync={handleSync}
        authStatus={authStatus()}
        onLogout={handleLogout}
      />

      {/* Website Category & Group Navigation Ribbon */}
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
        <DeviceChart data={DEVICE_SPLIT} />
        <StrikingDistanceChart queries={SAMPLE_QUERIES} />
        <CountryBarChart data={COUNTRY_SPLIT} />
      </div>

      {/* Monitored Properties Portfolio Explorer (Grid / Table) */}
      <SitesExplorer
        properties={filteredProperties()}
        categories={categories()}
        viewMode={viewMode()}
        onSelectSite={(url) => setSelectedSiteUrl(url)}
        onAssignCategory={handleAssignCategory}
        onToggleFavorite={handleToggleFavorite}
      />

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
