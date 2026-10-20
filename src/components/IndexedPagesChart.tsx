import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { FileSearch } from 'lucide-solid';

interface IndexedPagesChartProps {
  timeline: { date: string; page_count: number }[];
  title?: string;
}

export const IndexedPagesChart: Component<IndexedPagesChartProps> = (props) => {
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
    const timeline = props.timeline || [];
    const dates = timeline.map((d) => d.date);
    const counts = timeline.map((d) => d.page_count);

    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 48, right: 20, top: 36, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div style="font-weight:600;margin-bottom:4px">${p.axisValue}</div>
            <div>Indexed pages: <b>${Number(p.value).toLocaleString()}</b></div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Pages',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: {
          color: '#94a3b8',
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
              { offset: 0, color: 'rgba(56, 189, 248, 0.35)' },
              { offset: 1, color: 'rgba(56, 189, 248, 0.02)' }
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
        <h3 style={{ "font-family": 'var(--font-heading)', "font-size": '0.95rem', "font-weight": 600, color: '#fff', margin: 0 }}>
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
