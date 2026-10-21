import { Component, Show } from 'solid-js';
import { 
  MousePointerClick, 
  Eye, 
  Percent, 
  Award, 
  FileSearch,
  TrendingUp, 
  TrendingDown, 
  Minus 
} from 'lucide-solid';
import { AggregateData } from '../services/api';

interface MetricCardsProps {
  data: AggregateData | null;
  days: number;
  indexedPages?: number;
  totalPages?: number;
  indexRatio?: number;
  indexedSitesCount?: number;
  totalSitesCount?: number;
}

export const MetricCards: Component<MetricCardsProps> = (props) => {
  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  const renderTrend = (change: number, isPosition: boolean = false) => {
    // For position, negative number means improved (e.g. from position 10 to 8 is -2, which is good!)
    const isPositive = isPosition ? change > 0 : change > 0;
    const isZero = change === 0;

    let cls = isZero ? 'neutral' : (isPositive ? 'positive' : 'negative');

    return (
      <span class={`trend-badge ${cls}`}>
        {isZero ? (
          <Minus size={12} />
        ) : isPositive ? (
          <TrendingUp size={12} />
        ) : (
          <TrendingDown size={12} />
        )}
        <span>{Math.abs(change)}%</span>
      </span>
    );
  };

  return (
    <div class="kpi-grid">
      {/* Total Clicks */}
      <div class="kpi-card" style={{ '--card-accent': 'var(--color-secondary)' }}>
        <div class="kpi-header">
          <span class="kpi-title">Total Search Clicks</span>
          <div class="kpi-icon-wrap" style={{ color: 'var(--color-secondary)' }}>
            <MousePointerClick size={18} />
          </div>
        </div>
        <div class="kpi-value">
          {formatNumber(props.data?.totalClicks || 0)}
        </div>
        <div class="kpi-footer">
          {renderTrend(props.data?.clicksChange || 0)}
          <span class="trend-period">vs. prior {props.days} days</span>
        </div>
      </div>

      {/* Total Impressions */}
      <div class="kpi-card" style={{ '--card-accent': 'var(--color-purple)' }}>
        <div class="kpi-header">
          <span class="kpi-title">Total Impressions</span>
          <div class="kpi-icon-wrap" style={{ color: 'var(--color-purple)' }}>
            <Eye size={18} />
          </div>
        </div>
        <div class="kpi-value">
          {formatNumber(props.data?.totalImpressions || 0)}
        </div>
        <div class="kpi-footer">
          {renderTrend(props.data?.impressionsChange || 0)}
          <span class="trend-period">vs. prior {props.days} days</span>
        </div>
      </div>

      {/* Average CTR */}
      <div class="kpi-card" style={{ '--card-accent': 'var(--color-success)' }}>
        <div class="kpi-header">
          <span class="kpi-title">Average CTR</span>
          <div class="kpi-icon-wrap" style={{ color: 'var(--color-success)' }}>
            <Percent size={18} />
          </div>
        </div>
        <div class="kpi-value">
          {props.data?.avgCtr ? `${props.data.avgCtr}%` : '0%'}
        </div>
        <div class="kpi-footer">
          {renderTrend(props.data?.ctrChange || 0)}
          <span class="trend-period">vs. prior {props.days} days</span>
        </div>
      </div>

      {/* Average Position */}
      <div class="kpi-card" style={{ '--card-accent': 'var(--color-warning)' }}>
        <div class="kpi-header">
          <span class="kpi-title">Average Position</span>
          <div class="kpi-icon-wrap" style={{ color: 'var(--color-warning)' }}>
            <Award size={18} />
          </div>
        </div>
        <div class="kpi-value">
          {props.data?.avgPosition ? `${props.data.avgPosition}` : '0.0'}
        </div>
        <div class="kpi-footer">
          {renderTrend(props.data?.positionChange || 0, true)}
          <span class="trend-period">rank improvement</span>
        </div>
      </div>

      {/* Total Indexed Pages */}
      <div class="kpi-card" style={{ '--card-accent': '#38bdf8' }}>
        <div class="kpi-header">
          <span class="kpi-title">Total Indexed Pages</span>
          <div class="kpi-icon-wrap" style={{ color: '#38bdf8' }}>
            <FileSearch size={18} />
          </div>
        </div>
        <div class="kpi-value">
          <span>{formatNumber(props.indexedPages || 0)}</span>
          <Show when={(props.totalPages || 0) > 0}>
            <span class="kpi-subvalue">/ {formatNumber(props.totalPages || 0)}</span>
          </Show>
        </div>
        <div class="kpi-progress-bar">
          <div
            class="kpi-progress-fill"
            style={{ width: `${Math.min(100, props.indexRatio ?? 0)}%` }}
          />
        </div>
        <div class="kpi-footer">
          <span class="trend-badge positive">
            <span>{props.indexRatio ?? 0}%</span>
          </span>
          <span class="trend-period">
            {props.indexedSitesCount !== undefined && props.totalSitesCount !== undefined
              ? `${props.indexedSitesCount} of ${props.totalSitesCount} sites`
              : 'indexed coverage'}
          </span>
        </div>
      </div>
    </div>
  );
};
