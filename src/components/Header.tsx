import { Component } from 'solid-js';
import { 
  RefreshCw, 
  Globe, 
  LogIn, 
  LogOut, 
  ShieldCheck,
  Radio,
  Sun,
  Moon
} from 'lucide-solid';
import { UserAuthStatus } from '../types';
import { useTheme } from '../utils/theme';

interface HeaderProps {
  days: number;
  onSelectDays: (days: number) => void;
  isSyncing: boolean;
  syncProgress?: string;
  onSync: () => void;
  authStatus: UserAuthStatus;
  onLogout: () => void;
}

export const Header: Component<HeaderProps> = (props) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header class="header-bar">
      <div class="brand-section">
        <div class="brand-logo-icon">
          <Globe size={24} />
        </div>
        <div class="brand-info">
          <h1>
            OmniSearch Console
            <span class="engine-pill">
              <span class="dot"></span>
              SolidJS + ECharts 60fps
            </span>
          </h1>
          <div class="tagline">
            <span>Multi-Site & Category SEO Intelligence</span>
            <span>•</span>
            <span style={{ color: 'var(--color-secondary)' }}>Cloudflare D1 Native Edge</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        {/* Date Range Selector */}
        <div class="date-picker-group">
          <button 
            class={`date-btn ${props.days === 7 ? 'active' : ''}`}
            onClick={() => props.onSelectDays(7)}
            disabled={!props.authStatus.authenticated}
          >
            7 Days
          </button>
          <button 
            class={`date-btn ${props.days === 28 ? 'active' : ''}`}
            onClick={() => props.onSelectDays(28)}
            disabled={!props.authStatus.authenticated}
          >
            28 Days
          </button>
          <button 
            class={`date-btn ${props.days === 90 ? 'active' : ''}`}
            onClick={() => props.onSelectDays(90)}
            disabled={!props.authStatus.authenticated}
          >
            3 Months
          </button>
        </div>

        {/* Live Status Indicator */}
        <div 
          class="engine-pill" 
          style={{ 
            padding: '6px 12px',
            background: props.authStatus.authenticated ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-input)',
            color: props.authStatus.authenticated ? 'var(--color-success)' : 'var(--text-muted)',
            border: `1px solid ${props.authStatus.authenticated ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`,
            display: 'flex',
            "align-items": 'center',
            gap: '6px'
          }}
        >
          <Radio size={13} class={props.authStatus.authenticated ? 'pulse' : ''} />
          <span>{props.authStatus.authenticated ? 'Live GSC Connected' : 'GSC Disconnected'}</span>
        </div>

        {/* Theme Switcher Toggle */}
        <button 
          class="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span class="theme-icon-wrap">
            {theme() === 'dark' ? (
              <Sun size={17} style={{ color: '#f59e0b' }} />
            ) : (
              <Moon size={17} style={{ color: 'var(--color-primary)' }} />
            )}
          </span>
        </button>

        {/* On-Demand Sync Button */}
        <button 
          class="btn btn-primary"
          onClick={props.onSync}
          disabled={props.isSyncing || !props.authStatus.authenticated}
          title={!props.authStatus.authenticated ? 'Connect Google Search Console first to sync' : 'Sync verified properties from GSC'}
        >
          <RefreshCw 
            size={15} 
            class={props.isSyncing ? 'animate-spin' : ''} 
            style={{ animation: props.isSyncing ? 'spin 1s linear infinite' : 'none' }}
          />
          <span>{props.syncProgress || (props.isSyncing ? 'Syncing...' : 'Sync All')}</span>
        </button>

        {/* Auth / Account Button */}
        {props.authStatus.authenticated && props.authStatus.user ? (
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <div style={{ 
              display: 'flex', 
              "align-items": 'center', 
              gap: '6px', 
              background: 'var(--card-sub-bg)', 
              border: '1px solid var(--border-subtle)',
              padding: '5px 12px', 
              "border-radius": 'var(--radius-full)',
              "font-size": '0.78rem'
            }}>
              <ShieldCheck size={14} color="var(--color-success)" />
              <span>{props.authStatus.user.email}</span>
            </div>
            <button class="btn btn-outline" onClick={props.onLogout} title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <a href="/api/auth/login" class="btn btn-google" style={{ "text-decoration": 'none' }}>
            <LogIn size={15} />
            <span>Connect Google</span>
          </a>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
