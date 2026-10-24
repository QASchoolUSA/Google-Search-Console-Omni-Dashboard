import { createSignal } from 'solid-js';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'omnisearch_theme';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'dark'; // Default dark first, matching original styling
}

const [preference, setPreferenceSignal] = createSignal<ThemePreference>(getInitialPreference());
const [activeTheme, setActiveThemeSignal] = createSignal<Theme>(
  getInitialPreference() === 'system' ? getSystemTheme() : (getInitialPreference() as Theme)
);

function applyThemeToDOM(theme: Theme, animate = true) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add('theme-transitioning');
    window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 250);
  }

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

// Initialize on script load
if (typeof window !== 'undefined') {
  applyThemeToDOM(activeTheme(), false);

  // Listen to system changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = (e: MediaQueryListEvent) => {
    if (preference() === 'system') {
      const newTheme: Theme = e.matches ? 'dark' : 'light';
      setActiveThemeSignal(newTheme);
      applyThemeToDOM(newTheme, true);
    }
  };
  
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemChange);
  } else {
    mediaQuery.addListener(handleSystemChange);
  }
}

export function useTheme() {
  const setTheme = (pref: ThemePreference) => {
    setPreferenceSignal(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // localStorage may fail in restricted/incognito environments
    }

    const resolved: Theme = pref === 'system' ? getSystemTheme() : pref;
    setActiveThemeSignal(resolved);
    applyThemeToDOM(resolved, true);
  };

  const toggleTheme = () => {
    const next: Theme = activeTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return {
    theme: activeTheme,
    preference,
    setTheme,
    toggleTheme
  };
}
