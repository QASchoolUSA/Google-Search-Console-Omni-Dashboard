import { Component, For, Show } from 'solid-js';
import { FileSearch, TrendingUp, TrendingDown, Minus } from 'lucide-solid';
import { SiteIndexStats, IndexTrendPoint } from '../types';

interface IndexedPagesWidgetProps {
  stats?: SiteIndexStats | null;
  compact?: boolean;
}

const TREND_ORDER = [3, 7, 14, 30, 60] as const;

export const IndexedPagesWidget: Component<IndexedPagesWidgetProps> = (props) => {
  const formatNumber = (n?: number | null) => {
    if (n === null || n === undefined) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  };

  const renderTrendBadge = (t: IndexTrendPoint) => {
    if (t.changePct === null || t.changePct === undefined) {
      return (
        <span class="trend-badge neutral" title={`No snapshot ~${t.days}d ago yet`}>
          <Minus size={11} />
          <span>—</span>
        </span>
      );
    }
    const isZero = t.changePct === 0;
    const isPositive = t.changePct > 0;
    const cls = isZero ? 'neutral' : isPositive ? 'positive' : 'negative';
    return (
      <span
        class={`trend-badge ${cls}`}
        title={`${t.previousCount?.toLocaleString() ?? '?'} → current (${t.previousDate || 'n/a'})`}
      >
        {isZero ? <Minus size={11} /> : isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        <span>{isPositive ? '+' : ''}{t.changePct}%</span>
      </span>
    );
  };

  const trendsByDays = () => {
    const map = new Map<number, IndexTrendPoint>();
    for (const t of props.stats?.trends || []) {
      map.set(t.days, t);
    }
    return TREND_ORDER.map((days) => map.get(days) || {
      days,
      previousCount: null,
      change: null,
      changePct: null,
      previousDate: null
    } as IndexTrendPoint);
  };

  return (
    <div
      class="chart-card"
      style={{
        padding: props.compact ? '14px 16px' : '18px 20px',
        display: 'flex',
        "flex-direction": 'column',
        gap: '14px'
      }}
    >
      <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'flex-start', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "margin-bottom": '4px' }}>
            <FileSearch size={16} color="#38bdf8" />
            <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)', "font-weight": 600, "letter-spacing": '0.02em' }}>
              INDEXED PAGES
            </span>
          </div>
          <div style={{ display: 'flex', "align-items": 'baseline', gap: '8px', "flex-wrap": 'wrap' }}>
            <span style={{ "font-family": 'var(--font-heading)', "font-size": props.compact ? '1.6rem' : '2.1rem', "font-weight": 700, color: '#38bdf8', "line-height": 1.1 }}>
              {formatNumber(props.stats?.currentCount ?? 0)}
            </span>
            <span style={{ "font-size": props.compact ? '1rem' : '1.2rem', color: 'var(--text-secondary)', "font-weight": 500 }}>
              / {formatNumber(props.stats?.totalPages ?? (props.stats?.currentCount ?? 0))}
            </span>
            <span class="index-coverage-pill">
              {props.stats?.indexRatio ?? Math.min(100, Math.round(((props.stats?.currentCount ?? 0) / Math.max(props.stats?.totalPages ?? 1, 1)) * 100))}% indexed
            </span>
          </div>
          <div class="widget-index-progress-bar">
            <div
              class="widget-index-progress-fill"
              style={{
                width: `${Math.min(100, props.stats?.indexRatio ?? Math.round(((props.stats?.currentCount ?? 0) / Math.max(props.stats?.totalPages ?? 1, 1)) * 100))}%`
              }}
            />
          </div>
          <div style={{ "font-size": '0.72rem', color: 'var(--text-muted)', "margin-top": '6px' }}>
            {formatNumber(props.stats?.currentCount ?? 0)} indexed out of {formatNumber(props.stats?.totalPages ?? props.stats?.currentCount ?? 0)} total pages · {props.stats?.windowDays || 28}d window
            <Show when={props.stats?.asOfDate}>
              <span> · as of {props.stats!.asOfDate}</span>
            </Show>
            <Show when={props.stats?.isTruncated}>
              <span style={{ color: 'var(--color-warning)' }}> · capped at API row limit</span>
            </Show>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          "grid-template-columns": 'repeat(5, minmax(0, 1fr))',
          gap: '8px'
        }}
      >
        <For each={trendsByDays()}>
          {(t) => (
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                "border-radius": 'var(--radius-sm)',
                padding: '8px 6px',
                "text-align": 'center'
              }}
            >
              <div style={{ "font-size": '0.68rem', color: 'var(--text-muted)', "margin-bottom": '6px', "font-weight": 600 }}>
                {t.days}d
              </div>
              <div style={{ display: 'flex', "justify-content": 'center' }}>
                {renderTrendBadge(t)}
              </div>
              <Show when={t.change !== null && t.change !== undefined}>
                <div style={{ "font-size": '0.66rem', color: 'var(--text-secondary)', "margin-top": '4px' }}>
                  {t.change! > 0 ? '+' : ''}{formatNumber(t.change)}
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
