import { Component, For, Show } from 'solid-js';
import { 
  Globe, 
  ExternalLink, 
  Star, 
  ChevronRight, 
  Clock, 
  ArrowUpRight,
  TrendingUp,
  Tag
} from 'lucide-solid';
import { SiteProperty, Category } from '../types';

interface SitesExplorerProps {
  properties: SiteProperty[];
  categories: Category[];
  viewMode: 'grid' | 'table';
  onSelectSite: (siteUrl: string) => void;
  onAssignCategory: (siteUrl: string, categoryId: string | null) => void;
  onToggleFavorite: (siteUrl: string, isFav: boolean) => void;
}

export const SitesExplorer: Component<SitesExplorerProps> = (props) => {
  const formatNumber = (n?: number) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
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
          <For each={props.properties}>
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

                  <div class="site-badges-group" onClick={(e) => e.stopPropagation()}>
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
                      {site.avg_ctr_28d}%
                    </span>
                  </div>
                  <div class="site-metric-item">
                    <span class="lbl">Avg Pos</span>
                    <span class="val" style={{ color: 'var(--color-warning)' }}>
                      {site.avg_position_28d}
                    </span>
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
                <th>Property / Domain</th>
                <th>Category</th>
                <th>Clicks (28d)</th>
                <th>Impressions (28d)</th>
                <th>CTR</th>
                <th>Avg Pos</th>
                <th>Status</th>
                <th>Last Synced</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.properties}>
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
                      <span class="trend-badge positive">
                        <TrendingUp size={12} />
                        <span>Active</span>
                      </span>
                    </td>

                    <td style={{ "font-size": '0.78rem', color: 'var(--text-muted)' }}>
                      {site.last_synced_at}
                    </td>

                    <td>
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
