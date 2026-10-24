import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { Target } from 'lucide-solid';
import { QueryMetric } from '../types';
import { useTheme } from '../utils/theme';
import { getChartThemeTokens } from '../utils/chartTheme';

interface StrikingDistanceChartProps {
  queries: QueryMetric[];
}

export const StrikingDistanceChart: Component<StrikingDistanceChartProps> = (props) => {
  const { theme } = useTheme();
  let containerRef!: HTMLDivElement;
  let chartInstance: echarts.ECharts | null = null;

  onMount(() => {
    if (!containerRef) return;
    chartInstance = echarts.init(containerRef, null, { renderer: 'canvas' });

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      chartInstance?.dispose();
    });
  });

  createEffect(() => {
    if (!chartInstance) return;

    const t = getChartThemeTokens(theme());
    // Filter queries that are in striking distance (positions 8 to 22) or top queries
    const list = props.queries || [];
    const data = list.map(q => [
      q.position,
      q.impressions,
      q.clicks,
      q.query,
      q.ctr
    ]);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        textStyle: { color: t.tooltipText, fontSize: 12 },
        formatter: (params: any) => {
          const [pos, imp, clicks, query, ctr] = params.data;
          return `
            <div style="font-weight:700;color:${t.isDark ? '#38bdf8' : '#0284c7'};margin-bottom:6px">"${query}"</div>
            <div style="display:grid;grid-template-columns:auto auto;gap:6px;font-size:11px;color:${t.subTextColor}">
              <span>Avg Position:</span> <strong style="color:#f59e0b">${pos}</strong>
              <span>Impressions:</span> <strong style="color:#a855f7">${imp.toLocaleString()}</strong>
              <span>Clicks:</span> <strong style="color:#06b6d4">${clicks.toLocaleString()}</strong>
              <span>CTR:</span> <strong style="color:#10b981">${ctr}%</strong>
            </div>
          `;
        }
      },
      grid: {
        top: 30,
        right: 25,
        bottom: 40,
        left: 55,
        containLabel: false
      },
      xAxis: {
        type: 'value',
        name: 'Position',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: t.subTextColor, fontSize: 11 },
        min: 1,
        max: 20,
        inverse: true, // Rank 1 on left, rank 20 on right
        splitLine: { lineStyle: { color: t.splitLineColor } },
        axisLabel: { color: t.subTextColor, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: 'Impressions',
        nameTextStyle: { color: t.subTextColor, fontSize: 11 },
        splitLine: { lineStyle: { color: t.splitLineColor } },
        axisLabel: {
          color: t.subTextColor,
          fontSize: 10,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)
        }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: (val: any) => {
            const clicks = val[2];
            return Math.min(32, Math.max(12, Math.sqrt(clicks) * 0.45));
          },
          itemStyle: {
            color: (params: any) => {
              const pos = params.data[0];
              if (pos <= 3) return '#10b981'; // Green for top 3
              if (pos <= 10) return '#06b6d4'; // Cyan for Page 1
              return '#f59e0b'; // Amber for Striking Distance (Page 2)
            },
            shadowBlur: 8,
            shadowColor: t.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(15, 23, 42, 0.15)'
          },
          data
        }
      ]
    };

    chartInstance.setOption(option, true);
  });

  return (
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-area">
          <h3>
            <Target size={18} color="var(--color-warning)" />
            Striking Distance Matrix
          </h3>
          <p>Keywords in positions 8–20 with high impressions (quick-win targets)</p>
        </div>
      </div>
      <div class="chart-container-render compact" ref={containerRef}></div>
    </div>
  );
};
