import { Component, createSignal, For, onMount, createResource } from 'solid-js';
import { 
  X, 
  ExternalLink, 
  Globe, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  FileText, 
  Smartphone,
  Sparkles
} from 'lucide-solid';
import { api } from '../services/api';
import { PerformanceChart } from './PerformanceChart';
import { MockQuery, MockPage } from '../services/mockData';

interface SiteDetailModalProps {
  siteUrl: string;
  onClose: () => void;
}

export const SiteDetailModal: Component<SiteDetailModalProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'queries' | 'pages' | 'tech'>('queries');
  const [queryFilter, setQueryFilter] = createSignal<'all' | 'striking' | 'top3'>('all');
  const [searchTerm, setSearchTerm] = createSignal('');

  const [siteData] = createResource(
    () => props.siteUrl,
    (url) => api.getSiteDetails(url, 28)
  );

  const filteredQueries = () => {
    const list: MockQuery[] = siteData()?.topQueries || [];
    const term = searchTerm().toLowerCase().trim();
    const filter = queryFilter();

    return list.filter(q => {
      const matchSearch = !term || q.query.toLowerCase().includes(term);
      if (!matchSearch) return false;

      if (filter === 'striking') {
        return q.position >= 8 && q.position <= 20;
      }
      if (filter === 'top3') {
        return q.position <= 3;
      }
      return true;
    });
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()} style={{ "max-width": '1080px' }}>
        {/* Modal Header */}
        <div class="modal-header">
          <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
            <div class="site-favicon" style={{ width: '36px', height: '36px' }}>
              <Globe size={20} />
            </div>
            <div>
              <h2>{siteData()?.property?.display_name || props.siteUrl}</h2>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '0.78rem', color: 'var(--text-muted)' }}>
                <span>{props.siteUrl}</span>
                <span>•</span>
                <span class="engine-pill" style={{ color: siteData()?.property?.category_color || 'var(--color-primary)' }}>
                  {siteData()?.property?.category_name || 'Uncategorized'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <a 
              href={props.siteUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              class="btn btn-outline"
              style={{ padding: '6px 12px', "font-size": '0.78rem' }}
            >
              <span>Visit Site</span>
              <ExternalLink size={13} />
            </a>
            <button class="close-btn" onClick={props.onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div class="modal-body">
          {/* Site Timeline Performance Chart */}
          {siteData() && (
            <PerformanceChart 
              timeline={siteData()?.timeline || []} 
              title="28-Day Search Traffic Trend"
            />
          )}

          {/* Sub Navigation Tabs */}
          <div class="modal-tabs">
            <button
              class={`modal-tab-btn ${activeTab() === 'queries' ? 'active' : ''}`}
              onClick={() => setActiveTab('queries')}
            >
              Top Search Queries ({siteData()?.topQueries?.length || 0})
            </button>
            <button
              class={`modal-tab-btn ${activeTab() === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
            >
              Top Landing Pages ({siteData()?.topPages?.length || 0})
            </button>
          </div>

          {/* Queries Tab */}
          {activeTab() === 'queries' && (
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '12px' }}>
              <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "flex-wrap": 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    class={`date-btn ${queryFilter() === 'all' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('all')}
                  >
                    All Queries
                  </button>
                  <button
                    class={`date-btn ${queryFilter() === 'striking' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('striking')}
                  >
                    🎯 Striking Distance (Pos 8-20)
                  </button>
                  <button
                    class={`date-btn ${queryFilter() === 'top3' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('top3')}
                  >
                    ⭐ Top 3 Rankings
                  </button>
                </div>

                <div class="search-input-wrapper">
                  <Search size={14} />
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Filter keyword..."
                    value={searchTerm()}
                    onInput={(e) => setSearchTerm(e.currentTarget.value)}
                    style={{ width: '200px' }}
                  />
                </div>
              </div>

              <div class="table-card" style={{ "max-height": '380px', "overflow-y": 'auto' }}>
                <table class="custom-table">
                  <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                    <tr>
                      <th>Search Query</th>
                      <th>Clicks</th>
                      <th>Impressions</th>
                      <th>CTR</th>
                      <th>Position</th>
                      <th>Opportunity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={filteredQueries()}>
                      {(q) => (
                        <tr>
                          <td style={{ "font-weight": 600, color: '#f8fafc' }}>{q.query}</td>
                          <td style={{ color: 'var(--color-secondary)', "font-family": 'var(--font-heading)', "font-weight": 600 }}>
                            {q.clicks.toLocaleString()}
                          </td>
                          <td style={{ color: 'var(--color-purple)', "font-family": 'var(--font-heading)' }}>
                            {q.impressions.toLocaleString()}
                          </td>
                          <td style={{ color: 'var(--color-success)', "font-weight": 600 }}>
                            {q.ctr}%
                          </td>
                          <td style={{ color: 'var(--color-warning)', "font-weight": 700 }}>
                            {q.position}
                          </td>
                          <td>
                            {q.position <= 3 ? (
                              <span class="trend-badge positive">Top 3 Rank</span>
                            ) : q.position <= 20 && q.impressions > 25000 ? (
                              <span class="trend-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                                Striking Win
                              </span>
                            ) : (
                              <span class="trend-badge neutral">Standard</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pages Tab */}
          {activeTab() === 'pages' && (
            <div class="table-card" style={{ "max-height": '420px', "overflow-y": 'auto' }}>
              <table class="custom-table">
                <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                  <tr>
                    <th>URL Path</th>
                    <th>Clicks</th>
                    <th>Impressions</th>
                    <th>CTR</th>
                    <th>Avg Pos</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={siteData()?.topPages || []}>
                    {(p) => (
                      <tr>
                        <td>
                          <div style={{ "font-family": 'monospace', "font-size": '0.8rem', color: 'var(--text-accent)' }}>
                            {p.page}
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-secondary)', "font-weight": 600 }}>
                          {p.clicks.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--color-purple)' }}>
                          {p.impressions.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--color-success)', "font-weight": 600 }}>
                          {p.ctr}%
                        </td>
                        <td style={{ color: 'var(--color-warning)', "font-weight": 600 }}>
                          {p.position}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
