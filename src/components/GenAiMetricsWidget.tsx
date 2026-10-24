import { Component, For, Show } from 'solid-js';
import { Sparkles, Bot } from 'lucide-solid';
import { GenerativeAiMetrics, GenAiIntentType } from '../types';

interface GenAiMetricsWidgetProps {
  data?: GenerativeAiMetrics;
  onSelectQuery?: (query: string) => void;
}

export const GenAiMetricsWidget: Component<GenAiMetricsWidgetProps> = (props) => {
  const formatNumber = (n?: number) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  };

  const formatIntentLabel = (intent?: GenAiIntentType) => {
    switch (intent) {
      case 'how_to': return '🛠️ How-To & Procedural';
      case 'comparative': return '⚖️ Comparison & Review';
      case 'informational': return '💡 Informational Q&A';
      case 'conversational': return '💬 Conversational Long-Tail';
      default: return 'Standard Search';
    }
  };

  return (
    <div class="genai-widget-card">
      <div class="genai-widget-header">
        <div class="genai-widget-title-group">
          <div class="genai-icon-box">
            <Sparkles size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <h3 style={{ "font-family": 'var(--font-heading)', "font-size": '1.1rem', "font-weight": 600, color: 'var(--text-primary)' }}>
                Generative AI & AI Overviews Intelligence
              </h3>
              <span class="genai-badge-pill">
                AI Search Ready
              </span>
            </div>
            <p style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>
              Tracking visibility, conversational question queries, and citation readiness across Google AI Overviews & answer engines
            </p>
          </div>
        </div>

        <Show when={props.data}>
          <div class="genai-score-banner">
            <span style={{ "font-size": '0.74rem', color: 'var(--text-secondary)', "text-transform": 'uppercase', "letter-spacing": '0.04em' }}>
              AI Citation Readiness
            </span>
            <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
              <strong style={{ "font-size": '1.25rem', color: '#38bdf8', "font-family": 'var(--font-heading)' }}>
                {props.data?.readinessScore || 0}/100
              </strong>
              <span class="trend-badge positive" style={{ "font-size": '0.7rem', padding: '2px 6px' }}>
                {(props.data?.readinessScore || 0) >= 60 ? 'High Citation Potential' : 'Expanding Footprint'}
              </span>
            </div>
          </div>
        </Show>
      </div>

      {/* 4 Stats Grid */}
      <div class="genai-stats-row">
        <div class="genai-stat-box">
          <div class="lbl">AI-Eligible Clicks</div>
          <div class="val" style={{ color: 'var(--color-secondary)' }}>
            {formatNumber(props.data?.aiClicks)}
          </div>
          <div class="sub">
            <strong>{props.data?.aiShareOfClicks || 0}%</strong> of portfolio clicks
          </div>
        </div>

        <div class="genai-stat-box">
          <div class="lbl">AI-Eligible Impressions</div>
          <div class="val" style={{ color: 'var(--color-purple)' }}>
            {formatNumber(props.data?.aiImpressions)}
          </div>
          <div class="sub">
            <strong>{props.data?.aiShareOfImpressions || 0}%</strong> of total search impressions
          </div>
        </div>

        <div class="genai-stat-box">
          <div class="lbl">Average Position in AI Results</div>
          <div class="val" style={{ color: 'var(--color-warning)' }}>
            {props.data?.aiAvgPosition || 0}
          </div>
          <div class="sub">
            Pages 1–3 citation sweet spot
          </div>
        </div>

        <div class="genai-stat-box">
          <div class="lbl">Avg CTR on AI Queries</div>
          <div class="val" style={{ color: 'var(--color-success)' }}>
            {props.data?.aiCtr || 0}%
          </div>
          <div class="sub">
            Targeting direct user answers
          </div>
        </div>
      </div>

      {/* Breakdown Row: Intent Distribution & Top AI Candidate Queries */}
      <div class="genai-content-grid">
        {/* Intent Distribution */}
        <div class="genai-subcard">
          <h4 style={{ "font-size": '0.85rem', "font-weight": 600, color: 'var(--text-primary)', "margin-bottom": '12px', display: 'flex', "align-items": 'center', gap: '6px' }}>
            <Bot size={15} color="#38bdf8" />
            <span>Generative Query Intent Distribution</span>
          </h4>

          <Show 
            when={(props.data?.intentBreakdown || []).length > 0}
            fallback={
              <div style={{ color: 'var(--text-muted)', "font-size": '0.8rem', padding: '20px 0', "text-align": 'center' }}>
                Sync Google Search Console to populate generative search intents.
              </div>
            }
          >
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
              <For each={props.data?.intentBreakdown || []}>
                {(b) => {
                  const totalImp = props.data?.aiImpressions || 1;
                  const pct = Math.min(100, Math.round((b.impressions / totalImp) * 100));
                  return (
                    <div style={{ display: 'flex', "flex-direction": 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', "justify-content": 'space-between', "font-size": '0.78rem' }}>
                        <span style={{ color: 'var(--text-primary)', "font-weight": 500 }}>{formatIntentLabel(b.intent)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>{formatNumber(b.clicks)}</strong> clicks • {formatNumber(b.impressions)} imp
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', "border-radius": '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: b.intent === 'how_to' ? 'linear-gradient(90deg, #06b6d4, #3b82f6)' :
                                        b.intent === 'comparative' ? 'linear-gradient(90deg, #ec4899, #8b5cf6)' :
                                        b.intent === 'informational' ? 'linear-gradient(90deg, #10b981, #06b6d4)' :
                                        'linear-gradient(90deg, #f59e0b, #ef4444)',
                            "border-radius": '3px'
                          }} 
                        />
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Top AI Candidate Queries */}
        <div class="genai-subcard">
          <h4 style={{ "font-size": '0.85rem', "font-weight": 600, color: 'var(--text-primary)', "margin-bottom": '12px', display: 'flex', "align-items": 'center', gap: '6px' }}>
            <Sparkles size={15} color="#a78bfa" />
            <span>Top AI Overview Candidate Queries</span>
          </h4>

          <Show
            when={(props.data?.topAiQueries || []).length > 0}
            fallback={
              <div style={{ color: 'var(--text-muted)', "font-size": '0.8rem', padding: '20px 0', "text-align": 'center' }}>
                No conversational search queries detected yet in the current date range.
              </div>
            }
          >
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px', "max-height": '220px', "overflow-y": 'auto' }}>
              <For each={(props.data?.topAiQueries || []).slice(0, 6)}>
                {(q) => (
                  <div style={{
                    display: 'flex',
                    "align-items": 'center',
                    "justify-content": 'space-between',
                    padding: '8px 12px',
                    background: 'var(--surface-input)',
                    border: '1px solid var(--border-subtle)',
                    "border-radius": 'var(--radius-sm)',
                    gap: '10px'
                  }}>
                    <div style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap', "max-width": '65%' }}>
                      <div style={{ "font-size": '0.82rem', "font-weight": 600, color: 'var(--text-primary)', overflow: 'hidden', "text-overflow": 'ellipsis' }}>
                        "{q.query}"
                      </div>
                      <div style={{ "font-size": '0.7rem', color: 'var(--text-muted)' }}>
                        Rank #{q.position} • {formatNumber(q.impressions)} impressions
                      </div>
                    </div>

                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "flex-shrink": 0 }}>
                      <span style={{ "font-size": '0.8rem', "font-weight": 600, color: 'var(--color-secondary)' }}>
                        {formatNumber(q.clicks)} clicks
                      </span>
                      {q.citationLikelihood === 'prime' ? (
                        <span class="trend-badge positive" style={{ "font-size": '0.68rem', padding: '2px 6px' }}>
                          Prime Source
                        </span>
                      ) : q.citationLikelihood === 'high' ? (
                        <span class="trend-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', "font-size": '0.68rem', padding: '2px 6px' }}>
                          High Potential
                        </span>
                      ) : (
                        <span class="trend-badge neutral" style={{ "font-size": '0.68rem', padding: '2px 6px' }}>
                          Opportunity
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
