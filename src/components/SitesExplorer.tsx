import { Component, For, Show, createSignal } from 'solid-js';
import { 
  Globe, 
  Star, 
  ChevronRight, 
  Clock, 
  TrendingUp,
  Tag,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  RefreshCw,
  FileSearch
} from 'lucide-solid';
import { SiteProperty, Category } from '../types';

type SiteSortField = 'display_name' | 'category_name' | 'total_clicks_28d' | 'total_impressions_28d' | 'avg_ctr_28d' | 'avg_position_28d' | 'indexed_pages' | 'last_synced_at';
type SortDirection = 'asc' | 'desc';

interface SitesExplorerProps {
  properties: SiteProperty[];
  categories: Category[];
  viewMode: 'grid' | 'table';
  onSelectSite: (siteUrl: string) => void;
  onAssignCategory: (siteUrl: string, categoryId: string | null) => void;
  onToggleFavorite: (siteUrl: string, isFav: boolean) => void;
  onSyncSite?: (siteUrl: string) => void;
}

export const SitesExplorer: Component<SitesExplorerProps> = (props) => {
  const [sortField, setSortField] = createSignal<SiteSortField>('total_clicks_28d');
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('desc');
  const [syncingSite, setSyncingSite] = createSignal<string | null>(null);

  const handleSort = (field: SiteSortField) => {
    if (sortField() === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // For alphabetical & position (rank 1 is best), start with ascending; for clicks/impressions/CTR, descending
      setSortDirection(field === 'display_name' || field === 'category_name' || field === 'avg_position_28d' ? 'asc' : 'desc');
    }
  };

  const sortedProperties = () => {
    const list = [...props.properties];
    const field = sortField();
    const dir = sortDirection();
    const mult = dir === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      let valA: any = a[field as keyof SiteProperty];
      let valB: any = b[field as keyof SiteProperty];

      if (field === 'display_name') {
        valA = a.display_name || a.site_url || '';
        valB = b.display_name || b.site_url || '';
        return mult * valA.localeCompare(valB);
      }

      if (field === 'category_name') {
        valA = a.category_name || '';
        valB = b.category_name || '';
        return mult * valA.localeCompare(valB);
      }

      if (field === 'last_synced_at') {
        const timeA = a.last_synced_at ? new Date(a.last_synced_at).getTime() : 0;
        const timeB = b.last_synced_at ? new Date(b.last_synced_at).getTime() : 0;
        return mult * (timeA - timeB);
      }

      valA = Number(valA ?? 0);
      valB = Number(valB ?? 0);
      return mult * (valA - valB);
    });
  };

  const renderSortIcon = (field: SiteSortField) => {
    if (sortField() !== field) {
      return <ArrowUpDown size={12} class="sort-icon-inactive" />;
    }
    return sortDirection() === 'asc' ? (
      <ChevronUp size={13} class="sort-icon-active" color="var(--color-primary)" />
    ) : (
      <ChevronDown size={13} class="sort-icon-active" color="var(--color-primary)" />
    );
  };

  const formatNumber = (n?: number) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  };

  const renderIndexChange = (pct?: number | null) => {
    if (pct === null || pct === undefined) {
      return <span style={{ color: 'var(--text-muted)', "font-size": '0.7rem' }}>—</span>;
    }
    const isZero = pct === 0;
    const isPositive = pct > 0;
    const color = isZero ? 'var(--text-muted)' : isPositive ? 'var(--color-success)' : 'var(--color-danger)';
    return (
      <span style={{ color, "font-size": '0.72rem', "font-weight": 600 }}>
        {isPositive ? '+' : ''}{pct}%
      </span>
    );
  };

  const getSiteTotalPages = (site: SiteProperty) => {
    return Math.max(site.total_pages || 0, site.indexed_pages || 0);
  };

  const getSiteIndexRatio = (site: SiteProperty) => {
    const total = getSiteTotalPages(site);
    const indexed = site.indexed_pages || 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round((indexed / total) * 1000) / 10);
  };

  return (
    <div style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
      <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center' }}>
        <div>
          <h2 style={{ "font-family": 'var(--font-heading)', "font-size": '1.15rem', "font-weight": 600, color: '#fff' }}>
            Monitored Properties ({props.properties.length})
          </h2>
          <p style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>
            Click any website to inspect keyword queries, landing pages, and search trends
          </p>
        </div>
      </div>

      <Show when={props.properties.length === 0}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-subtle)',
          padding: '48px 24px',
          "border-radius": 'var(--radius-lg)',
          "text-align": 'center',
          display: 'flex',
          "flex-direction": 'column',
          "align-items": 'center',
          gap: '12px'
        }}>
          <Globe size={36} color="var(--text-muted)" />
          <h3 style={{ "font-size": '1.05rem', color: '#fff' }}>No Properties Synced Yet</h3>
          <p style={{ "font-size": '0.82rem', color: 'var(--text-secondary)', "max-width": '420px', "line-height": 1.5 }}>
            Connect your Google account and click <strong>Sync All</strong> in the header to discover and synchronize your verified Google Search Console properties.
          </p>
        </div>
      </Show>

      <Show when={props.properties.length > 0}>
      {props.viewMode === 'grid' ? (
        <div class="sites-grid">
          <For each={sortedProperties()}>
            {(site) => (
              <div 
                class="site-card"
                onClick={() => props.onSelectSite(site.site_url)}
              >
                <div class="site-card-top">
                  <div class="site-domain-info">
                    <div class="site-favicon">
                      <Globe size={18} />
                    </div>
                    <div class="site-names">
                      <h4>{site.display_name}</h4>
                      <div class="full-url">{site.site_url}</div>
                    </div>
                  </div>

                  <div class="site-badges-group" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
                    <Show when={props.onSyncSite}>
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: syncingSite() === site.site_url ? 'var(--color-primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        onClick={async () => {
                          setSyncingSite(site.site_url);
                          await props.onSyncSite!(site.site_url);
                          setSyncingSite(null);
                        }}
                        title="Sync this website from Google Search Console"
                      >
                        <RefreshCw size={14} class={syncingSite() === site.site_url ? 'animate-spin' : ''} />
                      </button>
                    </Show>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: site.is_favorite ? 'var(--color-warning)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onClick={() => props.onToggleFavorite(site.site_url, !site.is_favorite)}
                      title={site.is_favorite ? 'Remove favorite' : 'Add to favorites'}
                    >
                      <Star size={16} fill={site.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Inline Category Tag Selector */}
                <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <Tag size={13} color="var(--text-muted)" />
                  <select
                    class="form-select"
                    style={{
                      padding: '3px 8px',
                      "font-size": '0.74rem',
                      height: '26px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${site.category_color || 'var(--border-subtle)'}`,
                      color: site.category_color || 'var(--text-primary)',
                      "border-radius": 'var(--radius-full)',
                      "font-weight": 600
                    }}
                    value={site.category_id || ''}
                    onChange={(e) => {
                      props.onAssignCategory(site.site_url, e.currentTarget.value || null);
                    }}
                  >
                    <option value="">Uncategorized</option>
                    <For each={props.categories}>
                      {(cat) => (
                        <option value={cat.id} selected={cat.id === site.category_id}>
                          {cat.name}
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                {/* Metrics 4-Box Row */}
                <div class="site-card-metrics-row">
                  <div class="site-metric-item">
                    <span class="lbl">Clicks</span>
                    <span class="val" style={{ color: 'var(--color-secondary)' }}>
                      {formatNumber(site.total_clicks_28d)}
                    </span>
                  </div>
                  <div class="site-metric-item">
                    <span class="lbl">Impressions</span>
                    <span class="val" style={{ color: 'var(--color-purple)' }}>
                      {formatNumber(site.total_impressions_28d)}
                    </span>
                  </div>
                  <div class="site-metric-item">
                    <span class="lbl">CTR</span>
                    <span class="val" style={{ color: 'var(--color-success)' }}>
                      {site.avg_ctr_28d || 0}%
                    </span>
                  </div>
                  <div class="site-metric-item">
                    <span class="lbl">Avg Pos</span>
                    <span class="val" style={{ color: 'var(--color-warning)' }}>
                      {site.avg_position_28d || 0}
                    </span>
                  </div>
                </div>

                {/* Dedicated Prominent Indexation Status Section */}
                <div class="site-card-index-box">
                  <div class="site-card-index-top">
                    <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                      <FileSearch size={13} color="#38bdf8" />
                      <span class="site-card-index-heading">INDEXATION COVERAGE</span>
                    </div>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                      <span class="index-pct-pill">
                        {getSiteIndexRatio(site)}% indexed
                      </span>
                      <Show when={site.indexed_change_7d !== undefined && site.indexed_change_7d !== null}>
                        <span style={{ "font-size": '0.7rem', color: 'var(--text-muted)' }}>
                          7d: {renderIndexChange(site.indexed_change_7d)}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <div class="site-card-index-number-row">
                    <span class="site-card-index-current">{formatNumber(site.indexed_pages)}</span>
                    <span class="site-card-index-out-of">out of</span>
                    <span class="site-card-index-total">{formatNumber(getSiteTotalPages(site))}</span>
                    <span class="site-card-index-label">pages</span>
                    <Show when={!site.last_synced_at && (site.indexed_pages || 0) === 0}>
                      <span class="site-card-unsynced-badge">Not synced yet</span>
                    </Show>
                  </div>

                  <div class="site-card-index-bar">
                    <div
                      class="site-card-index-fill"
                      style={{ width: `${getSiteIndexRatio(site)}%` }}
                      title={`${formatNumber(site.indexed_pages)} of ${formatNumber(getSiteTotalPages(site))} pages indexed (${getSiteIndexRatio(site)}%)`}
                    />
                  </div>
                </div>

                <div class="site-card-footer">
                  <div style={{ display: 'flex', "align-items": 'center', gap: '5px' }}>
                    <Clock size={12} />
                    <span>Synced {site.last_synced_at}</span>
                  </div>

                  <div style={{ display: 'flex', "align-items": 'center', gap: '4px', color: 'var(--text-accent)', "font-weight": 600 }}>
                    <span>Deep Dive</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      ) : (
        /* Detailed Table View */
        <div class="table-card">
          <table class="custom-table">
            <thead>
              <tr>
                <th class="sortable-th" onClick={() => handleSort('display_name')} title="Click to sort by domain">
                  <div class="th-content">
                    <span>Property / Domain</span>
                    {renderSortIcon('display_name')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('category_name')} title="Click to sort by category">
                  <div class="th-content">
                    <span>Category</span>
                    {renderSortIcon('category_name')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('total_clicks_28d')} title="Click to sort by clicks">
                  <div class="th-content">
                    <span>Clicks (28d)</span>
                    {renderSortIcon('total_clicks_28d')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('total_impressions_28d')} title="Click to sort by impressions">
                  <div class="th-content">
                    <span>Impressions (28d)</span>
                    {renderSortIcon('total_impressions_28d')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('avg_ctr_28d')} title="Click to sort by CTR">
                  <div class="th-content">
                    <span>CTR</span>
                    {renderSortIcon('avg_ctr_28d')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('avg_position_28d')} title="Click to sort by average position">
                  <div class="th-content">
                    <span>Avg Pos</span>
                    {renderSortIcon('avg_position_28d')}
                  </div>
                </th>
                <th class="sortable-th" onClick={() => handleSort('indexed_pages')} title="Click to sort by indexed pages">
                  <div class="th-content">
                    <span>Indexed out of Total</span>
                    {renderSortIcon('indexed_pages')}
                  </div>
                </th>
                <th title="Indexed pages change vs 3 / 7 / 14 / 30 / 60 days ago">Index Trends</th>
                <th>Status</th>
                <th class="sortable-th" onClick={() => handleSort('last_synced_at')} title="Click to sort by last sync timestamp">
                  <div class="th-content">
                    <span>Last Synced</span>
                    {renderSortIcon('last_synced_at')}
                  </div>
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <For each={sortedProperties()}>
                {(site) => (
                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => props.onSelectSite(site.site_url)}
                  >
                    <td>
                      <div class="table-site-cell">
                        <div class="site-favicon" style={{ width: '28px', height: '28px' }}>
                          <Globe size={15} />
                        </div>
                        <div>
                          <div style={{ "font-weight": 600, color: '#fff' }}>{site.display_name}</div>
                          <div style={{ "font-size": '0.72rem', color: 'var(--text-muted)' }}>{site.site_url}</div>
                        </div>
                      </div>
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        class="form-select"
                        style={{
                          padding: '3px 8px',
                          "font-size": '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${site.category_color || 'var(--border-subtle)'}`,
                          color: site.category_color || 'var(--text-primary)',
                          "border-radius": 'var(--radius-full)',
                          "font-weight": 600
                        }}
                        value={site.category_id || ''}
                        onChange={(e) => {
                          props.onAssignCategory(site.site_url, e.currentTarget.value || null);
                        }}
                      >
                        <option value="">Uncategorized</option>
                        <For each={props.categories}>
                          {(cat) => (
                            <option value={cat.id} selected={cat.id === site.category_id}>
                              {cat.name}
                            </option>
                          )}
                        </For>
                      </select>
                    </td>

                    <td style={{ "font-family": 'var(--font-heading)', "font-weight": 600, color: 'var(--color-secondary)' }}>
                      {formatNumber(site.total_clicks_28d)}
                    </td>

                    <td style={{ "font-family": 'var(--font-heading)', "font-weight": 600, color: 'var(--color-purple)' }}>
                      {formatNumber(site.total_impressions_28d)}
                    </td>

                    <td style={{ color: 'var(--color-success)', "font-weight": 600 }}>
                      {site.avg_ctr_28d}%
                    </td>

                    <td style={{ color: 'var(--color-warning)', "font-weight": 600 }}>
                      {site.avg_position_28d}
                    </td>

                    <td>
                      <div style={{ display: 'flex', "flex-direction": 'column', gap: '3px', "min-width": '150px' }}>
                        <div style={{ display: 'flex', "align-items": 'baseline', gap: '5px' }}>
                          <span style={{ "font-family": 'var(--font-heading)', "font-weight": 700, color: '#38bdf8', "font-size": '0.88rem' }}>
                            {formatNumber(site.indexed_pages)}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', "font-size": '0.76rem' }}>
                            out of {formatNumber(getSiteTotalPages(site))}
                          </span>
                          <span class="index-pct-pill" style={{ "margin-left": 'auto' }}>
                            {getSiteIndexRatio(site)}%
                          </span>
                        </div>
                        <div class="table-index-bar">
                          <div
                            class="table-index-fill"
                            style={{
                              width: `${getSiteIndexRatio(site)}%`
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', "flex-wrap": 'wrap', gap: '4px 8px', "font-size": '0.7rem' }}>
                        <span title="3 days">3d {renderIndexChange(site.indexed_change_3d)}</span>
                        <span title="7 days">7d {renderIndexChange(site.indexed_change_7d)}</span>
                        <span title="14 days">14d {renderIndexChange(site.indexed_change_14d)}</span>
                        <span title="30 days">30d {renderIndexChange(site.indexed_change_30d)}</span>
                        <span title="60 days">60d {renderIndexChange(site.indexed_change_60d)}</span>
                      </div>
                    </td>

                    <td>
                      <span class="trend-badge positive">
                        <TrendingUp size={12} />
                        <span>Active</span>
                      </span>
                    </td>

                    <td style={{ "font-size": '0.78rem', color: 'var(--text-muted)' }}>
                      {site.last_synced_at}
                    </td>

                    <td>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                        <button
                          class="btn btn-outline"
                          style={{ padding: '4px 10px', "font-size": '0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onSelectSite(site.site_url);
                          }}
                        >
                          Inspect
                        </button>
                        <Show when={props.onSyncSite}>
                          <button
                            class="btn btn-outline"
                            style={{ padding: '4px 8px', "font-size": '0.75rem' }}
                            title="Sync this website from Google Search Console"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSyncingSite(site.site_url);
                              await props.onSyncSite!(site.site_url);
                              setSyncingSite(null);
                            }}
                          >
                            <RefreshCw size={12} class={syncingSite() === site.site_url ? 'animate-spin' : ''} />
                          </button>
                        </Show>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      )}
      </Show>
    </div>
  );
};
