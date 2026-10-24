import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { FileSearch } from 'lucide-solid';
import { useTheme } from '../utils/theme';
import { getChartThemeTokens } from '../utils/chartTheme';

interface IndexedPagesChartProps {
  timeline: { date: string; page_count: number }[];
  title?: string;
}

export const IndexedPagesChart: Component<IndexedPagesChartProps> = (props) => {
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
    const timeline = props.timeline || [];
    const dates = timeline.map((d) => d.date);
    const counts = timeline.map((d) => d.page_count);

    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 48, right: 20, top: 36, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        textStyle: { color: t.tooltipText, fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div style="font-weight:600;margin-bottom:4px;color:${t.textColor}">${p.axisValue}</div>
            <div style="color:${t.subTextColor}">Indexed pages: <b style="color:${t.textColor}">${Number(p.value).toLocaleString()}</b></div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: t.axisLineColor } },
        axisLabel: { color: t.subTextColor, fontSize: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Pages',
        nameTextStyle: { color: t.subTextColor, fontSize: 11 },
        splitLine: { lineStyle: { color: t.splitLineColor } },
        axisLabel: {
          color: t.subTextColor,
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)
        }
      },
      series: [
        {
          name: 'Indexed pages',
          type: 'line',
          smooth: true,
          showSymbol: dates.length <= 14,
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#38bdf8' },
          itemStyle: { color: '#38bdf8' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: t.isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.22)' },
              { offset: 1, color: t.isDark ? 'rgba(56, 189, 248, 0.02)' : 'rgba(56, 189, 248, 0.01)' }
            ])
          },
          data: counts
        }
      ]
    }, true);
  });

  return (
    <div class="chart-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "margin-bottom": '8px' }}>
        <FileSearch size={16} color="#38bdf8" />
        <h3 style={{ "font-family": 'var(--font-heading)', "font-size": '0.95rem', "font-weight": 600, color: 'var(--text-primary)', margin: 0 }}>
          {props.title || 'Indexed Pages Trend'}
        </h3>
      </div>
      <p style={{ "font-size": '0.72rem', color: 'var(--text-muted)', "margin-bottom": '8px' }}>
        Unique URLs with search impressions (28-day rolling window) — GSC indexed-visibility proxy
      </p>
      <div ref={containerRef!} style={{ width: '100%', height: '220px' }} />
    </div>
  );
};
