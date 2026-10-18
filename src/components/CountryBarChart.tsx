import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { Globe2 } from 'lucide-solid';

interface CountryItem {
  country: string;
  flag?: string;
  clicks: number;
  impressions?: number;
  pct?: number;
}

interface CountryBarChartProps {
  data: CountryItem[];
}

export const CountryBarChart: Component<CountryBarChartProps> = (props) => {
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

    const items = [...(props.data || [])].reverse(); // Reverse for bottom-to-top horizontal bar
    const categories = items.map(c => (c.flag ? `${c.flag} ` : '') + (c.country || 'Unknown').toUpperCase());
    const values = items.map(c => c.clicks);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `
            <div style="font-weight:600;color:#fff">${item.name}</div>
            <div style="color:#94a3b8">Clicks: <strong style="color:#10b981">${item.value.toLocaleString()}</strong></div>
          `;
        }
      },
      grid: {
        top: 15,
        right: 30,
        bottom: 20,
        left: 110,
        containLabel: false
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)
        }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#e2e8f0', fontSize: 11 }
      },
      series: [
        {
          type: 'bar',
          data: values,
          barWidth: 12,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#06b6d4' }
            ])
          }
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
            <Globe2 size={18} color="var(--color-success)" />
            Top Markets (Geo)
          </h3>
          <p>Search visibility and clicks by country</p>
        </div>
      </div>
      <div class="chart-container-render compact" ref={containerRef}></div>
    </div>
  );
};
