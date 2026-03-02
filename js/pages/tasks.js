// ============================================================
// js/pages/tasks.js — Task list rendering + interactions
// ============================================================

import store                    from '../state/store.js';
import { $, $$, toast, debounce, escapeHtml, relativeTime } from '../utils/dom.js';
import { makeDraggable }        from '../utils/drag.js';
import { updateTask, deleteTask, deleteTasks } from '../api/tasks.js';
import { open as openModal }    from './task-modal.js';

let dragHandler = null;

export const init = () => {
  renderTasks();
  bindSearch();
  bindFilters();
  bindTopBarActions();
  bindBulkActions();

  store.on('tasks:changed',  renderTasks);
  store.on('filters:changed', renderTasks);
  store.on('list:changed',   renderTasks);
};

// ── Render task list ──────────────────────────────────────────
function renderTasks() {
  const container = $('#task-list');
  if (!container) return;

  const tasks = store.getFilteredTasks();
  const countEl = $('#view-count');
  if (countEl) countEl.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h3>No tasks here</h3>
        <p>Create a new task to get started</p>
      </div>`;
    return;
  }

  container.innerHTML = tasks.map((task, i) => renderCard(task, i)).join('');
  container.classList.add('stagger');

  // Bind card events
  $$('.task-card', container).forEach(card => bindCardEvents(card));

  // Init drag & drop
  if (dragHandler) dragHandler.refresh();
  else dragHandler = makeDraggable('#task-list', '.task-card', handleReorder);
  dragHandler.refresh();
}

// ── Task card HTML ────────────────────────────────────────────
function renderCard(task, index) {
  const isCompleted = task.status === 'completed';
  const isOverdue   = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
  const isPinned    = task.pinned;
  const isSelected  = store.selectedTaskIds.has(task.id);

  const subtasks     = task.subtasks || [];
  const doneSubtasks = subtasks.filter(s => s.completed).length;
  const hasSubs      = subtasks.length > 0;
  const subPct       = hasSubs ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

  const tags = (task.task_tags || []).map(tt => tt.tag).filter(Boolean);

  const classes = [
    'task-card',
    isCompleted ? 'completed' : '',
    isOverdue   ? 'overdue' : '',
    isPinned    ? 'pinned' : '',
    isSelected  ? 'selected' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes}"
         data-id="${task.id}"
         data-priority="${task.priority}"
         style="animation-delay:${index * 30}ms">

      <!-- Checkbox -->
      <div class="checkbox ${isCompleted ? 'checked' : ''} task-card-check"
           data-action="toggle" data-id="${task.id}" data-status="${task.status}"></div>

      <!-- Body -->
      <div class="task-card-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}

        <div class="task-meta">
          <!-- Priority badge -->
          <span class="badge badge-priority-${task.priority}">${task.priority}</span>

          <!-- Due date -->
          ${task.due_date ? `<span class="task-due-date">📅 ${relativeTime(task.due_date)}</span>` : ''}

          <!-- Subtask progress -->
          ${hasSubs ? `
            <span class="task-subtask-progress">
              <div class="progress-bar"><div class="progress-bar-fill ${subPct===100?'green':''}" style="width:${subPct}%"></div></div>
              ${doneSubtasks}/${subtasks.length}
            </span>` : ''}

          <!-- Tags -->
          ${tags.map(tag => `<span class="badge badge-tag" style="background:${tag.color}20;color:${tag.color};border-color:${tag.color}40">${escapeHtml(tag.name)}</span>`).join('')}

          <!-- Pin indicator -->
          ${isPinned ? `<span style="font-size:.7rem;color:var(--amber)">📌</span>` : ''}
        </div>
      </div>

      <!-- Hover actions -->
      <div class="task-card-actions">
        <button class="btn-icon" data-action="edit" data-id="${task.id}" data-tooltip="Edit">✏️</button>
        <button class="btn-icon" data-action="pin"  data-id="${task.id}" data-tooltip="${isPinned ? 'Unpin' : 'Pin'}">📌</button>
        <button class="btn-icon" data-action="delete" data-id="${task.id}" data-tooltip="Delete" style="color:var(--text-tertiary)">🗑</button>
      </div>
    </div>
  `;
}

// ── Card event bindings ───────────────────────────────────────
function bindCardEvents(card) {
  // Click card body → open detail / edit
  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id     = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;

    if (action === 'toggle') toggleStatus(id, e.target.dataset.status);
    else if (action === 'edit')   openModal(id);
    else if (action === 'pin')    pinTask(id);
    else if (action === 'delete') deleteTaskById(id);
    else {
      // Shift-click = select for bulk
      if (e.shiftKey) toggleSelect(id);
      else openModal(id);
    }
  });
}

// ── Toggle status ─────────────────────────────────────────────
async function toggleStatus(id, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
  const card = $(`[data-id="${id}"]`);

  // Optimistic UI
  store.upsertTask({ id, status: newStatus });

  if (newStatus === 'completed') {
    card?.classList.add('just-completed');
    setTimeout(() => card?.classList.remove('just-completed'), 600);
  }

  const { error } = await updateTask(id, { status: newStatus });
  if (error) { toast('Failed to update task', 'error'); store.upsertTask({ id, status: currentStatus }); }
}

// ── Pin ───────────────────────────────────────────────────────
async function pinTask(id) {
  const task = store.getTaskById(id);
  if (!task) return;
  store.upsertTask({ id, pinned: !task.pinned });
  const { error } = await updateTask(id, { pinned: !task.pinned });
  if (error) toast('Failed to pin task', 'error');
  else toast(task.pinned ? 'Unpinned' : 'Task pinned 📌');
}

// ── Delete ────────────────────────────────────────────────────
async function deleteTaskById(id) {
  if (!confirm('Delete this task?')) return;
  store.removeTask(id);
  const { error } = await deleteTask(id);
  if (error) toast('Failed to delete task', 'error');
  else toast('Task deleted');
}

// ── Bulk select ───────────────────────────────────────────────
function toggleSelect(id) {
  if (store.selectedTaskIds.has(id)) store.selectedTaskIds.delete(id);
  else store.selectedTaskIds.add(id);
  updateBulkBar();
  renderTasks();
}

function updateBulkBar() {
  const n    = store.selectedTaskIds.size;
  const bar  = $('#bulk-bar');
  const count = $('#bulk-count');
  if (bar)  bar.classList.toggle('hidden', n === 0);
  if (count) count.textContent = `${n} selected`;
}

// ── Drag reorder ──────────────────────────────────────────────
async function handleReorder(orderedIds) {
  const { reorderTasks } = await import('../api/tasks.js');
  reorderTasks(orderedIds);
}

// ── Search ────────────────────────────────────────────────────
function bindSearch() {
  const input = $('#search-input');
  if (!input) return;
  input.addEventListener('input', debounce((e) => {
    store.setFilter('search', e.target.value);
  }, 200));
}

// ── Filters ───────────────────────────────────────────────────
function bindFilters() {
  // Filter bar toggle
  $('#filter-btn')?.addEventListener('click', () => {
    $('#filter-bar')?.classList.toggle('hidden');
  });

  // Filter chips
  $$('[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const { filter, value } = chip.dataset;
      const current = store.filters[filter];
      const newVal  = current === value ? null : value;
      store.setFilter(filter, newVal);
      $$(`[data-filter="${filter}"]`).forEach(c => c.classList.remove('active'));
      if (newVal) chip.classList.add('active');
    });
  });

  // Clear filters
  $('#clear-filters-btn')?.addEventListener('click', () => {
    store.resetFilters();
    $$('.filter-chip').forEach(c => c.classList.remove('active'));
    const input = $('#search-input'); if (input) input.value = '';
  });
}

// ── Top bar buttons ───────────────────────────────────────────
function bindTopBarActions() {
  // New task button
  $('#new-task-btn')?.addEventListener('click', () => openModal(null));
  $('#add-task-inline-btn')?.addEventListener('click', () => openModal(null));

  // Theme toggle
  $('#theme-btn')?.addEventListener('click', () => {
    import('../utils/theme.js').then(({ theme }) => {
      const next = theme.toggle();
      toast(`${next === 'dark' ? '🌙' : '☀️'} ${next} mode`);
    });
  });

  // Compact toggle
  $('#compact-btn')?.addEventListener('click', () => {
    const c = document.documentElement.classList.toggle('compact');
    localStorage.setItem('pu-compact', c);
  });
}

// ── Bulk actions ──────────────────────────────────────────────
function bindBulkActions() {
  $('#bulk-complete-btn')?.addEventListener('click', async () => {
    const ids = [...store.selectedTaskIds];
    await Promise.all(ids.map(id => updateTask(id, { status: 'completed' })));
    ids.forEach(id => store.upsertTask({ id, status: 'completed' }));
    store.selectedTaskIds.clear();
    updateBulkBar();
    toast(`${ids.length} tasks completed ✅`);
  });

  $('#bulk-delete-btn')?.addEventListener('click', async () => {
    const ids = [...store.selectedTaskIds];
    if (!confirm(`Delete ${ids.length} tasks?`)) return;
    await deleteTasks(ids);
    ids.forEach(id => store.removeTask(id));
    store.selectedTaskIds.clear();
    updateBulkBar();
    toast(`${ids.length} tasks deleted`);
  });

  $('#bulk-clear-btn')?.addEventListener('click', () => {
    store.selectedTaskIds.clear();
    updateBulkBar();
    renderTasks();
  });
}