import { Theme } from './theme';

export interface ChartThemeTokens {
  isDark: boolean;
  textColor: string;
  subTextColor: string;
  mutedTextColor: string;
  splitLineColor: string;
  axisLineColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  sliderBg: string;
  sliderFiller: string;
  sliderHandle: string;
  sliderBorder: string;
  pointerColor: string;
}

export function getChartThemeTokens(theme: Theme): ChartThemeTokens {
  const isDark = theme === 'dark';
  return {
    isDark,
    textColor: isDark ? '#ffffff' : '#0f172a',
    subTextColor: isDark ? '#94a3b8' : '#475569',
    mutedTextColor: isDark ? '#64748b' : '#64748b',
    splitLineColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.07)',
    axisLineColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.14)',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.12)',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
    sliderBg: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(241, 245, 249, 0.85)',
    sliderFiller: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.16)',
    sliderHandle: isDark ? '#6366f1' : '#4f46e5',
    sliderBorder: isDark ? 'transparent' : 'rgba(15, 23, 42, 0.1)',
    pointerColor: isDark ? 'rgba(99, 102, 241, 0.6)' : 'rgba(79, 70, 229, 0.5)'
  };
}
