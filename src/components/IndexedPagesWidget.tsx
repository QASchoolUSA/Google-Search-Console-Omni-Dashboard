import { Component, For, Show, createSignal } from 'solid-js';
import { FileSearch, TrendingUp, TrendingDown, Minus, Edit2, Check, X } from 'lucide-solid';
import { SiteIndexStats, IndexTrendPoint } from '../types';

interface IndexedPagesWidgetProps {
  stats?: SiteIndexStats | null;
  compact?: boolean;
  onUpdateTotalPages?: (newTotal: number) => Promise<void>;
}

const TREND_ORDER = [3, 7, 14, 30, 60] as const;

export const IndexedPagesWidget: Component<IndexedPagesWidgetProps> = (props) => {
  const [isEditingTotal, setIsEditingTotal] = createSignal(false);
  const [editTotalValue, setEditTotalValue] = createSignal<number>(props.stats?.totalPages ?? 0);
  const [isSaving, setIsSaving] = createSignal(false);

  const handleSaveTotal = async () => {
    if (!props.onUpdateTotalPages) return;
    const val = Number(editTotalValue());
    if (isNaN(val) || val < 0) return;
    setIsSaving(true);
    await props.onUpdateTotalPages(val);
    setIsSaving(false);
    setIsEditingTotal(false);
  };

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
            <Show when={!isEditingTotal()}>
              <span style={{ "font-size": props.compact ? '1rem' : '1.2rem', color: 'var(--text-secondary)', "font-weight": 500, display: 'inline-flex', "align-items": 'center', gap: '4px' }}>
                out of {formatNumber(props.stats?.totalPages ?? (props.stats?.currentCount ?? 0))}
                <Show when={props.onUpdateTotalPages}>
                  <button
                    onClick={() => {
                      setEditTotalValue(props.stats?.totalPages ?? (props.stats?.currentCount ?? 0));
                      setIsEditingTotal(true);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                    title="Manually adjust total website pages"
                  >
                    <Edit2 size={13} />
                  </button>
                </Show>
              </span>
            </Show>
            <Show when={isEditingTotal()}>
              <div style={{ display: 'inline-flex', "align-items": 'center', gap: '4px' }}>
                <span style={{ "font-size": '0.9rem', color: 'var(--text-secondary)' }}>out of</span>
                <input
                  type="number"
                  min="0"
                  class="form-input"
                  style={{ width: '85px', padding: '2px 6px', "font-size": '0.85rem', height: '26px' }}
                  value={editTotalValue()}
                  onInput={(e) => setEditTotalValue(parseInt(e.currentTarget.value, 10) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTotal();
                    if (e.key === 'Escape') setIsEditingTotal(false);
                  }}
                  autofocus
                />
                <button
                  class="btn btn-primary"
                  style={{ padding: '2px 6px', height: '26px' }}
                  onClick={handleSaveTotal}
                  disabled={isSaving()}
                  title="Save total pages"
                >
                  <Check size={12} />
                </button>
                <button
                  class="btn btn-outline"
                  style={{ padding: '2px 6px', height: '26px' }}
                  onClick={() => setIsEditingTotal(false)}
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </div>
            </Show>
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
                background: 'var(--card-sub-bg)',
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
