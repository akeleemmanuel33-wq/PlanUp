// ============================================================
// js/pages/sidebar.js — Sidebar rendering + interactions
// ============================================================

import store               from '../state/store.js';
import { $, $$, toast }   from '../utils/dom.js';
import { supabase }        from '../api/supabase.js';
import { createList }      from '../api/lists.js';

export const init = () => {
  renderUser();
  renderLists();
  renderTags();
  updateCounts();
  bindNav();
  bindUserMenu();
  bindAddList();

  store.on('lists:changed',  renderLists);
  store.on('tags:changed',   renderTags);
  store.on('tasks:changed',  updateCounts);
};

function renderUser() {
  const user = store.user;
  if (!user) return;
  const name     = user.user_metadata?.full_name || user.email.split('@')[0];
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $('#user-avatar').textContent = initials;
  $('#user-name').textContent   = name;
  $('#user-email').textContent  = user.email;
}

function renderLists() {
  const container = $('#sidebar-lists');
  if (!container) return;
  container.innerHTML = store.lists.map(list => {
    const count  = store.tasks.filter(t => t.list_id === list.id).length;
    const active = store.activeListId === list.id ? 'active' : '';
    return `<button class="sidebar-item ${active}" data-list-id="${list.id}">
      <span class="list-dot" style="background:${list.color}"></span>
      <span class="sidebar-item-label">${list.icon || ''} ${esc(list.name)}</span>
      <span class="sidebar-item-count">${count}</span>
    </button>`;
  }).join('');

  $$('[data-list-id]', container).forEach(btn => {
    btn.addEventListener('click', () => {
      store.setActiveList(btn.dataset.listId);
      store.resetFilters();
      setActiveNav(null, btn.dataset.listId);
      updateTitle('List: ' + (store.lists.find(l => l.id === btn.dataset.listId)?.name || ''));
    });
  });
}

function renderTags() {
  const container = $('#sidebar-tags');
  if (!container) return;
  if (!store.tags.length) {
    container.innerHTML = `<p style="padding:4px 16px;font-size:.75rem;color:var(--text-tertiary)">No tags yet</p>`;
    return;
  }
  container.innerHTML = store.tags.map(tag => `
    <button class="sidebar-item" data-tag-id="${tag.id}">
      <span class="list-dot" style="background:${tag.color}"></span>
      <span class="sidebar-item-label">${esc(tag.name)}</span>
    </button>`).join('');

  $$('[data-tag-id]', container).forEach(btn => {
    btn.addEventListener('click', () => {
      store.setFilter('tagIds', [btn.dataset.tagId]);
      store.setActiveList(null);
      setActiveNav(null, null);
    });
  });
}

function updateCounts() {
  const tasks    = store.tasks;
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  const set = (id, n) => { const el = $(id); if (el) el.textContent = n; };
  set('#count-all',      tasks.filter(t => t.status !== 'completed').length);
  set('#count-today',    tasks.filter(t => t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow && t.status !== 'completed').length);
  set('#count-upcoming', tasks.filter(t => t.due_date && new Date(t.due_date) >= tomorrow && new Date(t.due_date) <= nextWeek && t.status !== 'completed').length);
  set('#count-overdue',  tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'completed').length);
  store.lists.forEach(list => {
    const btn = $(`[data-list-id="${list.id}"]`);
    if (btn) { const c = btn.querySelector('.sidebar-item-count'); if (c) c.textContent = tasks.filter(t => t.list_id === list.id).length; }
  });
}

function bindNav() {
  $$('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setActiveList(null);
      store.resetFilters();
      applyView(btn.dataset.view);
      setActiveNav(btn, null);
    });
  });
}

function applyView(view) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  const titles   = { all:'All Tasks', today:'Today', upcoming:'Upcoming', overdue:'Overdue', analytics:'Analytics' };
  updateTitle(titles[view] || 'Tasks');
  if (view === 'today')    { store.setFilter('dueAfter', today.toISOString()); store.setFilter('dueBefore', tomorrow.toISOString()); }
  if (view === 'upcoming') { store.setFilter('dueAfter', tomorrow.toISOString()); store.setFilter('dueBefore', nextWeek.toISOString()); }
  if (view === 'overdue')  { store.setFilter('dueBefore', today.toISOString()); }
  if (view === 'analytics') import('./analytics.js').then(m => m.render());
}

function setActiveNav(activeBtn, activeListId) {
  $$('.sidebar-item').forEach(b => b.classList.remove('active'));
  if (activeBtn)        activeBtn.classList.add('active');
  else if (activeListId) $(`[data-list-id="${activeListId}"]`)?.classList.add('active');
  else                  $('#nav-all')?.classList.add('active');
}

function updateTitle(text) {
  const el = $('#view-title'); if (el) el.textContent = text;
}

function bindAddList() {
  $('#add-list-btn')?.addEventListener('click', async () => {
    const name = prompt('List name:');
    if (!name?.trim()) return;
    const colors = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'];
    const color  = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await createList({ name: name.trim(), color });
    if (error) return toast('Failed to create list', 'error');
    store.setLists([...store.lists, data]);
    toast(`"${name}" created`);
  });
}

function bindUserMenu() {
  const menuBtn  = $('#user-menu-btn');
  const dropdown = $('#user-dropdown');
  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('open');
    if (dropdown) {
      const rect = menuBtn.getBoundingClientRect();
      Object.assign(dropdown.style, { position:'fixed', left:`${rect.left}px`, bottom:`${window.innerHeight - rect.top + 8}px`, top:'auto' });
    }
  });
  document.addEventListener('click', () => dropdown?.classList.remove('open'));
  $('#menu-signout')?.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('/pages/auth.html'); });
  $('#menu-theme')?.addEventListener('click', () => import('../utils/theme.js').then(({ theme }) => { const n = theme.toggle(); toast(`Switched to ${n} mode`); }));
  $('#menu-compact')?.addEventListener('click', () => { const c = document.documentElement.classList.toggle('compact'); localStorage.setItem('pu-compact', c); toast(c ? 'Compact view on' : 'Compact view off'); });
}

const esc = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ?? '';