import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { PieChart } from 'lucide-solid';

interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  clicks: number;
  impressions: number;
}

interface CategoryDonutChartProps {
  data: CategoryBreakdownItem[];
  onSelectCategory?: (id: string) => void;
}

export const CategoryDonutChart: Component<CategoryDonutChartProps> = (props) => {
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
    const totalClicks = items.reduce((acc, item) => acc + item.clicks, 0);

    const pieData = items.map(item => ({
      name: item.name,
      value: item.clicks,
      itemStyle: { color: item.color },
      categoryId: item.categoryId
    }));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: true,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter: (params: any) => {
          const val = params.value.toLocaleString();
          return `
            <div style="font-weight:600;margin-bottom:4px;color:#fff">${params.name}</div>
            <div style="display:flex;justify-content:space-between;gap:12px;color:#94a3b8">
              <span>Clicks:</span>
              <strong style="color:#06b6d4">${val}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;color:#94a3b8">
              <span>Share:</span>
              <strong style="color:#fff">${params.percent}%</strong>
            </div>
          `;
        }
      },
      legend: {
        bottom: 5,
        left: 'center',
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        textStyle: { color: '#94a3b8', fontSize: 11 }
      },
      series: [
        {
          name: 'Traffic by Category',
          type: 'pie',
          radius: ['52%', '75%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 3
          },
          label: {
            show: true,
            position: 'center',
            formatter: () => {
              const formatted = totalClicks >= 1000 ? `${(totalClicks / 1000).toFixed(1)}k` : totalClicks.toString();
              return `{total|${formatted}}\n{lbl|Total Clicks}`;
            },
            rich: {
              total: {
                color: '#ffffff',
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 28,
                fontFamily: 'Outfit, sans-serif'
              },
              lbl: {
                color: '#94a3b8',
                fontSize: 11,
                lineHeight: 16
              }
            }
          },
          emphasis: {
            scaleSize: 8,
            label: {
              show: true
            }
          },
          data: pieData
        }
      ]
    };

    chartInstance.setOption(option, true);

    chartInstance.off('click');
    chartInstance.on('click', (params: any) => {
      if (params.data?.categoryId && props.onSelectCategory) {
        props.onSelectCategory(params.data.categoryId);
      }
    });
  });

  return (
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-area">
          <h3>
            <PieChart size={18} color="var(--color-primary)" />
            Category Share
          </h3>
          <p>Distribution of search traffic across website categories</p>
        </div>
      </div>
      <div class="chart-container-render" ref={containerRef}></div>
    </div>
  );
};
