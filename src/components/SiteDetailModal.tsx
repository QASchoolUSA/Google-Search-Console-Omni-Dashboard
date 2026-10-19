import { Component, createSignal, For, createResource, Show } from 'solid-js';
import { 
  X, 
  ExternalLink, 
  Globe, 
  Search, 
  Sparkles,
  Bot,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Copy,
  Check
} from 'lucide-solid';
import { api } from '../services/api';
import { PerformanceChart } from './PerformanceChart';
import { DataAuditModal } from './DataAuditModal';
import { QueryMetric, PageMetric, GenAiQueryMetric, GenAiIntentType } from '../types';

interface SiteDetailModalProps {
  siteUrl: string;
  onClose: () => void;
}

type QuerySortField = 'query' | 'clicks' | 'impressions' | 'ctr' | 'position' | 'opportunity';
type PageSortField = 'page' | 'clicks' | 'impressions' | 'ctr' | 'position';
type GenAiSortField = 'query' | 'aiIntent' | 'clicks' | 'impressions' | 'ctr' | 'position' | 'citationLikelihood';
type SortDirection = 'asc' | 'desc';

export const SiteDetailModal: Component<SiteDetailModalProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'queries' | 'pages' | 'genai'>('queries');
  const [queryFilter, setQueryFilter] = createSignal<'all' | 'striking' | 'top3'>('all');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [pageSearchTerm, setPageSearchTerm] = createSignal('');
  const [genAiSearchTerm, setGenAiSearchTerm] = createSignal('');
  const [genAiFilter, setGenAiFilter] = createSignal<'all' | 'prime' | 'high' | 'how_to' | 'comparative'>('all');
  const [isAuditOpen, setIsAuditOpen] = createSignal(false);
  const [copiedUrl, setCopiedUrl] = createSignal<string | null>(null);

  // Sorting state for Queries table
  const [querySortField, setQuerySortField] = createSignal<QuerySortField>('clicks');
  const [querySortDir, setQuerySortDir] = createSignal<SortDirection>('desc');

  // Sorting state for Landing Pages table
  const [pageSortField, setPageSortField] = createSignal<PageSortField>('clicks');
  const [pageSortDir, setPageSortDir] = createSignal<SortDirection>('desc');

  // Sorting state for GenAI table
  const [genAiSortField, setGenAiSortField] = createSignal<GenAiSortField>('clicks');
  const [genAiSortDir, setGenAiSortDir] = createSignal<SortDirection>('desc');

  const [siteData] = createResource(
    () => props.siteUrl,
    (url) => api.getSiteDetails(url, 28)
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleQuerySort = (field: QuerySortField) => {
    if (querySortField() === field) {
      setQuerySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setQuerySortField(field);
      setQuerySortDir(field === 'query' || field === 'position' ? 'asc' : 'desc');
    }
  };

  const handlePageSort = (field: PageSortField) => {
    if (pageSortField() === field) {
      setPageSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPageSortField(field);
      setPageSortDir(field === 'page' || field === 'position' ? 'asc' : 'desc');
    }
  };

  const handleGenAiSort = (field: GenAiSortField) => {
    if (genAiSortField() === field) {
      setGenAiSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setGenAiSortField(field);
      setGenAiSortDir(field === 'query' || field === 'position' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (currentField: string, targetField: string, dir: SortDirection) => {
    if (currentField !== targetField) {
      return <ArrowUpDown size={12} class="sort-icon-inactive" />;
    }
    return dir === 'asc' ? (
      <ChevronUp size={13} class="sort-icon-active" color="var(--color-primary)" />
    ) : (
      <ChevronDown size={13} class="sort-icon-active" color="var(--color-primary)" />
    );
  };

  // Queries Filter & Sort
  const sortedQueries = () => {
    const list: QueryMetric[] = siteData()?.topQueries || [];
    const term = searchTerm().toLowerCase().trim();
    const filter = queryFilter();

    const filtered = list.filter(q => {
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

    const field = querySortField();
    const dir = querySortDir();
    const mult = dir === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      if (field === 'query') {
        return mult * a.query.localeCompare(b.query);
      }
      if (field === 'opportunity') {
        return mult * (a.position - b.position);
      }
      return mult * (Number(a[field] ?? 0) - Number(b[field] ?? 0));
    });
  };

  // Landing Pages Filter & Sort
  const sortedPages = () => {
    let list: PageMetric[] = siteData()?.topPages || [];
    const term = pageSearchTerm().toLowerCase().trim();
    if (term) {
      list = list.filter(p => p.page.toLowerCase().includes(term));
    }

    const field = pageSortField();
    const dir = pageSortDir();
    const mult = dir === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (field === 'page') {
        return mult * a.page.localeCompare(b.page);
      }
      return mult * (Number(a[field] ?? 0) - Number(b[field] ?? 0));
    });
  };

  // GenAI Queries Filter & Sort
  const sortedGenAiQueries = () => {
    const list: GenAiQueryMetric[] = siteData()?.aiMetrics?.topAiQueries || [];
    const term = genAiSearchTerm().toLowerCase().trim();
    const filter = genAiFilter();

    const filtered = list.filter(q => {
      const matchSearch = !term || q.query.toLowerCase().includes(term);
      if (!matchSearch) return false;

      if (filter === 'prime') return q.citationLikelihood === 'prime';
      if (filter === 'high') return q.citationLikelihood === 'high' || q.citationLikelihood === 'prime';
      if (filter === 'how_to') return q.aiIntent === 'how_to';
      if (filter === 'comparative') return q.aiIntent === 'comparative';
      return true;
    });

    const field = genAiSortField();
    const dir = genAiSortDir();
    const mult = dir === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      if (field === 'query') return mult * a.query.localeCompare(b.query);
      if (field === 'aiIntent') return mult * (a.aiIntent || '').localeCompare(b.aiIntent || '');
      if (field === 'citationLikelihood') return mult * (a.position - b.position);
      return mult * (Number(a[field as keyof GenAiQueryMetric] ?? 0) - Number(b[field as keyof GenAiQueryMetric] ?? 0));
    });
  };

  const formatIntentLabel = (intent?: GenAiIntentType) => {
    switch (intent) {
      case 'how_to': return 'Procedural / How-To';
      case 'comparative': return 'Comparison / Review';
      case 'informational': return 'Informational Q&A';
      case 'conversational': return 'Conversational Long-Tail';
      default: return 'Standard';
    }
  };

  const getFullPageUrl = (page: string) => {
    if (page.startsWith('http://') || page.startsWith('https://')) return page;
    const base = props.siteUrl.replace(/\/$/, '');
    const path = page.startsWith('/') ? page : `/${page}`;
    return `${base}${path}`;
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div 
        class="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ "max-width": '1280px', width: '95vw', "max-height": '92vh' }}
      >
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
            <button
              class="btn btn-outline"
              onClick={() => setIsAuditOpen(true)}
              style={{ padding: '6px 12px', "font-size": '0.78rem', color: '#34d399', "border-color": 'rgba(16, 185, 129, 0.4)' }}
              title="Audit and verify 100% data parity against live Google Search Console API"
            >
              <ShieldCheck size={13} color="var(--color-success)" />
              <span>Verify Data Parity</span>
            </button>
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
            <button
              class={`modal-tab-btn ${activeTab() === 'genai' ? 'active' : ''}`}
              onClick={() => setActiveTab('genai')}
              style={{ display: 'flex', "align-items": 'center', gap: '6px' }}
            >
              <Sparkles size={14} color="#38bdf8" />
              <span>Generative AI & AI Overviews ({siteData()?.aiMetrics?.topAiQueries?.length || 0})</span>
            </button>
          </div>

          {/* 1. Queries Tab */}
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
                    style={{ width: '220px' }}
                  />
                </div>
              </div>

              <div class="table-card" style={{ "max-height": '460px', "overflow-y": 'auto' }}>
                <table class="custom-table">
                  <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                    <tr>
                      <th class="sortable-th" onClick={() => handleQuerySort('query')} title="Sort by search query">
                        <div class="th-content">
                          <span>Search Query</span>
                          {renderSortIcon(querySortField(), 'query', querySortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleQuerySort('clicks')} title="Sort by clicks">
                        <div class="th-content">
                          <span>Clicks</span>
                          {renderSortIcon(querySortField(), 'clicks', querySortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleQuerySort('impressions')} title="Sort by impressions">
                        <div class="th-content">
                          <span>Impressions</span>
                          {renderSortIcon(querySortField(), 'impressions', querySortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleQuerySort('ctr')} title="Sort by CTR">
                        <div class="th-content">
                          <span>CTR</span>
                          {renderSortIcon(querySortField(), 'ctr', querySortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleQuerySort('position')} title="Sort by position">
                        <div class="th-content">
                          <span>Position</span>
                          {renderSortIcon(querySortField(), 'position', querySortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleQuerySort('opportunity')} title="Sort by opportunity">
                        <div class="th-content">
                          <span>Opportunity</span>
                          {renderSortIcon(querySortField(), 'opportunity', querySortDir())}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedQueries()}>
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

          {/* 2. Top Landing Pages Tab (Enlarged & Sortable) */}
          {activeTab() === 'pages' && (
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '12px' }}>
              <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "flex-wrap": 'wrap', gap: '10px' }}>
                <div style={{ "font-size": '0.82rem', color: 'var(--text-secondary)' }}>
                  Showing <strong>{sortedPages().length}</strong> landing pages receiving organic search visibility
                </div>

                <div class="search-input-wrapper">
                  <Search size={14} />
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Filter URL path..."
                    value={pageSearchTerm()}
                    onInput={(e) => setPageSearchTerm(e.currentTarget.value)}
                    style={{ width: '260px' }}
                  />
                </div>
              </div>

              <div class="table-card" style={{ "max-height": '560px', "overflow-y": 'auto' }}>
                <table class="custom-table" style={{ width: '100%', "table-layout": 'fixed' }}>
                  <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                    <tr>
                      <th class="sortable-th" style={{ width: '50%' }} onClick={() => handlePageSort('page')} title="Sort by URL path">
                        <div class="th-content">
                          <span>URL Path</span>
                          {renderSortIcon(pageSortField(), 'page', pageSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" style={{ width: '13%' }} onClick={() => handlePageSort('clicks')} title="Sort by clicks">
                        <div class="th-content">
                          <span>Clicks</span>
                          {renderSortIcon(pageSortField(), 'clicks', pageSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" style={{ width: '14%' }} onClick={() => handlePageSort('impressions')} title="Sort by impressions">
                        <div class="th-content">
                          <span>Impressions</span>
                          {renderSortIcon(pageSortField(), 'impressions', pageSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" style={{ width: '11%' }} onClick={() => handlePageSort('ctr')} title="Sort by CTR">
                        <div class="th-content">
                          <span>CTR</span>
                          {renderSortIcon(pageSortField(), 'ctr', pageSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" style={{ width: '12%' }} onClick={() => handlePageSort('position')} title="Sort by average position">
                        <div class="th-content">
                          <span>Avg Pos</span>
                          {renderSortIcon(pageSortField(), 'position', pageSortDir())}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedPages()}>
                      {(p) => {
                        const fullUrl = getFullPageUrl(p.page);
                        const isCopied = copiedUrl() === fullUrl;
                        return (
                          <tr>
                            <td style={{ "word-break": 'break-all', "padding-right": '14px' }}>
                              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', gap: '8px' }}>
                                <a 
                                  href={fullUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{
                                    "font-family": 'monospace',
                                    "font-size": '0.82rem',
                                    color: 'var(--text-accent)',
                                    "text-decoration": 'none',
                                    display: 'inline-flex',
                                    "align-items": 'center',
                                    gap: '5px',
                                    "line-height": 1.4
                                  }}
                                  class="page-link-hover"
                                  title={`Open ${fullUrl}`}
                                >
                                  <span>{p.page}</span>
                                  <ExternalLink size={12} style={{ opacity: 0.6, "flex-shrink": 0 }} />
                                </a>

                                <button
                                  class="btn-icon-subtle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(fullUrl);
                                  }}
                                  title="Copy URL"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: isCopied ? 'var(--color-success)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    "border-radius": '4px',
                                    "flex-shrink": 0
                                  }}
                                >
                                  {isCopied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                                </button>
                              </div>
                            </td>
                            <td style={{ color: 'var(--color-secondary)', "font-weight": 600, "font-family": 'var(--font-heading)' }}>
                              {p.clicks.toLocaleString()}
                            </td>
                            <td style={{ color: 'var(--color-purple)', "font-family": 'var(--font-heading)' }}>
                              {p.impressions.toLocaleString()}
                            </td>
                            <td style={{ color: 'var(--color-success)', "font-weight": 600 }}>
                              {p.ctr}%
                            </td>
                            <td style={{ color: 'var(--color-warning)', "font-weight": 700 }}>
                              {p.position}
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Generative AI & AI Overviews Tab */}
          {activeTab() === 'genai' && (
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
              {/* Executive GenAI Cards */}
              <div style={{
                display: 'grid',
                "grid-template-columns": 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div class="metric-card" style={{ padding: '16px' }}>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-secondary)', "text-transform": 'uppercase', "letter-spacing": '0.04em' }}>
                    AI-Eligible Impressions
                  </div>
                  <div style={{ "font-size": '1.5rem', "font-weight": 700, color: '#38bdf8', "margin-top": '4px' }}>
                    {(siteData()?.aiMetrics?.aiImpressions || 0).toLocaleString()}
                  </div>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-muted)', "margin-top": '4px' }}>
                    <strong>{siteData()?.aiMetrics?.aiShareOfImpressions || 0}%</strong> of site search footprint
                  </div>
                </div>

                <div class="metric-card" style={{ padding: '16px' }}>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-secondary)', "text-transform": 'uppercase', "letter-spacing": '0.04em' }}>
                    AI-Eligible Clicks
                  </div>
                  <div style={{ "font-size": '1.5rem', "font-weight": 700, color: '#22d3ee', "margin-top": '4px' }}>
                    {(siteData()?.aiMetrics?.aiClicks || 0).toLocaleString()}
                  </div>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-muted)', "margin-top": '4px' }}>
                    <strong>{siteData()?.aiMetrics?.aiShareOfClicks || 0}%</strong> of total organic clicks
                  </div>
                </div>

                <div class="metric-card" style={{ padding: '16px' }}>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-secondary)', "text-transform": 'uppercase', "letter-spacing": '0.04em' }}>
                    AI Overview Citation Score
                  </div>
                  <div style={{ display: 'flex', "align-items": 'baseline', gap: '8px', "margin-top": '4px' }}>
                    <span style={{ "font-size": '1.5rem', "font-weight": 700, color: '#a78bfa' }}>
                      {siteData()?.aiMetrics?.readinessScore || 0}/100
                    </span>
                    <span class="trend-badge positive" style={{ "font-size": '0.7rem' }}>
                      {(siteData()?.aiMetrics?.readinessScore || 0) >= 65 ? 'Prime Citation' : 'Growing AI Share'}
                    </span>
                  </div>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-muted)', "margin-top": '4px' }}>
                    Based on Top 3 ranks on Q&A queries
                  </div>
                </div>

                <div class="metric-card" style={{ padding: '16px' }}>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-secondary)', "text-transform": 'uppercase', "letter-spacing": '0.04em' }}>
                    Avg AI Overview Position
                  </div>
                  <div style={{ "font-size": '1.5rem', "font-weight": 700, color: '#fbbf24', "margin-top": '4px' }}>
                    {siteData()?.aiMetrics?.aiAvgPosition || 0}
                  </div>
                  <div style={{ "font-size": '0.74rem', color: 'var(--text-muted)', "margin-top": '4px' }}>
                    CTR: <strong>{siteData()?.aiMetrics?.aiCtr || 0}%</strong>
                  </div>
                </div>
              </div>

              {/* Intent Distribution Ribbon */}
              <Show when={(siteData()?.aiMetrics?.intentBreakdown || []).length > 0}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px 18px',
                  "border-radius": 'var(--radius-md)',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'space-between',
                  "flex-wrap": 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ "font-size": '0.8rem', "font-weight": 600, color: '#fff', display: 'flex', "align-items": 'center', gap: '6px' }}>
                    <Bot size={15} color="#38bdf8" />
                    <span>Generative Intent Mix:</span>
                  </div>
                  <div style={{ display: 'flex', "flex-wrap": 'wrap', gap: '8px' }}>
                    <For each={siteData()?.aiMetrics?.intentBreakdown || []}>
                      {(b) => (
                        <div style={{
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '4px 10px',
                          "border-radius": 'var(--radius-full)',
                          "font-size": '0.75rem',
                          display: 'flex',
                          "align-items": 'center',
                          gap: '6px'
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{b.label}:</span>
                          <strong style={{ color: '#38bdf8' }}>{b.clicks.toLocaleString()} clicks</strong>
                          <span style={{ color: 'var(--text-muted)', "font-size": '0.7rem' }}>({b.queryCount} queries)</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Generative AI Queries Controls */}
              <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "flex-wrap": 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    class={`date-btn ${genAiFilter() === 'all' ? 'active' : ''}`}
                    onClick={() => setGenAiFilter('all')}
                  >
                    All AI Queries ({siteData()?.aiMetrics?.topAiQueries?.length || 0})
                  </button>
                  <button
                    class={`date-btn ${genAiFilter() === 'prime' ? 'active' : ''}`}
                    onClick={() => setGenAiFilter('prime')}
                  >
                    ⭐ Prime Citations (Pos 1–3)
                  </button>
                  <button
                    class={`date-btn ${genAiFilter() === 'how_to' ? 'active' : ''}`}
                    onClick={() => setGenAiFilter('how_to')}
                  >
                    🛠️ How-To & Procedural
                  </button>
                  <button
                    class={`date-btn ${genAiFilter() === 'comparative' ? 'active' : ''}`}
                    onClick={() => setGenAiFilter('comparative')}
                  >
                    ⚖️ Comparisons & Reviews
                  </button>
                </div>

                <div class="search-input-wrapper">
                  <Search size={14} />
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Filter AI prompt..."
                    value={genAiSearchTerm()}
                    onInput={(e) => setGenAiSearchTerm(e.currentTarget.value)}
                    style={{ width: '220px' }}
                  />
                </div>
              </div>

              {/* Generative AI Queries Table */}
              <div class="table-card" style={{ "max-height": '460px', "overflow-y": 'auto' }}>
                <table class="custom-table">
                  <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                    <tr>
                      <th class="sortable-th" onClick={() => handleGenAiSort('query')} title="Sort by query">
                        <div class="th-content">
                          <span>Search Query / Conversational Prompt</span>
                          {renderSortIcon(genAiSortField(), 'query', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('aiIntent')} title="Sort by intent">
                        <div class="th-content">
                          <span>Intent Type</span>
                          {renderSortIcon(genAiSortField(), 'aiIntent', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('clicks')} title="Sort by clicks">
                        <div class="th-content">
                          <span>Clicks</span>
                          {renderSortIcon(genAiSortField(), 'clicks', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('impressions')} title="Sort by impressions">
                        <div class="th-content">
                          <span>Impressions</span>
                          {renderSortIcon(genAiSortField(), 'impressions', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('ctr')} title="Sort by CTR">
                        <div class="th-content">
                          <span>CTR</span>
                          {renderSortIcon(genAiSortField(), 'ctr', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('position')} title="Sort by rank position">
                        <div class="th-content">
                          <span>Avg Pos</span>
                          {renderSortIcon(genAiSortField(), 'position', genAiSortDir())}
                        </div>
                      </th>
                      <th class="sortable-th" onClick={() => handleGenAiSort('citationLikelihood')} title="Sort by citation potential">
                        <div class="th-content">
                          <span>Citation Potential</span>
                          {renderSortIcon(genAiSortField(), 'citationLikelihood', genAiSortDir())}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedGenAiQueries()}>
                      {(q) => (
                        <tr>
                          <td style={{ "font-weight": 600, color: '#f8fafc' }}>
                            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                              <Sparkles size={13} color="#38bdf8" />
                              <span>{q.query}</span>
                            </div>
                          </td>
                          <td>
                            <span class="engine-pill" style={{ color: 'var(--text-accent)' }}>
                              {formatIntentLabel(q.aiIntent)}
                            </span>
                          </td>
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
                            {q.citationLikelihood === 'prime' ? (
                              <span class="trend-badge positive">⭐ Prime Citation Source</span>
                            ) : q.citationLikelihood === 'high' ? (
                              <span class="trend-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                                High Potential
                              </span>
                            ) : (
                              <span class="trend-badge neutral">Growth Opportunity</span>
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
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>

      <Show when={isAuditOpen()}>
        <DataAuditModal siteUrl={props.siteUrl} onClose={() => setIsAuditOpen(false)} />
      </Show>
    </div>
  );
};
