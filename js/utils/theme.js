// ============================================================
// js/utils/theme.js — Dark/Light mode + accent color
// ============================================================

const ROOT = document.documentElement;

export const theme = {
  /** Apply theme from prefs object */
  apply({ theme = 'light', accentColor = '#6366f1', compactView = false } = {}) {
    ROOT.setAttribute('data-theme', theme);
    ROOT.style.setProperty('--accent', accentColor);
    ROOT.style.setProperty('--accent-light', accentColor + '20');
    ROOT.classList.toggle('compact', compactView);
    localStorage.setItem('pu-theme', theme);
    localStorage.setItem('pu-accent', accentColor);
    localStorage.setItem('pu-compact', compactView);
  },

  /** Toggle between light and dark */
  toggle() {
    const current = ROOT.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    this.apply({ theme: next, accentColor: this.getAccent(), compactView: this.isCompact() });
    return next;
  },

  /** Set just the accent color */
  setAccent(color) {
    this.apply({ theme: this.getCurrent(), accentColor: color, compactView: this.isCompact() });
  },

  /** Load from localStorage on page start */
  load() {
    const theme    = localStorage.getItem('pu-theme') || 'light';
    const accent   = localStorage.getItem('pu-accent') || '#6366f1';
    const compact  = localStorage.getItem('pu-compact') === 'true';
    this.apply({ theme, accentColor: accent, compactView: compact });
    return { theme, accentColor: accent, compactView: compact };
  },

  getCurrent()  { return ROOT.getAttribute('data-theme') || 'light'; },
  getAccent()   { return localStorage.getItem('pu-accent') || '#6366f1'; },
  isCompact()   { return ROOT.classList.contains('compact'); },
};