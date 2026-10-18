import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, ArrowRightLeft } from 'lucide-solid';
import { api, AuditResult } from '../services/api';

interface DataAuditModalProps {
  siteUrl: string;
  onClose: () => void;
}

export const DataAuditModal: Component<DataAuditModalProps> = (props) => {
  const [loading, setLoading] = createSignal(true);
  const [auditData, setAuditData] = createSignal<AuditResult | null>(null);
  const [errorMsg, setErrorMsg] = createSignal<string>('');

  const loadAudit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.runAudit(props.siteUrl, 28);
      if (res) {
        setAuditData(res);
      } else {
        setErrorMsg('Unable to retrieve audit data. Please ensure Google OAuth is connected.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadAudit();
  });

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()} style={{ "max-width": '980px' }}>
        {/* Header */}
        <div class="modal-header">
          <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
            <div class="brand-logo-icon" style={{ width: '34px', height: '34px' }}>
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h2>Live GSC Data Parity Audit</h2>
              <div style={{ "font-size": '0.78rem', color: 'var(--text-muted)' }}>
                Auditing {props.siteUrl} against live Google Search Console API
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <button class="btn btn-outline" onClick={loadAudit} disabled={loading()} style={{ padding: '4px 10px', "font-size": '0.78rem' }}>
              <RefreshCw size={13} class={loading() ? 'animate-spin' : ''} />
              <span>Re-run Audit</span>
            </button>
            <button class="close-btn" onClick={props.onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div class="modal-body">
          <Show when={loading()}>
            <div style={{ display: 'flex', "flex-direction": 'column', "align-items": 'center', "justify-content": 'center', padding: '60px', gap: '14px' }}>
              <RefreshCw size={28} class="animate-spin" color="var(--color-primary)" />
              <div style={{ color: 'var(--text-secondary)', "font-size": '0.9rem' }}>
                Querying Google Search Console Live API & comparing with Cloudflare D1...
              </div>
            </div>
          </Show>

          <Show when={!loading() && errorMsg()}>
            <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--color-danger)', padding: '16px', "border-radius": 'var(--radius-md)', color: '#fb7185' }}>
              {errorMsg()}
            </div>
          </Show>

          <Show when={!loading() && auditData()}>
            {/* Parity Score Banner */}
            <div style={{
              background: auditData()?.parityScore === 100 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${auditData()?.parityScore === 100 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              padding: '16px 20px',
              "border-radius": 'var(--radius-md)',
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'space-between',
              "flex-wrap": 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
                {auditData()?.parityScore === 100 ? (
                  <ShieldCheck size={28} color="var(--color-success)" />
                ) : (
                  <AlertTriangle size={28} color="var(--color-warning)" />
                )}
                <div>
                  <h3 style={{ "font-family": 'var(--font-heading)', "font-size": '1.1rem', color: '#fff' }}>
                    {auditData()?.parityScore}% Data Parity Verified
                  </h3>
                  <p style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>
                    Dates evaluated: {auditData()?.startDate} to {auditData()?.endDate} ({auditData()?.totalDaysAudited} days)
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "flex-wrap": 'wrap' }}>
                <span class="engine-pill" style={{
                  background: (auditData()?.summary.duplicateDatesCount || 0) === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: (auditData()?.summary.duplicateDatesCount || 0) === 0 ? '#34d399' : '#fb7185',
                  padding: '4px 10px',
                  "font-size": '0.75rem'
                }}>
                  {(auditData()?.summary.duplicateDatesCount || 0) === 0 ? '✓ 0 Duplicates' : `⚠ ${auditData()?.summary.duplicateDatesCount} Duplicates`}
                </span>

                <span class="engine-pill" style={{
                  background: (auditData()?.summary.missingDatesCount || 0) === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: (auditData()?.summary.missingDatesCount || 0) === 0 ? '#34d399' : '#fb7185',
                  padding: '4px 10px',
                  "font-size": '0.75rem'
                }}>
                  {(auditData()?.summary.missingDatesCount || 0) === 0 ? '✓ 0 Missing Days' : `⚠ ${auditData()?.summary.missingDatesCount} Missing Days`}
                </span>

                <div class="engine-pill" style={{
                  background: auditData()?.parityScore === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: auditData()?.parityScore === 100 ? '#34d399' : '#fbbf24',
                  padding: '6px 12px',
                  "font-size": '0.78rem'
                }}>
                  {auditData()?.parityScore === 100 ? '✓ 100% GSC Matched' : 'Discrepancy Detected'}
                </div>
              </div>
            </div>

            {/* Summary Comparison Grid */}
            <div style={{ display: 'grid', "grid-template-columns": 'repeat(4, 1fr)', gap: '12px' }}>
              {/* Clicks */}
              <div class="site-card-metrics-row" style={{ "grid-template-columns": '1fr', padding: '12px' }}>
                <span style={{ "font-size": '0.72rem', color: 'var(--text-muted)' }}>TOTAL CLICKS</span>
                <div style={{ display: 'flex', "justify-content": 'space-between', "margin-top": '4px' }}>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>GSC Live: <strong style={{ color: '#fff' }}>{auditData()?.summary.clicks.live.toLocaleString()}</strong></span>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>DB: <strong style={{ color: 'var(--color-secondary)' }}>{auditData()?.summary.clicks.db.toLocaleString()}</strong></span>
                </div>
                <div style={{ "font-size": '0.74rem', "font-weight": 600, color: auditData()?.summary.clicks.diff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "margin-top": '4px' }}>
                  Diff: {auditData()?.summary.clicks.diff}
                </div>
              </div>

              {/* Impressions */}
              <div class="site-card-metrics-row" style={{ "grid-template-columns": '1fr', padding: '12px' }}>
                <span style={{ "font-size": '0.72rem', color: 'var(--text-muted)' }}>TOTAL IMPRESSIONS</span>
                <div style={{ display: 'flex', "justify-content": 'space-between', "margin-top": '4px' }}>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>GSC Live: <strong style={{ color: '#fff' }}>{auditData()?.summary.impressions.live.toLocaleString()}</strong></span>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>DB: <strong style={{ color: 'var(--color-purple)' }}>{auditData()?.summary.impressions.db.toLocaleString()}</strong></span>
                </div>
                <div style={{ "font-size": '0.74rem', "font-weight": 600, color: auditData()?.summary.impressions.diff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "margin-top": '4px' }}>
                  Diff: {auditData()?.summary.impressions.diff}
                </div>
              </div>

              {/* CTR */}
              <div class="site-card-metrics-row" style={{ "grid-template-columns": '1fr', padding: '12px' }}>
                <span style={{ "font-size": '0.72rem', color: 'var(--text-muted)' }}>AVERAGE CTR</span>
                <div style={{ display: 'flex', "justify-content": 'space-between', "margin-top": '4px' }}>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>GSC: <strong style={{ color: '#fff' }}>{auditData()?.summary.ctr.live}%</strong></span>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>DB: <strong style={{ color: 'var(--color-success)' }}>{auditData()?.summary.ctr.db}%</strong></span>
                </div>
                <div style={{ "font-size": '0.74rem', "font-weight": 600, color: auditData()?.summary.ctr.diff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "margin-top": '4px' }}>
                  Diff: {auditData()?.summary.ctr.diff}%
                </div>
              </div>

              {/* Position */}
              <div class="site-card-metrics-row" style={{ "grid-template-columns": '1fr', padding: '12px' }}>
                <span style={{ "font-size": '0.72rem', color: 'var(--text-muted)' }}>WEIGHTED POSITION</span>
                <div style={{ display: 'flex', "justify-content": 'space-between', "margin-top": '4px' }}>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>GSC: <strong style={{ color: '#fff' }}>{auditData()?.summary.position.live}</strong></span>
                  <span style={{ "font-size": '0.78rem', color: 'var(--text-secondary)' }}>DB: <strong style={{ color: 'var(--color-warning)' }}>{auditData()?.summary.position.db}</strong></span>
                </div>
                <div style={{ "font-size": '0.74rem', "font-weight": 600, color: auditData()?.summary.position.diff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "margin-top": '4px' }}>
                  Diff: {auditData()?.summary.position.diff}
                </div>
              </div>
            </div>

            {/* Day-by-Day Audit Breakdown Table */}
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
              <h4 style={{ "font-size": '0.9rem', color: '#fff', "font-weight": 600 }}>
                Day-by-Day Verification Breakdown
              </h4>

              <div class="table-card" style={{ "max-height": '320px', "overflow-y": 'auto' }}>
                <table class="custom-table">
                  <thead style={{ position: 'sticky', top: 0, "z-index": 10 }}>
                    <tr>
                      <th>Date</th>
                      <th>GSC Live Clicks</th>
                      <th>DB Clicks</th>
                      <th>Clicks Diff</th>
                      <th>GSC Live Imp</th>
                      <th>DB Imp</th>
                      <th>Imp Diff</th>
                      <th>Parity Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={auditData()?.auditDays || []}>
                      {(day) => (
                        <tr>
                          <td style={{ "font-weight": 600, color: '#fff' }}>{day.date}</td>
                          <td>{day.live.clicks.toLocaleString()}</td>
                          <td style={{ color: 'var(--color-secondary)' }}>{day.db.clicks.toLocaleString()}</td>
                          <td style={{ color: day.clicksDiff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "font-weight": 600 }}>
                            {day.clicksDiff === 0 ? '0' : day.clicksDiff}
                          </td>
                          <td>{day.live.impressions.toLocaleString()}</td>
                          <td style={{ color: 'var(--color-purple)' }}>{day.db.impressions.toLocaleString()}</td>
                          <td style={{ color: day.impressionsDiff === 0 ? 'var(--color-success)' : 'var(--color-danger)', "font-weight": 600 }}>
                            {day.impressionsDiff === 0 ? '0' : day.impressionsDiff}
                          </td>
                          <td>
                            {day.isPerfectMatch ? (
                              <span class="trend-badge positive">✓ Exact Match</span>
                            ) : (
                              <span class="trend-badge negative">Mismatch</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
