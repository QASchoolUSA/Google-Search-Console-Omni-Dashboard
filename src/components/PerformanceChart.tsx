import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { TrendingUp } from 'lucide-solid';
import { DailyMetric } from '../types';
import { useTheme } from '../utils/theme';
import { getChartThemeTokens } from '../utils/chartTheme';

interface PerformanceChartProps {
  timeline: DailyMetric[];
  title?: string;
  categoryName?: string;
}

export const PerformanceChart: Component<PerformanceChartProps> = (props) => {
  const { theme } = useTheme();
  let containerRef!: HTMLDivElement;
  let chartInstance: echarts.ECharts | null = null;

  const [showClicks, setShowClicks] = createSignal(true);
  const [showImpressions, setShowImpressions] = createSignal(true);
  const [showCtr, setShowCtr] = createSignal(false);
  const [showPosition, setShowPosition] = createSignal(false);

  onMount(() => {
    if (!containerRef) return;

    chartInstance = echarts.init(containerRef, null, {
      renderer: 'canvas' // Hardware accelerated Canvas/WebGL
    });

    const handleResize = () => {
      chartInstance?.resize();
    };

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
    const dates = timeline.map(d => d.date);
    const clicks = timeline.map(d => d.clicks);
    const impressions = timeline.map(d => d.impressions);
    const ctr = timeline.map(d => d.ctr);
    const position = timeline.map(d => d.position);

    const series: any[] = [];
    const yAxes: any[] = [
      {
        type: 'value',
        name: 'Clicks',
        nameTextStyle: { color: t.subTextColor, fontSize: 11 },
        position: 'left',
        splitLine: { lineStyle: { color: t.splitLineColor } },
        axisLabel: {
          color: t.subTextColor,
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)
        }
      },
      {
        type: 'value',
        name: 'Impressions',
        nameTextStyle: { color: t.subTextColor, fontSize: 11 },
        position: 'right',
        splitLine: { show: false },
        axisLabel: {
          color: t.subTextColor,
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)
        }
      }
    ];

    if (showClicks()) {
      series.push({
        name: 'Clicks',
        type: 'line',
        smooth: 0.35,
        symbol: 'none',
        yAxisIndex: 0,
        data: clicks,
        itemStyle: { color: '#06b6d4' },
        lineStyle: { width: 3, shadowColor: t.isDark ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.25)', shadowBlur: 10 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: t.isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.25)' },
            { offset: 0.8, color: t.isDark ? 'rgba(6, 182, 212, 0.03)' : 'rgba(6, 182, 212, 0.01)' },
            { offset: 1, color: 'transparent' }
          ])
        }
      });
    }

    if (showImpressions()) {
      series.push({
        name: 'Impressions',
        type: 'line',
        smooth: 0.35,
        symbol: 'none',
        yAxisIndex: 1,
        data: impressions,
        itemStyle: { color: '#a855f7' },
        lineStyle: { width: 2.5, shadowColor: t.isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)', shadowBlur: 8 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: t.isDark ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.18)' },
            { offset: 0.8, color: t.isDark ? 'rgba(168, 85, 247, 0.02)' : 'rgba(168, 85, 247, 0.01)' },
            { offset: 1, color: 'transparent' }
          ])
        }
      });
    }

    if (showCtr()) {
      series.push({
        name: 'CTR (%)',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        yAxisIndex: 0,
        data: ctr,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2, type: 'dashed' }
      });
    }

    if (showPosition()) {
      series.push({
        name: 'Avg Position',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        yAxisIndex: 0,
        data: position,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 2 }
      });
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 750,
      tooltip: {
        trigger: 'axis',
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        textStyle: { color: t.tooltipText, fontSize: 12 },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: t.pointerColor, width: 1, type: 'dashed' },
          crossStyle: { color: t.pointerColor }
        },
        padding: [10, 14]
      },
      grid: {
        top: 40,
        right: 45,
        bottom: 50,
        left: 55,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: t.axisLineColor } },
        axisLabel: {
          color: t.subTextColor,
          fontSize: 11,
          formatter: (v: string) => v.slice(5) // MM-DD
        }
      },
      yAxis: yAxes,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 18,
          bottom: 10,
          borderColor: t.sliderBorder,
          backgroundColor: t.sliderBg,
          fillerColor: t.sliderFiller,
          handleStyle: { color: t.sliderHandle, borderColor: t.textColor },
          textStyle: { color: t.subTextColor, fontSize: 10 }
        }
      ],
      series
    };

    chartInstance.setOption(option, true);
  });

  return (
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-area">
          <h3>
            <TrendingUp size={18} color="var(--color-secondary)" />
            {props.title || 'Search Performance Trends'}
            {props.categoryName && (
              <span class="engine-pill" style={{ "margin-left": '8px' }}>
                {props.categoryName}
              </span>
            )}
          </h3>
          <p>Daily clicks and search impressions with interactive GPU timeline scrub</p>
        </div>

        <div class="chart-metric-toggles">
          <button
            class={`chart-toggle-btn ${showClicks() ? 'active-clicks' : ''}`}
            onClick={() => setShowClicks(!showClicks())}
          >
            Clicks
          </button>
          <button
            class={`chart-toggle-btn ${showImpressions() ? 'active-impressions' : ''}`}
            onClick={() => setShowImpressions(!showImpressions())}
          >
            Impressions
          </button>
          <button
            class={`chart-toggle-btn ${showCtr() ? 'active-ctr' : ''}`}
            onClick={() => setShowCtr(!showCtr())}
          >
            CTR %
          </button>
          <button
            class={`chart-toggle-btn ${showPosition() ? 'active-position' : ''}`}
            onClick={() => setShowPosition(!showPosition())}
          >
            Position
          </button>
        </div>
      </div>

      <div class="chart-container-render" ref={containerRef}></div>
    </div>
  );
};
