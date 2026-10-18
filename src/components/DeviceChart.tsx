import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { Smartphone } from 'lucide-solid';

interface DeviceItem {
  device: string;
  clicks: number;
  impressions: number;
  percentage: number;
}

interface DeviceChartProps {
  data: DeviceItem[];
}

export const DeviceChart: Component<DeviceChartProps> = (props) => {
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

    const items = props.data || [];
    const colors: Record<string, string> = {
      Mobile: '#06b6d4',
      Desktop: '#6366f1',
      Tablet: '#f59e0b'
    };

    const pieData = items.map(item => ({
      name: item.device,
      value: item.clicks,
      itemStyle: { color: colors[item.device] || '#94a3b8' }
    }));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter: (params: any) => `
          <div style="font-weight:600;color:#fff">${params.name}</div>
          <div style="color:#94a3b8">Clicks: <strong style="color:#06b6d4">${params.value.toLocaleString()}</strong> (${params.percent}%)</div>
        `
      },
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        textStyle: { color: '#94a3b8', fontSize: 11 }
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 2
          },
          label: { show: false },
          data: pieData
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
            <Smartphone size={18} color="var(--color-secondary)" />
            Device Breakdown
          </h3>
          <p>Clicks across Mobile, Desktop, and Tablet</p>
        </div>
      </div>
      <div class="chart-container-render compact" ref={containerRef}></div>
    </div>
  );
};
