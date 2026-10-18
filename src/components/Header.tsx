import { Component, createSignal } from 'solid-js';
import { 
  Sparkles, 
  RefreshCw, 
  Globe, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  Zap,
  ShieldCheck
} from 'lucide-solid';
import { UserAuthStatus } from '../services/api';

interface HeaderProps {
  days: number;
  onSelectDays: (days: number) => void;
  isDemo: boolean;
  onToggleDemo: (val: boolean) => void;
  isSyncing: boolean;
  onSync: () => void;
  authStatus: UserAuthStatus;
  onLogout: () => void;
}

export const Header: Component<HeaderProps> = (props) => {
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
          >
            7 Days
          </button>
          <button 
            class={`date-btn ${props.days === 28 ? 'active' : ''}`}
            onClick={() => props.onSelectDays(28)}
          >
            28 Days
          </button>
          <button 
            class={`date-btn ${props.days === 90 ? 'active' : ''}`}
            onClick={() => props.onSelectDays(90)}
          >
            3 Months
          </button>
        </div>

        {/* Demo Mode Toggle */}
        <button 
          class={`btn ${props.isDemo ? 'btn-demo' : 'btn-outline'}`}
          onClick={() => props.onToggleDemo(!props.isDemo)}
          title="Toggle between Live GSC API and Demo Benchmark Mode"
        >
          {props.isDemo ? <Sparkles size={15} /> : <Zap size={15} />}
          <span>{props.isDemo ? 'Demo Mode Active' : 'Live GSC Mode'}</span>
        </button>

        {/* On-Demand Sync Button */}
        <button 
          class="btn btn-primary"
          onClick={props.onSync}
          disabled={props.isSyncing}
        >
          <RefreshCw 
            size={15} 
            class={props.isSyncing ? 'animate-spin' : ''} 
            style={{ animation: props.isSyncing ? 'spin 1s linear infinite' : 'none' }}
          />
          <span>{props.isSyncing ? 'Syncing...' : 'Sync All'}</span>
        </button>

        {/* Auth / Account Button */}
        {props.authStatus.authenticated && props.authStatus.user ? (
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <div style={{ 
              display: 'flex', 
              "align-items": 'center', 
              gap: '6px', 
              background: 'rgba(255,255,255,0.06)', 
              padding: '4px 10px', 
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
