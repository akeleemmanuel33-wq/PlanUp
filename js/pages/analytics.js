// ============================================================
// js/pages/analytics.js — Analytics dashboard
// ============================================================

import store                from '../state/store.js';
import { $, render }        from '../utils/dom.js';
import { fetchSummary, fetchWeeklyStats } from '../api/analytics.js';

export const render_analytics = render;

export const render = async () => {
  const taskArea = $('#task-area');
  if (!taskArea) return;

  taskArea.innerHTML = `<div id="analytics-panel" style="max-width:680px"></div>`;
  const panel = $('#analytics-panel');
  panel.innerHTML = `<div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:16px"></div>
                     <div class="skeleton" style="height:200px;border-radius:12px"></div>`;

  const [summary, weekly] = await Promise.all([fetchSummary(), fetchWeeklyStats()]);

  panel.innerHTML = `
    <div style="margin-bottom:24px">
      <h2 style="font-size:1.0625rem;font-weight:600;margin-bottom:16px">Analytics</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        ${statCard('Total', summary.total, '📋', 'var(--accent)')}
        ${statCard('Completed', summary.completed, '✅', 'var(--green)')}
        ${statCard('In Progress', summary.inProgress, '🔄', 'var(--blue)')}
        ${statCard('Overdue', summary.overdue, '🔴', 'var(--red)')}
      </div>
    </div>

    <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-size:.875rem;font-weight:600">Completion Rate</h3>
        <span style="font-size:1.5rem;font-weight:700;color:var(--accent)">${summary.completionRate}%</span>
      </div>
      <div class="progress-bar" style="height:8px">
        <div class="progress-bar-fill ${summary.completionRate > 70 ? 'green' : summary.completionRate > 40 ? '' : 'red'}"
             style="width:${summary.completionRate}%"></div>
      </div>
    </div>

    <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px">
      <h3 style="font-size:.875rem;font-weight:600;margin-bottom:16px">Last 7 Days</h3>
      ${renderWeeklyChart(weekly.data || [])}
    </div>
  `;
};

function statCard(label, value, icon, color) {
  return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px">
    <div style="font-size:1.25rem;margin-bottom:4px">${icon}</div>
    <div style="font-size:1.5rem;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:.75rem;color:var(--text-tertiary);margin-top:2px">${label}</div>
  </div>`;
}

function renderWeeklyChart(days) {
  if (!days.length) return '<p style="color:var(--text-tertiary);font-size:.875rem">No data yet</p>';
  const max = Math.max(...days.map(d => Math.max(d.completed || 0, d.created || 0)), 1);
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return `<div style="display:flex;align-items:flex-end;gap:8px;height:120px">
    ${days.map((d, i) => {
      const compH = Math.round(((d.completed || 0) / max) * 100);
      const label = new Date(d.day).toLocaleDateString('en', { weekday: 'short' });
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:100%;display:flex;gap:2px;align-items:flex-end;height:100px">
          <div style="flex:1;background:var(--accent);border-radius:3px 3px 0 0;height:${compH}%;min-height:${d.completed?'4px':'0'};transition:height 500ms ease;animation-delay:${i*50}ms"></div>
        </div>
        <span style="font-size:.6875rem;color:var(--text-tertiary)">${label}</span>
        <span style="font-size:.6875rem;font-weight:600;color:var(--text-secondary)">${d.completed || 0}</span>
      </div>`;
    }).join('')}
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
    <span style="width:10px;height:10px;background:var(--accent);border-radius:2px;display:inline-block"></span>
    <span style="font-size:.75rem;color:var(--text-secondary)">Tasks completed</span>
  </div>`;
}